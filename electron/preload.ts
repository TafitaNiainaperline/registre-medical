import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronApi } from './types'

// Le typage `ElectronApi` garantit que le pont expose exactement la surface attendue
const api: ElectronApi = {
  getSessionUser: () => ipcRenderer.invoke('auth:session'),
  listAudit: (filters) => ipcRenderer.invoke('audit:list', filters),
  backupDatabase: () => ipcRenderer.invoke('backup:save'),
  restoreDatabase: () => ipcRenderer.invoke('backup:restore'),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // AUTH
  login: (data) =>
    ipcRenderer.invoke('auth:login', data),

  register: (data) =>
    ipcRenderer.invoke('auth:register', data),


  // USERS
  getAllUsers: () =>
    ipcRenderer.invoke('users:all'),

  toggleUserActive: (id, active) =>
    ipcRenderer.invoke('users:toggle', id, active),

  resetUserPassword: (id, pwd) =>
    ipcRenderer.invoke('users:resetPwd', id, pwd),

  deleteUser: (id) =>
    ipcRenderer.invoke('users:delete', id),


  // RECORDS
  fetchRecords: (category) =>
    ipcRenderer.invoke('records:fetch', category),

  fetchRecordsByArchive: (filters) =>
    ipcRenderer.invoke('records:fetchByArchive', filters),

  fetchAppointments: () =>
    ipcRenderer.invoke('records:appointments'),

  clearAppointment: (id) =>
    ipcRenderer.invoke('records:clearAppointment', id),

  fetchStats: () =>
    ipcRenderer.invoke('records:stats'),

  fetchStatsByArchive: (filters) =>
    ipcRenderer.invoke('records:statsByArchive', filters),

  createRecord: (data) =>
    ipcRenderer.invoke('records:create', data),

  updateRecord: (id, data) =>
    ipcRenderer.invoke('records:update', id, data),

  deleteRecord: (id) =>
    ipcRenderer.invoke('records:delete', id),

  continueRecord: (id, data) =>
    ipcRenderer.invoke('records:continue', id, data),

  backfillRegistryNumbers: () =>
    ipcRenderer.invoke('records:backfillRegistry'),

  fetchRecordsByDossier: (dossierId) =>
    ipcRenderer.invoke('records:fetchByDossier', dossierId),

  listDossiers: (search) =>
    ipcRenderer.invoke('dossiers:list', search),

  getDossier: (id) =>
    ipcRenderer.invoke('dossiers:get', id),

  // PATIENTS
  listPatients: (search) =>
    ipcRenderer.invoke('patients:list', search),

  getPatient: (id) =>
    ipcRenderer.invoke('patients:get', id),

  fetchRecordsByPatient: (patientId) =>
    ipcRenderer.invoke('patients:records', patientId),

  createPatient: (data) =>
    ipcRenderer.invoke('patients:create', data),

  updatePatient: (id, data) =>
    ipcRenderer.invoke('patients:update', id, data),

  suggestPatients: (nom, domicile) =>
    ipcRenderer.invoke('patients:suggest', nom, domicile),

  getPatientAddressLog: (patientId) =>
    ipcRenderer.invoke('patients:addressLog', patientId),

  exportReceiptPdf: (id) =>
    ipcRenderer.invoke('receipt:pdf', id),

  // ARCHIVES
  listArchives: () =>
    ipcRenderer.invoke('archives:list'),

  getCurrentArchive: () =>
    ipcRenderer.invoke('archives:current'),

  // MEDICATIONS
  listMedications: () =>
    ipcRenderer.invoke('meds:list'),

  createMedication: (data) =>
    ipcRenderer.invoke('meds:create', data),

  updateMedication: (id, data) =>
    ipcRenderer.invoke('meds:update', id, data),

  getMedicationHistory: () =>
    ipcRenderer.invoke('meds:history'),

  addMedicationStock: (id, quantity, createdBy, date) =>
    ipcRenderer.invoke('meds:addStock', id, quantity, createdBy, date),

  getMedicationMovements: () =>
    ipcRenderer.invoke('meds:movements'),

  getMedicationStockHistory: (medicationId) =>
    ipcRenderer.invoke('meds:stockHistory', medicationId),

  clearMedicationMovements: () =>
    ipcRenderer.invoke('meds:clearMovements'),

  getTopSellingMedications: () =>
    ipcRenderer.invoke('meds:topSelling'),

  getLowStockMedications: () =>
    ipcRenderer.invoke('meds:lowStock'),

  getStockReport: () =>
    ipcRenderer.invoke('meds:stockReport'),

  // EXPORT
  exportExcelByArchive: (filters) =>
    ipcRenderer.invoke('export:excelByArchive', filters),

  exportStockExcel: () =>
    ipcRenderer.invoke('stock:excel'),

  exportStockPdf: () =>
    ipcRenderer.invoke('stock:pdf'),

  // DISPENSATIONS
  exportDispensationReceiptPdf: (id) =>
    ipcRenderer.invoke('dispensations:pdf', id),

  getDispensations: () =>
    ipcRenderer.invoke('dispensations:list'),

  getDispensationTotal: (filters) =>
    ipcRenderer.invoke('dispensations:total', filters),

  createDispensation: (data) =>
    ipcRenderer.invoke('dispensations:create', data),

  deleteDispensation: (id) =>
    ipcRenderer.invoke('dispensations:delete', id),

  updateDispensation: (data) =>
    ipcRenderer.invoke('dispensations:update', data),

  // CASH OUTFLOWS (Sorties de caisse)
  createCashOutflow: (data) =>
    ipcRenderer.invoke('cashOutflows:create', data),

  listCashOutflows: (filters) =>
    ipcRenderer.invoke('cashOutflows:list', filters),

  getCashOutflowTotal: (filters) =>
    ipcRenderer.invoke('cashOutflows:total', filters),

  deleteCashOutflow: (id) =>
    ipcRenderer.invoke('cashOutflows:delete', id),

  updateCashOutflow: (id, data) =>
    ipcRenderer.invoke('cashOutflows:update', id, data),
}

contextBridge.exposeInMainWorld('api', api)
