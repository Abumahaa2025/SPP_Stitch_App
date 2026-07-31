/**
 * Listens for Android share-sheet payloads and routes them into Upload.
 */
import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { stashSharedFiles } from '@/src/utils/upload-pick';

export function ShareIntentBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const handling = useRef(false);

  useEffect(() => {
    if (!hasShareIntent || handling.current) return;
    const files = shareIntent?.files ?? [];
    if (!files.length) return;

    handling.current = true;
    (async () => {
      try {
        await stashSharedFiles(
          files.map((f) => ({
            name: f.fileName || f.path?.split('/').pop() || 'shared-file',
            mimeType: f.mimeType || undefined,
            size: f.size ?? undefined,
            uri: f.path || undefined,
          })),
        );
        resetShareIntent(true);
        if (pathname !== '/upload') {
          router.replace('/upload' as any);
        }
      } finally {
        handling.current = false;
      }
    })();
  }, [hasShareIntent, shareIntent, resetShareIntent, router, pathname]);

  return null;
}
