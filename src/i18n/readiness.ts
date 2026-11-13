import type { Language } from './messages';
/** A complete dictionary alone is insufficient: visible flows must also be reviewed and tested. */
export const languageReadiness: Readonly<Record<Language, { uiComplete: boolean; flowsVerified: boolean }>> = {
  es: { uiComplete: true, flowsVerified: true },
  en: { uiComplete: false, flowsVerified: false },
  it: { uiComplete: false, flowsVerified: false },
  fr: { uiComplete: false, flowsVerified: false },
  pt: { uiComplete: false, flowsVerified: false },
};
