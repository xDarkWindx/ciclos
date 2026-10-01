import { useState } from 'react';
import { addSubject, deleteSubject, listCategories, listSubjects, updateSubject, updateSubjectCategory, updateSubjectNote, type Subject } from '../db/repo';
import { useVersion } from '../db/store';
import { Empty, Modal } from './common';

export default function Subjects() {
  useVersion();
  const subjects = listSubjects();
  const categories = listCategories();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [del, setDel] = useState<Subject | null>(null);

  const add = () => {
    if (!name.trim()) return;
    addSubject(name, undefined, category);
    setName(''); // mantém a classificação: normalmente se cadastram várias da mesma área em sequência
  };

  return (
    <>
      <h2>Matérias</h2>
      <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <form className="row gap wrap" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="input grow wide" placeholder="Nova matéria (ex.: Direito Penal)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input cat" list="categories" placeholder="Classificação" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Classificação da nova matéria" />
        <button className="btn primary" type="submit">Adicionar</button>
      </form>
      {subjects.length === 0 && <Empty>Cadastre as matérias do seu edital. Depois monte o ciclo na aba “Ciclos”.</Empty>}
      <ul className="list">
        {subjects.map((s) => (
          <li key={s.id} className="stack tight">
            <div className="row gap">
              <input type="color" className="color" value={s.color} onChange={(e) => updateSubject(s.id, s.name, e.target.value)} aria-label={`Cor de ${s.name}`} />
              <input
                className="input grow"
                defaultValue={s.name}
                key={s.id + s.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && updateSubject(s.id, e.target.value, s.color)}
                aria-label="Nome da matéria"
              />
              <button className="btn danger" onClick={() => setDel(s)} aria-label={`Remover ${s.name}`}>🗑</button>
            </div>
            <div className="row gap wrap">
              <input
                className="input cat"
                list="categories"
                placeholder="Classificação"
                defaultValue={s.category}
                key={s.id + 'c' + s.category}
                onBlur={(e) => e.target.value.trim() !== s.category && updateSubjectCategory(s.id, e.target.value)}
                aria-label={`Classificação de ${s.name}`}
              />
              <textarea
                className="input grow wide"
                rows={1}
                placeholder="📝 Onde parei (pág., exercício)"
                defaultValue={s.note}
                key={s.id + 'n' + s.note}
                onBlur={(e) => e.target.value.trim() !== s.note && updateSubjectNote(s.id, e.target.value)}
                aria-label={`Anotação de ${s.name}`}
              />
            </div>
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
