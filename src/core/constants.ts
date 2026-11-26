export const APP_CONFIG = {
  appName: 'OmniConvert',
  bundleId: 'com.omniconvert.app',
  appGroupId: 'group.com.omniconvert.app',
  version: '1.1.1',
  cloudApiBaseUrl: import.meta.env.VITE_CLOUD_API_URL || '',
  cloudWorkerEnabled: Boolean(import.meta.env.VITE_CLOUD_API_URL),
  privacyPolicyUrl: 'https://tahafirat.github.io/omniconvert-pro/privacy.html',
  termsOfUseUrl: 'https://tahafirat.github.io/omniconvert-pro/terms.html',
  supportEmail: 'tafifirat@gmail.com',
  cloudTtlMinutes: 15,
  tusChunkSizeBytes: 5 * 1024 * 1024,
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
  MAGIC_HEADER_BYTES: 65_536,
  MAX_ZIP_EXPANSION_RATIO: 100,
  MAX_ARCHIVE_UNCOMPRESSED_BYTES: 256 * 1024 * 1024,
  MAX_ARCHIVE_ENTRIES: 2_000,
  STALE_TEMP_AGE_MS: 60 * 60 * 1000,
} as const;

export const MONETIZATION_CONFIG = {
  FREE_DAILY_PRO_TRIALS: 3,
  FREE_BATCH_LIMIT: 3,
  PRO_BATCH_LIMIT: 150,
  FREE_CUSTOM_PRESETS_LIMIT: 3,
  REVIEW_PROMPT_AFTER_LOCAL_SUCCESSES: 3,
  PRODUCTS: {
    PRO_MONTHLY: 'com.omniconvert.pro.monthly',
    PRO_YEARLY: 'com.omniconvert.pro.yearly',
    PRO_LIFETIME: 'com.omniconvert.pro.lifetime',
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
    purpose: 'On-device ZIP / GZIP / DOCX / XLSX / EPUB archive processing with zip-bomb protection',
  },
  {
    name: 'pdf-lib',
    license: 'MIT License',
    url: 'https://github.com/Hopding/pdf-lib',
    purpose: 'On-device PDF creation, merging, splitting, page rotation, and metadata removal',
  },
  {
    name: 'PDF.js (pdfjs-dist)',
    license: 'Apache-2.0 License',
    url: 'https://github.com/mozilla/pdf.js',
    purpose: 'On-device multi-page PDF preview rendering and text extraction',
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
    purpose: 'Offline XML / DOCX / XLSX / ODS structured data conversion',
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
    purpose: 'Vector iconography',
  },
  {
    name: 'Rust Core Engine',
    license: 'MIT / Apache-2.0',
    url: 'https://omniconvert.app/licenses',
    purpose: 'On-device format detection and conversion graph (Zero GPL; hardware media via Apple VideoToolbox)',
  },
];
