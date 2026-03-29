"use strict";const r=require("electron");r.contextBridge.exposeInMainWorld("electronAPI",{parseDxf:e=>r.ipcRenderer.invoke("parse-dxf",e),onApiPort:e=>r.ipcRenderer.on("api-port",(o,n)=>e(n))});
