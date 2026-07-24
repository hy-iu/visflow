import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join } from 'path'
import { getDb, closeDb } from './db/connection'
import { registerProtocolPrivileges, registerProtocols } from './protocol'
import { registerImageHandlers } from './ipc/images'
import { registerCollectionHandlers } from './ipc/collections'
import { registerTagHandlers } from './ipc/tags'
import { registerPlaylistHandlers } from './ipc/playlists'
import { registerSmartGroupHandlers } from './ipc/smart-groups'
import { registerNsfwHandlers } from './ipc/nsfw'
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

function buildAppMenu(): void {
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '导入图片文件夹',
          accelerator: 'CmdOrCtrl+I',
          click: async () => {
            if (!mainWindow) return
            const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: '选择图片文件夹' })
            if (!result.canceled && result.filePaths[0]) {
              importFolder(result.filePaths[0], (current, total, fileName) => {
                mainWindow?.webContents.send('import:progress', { current, total, fileName })
              })
            }
          }
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: 'VisFlow 文档',
          click: () => shell.openExternal('https://hy-iu.github.io/visflow/')
        },
        {
          label: 'VisFlow GitHub',
          click: () => shell.openExternal('https://github.com/hy-iu/visflow')
        },
        {
          label: '问题反馈 (Issues)',
          click: () => shell.openExternal('https://github.com/hy-iu/visflow/issues')
        },
        {
          label: '关于 VisFlow',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于 VisFlow',
              message: 'VisFlow v0.1.0',
              detail: '多维组织 × 沉浸放映的桌面看图应用\n\n基于 Electron + React + TypeScript 构建',
              buttons: ['确定']
            })
          }
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))
}

app.whenReady().then(() => {
  registerProtocols(); getDb()
  fixMissingDimensions().catch(err => console.error(err))
  registerImageHandlers(); registerCollectionHandlers(); registerTagHandlers()
  registerPlaylistHandlers(); registerSmartGroupHandlers(); registerNsfwHandlers(); registerAppHandlers()
  buildAppMenu()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { closeDb(); if (process.platform !== 'darwin') app.quit() })
