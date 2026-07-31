import { useCallback, useEffect, useState } from 'react';
import { storage } from '@/src/utils/storage';

export type RoleKey =
  | 'owner'
  | 'co_owner'
  | 'property_manager'
  | 'accountant'
  | 'technician'
  | 'tenant';

export type RoleMember = {
  id: string;
  name: string;
  email: string;
  role: RoleKey;
  active: boolean;
};

/** Permission keys map to i18n roles.perm.* */
export const ROLE_PERMISSION_KEYS: Record<RoleKey, string[]> = {
  owner: ['all', 'billing', 'roles', 'delete'],
  co_owner: ['portfolio', 'finance', 'contracts', 'reports'],
  property_manager: ['portfolio', 'tenants', 'maintenance', 'messages'],
  accountant: ['finance', 'reports', 'contracts', 'export'],
  technician: ['maintenance', 'sensors', 'messages'],
  tenant: ['portal', 'payments', 'requests'],
};

const KEY = 'spp.roles';

const DEFAULT_MEMBERS: RoleMember[] = [
  { id: 'm1', name: '', email: '', role: 'owner', active: true },
];

export function useRoles() {
  const [members, setMembers] = useState<RoleMember[]>(DEFAULT_MEMBERS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(KEY, '');
      if (stored) {
        try {
          setMembers(JSON.parse(stored) as RoleMember[]);
        } catch { /* ignore */ }
      }
      setReady(true);
    })();
  }, []);

  const persist = useCallback((next: RoleMember[]) => {
    setMembers(next);
    storage.setItem(KEY, JSON.stringify(next));
  }, []);

  const addMember = useCallback((member: Omit<RoleMember, 'id'>) => {
    setMembers((prev) => {
      const next = [...prev, { ...member, id: `m_${Date.now()}` }];
      storage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateMember = useCallback((id: string, patch: Partial<RoleMember>) => {
    setMembers((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
      storage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeMember = useCallback((id: string) => {
    setMembers((prev) => {
      const next = prev.filter((m) => m.id !== id || m.role === 'owner');
      storage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { members, ready, addMember, updateMember, removeMember };
}
