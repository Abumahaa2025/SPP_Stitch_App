/** MIME types for property import — keep broad so Android file manager shows all locations. */
export const UPLOAD_DOCUMENT_TYPES: string[] = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
  'text/plain',
  'text/tab-separated-values',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/*',
  '*/*',
];

export type IncomingPickedFile = {
  name: string;
  mimeType?: string;
  size?: number;
  uri?: string;
};

const PENDING_KEY = 'spp.pendingSharedFiles';

type Listener = () => void;
const listeners = new Set<Listener>();

export function onSharedFilesStashed(cb: Listener) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function notifyShared() {
  listeners.forEach((cb) => {
    try { cb(); } catch { /* ignore */ }
  });
}

/** Stash files received via Android Share sheet until Upload screen mounts. */
export async function stashSharedFiles(files: IncomingPickedFile[]) {
  if (!files.length) return;
  const { storage } = await import('@/src/utils/storage');
  const raw = await storage.getItem<string>(PENDING_KEY, '[]');
  let prev: IncomingPickedFile[] = [];
  try {
    prev = JSON.parse(raw || '[]');
  } catch {
    prev = [];
  }
  if (!Array.isArray(prev)) prev = [];
  const merged = [...files, ...prev].slice(0, 40);
  await storage.setItem(PENDING_KEY, JSON.stringify(merged));
  notifyShared();
}

export async function hasPendingSharedFiles(): Promise<boolean> {
  const { storage } = await import('@/src/utils/storage');
  const raw = await storage.getItem<string>(PENDING_KEY, '[]');
  try {
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) && list.length > 0;
  } catch {
    return false;
  }
}

export async function consumeSharedFiles(): Promise<IncomingPickedFile[]> {
  const { storage } = await import('@/src/utils/storage');
  const raw = await storage.getItem<string>(PENDING_KEY, '[]');
  await storage.setItem(PENDING_KEY, '[]');
  try {
    const list = JSON.parse(raw || '[]') as IncomingPickedFile[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
