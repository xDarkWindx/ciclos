import { useState } from 'react';
import { getSubject, updateSubjectNote } from '../db/repo';
import { useVersion } from '../db/store';
import { dismissFinished, useFinished, type FinishInfo } from '../core/controller';
import { formatDuration } from '../core/timer';
import { Dot, Modal } from './common';

/** Sempre montado no App: mostra o aviso de fim de sessão em qualquer aba. */
export default function TimerHost() {
  useVersion();
  const finished = useFinished();
  return finished ? <FinishedModal key={finished.subjectId + finished.seconds} info={finished} onClose={dismissFinished} /> : null;
}

function FinishedModal({ info, onClose }: { info: FinishInfo; onClose: () => void }) {
  const [note, setNote] = useState(() => getSubject(info.subjectId)?.note ?? '');
  const close = () => {
    if (note.trim() !== (getSubject(info.subjectId)?.note ?? '')) updateSubjectNote(info.subjectId, note);
    onClose();
  };
  return (
    <Modal title={info.ringing ? '⏰ Tempo concluído!' : 'Sessão salva'} onClose={info.ringing ? undefined : close}>
      <p><Dot color={info.color} /> <strong>{info.subjectName}</strong> — {formatDuration(info.seconds)} registrados.</p>
      {info.runFinished && <p className="ok">🎉 Você fechou a volta do ciclo! Uma nova já foi iniciada.</p>}
      <label>Onde parei (página, exercício…)
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: cap. 3, pág. 45 · questões até a 12" autoFocus={!info.ringing} />
      </label>
      <div className="row end"><button className="btn primary big" onClick={close}>{info.ringing ? 'Parar alarme' : 'Fechar'}</button></div>
    </Modal>
  );
}

