import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Rate limit error structure from the server.
 */
export interface RateLimitError {
  Type: "RateLimit";
  Message: string;
  RetryAfterSeconds: number;
}

/**
 * Checks if an error is a rate limit error.
 */
export function isRateLimitError(error: unknown): error is { rateLimitError: RateLimitError } {
  if (!(error instanceof Error)) return false;
  
  try {
    const parsed = JSON.parse(error.message);
    return parsed?.Type === "RateLimit";
  } catch {
    return false;
  }
}

/**
 * Parses a rate limit error from an exception.
 */
export function parseRateLimitError(error: unknown): RateLimitError | null {
  if (!(error instanceof Error)) return null;
  
  try {
    const message = error.message;
    
    // Check for HubException pattern first
    const hubExceptionMatch = message.match(/HubException:\s*(.+)$/);
    const jsonStr = hubExceptionMatch ? hubExceptionMatch[1] : message;
    
    const parsed = JSON.parse(jsonStr);
    if (parsed?.Type === "RateLimit") {
      return parsed as RateLimitError;
    }
  } catch {
    // Not a JSON rate limit error
  }
  
  return null;
}

/**
 * Extracts the clean error message from a SignalR HubException.
 * SignalR errors come in the format:
 * "An unexpected error occurred invoking 'MethodName' on the server. HubException: Actual message"
 */
export function parseHubError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "An unexpected error occurred";
  }

  const message = error.message;

  // Check for rate limit error first
  const rateLimitError = parseRateLimitError(error);
  if (rateLimitError) {
    return `${rateLimitError.Message} Try again in ${rateLimitError.RetryAfterSeconds}s.`;
  }

  // Check for HubException pattern
  const hubExceptionMatch = message.match(/HubException:\s*(.+)$/);
  if (hubExceptionMatch) {
    return hubExceptionMatch[1].trim();
  }

  // Check for general SignalR error pattern
  const serverErrorMatch = message.match(/on the server\.\s*(.+)$/);
  if (serverErrorMatch) {
    return serverErrorMatch[1].trim();
  }

  return message;
}