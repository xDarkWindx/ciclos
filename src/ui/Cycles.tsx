import { useState } from 'react';
import {
  addCycle, addStep, deleteCycle, deleteStep, getActiveCycle, listCycles, listSteps, listSubjects, moveStep, renameCycle,
  setActiveCycle, updateStep, type Cycle,
} from '../db/repo';
import { useVersion } from '../db/store';
import { formatDuration } from '../core/timer';
import { Dot, Empty, MinutesInput, Modal } from './common';

export default function Cycles({ goTo }: { goTo: (t: string) => void }) {
  useVersion();
  const cycles = listCycles();
  const active = getActiveCycle();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [del, setDel] = useState<Cycle | null>(null);

  if (editing && cycles.some((c) => c.id === editing)) return <CycleEditor id={editing} onBack={() => setEditing(null)} />;

  return (
    <>
      <h2>Ciclos</h2>
      <form className="row gap" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { setEditing(addCycle(name)); setName(''); } }}>
        <input className="input grow" placeholder="Novo ciclo (ex.: Polícia Federal)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn primary" type="submit">Criar</button>
      </form>
      {cycles.length === 0 && <Empty>Um ciclo é a lista ordenada de matérias com o tempo de cada uma. Ao completar todas, ele recomeça sozinho.</Empty>}
      <ul className="list">
        {cycles.map((c) => {
          const steps = listSteps(c.id);
          const total = steps.reduce((a, s) => a + s.targetMin * 60, 0);
          return (
            <li key={c.id} className="row gap wrap">
              <div className="grow">
                <strong>{c.name}</strong> {active?.id === c.id && <span className="chip">ativo</span>}
                <div className="muted">{steps.length} etapas · {formatDuration(total)} por volta</div>
              </div>
              {active?.id !== c.id && <button className="btn" onClick={() => { setActiveCycle(c.id); goTo('estudar'); }}>Usar</button>}
              <button className="btn" onClick={() => setEditing(c.id)}>Editar</button>
              <button className="btn danger" onClick={() => setDel(c)} aria-label={`Excluir ${c.name}`}>🗑</button>
            </li>
          );
        })}
      </ul>
      {del && (
        <Modal title={`Excluir “${del.name}”?`} onClose={() => setDel(null)}>
          <p>As etapas deste ciclo serão removidas. O histórico de estudo é mantido.</p>
          <div className="row end gap">
            <button className="btn" onClick={() => setDel(null)}>Voltar</button>
            <button className="btn danger" onClick={() => { deleteCycle(del.id); setDel(null); }}>Excluir</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function CycleEditor({ id, onBack }: { id: string; onBack: () => void }) {
  useVersion();
  const cycle = listCycles().find((c) => c.id === id)!;
  const steps = listSteps(id);
  const subjects = listSubjects();
  const [newSubject, setNewSubject] = useState('');
  const [newMin, setNewMin] = useState(40);

  // Total por matéria (a mesma matéria pode aparecer em várias etapas)
  const totals = new Map<string, { name: string; color: string; min: number }>();
  steps.forEach((s) => {
    const t = totals.get(s.subjectId) ?? { name: s.subjectName, color: s.color, min: 0 };
    t.min += s.targetMin;
    totals.set(s.subjectId, t);
  });

  return (
    <>
      <div className="row gap">
        <button className="btn" onClick={onBack}>← Voltar</button>
        <input className="input grow title" defaultValue={cycle.name} onBlur={(e) => e.target.value.trim() && renameCycle(id, e.target.value)} aria-label="Nome do ciclo" />
      </div>

      <h3>Etapas</h3>
      {subjects.length === 0 && <Empty>Cadastre matérias primeiro (aba “Matérias”).</Empty>}
      <ol className="list steps">
        {steps.map((s, i) => (
          <li key={s.id} className="row gap wrap">
            <span className="num">{i + 1}</span>
            <Dot color={s.color} />
            <select className="input grow" value={s.subjectId} onChange={(e) => updateStep(s.id, e.target.value, s.targetMin)} aria-label="Matéria">
              {subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <MinutesInput value={s.targetMin} onCommit={(v) => updateStep(s.id, s.subjectId, v)} /> <span className="muted">min</span>
            <button className="btn sm" disabled={i === 0} onClick={() => moveStep(id, s.id, -1)} aria-label="Subir">▲</button>
            <button className="btn sm" disabled={i === steps.length - 1} onClick={() => moveStep(id, s.id, 1)} aria-label="Descer">▼</button>
            <button className="btn sm danger" onClick={() => deleteStep(s.id)} aria-label="Remover etapa">🗑</button>
          </li>
        ))}
      </ol>

      {subjects.length > 0 && (
        <form className="row gap wrap card" onSubmit={(e) => { e.preventDefault(); addStep(id, newSubject || subjects[0].id, newMin); }}>
          <select className="input grow" value={newSubject || subjects[0].id} onChange={(e) => setNewSubject(e.target.value)} aria-label="Matéria da nova etapa">
            {subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <input className="minutes" type="number" min={1} value={newMin} onChange={(e) => setNewMin(Number(e.target.value))} aria-label="Minutos" /> <span className="muted">min</span>
          <button className="btn primary" type="submit">+ Etapa</button>
        </form>
      )}

      {totals.size > 0 && (
        <>
          <h3>Total por matéria</h3>
          <ul className="list">
            {[...totals.values()].map((t) => (
              <li key={t.name} className="row between"><span><Dot color={t.color} /> {t.name}</span><strong>{formatDuration(t.min * 60)}</strong></li>
            ))}
            <li className="row between"><span>Total do ciclo</span><strong>{formatDuration([...totals.values()].reduce((a, t) => a + t.min, 0) * 60)}</strong></li>
          </ul>
        </>
      )}
    </>
  );
}
