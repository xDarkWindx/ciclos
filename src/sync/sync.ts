import { useSyncExternalStore } from 'react';
import { NeedsReauth } from '../auth/auth';
import { mergeRemote } from '../db/merge';
import { exportBytes, openTemp, persistNow } from '../db/sqlite';
import { clearDirty, emit, isDirty, onDirty } from '../db/store';
import { download, findRemote, upload } from './drive';

export type SyncStatus = { state: 'off' | 'idle' | 'syncing' | 'error' | 'reauth'; lastAt?: number; message?: string };

let status: SyncStatus = { state: 'off' };
const subs = new Set<() => void>();
let enabled = false;
let running: Promise<void> | null = null;
let debounce: ReturnType<typeof setTimeout> | undefined;
let again = false;

function set(s: SyncStatus) {
  status = s;
  subs.forEach((f) => f());
}
export const useSyncStatus = () =>
  useSyncExternalStore((cb) => (subs.add(cb), () => subs.delete(cb)), () => status);

/** Sincronização: baixa o arquivo do Drive, mescla linha a linha, salva local e envia de volta. */
export function syncNow(): Promise<void> {
  if (!enabled) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    set({ ...status, state: 'syncing' });
    try {
      if (!navigator.onLine) throw new Error('Sem conexão');
      const id = await findRemote();
      let changed = false;
      if (id) {
        const tmp = await openTemp(await download(id));
        try {
          changed = mergeRemote(tmp);
        } finally {
          tmp.close();
        }
      }
      if (changed) {
        await persistNow();
        emit();
      }
      if (!id || changed || isDirty()) {
        clearDirty(); // limpar antes do envio: mudanças feitas durante o upload ficam marcadas
        await upload(exportBytes(), id);
      }
      set({ state: 'idle', lastAt: Date.now() });
    } catch (e) {
      set(e instanceof NeedsReauth ? { state: 'reauth', lastAt: status.lastAt } : { state: 'error', lastAt: status.lastAt, message: e instanceof Error ? e.message : String(e) });
    } finally {
      running = null;
      if (again) {
        again = false;
        void syncNow();
      }
    }
  })();
  return running;
}

let offDirty: (() => void) | undefined;
export function startSync() {
  enabled = true;
  set({ state: 'idle' });
  offDirty?.();
  offDirty = onDirty(() => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void syncNow(), 4000);
  });
  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  void syncNow();
}

export function stopSync() {
  enabled = false;
  offDirty?.();
  clearTimeout(debounce);
  set({ state: 'off' });
}
