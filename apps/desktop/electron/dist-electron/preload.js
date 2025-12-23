"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const promises_1 = __importDefault(require("node:fs/promises"));
electron_1.contextBridge.exposeInMainWorld('sidecar', {
    version: '0.1.0',
    getDefaultDesktopSourceId: async () => {
        return electron_1.ipcRenderer.invoke('sidecar:getDefaultDesktopSourceId');
    },
    showSaveDialog: async (defaultName) => {
        return electron_1.ipcRenderer.invoke('sidecar:showSaveDialog', defaultName);
    },
    writeFile: async (absolutePath, bytes) => {
        await promises_1.default.writeFile(absolutePath, bytes);
    },
});
