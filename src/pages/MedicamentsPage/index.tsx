import Icon from '../../components/Icon'
import { formatDate } from '../../utils/date'
import StockModal from './StockModal'
import StockHistoryModal from './StockHistoryModal'
import ItemModal from './ItemModal'
import ActActivity from './ActActivity'
import { isLowStock, useMedicamentsPage } from './useMedicamentsPage'
import './MedicamentsPage.scss'


const MedicamentsPage = () => {
  const {
    currentUser, isAdmin, filteredTopSelling, form, setForm, editingId, modalType, search, setSearch, message,
    openCreate, openEdit, closeModal, submit, exportStock,
    stockTarget, stockQuantity, setStockQuantity, stockDate, setStockDate, openStock, closeStock, confirmStock,
    historyTarget, stockHistory, openHistory, closeHistory,
    filtered, lowStockCount, actSummary, typeFilter, setTypeFilter, counts, catalogueCounts, exporting,
  } = useMedicamentsPage()

  return (
    <>
      {stockTarget && (
        <StockModal
          medication={stockTarget}
          quantity={stockQuantity}
          date={stockDate}
          author={currentUser.name || currentUser.username || 'Utilisateur'}
          onQuantityChange={setStockQuantity}
          onDateChange={setStockDate}
          onConfirm={confirmStock}
          onClose={closeStock}
        />
      )}

      {historyTarget && (
        <StockHistoryModal medication={historyTarget} history={stockHistory} onClose={closeHistory} />
      )}

      {modalType && (
        <ItemModal
          itemType={modalType}
          editing={Boolean(editingId)}
          form={form}
          isAdmin={isAdmin}
          onChange={setForm}
          onSubmit={submit}
          onClose={closeModal}
        />
      )}

      <section className="MedicamentsPage">
        <div className="page-header">
          <div>
            <h1>Médicaments et actes médicaux</h1>
            <p>Retrouvez vos médicaments et actes, leurs tarifs et le stock disponible.</p>
          </div>
          <div className="page-badge">
            <Icon name={typeFilter === 'act' ? 'stethoscope' : 'pill'} /> {typeFilter === 'act' ? 'Actes médicaux' : 'Médicaments'}
          </div>
        </div>

        {message.text && (
          <div className={message.type === 'err' ? 'error-msg' : 'success-msg'}>
            <Icon name={message.type === 'err' ? 'alert' : 'check-circle'} />
            {message.text}
          </div>
        )}

        <div className="catalogue-tabs" role="group" aria-label="Catalogue">
          {(['medication', 'act'] as const).map((type) => (
            <button type="button" key={type} aria-pressed={typeFilter === type}
              className={typeFilter === type ? 'active' : ''} onClick={() => { setTypeFilter(type); setSearch('') }}>
              <Icon name={type === 'act' ? 'stethoscope' : 'pill'} />
              <span className="tab-label">{type === 'act' ? 'Actes médicaux' : 'Médicaments'}
                <small>{type === 'act' ? 'Catalogue et tarifs' : 'Tarifs et suivi du stock'}</small>
              </span>
              <span className="tab-count">{catalogueCounts[type]}</span>
            </button>
          ))}
        </div>

        {typeFilter === 'medication' && lowStockCount > 0 && (
          <div className="low-stock">
            <Icon name="alert" size="md" />
            <strong>{lowStockCount}</strong> médicament(s) ont atteint leur seuil d'alerte.
          </div>
        )}

        <div className="search-bar catalogue-search">
          <div className="search-field">
            <Icon name="search" />
            <input
              type="search"
              aria-label={typeFilter === 'act' ? 'Rechercher un acte médical' : 'Rechercher un médicament'}
              placeholder={typeFilter === 'act' ? 'Rechercher un acte médical…' : 'Rechercher un médicament…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {search && <button type="button" className="btn-light" onClick={() => setSearch('')} aria-label="Effacer la recherche"><Icon name="close" /></button>}

          <button type="button" onClick={() => openCreate(typeFilter)}><Icon name="plus" />
            {typeFilter === 'act' ? 'Ajouter un acte' : 'Ajouter un médicament'}
          </button>
        </div>

        <div className="catalogue-export" aria-busy={exporting}>
          <div className="export-description">
            <span className="export-icon"><Icon name={typeFilter === 'act' ? 'stethoscope' : 'pill'} size="md" /></span>
            <div>
              <strong>{typeFilter === 'act' ? 'Exporter les actes médicaux' : 'Exporter les médicaments'}</strong>
              <p>{typeFilter === 'act' ? 'Catalogue complet des actes et de leurs tarifs.' : 'Liste complète des médicaments, tarifs et stocks disponibles.'}</p>
            </div>
          </div>
          <div className="export-buttons">
            <button type="button" className="btn-light" disabled={exporting || catalogueCounts[typeFilter] === 0} onClick={() => exportStock('excel')}>
              <Icon name="excel" /> Excel
            </button>
            <button type="button" className="btn-light" disabled={exporting || catalogueCounts[typeFilter] === 0} onClick={() => exportStock('pdf')}>
              <Icon name="file" /> PDF
            </button>
          </div>
          {exporting && <span className="export-status" role="status">Export en cours…</span>}
        </div>

        {([typeFilter] as const).map((kind) => {
          const isActCategory = kind === 'act'
          const groupRows = filtered.filter((row) => (row.item_type === 'act') === isActCategory)
          return (
        <section className={`catalogue-section ${kind}`} key={kind} aria-label={isActCategory ? 'Actes médicaux' : 'Médicaments'}>
          <div className="catalogue-heading">
            <h2><Icon name={isActCategory ? 'stethoscope' : 'pill'} /> {isActCategory ? 'Actes médicaux' : 'Médicaments'}</h2>
            <p className="catalogue-result" role="status">{counts[kind]} résultat{counts[kind] !== 1 ? 's' : ''}</p>
          </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th className="num">Prix (Ar)</th>
                {!isActCategory && <>
                  <th className="center">Unité</th>
                  <th className="center">Stock</th>
                  <th className="center">Seuil</th>
                </>}
                <th className="center">Date</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupRows.length === 0 && (
                <tr><td className="empty" colSpan={isActCategory ? 4 : 7}>
                  {isActCategory ? 'Aucun acte médical à afficher.' : 'Aucun médicament à afficher.'}
                  {search && <button type="button" className="btn-light" onClick={() => setSearch('')}>Effacer la recherche</button>}
                </td></tr>
              )}

              {groupRows.map((row) => {
                const lowStock = isLowStock(row)
                const isAct = row.item_type === 'act'

                return (
                  <tr key={row.id} className={lowStock ? 'low' : undefined}>
                    <td><strong>{row.name}</strong></td>
                    <td className="num price">{Number(row.price).toLocaleString()}</td>
                    {!isActCategory && <>
                    <td className="center">
                      {isAct ? '-' : <span className="unit">{row.unit || 'comprimé'}</span>}
                    </td>
                    <td className="center stock-cell">
                      <div className="stock">
                        {row.stock === null || row.stock === undefined ? (
                          <span className="untracked">Non suivi</span>
                        ) : (
                          <button className="value" title="Voir l'historique du stock" onClick={() => openHistory(row)}>
                            {row.stock}
                          </button>
                        )}
                        {lowStock && <span className="badge warn">Stock faible</span>}
                      </div>
                    </td>
                    <td className="center">{row.stock_threshold ?? 100}</td>
                    </>}
                    <td className="center date">{formatDate(row.created_at)}</td>
                    <td className="actions">
                      <div>
                        {!isAct && (
                          <button className="icon-btn add" title="Ajouter du stock" onClick={() => openStock(row)}>
                            <Icon name="plus" />
                          </button>
                        )}
                        {isAdmin && (
                          <button className="icon-btn edit" title="Modifier" onClick={() => openEdit(row)}>
                            <Icon name="edit" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </section>
          )
        })}

        <details className="catalogue-statistics" key={typeFilter}>
        <summary>Voir les statistiques</summary>
        <div className="activity-grid">
        {typeFilter !== 'act' && <ActActivity kind="medication" search={search}
          entries={filteredTopSelling.map((medication) => ({ name: medication.medication_name, count: medication.total_sold }))} />}
        {typeFilter !== 'medication' && <ActActivity entries={actSummary} search={search} />}
        </div>
        </details>
      </section>
    </>
  )
}

export default MedicamentsPage
