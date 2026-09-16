const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

function load(filename) {
  const file = path.resolve(filename)
  const module = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  new Function('require', 'module', 'exports', source)(
    (name) => load(path.resolve(path.dirname(file), `${name}.ts`)), module, module.exports,
  )
  return module.exports
}

const options = { title: 'Supprimer ?', message: 'Action définitive.', danger: true }

test('opening and cancelling a confirmation never executes its action', async () => {
  const api = load('src/utils/notifications.ts')
  let writes = 0
  const pending = api.confirmAction(options, () => { writes++ })
  assert.equal(writes, 0)
  assert.equal(api.getConfirmation().busy, false)
  api.cancelConfirmation()
  await pending
  assert.equal(writes, 0)
  assert.equal(api.getConfirmation(), null)
})

test('double confirmation, repeated requests and cancellation cannot duplicate an in-flight write', async () => {
  const api = load('src/utils/notifications.ts')
  let writes = 0
  let finish
  const work = new Promise((resolve) => { finish = resolve })
  const pending = api.confirmAction(options, async () => { writes++; await work })
  await api.confirmAction(options, () => { writes += 100 })
  const accepted = api.acceptConfirmation()
  await api.acceptConfirmation()
  api.cancelConfirmation()
  assert.equal(writes, 1)
  assert.equal(api.getConfirmation().busy, true)
  finish()
  await accepted
  await pending
  assert.equal(writes, 1)
  assert.equal(api.getConfirmation(), null)
})

test('failed actions show an error, release the lock and allow another action', async () => {
  const api = load('src/utils/notifications.ts')
  const pending = api.confirmAction(options, async () => { throw Error('Stock insuffisant') })
  await api.acceptConfirmation()
  await pending
  assert.equal(api.getConfirmation(), null)
  assert.equal(api.getNotices()[0].type, 'err')
  assert.equal(api.getNotices()[0].text, 'Stock insuffisant')
  let succeeded = false
  const retry = api.confirmAction(options, () => { succeeded = true })
  await api.acceptConfirmation()
  await retry
  assert.equal(succeeded, true)
})

test('notifications stack independently and can be dismissed without losing other messages', () => {
  const api = load('src/utils/notifications.ts')
  let changes = 0
  const unsubscribe = api.subscribe(() => { changes++ })
  api.notify('Enregistrement terminé')
  api.notify('Échec de l’export', 'err')
  const first = api.getNotices()[0].id
  api.dismissNotice(first)
  assert.deepEqual(api.getNotices().map((notice) => notice.text), ['Échec de l’export'])
  assert.equal(changes, 3)
  unsubscribe()
  api.notify('Rendez-vous', 'info')
  assert.equal(changes, 3)
})
