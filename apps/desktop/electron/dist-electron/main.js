"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const isDev = !electron_1.app.isPackaged;
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1100,
        height: 750,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (isDev) {
        win.loadURL('http://127.0.0.1:5174');
        win.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        win.loadFile(node_path_1.default.join(__dirname, '..', 'dist', 'index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    electron_1.ipcMain.handle('sidecar:getDefaultDesktopSourceId', async () => {
        const sources = await electron_1.desktopCapturer.getSources({
            types: ['screen'],
            fetchWindowIcons: false,
        });
        const first = sources[0];
        return first?.id ?? null;
    });
    electron_1.ipcMain.handle('sidecar:showSaveDialog', async (_evt, defaultName) => {
        const result = await electron_1.dialog.showSaveDialog({
            title: 'Save recording',
            defaultPath: defaultName,
            filters: [{ name: 'Audio', extensions: ['webm', 'ogg'] }],
        });
        return result.canceled ? null : result.filePath ?? null;
    });
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
