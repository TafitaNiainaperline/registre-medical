import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import type { SaveDialogOptions, SaveDialogReturnValue } from 'electron'
import path from 'path'
import fs from 'fs'
import { buildCatalogueHtml, catalogueReport } from './catalogueExport'
import { saveExportWithRetry } from './exportFile'
import { monthlyDispensations } from './dispensationReport'
import type { DispensationPeriod } from './dispensationReport'
import * as db from './database'
import { buildReceiptHtml, buildDispensationReceiptHtml } from './receiptPdf'
import { printReceipt } from './receiptPrint'
import { prepareReceiptPage, RECEIPT_PAGE_WIDTH_MM } from './receiptLayout'
import type {
  ArchiveFilters,
  AuditFilters,
  CashOutflowInput,
  CategoryKey,
  ContinueRecordInput,
  DispensationInput,
  DispensationUpdateInput,
  MedicationInput,
  ItemType,
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

const sessions = new Map<number, number>()
let backupBusy = false

ipcMain.handle('auth:login', async (event, data: Parameters<typeof db.loginUser>[0]) => {
  sessions.delete(event.sender.id)
  const user = await db.loginUser(data)
  sessions.set(event.sender.id, user.id)
  return user
})

ipcMain.handle('auth:logout', (event) => { sessions.delete(event.sender.id) })

ipcMain.handle('auth:session', async (event) => {
  const id = sessions.get(event.sender.id)
  if (!id) return null
  const user = (await db.getAllUsers()).find((row) => row.id === id && row.is_active)
  return user ? { id: user.id, name: user.name, username: user.username, role: user.role } : null
})

ipcMain.handle('audit:list', async (event, filters?: AuditFilters) => {
  await db.assertBackupAdmin(sessions.get(event.sender.id) || 0)
  return db.listAudit(filters)
})

ipcMain.handle('backup:save', async (event): Promise<SaveResult> => {
  if (backupBusy) throw new Error('Une sauvegarde ou restauration est déjà en cours.')
  backupBusy = true
  try {
    await db.assertBackupAdmin(sessions.get(event.sender.id) || 0)
    const result = await showSaveDialog({ title: 'Sauvegarder toutes les données',
      defaultPath: `registre-medical-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'Sauvegarde Registre Médical', extensions: ['db'] }] })
    if (result.canceled || !result.filePath) return { canceled: true }
    await db.assertBackupAdmin(sessions.get(event.sender.id) || 0)
    await db.exportDatabase(result.filePath)
    return { canceled: false, filePath: result.filePath }
  } finally { backupBusy = false }
})

ipcMain.handle('backup:restore', async (event) => {
  if (backupBusy) throw new Error('Une sauvegarde ou restauration est déjà en cours.')
  backupBusy = true
  let candidate: Awaited<ReturnType<typeof db.readBackup>> | undefined
  try {
    await db.assertBackupAdmin(sessions.get(event.sender.id) || 0)
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = { title: 'Choisir une sauvegarde', properties: ['openFile'] as ['openFile'],
      filters: [{ name: 'Sauvegarde Registre Médical', extensions: ['db'] }] }
    const selection = await (win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options))
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true }
    candidate = await db.readBackup(selection.filePaths[0])
    const confirmation = { type: 'warning' as const, title: 'Restaurer la sauvegarde ?',
      message: 'Remplacer les données actuelles par cette sauvegarde ?',
      detail: `${selection.filePaths[0]}\n\nUne copie des données actuelles sera conservée automatiquement. Vous devrez vous reconnecter avec un compte de la sauvegarde.`,
      buttons: ['Annuler', 'Restaurer'], defaultId: 0, cancelId: 0, noLink: true }
    const answer = await (win ? dialog.showMessageBox(win, confirmation) : dialog.showMessageBox(confirmation))
    if (answer.response !== 1) return { canceled: true }
    await db.assertBackupAdmin(sessions.get(event.sender.id) || 0)
    const previousPath = await db.restoreDatabase(candidate)
    candidate = undefined
    sessions.clear()
    return { canceled: false, previousPath }
  } finally { candidate?.close(); backupBusy = false }
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

ipcMain.handle('records:clearAppointment', (event, id: number) => {
  return db.runAudited(sessions.get(event.sender.id) || 0, () => db.clearAppointment(id))
})

ipcMain.handle('records:stats', () => {
  return db.fetchStats()
})

ipcMain.handle('records:statsByArchive', (_e, filters: PeriodFilters) => {
  return db.fetchStatsByArchive(filters || {})
})

ipcMain.handle('records:create', (event, data: RecordInput) => {
  const actor = sessions.get(event.sender.id) || 0
  return db.runAudited(actor, () => db.createRecord({ ...data, created_by: actor }))
})

ipcMain.handle('records:continue', (event, id: number, data: ContinueRecordInput) => {
  const actor = sessions.get(event.sender.id) || 0
  return db.runAudited(actor, () => db.addTreatmentsToRecord(id, { ...data, created_by: actor }))
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

ipcMain.handle('records:update', (event, id: number, data: RecordUpdateInput) => {
  return db.runAudited(sessions.get(event.sender.id) || 0, () => db.updateRecord(id, data))
})

ipcMain.handle('records:delete', (event, id: number) => {
  return db.runAudited(sessions.get(event.sender.id) || 0, () => db.deleteRecord(id))
})

ipcMain.handle('records:backfillRegistry', async () => {
  return db.ensureRegistryNumbers()
})

ipcMain.handle('receipt:pdf', async (_e, id: number): Promise<SaveResult> => {
  const record = await db.fetchRecordById(id)
  if (!record) throw new Error('Dossier introuvable.')

  const safeNumber = String(record.registry_number || record.id).replace(/[^\w.-]+/g, '_')
  const defaultName = `recu_${safeNumber}_visite_${record.id}.pdf`
  return saveReceiptPdf(buildReceiptHtml(record), defaultName, 'Télécharger le reçu', true)
})

ipcMain.handle('patients:addresses', () => db.listPatientAddresses())

ipcMain.handle('receipt:print', async (event, id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Visite invalide.')
  const record = await db.fetchRecordById(id)
  if (!record) throw new Error('Dossier introuvable.')
  return printReceipt(buildReceiptHtml(record), BrowserWindow.fromWebContents(event.sender) || undefined)
})

ipcMain.handle('dispensations:print', async (event, id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Dispensation invalide.')
  const items = await db.getDispensationReceiptItems(id)
  return printReceipt(buildDispensationReceiptHtml(items), BrowserWindow.fromWebContents(event.sender) || undefined)
})

ipcMain.handle('dispensations:pdf', async (_e, id: number): Promise<SaveResult> => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Dispensation invalide.')
  const items = await db.getDispensationReceiptItems(id)
  return saveReceiptPdf(buildDispensationReceiptHtml(items), `facture_dispensation_${items[0].id}.pdf`, 'Télécharger la facture', true)
})

ipcMain.handle('dispensations:exportMonth', async (_e, period: DispensationPeriod): Promise<SaveResult> => {
  monthlyDispensations([], period)
  if (!exportExcel) throw new Error('Export Excel indisponible.')
  const rows = await db.getDispensations()
  const result = await showSaveDialog({
    title: 'Exporter les achats du mois',
    defaultPath: `achats_${period.year}-${String(period.month).padStart(2, '0')}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  const writer = exportExcel
  return saveExportWithRetry(result.filePath,
    (filePath) => writer.writeDispensationsExcel({ filePath, ...period, rows }), chooseExportDestination)
})

async function chooseExportDestination(lockedPath: string): Promise<string | null> {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title: 'Fichier indisponible',
    message: `Impossible d’écrire dans « ${path.basename(lockedPath)} ».`,
    detail: 'Le fichier peut être ouvert dans un lecteur PDF ou Excel, ou le dossier peut être protégé. Fermez le fichier puis réessayez, ou choisissez un autre nom ou dossier.',
    buttons: ['Enregistrer sous…', 'Réessayer', 'Annuler'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  })
  if (response === 2) return null
  if (response === 1) return lockedPath
  const { dir, name, ext } = path.parse(lockedPath)
  const result = await showSaveDialog({
    title: 'Enregistrer sous un autre nom',
    defaultPath: path.join(dir, `${name}_copie${ext}`),
    filters: [{ name: ext === '.pdf' ? 'PDF' : 'Excel', extensions: [ext.slice(1)] }],
  })
  return result.canceled || !result.filePath ? null : result.filePath
}

async function saveReceiptPdf(html: string, defaultName: string, title = 'Telecharger le recu', thermal = false): Promise<SaveResult> {
  const result = await showSaveDialog({
    title,
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
    await receiptWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const heightMm = thermal ? await prepareReceiptPage(receiptWindow) : 0
    const pdf = await receiptWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: thermal ? { width: RECEIPT_PAGE_WIDTH_MM / 25.4, height: heightMm / 25.4 } : 'A4',
      ...(thermal ? { margins: { top: 0, bottom: 0, left: 0, right: 0 }, scale: 1, displayHeaderFooter: false, preferCSSPageSize: true } : {}),
    })
    return await saveExportWithRetry(result.filePath,
      (destination) => fs.promises.writeFile(destination, pdf), chooseExportDestination)
  } finally {
    receiptWindow.destroy()
  }
}

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

ipcMain.handle('meds:create', (event, data: MedicationInput) => {
  const actor = sessions.get(event.sender.id) || 0
  return db.runAudited(actor, () => db.createMedication({ ...data, created_by: actor }))
})

ipcMain.handle('meds:update', (event, id: number, data: MedicationInput) => {
  return db.runAudited(sessions.get(event.sender.id) || 0, () => db.updateMedication(id, data))
})

ipcMain.handle('meds:history', () => {
  return db.getMedicationHistory()
})

ipcMain.handle('meds:addStock', (event, id: number, quantity: number, _createdBy: number | null, date?: string) => {
  const actor = sessions.get(event.sender.id) || 0
  return db.runAudited(actor, () => db.addMedicationStock(id, quantity, actor, date))
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

ipcMain.handle('stock:excel', async (_e, itemType: ItemType = 'medication') => {
  if (!exportExcel) {
    throw new Error('Dépendance Excel manquante. Installez "exceljs" puis relancez l’application.')
  }

  const report = catalogueReport(await db.getStockReport(), itemType)
  const result = await showSaveDialog({
    title: `Exporter — ${report.title}`,
    defaultPath: `${report.filename}.xlsx`,
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

  const writer = exportExcel
  const saved = await saveExportWithRetry(result.filePath,
    (destination) => writer.writeStockExcel({ filePath: destination, medications: report.rows, itemType }),
    chooseExportDestination)
  if (saved.canceled) return

  return {
    success: true as const
  }
})

ipcMain.handle('stock:pdf', async (_e, itemType: ItemType = 'medication') => {
  const report = catalogueReport(await db.getStockReport(), itemType)
  const result = await saveReceiptPdf(buildCatalogueHtml(report.rows, itemType), `${report.filename}.pdf`, `Exporter — ${report.title}`)
  if (result.canceled) return
  return { success: true as const }
})

// ─────────────────────────────────────────────────────
// DISPENSATIONS
// ─────────────────────────────────────────────────────

ipcMain.handle('dispensations:list', () => db.getDispensations())

ipcMain.handle('dispensations:total', (_e, filters: PeriodFilters) => db.getDispensationTotal(filters))

ipcMain.handle('dispensations:create', (event, data: DispensationInput | DispensationInput[]) => {
  return db.runAudited(sessions.get(event.sender.id) || 0, () => db.createDispensation(data))
})

ipcMain.handle('dispensations:delete', (event, id: number) => {
  return db.runAudited(sessions.get(event.sender.id) || 0, () => db.deleteDispensation(id))
})

ipcMain.handle('dispensations:update', (event, data: DispensationUpdateInput) => {
  return db.runAudited(sessions.get(event.sender.id) || 0, () => db.updateDispensation(data.id, data))
})

// ─────────────────────────────────────────────────────
// CASH OUTFLOWS (Sorties de caisse)
// ─────────────────────────────────────────────────────

ipcMain.handle('cashOutflows:create', (event, data: CashOutflowInput) => {
  const actor = sessions.get(event.sender.id) || 0
  return db.runAudited(actor, () => db.createCashOutflow({ ...data, created_by: actor }))
})

ipcMain.handle('cashOutflows:list', (_e, filters: PeriodFilters) => {
  return db.listCashOutflows(filters || {})
})

ipcMain.handle('cashOutflows:total', (_e, filters: PeriodFilters) => {
  return db.getCashOutflowTotal(filters || {})
})

ipcMain.handle('cashOutflows:delete', (event, id: number) => {
  return db.runAudited(sessions.get(event.sender.id) || 0, () => db.deleteCashOutflow(id))
})

ipcMain.handle('cashOutflows:update', (event, id: number, data: CashOutflowInput) => {
  return db.runAudited(sessions.get(event.sender.id) || 0, () => db.updateCashOutflow(id, data))
})
