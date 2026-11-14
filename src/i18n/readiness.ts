import type { Language } from './messages';
/** A complete dictionary alone is insufficient: visible flows must also be reviewed and tested. */
export const languageReadiness: Readonly<Record<Language, { uiComplete: boolean; flowsVerified: boolean }>> = {
  es: { uiComplete: true, flowsVerified: true },
  en: { uiComplete: true, flowsVerified: true },
  it: { uiComplete: true, flowsVerified: true },
  fr: { uiComplete: true, flowsVerified: true },
  pt: { uiComplete: true, flowsVerified: true },
};
