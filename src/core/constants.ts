export const APP_CONFIG = {
  appName: 'OmniConvert Pro',
  bundleId: 'com.omniconvert.app',
  appGroupId: 'group.com.omniconvert.app',
  version: '1.0.0',
  cloudApiBaseUrl:
    import.meta.env.VITE_CLOUD_API_URL || 'https://api.omniconvert.app',
  privacyPolicyUrl: 'https://tahafirat.github.io/omniconvert-pro/privacy.html',
  termsOfUseUrl: 'https://tahafirat.github.io/omniconvert-pro/terms.html',
  supportEmail: 'tafifirat@gmail.com',
  cloudTtlMinutes: 15,
  tusChunkSizeBytes: 5 * 1024 * 1024, // 5 MB resumable chunks
} as const;

export const GRAPH_WEIGHTS = {
  TIER_1_BASE: 10,
  TIER_2_BASE: 20,
  TIER_3_BASE: 1000,
  QUALITY_LOSS_MULTIPLIER: 5,
  HOP_PENALTY: 15,
  MAX_HOPS: 3,
} as const;

export const SECURITY_GUARDS = {
  MAGIC_HEADER_BYTES: 65_536, // 64 KB header peek (never loads giant videos into RAM)
  MAX_ZIP_EXPANSION_RATIO: 100, // 100:1 zip-bomb guard
  MAX_ARCHIVE_UNCOMPRESSED_BYTES: 256 * 1024 * 1024, // 256 MB cap per local archive op
  MAX_ARCHIVE_ENTRIES: 2_000,
  STALE_TEMP_AGE_MS: 60 * 60 * 1000, // 1 hour orphan temp sweep
} as const;

export const MONETIZATION_CONFIG = {
  FREE_DAILY_CLOUD_TRIALS: 3,
  FREE_CLOUD_MAX_BYTES: 25 * 1024 * 1024, // 25 MB
  PRO_CLOUD_MAX_BYTES: 2 * 1024 * 1024 * 1024, // 2 GB
  FREE_BATCH_LIMIT: 10,
  CREDIT_PACK_BATCH_LIMIT: 50,
  PRO_BATCH_LIMIT: 150,
  FREE_CUSTOM_PRESETS_LIMIT: 2,
  CREDIT_PACK_PRESETS_LIMIT: 5,
  REVIEW_PROMPT_AFTER_LOCAL_SUCCESSES: 3,
  PRODUCTS: {
    CREDITS_100: 'com.omniconvert.credits.100',
    CREDITS_500: 'com.omniconvert.credits.500',
    CREDITS_2000: 'com.omniconvert.credits.2000',
    PRO_MONTHLY: 'com.omniconvert.pro.monthly',
    PRO_YEARLY: 'com.omniconvert.pro.yearly',
  },
} as const;

export interface OpenSourceNotice {
  name: string;
  license: string;
  url: string;
  purpose: string;
}

export const OPEN_SOURCE_NOTICES: readonly OpenSourceNotice[] = [
  {
    name: 'Capacitor (Core & iOS)',
    license: 'MIT License',
    url: 'https://github.com/ionic-team/capacitor',
    purpose: 'Native iOS bridge, Swift plugins, and App Store packaging',
  },
  {
    name: 'React & React DOM',
    license: 'MIT License',
    url: 'https://github.com/facebook/react',
    purpose: 'Mobile UI rendering engine',
  },
  {
    name: 'fflate',
    license: 'MIT License',
    url: 'https://github.com/101arrowz/fflate',
    purpose: 'On-device ZIP / GZIP / ZLIB archive processing with zip-bomb protection',
  },
  {
    name: 'pdf-lib',
    license: 'MIT License',
    url: 'https://github.com/Hopding/pdf-lib',
    purpose: 'On-device PDF creation, merging, splitting, and metadata stripping',
  },
  {
    name: 'js-yaml',
    license: 'MIT License',
    url: 'https://github.com/nodeca/js-yaml',
    purpose: 'Offline YAML <-> JSON conversion',
  },
  {
    name: 'smol-toml',
    license: 'MIT License',
    url: 'https://github.com/squirrelchat/smol-toml',
    purpose: 'Offline TOML <-> JSON conversion',
  },
  {
    name: 'fast-xml-parser',
    license: 'MIT License',
    url: 'https://github.com/NaturalIntelligence/fast-xml-parser',
    purpose: 'Offline XML / XLSX / ODS structured data conversion',
  },
  {
    name: 'PapaParse',
    license: 'MIT License',
    url: 'https://github.com/mholt/PapaParse',
    purpose: 'Offline CSV / TSV parsing and serialization',
  },
  {
    name: 'marked',
    license: 'MIT License',
    url: 'https://github.com/markedjs/marked',
    purpose: 'Offline Markdown <-> HTML conversion',
  },
  {
    name: 'Lucide Icons',
    license: 'ISC License',
    url: 'https://lucide.dev',
    purpose: 'Accessible vector iconography',
  },
  {
    name: 'Rust Core Engine',
    license: 'MIT / Apache-2.0',
    url: 'https://omniconvert.app/licenses',
    purpose: 'On-device format detection and conversion graph (Zero GPL; hardware media via Apple VideoToolbox)',
  },
];
