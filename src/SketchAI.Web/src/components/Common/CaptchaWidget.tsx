import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import {
  useRef,
  useEffect,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { getSiteKey } from "@/hooks/useCaptcha";

interface CaptchaWidgetProps {
  onSuccess: (token: string) => void;
  onExpire: () => void;
  onError?: () => void;
}

export interface CaptchaWidgetHandle {
  reset: () => void;
}

export const CaptchaWidget = forwardRef<CaptchaWidgetHandle, CaptchaWidgetProps>(
  function CaptchaWidget({ onSuccess, onExpire, onError }, forwardedRef) {
    const ref = useRef<TurnstileInstance>(null);
    const siteKey = useMemo(() => getSiteKey(), []);

    useImperativeHandle(forwardedRef, () => ({
      reset: () => {
        ref.current?.reset();
        onExpire();
      },
    }), [onExpire]);

    useEffect(() => {
      const instance = ref.current;
      return () => {
        instance?.reset();
      };
    }, []);

    const handleSuccess = useCallback(
      (token: string) => {
        if (!token || token.trim() === "") {
          console.warn("[Captcha] Received empty token from Turnstile widget");
          onError?.();
          return;
        }

        if (
          import.meta.env.DEV ||
          window.location.search.includes("debug=captcha")
        ) {
          console.log(`[Captcha] Token received, length: ${token.length}`);
        }

        onSuccess(token);
      },
      [onSuccess, onError],
    );

    const handleError = useCallback(() => {
      console.error("[Captcha] Turnstile widget error");
      onError?.();
    }, [onError]);

    useEffect(() => {
      if (!siteKey) {
        if (
          import.meta.env.DEV ||
          window.location.search.includes("debug=captcha")
        ) {
          console.log(
            "[Captcha] No site key configured, bypassing captcha (development mode)",
          );
        }
        onSuccess("");
      }
    }, [siteKey, onSuccess]);

    // Don't render widget if no site key
    if (!siteKey) {
      return null;
    }

    return (
      <div className="flex justify-center my-4">
        <Turnstile
          ref={ref}
          siteKey={siteKey}
          onSuccess={handleSuccess}
          onExpire={onExpire}
          onError={handleError}
          options={{
            theme: "dark",
            size: "flexible",
          }}
        />
      </div>
    );
  },
);
