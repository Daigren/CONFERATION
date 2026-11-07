import { useSyncExternalStore } from 'react';
import { getDb, getSessionUserId, subscribe } from './api/db';

export const useDb = () => useSyncExternalStore(subscribe, getDb);

export function useCurrentUser() {
  const db = useDb();
  const id = useSyncExternalStore(subscribe, getSessionUserId);
  return db.users.find((u) => u.id === id) ?? null;
}
