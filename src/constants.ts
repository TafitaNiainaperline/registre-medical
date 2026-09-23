import type { CategoryKey } from '../electron/types'
import type { IconName } from './components/Icon/types'

export type Category = {
  key: CategoryKey
  label: string
  icon: IconName
}

// La couleur de chaque registre est portée par la classe modificatrice `key` en SCSS
export const categories: Category[] = [
  { key: 'consultation', label: 'Consultation externe', icon: 'stethoscope' },
  { key: 'cpn', label: 'Consultation Pre-Natale', icon: 'baby' },
  { key: 'pf', label: 'Planification Familiale', icon: 'heart' },
  { key: 'echographie', label: 'Échographie', icon: 'activity' },
  { key: 'analyse', label: 'Analyses', icon: 'microscope' },
  { key: 'soin', label: 'Soins', icon: 'pill' },
]
