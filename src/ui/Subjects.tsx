import { useState } from 'react';
import { addSubject, deleteSubject, listSubjects, updateSubject, type Subject } from '../db/repo';
import { useVersion } from '../db/store';
import { Empty, Modal } from './common';

export default function Subjects() {
  useVersion();
  const subjects = listSubjects();
  const [name, setName] = useState('');
  const [del, setDel] = useState<Subject | null>(null);

  const add = () => {
    if (!name.trim()) return;
    addSubject(name);
    setName('');
  };

  return (
    <>
      <h2>Matérias</h2>
      <form className="row gap" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="input grow" placeholder="Nova matéria (ex.: Direito Penal)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn primary" type="submit">Adicionar</button>
      </form>
      {subjects.length === 0 && <Empty>Cadastre as matérias do seu edital. Depois monte o ciclo na aba “Ciclos”.</Empty>}
      <ul className="list">
        {subjects.map((s) => (
          <li key={s.id} className="row gap">
            <input type="color" className="color" value={s.color} onChange={(e) => updateSubject(s.id, s.name, e.target.value)} aria-label={`Cor de ${s.name}`} />
            <input
              className="input grow"
              defaultValue={s.name}
              key={s.id + s.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && updateSubject(s.id, e.target.value, s.color)}
              aria-label="Nome da matéria"
            />
            <button className="btn danger" onClick={() => setDel(s)} aria-label={`Remover ${s.name}`}>🗑</button>
          </li>
        ))}
      </ul>
      {del && (
        <Modal title={`Remover “${del.name}”?`} onClose={() => setDel(null)}>
          <p>Ela sai de todos os ciclos. O histórico de estudo já registrado é mantido.</p>
          <div className="row end gap">
            <button className="btn" onClick={() => setDel(null)}>Voltar</button>
            <button className="btn danger" onClick={() => { deleteSubject(del.id); setDel(null); }}>Remover</button>
          </div>
        </Modal>
      )}
    </>
  );
}
