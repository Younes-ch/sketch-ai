import "./App.css";
import AppRouter from "@/components/Router/AppRouter";
import ErrorBoundary from "@/components/Common/ErrorBoundary";
import { useSignalRInit } from "@/hooks/useSignalRInit";

function AppContent() {
  // Initialize SignalR connection and event handlers
  useSignalRInit();
  return <AppRouter />;
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
