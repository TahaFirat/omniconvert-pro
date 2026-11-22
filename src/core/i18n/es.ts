import { en } from './en';
import type { TranslationSchema } from './tr';

type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export const es: DeepString<TranslationSchema> = {
  ...en,
  nav: {
    convert: 'Convertir',
    queue: 'Cola',
    history: 'Historial',
    settings: 'Ajustes',
  },
  offlineLock: {
    ...en.offlineLock,
    activeShort: 'Offline',
    inactiveShort: 'Offline',
    bannerActive: 'Modo offline activo. Los archivos se procesan solo en el dispositivo.',
    tempAllowConfirm: 'Permitir',
    cancel: 'Cancelar',
  },
  badges: {
    ...en.badges,
    localTitle: 'En dispositivo',
    localShort: 'Local',
    cloudTitle: 'Nube',
    cloudShort: 'Nube',
  },
  convert: {
    ...en.convert,
    dropTitle: 'Seleccionar archivos',
    dropSubtitle: 'Fotos, PDF, Word, Excel, audio, video o archivos',
    pickFiles: 'Archivos',
    pickMedia: 'Fotos',
    scanCamera: 'Cámara',
    pasteClipboard: 'Pegar',
    presetsTitle: 'Herramientas rápidas',
    selectedFiles: 'Seleccionados',
    chooseTarget: 'Elegir formato',
    convertCount: 'Convertir {count} archivos',
  },
  settings: {
    ...en.settings,
    title: 'Ajustes',
    privacySection: 'Privacidad',
    offlineMode: 'Modo offline',
    appearanceSection: 'Apariencia',
    languageLabel: 'Idioma',
    restorePurchases: 'Restaurar compras',
    openSourceLicenses: 'Licencias de código abierto',
    privacyPolicy: 'Privacidad',
    termsOfUse: 'Términos de uso',
  },
};
