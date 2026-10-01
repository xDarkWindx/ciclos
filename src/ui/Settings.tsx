import { getDailyGoalMin, getTimerMode, setSetting } from '../db/repo';
import { useVersion } from '../db/store';
import { signOut, type User } from '../auth/auth';
import { signIn } from '../auth/auth';
import { syncNow, useSyncStatus } from '../sync/sync';
import { requestNotifyPermission } from '../core/alarm';

export default function Settings({ user, onSignOut, local }: { user: User | null; onSignOut: () => void; local: boolean }) {
  useVersion();
  const sync = useSyncStatus();
  const mode = getTimerMode();
  const goal = getDailyGoalMin();

  const statusText = {
    off: 'Sincronização desligada (modo local)',
    idle: sync.lastAt ? `Sincronizado às ${new Date(sync.lastAt).toLocaleTimeString('pt-BR')}` : 'Pronto para sincronizar',
    syncing: 'Sincronizando…',
    error: `Erro: ${sync.message ?? 'falha ao sincronizar'}`,
    reauth: 'Sessão do Google expirou — reconecte',
  }[sync.state];

  return (
    <>
      <h2>Conta e ajustes</h2>
      <div className="card">
        {user ? (
          <div className="row gap">
            {user.picture && <img className="avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />}
            <div className="grow"><strong>{user.name}</strong><div className="muted">{user.email}</div></div>
            <button className="btn" onClick={() => { signOut(); onSignOut(); }}>Sair</button>
          </div>
        ) : (
          <div className="muted">Modo local: os dados ficam só neste dispositivo.</div>
        )}
      </div>

      {!local && (
        <div className="card">
          <div className="row between gap wrap">
            <div><strong>Google Drive</strong><div className={'muted' + (sync.state === 'error' ? ' warn' : '')}>{statusText}</div></div>
            {sync.state === 'reauth' ? (
              <button className="btn primary" onClick={async () => { await signIn(); await syncNow(); }}>Reconectar</button>
            ) : (
              <button className="btn" onClick={() => void syncNow()} disabled={sync.state === 'syncing'}>Sincronizar agora</button>
            )}
          </div>
          <p className="muted small">O arquivo SQLite fica numa pasta privada do app no seu Drive; só este app enxerga.</p>
        </div>
      )}

      <div className="card stack">
        <strong>Cronômetro</strong>
        <div className="seg" role="group" aria-label="Modo do cronômetro">
          <button className={mode === 'regressive' ? 'on' : ''} onClick={() => setSetting('timer_mode', 'regressive')}>Regressivo (até zero)</button>
          <button className={mode === 'progressive' ? 'on' : ''} onClick={() => setSetting('timer_mode', 'progressive')}>Progressivo (até a meta)</button>
        </div>
        <p className="muted small">O alarme toca ao chegar a zero (regressivo) ou ao atingir o tempo da etapa (progressivo). Vale para as próximas contagens.</p>
        <label>Meta diária (minutos)
          <input key={goal} className="input" type="number" min={0} step={10} defaultValue={goal} onBlur={(e) => setSetting('daily_goal_min', String(Math.max(0, Math.round(Number(e.target.value)))))} />
        </label>
        <button className="btn" onClick={() => void requestNotifyPermission()}>Permitir notificações do alarme</button>
      </div>
    </>
  );
}
