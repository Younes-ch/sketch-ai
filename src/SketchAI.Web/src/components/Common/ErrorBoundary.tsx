import { Component, type ReactNode, type ErrorInfo } from "react";
import { logger } from "@/lib/logger";
import { trackException } from "@/lib/telemetry";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("ErrorBoundary caught an error", error, errorInfo);

    // Track exception in Application Insights
    try {
      trackException(error, {
        componentStack: errorInfo.componentStack ?? "unknown",
        source: "ErrorBoundary",
      })
    } catch {
      // Telemetry failure should not affect error handling
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
          <div className="bg-card rounded-3xl p-8 shadow-2xl border-4 border-card-border max-w-md text-center">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Oops! Something went wrong
            </h1>
            <p className="text-white/60 mb-6">
              Don't worry, it happens to the best of us. Try reloading the page.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="bg-background rounded-xl p-4 mb-6 text-left text-red-400 text-xs overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="px-6 py-3 bg-success border-4 border-success-dark rounded-2xl text-white font-bold text-lg hover:bg-success-hover transition-all duration-200 hover:-translate-y-1"
            >
              🔄 Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
