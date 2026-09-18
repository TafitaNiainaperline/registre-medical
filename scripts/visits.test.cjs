const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

// Load the real TypeScript modules; database persistence stays in memory.
function loader(mocks = {}) {
  const cache = new Map()
  return function load(filename) {
    const file = path.resolve(filename)
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    const localRequire = (name) => {
      if (name in mocks) return mocks[name]
      return name.startsWith('.') ? load(path.resolve(path.dirname(file), `${name}.ts`)) : require(name)
    }
    new Function('require', 'module', 'exports', '__dirname', source)(localRequire, module, module.exports, path.dirname(file))
    return module.exports
  }
}

test('PF and CPN save female patient sex for dashboard records on creation and editing', async () => {
  const load = loader({
    electron: { app: { isPackaged: false, getPath: () => 'in-memory-test' } },
    fs: { ...fs, existsSync: () => false, writeFileSync: () => {}, renameSync: () => {} },
  })
  const db = load('electron/database.ts')
  for (const category of ['pf', 'cpn', 'consultation']) {
    const patient = await db.createPatient({ nom: `Patient ${category}`, domicile: 'Test', sexe: null })
    const input = { category, patient_id: patient.id, diagnostic: 'Suivi', treatments: [] }
    const id = await db.createRecord(input)
    const expected = category === 'consultation' ? null : 'F'
    assert.equal((await db.getPatientById(patient.id)).sexe, expected)
    assert.equal((await db.fetchRecordById(id)).sexe, expected)
    await db.updatePatient(patient.id, { nom: patient.nom, domicile: 'Test', sexe: 'M' })
    await db.updateRecord(id, input)
    assert.equal((await db.fetchRecordById(id)).sexe, category === 'consultation' ? 'M' : 'F')
    assert.equal((await db.fetchRecordById(id)).patient_id, patient.id)
  }
})

test('locked exports support another filename, retry, and cancellation without hiding other errors', async () => {
  const { saveExportWithRetry } = loader()('electron/exportFile.ts')
  for (const code of ['EBUSY', 'EACCES', 'EPERM']) {
    const written = []
    const result = await saveExportWithRetry('locked.pdf', async (destination) => {
      written.push(destination)
      if (destination === 'locked.pdf') throw Object.assign(new Error('locked'), { code })
    }, async (destination) => {
      assert.equal(destination, 'locked.pdf')
      return 'copy.pdf'
    })
    assert.deepEqual(written, ['locked.pdf', 'copy.pdf'])
    assert.deepEqual(result, { canceled: false, filePath: 'copy.pdf' })
  }
  const locked = Object.assign(new Error('locked'), { code: 'EBUSY' })
  assert.deepEqual(await saveExportWithRetry('locked.xlsx', async () => { throw locked }, async () => null), { canceled: true })
  let attempts = 0
  assert.deepEqual(await saveExportWithRetry('retry.pdf', async () => {
    if (++attempts === 1) throw locked
  }, async (destination) => destination), { canceled: false, filePath: 'retry.pdf' })
  assert.equal(attempts, 2)
  const diskFull = Object.assign(new Error('full'), { code: 'ENOSPC' })
  await assert.rejects(saveExportWithRetry('full.pdf', async () => { throw diskFull }, async () => {
    assert.fail('A full disk must not be presented as a locked file')
  }), { code: 'ENOSPC' })
})

test('catalogue PDF and Excel exports separate medications from acts, including legacy medications', async () => {
  const ExcelJS = require('exceljs')
  const workbooks = []
  class MemoryWorkbook extends ExcelJS.Workbook {
    constructor() {
      super()
      this.xlsx.writeFile = async () => { workbooks.push(await this.xlsx.writeBuffer()) }
    }
  }
  const load = loader({ exceljs: { ...ExcelJS, Workbook: MemoryWorkbook } })
  const { buildCatalogueHtml, catalogueReport } = load('electron/catalogueExport.ts')
  const { writeStockExcel } = load('electron/excelExport.ts')
  const rows = [
    { id: 1, name: 'Medicament A', item_type: 'medication', price: 1250, unit: 'boite', stock: 0, stock_threshold: 5 },
    { id: 2, name: 'Acte <B>', item_type: 'act', price: 5000, unit: null, stock: null },
    { id: 3, name: 'Ancien medicament', item_type: null, price: 20, stock: null },
  ]
  assert.deepEqual(catalogueReport(rows).rows.map((row) => row.id), [1, 3])
  assert.throws(() => catalogueReport(rows, 'all'), /invalide/)
  for (const itemType of ['medication', 'act']) {
    const isAct = itemType === 'act'
    const html = buildCatalogueHtml(rows, itemType)
    assert.equal(html.includes('Acte &lt;B&gt;'), isAct)
    assert.equal(html.includes('Medicament A'), !isAct)
    assert.equal(html.includes('>Stock</th>'), !isAct)
    assert.ok(!html.includes('>Seuil</th>'))
    assert.ok(!html.includes('Acte <B>'))
    assert.ok(html.includes('table-layout: fixed'))
    assert.ok(html.includes('<th class="right">Prix (Ar)</th>'))
    await writeStockExcel({ filePath: 'unused.xlsx', medications: rows, itemType })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(workbooks.at(-1))
    const sheet = workbook.worksheets[0]
    assert.deepEqual(sheet.getColumn(1).values.slice(2), isAct ? ['Acte <B>'] : ['Medicament A', 'Ancien medicament'])
    assert.equal(sheet.columnCount, isAct ? 2 : 4)
    assert.ok(!sheet.getRow(1).values.includes('Seuil'))
    assert.equal(sheet.getCell('B2').value, isAct ? 5000 : 1250)
    assert.equal(sheet.getCell('B1').alignment.horizontal, 'right')
    assert.equal(sheet.getCell('B2').alignment.horizontal, 'right')
    if (!isAct) {
      assert.equal(sheet.getCell('D2').value, 0)
      assert.equal(sheet.getCell('D3').value, 'Non suivi')
      assert.equal(sheet.getCell('C1').alignment.horizontal, 'center')
      assert.equal(sheet.getCell('C2').alignment.horizontal, 'center')
      assert.equal(sheet.getCell('D1').alignment.horizontal, 'center')
      assert.equal(sheet.getCell('D2').alignment.horizontal, 'center')
    }
  }
})

