import { useEffect, useState } from 'react';

function getToday() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

const emptyForm = { 
  name: '', 
  price: '', 
  stock: '', 
  stock_threshold: '100',
  unit: 'comprimé',
  date: getToday(),
};

const emptyActForm = { name: '', price: '', date: getToday() };

function capitalizeWords(value, preserveTrailingSpace = false) {
  const input = String(value || '');
  const trailingSpace = preserveTrailingSpace ? input.match(/\s*$/)?.[0] || '' : '';
  return input
    .trimStart()
    .toLowerCase()
    .replace(/(^|\s|[-''])(\p{L})/gu, (_, separator, char) => `${separator}${char.toUpperCase()}`)
    + trailingSpace;
}

function formatMadagascarDate(utcString) {
  if (!utcString) return '-';
  const d = new Date(utcString);
  const offset = 3 * 60;
  const local = new Date(d.getTime() + offset * 60 * 1000);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTextField(name, value) {
  const textFields = new Set(['name']);
  return textFields.has(name) ? capitalizeWords(value, true) : value;
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export default function MedicamentsPage() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'admin';
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [actForm, setActForm] = useState(emptyActForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState({ type: 'ok', text: '' });
  const [toast, setToast] = useState({ type: 'ok', text: '' });
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [stockQuantity, setStockQuantity] = useState('');
  const [movements, setMovements] = useState([]);
  const [topSelling, setTopSelling] = useState([]);
  

  const load = () =>
    window.api.listMedications()
      .then((r) => setRows(r || []))
      .catch(() => setRows([]));

   useEffect(() => {
    load();
  
    window.api.getMedicationMovements()
      .then(setMovements);
  
    window.api.getTopSellingMedications()
      .then(setTopSelling);
  }, []);

  const notify = (text, type = 'ok') => {
    setMsg({ text, type });
    setToast({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'ok' }), 2500);
    setTimeout(() => setToast({ text: '', type: 'ok' }), 3500);
  };

  const onChange = (e) => {
    const value = formatTextField(e.target.name, e.target.value);
    setForm({ ...form, [e.target.name]: value });
  };

  const onActChange = (e) => {
    setActForm({ ...actForm, [e.target.name]: formatTextField(e.target.name, e.target.value) });
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        item_type: 'medication',
        name: capitalizeWords(form.name.trim()),
        price: Number(form.price) || 0,
        stock: form.stock === '' ? null : Number(form.stock),
        stock_threshold: form.stock_threshold === '' ? 100 : Number(form.stock_threshold),
        unit: form.unit || 'comprimé',
        date: form.date,
      };
      if (!payload.name) { notify('Nom du médicament requis.', 'err'); return; }
      if (!editingId && !payload.date) { notify("Date d'ajout requise.", 'err'); return; }
      
      if (editingId) await window.api.updateMedication(editingId, payload);
      else await window.api.createMedication(payload);
      
      setForm(emptyForm);
      setEditingId(null);
      notify(editingId
        ? 'Médicament mis à jour.'
        : `Médicament ajouté le ${payload.date.split('-').reverse().join('/')}.${payload.stock !== null && payload.stock <= payload.stock_threshold ? ` Attention : stock atteint le seuil de ${payload.stock_threshold}.` : ''}`);
      load();
    } catch (err) {
      notify(err.message || 'Erreur lors de l\'enregistrement.', 'err');
    }
  };

  const submitAct = async (e) => {
    e.preventDefault();
    const name = capitalizeWords(actForm.name.trim());
    if (!name) { notify("Nom de l'acte requis.", 'err'); return; }
    if (!actForm.date) { notify("Date de l'acte requise.", 'err'); return; }

    try {
      await window.api.createMedication({
        item_type: 'act',
        name,
        price: Number(actForm.price) || 0,
        date: actForm.date,
      });
      setActForm(emptyActForm);
      notify(`Acte médical ajouté le ${actForm.date.split('-').reverse().join('/')}.`);
      load();
    } catch (err) {
      notify(err.message || "Erreur lors de l'ajout de l'acte.", 'err');
    }
  };

  const edit = (row) => {
    setEditingId(row.id);
    setForm({
      name: capitalizeWords(row.name || ''),
      price: String(row.price ?? ''),
      stock: row.stock === null || row.stock === undefined ? '' : String(row.stock),
      stock_threshold: String(row.stock_threshold ?? 100),
      unit: row.unit || 'comprimé',
      item_type: row.item_type || 'medication',
      date: row.created_at ? formatMadagascarDate(row.created_at) : getToday(),
    });
  };

  const remove = async (id) => {
    if (!window.confirm('Supprimer ce médicament ?')) return;
    await window.api.deleteMedication(id);
    notify('Médicament supprimé.');
    load();
  };

  const addStock = (row) => {
    setSelectedMedication(row);
    setStockQuantity('');
    setShowStockModal(true);
  };

  const confirmAddStock = async () => {
    const quantity = Number(stockQuantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      notify('Veuillez saisir une quantité valide.', 'err');
      return;
    }

    try {
      await window.api.addMedicationStock(
        selectedMedication.id,
        quantity
      );

      const newStock = (Number(selectedMedication.stock) || 0) + quantity;
      notify(newStock <= Number(selectedMedication.stock_threshold ?? 100)
        ? `Stock ajouté : +${quantity}. Attention : stock atteint le seuil de ${selectedMedication.stock_threshold ?? 100}.`
        : `Stock ajouté : +${quantity}`);

      setShowStockModal(false);
      setSelectedMedication(null);
      setStockQuantity('');

      load();
    } catch (err) {
      notify(err.message || 'Erreur lors de l\'ajout du stock.', 'err');
    }
  };

  const filtered = rows.filter((r) => {
    const q = normalizeSearch(search);
    if (!q) return true;
    return normalizeSearch(r.name).includes(q);
  });

  return (
    <>
      {toast.text && (
        <div className={`toast ${toast.type === 'err' ? 'toast-error' : ''}`} role="status">
          {toast.type === 'err' ? '⚠ ' : '✓ '}{toast.text}
        </div>
      )}
      {showStockModal && (
        <div className="modal-overlay">

          <div className="stock-modal">

            <div className="stock-modal-header">
              <h3>Ajouter du stock</h3>

              <button
                className="modal-close"
                onClick={() => setShowStockModal(false)}
              >
                ✕
              </button>
            </div>

            <p>
              Médicament :
              <strong> {selectedMedication?.name}</strong>
            </p>

            <input
              type="number"
              min="1"
              placeholder="Quantité à ajouter"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
            />

            <div className="stock-modal-actions">

              <button
                className="btn-light"
                onClick={() => setShowStockModal(false)}
              >
                Annuler
              </button>

              <button onClick={confirmAddStock}>
                Ajouter
              </button>

            </div>

          </div>

        </div>
      )}
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

        {rows.filter((r) => r.stock !== null && r.stock !== undefined && Number(r.stock) <= Number(r.stock_threshold ?? 100)).length > 0 && (
          <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '12px', background: '#fff4e5', border: '1px solid #f5d1a3', color: '#7f4a00' }}>
            ⚠️ {rows.filter((r) => r.stock !== null && r.stock !== undefined && Number(r.stock) <= Number(r.stock_threshold ?? 100)).length} médicament(s) ont atteint leur seuil d'alerte.
          </div>
        )}

        <form className="record-form" onSubmit={submit}>
          <input name="name" placeholder="Nom médicament" value={form.name} onChange={onChange} required />
          
          <input name="price" type="number" min="0" placeholder="Prix (Ar)" value={form.price} onChange={onChange} required />
          
          <select name="unit" value={form.unit} onChange={onChange} className="select" required>
              <option value="comprimé">Comprimé</option>
              <option value="gélule">Gélule</option>
              <option value="sachet">Sachet</option>
              <option value="sirop">Sirop</option>
              <option value="solution buvable">Solution buvable</option>
              <option value="ampoule">Ampoule</option>
              <option value="injection">Injection</option>
              <option value="perfusion">Perfusion</option>
              <option value="pommade">Pommade</option>
              <option value="crème">Crème</option>
              <option value="gel">Gel</option>
              <option value="spray">Spray</option>
              <option value="gouttes">Gouttes</option>
              <option value="suppositoire">Suppositoire</option>
              <option value="ovule">Ovule</option>
              <option value="patch">Patch</option>
              <option value="inhalateur">Inhalateur</option>
              <option value="poudre">Poudre</option>
              <option value="pastille">Pastille</option>
              <option value="plaquette">Plaquette</option>
              <option value="boîte">Boîte</option>
              <option value="flacon">Flacon</option>
              <option value="tube">Tube</option>
              <option value="sachet individuel">Sachet individuel</option>
            </select>

          <input name="stock" type="number" min="0" placeholder="Stock (optionnel)" value={form.stock} onChange={onChange} />

          <label className="stock-threshold-field">
            <span>Seuil d’alerte du stock</span>
            <input name="stock_threshold" type="number" min="0" value={form.stock_threshold} onChange={onChange} required />
            <small>Alerte lorsque le stock atteint ou descend sous cette valeur.</small>
          </label>

          {!editingId && (
            <label className="medication-date-field">
              <span>Date d’ajout</span>
              <input name="date" type="date" value={form.date} onChange={onChange} required />
            </label>
          )}
          
          <div className="actions-row">
            <button type="submit">{editingId ? 'Modifier' : 'Ajouter'}</button>
            {editingId && (
              <button type="button" className="btn-light"
                onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                Annuler
              </button>
            )}
          </div>
        </form>

        <h2 style={{ marginTop: '24px' }}>Ajouter un acte médical</h2>
        <form className="record-form" onSubmit={submitAct}>
          <input name="name" placeholder="Nom de l’acte (ex. Échographie)" value={actForm.name} onChange={onActChange} required />
          <input name="price" type="number" min="0" placeholder="Prix (Ar)" value={actForm.price} onChange={onActChange} required />
          <label className="medication-date-field">
            <span>Date de l’acte</span>
            <input name="date" type="date" value={actForm.date} onChange={onActChange} required />
          </label>
          <div className="actions-row">
            <button type="submit">Ajouter l’acte</button>
          </div>
        </form>

        {/* Barre de recherche */}
        <div className="search-bar" style={{ margin: '20px 0' }}>
          <input
            type="text"
            placeholder="🔍 Rechercher un médicament..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '220px' }}
          />

        </div>

        <div className="archive-grid" style={{ marginBottom: '20px' }}>
          <button
            onClick={() => window.api.exportStockExcel()}
          >
            📊 Excel
          </button>

          <button
            onClick={() => window.api.exportStockPdf()}
          >
            📄 PDF
          </button>
        </div>

        {/* Tableau des médicaments */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Prix (Ar)</th>
                <th>Unité</th>
                <th>Stock</th>
                <th>Seuil</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#5f7b84' }}>
                    Aucun médicament trouvé.
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const isLowStock = r.stock !== null && r.stock !== undefined && Number(r.stock) <= Number(r.stock_threshold ?? 100);
                return (
                  <tr
                    key={r.id}
                    style={isLowStock ? { background: '#fff7ea' } : undefined}
                  >
                    <td><strong>{r.name}</strong></td>
                    <td>{r.item_type === 'act' ? 'Acte médical' : 'Médicament'}</td>
                    <td>{Number(r.price).toLocaleString()} Ar</td>
                    <td>
                      {r.item_type === 'act' ? '-' : <span className="unit-badge">{r.unit || 'comprimé'}</span>}
                    </td>
                    <td>
                      {r.item_type === 'act' ? '-'
                        : r.stock !== null && r.stock !== undefined
                        ? (
                          <>
                            <strong>{r.stock}</strong>
                            {isLowStock && (
                              <span style={{
                                marginLeft: '8px',
                                padding: '3px 8px',
                                background: '#ffe4c2',
                                color: '#8f4c00',
                                borderRadius: '999px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                              }}>
                                Stock faible
                              </span>
                            )}
                          </>
                        )
                        : <span style={{ color: '#888' }}>Non suivi</span>}
                    </td>
                    <td>{r.item_type === 'act' ? '-' : (r.stock_threshold ?? 100)}</td>
                      <td>{formatMadagascarDate(r.created_at)}</td>
                    <td>
                      {isAdmin ? (
                        <>
                        {r.item_type !== 'act' && (
                          <button className="icon-btn" onClick={() => addStock(r)} title="Ajouter du stock">➕</button>
                        )}

                        <button className="icon-btn" onClick={() => edit(r)} title="Modifier">✏️</button>

                        <button className="icon-btn danger" onClick={() => remove(r.id)} title="Supprimer">🗑️</button>
                        </>
                      ) : <span style={{ color: '#888' }}>Consultation</span>}
                      </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>



        {/* Médicaments les plus vendus */}
        <div className="table-wrap" style={{ marginTop: '30px' }}>

          <h2>🏆 Médicaments les plus vendus</h2>

          <table>
            <thead>
              <tr>
                <th>Médicament</th>
                <th>Quantité vendue</th>
              </tr>
            </thead>

            <tbody>

              {topSelling.length === 0 && (
                <tr>
                  <td
                    colSpan="2"
                    style={{ textAlign: 'center' }}
                  >
                    Aucune vente enregistrée.
                  </td>
                </tr>
              )}

              {topSelling.map((m, i) => {
                return (
                  <tr key={i}>
                    <td>{m.medication_name}</td>
                    <td>{m.total_sold}</td>
                  </tr>
                );
              })}

            </tbody>
          </table>

        </div>

        {/* Historique des mouvements */}
        <div className="table-wrap" style={{ marginTop: '30px' }}>

          <h2>🔄 Historique des mouvements</h2>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Médicament</th>
                <th>Type</th>
                <th>Quantité</th>
              </tr>
            </thead>

            <tbody>

              {movements.length === 0 && (
                <tr>
                  <td
                    colSpan="4"
                    style={{ textAlign: 'center' }}
                  >
                    Aucun mouvement enregistré.
                  </td>
                </tr>
              )}

              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{formatMadagascarDate(m.created_at)}</td>

                  <td>{m.medication_name}</td>

                  <td>
                    {m.movement_type === 'entry'
                      ? 'Entrée'
                      : 'Sortie'}
                  </td>

                  <td>{m.quantity}</td>
                </tr>
              ))}

            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}