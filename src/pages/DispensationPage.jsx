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

export default function DispensationPage() {
  const [medications, setMedications] = useState([]);
  const [dispensations, setDispensations] = useState([]);
  const [selectedMedicationId, setSelectedMedicationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [msg, setMsg] = useState({ type: 'ok', text: '' });

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

  const selectedMedication = medications.find((m) => Number(m.id) === Number(selectedMedicationId));
  const unit = selectedMedication?.unit || 'comprimé';
  const totalPrice = selectedMedication ? Number(selectedMedication.price) * Number(quantity || 0) : 0;

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
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Médicament</th>
              <th>Quantité</th>
              <th>Unité</th>
              <th>Prix (Ar)</th>
              <th>Total (Ar)</th>
            </tr>
          </thead>
          <tbody>
            {dispensations.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#5f7b84' }}>
                  Aucune dispensation enregistrée.
                </td>
              </tr>
            )}
            {dispensations.map((d) => {
              const itemTotal = Number(d.unit_price || 0) * Number(d.quantity);
              return (
                <tr key={d.id}>
                  <td>{formatMadagascarDateTime(d.created_at)}</td>
                  <td><strong>{d.medication_name}</strong></td>
                  <td>{d.quantity}</td>
                  <td>{d.unit || 'comprimé'}</td>
                  <td>{Number(d.unit_price || 0).toLocaleString()} Ar</td>
                  <td>{itemTotal.toLocaleString()} Ar</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}