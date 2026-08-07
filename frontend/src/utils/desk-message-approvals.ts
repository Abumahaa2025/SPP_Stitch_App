/**
 * Local desk approvals for prepare-not-send (Blueprint §2.5 / §13.3).
 * Persists owner approval + prepared content; delivery starts unsent.
 * Outbound Green API remains Placeholder — deep links only.
 */
import { storage } from '@/src/utils/storage';

const KEY = 'spp.deskMessageApprovals';

export type DeskMessageApproval = {
  approvalId: string;
  taskId: string;
  kind: string;
  preparedMessage: string;
  phone: string;
  approvedAt: string;
  /** Distinguishable from preparation — never "sent" via server rail in Phase 1 */
  deliveryStatus: 'unsent' | 'prepared' | 'opened_deep_link';
};

async function loadAll(): Promise<DeskMessageApproval[]> {
  const raw = await storage.getItem<string>(KEY, '');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DeskMessageApproval[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(rows: DeskMessageApproval[]): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(rows.slice(-200)));
}

export async function persistDeskMessageApproval(input: {
  taskId: string;
  kind: string;
  preparedMessage: string;
  phone?: string;
}): Promise<DeskMessageApproval> {
  const now = new Date().toISOString();
  const record: DeskMessageApproval = {
    approvalId: `desk-approval:${input.taskId}:${now}`,
    taskId: input.taskId,
    kind: input.kind,
    preparedMessage: input.preparedMessage,
    phone: String(input.phone || '').replace(/\D/g, ''),
    approvedAt: now,
    deliveryStatus: 'prepared',
  };
  const all = await loadAll();
  all.push(record);
  await saveAll(all);
  return record;
}

export async function markDeskApprovalDeepLinkOpened(approvalId: string): Promise<void> {
  const all = await loadAll();
  const next = all.map((row) =>
    (row.approvalId === approvalId
      ? { ...row, deliveryStatus: 'opened_deep_link' as const }
      : row));
  await saveAll(next);
}
