// Electron binary guard, extract-zip hangs on node 24
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron')

// Absent dependency
if (!fs.existsSync(electronDir)) process.exit(0)

const platformPaths = {
  darwin: 'Electron.app/Contents/MacOS/Electron',
  mas: 'Electron.app/Contents/MacOS/Electron',
  win32: 'electron.exe'
}

const platformPath = platformPaths[os.platform()] || 'electron'
const distPath = path.join(electronDir, 'dist')
const binPath = path.join(distPath, platformPath)
const pathTxt = path.join(electronDir, 'path.txt')

// Healthy install
if (fs.existsSync(binPath)) {
  fs.writeFileSync(pathTxt, platformPath)
  process.exit(0)
}

const { version } = require(path.join(electronDir, 'package.json'))

const unzip = (zipPath) => {
  if (os.platform() === 'win32') {
    const command = `Expand-Archive -Path '${zipPath}' -DestinationPath '${distPath}' -Force`
    execFileSync('powershell', ['-NoProfile', '-Command', command], { stdio: 'inherit' })
    return
  }
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', distPath], { stdio: 'inherit' })
}

const install = async () => {
  const { downloadArtifact } = require('@electron/get')
  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: os.platform(),
    arch: process.arch,
    checksums: require(path.join(electronDir, 'checksums.json'))
  })
  unzip(zipPath)
  fs.writeFileSync(pathTxt, platformPath)
  console.log(`electron ${version} binary installed`)
}

install().catch((error) => {
  console.error('electron binary install failed:', error.message)
  process.exit(1)
})
