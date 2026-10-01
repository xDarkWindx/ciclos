import { useState } from 'react';
import { authConfigured, signIn, type User } from '../auth/auth';

export default function Login({ onUser, onLocal }: { onUser: (u: User) => void; onLocal: () => void }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const configured = authConfigured();

  const go = async () => {
    setBusy(true);
    setErr('');
    try {
      onUser(await signIn());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={72} height={72} />
      <h1>Ciclos de Estudo</h1>
      <p className="muted">Monte seu ciclo, cronometre cada matéria e acompanhe sua evolução. Seus dados sincronizam entre celular e web pelo seu Google Drive.</p>
      {configured ? (
        <button className="btn primary big" onClick={go} disabled={busy}>{busy ? 'Entrando…' : 'Entrar com Google'}</button>
      ) : (
        <>
          <p className="warn small">Login Google não configurado (defina VITE_GOOGLE_CLIENT_ID — veja o README). Você pode testar em modo local.</p>
          <button className="btn primary big" onClick={onLocal}>Usar em modo local</button>
        </>
      )}
      {err && <p className="warn" role="alert">{err}</p>}
    </main>
  );
}
