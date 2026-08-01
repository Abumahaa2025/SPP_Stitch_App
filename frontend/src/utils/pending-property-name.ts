import { storage } from '@/src/utils/storage';

const KEY = 'spp.pendingPropertyName';

export async function setPendingPropertyName(name: string) {
  await storage.setItem(KEY, name.trim());
}

export async function peekPendingPropertyName(): Promise<string> {
  return (await storage.getItem<string>(KEY, ''))?.trim() || '';
}

export async function takePendingPropertyName(): Promise<string> {
  const name = await peekPendingPropertyName();
  if (name) await storage.setItem(KEY, '');
  return name;
}
