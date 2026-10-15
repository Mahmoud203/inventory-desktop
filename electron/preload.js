/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  backup: () => ipcRenderer.invoke("backup"),
  restore: () => ipcRenderer.invoke("restore"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});
