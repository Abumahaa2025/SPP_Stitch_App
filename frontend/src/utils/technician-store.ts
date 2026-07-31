import { storage } from '@/src/utils/storage';
import type { TechnicianRecord, TechnicianSpecialty } from '@/src/types/technician';

const KEY = 'spp.technicians';

let cache: TechnicianRecord[] = [];
const listeners = new Set<() => void>();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function portalBase() {
  return 'https://spp.beta/portal';
}

export function subscribeTechnicians(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify() {
  listeners.forEach((fn) => fn());
}

export async function loadTechnicians(): Promise<TechnicianRecord[]> {
  const raw = await storage.getItem<string>(KEY, '');
  if (raw) {
    try { cache = JSON.parse(raw); } catch { cache = []; }
  }
  return cache;
}

async function save(list: TechnicianRecord[]) {
  cache = list;
  await storage.setItem(KEY, JSON.stringify(list));
  notify();
}

export async function addTechnician(input: {
  name: string;
  phone: string;
  specialty: TechnicianSpecialty;
}): Promise<TechnicianRecord> {
  const list = await loadTechnicians();
  const id = uid('tech');
  const token = uid('tok').slice(-12);
  const url = `${portalBase()}/tech?id=${id}&t=${token}`;
  const tech: TechnicianRecord = {
    ...input,
    id,
    portalToken: token,
    portalUrl: url,
    qrData: url,
    createdAt: new Date().toISOString(),
    linkActive: true,
    completedJobs: 0,
  };
  await save([...list, tech]);
  return tech;
}

export async function getTechnician(id: string) {
  const list = await loadTechnicians();
  return list.find((t) => t.id === id);
}

export async function updateTechnicianRating(id: string, rating: number) {
  const list = await loadTechnicians();
  const next = list.map((t) => {
    if (t.id !== id) return t;
    const jobs = (t.completedJobs ?? 0) + 1;
    const prev = t.avgRating ?? rating;
    const avg = Math.round(((prev * (jobs - 1)) + rating) / jobs * 10) / 10;
    return { ...t, avgRating: avg, completedJobs: jobs };
  });
  await save(next);
}

export async function recordTechLogin(id: string) {
  const list = await loadTechnicians();
  const next = list.map((t) => (
    t.id === id ? { ...t, lastLoginAt: new Date().toISOString() } : t
  ));
  await save(next);
}

export function inAppTechRouteFor(tech: TechnicianRecord) {
  return `/portal/tech?id=${tech.id}&t=${tech.portalToken}`;
}
