import { useEffect, useState } from 'react';

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
      .then((r) => setMedications(r || []))
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
      notify(`Dispensation enregistrée. Total : ${total.toLocaleString()} Ar`);
      setSelectedMedicationId('');
      setQuantity('');
      load();
    } catch (err) {
      notify(err.message || 'Erreur lors de l\'enregistrement.', 'err');
    }
  };

  const deleteDispensation = async (id, medicationId, qty) => {
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
          📤 Dispensation
        </div>
      </div>

      {msg.text && (
        <div className={msg.type === 'err' ? 'error-msg' : 'success-msg'} style={{ marginBottom: '14px' }}>
          {msg.type === 'err' ? '⚠ ' : '✓ '}{msg.text}
        </div>
      )}

      <form className="record-form" onSubmit={submit}>
        <select
          value={selectedMedicationId}
          onChange={(e) => { setSelectedMedicationId(e.target.value); setQuantity(''); }}
          className="select"
          required
        >
          <option value="">-- Sélectionner un médicament --</option>
          {medications.map((med) => (
            <option key={med.id} value={med.id}>
              {med.name} ({med.unit || 'comprimé'}) - Stock: {med.stock ?? 'Non suivi'}
            </option>
          ))}
        </select>

        <input
          type="number"
          min="1"
          placeholder={`Quantité (${unit})`}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />

        <div className="dashboard-badge" style={{ justifySelf: 'start' }}>
          Total : {totalPrice.toLocaleString()} Ar
        </div>

        <div className="actions-row">
          <button type="submit">Enregistrer</button>
        </div>
      </form>

      <div className="table-wrap" style={{ marginTop: '30px' }}>
        <h2>Historique des dispensations</h2>
        <div className="search-bar" style={{ margin: '12px 0' }}>
          <input
            type="search"
            placeholder="Rechercher une dispensation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Médicament</th>
              <th>Unité</th>
              <th>Quantité</th>
              <th>Total (Ar)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDispensations.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#5f7b84' }}>
                  Aucune dispensation enregistrée.
                </td>
              </tr>
            )}
            {filteredDispensations.map((d) => {
              const editing = editingDisp === Number(d.id);
              const itemTotal = (Number(d.unit_price || 0) * Number(d.quantity)).toLocaleString();
              return (
                <tr key={d.id}>
                  <td>{formatMadagascarDateTime(d.created_at)}</td>
                  {editing ? (
                    <>
                      <td>
                        <select
                          style={{ width: '100%', padding: '7px', border: '1px solid #c8d9df', borderRadius: '8px', font: 'inherit' }}
                          value={editDispForm.medication_id}
                          onChange={(e) => setEditDispForm({ ...editDispForm, medication_id: e.target.value })}
                        >
                          <option value="">--</option>
                          {medications.map((m) => (
                            <option key={m.id} value={String(m.id)}>{m.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>{medications.find((m) => Number(m.id) === Number(editDispForm.medication_id))?.unit || 'comprimé'}</td>
                      <td>
                        <input type="number" min="1" value={editDispForm.quantity}
                          onChange={(e) => setEditDispForm({ ...editDispForm, quantity: e.target.value })}
                          style={{ width: '80px', padding: '7px', border: '1px solid #c8d9df', borderRadius: '8px', font: 'inherit' }} />
                      </td>
                      <td>-</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button type="button" style={{ background: '#1c96a4' }} onClick={saveEditDisp}>✓</button>
                          <button type="button" className="btn-light" onClick={() => setEditingDisp(null)}>✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><strong>{d.medication_name}</strong></td>
                      <td>{d.unit || 'comprimé'}</td>
                      <td>{d.quantity}</td>
                      <td>{itemTotal} Ar</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="icon-btn" onClick={() => startEditDisp(d)} title="Modifier">✏️</button>
                          <button className="icon-btn danger" onClick={() => deleteDispensation(d.id)} title="Supprimer">🗑️</button>
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
    </section>
  );
}