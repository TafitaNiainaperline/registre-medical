import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import type { SaveDialogOptions, SaveDialogReturnValue } from 'electron'
import path from 'path'
import fs from 'fs'
import PDFDocument from 'pdfkit'
import * as db from './database'
import { buildReceiptHtml } from './receiptPdf'
import type {
  ArchiveFilters,
  CashOutflowInput,
  CategoryKey,
  ContinueRecordInput,
  DispensationInput,
  DispensationUpdateInput,
  MedicationInput,
  PatientInput,
  PeriodFilters,
  RecordInput,
  RecordUpdateInput,
  SaveResult,
} from './types'

type ExcelExportModule = typeof import('./excelExport')

// exceljs est optionnel : l'application reste utilisable sans l'export Excel
let exportExcel: ExcelExportModule | null = null
try {
  exportExcel = require('./excelExport') as ExcelExportModule
} catch {
  exportExcel = null
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },

    title: 'Registre Médical',
  })

  // Debug crash renderer
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer crash:', details)
  })

  // DEV
  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173')
  }

  // PROD
  else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// Boîte d'enregistrement rattachée à la fenêtre active lorsqu'il y en a une
function showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogReturnValue> {
  const win = BrowserWindow.getFocusedWindow()
  return win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})


// ─────────────────────────────
// AUTH
// ─────────────────────────────

ipcMain.handle('auth:login', (_e, data: Parameters<typeof db.loginUser>[0]) => {
  return db.loginUser(data)
})

ipcMain.handle('auth:register', (_e, data: Parameters<typeof db.registerUser>[0]) => {
  return db.registerUser(data)
})


// ─────────────────────────────
// USERS
// ─────────────────────────────

ipcMain.handle('users:all', () => {
  return db.getAllUsers()
})

ipcMain.handle('users:toggle', (_e, id: number, active: boolean) => {
  return db.toggleUserActive(id, active)
})

ipcMain.handle('users:resetPwd', (_e, id: number, pwd: string) => {
  return db.resetUserPassword(id, pwd)
})

ipcMain.handle('users:delete', (_e, id: number) => {
  return db.deleteUser(id)
})


// ─────────────────────────────
// RECORDS
// ─────────────────────────────

ipcMain.handle('records:fetch', (_e, category: CategoryKey) => {
  return db.fetchRecords(category)
})

ipcMain.handle('records:fetchByArchive', (_e, filters: ArchiveFilters) => {
  return db.fetchRecordsByArchive(filters || {})
})

ipcMain.handle('records:appointments', () => {
  return db.fetchAppointments()
})

ipcMain.handle('records:clearAppointment', (_e, id: number) => {
  return db.clearAppointment(id)
})

ipcMain.handle('records:stats', () => {
  return db.fetchStats()
})

ipcMain.handle('records:statsByArchive', (_e, filters: PeriodFilters) => {
  return db.fetchStatsByArchive(filters || {})
})

ipcMain.handle('records:create', (_e, data: RecordInput) => {
  return db.createRecord(data)
})

ipcMain.handle('records:continue', (_e, id: number, data: ContinueRecordInput) => {
  return db.addTreatmentsToRecord(id, data)
})

ipcMain.handle('records:fetchByDossier', async (_e, dossierId: number) => {
  return db.fetchRecordsByDossier(dossierId)
})

ipcMain.handle('dossiers:list', (_e, search: string) => {
  return db.listDossiers(search || '')
})

ipcMain.handle('dossiers:get', (_e, id: number) => {
  return db.getDossierById(id)
})

// ─────────────────────────────
// PATIENTS
// ─────────────────────────────

ipcMain.handle('patients:list', (_e, search: string) => {
  return db.listPatients(search || '')
})

ipcMain.handle('patients:get', (_e, id: number) => {
  return db.getPatientById(id)
})

ipcMain.handle('patients:records', (_e, patientId: number) => {
  return db.fetchRecordsByPatient(patientId)
})

ipcMain.handle('patients:create', (_e, data: PatientInput) => {
  return db.createPatient(data)
})

ipcMain.handle('patients:update', (_e, id: number, data: PatientInput) => {
  return db.updatePatient(id, data)
})

ipcMain.handle('patients:suggest', (_e, nom: string, domicile?: string) => {
  return db.searchSimilarPatients(nom, domicile)
})

ipcMain.handle('patients:addressLog', (_e, patientId: number) => {
  return db.getPatientAddressLog(patientId)
})

ipcMain.handle('records:update', (_e, id: number, data: RecordUpdateInput) => {
  return db.updateRecord(id, data)
})

ipcMain.handle('records:delete', (_e, id: number) => {
  return db.deleteRecord(id)
})

ipcMain.handle('records:backfillRegistry', async () => {
  return db.ensureRegistryNumbers()
})

ipcMain.handle('receipt:pdf', async (_e, id: number): Promise<SaveResult> => {
  const record = await db.fetchRecordById(id)
  if (!record) throw new Error('Dossier introuvable.')

  const safeNumber = String(record.registry_number || record.id).replace(/[^\w.-]+/g, '_')
  const defaultName = `recu_${safeNumber}.pdf`
  const result = await showSaveDialog({
    title: 'Telecharger le recu',
    defaultPath: defaultName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }

  const receiptWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  try {
    const html = buildReceiptHtml(record)
    await receiptWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdf = await receiptWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
    })
    fs.writeFileSync(result.filePath, pdf)
    return { canceled: false, filePath: result.filePath }
  } finally {
    receiptWindow.destroy()
  }
})

