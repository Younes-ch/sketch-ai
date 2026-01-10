// Available languages for word translation/explanation
export const LANGUAGES = [
  "English",
  "French",
  "Spanish",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Polish",
  "Russian",
  "Japanese",
  "Korean",
  "Chinese",
  "Arabic",
] as const;

export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_PREF_KEY = "sketch-ai-language";
export const DEFAULT_LANGUAGE = "English";