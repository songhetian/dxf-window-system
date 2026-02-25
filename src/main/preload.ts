import { contextBridge, ipcRenderer } from 'electron';

// 暴露 IPC 功能和 API 端口
contextBridge.exposeInMainWorld('electronAPI', {
  parseDxf: (content: string) => ipcRenderer.invoke('parse-dxf', content),
  onApiPort: (callback: (port: number) => void) => 
    ipcRenderer.on('api-port', (_event, port) => callback(port)),
});
