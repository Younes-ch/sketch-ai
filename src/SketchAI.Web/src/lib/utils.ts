import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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