const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {

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

  deleteMedication: (id) =>
    ipcRenderer.invoke('meds:delete', id),

  addMedicationStock: (id, quantity) =>
    ipcRenderer.invoke('meds:addStock', id, quantity),

  getMedicationMovements: () =>
    ipcRenderer.invoke('meds:movements'),

  // EXPORT
  exportExcelByArchive: (filters) =>
    ipcRenderer.invoke('export:excelByArchive', filters),

  getTopSellingMedications: () =>
    ipcRenderer.invoke('meds:topSelling'),

  getLowStockMedications: () =>
    ipcRenderer.invoke('meds:lowStock'),

  getStockReport: () =>
    ipcRenderer.invoke('meds:stockReport'),

  exportStockExcel: () =>
    ipcRenderer.invoke('stock:excel'),

  exportStockPdf: () =>
    ipcRenderer.invoke('stock:pdf'),

  // DISPENSATIONS
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
});