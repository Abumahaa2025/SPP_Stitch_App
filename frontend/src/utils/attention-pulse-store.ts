import { storage } from '@/src/utils/storage';

const ACK_KEY = 'spp.attentionAck';

let ackFingerprint = '';
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeAttention(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getAttentionAck() {
  return ackFingerprint;
}

export async function loadAttentionAck() {
  ackFingerprint = (await storage.getItem<string>(ACK_KEY, '')) ?? '';
  notify();
  return ackFingerprint;
}

export async function setAttentionAck(fp: string) {
  ackFingerprint = fp;
  await storage.setItem(ACK_KEY, fp);
  notify();
}

export { ACK_KEY };
