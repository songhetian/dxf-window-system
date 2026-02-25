import { app, BrowserWindow, protocol, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { startServer } from './services/fastify';
import DxfParser from 'dxf-parser';

// 启动 Fastify 服务
const PORT = 3002; // 固定或动态分配

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 10, y: 10 },
  });

  // 将端口号传递给渲染进程
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('api-port', PORT);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// 性能优化：在主进程处理 DXF 解析，避免阻塞 UI
ipcMain.handle('parse-dxf', async (event, content: string) => {
  const parser = new DxfParser();
  try {
    return parser.parseSync(content);
  } catch (err) {
    console.error('DXF Parse Error:', err);
    throw err;
  }
});

app.whenReady().then(async () => {
  await startServer(PORT);
  createWindow();
  // ... rest
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
