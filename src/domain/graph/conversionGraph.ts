import { GRAPH_WEIGHTS } from '../../core/constants';
import type {
  ConversionEdge,
  ConversionTier,
  FileInspectionResult,
  FormatDescriptor,
  WarningCode,
} from '../entities/format';
import type { ConversionPlan, ConversionStep } from '../entities/job';
import {
  CONVERSION_EDGES,
  FORMAT_BY_ID,
  FORMAT_REGISTRY,
  normalizeFormatId,
} from '../formats/registry';

function computeEdgeWeight(edge: ConversionEdge, isAdditionalHop: boolean): number {
  const tierBase =
    edge.tier === 1
      ? GRAPH_WEIGHTS.TIER_1_BASE
      : edge.tier === 2
        ? GRAPH_WEIGHTS.TIER_2_BASE
        : GRAPH_WEIGHTS.TIER_3_BASE;

  return (
    tierBase +
    edge.qualityLoss * GRAPH_WEIGHTS.QUALITY_LOSS_MULTIPLIER +
    (isAdditionalHop ? GRAPH_WEIGHTS.HOP_PENALTY : 0)
  );
}

interface SearchState {
  node: string;
  cost: number;
  steps: ConversionStep[];
}

export class ConversionGraph {
  private readonly adjacency: Map<string, ConversionEdge[]>;

  constructor(edges: readonly ConversionEdge[] = CONVERSION_EDGES) {
    this.adjacency = new Map();
    for (const edge of edges) {
      const list = this.adjacency.get(edge.source) ?? [];
      list.push(edge);
      this.adjacency.set(edge.source, list);
    }
  }

  /**
   * Weighted Dijkstra shortest-path solver (max 3 hops).
   * Strictly enforces Local-First Invariant:
   * - Tier 1 (10) < Tier 2 (20) << Tier 3 (1000)
   * - When offlineOnly === true, ALL Tier 3 edges are physically pruned before traversal.
   */
  private runDijkstra(
    source: string,
    target: string,
    offlineOnly: boolean,
  ): { steps: ConversionStep[]; totalWeight: number } | null {
    if (source === target) return null;

    const queue: SearchState[] = [{ node: source, cost: 0, steps: [] }];
    // Track best cost per (node, hopCount) to prevent cycles and allow cheaper shorter routes
    const bestCost = new Map<string, number>();
    bestCost.set(`${source}:0`, 0);

    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift()!;

      if (current.node === target && current.steps.length > 0) {
        return { steps: current.steps, totalWeight: current.cost };
      }

      if (current.steps.length >= GRAPH_WEIGHTS.MAX_HOPS) {
        continue;
      }

      const outgoing = this.adjacency.get(current.node);
      if (!outgoing) continue;

      const visitedInPath = new Set([source, ...current.steps.map((s) => s.target)]);

      for (const edge of outgoing) {
        if (offlineOnly && edge.tier === 3) continue;
        if (visitedInPath.has(edge.target)) continue;

        const nextHopCount = current.steps.length + 1;
        const stepWeight = computeEdgeWeight(edge, current.steps.length > 0);
        const nextCost = current.cost + stepWeight;
        const stateKey = `${edge.target}:${nextHopCount}`;

        const prevBest = bestCost.get(stateKey);
        if (prevBest !== undefined && prevBest <= nextCost) {
          continue;
        }
        bestCost.set(stateKey, nextCost);

        queue.push({
          node: edge.target,
          cost: nextCost,
          steps: [
            ...current.steps,
            {
              source: edge.source,
              target: edge.target,
              engineId: edge.engineId,
              tier: edge.tier,
              latencyMsEst: edge.latencyMsEst,
              qualityLoss: edge.qualityLoss,
              warningCode: edge.warningCode,
            },
          ],
        });
      }
    }

