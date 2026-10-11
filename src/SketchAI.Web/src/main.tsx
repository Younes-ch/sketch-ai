import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initializeTelemetry } from "./lib/telemetry";

// Initialize Application Insights telemetry (if configured)
void initializeTelemetry();

// A deploy removes old lazy chunks; reload to pick up the new build instead of crashing
window.addEventListener("vite:preloadError", () => window.location.reload());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
