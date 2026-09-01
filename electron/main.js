const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const { buildReceiptHtml } = require('./receiptPdf');
const PDFDocument = require('pdfkit');
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

ipcMain.handle('records:appointments', () => {
  return db.fetchAppointments();
});

ipcMain.handle('records:clearAppointment', (_, id) => {
  return db.clearAppointment(id);
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

ipcMain.handle('records:continue', (_, id, data) => {
  return db.addTreatmentsToRecord(id, data);
});

ipcMain.handle('records:fetchByDossier', async (_, dossierId) => {
  return db.fetchRecordsByDossier(dossierId);
});

ipcMain.handle('dossiers:list', (_, search) => {
  return db.listDossiers(search || '');
});

ipcMain.handle('dossiers:get', (_, id) => {
  return db.getDossierById(id);
});

ipcMain.handle('records:update', (_, id, data) => {
  return db.updateRecord(id, data);
});

ipcMain.handle('records:delete', (_, id) => {
  return db.deleteRecord(id);
});

ipcMain.handle('records:backfillRegistry', async () => {
  return db.ensureRegistryNumbers();
});

ipcMain.handle('receipt:pdf', async (_, id) => {
  const record = await db.fetchRecordById(id);
  if (!record) throw new Error('Dossier introuvable.');

  const win = BrowserWindow.getFocusedWindow();
  const safeNumber = String(record.registry_number || record.id).replace(/[^\w.-]+/g, '_');
  const defaultName = `recu_${safeNumber}.pdf`;
  const result = await dialog.showSaveDialog(win, {
    title: 'Telecharger le recu',
    defaultPath: defaultName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };

  const receiptWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  try {
    const html = buildReceiptHtml(record);
    await receiptWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await receiptWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
    });
    fs.writeFileSync(result.filePath, pdf);
    return { canceled: false, filePath: result.filePath };
  } finally {
    receiptWindow.destroy();
  }
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

ipcMain.handle('meds:history', () => {
  return db.getMedicationHistory();
});

ipcMain.handle('meds:addStock', (_, id, quantity, createdBy, date) => {
  return db.addMedicationStock(id, quantity, createdBy, date);
});

ipcMain.handle('meds:movements', () => {
  return db.getMedicationMovements();
});

ipcMain.handle('meds:stockHistory', (_, medicationId) => {
  return db.getMedicationStockHistory(medicationId);
});

ipcMain.handle('meds:clearMovements', () => {
  return db.clearMedicationMovements();
});

ipcMain.handle('meds:topSelling', () => {
  return db.getTopSellingMedications();
});

ipcMain.handle('meds:lowStock', () => {
  return db.getLowStockMedications(10);
});

ipcMain.handle('meds:stockReport', () => {
  return db.getStockReport();
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

ipcMain.handle('stock:excel', async () => {

  const win = BrowserWindow.getFocusedWindow();

  const result = await dialog.showSaveDialog(win, {
    title: 'Exporter Stock',
    defaultPath: 'stock.xlsx',
    filters: [
      {
        name: 'Excel',
        extensions: ['xlsx']
      }
    ]
  });

  if (result.canceled) {
    return;
  }

  const meds = await db.getStockReport();

  await exportExcel.writeStockExcel({
    filePath: result.filePath,
    medications: meds
  });

  return {
    success: true
  };
});

ipcMain.handle('stock:pdf', async () => {

   const win = BrowserWindow.getFocusedWindow();

   const result = await dialog.showSaveDialog(win, {
     title: 'Exporter PDF',
     defaultPath: 'stock.pdf',
     filters: [
       {
         name: 'PDF',
         extensions: ['pdf']
       }
     ]
   });

   if (result.canceled) {
     return;
   }

   const meds = await db.getStockReport();

   const doc = new PDFDocument();

   doc.pipe(fs.createWriteStream(result.filePath));

   doc.fontSize(18).text('Rapport du stock');

   doc.moveDown();

   meds.forEach((m) => {

     doc.text(
       `${m.name} | Stock : ${m.stock ?? '-'} | Prix : ${m.price} Ar`
     );

   });

   doc.end();

   return {
     success: true
   };
 });

 // ─────────────────────────────────────────────────────
 // DISPENSATIONS
 // ─────────────────────────────────────────────────────

ipcMain.handle('dispensations:list', () => db.getDispensations());

ipcMain.handle('dispensations:total', (_, filters) => db.getDispensationTotal(filters));

ipcMain.handle('dispensations:create', (_, data) => {
  return db.createDispensation(data);
});

ipcMain.handle('dispensations:delete', (_, id) => {
  return db.deleteDispensation(id);
});

ipcMain.handle('dispensations:update', (_, data) => {
  return db.updateDispensation(data.id, data);
});

// ─────────────────────────────────────────────────────
// CASH OUTFLOWS (Sorties de caisse)
// ─────────────────────────────────────────────────────

ipcMain.handle('cashOutflows:create', (_, data) => {
  return db.createCashOutflow(data);
});

ipcMain.handle('cashOutflows:list', (_, filters) => {
  return db.listCashOutflows(filters || {});
});

ipcMain.handle('cashOutflows:total', (_, filters) => {
  return db.getCashOutflowTotal(filters || {});
});

ipcMain.handle('cashOutflows:delete', (_, id) => {
  return db.deleteCashOutflow(id);
});