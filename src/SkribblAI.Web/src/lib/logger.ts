const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  info: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, ...args);
    }
    // TODO: Send Warnings to Application Insights or other monitoring service in production
  },

  error: (message: string, error?: unknown, ...args: unknown[]) => {
    if (isDev) {
      console.error(`[ERROR] ${message}`, error, ...args);
    }
    
    if (isProd) {
      // TODO: Send Errors to Application Insights or other monitoring service in production
      // Example: appInsights.trackException({ exception: error, properties: { message, ...args } });
    }
  },
};
