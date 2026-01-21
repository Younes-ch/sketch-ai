import { trackException, trackTrace, SeverityLevel } from "./telemetry";

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

    if (isProd) {
      // Send warnings to Application Insights in production
      trackTrace(message, SeverityLevel.Warning, {
        args: JSON.stringify(args),
      });
    }
  },

  error: (message: string, error?: unknown, ...args: unknown[]) => {
    if (isDev) {
      console.error(`[ERROR] ${message}`, error, ...args);
    }

    if (isProd) {
      // Send errors to Application Insights in production
      const errorObj =
        error instanceof Error ? error : new Error(String(error ?? message));
      trackException(errorObj, {
        message,
        args: JSON.stringify(args),
      });
    }
  },
};
