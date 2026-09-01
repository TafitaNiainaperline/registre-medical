import { useState } from 'react';

export default function MonthlyArchiveBanner({ current, archives, onChange, allArchives }) {
  const list = Array.isArray(archives) ? archives : [];
  const allList = Array.isArray(allArchives) ? allArchives : [];
  const selectedKey = current ? `${current.year}-${String(current.month).padStart(2, '0')}` : '';
  const [showAll, setShowAll] = useState(false);
  const displayList = showAll ? allList : list;

  return (
    <div className="archive-banner">
      <div className="archive-banner-left">
        <strong>Archive active :</strong>{' '}
        <span className="archive-pill">{current?.label || '—'}</span>
      </div>

      <div className="archive-banner-right">
        <span style={{ color: '#5f7b84', fontSize: '0.9rem' }}>Changer :</span>
        <div className="archive-chips">
          {displayList.slice(0, showAll ? 24 : 6).map((a) => {
            const k = `${a.year}-${String(a.month).padStart(2, '0')}`;
            const active = k === selectedKey;
            return (
              <button
                key={k}
                type="button"
                className={active ? 'archive-chip active' : 'archive-chip'}
                onClick={() => onChange?.(a)}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        {allList.length > 6 && (
          <button
            type="button"
            className="archive-chip"
            onClick={() => setShowAll(!showAll)}
            style={{ fontSize: '0.8rem' }}
          >
            {showAll ? 'Réduire' : `Tout (${allList.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
