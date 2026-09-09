import {trackSeoEvent} from '../analytics/events.mjs';

export const LANGUAGE_PREFERENCE_KEY = 'csgrad.preferred-language.v1';
const APPLIED_KEY = 'csgrad.language-applied.v1';
const LOCALES = new Set(['zh-Hans', 'zh-Hant', 'en']);
const initialized = new WeakSet();

export function readLanguagePreference(browser) {
  try {
    const locale = browser.localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
    return {locale: LOCALES.has(locale) ? locale : null, available: true};
  } catch {
    return {locale: null, available: false};
  }
}

export function selectLanguage(locale, currentLocale, browser = window) {
  if (!LOCALES.has(locale)) return false;
  let persisted = false;
  try {
    browser.localStorage.setItem(LANGUAGE_PREFERENCE_KEY, locale);
    persisted = browser.localStorage.getItem(LANGUAGE_PREFERENCE_KEY) === locale;
  } catch {
    // Navigation remains available in private/blocked storage environments.
  }
  trackSeoEvent('language_preference_set', {
    current_locale: currentLocale,
    selected_locale: locale,
    preferred_locale: locale,
    preference_source: 'manual',
    storage_status: persisted ? 'persisted' : 'unavailable',
  }, browser);
  return persisted;
}

// Only the neutral homepage is an entry point for the saved default. Explicit
// language URLs, shared documents and payment/auth callbacks retain their route.
export function preferredHomepage(location, locale) {
  if (location.pathname !== '/' || !LOCALES.has(locale) || locale === 'zh-Hans') return null;
  return `/${locale}/${location.search || ''}${location.hash || ''}`;
}

export function initializeLanguagePreference(browser, currentLocale) {
  if (initialized.has(browser)) return;
  initialized.add(browser);
  const {locale, available} = readLanguagePreference(browser);
  const redirect = preferredHomepage(browser.location, locale);
  if (redirect) {
    try {
      browser.sessionStorage.setItem(APPLIED_KEY, JSON.stringify({locale, time: Date.now()}));
    } catch { /* Persistence of analytics is optional. */ }
    browser.location.replace(redirect);
    return;
  }
  const parameters = {
    current_locale: currentLocale,
    preferred_locale: locale || 'none',
    preference_source: locale ? 'saved' : 'default',
    storage_status: !available ? 'unavailable' : locale ? 'persisted' : 'none',
  };
  let applied = false;
  try {
    const pending = JSON.parse(browser.sessionStorage.getItem(APPLIED_KEY));
    browser.sessionStorage.removeItem(APPLIED_KEY);
    applied = pending?.locale === currentLocale && locale === currentLocale
      && browser.location.pathname === `/${currentLocale}/`
      && Number.isFinite(pending.time) && Date.now() >= pending.time
      && Date.now() - pending.time < 60000;
  } catch { /* Analytics should not affect page rendering. */ }
  // The analytics script may load after hydration. Keep one bounded retry, and
  // never block reading the page when analytics is blocked or unavailable.
  let attempts = 0;
  const send = () => {
    if (trackSeoEvent('audience_visit', parameters, browser)) {
      if (applied) trackSeoEvent('language_preference_applied', parameters, browser);
    } else if (++attempts < 20) {
      browser.setTimeout(send, 250);
    }
  };
  send();
}
