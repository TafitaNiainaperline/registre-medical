import { useEffect, useState } from 'react';
import { Pill, AlertTriangle, Download, FileSpreadsheet, FileText, Plus, Edit, Trash2, TrendingUp, Package, Search, X, Stethoscope } from 'lucide-react';

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
  const [stockDate, setStockDate] = useState(getToday());
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyMedication, setHistoryMedication] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [topSelling, setTopSelling] = useState([]);
  const [records, setRecords] = useState([]);
  const [actFilter, setActFilter] = useState('');
  

  const load = () =>
    window.api.listMedications()
      .then((r) => setRows(r || []))
      .catch(() => setRows([]));

  const loadRecords = () =>
    window.api.fetchRecordsByArchive?.({})
      .then((r) => setRecords(r || []))
      .catch(() => setRecords([]));

   useEffect(() => {
     load();
     loadRecords();
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
    if (e.target.name === 'stock' && !isAdmin) {
      notify('Le stock est réservé à l’administrateur.', 'err');
      return;
    }
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
        stock: isAdmin && form.stock !== '' ? Number(form.stock) : null,
        stock_threshold: form.stock_threshold === '' ? 100 : Number(form.stock_threshold),
        unit: form.unit || 'comprimé',
        date: form.date,
        created_by: currentUser.id || null,
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
        created_by: currentUser.id || null,
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
    setStockDate(getToday());
    setShowStockModal(true);
  };

  const openStockHistory = async (row) => {
    setHistoryMedication(row);
    const history = await window.api.getMedicationStockHistory(row.id);
    setStockHistory(history);
    setShowHistoryModal(true);
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
        quantity,
        currentUser.id || null,
        stockDate
      );

      const newStock = (Number(selectedMedication.stock) || 0) + quantity;
      notify(newStock <= Number(selectedMedication.stock_threshold ?? 100)
        ? `Stock ajouté : +${quantity} le ${stockDate.split('-').reverse().join('/')}. Attention : stock atteint le seuil de ${selectedMedication.stock_threshold ?? 100}.`
        : `Stock ajouté : +${quantity} le ${stockDate.split('-').reverse().join('/')}.`);

      setShowStockModal(false);
      setSelectedMedication(null);
      setStockQuantity('');
      setStockDate(getToday());

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

  const actSummary = Object.entries(records.reduce((acc, row) => {
    const treatments = Array.isArray(row.treatments) ? row.treatments : [];
    treatments.forEach((t) => {
      if (t.item_type === 'act') {
        const name = String(t.name || '').trim();
        if (!name) return;
        if (!acc[name]) acc[name] = { count: 0, total: 0 };
        acc[name].count += 1;
        acc[name].total += (Number(t.unit_price) || 0) * (Number(t.quantity) || 1);
      }
    });
    return acc;
  }, {}))
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);

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
              <h3>Ajouter au stock – {selectedMedication?.name}</h3>

              <button
                className="modal-close"
                onClick={() => { setShowStockModal(false); setStockDate(getToday()); }}
              >
                ✕
              </button>
            </div>

            <div className="stock-modal-info">
              <p>Stock actuel : <strong>{selectedMedication?.stock ?? 0}</strong></p>
            </div>

            <label className="medication-date-field">
              <span>Quantité à ajouter</span>
              <input
                type="number"
                min="1"
                placeholder="Ex: 100"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
              />
            </label>

            <label className="medication-date-field">
              <span>Date d'ajout</span>
              <input
                type="date"
                value={stockDate}
                onChange={(e) => setStockDate(e.target.value)}
              />
            </label>

            <div className="stock-modal-user">
              <span>Ajouté par : <strong>{currentUser.name || currentUser.username || 'Utilisateur'}</strong></span>
            </div>

            <div className="stock-modal-actions">

              <button
                className="btn-light"
                onClick={() => { setShowStockModal(false); setStockDate(getToday()); }}
              >
                Annuler
              </button>

              <button onClick={confirmAddStock}>
                Ajouter au stock
              </button>

            </div>

          </div>

        </div>
      )}
      {showHistoryModal && (
        <div className="modal-overlay">
          <div className="stock-modal" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

            <div className="stock-modal-header">
              <h3>Historique du stock – {historyMedication?.name}</h3>
              <button
                className="modal-close"
                onClick={() => setShowHistoryModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafa', borderBottom: '1px solid #e6eff2', display: 'flex', gap: '32px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>Stock actuel:</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1C96A4' }}>{historyMedication?.stock ?? 0}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28a745' }}></span>
                <span style={{ fontSize: '0.8rem', color: '#555' }}>Entrées: <strong>{stockHistory.filter(h => h.movement_type === 'entry').reduce((s, h) => s + h.quantity, 0)}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc3545' }}></span>
                <span style={{ fontSize: '0.8rem', color: '#555' }}>Sorties: <strong>{stockHistory.filter(h => h.movement_type === 'exit').reduce((s, h) => s + h.quantity, 0)}</strong></span>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: '0 6px', fontSize: '0.8rem', tableLayout: 'auto' }}>
                <tbody>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555', fontWeight: 600, background: '#e8f4f6', borderRight: '1px solid #e6eff2', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, borderRadius: '6px 0 0 6px' }}>Date</th>
                    {stockHistory.map((h, index) => (
                      <td key={h.id || 'initial'} style={{ padding: '12px 16px', textAlign: 'center', color: '#555', whiteSpace: 'nowrap', borderRight: '1px solid #f0f0f0', background: '#e8f4f6', borderRadius: index === stockHistory.length - 1 ? '0 6px 6px 0' : '0' }}>
                        {formatMadagascarDate(h.created_at)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#555', fontWeight: 600, background: '#f8fafa', borderRight: '1px solid #e6eff2', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, borderRadius: '6px 0 0 6px' }}>Type</th>
                    {stockHistory.map((h, index) => (
                      <td key={h.id || 'initial'} style={{ padding: '12px 16px', textAlign: 'center', borderRight: '1px solid #f0f0f0', background: '#f8fafa', borderRadius: index === stockHistory.length - 1 ? '0 6px 6px 0' : '0' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: h.initial ? '#1a73e8' : (h.movement_type === 'entry' ? '#28a745' : '#dc3545'),
                          color: '#fff',
                        }}>
                          {h.initial ? 'Init' : (h.movement_type === 'entry' ? 'Entrée' : 'Sortie')}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#28a745', fontWeight: 600, background: '#e8f5e9', borderRight: '1px solid #e6eff2', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, borderRadius: '6px 0 0 6px' }}>Entrée</th>
                    {stockHistory.map((h, index) => (
                      <td key={h.id || 'initial'} style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#28a745', borderRight: '1px solid #f0f0f0', background: '#e8f5e9', borderRadius: index === stockHistory.length - 1 ? '0 6px 6px 0' : '0' }}>
                        {h.movement_type === 'entry' ? `+${h.quantity}` : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#dc3545', fontWeight: 600, background: '#fdecea', borderRight: '1px solid #e6eff2', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, borderRadius: '6px 0 0 6px' }}>Sortie</th>
                    {stockHistory.map((h, index) => (
                      <td key={h.id || 'initial'} style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#dc3545', borderRight: '1px solid #f0f0f0', background: '#fdecea', borderRadius: index === stockHistory.length - 1 ? '0 6px 6px 0' : '0' }}>
                        {h.movement_type === 'exit' ? `-${h.quantity}` : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#1C96A4', fontWeight: 600, background: '#e8f0fe', borderRight: '1px solid #e6eff2', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, borderRadius: '6px 0 0 6px' }}>Stock</th>
                    {stockHistory.map((h, index) => (
                      <td key={h.id || 'initial'} style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#1C96A4', borderRight: '1px solid #f0f0f0', background: '#e8f0fe', borderRadius: index === stockHistory.length - 1 ? '0 6px 6px 0' : '0' }}>
                        {h.stock_after}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="stock-modal-actions">
              <button
                className="btn-light"
                onClick={() => setShowHistoryModal(false)}
              >
                Fermer
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
          <div className="dashboard-badge">
            <Pill size={16} style={{ marginRight: '6px' }} /> Médicaments
          </div>
        </div>

        {msg.text && (
          <div className={msg.type === 'err' ? 'error-msg' : 'success-msg'} style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {msg.type === 'err' ? <AlertTriangle size={16} /> : null}
            {msg.text}
          </div>
        )}

        {rows.filter((r) => r.stock !== null && r.stock !== undefined && Number(r.stock) <= Number(r.stock_threshold ?? 100)).length > 0 && (
          <div style={{ marginBottom: '18px', padding: '14px 18px', borderRadius: '10px', background: '#fff4e5', border: '1px solid #f5d1a3', color: '#7f4a00', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} />
            <strong>{rows.filter((r) => r.stock !== null && r.stock !== undefined && Number(r.stock) <= Number(r.stock_threshold ?? 100)).length}</strong>
            médicament(s) ont atteint leur seuil d'alerte.
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

          <input
            name="stock"
            type="number"
            min="0"
            placeholder="Stock (réservé à l’administrateur)"
            value={form.stock}
            onChange={onChange}
            onClick={() => { if (!isAdmin) notify('Le stock est réservé à l’administrateur.', 'err'); }}
            readOnly={!isAdmin}
            aria-readonly={!isAdmin}
          />

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
          <input name="date" type="date" value={actForm.date} onChange={onActChange} required aria-label="Date de l’acte" />
          <div className="actions-row">
            <button type="submit">Ajouter l’acte</button>
          </div>
        </form>

        <div style={{ marginTop: '28px', padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ marginBottom: '12px', color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Stethoscope size={20} color="#8f60d0" /> Actes médicaux
          </h3>
          <input
            type="text"
            placeholder="Filtrer les actes..."
            value={actFilter}
            onChange={(e) => setActFilter(e.target.value)}
            style={{
              width: '100%',
              marginBottom: '10px',
              padding: '10px 14px',
              border: '1px solid #c8d9df',
              borderRadius: '8px',
              font: 'inherit',
              fontSize: '0.85rem'
            }}
          />
          <div style={{ display: 'grid', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
            {(() => {
              if (!actFilter) return null;
              const filtered = actSummary
                .filter((act) => String(act.name).toLowerCase().includes(actFilter.toLowerCase()));
              if (filtered.length === 0) {
                return <span style={{ fontSize: '0.85rem', color: '#888' }}>Aucun résultat</span>;
              }
              return filtered.map((act) => (
                <span key={act.name} style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f8fafa', borderRadius: '8px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.name}</span>
                  <strong style={{ whiteSpace: 'nowrap', background: '#8f60d0', color: '#fff', padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem' }}>{act.count} fois - {act.total.toLocaleString()}Ar</strong>
                </span>
              ));
            })()}
          </div>
        </div>

        {/* Barre de recherche et export */}
        <div style={{ margin: '20px 0', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
            <input
              type="text"
              placeholder="Rechercher un médicament..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid #c8d9df', borderRadius: '8px', fontSize: '0.9rem' }}
            />
          </div>

          <button
            onClick={() => window.api.exportStockExcel()}
            style={{
              padding: '10px 16px',
              background: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileSpreadsheet size={16} /> Excel
          </button>

          <button
            onClick={() => window.api.exportStockPdf()}
            style={{
              padding: '10px 16px',
              background: '#dc3545',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileText size={16} /> PDF
          </button>
        </div>

        {/* Tableau des médicaments */}
        <div className="table-wrap" style={{ borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#1C96A4' }}>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>Nom</th>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Type</th>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'right' }}>Prix (Ar)</th>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Unité</th>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Stock</th>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Seuil</th>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Date</th>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#888', background: '#f8fafa' }}>
                    Aucun médicament trouvé.
                  </td>
                </tr>
              )}
              {filtered.map((r, index) => {
                const isLowStock = r.stock !== null && r.stock !== undefined && Number(r.stock) <= Number(r.stock_threshold ?? 100);
                return (
                  <tr
                    key={r.id}
                    style={isLowStock ? { background: '#fff7ea' } : { background: index % 2 === 0 ? '#fff' : '#f8fafa' }}
                  >
                    <td style={{ padding: '12px' }}><strong>{r.name}</strong></td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: r.item_type === 'act' ? '#8f60d0' : '#1C96A4',
                        color: '#fff',
                      }}>
                        {r.item_type === 'act' ? 'Acte' : 'Médicament'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>{Number(r.price).toLocaleString()}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {r.item_type === 'act' ? '-' : <span style={{ padding: '2px 8px', background: '#e8f4f6', borderRadius: '4px', fontSize: '0.8rem' }}>{r.unit || 'comprimé'}</span>}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {r.item_type === 'act' ? '-'
                        : r.stock !== null && r.stock !== undefined
                        ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <button
                              onClick={() => openStockHistory(r)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                color: '#1C96A4',
                                fontSize: '1rem',
                              }}
                              title="Voir l'historique du stock"
                            >
                              {r.stock}
                            </button>
                            {isLowStock && (
                              <span style={{
                                padding: '3px 8px',
                                background: '#ffe4c2',
                                color: '#8f4c00',
                                borderRadius: '999px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                              }}>
                                Stock faible
                              </span>
                            )}
                          </div>
                        )
                        : <span style={{ color: '#888' }}>Non suivi</span>}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{r.item_type === 'act' ? '-' : (r.stock_threshold ?? 100)}</td>
                    <td style={{ padding: '12px', fontSize: '0.85rem', color: '#5f7b84', textAlign: 'center' }}>
                      {formatMadagascarDate(r.created_at)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        {r.item_type !== 'act' && (
                          <button style={{ padding: '6px', background: '#28a745', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff' }} onClick={() => addStock(r)} title="Ajouter du stock">
                            <Plus size={14} />
                          </button>
                        )}
                        {isAdmin && (
                          <button style={{ padding: '6px', background: '#007bff', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff' }} onClick={() => edit(r)} title="Modifier">
                            <Edit size={14} />
                          </button>
                        )}
                        <button style={{ padding: '6px', background: '#dc3545', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff' }} onClick={() => remove(r.id)} title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Médicaments les plus vendus */}
        <div style={{ marginTop: '30px', padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ marginBottom: '16px', color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={20} color="#f59f00" /> Médicaments les plus vendus
          </h3>
          <div style={{ display: 'grid', gap: '8px' }}>
            {topSelling.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                Aucune vente enregistrée.
              </div>
            )}
            {topSelling.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: i % 2 === 0 ? '#f8fafa' : '#fff', borderRadius: '8px' }}>
                <span style={{ fontWeight: 500 }}>{m.medication_name}</span>
                <span style={{ padding: '4px 12px', background: '#f59f00', color: '#fff', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600 }}>{m.total_sold}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
     </>
   );
 }