test('editing a medication never changes its stock or type, even for an administrator', async () => {
  const load = loader({
    electron: { app: { isPackaged: false, getPath: () => 'in-memory-test' } },
    fs: { ...fs, existsSync: () => false, writeFileSync: () => {} },
  })
  const db = load('electron/database.ts')
  const admin = await db.loginUser({ username: 'admin', password: 'admin123' })
  await db.runAudited(admin.id, () => db.createMedication({ name: 'Stock protégé', item_type: 'medication', stock: 20, price: 100 }))
  const medication = (await db.listMedications())[0]
  for (const stock of [999, 0, null, undefined]) {
    await db.runAudited(admin.id, () => db.updateMedication(medication.id, { name: medication.name, price: 200, stock, item_type: 'act' }))
    const updated = (await db.listMedications())[0]
    assert.equal(updated.stock, 20)
    assert.equal(updated.item_type, 'medication')
    assert.equal(updated.price, 200)
  }
  assert.ok((await db.listAudit({ entity: 'stock' })).filter((entry) => entry.action === 'update').every((entry) =>
    JSON.parse(entry.before_json).stock === JSON.parse(entry.after_json).stock))
  await db.runAudited(admin.id, () => db.addMedicationStock(medication.id, 5, admin.id))
  assert.equal((await db.listMedications())[0].stock, 25)
  await db.runAudited(admin.id, () => db.createDispensation({ medication_id: medication.id, quantity: 2 }))
  assert.equal((await db.listMedications())[0].stock, 23)
})

