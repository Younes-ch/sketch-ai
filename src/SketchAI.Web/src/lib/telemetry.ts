import type { ApplicationInsights } from "@microsoft/applicationinsights-web";

// The SDK's SeverityLevel values, defined locally: any value import from the SDK
// would put all of it (~1/3 of the landing page's JS) into the main bundle
export const SeverityLevel = {
  Verbose: 0,
  Information: 1,
  Warning: 2,
  Error: 3,
  Critical: 4,
} as const;
type SeverityLevel = (typeof SeverityLevel)[keyof typeof SeverityLevel];

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
export const initializeTelemetry = async (): Promise<void> => {
  if (appInsightsInstance) {
    return;
  }

  const connectionString = getConnectionString();

  if (!connectionString) {
    console.debug(
      "[Telemetry] Application Insights not configured - skipping initialization"
    );
    return;
  }

  try {
    const { ApplicationInsights } = await import("@microsoft/applicationinsights-web");
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
        // Adjust sampling percentage to reduce costs in production if needed
        // 100 = capture all telemetry, lower values reduce data volume
        samplingPercentage: 100,      },
    });

    appInsightsInstance.loadAppInsights();
    appInsightsInstance.trackPageView();

    console.debug("[Telemetry] Application Insights initialized successfully");
  } catch (error) {
    console.error("[Telemetry] Failed to initialize Application Insights", error);
  }
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
