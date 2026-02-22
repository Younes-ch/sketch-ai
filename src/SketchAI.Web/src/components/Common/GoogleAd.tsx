import { useEffect, useRef } from "react";

const ADSENSE_CLIENT = "ca-pub-5976005551675649";
const ADSENSE_SLOT = "5711092566";

interface GoogleAdProps {
  format?: string;
  layoutKey?: string;
}

export default function GoogleAd({
  format = "auto",
  layoutKey,
}: GoogleAdProps = {}) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push(
        {},
      );
      pushed.current = true;
    } catch {
      // AdSense not loaded (ad-blocker, local dev, etc.)
    }
  }, []);

  return (
    <div className="google-ad-wrapper rounded-2xl overflow-hidden bg-card border-2 border-card-border p-2">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format={format}
        data-full-width-responsive="true"
        {...(layoutKey ? { "data-ad-layout-key": layoutKey } : {})}
      />
    </div>
  );
}
