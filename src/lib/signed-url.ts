import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Short-lived signed URLs. We persist ONLY storage object paths in the DB
 * (bucket:path). At render time we mint a fresh signed URL with a 5-min TTL
 * so leaked links expire fast and access is re-checked on each read.
 */

const TTL_SECONDS = 60 * 5; // 5 minutes
const REFRESH_MS = (TTL_SECONDS - 30) * 1000;

// In-memory cache to avoid re-signing on every render.
const cache = new Map<string, { url: string; expiresAt: number }>();

export function isStoragePath(value: string | null | undefined, bucket: string): boolean {
  if (!value) return false;
  // Backwards compat: legacy rows stored full https signed URLs.
  if (/^https?:\/\//i.test(value)) return false;
  return value.startsWith(`${bucket}:`) || !value.includes("://");
}

function stripBucket(value: string, bucket: string): string {
  return value.startsWith(`${bucket}:`) ? value.slice(bucket.length + 1) : value;
}

export async function getSignedUrl(bucket: string, storedValue: string | null | undefined): Promise<string | null> {
  if (!storedValue) return null;
  // Legacy full URL — return as-is (will be replaced on next upload).
  if (/^https?:\/\//i.test(storedValue)) return storedValue;
  const path = stripBucket(storedValue, bucket);
  const key = `${bucket}::${path}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now + 15_000) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  cache.set(key, { url: data.signedUrl, expiresAt: now + TTL_SECONDS * 1000 });
  return data.signedUrl;
}

/** React hook — resolves + auto-refreshes a signed URL for a stored path. */
export function useSignedUrl(bucket: string, storedValue: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!storedValue) return null;
    if (/^https?:\/\//i.test(storedValue)) return storedValue;
    return null;
  });
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      const u = await getSignedUrl(bucket, storedValue);
      if (!alive) return;
      setUrl(u);
      // Refresh shortly before expiry.
      if (storedValue && !/^https?:\/\//i.test(storedValue)) {
        timer = setTimeout(tick, REFRESH_MS);
      }
    }
    if (storedValue) tick();
    else setUrl(null);
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [bucket, storedValue]);
  return url;
}

/** Encode a fresh upload as `bucket:path` so downstream code can re-sign later. */
export function encodeStoragePath(bucket: string, path: string): string {
  return `${bucket}:${path}`;
}