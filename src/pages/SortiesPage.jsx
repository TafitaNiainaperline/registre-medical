import { useEffect, useState } from 'react';

export default function SortiesPage() {
  const [outflows, setOutflows] = useState([]);
  const [outflowDate, setOutflowDate] = useState(new Date().toISOString().split('T')[0]);
  const [outflowDesignation, setOutflowDesignation] = useState('');
  const [outflowAmount, setOutflowAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [archiveLabel, setArchiveLabel] = useState('');
  const [totalOutflows, setTotalOutflows] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const [solde, setSolde] = useState(0);
  const [editingOutflow, setEditingOutflow] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editAmount, setEditAmount] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const current = await window.api.getCurrentArchive?.();
      if (current?.label) setArchiveLabel(current.label);

      const outflowsList = await window.api.listCashOutflows?.({ year: current?.year, month: current?.month }) || [];
      setOutflows(outflowsList);

      const outflowTotal = await window.api.getCashOutflowTotal?.({ year: current?.year, month: current?.month });
      setTotalOutflows(Number(outflowTotal || 0));

      const recordsForMonth = await window.api.fetchRecordsByArchive?.({ year: current?.year, month: current?.month }) || [];
      const dispTotal = await window.api.getDispensationTotal?.({ year: current?.year, month: current?.month });
      const entries = recordsForMonth.reduce((sum, row) => sum + (Number(row.cost) || 0), 0) + (Number(dispTotal) || 0);
      setTotalEntries(entries);
      setSolde(entries - Number(outflowTotal || 0));
    } catch {
      setOutflows([]);
      setTotalOutflows(0);
      setTotalEntries(0);
      setSolde(0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!outflowDate) {
      setError('Veuillez saisir la date.');
      return;
    }
    if (!outflowDesignation.trim()) {
      setError('Veuillez saisir la désignation.');
      return;
    }
    if (!outflowAmount || Number(outflowAmount) <= 0) {
      setError('Veuillez saisir un montant valide.');
      return;
    }

    try {
      await window.api.createCashOutflow?.({
        outflow_date: outflowDate,
        designation: outflowDesignation.trim(),
        amount: Number(outflowAmount),
      });

      setOutflowDesignation('');
      setOutflowAmount('');
      setSuccess('Sortie enregistrée avec succès.');
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'enregistrement.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette sortie ?')) return;
    try {
      await window.api.deleteCashOutflow?.(id);
      loadData();
    } catch (err) {
      alert(err.message || 'Erreur lors de la suppression.');
    }
  };

  const openEdit = (outflow) => {
    setEditingOutflow(outflow);
    setEditDate(outflow.outflow_date);
    setEditDesignation(outflow.designation);
    setEditAmount(String(outflow.amount));
  };

  const closeEdit = () => {
    setEditingOutflow(null);
    setEditDate('');
    setEditDesignation('');
    setEditAmount('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editDate) {
      alert('Veuillez saisir la date.');
      return;
    }
    if (!editDesignation.trim()) {
      alert('Veuillez saisir la désignation.');
      return;
    }
    if (!editAmount || Number(editAmount) <= 0) {
      alert('Veuillez saisir un montant valide.');
      return;
    }

    try {
      await window.api.updateCashOutflow?.(editingOutflow.id, {
        outflow_date: editDate,
        designation: editDesignation.trim(),
        amount: Number(editAmount),
      });
      closeEdit();
      loadData();
    } catch (err) {
      alert(err.message || 'Erreur lors de la modification.');
    }
  };

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Sorties de caisse</h1>
          <p>
            Gestion des dépenses{archiveLabel ? ` — ${archiveLabel}` : ''}.
          </p>
        </div>
        <div className="dashboard-badge">
          Finance
        </div>
      </div>

      <div className="cards-grid" style={{ marginBottom: '24px' }}>
        <article className="stat-card" style={{ borderTop: '5px solid #28a745' }}>
          <div className="stat-top">
            <h3>Entrées</h3>
          </div>
          <strong>{totalEntries.toLocaleString()} Ar</strong>
          <span className="stat-subtitle">Total recettes du mois</span>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #dc3545' }}>
          <div className="stat-top">
            <h3>Sorties</h3>
          </div>
          <strong>{totalOutflows.toLocaleString()} Ar</strong>
          <span className="stat-subtitle">Total dépenses du mois</span>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #3777cc' }}>
          <div className="stat-top">
            <h3>Solde de caisse</h3>
          </div>
          <strong>{solde.toLocaleString()} Ar</strong>
          <span className="stat-subtitle">Entrées - Sorties</span>
        </article>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px', alignItems: 'start' }}>
        <div style={{ padding: '24px', border: '1px solid #e6e6e6', borderRadius: '10px', background: '#fff' }}>
          <h3 style={{ marginBottom: '16px', color: '#333' }}>Enregistrer une sortie</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500, color: '#555' }}>Date</label>
              <input
                type="date"
                value={outflowDate}
                onChange={(e) => setOutflowDate(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #c8d9df', borderRadius: '8px', font: 'inherit', fontSize: '0.95rem' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500, color: '#555' }}>Désignation</label>
              <input
                type="text"
                placeholder="Ex: Achat matériel, Frais de transport..."
                value={outflowDesignation}
                onChange={(e) => setOutflowDesignation(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #c8d9df', borderRadius: '8px', font: 'inherit', fontSize: '0.95rem' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500, color: '#555' }}>Montant (Ar)</label>
              <input
                type="number"
                placeholder="0"
                min="0"
                step="any"
                value={outflowAmount}
                onChange={(e) => setOutflowAmount(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #c8d9df', borderRadius: '8px', font: 'inherit', fontSize: '0.95rem' }}
              />
            </div>
            {error && <div style={{ color: '#dc3545', fontSize: '0.9rem', marginBottom: '12px', padding: '8px 12px', background: '#fdecea', borderRadius: '6px' }}>{error}</div>}
            {success && <div style={{ color: '#28a745', fontSize: '0.9rem', marginBottom: '12px', padding: '8px 12px', background: '#e8f5e9', borderRadius: '6px' }}>{success}</div>}
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px 20px',
                background: '#dc3545',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                font: 'inherit',
                fontWeight: 600,
                fontSize: '0.95rem'
              }}
            >
              Enregistrer la sortie
            </button>
          </form>
        </div>

        <div style={{ padding: '24px', border: '1px solid #e6e6e6', borderRadius: '10px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#333' }}>Liste des sorties</h3>
            <span style={{ padding: '6px 14px', background: '#fdecea', color: '#dc3545', borderRadius: '999px', fontSize: '0.9rem', fontWeight: 600 }}>
              Total : {totalOutflows.toLocaleString()} Ar
            </span>
          </div>
          {outflows.length > 0 ? (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e6e6e6', position: 'sticky', top: 0, background: '#fff' }}>
                    <th style={{ textAlign: 'left', padding: '12px 8px', color: '#555', fontSize: '0.9rem' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px', color: '#555', fontSize: '0.9rem' }}>Désignation</th>
                    <th style={{ textAlign: 'right', padding: '12px 8px', color: '#555', fontSize: '0.9rem' }}>Montant</th>
                    <th style={{ textAlign: 'center', padding: '12px 8px', color: '#555', fontSize: '0.9rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {outflows.map((outflow) => (
                    <tr key={outflow.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '12px 8px', fontSize: '0.9rem' }}>{outflow.outflow_date}</td>
                      <td style={{ padding: '12px 8px', fontSize: '0.9rem' }}>{outflow.designation}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: '#dc3545', fontSize: '0.9rem' }}>
                        -{Number(outflow.amount).toLocaleString()} Ar
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => openEdit(outflow)}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            color: '#007bff',
                            border: '1px solid #007bff',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            marginRight: '6px'
                          }}
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(outflow.id)}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            color: '#dc3545',
                            border: '1px solid #dc3545',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888', fontSize: '1rem' }}>
              Aucune sortie enregistrée ce mois
            </div>
          )}
        </div>
      </div>

      {editingOutflow && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '400px', maxWidth: '90%' }}>
            <h3 style={{ marginBottom: '16px', color: '#333' }}>Modifier la sortie</h3>
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500, color: '#555' }}>Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #c8d9df', borderRadius: '8px', font: 'inherit', fontSize: '0.95rem' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500, color: '#555' }}>Désignation</label>
                <input
                  type="text"
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #c8d9df', borderRadius: '8px', font: 'inherit', fontSize: '0.95rem' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500, color: '#555' }}>Montant (Ar)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #c8d9df', borderRadius: '8px', font: 'inherit', fontSize: '0.95rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={closeEdit}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: '#6c757d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
