import { Component, type ReactNode, type ErrorInfo } from "react";

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
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    // TODO: Send to Application Insights when configured
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D1B2A] p-4">
          <div className="bg-[#1B2838] rounded-3xl p-8 shadow-2xl border-4 border-[#2A3F54] max-w-md text-center">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Oops! Something went wrong
            </h1>
            <p className="text-white/60 mb-6">
              Don't worry, it happens to the best of us. Try reloading the page.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="bg-[#0D1B2A] rounded-xl p-4 mb-6 text-left text-red-400 text-xs overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="px-6 py-3 bg-[#4CAF50] border-4 border-[#45a049] rounded-2xl text-white font-bold text-lg hover:bg-[#43A047] transition-all duration-200 hover:-translate-y-1"
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
