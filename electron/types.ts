// Types du domaine partagés entre le processus principal et le renderer

export type CategoryKey = 'consultation' | 'cpn' | 'pf' | 'analyse' | 'soin' | 'echographie'

export type UserRole = 'admin' | 'user'

export type ItemType = 'medication' | 'act'

export type AgeType = 'ans' | 'mois' | 'mois_jours' | 'jours'

export type TdrResult = 'positif' | 'negatif'

export type MovementType = 'entry' | 'exit'

// ── Utilisateurs ──────────────────────────────────────

export type AuthUser = {
  id: number
  name: string
  username: string
  role: UserRole
}

export type UserRow = {
  id: number
  username: string
  name: string
  role: UserRole
  is_active: number
  created_at: string
}

export type LoginInput = {
  username: string
  password: string
}

export type RegisterInput = {
  username: string
  name: string
  password: string
}

// ── Traitements ───────────────────────────────────────

export type Treatment = {
  medication_id: number | null
  item_type: ItemType
  name: string
  unit: string | null
  quantity: number
  unit_price: number
  total?: number
}

// Traitement tel que saisi côté formulaire (champs encore permissifs)
export type TreatmentInput = {
  medication_id?: number | string | null
  item_type?: string
  name: string
  unit?: string | null
  quantity?: number | string
  unit_price?: number | string
  total?: number
}

// ── Patients ──────────────────────────────────────────

// Fiche patient : l'identité suit la personne d'une consultation à l'autre.
// Les données cliniques restent portées par les dossiers médicaux.
export type Patient = {
  id: number
  patient_number: string | null
  nom: string
  prenom: string | null
  sexe: string | null
  domicile: string | null
  phone: string | null
  birth_date: string | null
  birth_estimated: number
  created_at: string
  updated_at: string | null
}

export type PatientInput = {
  nom: string
  prenom?: string | null
  sexe?: string | null
  domicile?: string | null
  phone?: string | null
  // Mois de naissance, stocké au format AAAA-MM-01 : l'âge est recalculé à chaque visite
  birth_date?: string | null
  birth_estimated?: boolean
  created_by?: number | null
}

// Candidat proposé à la saisie, avec son score de ressemblance en pourcentage
export type PatientMatch = {
  patient: Patient
  score: number
}

export type PatientAddressEntry = {
  id: number
  patient_id: number
  domicile: string | null
  created_at: string
  created_by_name: string | null
}

// ── Dossiers médicaux ─────────────────────────────────

export type MedicalRecord = {
  id: number
  category: CategoryKey
  dossier_id: number | null
  patient_id: number | null
  // Champs repris de la fiche patient à la lecture, jamais stockés ici
  patient_nom: string
  patient_prenom: string
  patient_number: string | null
  patient_phone: string | null
  sexe: string | null
  domicile: string
  birth_date: string | null
  // Âge recalculé à la date de la consultation
  age: string
  age_months: number | null
  diagnostic: string
  traitement: string
  observation: string | null
  cost: number
  created_by: number | null
  registry_number: string | null
  archive_year: number | null
  archive_month: number | null
  treatments_json: string | null
  appointment_date: string | null
  tdr_result: TdrResult | null
  pf_method: string | null
  cpn_type: string | null
  reference: string | null
  created_at: string
  treatments?: Treatment[] | null
  responsible_name?: string | null
}

export type RecordInput = {
  registry_number?: string | null
  category: CategoryKey
  dossier_id?: number | null
  patient_id?: number | null
  diagnostic: string
  traitement?: string
  observation?: string | null
  cost?: number | string
  created_by?: number | null
  archive_year?: number | null
  archive_month?: number | null
  treatments?: TreatmentInput[]
  appointment_date?: string | null
  tdr_result?: TdrResult | null
  pf_method?: string | null
  cpn_type?: string | null
  reference?: string | null
}

export type RecordUpdateInput = Omit<RecordInput, 'category'> & {
  category?: CategoryKey
}

export type ContinueRecordInput = {
  treatments?: TreatmentInput[]
  traitement?: string
  observation?: string | null
  created_by?: number | null
}

