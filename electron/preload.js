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

  // EXPORT
  exportExcelByArchive: (filters) =>
    ipcRenderer.invoke('export:excelByArchive', filters),
});
