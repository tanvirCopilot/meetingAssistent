import { app, BrowserWindow, desktopCapturer, dialog, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5174');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('sidecar:getDefaultDesktopSourceId', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      fetchWindowIcons: false,
    });

    const first = sources[0];
    return first?.id ?? null;
  });

  ipcMain.handle('sidecar:showSaveDialog', async (_evt, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Save recording',
      defaultPath: defaultName,
      filters: [{ name: 'Audio', extensions: ['webm', 'ogg'] }],
    });
    return result.canceled ? null : result.filePath ?? null;
  });

  ipcMain.handle('sidecar:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select folder to save recordings',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('sidecar:writeFile', async (_evt, absolutePath: string, bytesArray: number[]) => {
    const buf = Buffer.from(bytesArray);
    await fs.writeFile(absolutePath, buf);
    return true;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
