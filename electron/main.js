const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./database');
let exportExcel = null;
try {
  exportExcel = require('./excelExport');
} catch {
  exportExcel = null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },

    title: 'Registre Médical',
  });

  // Debug crash renderer
  win.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer crash:', details);
  });

  // DEV
  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
  }

  // PROD
  else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


// ─────────────────────────────
// AUTH
// ─────────────────────────────

ipcMain.handle('auth:login', (_, data) => {
  return db.loginUser(data);
});

ipcMain.handle('auth:register', (_, data) => {
  return db.registerUser(data);
});


// ─────────────────────────────
// USERS
// ─────────────────────────────

ipcMain.handle('users:all', () => {
  return db.getAllUsers();
});

ipcMain.handle('users:toggle', (_, id, active) => {
  return db.toggleUserActive(id, active);
});

ipcMain.handle('users:resetPwd', (_, id, pwd) => {
  return db.resetUserPassword(id, pwd);
});

ipcMain.handle('users:delete', (_, id) => {
  return db.deleteUser(id);
});


// ─────────────────────────────
// RECORDS
// ─────────────────────────────

ipcMain.handle('records:fetch', (_, category) => {
  return db.fetchRecords(category);
});

ipcMain.handle('records:fetchByArchive', (_, filters) => {
  return db.fetchRecordsByArchive(filters || {});
});

ipcMain.handle('records:stats', () => {
  return db.fetchStats();
});

ipcMain.handle('records:statsByArchive', (_, filters) => {
  return db.fetchStatsByArchive(filters || {});
});

ipcMain.handle('records:create', (_, data) => {
  return db.createRecord(data);
});

ipcMain.handle('records:update', (_, id, data) => {
  return db.updateRecord(id, data);
});

ipcMain.handle('records:delete', (_, id) => {
  return db.deleteRecord(id);
});

// ─────────────────────────────────────────────────────
// ARCHIVES
ipcMain.handle('archives:list', () => {
  return db.listArchives();
});

ipcMain.handle('archives:current', () => {
  return db.getCurrentArchive();
});

// ─────────────────────────────────────────────────────
// MEDICATIONS
ipcMain.handle('meds:list', () => {
  return db.listMedications();
});

ipcMain.handle('meds:create', (_, data) => {
  return db.createMedication(data);
});

ipcMain.handle('meds:update', (_, id, data) => {
  return db.updateMedication(id, data);
});

ipcMain.handle('meds:delete', (_, id) => {
  return db.deleteMedication(id);
});

// ─────────────────────────────────────────────────────
// EXPORT EXCEL
ipcMain.handle('export:excelByArchive', async (_, filters) => {
  if (!exportExcel) {
    throw new Error('Dépendance Excel manquante. Installez "exceljs" puis relancez l’application.');
  }
  const win = BrowserWindow.getFocusedWindow();
  const { year, month } = filters || {};
  if (!year || !month) throw new Error('Mois/année requis pour l’export.');

  const defaultName = `registre_${year}-${String(month).padStart(2, '0')}.xlsx`;
  const result = await dialog.showSaveDialog(win, {
    title: 'Exporter en Excel',
    defaultPath: defaultName,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };

  const rows = await db.fetchRecordsByArchive(filters);
  await exportExcel.writeArchiveExcel({
    filePath: result.filePath,
    year,
    month,
    records: rows || [],
  });
  return { canceled: false, filePath: result.filePath };
});
