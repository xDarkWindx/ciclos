import { useEffect, useState } from 'react';
import { restoreUser, type User } from './auth/auth';
import { closeDb, openDb, persistNow } from './db/sqlite';
import { loadTimer } from './core/controller';
import { startSync, stopSync } from './sync/sync';
import { emit } from './db/store';
import Login from './ui/Login';
import Study from './ui/Study';
import Cycles from './ui/Cycles';
import Subjects from './ui/Subjects';
import History from './ui/History';
import Dashboard from './ui/Dashboard';
import Settings from './ui/Settings';
import TimerHost from './ui/TimerHost';

const TABS = [
  ['estudar', '⏱', 'Estudar'],
  ['dashboard', '📊', 'Painel'],
  ['ciclos', '🔁', 'Ciclos'],
  ['materias', '📚', 'Matérias'],
  ['historico', '🕘', 'Histórico'],
  ['conta', '⚙', 'Conta'],
] as const;

export default function App() {
  const [user, setUser] = useState<User | null>(restoreUser);
  const [local, setLocal] = useState(() => localStorage.getItem('ciclos.local') === '1');
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<string>('estudar');

  const key = user?.sub ?? (local ? 'local' : null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setReady(false);
    (async () => {
      await openDb(key);
      if (cancelled) return;
      loadTimer();
      setReady(true);
      emit();
      if (user) startSync();
    })();
    const flush = () => void persistNow();
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
      stopSync();
      closeDb();
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!key) {
    return <Login onUser={setUser} onLocal={() => { localStorage.setItem('ciclos.local', '1'); setLocal(true); }} />;
  }
  if (!ready) return <div className="loading">Carregando…</div>;

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ciclos.local');
    setLocal(false);
  };

  return (
    <div className="app">
      <main className="content">
        {tab === 'estudar' && <Study goTo={setTab} />}
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'ciclos' && <Cycles goTo={setTab} />}
        {tab === 'materias' && <Subjects />}
        {tab === 'historico' && <History />}
        {tab === 'conta' && <Settings user={user} local={local} onSignOut={logout} />}
      </main>
      <TimerHost />
      <nav className="tabs" aria-label="Navegação">
        {TABS.map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
            <span aria-hidden>{icon}</span>{label}
          </button>
        ))}
      </nav>
    </div>
  );
}
