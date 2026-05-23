import { useMemo, useState } from 'react';

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function TreatmentSelector({ medications, value, onChange }) {
  const meds = Array.isArray(medications) ? medications : [];
  const treatments = Array.isArray(value) ? value : [];

  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState(1);

  const byId = useMemo(() => {
    const m = new Map();
    meds.forEach((x) => m.set(String(x.id), x));
    return m;
  }, [meds]);

  const add = () => {
    const med = byId.get(String(selectedId));
    if (!med) return;

    const exists = treatments.find((t) => String(t.medication_id) === String(med.id));
    const next = exists
      ? treatments.map((t) =>
          String(t.medication_id) === String(med.id)
            ? { ...t, quantity: toNumber(t.quantity, 0) + toNumber(qty, 1) }
            : t
        )
      : [
          ...treatments,
          {
            medication_id: med.id,
            name: med.name,
            unit_price: toNumber(med.price, 0),
            quantity: Math.max(1, toNumber(qty, 1)),
          }
        ];

    onChange?.(next);
    setSelectedId('');
    setQty(1);
  };

  const updateQty = (medicationId, nextQty) => {
    const q = Math.max(1, toNumber(nextQty, 1));
    onChange?.(treatments.map((t) => (
      String(t.medication_id) === String(medicationId) ? { ...t, quantity: q } : t
    )));
  };

  const remove = (medicationId) => {
    onChange?.(treatments.filter((t) => String(t.medication_id) !== String(medicationId)));
  };

  const total = treatments.reduce((sum, t) => sum + (toNumber(t.unit_price) * toNumber(t.quantity)), 0);

  return (
    <div className="treatments">
      <div className="treatments-top">
        <select className="select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">Sélectionner un médicament...</option>
          {meds.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.name} — {m.price} Ar
            </option>
          ))}
        </select>

        <input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="qty-input"
          placeholder="Qté"
        />

        <button type="button" className="btn-light" onClick={add} disabled={!selectedId}>
          + Ajouter médicament
        </button>

        <div className="treatments-total">
          Total: <strong>{total} Ar</strong>
        </div>
      </div>

      {treatments.length > 0 && (
        <div className="treatments-list">
          {treatments.map((t) => (
            <div className="treatment-row" key={String(t.medication_id)}>
              <div className="treatment-name">
                <strong>{t.name}</strong>
                <span style={{ color: '#5f7b84', marginLeft: 8 }}>
                  {toNumber(t.unit_price)} Ar / unité
                </span>
              </div>

              <div className="treatment-controls">
                <input
                  className="qty-input"
                  type="number"
                  min="1"
                  value={t.quantity}
                  onChange={(e) => updateQty(t.medication_id, e.target.value)}
                />
                <span style={{ minWidth: 92, textAlign: 'right' }}>
                  <strong>{toNumber(t.unit_price) * toNumber(t.quantity)} Ar</strong>
                </span>
                <button type="button" className="btn-danger" onClick={() => remove(t.medication_id)}>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
