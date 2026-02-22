import { useEffect, useRef } from "react";

const ADSENSE_CLIENT = "ca-pub-5976005551675649";

interface GoogleAdProps {
  slot: string;
  format?: string;
  layoutKey?: string;
}

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export default function GoogleAd({
  slot,
  format = "auto",
  layoutKey,
}: GoogleAdProps) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded (ad-blocker, local dev, etc.)
    }
  }, []);

  return (
    <div className="google-ad-wrapper rounded-2xl overflow-hidden bg-card border-2 border-card-border p-2">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
        {...(layoutKey ? { "data-ad-layout-key": layoutKey } : {})}
      />
    </div>
  );
}
