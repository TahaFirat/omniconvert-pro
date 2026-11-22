import { tr, type TranslationSchema } from './tr';
import { en } from './en';
import { de } from './de';
import { es } from './es';

export type LocaleCode = 'tr' | 'en' | 'de' | 'es';

type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type Dictionary = DeepString<TranslationSchema>;

export const DICTIONARIES: Record<LocaleCode, Dictionary> = {
  tr,
  en,
  de,
  es,
};

export const SUPPORTED_LOCALES: readonly { code: LocaleCode; label: string }[] = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
];

export function detectDefaultLocale(): LocaleCode {
  if (typeof navigator === 'undefined') return 'tr';
  const lang = (navigator.language || 'tr').toLowerCase();
  if (lang.startsWith('tr')) return 'tr';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('en')) return 'en';
  return 'tr';
}

export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );
}
