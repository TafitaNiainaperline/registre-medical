import { useEffect, useRef } from 'react'
import Icon from '../../components/Icon'

type Props = {
  onConfirm: () => void
  onCancel: () => void
}

export default function TreatmentConfirmation({ onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement
    cancelRef.current?.focus()
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])

  return (
    <div className="treatment-confirmation" role="alertdialog" aria-modal="false"
      aria-labelledby="treatment-confirmation-title" aria-describedby="treatment-confirmation-description"
      onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); onCancel() } }}>
      <div className="confirmation-icon"><Icon name="alert" size="md" /></div>
      <div className="confirmation-body">
        <h3 id="treatment-confirmation-title">Enregistrer sans traitement ?</h3>
        <p id="treatment-confirmation-description">Aucun médicament ni acte médical n’a été ajouté à cette consultation.</p>
        <div className="confirmation-actions">
          <button type="button" className="btn-light" ref={cancelRef} onClick={onCancel}>Compléter le traitement</button>
          <button type="button" onClick={onConfirm}>Enregistrer sans traitement</button>
        </div>
      </div>
      <button type="button" className="confirmation-close" aria-label="Annuler la confirmation" onClick={onCancel}><Icon name="close" /></button>
    </div>
  )
}
