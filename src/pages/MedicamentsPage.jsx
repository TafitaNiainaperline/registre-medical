import { useEffect, useMemo, useState } from 'react';

const emptyForm = { name: '', price: '', description: '', stock: '' };

export default function MedicamentsPage() {
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const isAdmin = currentUser.role === 'admin';

  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState({ type: 'ok', text: '' });

  const load = () =>
    window.api.listMedications()
      .then((r) => setRows(r || []))
      .catch(() => setRows([]));

  useEffect(() => { load(); }, []);

  const notify = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'ok' }), 2500);
  };

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      const payload = {
        name: form.name.trim(),
        price: Number(form.price) || 0,
        description: form.description || '',
        stock: form.stock === '' ? null : Number(form.stock),
      };
      if (!payload.name) { notify('Nom du médicament requis.', 'err'); return; }
      if (editingId) await window.api.updateMedication(editingId, payload);
      else await window.api.createMedication(payload);
      setForm(emptyForm);
      setEditingId(null);
      notify(editingId ? 'Médicament mis à jour.' : 'Médicament ajouté.');
      load();
    } catch (err) {
      notify(err.message || 'Erreur lors de l’enregistrement.', 'err');
    }
  };

  const edit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      price: String(row.price ?? ''),
      description: row.description || '',
      stock: row.stock === null || row.stock === undefined ? '' : String(row.stock),
    });
  };

  const remove = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm('Supprimer ce médicament ?')) return;
    await window.api.deleteMedication(id);
    notify('Médicament supprimé.');
    load();
  };

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(r.name || '').toLowerCase().includes(q);
  });

  if (!isAdmin) {
    return (
      <section>
        <h1>Accès refusé</h1>
        <p>Seul l’administrateur peut gérer les médicaments.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Gestion des médicaments</h1>
          <p>Ajoutez, modifiez et supprimez les médicaments utilisés dans les traitements.</p>
        </div>
        <div className="dashboard-badge">💊 Médicaments</div>
      </div>

      {msg.text && (
        <div className={msg.type === 'err' ? 'error-msg' : 'success-msg'} style={{ marginBottom: '14px' }}>
          {msg.type === 'err' ? '⚠ ' : '✓ '}{msg.text}
        </div>
      )}

      <form className="record-form" onSubmit={submit}>
        <input name="name" placeholder="Nom médicament" value={form.name} onChange={onChange} required />
        <input name="price" type="number" min="0" placeholder="Prix (Ar)" value={form.price} onChange={onChange} required />
        <input name="stock" type="number" min="0" placeholder="Stock (optionnel)" value={form.stock} onChange={onChange} />
        <input name="description" placeholder="Description (optionnel)" value={form.description} onChange={onChange} />
        <div className="actions-row">
          <button type="submit">{editingId ? 'Modifier' : 'Ajouter'}</button>
          {editingId && (
            <button
              type="button"
              className="btn-light"
              onClick={() => { setEditingId(null); setForm(emptyForm); }}
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <div className="search-bar" style={{ marginTop: '16px' }}>
        <input placeholder="Rechercher un médicament..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Prix</th>
              <th>Description</th>
              <th>Stock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: '#5f7b84', padding: '24px' }}>
                  Aucun médicament.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.name}</strong></td>
                <td>{r.price} Ar</td>
                <td style={{ color: '#5f7b84' }}>{r.description || '-'}</td>
                <td>{r.stock === null || r.stock === undefined ? '-' : r.stock}</td>
                <td>
                  <button
                    className="icon-btn" title="Modifier" aria-label="Modifier" onClick={() => edit(r)}>
                    ✏️
                  </button>

                  <button className="icon-btn danger" title="Supprimer" aria-label="Supprimer" onClick={() => remove(r.id)}>
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
