import './Icon.scss'
import type { IconName, IconSize } from './types'

type Props = {
  name: IconName
  size?: IconSize
  className?: string
}

// Le nom passe par un attribut : une classe entrerait en collision avec
// les classes de mise en page portant le même mot (.user, .close…)
const Icon = ({ name, size = 'sm', className }: Props) => (
  <span className={`Icon ${size}${className ? ` ${className}` : ''}`} data-icon={name} aria-hidden="true" />
)

export default Icon
