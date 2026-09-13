import Icon from '../Icon'
import type { IconName } from '../Icon/types'
import type { FilterEntry } from './types'
import { useFilterCard } from './useFilterCard'
import './FilterCard.scss'

type Props = {
  title: string
  icon: IconName
  tone: string
  placeholder: string
  entries: FilterEntry[]
}

// Carte dont la liste ne s'affiche qu'une fois une recherche saisie
const FilterCard = ({ title, icon, tone, placeholder, entries }: Props) => {
  const { filter, setFilter, matching, isEmpty, hiddenCount } = useFilterCard(entries)

  return (
    <article className={`FilterCard stat-card ${tone}`}>
      <div className="top">
        <Icon name={icon} size="xl" />
        <h3>{title}</h3>
      </div>

      <input type="text" placeholder={placeholder} value={filter} onChange={(e) => setFilter(e.target.value)} />

      <div className="results">
        {isEmpty && <span className="empty">Aucune donnée</span>}
        {!isEmpty && matching.length === 0 && <span className="empty">Aucun résultat</span>}

        {matching.map((entry) => (
          <span className="row" key={entry.label}>
            <span>{entry.label}</span>
            <strong className="count-badge">{entry.value}</strong>
          </span>
        ))}

        {hiddenCount > 0 && <span className="empty">+{hiddenCount} autres — affinez la recherche</span>}
      </div>
    </article>
  )
}

export default FilterCard