export type Appointment = Pick<
  MedicalRecord,
  'id' | 'category' | 'patient_nom' | 'patient_prenom' | 'diagnostic' | 'appointment_date' | 'registry_number' | 'tdr_result'
>

export type Dossier = {
  id: number
  dossier_number: string | null
  patient_id?: number | null
  patient_nom: string
  diagnostic: string
  created_at: string
}

// ── Archives ──────────────────────────────────────────

export type PrintResult = { canceled: boolean }

export type Archive = {
  year: number
  month: number
  label: string
  count?: number
}

export type ArchiveFilters = {
  category?: CategoryKey | string
  year?: number
  month?: number
  search?: string
}

export type PeriodFilters = {
  year?: number
  month?: number
}

export type CategoryStats = Record<string, number>

// ── Médicaments et stock ──────────────────────────────

export type Medication = {
  id: number
  name: string
  item_type: ItemType
  price: number
  unit: string | null
  description: string | null
  stock: number | null
  stock_threshold: number | null
  created_by?: number | null
  created_at: string
  updated_at: string | null
}

export type MedicationInput = {
  name: string
  item_type?: ItemType
  price: number | string
  unit?: string | null
  description?: string | null
  stock?: number | string | null
  stock_threshold?: number | string | null
  created_by?: number | null
  date?: string
}

export type MedicationHistoryEntry = {
  id: number
  name: string
  price: number
  unit: string | null
  stock: number | null
  created_at: string
  created_by_name: string | null
}

export type MedicationMovement = {
  id: number
  medication_id: number
  medication_name: string
  movement_type: MovementType
  quantity: number
  created_by: number | null
  created_by_name: string | null
  created_at: string
}

export type StockHistoryEntry = {
  id: number | null
  movement_type: MovementType
  quantity: number
  created_at: string
  created_by_name: string | null
  stock_after: number
  initial?: boolean
}

export type TopSellingMedication = {
  medication_name: string
  total_sold: number
}

export type StockReportRow = Pick<
  Medication,
  'id' | 'name' | 'item_type' | 'price' | 'unit' | 'stock' | 'stock_threshold' | 'description'
>

// ── Dispensations ─────────────────────────────────────

export type Dispensation = {
  id: number
  batch_id?: string | null
  medication_id: number
  medication_name: string
  unit: string | null
  quantity: number
  unit_price: number | null
  created_at: string
}

export type DispensationInput = {
  medication_id: number
  quantity: number
}

export type DispensationUpdateInput = DispensationInput & {
  id: number
}

// ── Sorties de caisse ─────────────────────────────────

export type CashOutflow = {
  id: number
  outflow_date: string
  designation: string
  amount: number
  created_by: number | null
  created_at: string
}

export type CashOutflowInput = {
  outflow_date: string
  designation: string
  amount: number
  created_by?: number | null
}

// ── Résultat des boîtes de dialogue d'enregistrement ──

export type SaveResult =
  | { canceled: true; filePath?: undefined }
  | { canceled: false; filePath: string }

// ── Surface exposée au renderer via le preload ────────

export type AuditEntity = 'visit' | 'stock' | 'expense' | 'dispensation'
export type AuditFilters = { entity?: AuditEntity | ''; beforeId?: number }
export type AuditEntry = {
  id: number
  entity_type: AuditEntity
  entity_id: number
  entity_label: string
  action: 'create' | 'update' | 'delete'
  actor_id: number | null
  actor_name: string
  before_json: string | null
  after_json: string | null
  created_at: string
}

