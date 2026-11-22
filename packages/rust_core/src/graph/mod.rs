use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap, HashSet};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Tier {
    NativeHardware = 1,
    RustLocal = 2,
    CloudWorker = 3,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionEdge {
    pub source: String,
    pub target: String,
    pub engine_id: String,
    pub tier: Tier,
    pub quality_loss: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionPlan {
    pub steps: Vec<ConversionEdge>,
    pub total_weight: u32,
    pub requires_cloud: bool,
}

#[derive(Clone)]
struct QueueNode {
    cost: u32,
    node: String,
    steps: Vec<ConversionEdge>,
}

impl PartialEq for QueueNode {
    fn eq(&self, other: &Self) -> bool {
        self.cost == other.cost
    }
}
impl Eq for QueueNode {}

impl Ord for QueueNode {
    fn cmp(&self, other: &Self) -> Ordering {
        other.cost.cmp(&self.cost) // Min-heap by cost
    }
}

impl PartialOrd for QueueNode {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

fn edge_weight(edge: &ConversionEdge, additional_hop: bool) -> u32 {
    let tier_base = match edge.tier {
        Tier::NativeHardware => 10,
        Tier::RustLocal => 20,
        Tier::CloudWorker => 1000,
    };
    tier_base + (edge.quality_loss * 5) + if additional_hop { 15 } else { 0 }
}

pub struct ConversionGraph {
    adj: HashMap<String, Vec<ConversionEdge>>,
}

impl ConversionGraph {
    pub fn default_registry() -> Self {
        let edges = vec![
            ConversionEdge { source: "heic".into(), target: "png".into(), engine_id: "ios_imageio".into(), tier: Tier::NativeHardware, quality_loss: 0 },
            ConversionEdge { source: "heic".into(), target: "jpg".into(), engine_id: "ios_imageio".into(), tier: Tier::NativeHardware, quality_loss: 8 },
            ConversionEdge { source: "png".into(), target: "pdf".into(), engine_id: "local_pdf".into(), tier: Tier::RustLocal, quality_loss: 0 },
            ConversionEdge { source: "jpg".into(), target: "pdf".into(), engine_id: "local_pdf".into(), tier: Tier::RustLocal, quality_loss: 0 },
            ConversionEdge { source: "xlsx".into(), target: "csv".into(), engine_id: "rust_calamine".into(), tier: Tier::RustLocal, quality_loss: 4 },
            ConversionEdge { source: "csv".into(), target: "json".into(), engine_id: "rust_serde".into(), tier: Tier::RustLocal, quality_loss: 0 },
            ConversionEdge { source: "docx".into(), target: "pdf".into(), engine_id: "cloud_libreoffice".into(), tier: Tier::CloudWorker, quality_loss: 5 },
            ConversionEdge { source: "pdf".into(), target: "png".into(), engine_id: "ios_pdfkit".into(), tier: Tier::NativeHardware, quality_loss: 5 },
        ];
        Self::from_edges(edges)
    }

    pub fn from_edges(edges: Vec<ConversionEdge>) -> Self {
        let mut adj: HashMap<String, Vec<ConversionEdge>> = HashMap::new();
        for edge in edges {
            adj.entry(edge.source.clone()).or_default().push(edge);
        }
        Self { adj }
    }

    /// Dijkstra multi-hop planner (max 3 hops). Hard-prunes all Tier 3 edges when `offline_only == true`.
    pub fn plan(&self, source: &str, target: &str, offline_only: bool) -> Option<ConversionPlan> {
        if source == target {
            return None;
        }
        let mut heap = BinaryHeap::new();
        let mut best: HashMap<(String, usize), u32> = HashMap::new();
        heap.push(QueueNode {
            cost: 0,
            node: source.to_string(),
            steps: Vec::new(),
        });
        best.insert((source.to_string(), 0), 0);

        while let Some(current) = heap.pop() {
            if current.node == target && !current.steps.is_empty() {
                let requires_cloud = current.steps.iter().any(|s| s.tier == Tier::CloudWorker);
                return Some(ConversionPlan {
                    steps: current.steps,
                    total_weight: current.cost,
                    requires_cloud,
                });
            }
            if current.steps.len() >= 3 {
                continue;
            }

            let Some(outgoing) = self.adj.get(&current.node) else {
                continue;
            };
            let visited: HashSet<&str> = std::iter::once(source)
                .chain(current.steps.iter().map(|s| s.target.as_str()))
                .collect();

            for edge in outgoing {
                if offline_only && edge.tier == Tier::CloudWorker {
                    continue;
                }
                if visited.contains(edge.target.as_str()) {
                    continue;
                }
                let next_hops = current.steps.len() + 1;
                let next_cost = current.cost + edge_weight(edge, !current.steps.is_empty());
                let key = (edge.target.clone(), next_hops);
                if best.get(&key).copied().unwrap_or(u32::MAX) <= next_cost {
                    continue;
                }
                best.insert(key, next_cost);
                let mut next_steps = current.steps.clone();
                next_steps.push(edge.clone());
                heap.push(QueueNode {
                    cost: next_cost,
                    node: edge.target.clone(),
                    steps: next_steps,
                });
            }
        }
        None
    }
}
