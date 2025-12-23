import { contextBridge, ipcRenderer } from 'electron';

function safeExpose() {
  try {
    // Signal preload start to Electron logs
    // eslint-disable-next-line no-console
    console.log('[preload] starting preload');

    contextBridge.exposeInMainWorld('sidecar', {
      version: '0.1.0',
      getDefaultDesktopSourceId: async () => {
        return ipcRenderer.invoke('sidecar:getDefaultDesktopSourceId');
      },
      showSaveDialog: async (defaultName: string) => {
        return ipcRenderer.invoke('sidecar:showSaveDialog', defaultName);
      },
      selectDirectory: async () => {
        return ipcRenderer.invoke('sidecar:selectDirectory');
      },
      writeFile: async (absolutePath: string, bytes: Uint8Array) => {
        // Forward to main process to perform filesystem write (avoids node:fs import in preload)
        return ipcRenderer.invoke('sidecar:writeFile', absolutePath, Array.from(bytes));
      },
    });

    // eslint-disable-next-line no-console
    console.log('[preload] sidecar exposed');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[preload] failed to expose sidecar', err);
  }
}

safeExpose();

export {};
