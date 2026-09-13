import type { ItemType } from '../../../electron/types'

export type MedicationForm = {
  name: string
  price: string
  stock: string
  stock_threshold: string
  unit: string
  date: string
  item_type?: ItemType
}

export type ActForm = {
  name: string
  price: string
}

export type ActSummaryEntry = {
  name: string
  count: number
  total: number
}