    return null;
  }

  /**
   * Computes a full transparent ConversionPlan including multi-hop route,
   * highest required tier, offline-lock status, and upfront warnings.
   */
  public planConversion(
    sourceRaw: string,
    targetRaw: string,
    options: {
      offlineOnly: boolean;
      inspection?: FileInspectionResult;
      hasPassword?: boolean;
    },
  ): ConversionPlan | null {
    const source = normalizeFormatId(sourceRaw);
    const target = normalizeFormatId(targetRaw);

    const warnings = new Set<WarningCode>();
    let blockedReason: WarningCode | undefined;

    if (options.inspection?.hasDrm) {
      warnings.add('BLOCK_DRM');
      blockedReason = 'BLOCK_DRM';
    }
    if (options.inspection?.isEncrypted && !options.hasPassword) {
      warnings.add('BLOCK_ENCRYPTED');
      if (!blockedReason) blockedReason = 'BLOCK_ENCRYPTED';
    }

    const result = this.runDijkstra(source, target, options.offlineOnly);

    if (!result) {
      if (options.offlineOnly) {
        // Probe if a cloud path exists so UI can surface BLOCK_OFFLINE_LOCK transparently
        const cloudResult = this.runDijkstra(source, target, false);
        if (cloudResult) {
          warnings.add('BLOCK_OFFLINE_LOCK');
          for (const step of cloudResult.steps) {
            if (step.warningCode) warnings.add(step.warningCode);
          }
          return {
            sourceFormat: source,
            targetFormat: target,
            steps: cloudResult.steps,
            highestTier: 3,
            requiresCloud: true,
            totalWeight: cloudResult.totalWeight,
            estimatedMs: cloudResult.steps.reduce((acc, s) => acc + s.latencyMsEst, 0),
            warnings: Array.from(warnings),
            blockedByOfflineLock: true,
            blockedReason: blockedReason ?? 'BLOCK_OFFLINE_LOCK',
          };
        }
      }
      return null;
    }

    let highestTier: ConversionTier = 1;
    let estimatedMs = 0;
    for (const step of result.steps) {
      if (step.tier > highestTier) highestTier = step.tier;
      estimatedMs += step.latencyMsEst;
      if (step.warningCode) warnings.add(step.warningCode);
    }

    return {
      sourceFormat: source,
      targetFormat: target,
      steps: result.steps,
      highestTier,
      requiresCloud: highestTier === 3,
      totalWeight: result.totalWeight,
      estimatedMs,
      warnings: Array.from(warnings),
      blockedByOfflineLock: false,
      blockedReason,
    };
  }

  /**
   * Lists all reachable target formats from a given source format (up to 3 hops),
   * sorted with local-first and popular targets prioritized.
   */
  public getReachableTargets(
    sourceRaw: string,
    offlineOnly: boolean,
  ): Array<{ format: FormatDescriptor; plan: ConversionPlan; isPopular: boolean }> {
    const source = normalizeFormatId(sourceRaw);
    const sourceDesc = FORMAT_BY_ID.get(source);
    const popularSet = new Set(sourceDesc?.popularTargets ?? []);
    const results: Array<{ format: FormatDescriptor; plan: ConversionPlan; isPopular: boolean }> = [];

    for (const candidate of FORMAT_REGISTRY) {
      if (candidate.id === source) continue;
      const plan = this.planConversion(source, candidate.id, { offlineOnly });
      if (!plan) continue;
      results.push({
        format: candidate,
        plan,
        isPopular: popularSet.has(candidate.id),
      });
    }

    results.sort((a, b) => {
      // Local available first when offlineOnly, otherwise popular first then local-first
      if (a.plan.blockedByOfflineLock !== b.plan.blockedByOfflineLock) {
        return a.plan.blockedByOfflineLock ? 1 : -1;
      }
      if (a.isPopular !== b.isPopular) {
        return a.isPopular ? -1 : 1;
      }
      if (a.plan.requiresCloud !== b.plan.requiresCloud) {
        return a.plan.requiresCloud ? 1 : -1;
      }
      return a.plan.totalWeight - b.plan.totalWeight;
    });

    return results;
  }

  /**
   * Counts total reachable (source -> target) pairs across the entire graph.
   */
  public countTotalSupportedPairs(): number {
    let total = 0;
    for (const src of FORMAT_REGISTRY) {
      for (const dst of FORMAT_REGISTRY) {
        if (src.id === dst.id) continue;
        if (this.runDijkstra(src.id, dst.id, false)) {
          total++;
        }
      }
    }
    return total;
  }
}

export const conversionGraph = new ConversionGraph();
