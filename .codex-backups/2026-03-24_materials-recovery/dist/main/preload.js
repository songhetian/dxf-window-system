"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  parseDxf: (content) => electron.ipcRenderer.invoke("parse-dxf", content),
  onApiPort: (callback) => electron.ipcRenderer.on("api-port", (_event, port) => callback(port))
});
