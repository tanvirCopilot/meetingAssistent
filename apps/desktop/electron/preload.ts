import { contextBridge, ipcRenderer } from 'electron';
import fs from 'node:fs/promises';

contextBridge.exposeInMainWorld('sidecar', {
  version: '0.1.0',
  getDefaultDesktopSourceId: async () => {
    return ipcRenderer.invoke('sidecar:getDefaultDesktopSourceId');
  },
  showSaveDialog: async (defaultName: string) => {
    return ipcRenderer.invoke('sidecar:showSaveDialog', defaultName);
  },
  writeFile: async (absolutePath: string, bytes: Uint8Array) => {
    await fs.writeFile(absolutePath, bytes);
  },
});

export {};
