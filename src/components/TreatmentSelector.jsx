import { useMemo, useState } from 'react';

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function TreatmentSelector({ medications, value, onChange }) {
  const meds = useMemo(() => (Array.isArray(medications) ? medications : []), [medications]);
  const treatments = Array.isArray(value) ? value : [];

  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState(1);

  const byId = useMemo(() => {
    const m = new Map();
    meds.forEach((x) => m.set(String(x.id), x));
    return m;
  }, [meds]);
  const selectedItem = byId.get(String(selectedId));

  const add = () => {
    const med = byId.get(String(selectedId));
    if (!med) return;

    // === VÉRIFICATION DU STOCK ===
    if (med.item_type !== 'act' && med.stock !== null && med.stock !== undefined) {
      const currentQty = treatments
        .filter(t => String(t.medication_id) === String(med.id))
        .reduce((sum, t) => sum + toNumber(t.quantity), 0);

      const totalRequested = currentQty + toNumber(qty, 1);

      if (totalRequested > Number(med.stock)) {
        alert(`Stock insuffisant pour "${med.name}" !\nDisponible : ${med.stock} ${med.unit || 'unité(s)'}\nDemandé : ${totalRequested}`);
        return;
      }
    }

    const exists = treatments.find((t) => String(t.medication_id) === String(med.id));

    const next = exists
      ? treatments.map((t) =>
          String(t.medication_id) === String(med.id)
            ? { 
                ...t, 
                quantity: toNumber(t.quantity, 0) + toNumber(qty, 1),
                unit: med.item_type === 'act' ? null : (med.unit || t.unit || 'comprimé')
              }
            : t
        )
      : [
          ...treatments,
          {
            medication_id: med.id,
            item_type: med.item_type || 'medication',
            name: med.name,
            unit: med.item_type === 'act' ? null : (med.unit || 'comprimé'),
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
    
    // Vérification stock lors de la modification
    const med = byId.get(String(medicationId));
    if (med && med.item_type !== 'act' && med.stock !== null && med.stock !== undefined) {
      const newTotal = treatments.reduce((sum, t) => {
        return String(t.medication_id) === String(medicationId) 
          ? sum + q 
          : sum + toNumber(t.quantity);
      }, 0);

      if (newTotal > Number(med.stock)) {
        alert(`Stock insuffisant pour "${med.name}" ! Disponible : ${med.stock}`);
        return;
      }
    }

    onChange?.(treatments.map((t) => (
      String(t.medication_id) === String(medicationId) 
        ? { ...t, quantity: q } 
        : t
    )));
  };

  const remove = (medicationId) => {
    onChange?.(treatments.filter((t) => String(t.medication_id) !== String(medicationId)));
  };

  const total = treatments.reduce((sum, t) => sum + (toNumber(t.unit_price) * toNumber(t.quantity)), 0);

  return (
    <div className="treatments">
      <div className="treatments-top">
        <select 
          className="select" 
          value={selectedId} 
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Sélectionner un médicament ou un acte...</option>
          {meds.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.item_type === 'act' ? 'Acte : ' : ''}{m.name} — {m.price} Ar{m.item_type !== 'act' && ` / ${m.unit || 'comprimé'}`}
              {m.stock !== null && m.stock !== undefined && ` (Stock: ${m.stock})`}
            </option>
          ))}
        </select>

        {selectedItem?.item_type !== 'act' && (
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="qty-input"
            placeholder="Qté"
          />
        )}

        <button 
          type="button" 
          className="btn-light" 
          onClick={add} 
          disabled={!selectedId}
        >
          + Ajouter élément
        </button>

        <div className="treatments-total">
          Total: <strong>{total} Ar</strong>
        </div>
      </div>

      {treatments.length > 0 && (
        <div className="treatments-list">
          {treatments.map((t) => {
            const med = byId.get(String(t.medication_id));
            return (
              <div className="treatment-row" key={String(t.medication_id)}>
                <div className="treatment-name">
                  <strong>{t.name}</strong>
                  <span style={{ color: '#5f7b84', marginLeft: 8 }}>
                    {toNumber(t.unit_price)} Ar{(t.item_type !== 'act' && med?.item_type !== 'act') ? ` / ${t.unit || med?.unit || 'unité'}` : ''}
                  </span>
                </div>

                <div className="treatment-controls">
                  {t.item_type !== 'act' && (
                    <input
                      className="qty-input"
                      type="number"
                      min="1"
                      value={t.quantity}
                      onChange={(e) => updateQty(t.medication_id, e.target.value)}
                    />
                  )}
                  <span style={{ minWidth: 92, textAlign: 'right' }}>
                    <strong>{toNumber(t.unit_price) * toNumber(t.quantity)} Ar</strong>
                  </span>
                  <button 
                    type="button" 
                    className="btn-danger" 
                    onClick={() => remove(t.medication_id)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
