import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { startServer } from './server.js'; // 恢复为符合 ESM 规范的 .js 导入，tsx 自动拦截
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function createWindow() {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const appPath = app.getAppPath();
    // 核心修复：根据是否打包自适应 Preload 路径
    let preloadPath = path.resolve(appPath, 'src/preload/index.cjs');
    if (!fs.existsSync(preloadPath)) {
        preloadPath = path.resolve(__dirname, '../preload/index.cjs');
    }
    if (!fs.existsSync(preloadPath)) {
        preloadPath = path.join(__dirname, 'index.cjs');
    }
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'MoserGlassPro 价格系统',
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
        },
        backgroundColor: '#ffffff',
    });
    if (isDev) {
        console.log('[Main] Dev Mode: Loading from Vite (http://localhost:5000)');
        win.loadURL('http://localhost:5000');
        win.webContents.openDevTools(); // 开发模式默认打开调试工具
    }
    else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}
app.whenReady().then(async () => {
    try {
        console.log('[Main] Starting Backend Server...');
        await startServer(3000);
        console.log('[Main] Backend Server Ready.');
        createWindow();
    }
    catch (error) {
        console.error('[Main] Failed to start backend server:', error);
        // 即使后端失败，也尝试打开窗口显示错误或降级运行
        createWindow();
    }
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit();
});
