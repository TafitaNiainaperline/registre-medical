export default function MonthlyArchiveBanner({ current, archives, onChange }) {
  const list = Array.isArray(archives) ? archives : [];
  const selectedKey = current ? `${current.year}-${String(current.month).padStart(2, '0')}` : '';

  return (
    <div className="archive-banner">
      <div className="archive-banner-left">
        <strong>Archive active :</strong>{' '}
        <span className="archive-pill">{current?.label || '—'}</span>
      </div>

      <div className="archive-banner-right">
        <span style={{ color: '#5f7b84', fontSize: '0.9rem' }}>Changer :</span>
        <div className="archive-chips">
          {list.slice(0, 6).map((a) => {
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
      </div>
    </div>
  );
}
