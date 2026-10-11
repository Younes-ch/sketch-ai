import { renderToString } from "react-dom/server";
import { JoinScreen } from "@/components/Lobby";

// Build-time only (see prerender.mjs): landing screen HTML for crawlers and first paint
export const render = () =>
  renderToString(<JoinScreen onJoinGame={async () => {}} />);
