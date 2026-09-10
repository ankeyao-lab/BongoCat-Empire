import { i18n } from '@/locales'

/** Empire UI follows the persisted app locale; unsupported languages use English. */
export function useEmpireLocale() {
  const locale = i18n.global.locale
  function tr(zh: string, en: string): string {
    return locale.value.toLowerCase().startsWith('zh') ? zh : en
  }
  return { tr, locale }
}
