import { useState } from 'react'
import Icon from '../Icon'
import './PrivateAmount.scss'

export default function PrivateAmount({ amount, label }: { amount: number; label: string }) {
  const [visible, setVisible] = useState(false)
  const action = `${visible ? 'Masquer' : 'Afficher'} ${label}`
  return <span className="PrivateAmount">
    <span aria-live="polite">{visible ? `${amount.toLocaleString('fr-FR')} Ar` : '••••••'}</span>
    <button type="button" aria-label={action} title={action} aria-pressed={visible} onClick={() => setVisible((value) => !value)}>
      <Icon name={visible ? 'eye-off' : 'eye'} size="md" />
    </button>
  </span>
}