export type ElectronApi = {
  getSessionUser: () => Promise<AuthUser | null>
  listAudit: (filters?: AuditFilters) => Promise<AuditEntry[]>
  backupDatabase: () => Promise<SaveResult>
  restoreDatabase: () => Promise<{ canceled: true } | { canceled: false; previousPath: string }>
  logout: () => Promise<void>
  // Auth
  login: (data: LoginInput) => Promise<AuthUser>
  register: (data: RegisterInput) => Promise<{ username: string; name: string }>

  // Utilisateurs
  getAllUsers: () => Promise<UserRow[]>
  toggleUserActive: (id: number, active: boolean) => Promise<void>
  resetUserPassword: (id: number, pwd: string) => Promise<void>
  deleteUser: (id: number) => Promise<void>

  // Dossiers
  fetchRecords: (category: CategoryKey) => Promise<MedicalRecord[]>
  fetchRecordsByArchive: (filters: ArchiveFilters) => Promise<MedicalRecord[]>
  fetchAppointments: () => Promise<Appointment[]>
  clearAppointment: (id: number) => Promise<void>
  fetchStats: () => Promise<CategoryStats>
  fetchStatsByArchive: (filters: PeriodFilters) => Promise<CategoryStats>
  createRecord: (data: RecordInput) => Promise<number | undefined>
  updateRecord: (id: number, data: RecordUpdateInput) => Promise<void>
  deleteRecord: (id: number) => Promise<void>
  continueRecord: (id: number, data: ContinueRecordInput) => Promise<boolean>
  backfillRegistryNumbers: () => Promise<boolean>
  fetchRecordsByDossier: (dossierId: number) => Promise<MedicalRecord[]>
  listDossiers: (search?: string) => Promise<Dossier[]>
  getDossier: (id: number) => Promise<Dossier | null>

  // Patients
  listPatients: (search?: string) => Promise<Patient[]>
  listPatientAddresses: () => Promise<string[]>
  getPatient: (id: number) => Promise<Patient | null>
  fetchRecordsByPatient: (patientId: number) => Promise<MedicalRecord[]>
  createPatient: (data: PatientInput) => Promise<Patient>
  updatePatient: (id: number, data: PatientInput) => Promise<void>
  suggestPatients: (nom: string, domicile?: string) => Promise<PatientMatch[]>
  getPatientAddressLog: (patientId: number) => Promise<PatientAddressEntry[]>
  exportReceiptPdf: (id: number) => Promise<SaveResult>
  printReceipt: (id: number) => Promise<PrintResult>

  // Archives
  listArchives: () => Promise<Archive[]>
  getCurrentArchive: () => Promise<Archive>

  // Médicaments
  listMedications: () => Promise<Medication[]>
  createMedication: (data: MedicationInput) => Promise<void>
  updateMedication: (id: number, data: MedicationInput) => Promise<void>
  getMedicationHistory: () => Promise<MedicationHistoryEntry[]>
  addMedicationStock: (id: number, quantity: number, createdBy: number | null, date?: string) => Promise<void>
  getMedicationMovements: () => Promise<MedicationMovement[]>
  getMedicationStockHistory: (medicationId: number) => Promise<StockHistoryEntry[]>
  clearMedicationMovements: () => Promise<void>
  getTopSellingMedications: () => Promise<TopSellingMedication[]>
  getLowStockMedications: () => Promise<Medication[]>
  getStockReport: () => Promise<StockReportRow[]>

  // Exports
  exportExcelByArchive: (filters: ArchiveFilters) => Promise<SaveResult>
  exportStockExcel: (itemType?: ItemType) => Promise<{ success: true } | undefined>
  exportStockPdf: (itemType?: ItemType) => Promise<{ success: true } | undefined>

  // Dispensations
  exportDispensationReceiptPdf: (id: number) => Promise<SaveResult>
  printDispensationReceipt: (id: number) => Promise<PrintResult>
  exportDispensationsMonth: (period: { year: number; month: number }) => Promise<SaveResult>
  getDispensations: () => Promise<Dispensation[]>
  getDispensationTotal: (filters: PeriodFilters) => Promise<number>
  createDispensation: (data: DispensationInput | DispensationInput[]) => Promise<boolean>
  deleteDispensation: (id: number) => Promise<boolean>
  updateDispensation: (data: DispensationUpdateInput) => Promise<boolean>

  // Sorties de caisse
  createCashOutflow: (data: CashOutflowInput) => Promise<number | undefined>
  listCashOutflows: (filters: PeriodFilters) => Promise<CashOutflow[]>
  getCashOutflowTotal: (filters: PeriodFilters) => Promise<number>
  deleteCashOutflow: (id: number) => Promise<void>
  updateCashOutflow: (id: number, data: CashOutflowInput) => Promise<void>
}
