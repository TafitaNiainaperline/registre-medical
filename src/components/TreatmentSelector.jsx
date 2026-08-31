import { useMemo, useState } from 'react';

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export default function TreatmentSelector({ medications, value, onChange }) {
  const meds = useMemo(() => (Array.isArray(medications) ? medications : []), [medications]);
  const treatments = Array.isArray(value) ? value : [];

  const [selectedId, setSelectedId] = useState('');
  const [searchName, setSearchName] = useState('');
  const [qty, setQty] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const byId = useMemo(() => {
    const m = new Map();
    meds.forEach((x) => m.set(String(x.id), x));
    return m;
  }, [meds]);
  const selectedItem = byId.get(String(selectedId));

  const filteredMeds = useMemo(() => {
    if (!searchName.trim()) return meds;
    const q = normalizeName(searchName);
    return meds.filter((m) => normalizeName(m.name).includes(q));
  }, [meds, searchName]);

  const add = () => {
    const med = byId.get(String(selectedId));
    if (!med) return;

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
    setSearchName('');
    setQty(1);
    setIsDropdownOpen(false);
  };

  const updateQty = (medicationId, nextQty) => {
    const q = Math.max(1, toNumber(nextQty, 1));
    
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
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            className="treatment-search"
            value={searchName}
            placeholder="Rechercher un médicament ou un acte..."
            onChange={(e) => {
              setSearchName(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            onBlur={() => {
              setTimeout(() => setIsDropdownOpen(false), 150);
            }}
            autoComplete="off"
          />
          {isDropdownOpen && filteredMeds.length > 0 && (
            <div className="treatment-dropdown">
              {filteredMeds.map((m) => (
                <div
                  key={m.id}
                  className={`treatment-option ${m.item_type === 'act' ? 'treatment-option-act' : 'treatment-option-med'}`}
                  onMouseDown={() => {
                    setSelectedId(String(m.id));
                    setSearchName(m.name);
                    setIsDropdownOpen(false);
                    setQty(1);
                  }}
                >
                  <span className="treatment-option-name">{m.name}</span>
                  <span className="treatment-option-meta">
                    {m.item_type === 'act' ? 'Acte' : `${m.unit || 'unité'}`}
                    {m.item_type !== 'act' && m.stock !== null && m.stock !== undefined && (
                      <span className="treatment-option-stock">Stock: {m.stock}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

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
          + Ajouter
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
                <div className="treatment-name" style={{ fontSize: '0.85rem' }}>
                  <strong>{t.name}</strong>
                  <span style={{ color: '#5f7b84', marginLeft: 8, fontSize: '0.8rem' }}>
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
