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
    currentUser, isAdmin, filteredTopSelling, form, setForm, editingId, modalType, search, setSearch, message, toast,
    openCreate, openEdit, closeModal, submit,
    stockTarget, stockQuantity, setStockQuantity, stockDate, setStockDate, openStock, closeStock, confirmStock,
    historyTarget, stockHistory, openHistory, closeHistory,
    filtered, lowStockCount, actSummary, typeFilter, setTypeFilter, counts,
  } = useMedicamentsPage()

  return (
    <>
      {toast.text && (
        <div className={toast.type === 'err' ? 'toast error' : 'toast'} role="status">
          <Icon name={toast.type === 'err' ? 'alert' : 'check-circle'} />
          {toast.text}
        </div>
      )}

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
            <Icon name="pill" /> Médicaments
          </div>
        </div>

        {message.text && (
          <div className={message.type === 'err' ? 'error-msg' : 'success-msg'}>
            <Icon name={message.type === 'err' ? 'alert' : 'check-circle'} />
            {message.text}
          </div>
        )}

        {lowStockCount > 0 && (
          <div className="low-stock">
            <Icon name="alert" size="md" />
            <strong>{lowStockCount}</strong> médicament(s) ont atteint leur seuil d'alerte.
          </div>
        )}

        <div className="add-actions">
          <button type="button" onClick={() => openCreate('medication')}>
            <Icon name="package" size="md" /> Ajouter un médicament
          </button>

          <button type="button" className="btn-light" onClick={() => openCreate('act')}>
            <Icon name="stethoscope" size="md" /> Ajouter un acte médical
          </button>
        </div>

        <div className="search-bar catalogue-search">
          <div className="search-field">
            <Icon name="search" />
            <input
              type="search"
              aria-label="Rechercher un médicament ou un acte médical"
              placeholder="Rechercher un médicament ou un acte médical…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {search && <button type="button" className="btn-light" onClick={() => setSearch('')} aria-label="Effacer la recherche"><Icon name="close" /></button>}

          <div className="stock-exports" role="group" aria-label="Exporter le stock">
          <span>Stock</span>

          <button className="btn-success" onClick={() => window.api.exportStockExcel()}>
            <Icon name="excel" /> Excel
          </button>

          <button className="btn-danger" onClick={() => window.api.exportStockPdf()}>
            <Icon name="file" /> PDF
          </button>
          </div>

          <div className="catalogue-filters" role="group" aria-label="Type de résultat">
            {([
              ['all', 'Tous'], ['medication', 'Médicaments'], ['act', 'Actes médicaux'],
            ] as const).map(([type, label]) => (
              <button type="button" key={type} aria-pressed={typeFilter === type}
                className={typeFilter === type ? 'active' : ''} onClick={() => setTypeFilter(type)}>
                {label} <span>{counts[type]}</span>
              </button>
            ))}
            <span className="result-count" role="status">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th className="center">Type</th>
                <th className="num">Prix (Ar)</th>
                <th className="center">Unité</th>
                <th className="center">Stock</th>
                <th className="center">Seuil</th>
                <th className="center">Date</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td className="empty" colSpan={8}>
                  Aucun médicament ou acte ne correspond à votre recherche.
                  {(search || typeFilter !== 'all') && <button type="button" className="btn-light" onClick={() => { setSearch(''); setTypeFilter('all') }}>Réinitialiser les filtres</button>}
                </td></tr>
              )}

              {filtered.map((row) => {
                const lowStock = isLowStock(row)
                const isAct = row.item_type === 'act'

                return (
                  <tr key={row.id} className={lowStock ? 'low' : undefined}>
                    <td><strong>{row.name}</strong></td>
                    <td className="center">
                      <span className={isAct ? 'badge act' : 'badge med'}>{isAct ? 'Acte' : 'Médicament'}</span>
                    </td>
                    <td className="num price">{Number(row.price).toLocaleString()}</td>
                    <td className="center">
                      {isAct ? '-' : <span className="unit">{row.unit || 'comprimé'}</span>}
                    </td>
                    <td className="center">
                      {isAct || row.stock === null || row.stock === undefined ? (
                        <span className="untracked">{isAct ? '-' : 'Non suivi'}</span>
                      ) : (
                        <div className="stock">
                          <button className="value" title="Voir l'historique du stock" onClick={() => openHistory(row)}>
                            {row.stock}
                          </button>
                          {lowStock && <span className="badge warn">Stock faible</span>}
                        </div>
                      )}
                    </td>
                    <td className="center">{isAct ? '-' : (row.stock_threshold ?? 100)}</td>
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

        <div className="activity-grid">
        {typeFilter !== 'act' && <ActActivity kind="medication" search={search}
          entries={filteredTopSelling.map((medication) => ({ name: medication.medication_name, count: medication.total_sold }))} />}
        {typeFilter !== 'medication' && <ActActivity entries={actSummary} search={search} />}
        </div>
      </section>
    </>
  )
}

export default MedicamentsPage
