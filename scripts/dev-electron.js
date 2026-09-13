// Main process runner: restarts electron when dist-electron is rebuilt
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const watchDir = path.join(root, 'dist-electron')
const binary = require('electron')

let child = null
let restarting = false
let timer = null

const start = () => {
  child = spawn(binary, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  })

  child.on('exit', (code) => {
    child = null
    // Manual quit ends the dev session, a restart does not
    if (!restarting) process.exit(code === null ? 0 : code)
  })
}

const restart = () => {
  if (restarting) return
  restarting = true

  const relaunch = () => {
    restarting = false
    console.log('[dev] processus principal rechargé')
    start()
  }

  if (!child) return relaunch()
  child.once('exit', relaunch)
  child.kill()
}

// Debounce: tsc writes several files per compilation
const schedule = () => {
  clearTimeout(timer)
  timer = setTimeout(restart, 300)
}

start()

if (fs.existsSync(watchDir)) {
  fs.watch(watchDir, { recursive: true }, (_event, file) => {
    if (file && file.endsWith('.js')) schedule()
  })
}

const stop = () => {
  restarting = true
  if (child) child.kill()
  process.exit(0)
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
