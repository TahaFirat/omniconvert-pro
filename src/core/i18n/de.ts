import { en } from './en';
import type { TranslationSchema } from './tr';

type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export const de: DeepString<TranslationSchema> = {
  ...en,
  nav: {
    convert: 'Konvertieren',
    queue: 'Warteschlange',
    history: 'Verlauf',
    settings: 'Einstellungen',
  },
  offlineLock: {
    ...en.offlineLock,
    activeShort: 'Offline',
    inactiveShort: 'Offline',
    bannerActive: 'Offline-Modus aktiv. Dateien bleiben auf dem Gerät.',
    tempAllowConfirm: 'Erlauben',
    cancel: 'Abbrechen',
  },
  badges: {
    ...en.badges,
    localTitle: 'Auf Gerät',
    localShort: 'Lokal',
    cloudTitle: 'Cloud',
    cloudShort: 'Cloud',
  },
  convert: {
    ...en.convert,
    dropTitle: 'Dateien wählen',
    dropSubtitle: 'Fotos, PDF, Word, Excel, Audio, Video oder Archive',
    pickFiles: 'Dateien',
    pickMedia: 'Fotos',
    scanCamera: 'Kamera',
    pasteClipboard: 'Einfügen',
    presetsTitle: 'Schnellwerkzeuge',
    selectedFiles: 'Ausgewählt',
    chooseTarget: 'Format wählen',
    convertCount: '{count} Dateien konvertieren',
  },
  settings: {
    ...en.settings,
    title: 'Einstellungen',
    privacySection: 'Datenschutz',
    offlineMode: 'Offline-Modus',
    appearanceSection: 'Darstellung',
    languageLabel: 'Sprache',
    restorePurchases: 'Käufe wiederherstellen',
    openSourceLicenses: 'Open-Source-Lizenzen',
    privacyPolicy: 'Datenschutz',
    termsOfUse: 'Nutzungsbedingungen',
  },
};
