import "./App.css";
import AppRouter from "@/components/Router/AppRouter";
import ErrorBoundary from "@/components/Common/ErrorBoundary";
import { useSignalRInit } from "@/hooks/useSignalRInit";
import { useGameAudio } from "@/hooks/useGameAudio";

function AppContent() {
  // Initialize SignalR connection and event handlers
  useSignalRInit();

  // Initialize game audio effects
  useGameAudio();

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
