import "./App.css";
import AppRouter from "@/components/Router/AppRouter";
import ErrorBoundary from "@/components/Common/ErrorBoundary";
import { useSignalRInit } from "@/hooks/useSignalRInit";
import { ToastContainer } from "@/components/ui/Toast";

function AppContent() {
  // Initialize SignalR connection and event handlers
  useSignalRInit();

  return (
    <>
      <AppRouter />
      <ToastContainer />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