// ─────────────────────────────────────────────────────
// ARCHIVES
ipcMain.handle('archives:list', () => {
  return db.listArchives()
})

ipcMain.handle('archives:current', () => {
  return db.getCurrentArchive()
})

// ─────────────────────────────────────────────────────
// MEDICATIONS
ipcMain.handle('meds:list', () => {
  return db.listMedications()
})

ipcMain.handle('meds:create', (_e, data: MedicationInput) => {
  return db.createMedication(data)
})

ipcMain.handle('meds:update', (_e, id: number, data: MedicationInput) => {
  return db.updateMedication(id, data)
})

ipcMain.handle('meds:history', () => {
  return db.getMedicationHistory()
})

ipcMain.handle('meds:addStock', (_e, id: number, quantity: number, createdBy: number | null, date?: string) => {
  return db.addMedicationStock(id, quantity, createdBy, date)
})

ipcMain.handle('meds:movements', () => {
  return db.getMedicationMovements()
})

ipcMain.handle('meds:stockHistory', (_e, medicationId: number) => {
  return db.getMedicationStockHistory(medicationId)
})

ipcMain.handle('meds:clearMovements', () => {
  return db.clearMedicationMovements()
})

ipcMain.handle('meds:topSelling', () => {
  return db.getTopSellingMedications()
})

ipcMain.handle('meds:lowStock', () => {
  return db.getLowStockMedications(10)
})

ipcMain.handle('meds:stockReport', () => {
  return db.getStockReport()
})

// ─────────────────────────────────────────────────────
// EXPORT EXCEL
ipcMain.handle('export:excelByArchive', async (_e, filters: ArchiveFilters): Promise<SaveResult> => {
  if (!exportExcel) {
    throw new Error('Dépendance Excel manquante. Installez "exceljs" puis relancez l’application.')
  }
  const { year, month } = filters || {}
  if (!year || !month) throw new Error('Mois/année requis pour l’export.')

  const defaultName = `registre_${year}-${String(month).padStart(2, '0')}.xlsx`
  const result = await showSaveDialog({
    title: 'Exporter en Excel',
    defaultPath: defaultName,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }

  const rows = await db.fetchRecordsByArchive(filters)
  await exportExcel.writeArchiveExcel({
    filePath: result.filePath,
    year,
    month,
    records: rows || [],
  })
  return { canceled: false, filePath: result.filePath }
})

ipcMain.handle('stock:excel', async () => {
  if (!exportExcel) {
    throw new Error('Dépendance Excel manquante. Installez "exceljs" puis relancez l’application.')
  }

  const result = await showSaveDialog({
    title: 'Exporter Stock',
    defaultPath: 'stock.xlsx',
    filters: [
      {
        name: 'Excel',
        extensions: ['xlsx']
      }
    ]
  })

  if (result.canceled || !result.filePath) {
    return
  }

  const meds = await db.getStockReport()

  await exportExcel.writeStockExcel({
    filePath: result.filePath,
    medications: meds
  })

  return {
    success: true as const
  }
})

ipcMain.handle('stock:pdf', async () => {

  const result = await showSaveDialog({
    title: 'Exporter PDF',
    defaultPath: 'stock.pdf',
    filters: [
      {
        name: 'PDF',
        extensions: ['pdf']
      }
    ]
  })

  if (result.canceled || !result.filePath) {
    return
  }

  const meds = await db.getStockReport()

  const doc = new PDFDocument()

  doc.pipe(fs.createWriteStream(result.filePath))

  doc.fontSize(18).text('Rapport du stock')

  doc.moveDown()

  meds.forEach((m) => {

    doc.text(
      `${m.name} | Stock : ${m.stock ?? '-'} | Prix : ${m.price} Ar`
    )

  })

  doc.end()

  return {
    success: true as const
  }
})

// ─────────────────────────────────────────────────────
// DISPENSATIONS
// ─────────────────────────────────────────────────────

ipcMain.handle('dispensations:list', () => db.getDispensations())

ipcMain.handle('dispensations:total', (_e, filters: PeriodFilters) => db.getDispensationTotal(filters))

ipcMain.handle('dispensations:create', (_e, data: DispensationInput) => {
  return db.createDispensation(data)
})

ipcMain.handle('dispensations:delete', (_e, id: number) => {
  return db.deleteDispensation(id)
})

ipcMain.handle('dispensations:update', (_e, data: DispensationUpdateInput) => {
  return db.updateDispensation(data.id, data)
})

// ─────────────────────────────────────────────────────
// CASH OUTFLOWS (Sorties de caisse)
// ─────────────────────────────────────────────────────

ipcMain.handle('cashOutflows:create', (_e, data: CashOutflowInput) => {
  return db.createCashOutflow(data)
})

ipcMain.handle('cashOutflows:list', (_e, filters: PeriodFilters) => {
  return db.listCashOutflows(filters || {})
})

ipcMain.handle('cashOutflows:total', (_e, filters: PeriodFilters) => {
  return db.getCashOutflowTotal(filters || {})
})

ipcMain.handle('cashOutflows:delete', (_e, id: number) => {
  return db.deleteCashOutflow(id)
})

ipcMain.handle('cashOutflows:update', (_e, id: number, data: CashOutflowInput) => {
  return db.updateCashOutflow(id, data)
})
