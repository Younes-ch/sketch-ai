import "./App.css";
import { SignalRProvider } from "@/context/SignalRContext";
import AppRouter from "@/components/Router/AppRouter";
import ErrorBoundary from "@/components/Common/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <SignalRProvider>
        <AppRouter />
      </SignalRProvider>
    </ErrorBoundary>
  );
}

export default App;