test('audit preserves authors and before/after values across visits, stock and expenses without logging rolled-back changes', async () => {
  const load = loader({
    electron: { app: { isPackaged: false, getPath: () => 'in-memory-test' } },
    fs: { ...fs, existsSync: () => false, writeFileSync: () => {}, renameSync: () => {} },
  })
  const db = load('electron/database.ts')
  const admin = await db.loginUser({ username: 'admin', password: 'admin123' })
  await db.registerUser({ username: 'agent', name: 'Agent caisse', password: 'agent123' })
  const agent = (await db.getAllUsers()).find((user) => user.username === 'agent')
  await db.toggleUserActive(agent.id, true)
  const patient = await db.createPatient({ nom: 'Patient audit', domicile: 'Test' })
  const input = { category: 'consultation', patient_id: patient.id, diagnostic: 'Avant',
    treatments: [{ name: 'Acte', item_type: 'act', quantity: 1, unit_price: 1000 }] }
  const id = await db.runAudited(admin.id, () => db.createRecord(input))
  await db.runAudited(agent.id, () => db.updateRecord(id, { ...input, diagnostic: 'Après' }))
  let entry = (await db.listAudit({ entity: 'visit' }))[0]
  assert.equal(entry.action, 'update')
  assert.equal(entry.actor_id, agent.id)
  assert.equal(entry.actor_name, 'Agent caisse')
  assert.equal(entry.entity_label, 'Patient audit')
  assert.equal(JSON.parse(entry.before_json).diagnostic, 'Avant')
  assert.equal(JSON.parse(entry.after_json).diagnostic, 'Après')
  await db.runAudited(admin.id, () => db.createMedication({ name: 'Médicament audit', item_type: 'medication', stock: 20, price: 100 }))
  const medication = (await db.listMedications())[0]
  await db.runAudited(agent.id, () => db.addMedicationStock(medication.id, 5, agent.id, '2026-09-17'))
  entry = (await db.listAudit({ entity: 'stock' }))[0]
  assert.equal(entry.actor_id, agent.id)
  assert.equal(JSON.parse(entry.before_json).stock, 20)
  assert.equal(JSON.parse(entry.after_json).stock, 25)
  await db.runAudited(agent.id, () => db.createDispensation({ medication_id: medication.id, quantity: 2 }))
  entry = (await db.listAudit({ entity: 'stock' }))[0]
  assert.equal(JSON.parse(entry.before_json).stock, 25)
  assert.equal(JSON.parse(entry.after_json).stock, 23)
  assert.equal(entry.actor_id, agent.id)
  const expense = { outflow_date: '2026-09-17', designation: 'Transport', amount: 100 }
  const expenseId = await db.runAudited(agent.id, () => db.createCashOutflow(expense))
  await db.runAudited(admin.id, () => db.updateCashOutflow(expenseId, { ...expense, amount: 200 }))
  entry = (await db.listAudit({ entity: 'expense' }))[0]
  assert.equal(entry.actor_id, admin.id)
  assert.equal(JSON.parse(entry.before_json).amount, 100)
  assert.equal(JSON.parse(entry.after_json).amount, 200)
  const changes = load('src/pages/AdminPage/auditChanges.ts').auditChanges(entry)
  assert.deepEqual(changes, [{ field: 'amount', label: 'Montant (Ar)', before: 100, after: 200 }])
  const beforeFailure = await db.listAudit()
  await assert.rejects(db.runAudited(agent.id, () => db.createRecord({ ...input,
    treatments: [{ name: medication.name, medication_id: medication.id, item_type: 'medication', quantity: 999, unit_price: 100 }] })), /Stock insuffisant/)
  assert.deepEqual(await db.listAudit(), beforeFailure)
  await db.runAudited(admin.id, () => db.updateCashOutflow(expenseId, { ...expense, amount: 200 }))
  assert.deepEqual(await db.listAudit(), beforeFailure)
  await db.runAudited(agent.id, () => db.deleteCashOutflow(expenseId))
  entry = (await db.listAudit({ entity: 'expense' }))[0]
  assert.equal(entry.action, 'delete')
  assert.equal(entry.after_json, null)
  assert.equal(JSON.parse(entry.before_json).amount, 200)
  await Promise.all([
    db.runAudited(admin.id, async () => { await Promise.resolve(); await db.createCashOutflow({ ...expense, designation: 'Admin' }) }),
    db.runAudited(agent.id, async () => { await Promise.resolve(); await db.createCashOutflow({ ...expense, designation: 'Agent' }) }),
  ])
  const expenses = await db.listAudit({ entity: 'expense' })
  assert.equal(expenses.find((item) => item.entity_label === 'Admin').actor_id, admin.id)
  assert.equal(expenses.find((item) => item.entity_label === 'Agent').actor_id, agent.id)
  assert.ok((await db.listAudit({ beforeId: expenses[0].id })).every((item) => item.id < expenses[0].id))
  await db.toggleUserActive(agent.id, false)
  await assert.rejects(db.runAudited(agent.id, () => db.updateRecord(id, input)), /reconnecter/)
  assert.equal(expenses.find((item) => item.entity_label === 'Agent').actor_name, 'Agent caisse')
  await db.exportDatabase('audit-export.db')
  await db.runAudited(admin.id, () => db.updateRecord(id, { ...input, diagnostic: 'Après export' }))
  assert.equal((await db.listAudit({ entity: 'visit' }))[0].actor_id, admin.id)
})

