import { ApplicationInsights, SeverityLevel } from "@microsoft/applicationinsights-web";

// Get Application Insights connection string from runtime config
const getConnectionString = (): string | undefined => {
  const runtimeConfig = (
    window as unknown as {
      __RUNTIME_CONFIG__?: { APPLICATIONINSIGHTS_CONNECTION_STRING?: string };
    }
  ).__RUNTIME_CONFIG__;
  return runtimeConfig?.APPLICATIONINSIGHTS_CONNECTION_STRING;
};

// Singleton instance
let appInsightsInstance: ApplicationInsights | null = null;

/**
 * Initialize Application Insights for frontend telemetry.
 * Safe to call multiple times - will only initialize once.
 */
export const initializeTelemetry = (): ApplicationInsights | null => {
  if (appInsightsInstance) {
    return appInsightsInstance;
  }

  const connectionString = getConnectionString();

  if (!connectionString) {
    console.debug(
      "[Telemetry] Application Insights not configured - skipping initialization"
    );
    return null;
  }

  try {
    appInsightsInstance = new ApplicationInsights({
      config: {
        connectionString,
        enableAutoRouteTracking: true,
        enableRequestHeaderTracking: true,
        enableResponseHeaderTracking: true,
        enableAjaxPerfTracking: true,
        enableUnhandledPromiseRejectionTracking: true,
        disableFetchTracking: false,
        autoTrackPageVisitTime: true,
        // Sampling to reduce costs in production
        samplingPercentage: 100,
      },
    });

    appInsightsInstance.loadAppInsights();
    appInsightsInstance.trackPageView();

    console.debug("[Telemetry] Application Insights initialized successfully");
    return appInsightsInstance;
  } catch (error) {
    console.error("[Telemetry] Failed to initialize Application Insights", error);
    return null;
  }
};

/**
 * Get the Application Insights instance (may be null if not configured)
 */
export const getAppInsights = (): ApplicationInsights | null => {
  return appInsightsInstance;
};

/**
 * Track a custom event
 */
export const trackEvent = (
  name: string,
  properties?: Record<string, string>,
  measurements?: Record<string, number>
): void => {
  appInsightsInstance?.trackEvent({ name }, { ...properties, ...measurements });
};

/**
 * Track an exception/error
 */
export const trackException = (
  error: Error,
  properties?: Record<string, string>,
  severityLevel?: SeverityLevel
): void => {
  appInsightsInstance?.trackException({
    exception: error,
    severityLevel: severityLevel ?? SeverityLevel.Error,
    properties,
  });
};

/**
 * Track a trace message
 */
export const trackTrace = (
  message: string,
  severityLevel?: SeverityLevel,
  properties?: Record<string, string>
): void => {
  appInsightsInstance?.trackTrace({
    message,
    severityLevel: severityLevel ?? SeverityLevel.Information,
    properties,
  });
};

/**
 * Track a metric
 */
export const trackMetric = (
  name: string,
  average: number,
  properties?: Record<string, string>
): void => {
  appInsightsInstance?.trackMetric({ name, average }, properties);
};

/**
 * Set the authenticated user context
 */
export const setAuthenticatedUser = (userId: string): void => {
  appInsightsInstance?.setAuthenticatedUserContext(userId, undefined, true);
};

/**
 * Clear the authenticated user context
 */
export const clearAuthenticatedUser = (): void => {
  appInsightsInstance?.clearAuthenticatedUserContext();
};

// Re-export SeverityLevel for consumers
export { SeverityLevel };
