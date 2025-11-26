import "./App.css";
import { SignalRProvider } from "@/context/SignalRContext";
import AppRouter from "@/components/Router/AppRouter";

function App() {
  return (
    <SignalRProvider>
      <AppRouter />
    </SignalRProvider>
  );
}

export default App;
