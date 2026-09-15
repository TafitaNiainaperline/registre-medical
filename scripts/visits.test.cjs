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
      page.setForm({ ...page.form, patient, treatments: [{ name: `Act ${visit}`, item_type: 'act', quantity: 1, unit_price: 1000 }] })
      page = render()
      assert.equal(page.patientVisits.length, visit - 1)
      await Promise.all([page.submit({ preventDefault() {} }), page.submit({ preventDefault() {} })])
      page = render()
      assert.equal(page.records.length, 1)
      assert.equal(page.records[0].id, visit)
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
    page.setForm({ ...page.form, patient, treatments: [] })
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
    page.setForm({ ...page.form, patient, treatments: [] })
    await render('cpn').submit({ preventDefault() {} })
    assert.equal(render('cpn').needsTreatmentConfirmation, false)
    assert.equal(rows.length, 4)
    assert.match(render('cpn').actionError, /au moins un médicament/)
  } finally {
    delete global.window
  }
})
