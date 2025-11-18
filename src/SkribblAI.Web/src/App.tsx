import "./App.css";
import DrawingCanvas from "./components/Canvas/DrawingCanvas";
import { SignalRProvider } from "@/context/SignalRContext";

function App() {
  return (
    <SignalRProvider>
      <div className="App">
        <h1>Skribbl AI - Drawing Test</h1>
        <p>Open this in multiple browser tabs to test real-time sync!</p>
        <DrawingCanvas />
      </div>
    </SignalRProvider>
  );
}

export default App;
