export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  info: (message: string, ...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  error: (message: string, error?: unknown, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, error, ...args);
    // TODO: Send to Application Insights in production
  },
};
