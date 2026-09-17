import type { AuditEntry } from '../../../electron/types'

const fields: Record<string, string> = {
  category: 'Registre', patient_id: 'Patient', diagnostic: 'Diagnostic', traitement: 'Traitement',
  observation: 'Observation', cost: 'Montant (Ar)', registry_number: 'Numéro de registre',
  appointment_date: 'Rendez-vous', tdr_result: 'Résultat TDR', reference: 'Référence',
  pf_method: 'Produit PF', cpn_type: 'Consultation CPN', treatments_json: 'Soins',
  name: 'Nom', item_type: 'Type', price: 'Prix (Ar)', unit: 'Unité', description: 'Description',
  stock: 'Stock', stock_threshold: 'Seuil d’alerte', outflow_date: 'Date de dépense',
  designation: 'Désignation', amount: 'Montant (Ar)', medication_id: 'Médicament',
  medication_name: 'Nom du médicament', quantity: 'Quantité', unit_price: 'Prix unitaire (Ar)',
}

function snapshot(value: string | null): Record<string, unknown> {
  if (!value) return {}
  try { return JSON.parse(value) as Record<string, unknown> } catch { return {} }
}

export function auditChanges(entry: AuditEntry) {
  const before = snapshot(entry.before_json)
  const after = snapshot(entry.after_json)
  return Object.entries(fields).filter(([field]) => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null))
    .map(([field, label]) => ({ field, label, before: before[field], after: after[field] }))
}
