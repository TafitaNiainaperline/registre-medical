import { useEffect, useState } from 'react';
import { categories } from '../constants';

export default function DashboardPage() {
  const [stats, setStats] = useState({});
  const [archiveLabel, setArchiveLabel] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const current = await window.api.getCurrentArchive?.();
        if (current?.label) setArchiveLabel(current.label);
        const result = await window.api.fetchStatsByArchive?.({ year: current?.year, month: current?.month });
        if (result) { setStats(result || {}); return; }
      } catch {
        // fallback
      }
      window.api.fetchStats()
        .then(result => setStats(result || {}))
        .catch(() => setStats({}));
    };
    load();
  }, []);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Tableau de bord</h1>
          <p>
            Aperçu général des registres{archiveLabel ? ` — ${archiveLabel}` : ''}.
          </p>
        </div>

        <div className="dashboard-badge">
          🏥 Gestion Clinique
        </div>
      </div>
      <div className="cards-grid">
        {categories.map((cat) => (
          <article
            key={cat.key}
            className="stat-card"
            style={{
              borderTop: `5px solid ${cat.color}`
            }}
          >

            <div className="stat-top">
              <h3>{cat.label}</h3>

              <div
                className="stat-dot"
                style={{ background: cat.color }}
              />
            </div>

            <strong>{stats[cat.key] || 0}</strong>

            <span className="stat-subtitle">
              Dossiers enregistrés
            </span>

          </article>
        ))}
      </div>
    </section>
  );
}
