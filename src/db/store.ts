import { useSyncExternalStore } from 'react';

// Contador de versão: toda mutação o incrementa e as telas releem o banco (dados pequenos, leitura síncrona).
let version = 0;
let dirty = false;
const subs = new Set<() => void>();
const dirtyListeners = new Set<() => void>();

export function emit() {
  version++;
  subs.forEach((f) => f());
}

/** Marca mudança local (pendente de sincronizar) + notifica as telas. */
export function markDirty() {
  dirty = true;
  dirtyListeners.forEach((f) => f());
  emit();
}

export const isDirty = () => dirty;
export const clearDirty = () => {
  dirty = false;
};
export const onDirty = (fn: () => void) => {
  dirtyListeners.add(fn);
  return () => dirtyListeners.delete(fn);
};

export function useVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => version,
  );
}