test('complete backups restore data, preserve the previous database and reject invalid files and failed writes', async () => {
  const os = require('node:os')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'registre-backup-test-'))
  let failRename = false
  const load = loader({
    electron: { app: { isPackaged: false, getPath: () => directory } },
    fs: { ...fs, renameSync: (...args) => {
      if (failRename) throw new Error('Simulated disk failure')
      return fs.renameSync(...args)
    } },
  })
  const db = load('electron/database.ts')
  let candidate
  try {
    const admin = await db.loginUser({ username: 'admin', password: 'admin123' })
    await db.assertBackupAdmin(admin.id)
    await assert.rejects(db.assertBackupAdmin(0), /administrateur/)
    await assert.rejects(db.assertBackupAdmin(999), /administrateur/)
    const patient = await db.createPatient({ nom: 'Patient sauvegardé', domicile: 'Test' })
    await db.createRecord({ category: 'consultation', patient_id: patient.id, diagnostic: 'Diagnostic',
      treatments: [{ name: 'Acte', item_type: 'act', quantity: 1, unit_price: 1000 }] })
    await db.createMedication({ name: 'Médicament', item_type: 'medication', stock: 20, price: 100, unit: 'comprimé' })
    const medication = (await db.listMedications())[0]
    await db.createDispensation({ medication_id: medication.id, quantity: 2 })
    await db.createCashOutflow({ outflow_date: '2026-09-16', designation: 'Dépense', amount: 50 })
    const backupPath = path.join(directory, 'sauvegarde.db')
    await db.exportDatabase(backupPath)
    await assert.rejects(db.exportDatabase(path.join(directory, 'registre-medical.db')), /autre emplacement/)
    const SQL = await require('sql.js')()
    const saved = new SQL.Database(fs.readFileSync(backupPath))
    const expected = saved.exec("SELECT name FROM sqlite_master WHERE type = 'table'")[0].values
      .map(([name]) => [name, saved.exec(`SELECT * FROM "${name}"`)])
    saved.close()
    const extra = await db.createPatient({ nom: 'Après sauvegarde', domicile: 'Test' })
    const invalidPath = path.join(directory, 'invalid.db')
    fs.writeFileSync(invalidPath, 'not a database')
    await assert.rejects(db.readBackup(invalidPath), /invalide/)
    const unrelated = new SQL.Database()
    unrelated.run('CREATE TABLE unrelated (id INTEGER)')
    fs.writeFileSync(invalidPath, unrelated.export())
    unrelated.close()
    await assert.rejects(db.readBackup(invalidPath), /invalide/)
    assert.ok(await db.getPatientById(extra.id))
    candidate = await db.readBackup(backupPath)
    const diskBefore = fs.readFileSync(path.join(directory, 'registre-medical.db'))
    const incompatible = new SQL.Database(fs.readFileSync(backupPath))
    incompatible.run('ALTER TABLE patients DROP COLUMN domicile')
    await assert.rejects(db.restoreDatabase(incompatible), /incompatible/)
    incompatible.close()
    assert.deepEqual(fs.readFileSync(path.join(directory, 'registre-medical.db')), diskBefore)
    failRename = true
    const backupBefore = fs.readFileSync(backupPath)
    await assert.rejects(db.exportDatabase(backupPath), /Simulated disk failure/)
    assert.deepEqual(fs.readFileSync(backupPath), backupBefore)
    await assert.rejects(db.restoreDatabase(candidate), /Simulated disk failure/)
    assert.deepEqual(fs.readFileSync(path.join(directory, 'registre-medical.db')), diskBefore)
    assert.ok(await db.getPatientById(extra.id))
    failRename = false
    const previousPath = await db.restoreDatabase(candidate)
    candidate = undefined
    const previous = new SQL.Database(fs.readFileSync(previousPath))
    assert.equal(previous.exec('SELECT COUNT(*) FROM patients')[0].values[0][0], 2)
    previous.close()
    assert.equal((await db.listPatients()).length, 1)
    await db.exportDatabase(path.join(directory, 'restored.db'))
    const restored = new SQL.Database(fs.readFileSync(path.join(directory, 'restored.db')))
    for (const [name, data] of expected) assert.deepEqual(restored.exec(`SELECT * FROM "${name}"`), data)
    restored.close()
    assert.equal((await db.loginUser({ username: 'admin', password: 'admin123' })).id, admin.id)
    const legacy = new SQL.Database(fs.readFileSync(backupPath))
    const auditTriggers = legacy.exec("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'audit_%'")[0]?.values || []
    for (const [name] of auditTriggers) legacy.run(`DROP TRIGGER "${name}"`)
    legacy.run('DROP TABLE audit_log')
    const legacyPath = path.join(directory, 'ancienne-sauvegarde.db')
    fs.writeFileSync(legacyPath, legacy.export())
    legacy.close()
    candidate = await db.readBackup(legacyPath)
    await db.restoreDatabase(candidate)
    candidate = undefined
    assert.equal((await db.listAudit()).length, 0)
    await db.runAudited(admin.id, () => db.createCashOutflow({ outflow_date: '2026-09-17', designation: 'Après migration', amount: 100 }))
    assert.equal((await db.listAudit({ entity: 'expense' }))[0].actor_id, admin.id)
    const reopened = loader({ electron: { app: { isPackaged: false, getPath: () => directory } } })('electron/database.ts')
    assert.equal((await reopened.listAudit({ entity: 'expense' }))[0].actor_id, admin.id)
    await reopened.runAudited(admin.id, () => reopened.createCashOutflow({ outflow_date: '2026-09-17', designation: 'Après redémarrage', amount: 100 }))
    assert.equal((await reopened.listAudit({ entity: 'expense' }))[0].entity_label, 'Après redémarrage')
  } finally {
    candidate?.close()
    assert.equal(path.dirname(directory), os.tmpdir())
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('archives group visits without mixing patients, registers or periods and retain every amount', () => {
  const { groupArchiveVisits } = loader()('src/pages/ArchivesPage/groupArchiveVisits.ts')
  const first = { id: 1, patient_id: 1, category: 'consultation', registry_number: 'CONS-001', archive_year: 2026, archive_month: 9, created_at: '2026-09-01', cost: 1000 }
  const latest = { ...first, id: 2, created_at: '2026-09-02', cost: 2000 }
  const others = [{ ...first, id: 3, patient_id: 2 }, { ...first, id: 4, category: 'soin' }, { ...first, id: 5, archive_month: 8 }]
  for (const rows of [[first, latest, ...others], [...others, latest, first]]) {
    const groups = groupArchiveVisits(rows)
    assert.equal(groups.length, 4)
    const group = groups.find((item) => item.latest.id === 2)
    assert.deepEqual(group.visits.map((item) => item.id), [2, 1])
    assert.equal(group.total, 3000)
    assert.equal(groups.reduce((sum, item) => sum + item.total, 0), 6000)
  }
  assert.equal(groupArchiveVisits([{ ...first, patient_id: null }, { ...latest, patient_id: null }]).length, 2)
})

test('capitalization changes only the first letter and preserves typing spaces and acronyms', () => {
  const { capitalize } = loader()('src/utils/text.ts')
  assert.equal(capitalize('paludisme simple'), 'Paludisme simple')
  assert.equal(capitalize('test VIH positif'), 'Test VIH positif')
  assert.equal(capitalize('  état stable  ', true), 'État stable  ')
  assert.equal(capitalize('  état stable  '), 'État stable')
  assert.equal(capitalize(''), '')
})

test('all registers reject missing or blank diagnoses when creating and updating visits', async () => {
  const load = loader({
    electron: { app: { isPackaged: false, getPath: () => 'in-memory-test' } },
    fs: { ...fs, existsSync: () => false, writeFileSync: () => {} },
  })
  const db = load('electron/database.ts')
  const patient = await db.createPatient({ nom: 'Patient', domicile: 'Test' })
  for (const category of ['consultation', 'cpn', 'pf', 'analyse', 'soin']) {
    const input = { category, patient_id: patient.id,
      treatments: [{ name: 'Acte', item_type: 'act', quantity: 1, unit_price: 1000 }] }
    const id = await db.createRecord({ ...input, diagnostic: 'Diagnostic' })
    for (const diagnostic of [undefined, '', '   ']) {
      await assert.rejects(db.createRecord({ ...input, diagnostic }), /Le diagnostic est requis/)
      await assert.rejects(db.updateRecord(id, { ...input, diagnostic }), /Le diagnostic est requis/)
    }
    assert.equal((await db.fetchRecordById(id)).diagnostic, 'Diagnostic')
  }
  assert.equal((await db.fetchRecordsByPatient(patient.id)).length, 5)
})

test('three visits retain separate rows, amounts and receipt contents', async () => {
  const load = loader({
    electron: { app: { isPackaged: false, getPath: () => 'in-memory-test' } },
    fs: { ...fs, existsSync: () => false, writeFileSync: () => {} },
  })
  const db = load('electron/database.ts')
  const { buildReceiptHtml } = load('electron/receiptPdf.ts')
  const patient = await db.createPatient({ nom: 'Patient A', domicile: 'Test', birth_date: '1990-01-01' })
  const ids = []
  for (let visit = 1; visit <= 3; visit++) {
    ids.push(await db.createRecord({
      category: 'consultation', patient_id: patient.id, diagnostic: `Diagnostic ${visit}`,
      archive_year: 2026, archive_month: 9,
      treatments: [{ name: `Acte visite ${visit}`, item_type: 'act', quantity: 1, unit_price: visit * 1000 }],
    }))
  }
  assert.equal(new Set(ids).size, 3)
  const rows = await db.fetchRecordsByArchive({ category: 'consultation', year: 2026, month: 9 })
  assert.equal(rows.length, 3)
  assert.equal(new Set(rows.map((row) => row.registry_number)).size, 1)
  assert.equal((await db.fetchRecordsByPatient(patient.id)).length, 3)
  for (let index = 0; index < ids.length; index++) {
    const record = await db.fetchRecordById(ids[index])
    assert.equal(record.cost, (index + 1) * 1000)
    const html = buildReceiptHtml(record)
    assert.ok(html.includes(`Acte visite ${index + 1}`))
    assert.ok(!html.includes('N° reçu / Saisie'))
    assert.ok(!html.includes('N° registre'))
    assert.ok(!html.includes(record.registry_number))
    for (let other = 1; other <= 3; other++) {
      if (other !== index + 1) assert.ok(!html.includes(`Acte visite ${other}`))
    }
  }
})

test('grouping keeps patients and periods distinct and selects the latest visit deterministically', () => {
  const { mergeRecords } = loader()('src/utils/record.ts')
  const first = { id: 1, patient_id: 1, patient_nom: 'Patient A', category: 'consultation', archive_year: 2026,
    archive_month: 9, created_at: '2026-09-15 10:00:00', cost: 1000, treatments: [{ name: 'Initial' }] }
  const latest = { ...first, id: 2, cost: 2000, treatments: [{ name: 'Latest' }] }
  const otherPatient = { ...first, id: 3, patient_id: 2 }
  const otherMonth = { ...first, id: 4, archive_month: 8 }
  const otherRegister = { ...first, id: 5, category: 'cpn' }
  for (const visits of [[first, latest], [latest, first]]) {
    const grouped = mergeRecords([...visits, otherPatient, otherMonth, otherRegister])
    assert.equal(grouped.length, 4)
    assert.ok(!grouped.some((row) => row.id === first.id))
    const selected = grouped.find((row) => row.id === latest.id)
    assert.equal(selected.cost, 2000)
    assert.deepEqual(selected.treatments, [{ name: 'Latest' }])
  }
})

test('PF counters follow the latest monthly list rows and merge product spacing variants', () => {
  const { mergeRecords, summarizePfRecords, pfProductKey } = loader()('src/utils/record.ts')
  const first = { id: 1, patient_id: 1, patient_nom: 'Patient A', category: 'pf', archive_year: 2026,
    archive_month: 9, created_at: '2026-09-01 10:00:00', pf_method: 'Sayna Press', treatments: [] }
  const second = { ...first, id: 2, created_at: '2026-09-02 10:00:00', pf_method: 'SaynaPress' }
  const latest = { ...first, id: 3, created_at: '2026-09-03 10:00:00', pf_method: 'Pilule' }
  assert.deepEqual(summarizePfRecords(mergeRecords([first, second, latest])), [['Pilule', 1]])

  const otherPatient = { ...first, id: 4, patient_id: 2, pf_method: 'SaynaPress' }
  const thirdPatient = { ...first, id: 5, patient_id: 3, pf_method: ' Sayna  Press ' }
  const otherMonth = { ...latest, id: 6, archive_month: 8 }
  const emptyProduct = { ...first, id: 7, patient_id: 4, pf_method: null }
  const otherRegistry = { ...first, id: 8, category: 'cpn' }
  const visits = [first, second, latest, otherPatient, thirdPatient, otherMonth, emptyProduct, otherRegistry]
  const annualSummary = summarizePfRecords(mergeRecords(visits))
  assert.deepEqual(annualSummary, [['Pilule', 2], ['Sayna Press', 2]])
  assert.deepEqual(summarizePfRecords(mergeRecords([...visits].reverse())), annualSummary)
  assert.deepEqual(summarizePfRecords(mergeRecords(visits.filter((row) => row.archive_month === 9))), [['Pilule', 1], ['Sayna Press', 2]])
  assert.equal(pfProductKey(' Sayna Press '), pfProductKey('saynapress'))
  assert.deepEqual(summarizePfRecords([]), [])
})

test('dashboard PF uses the registry period instead of adding the whole year', async () => {
  const load = loader()
  const { loadPfRegistrySummary, rememberPfPeriod } = load('src/utils/pfRegistry.ts')
  const { mergeRecords, summarizePfRecords } = load('src/utils/record.ts')
  const rows = [
    { id: 1, patient_id: 1, category: 'pf', archive_year: 2026, archive_month: 9, pf_method: 'Sayna Press' },
    { id: 2, patient_id: 2, category: 'pf', archive_year: 2026, archive_month: 8, pf_method: 'Sayna Press' },
    { id: 3, patient_id: 3, category: 'pf', archive_year: 2026, archive_month: 8, pf_method: 'Pilule' },
  ]
  const previousWindow = global.window
  const requests = []
  global.window = { api: {
    getCurrentArchive: async () => ({ year: 2026, month: 9 }),
    fetchRecordsByArchive: async (period) => {
      requests.push(period)
      return rows.filter((row) => row.category === period.category && row.archive_year === period.year
        && (!period.month || row.archive_month === period.month))
    },
  } }
  try {
    const initial = await loadPfRegistrySummary()
    assert.deepEqual(initial.entries, [['Sayna Press', 1]])
    assert.equal(initial.label, 'septembre 2026')
    assert.deepEqual(requests[0], { year: 2026, month: 9, category: 'pf' })
    assert.deepEqual(initial.entries, summarizePfRecords(mergeRecords(rows.filter((row) => row.archive_month === 9))))

    rememberPfPeriod({ year: 2026, month: 8 })
    const archived = await loadPfRegistrySummary()
    assert.deepEqual(archived.entries, [['Pilule', 1], ['Sayna Press', 1]])
    assert.equal(archived.label, 'août 2026')

    rememberPfPeriod({ year: 2025, month: 9 })
    assert.deepEqual((await loadPfRegistrySummary()).entries, [])

    rememberPfPeriod({ year: 2026 })
    assert.deepEqual((await loadPfRegistrySummary()).entries, [['Pilule', 1], ['Sayna Press', 2]])
  } finally {
    global.window = previousWindow
  }
})

test('dashboard CPN matches registry counters and keeps its period separate from PF', async () => {
  const load = loader()
  const { loadCpnRegistrySummary, rememberCpnPeriod } = load('src/utils/cpnRegistry.ts')
  const { rememberPfPeriod } = load('src/utils/pfRegistry.ts')
  const { summarizeCpnRecords } = load('src/utils/record.ts')
  const rows = [
    { id: 1, patient_id: 1, category: 'cpn', archive_year: 2026, archive_month: 9, cpn_type: 'CPN1' },
    { id: 2, patient_id: 1, category: 'cpn', archive_year: 2026, archive_month: 9, cpn_type: ' cpn1 ' },
    { id: 3, patient_id: 1, category: 'cpn', archive_year: 2026, archive_month: 9, cpn_type: 'CPN2' },
    { id: 4, patient_id: 2, category: 'cpn', archive_year: 2026, archive_month: 8, cpn_type: 'CPN3' },
    { id: 5, patient_id: 3, category: 'cpn', archive_year: 2026, archive_month: 9, cpn_type: null },
    { id: 6, patient_id: 4, category: 'pf', archive_year: 2026, archive_month: 9, cpn_type: 'CPN4' },
  ]
  const previousWindow = global.window
  global.window = { api: {
    getCurrentArchive: async () => ({ year: 2026, month: 9 }),
    fetchRecordsByArchive: async (period) => rows.filter((row) => row.category === period.category
      && row.archive_year === period.year && (!period.month || row.archive_month === period.month)),
  } }
  try {
    rememberPfPeriod({ year: 2026, month: 8 })
    const initial = await loadCpnRegistrySummary()
    assert.equal(initial.label, 'septembre 2026')
    assert.deepEqual(initial.entries, [['CPN1', 2], ['CPN2', 1], ['CPN3', 0], ['CPN4', 0], ['CPN5', 0]])
    assert.deepEqual(initial.entries, summarizeCpnRecords(rows.filter((row) => row.archive_month === 9)))
    rememberCpnPeriod({ year: 2026, month: 8 })
    const archived = await loadCpnRegistrySummary()
    assert.equal(archived.label, 'août 2026')
    assert.deepEqual(archived.entries, [['CPN1', 0], ['CPN2', 0], ['CPN3', 1], ['CPN4', 0], ['CPN5', 0]])
    rememberCpnPeriod({ year: 2025, month: 9 })
    assert.ok((await loadCpnRegistrySummary()).entries.every(([, count]) => count === 0))
  } finally {
    global.window = previousWindow
  }
})

test('monthly dashboard filters registers, dispensation counts and financial totals to one month', async () => {
  const load = loader()
  const { loadDashboardMonth } = load('src/pages/DashboardPage/loadDashboardMonth.ts')
  const { mergeRecords, summarizePfRecords, summarizeCpnRecords } = load('src/utils/record.ts')
  const records = [
    { id: 1, patient_id: 1, category: 'pf', archive_year: 2026, archive_month: 9, pf_method: 'Sayna Press', cost: 100 },
    { id: 2, patient_id: 2, category: 'pf', archive_year: 2026, archive_month: 8, pf_method: 'Pilule', cost: 200 },
    { id: 3, patient_id: 3, category: 'cpn', archive_year: 2026, archive_month: 9, cpn_type: 'CPN1', cost: 300 },
    { id: 4, patient_id: 3, category: 'cpn', archive_year: 2025, archive_month: 9, cpn_type: 'CPN2', cost: 400 },
  ]
  const dispensations = [
    { created_at: '2026-09-01 00:00:00', quantity: 2, unit_price: 50 },
    { created_at: '2026-09-30 23:59:59', quantity: 1, unit_price: 100 },
    { created_at: '2026-08-31 23:59:59', quantity: 1, unit_price: 500 },
    { created_at: '2026-10-01 00:00:00', quantity: 1, unit_price: 600 },
    { created_at: '2025-09-15 10:00:00', quantity: 1, unit_price: 700 },
  ]
  const monthKey = ({ year, month }) => `${year}-${String(month).padStart(2, '0')}`
  const previousWindow = global.window
  const requests = []
  global.window = { api: {
    fetchRecordsByArchive: async (period) => {
      requests.push(['records', period])
      return records.filter((row) => row.archive_year === period.year && row.archive_month === period.month)
    },
    getDispensations: async () => dispensations,
    getDispensationTotal: async (period) => {
      requests.push(['dispensations', period])
      return dispensations.filter((row) => row.created_at.startsWith(monthKey(period)))
        .reduce((total, row) => total + row.quantity * row.unit_price, 0)
    },
    getCashOutflowTotal: async (period) => {
      requests.push(['outflows', period])
      return monthKey(period) === '2026-09' ? 50 : 0
    },
  } }
  try {
    const september = await loadDashboardMonth({ year: 2026, month: 9 })
    assert.deepEqual(september.records.map((row) => row.id), [1, 3])
    assert.deepEqual(september.dispensations, { count: 2, total: 200 })
    assert.equal(september.cashOutflowTotal, 50)
    assert.equal(september.records.reduce((total, row) => total + row.cost, 0)
      + september.dispensations.total - september.cashOutflowTotal, 550)
    assert.deepEqual(summarizePfRecords(mergeRecords(september.records)), [['Sayna Press', 1]])
    assert.equal(summarizeCpnRecords(september.records).find(([label]) => label === 'CPN2')[1], 0)
    assert.ok(requests.every(([, period]) => period.year === 2026 && period.month === 9))
    const august = await loadDashboardMonth({ year: 2026, month: 8 })
    assert.deepEqual(august.records.map((row) => row.id), [2])
    assert.deepEqual(august.dispensations, { count: 1, total: 500 })
    assert.deepEqual(await loadDashboardMonth({ year: 2026, month: 7 }), {
      records: [], dispensations: { count: 0, total: 0 }, cashOutflowTotal: 0,
    })
  } finally {
    global.window = previousWindow
  }
})

test('list groups three visits while history exposes each separate receipt', async () => {
  const state = []
  let cursor = 0
  const rows = []
  const receipts = []
  const react = {
    useState(initial) {
      const slot = cursor++
      if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial
      return [state[slot], (value) => { state[slot] = typeof value === 'function' ? value(state[slot]) : value }]
    },
    useRef(initial) { return this.useState({ current: initial })[0] },
    useMemo: (fn) => fn(),
    useEffect: () => {},
  }
  react.useRef = (initial) => react.useState({ current: initial })[0]
  const load = loader({ react })
  const { useRecordsPage } = load('src/pages/RecordsPage/useRecordsPage.ts')
  const notifications = load('src/utils/notifications.ts')
  const now = new Date()
  const patient = { id: 1, nom: 'Patient A', domicile: 'Test' }
  global.window = { confirm: () => { assert.fail('Native confirmation must not be used') }, api: {
    createRecord: async (data) => {
      const id = rows.length + 1
      rows.push({ ...data, id, registry_number: 'CONS-2026-001', archive_year: now.getFullYear(), archive_month: now.getMonth() + 1 })
      return id
    },
    fetchRecordsByArchive: async () => rows,
    fetchRecordsByPatient: async () => [...rows].reverse(),
    exportReceiptPdf: async (id) => {
      receipts.push(id)
      return { canceled: id === 2, filePath: 'receipt.pdf' }
    },
  } }
  const render = (key = 'consultation') => { cursor = 0; return useRecordsPage({ key }) }
  try {
    let page = render()
    for (let visit = 1; visit <= 3; visit++) {
      page.setForm({ ...page.form, patient, diagnostic: `diagnostic ${visit}`, observation: 'observation', reference: 'reference', treatments: [{ name: `Act ${visit}`, item_type: 'act', quantity: 1, unit_price: 1000 }] })
      page = render()
      assert.equal(page.patientVisits.length, visit - 1)
      const pending = page.submit({ preventDefault() {} })
      await page.submit({ preventDefault() {} })
      assert.equal(rows.length, visit - 1)
      assert.ok(notifications.getConfirmation())
      await notifications.acceptConfirmation()
      await pending
      page = render()
      assert.equal(page.records.length, 1)
      assert.equal(page.records[0].id, visit)
      assert.equal(page.records[0].diagnostic, `Diagnostic ${visit}`)
      assert.equal(page.records[0].observation, 'Observation')
      assert.equal(page.records[0].reference, 'Reference')
      for (const key of ['consultation', 'cpn', 'pf', 'analyse', 'soin']) {
        assert.ok(render(key).diagnosticOptions.includes(`Diagnostic ${visit}`))
      }
      assert.equal(page.saving, false)
      assert.equal(page.activeTab, 'liste')
      assert.deepEqual(receipts, [])
    }
    assert.equal(page.actionError, '')
    assert.equal(page.records[0].treatments[0].name, 'Act 3')
    assert.equal(page.records[0].treatments.length, 1)
    await page.viewHistory(page.records[0])
    page = render()
    assert.deepEqual(page.dossierHistory.map((row) => row.id), [1, 2, 3])
    await page.downloadReceipt(page.dossierHistory[2])
    await page.downloadReceipt(page.dossierHistory[0])
    await page.downloadReceipt(page.dossierHistory[1])
    assert.deepEqual(receipts, [3, 1, 2])
    assert.equal(render().records.length, 1)
    assert.equal(rows.length, 3)
    assert.equal(render().needsTreatmentConfirmation, false)

    page = render()
    page.setForm({ ...page.form, patient, diagnostic: 'Diagnostic', treatments: [] })
    page = render()
    await page.submit({ preventDefault() {} })
    assert.equal(render().needsTreatmentConfirmation, true)
    assert.equal(rows.length, 3)
    assert.equal(render().form.patient.id, patient.id)
    assert.equal(render().saving, false)

    render().dismissTreatmentConfirmation()
    assert.equal(render().needsTreatmentConfirmation, false)
    await render().confirmWithoutTreatment()
    assert.equal(rows.length, 3)

    await render().submit({ preventDefault() {} })
    page = render()
    page.setForm({ ...page.form, observation: 'Updated before confirmation' })
    assert.equal(render().needsTreatmentConfirmation, false)
    await render().confirmWithoutTreatment()
    assert.equal(rows.length, 3)
    await render().submit({ preventDefault() {} })
    page = render()
    await Promise.all([page.confirmWithoutTreatment(), page.confirmWithoutTreatment()])
    assert.equal(render().needsTreatmentConfirmation, false)
    assert.equal(rows.length, 4)
    assert.deepEqual(rows[3].treatments, [])
    assert.equal(rows[3].cost, 0)

    page = render('cpn')
    page.setForm({ ...page.form, patient, diagnostic: 'Diagnostic', treatments: [] })
    await render('cpn').submit({ preventDefault() {} })
    assert.equal(render('cpn').needsTreatmentConfirmation, false)
    assert.equal(rows.length, 4)
    assert.match(render('cpn').actionError, /au moins un médicament/)
  } finally {
    delete global.window
  }
})
