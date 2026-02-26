import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { startServer } from './services/fastify';
import DxfParser from 'dxf-parser';

// 启动 Fastify 服务
const PORT = 6002;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 10, y: 10 },
  });

  // 自动开启开发者工具以便调试
  win.webContents.openDevTools();

  // 将端口号传递给渲染进程
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('api-port', PORT);
    console.log(`Sent API port ${PORT} to renderer`);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// 性能优化：在主进程处理 DXF 解析，避免阻塞 UI
ipcMain.handle('parse-dxf', async (_event, content: string) => {
  const parser = new DxfParser();
  try {
    return parser.parseSync(content);
  } catch (err) {
    console.error('DXF Parse Error:', err);
    throw err;
  }
});

app.whenReady().then(async () => {
  try {
    await startServer(PORT);
    createWindow();
  } catch (err) {
    console.error('Failed to start server:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
