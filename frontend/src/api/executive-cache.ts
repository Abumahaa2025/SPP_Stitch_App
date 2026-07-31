import { api } from './client';
import type { Executive } from './executive';

let cached: Executive | null = null;
let inflight: Promise<Executive> | null = null;

export function getExecutiveCached(): Executive | null {
  return cached;
}

export function clearExecutiveCache(): void {
  cached = null;
  inflight = null;
}

/** Single-flight fetch — reused across Home and BrainVerdict surfaces. */
export function fetchExecutiveCached(): Promise<Executive> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = api
    .executive()
    .then((data) => {
      cached = data;
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
