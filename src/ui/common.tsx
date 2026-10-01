import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Dot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} />;
}

/** Campo numérico que só confirma ao sair do campo / Enter (evita salvar a cada tecla). */
export function MinutesInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = String(value);
  }, [value]);
  const commit = () => {
    const v = Math.round(Number(ref.current?.value));
    if (v > 0 && v !== value) onCommit(v);
    else if (ref.current) ref.current.value = String(value);
  };
  return (
    <input
      ref={ref}
      className="minutes"
      type="number"
      min={1}
      inputMode="numeric"
      defaultValue={value}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      aria-label="Minutos"
    />
  );
}

export const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
