import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { getDb, closeDb } from './db/connection'
import { registerProtocolPrivileges, registerProtocols } from './protocol'
import { registerImageHandlers } from './ipc/images'
import { registerCollectionHandlers } from './ipc/collections'
import { registerTagHandlers } from './ipc/tags'
import { registerPlaylistHandlers } from './ipc/playlists'
import { registerSmartGroupHandlers } from './ipc/smart-groups'
import { importFolder, importFiles, fixMissingDimensions } from './services/importer'

// Register protocol privileges before app ready
registerProtocolPrivileges()

let mainWindow: BrowserWindow | null = null


function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    show: false, backgroundColor: '#0a0a0c',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false, webSecurity: true }
  })
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.webContents.openDevTools()
  })
  if (process.env.ELECTRON_RENDERER_URL) { mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL) }
  else { mainWindow.loadFile(join(__dirname, '../renderer/index.html')) }
}

function registerAppHandlers(): void {
  ipcMain.handle('dialog:openFolder', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: '选择图片文件夹' })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('import:folder', async (_e, folderPath: string) => {
    return importFolder(folderPath, (current, total, fileName) => { mainWindow?.webContents.send('import:progress', { current, total, fileName }) })
  })
  ipcMain.handle('import:files', async (_e, filePaths: string[]) => {
    return importFiles(filePaths, (current, total, fileName) => { mainWindow?.webContents.send('import:progress', { current, total, fileName }) })
  })
}

app.whenReady().then(() => {
  registerProtocols(); getDb()
  fixMissingDimensions().catch(err => console.error(err))
  registerImageHandlers(); registerCollectionHandlers(); registerTagHandlers()
  registerPlaylistHandlers(); registerSmartGroupHandlers(); registerAppHandlers()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { closeDb(); if (process.platform !== 'darwin') app.quit() })
