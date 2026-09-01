import { useEffect, useState } from 'react';
import { Pill, Search, Trash2, Edit, Check, X, AlertTriangle, Plus, Calendar, Clock, User, FileText } from 'lucide-react';

function formatMadagascarDateTime(utcString) {
  if (!utcString) return '-';
  const d = new Date(utcString);
  const offset = 3 * 60;
  const local = new Date(d.getTime() + offset * 60 * 1000);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  const h = String(local.getHours()).padStart(2, '0');
  const min = String(local.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export default function DispensationPage() {
  const [medications, setMedications] = useState([]);
  const [dispensations, setDispensations] = useState([]);
  const [selectedMedicationId, setSelectedMedicationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState({ type: 'ok', text: '' });
  const [editingDisp, setEditingDisp] = useState(null);
  const [editDispForm, setEditDispForm] = useState({ medication_id: '', quantity: '' });

  const load = () => {
    window.api.listMedications()
      .then((r) => setMedications((r || []).filter((item) => item.item_type !== 'act')))
      .catch(() => setMedications([]));

    window.api.getDispensations()
      .then((r) => setDispensations(r || []))
      .catch(() => setDispensations([]));
  };

  useEffect(() => {
    load();
  }, []);

  const notify = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'ok' }), 2500);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const medId = Number(selectedMedicationId);
      const qty = Number(quantity);

      if (!medId) { notify('Veuillez sélectionner un médicament.', 'err'); return; }
      if (!Number.isFinite(qty) || qty <= 0) { notify('Veuillez saisir une quantité valide.', 'err'); return; }

      const med = medications.find((m) => Number(m.id) === medId);
      if (!med) { notify('Médicament introuvable.', 'err'); return; }

      if (med.stock !== null && med.stock !== undefined && qty > Number(med.stock)) {
        notify(`Stock insuffisant. Disponible : ${med.stock}`, 'err');
        return;
      }

      await window.api.createDispensation({
        medication_id: medId,
        quantity: qty,
      });

      const total = Number(med.price) * qty;
      const remainingStock = med.stock === null || med.stock === undefined
        ? null
        : Number(med.stock) - qty;
      notify(remainingStock !== null && remainingStock <= Number(med.stock_threshold ?? 100)
        ? `Dispensation enregistrée. Total : ${total.toLocaleString()} Ar. Attention : stock atteint le seuil de ${med.stock_threshold ?? 100}.`
        : `Dispensation enregistrée. Total : ${total.toLocaleString()} Ar`);
      setSelectedMedicationId('');
      setQuantity('');
      load();
    } catch (err) {
      notify(err.message || 'Erreur lors de l\'enregistrement.', 'err');
    }
  };

  const deleteDispensation = async (id) => {
    if (!window.confirm('Supprimer cette dispensation ? Le stock sera recrédité.')) return;
    try {
      await window.api.deleteDispensation(id);
      notify('Dispensation supprimée, stock recrédité.');
      load();
    } catch (err) {
      notify(err.message || 'Erreur lors de la suppression.', 'err');
    }
  };

  const startEditDisp = (d) => {
    setEditingDisp(Number(d.id));
    setEditDispForm({ medication_id: String(d.medication_id), quantity: String(d.quantity) });
  };

  const saveEditDisp = async () => {
    try {
      await window.api.updateDispensation({
        id: editingDisp,
        medication_id: Number(editDispForm.medication_id),
        quantity: Number(editDispForm.quantity),
      });
      notify('Dispensation modifiée.');
      setEditingDisp(null);
      setEditDispForm({ medication_id: '', quantity: '' });
      load();
    } catch (err) {
      notify(err.message || 'Erreur lors de la modification.', 'err');
    }
  };

  const selectedMedication = medications.find((m) => Number(m.id) === Number(selectedMedicationId));
  const unit = selectedMedication?.unit || 'comprimé';
  const totalPrice = selectedMedication ? Number(selectedMedication.price) * Number(quantity || 0) : 0;
  const filteredDispensations = dispensations.filter((dispensation) => {
    const query = normalizeSearch(search);
    return !query || [dispensation.medication_name, dispensation.unit, dispensation.quantity]
      .some((value) => normalizeSearch(value).includes(query));
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Dispensation de médicaments</h1>
          <p>Sélectionnez un médicament et indiquez la quantité dispensée.</p>
        </div>
        <div className="dashboard-badge" style={{ background: '#4a90d9' }}>
          <Pill size={16} style={{ marginRight: '6px' }} /> Dispensation
        </div>
      </div>

      {msg.text && (
        <div className={msg.type === 'err' ? 'error-msg' : 'success-msg'} style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '8px' }}>
          {msg.type === 'err' ? <AlertTriangle size={16} /> : null}
          {msg.text}
        </div>
      )}

      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Nouvelle dispensation
        </h3>
        <form className="record-form" onSubmit={submit} style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500, color: '#555' }}>Médicament</label>
            <select
              value={selectedMedicationId}
              onChange={(e) => { setSelectedMedicationId(e.target.value); setQuantity(''); }}
              className="select"
              required
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #c8d9df', borderRadius: '8px', fontSize: '0.95rem' }}
            >
              <option value="">-- Sélectionner un médicament --</option>
              {medications.map((med) => (
                <option key={med.id} value={med.id}>
                  {med.name} ({med.unit || 'comprimé'}) - Stock: {med.stock ?? 'Non suivi'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500, color: '#555' }}>Quantité ({unit})</label>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                style={{ width: '100%', padding: '12px 16px', border: '1px solid #c8d9df', borderRadius: '8px', fontSize: '0.95rem' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ padding: '12px 16px', background: '#e8f5e9', borderRadius: '8px', width: '100%', textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>Total</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#28a745' }}>{totalPrice.toLocaleString()} Ar</div>
              </div>
            </div>
          </div>

          <div className="actions-row">
            <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} /> Enregistrer
            </button>
          </div>
        </form>
      </div>

      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <h3 style={{ marginBottom: '16px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} /> Historique des dispensations
        </h3>
        <div style={{ marginBottom: '16px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
          <input
            type="search"
            placeholder="Rechercher une dispensation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid #c8d9df', borderRadius: '8px', fontSize: '0.9rem' }}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#4a90d9' }}>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>Date</th>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>Médicament</th>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Unité</th>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Qté</th>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'right' }}>Total</th>
                <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDispensations.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                    Aucune dispensation enregistrée.
                  </td>
                </tr>
              )}
              {filteredDispensations.map((d, index) => {
                const editing = editingDisp === Number(d.id);
                const itemTotal = (Number(d.unit_price || 0) * Number(d.quantity)).toLocaleString();
                return (
                  <tr key={d.id} style={{ background: index % 2 === 0 ? '#fff' : '#f8fafa', borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{formatMadagascarDateTime(d.created_at)}</td>
                    {editing ? (
                      <>
                        <td style={{ padding: '12px' }}>
                          <select
                            style={{ width: '100%', padding: '8px', border: '1px solid #c8d9df', borderRadius: '6px', font: 'inherit' }}
                            value={editDispForm.medication_id}
                            onChange={(e) => setEditDispForm({ ...editDispForm, medication_id: e.target.value })}
                          >
                            <option value="">--</option>
                            {medications.map((m) => (
                              <option key={m.id} value={String(m.id)}>{m.name}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{medications.find((m) => Number(m.id) === Number(editDispForm.medication_id))?.unit || 'comprimé'}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <input type="number" min="1" value={editDispForm.quantity}
                            onChange={(e) => setEditDispForm({ ...editDispForm, quantity: e.target.value })}
                            style={{ width: '70px', padding: '8px', border: '1px solid #c8d9df', borderRadius: '6px', font: 'inherit' }} />
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>-</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button style={{ padding: '6px', background: '#28a745', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff' }} onClick={saveEditDisp} title="Enregistrer">
                              <Check size={14} />
                            </button>
                            <button style={{ padding: '6px', background: '#6c757d', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff' }} onClick={() => setEditingDisp(null)} title="Annuler">
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '12px' }}><strong>{d.medication_name}</strong></td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{d.unit || 'comprimé'}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{d.quantity}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#28a745' }}>{itemTotal} Ar</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button style={{ padding: '6px', background: '#007bff', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff' }} onClick={() => startEditDisp(d)} title="Modifier">
                              <Edit size={14} />
                            </button>
                            <button style={{ padding: '6px', background: '#dc3545', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff' }} onClick={() => deleteDispensation(d.id)} title="Supprimer">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
