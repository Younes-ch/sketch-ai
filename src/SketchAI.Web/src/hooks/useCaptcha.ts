interface RuntimeConfig {
  TURNSTILE_SITE_KEY?: string;
  API_URL?: string;
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

// Debug helper to log captcha configuration status
const logCaptchaConfig = (source: string, key: string | undefined): void => {
  if (import.meta.env.DEV || window.location.search.includes('debug=captcha')) {
    console.log(`[Captcha] Source: ${source}, Key configured: ${!!key && key.trim() !== ''}, Length: ${key?.length ?? 0}`);
  }
};

// Get the site key from runtime config (production) or Vite env (development)
export const getSiteKey = (): string | undefined => {
  // Production: injected via Docker entrypoint into window.__RUNTIME_CONFIG__
  const runtimeKey = window.__RUNTIME_CONFIG__?.TURNSTILE_SITE_KEY;
  
  if (runtimeKey && runtimeKey.trim() !== '') {
    logCaptchaConfig('runtime-config', runtimeKey);
    return runtimeKey;
  }

  // Development with Vite: use VITE_ prefixed env var
  const viteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  if (viteKey && viteKey.trim() !== '') {
    logCaptchaConfig('vite-env', viteKey);
    return viteKey;
  }

  // Log if neither source has a key configured
  logCaptchaConfig('none', undefined);
  
  // In development/debug mode, log the full runtime config for diagnosis
  if (import.meta.env.DEV || window.location.search.includes('debug=captcha')) {
    console.log('[Captcha] Runtime config:', window.__RUNTIME_CONFIG__);
  }

  return undefined;
};

/**
 * Hook to check if CAPTCHA is enabled.
 */
export function useCaptcha() {
  const siteKey = getSiteKey();

  return {
    isEnabled: !!siteKey,
    siteKey,
  };
}
