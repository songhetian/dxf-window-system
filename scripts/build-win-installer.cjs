const { spawnSync } = require('node:child_process');

const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

if (process.platform !== 'win32') {
  console.error('`npm run package:win` 需要在 Windows 环境执行，才能生成带安装流程的 .exe 安装包。');
  process.exit(1);
}

console.log('\n[1/3] 构建 Electron 应用产物...\n');
run('npm', ['run', 'build']);

console.log('\n[2/3] 重建 better-sqlite3 原生模块...\n');
run('npx', ['electron-rebuild', '-f', '-w', 'better-sqlite3']);

console.log('\n[3/3] 生成 NSIS 安装包...\n');
run('npx', ['electron-builder', '--config', 'electron-builder.config.cjs', '--win', 'nsis']);

console.log('\nWindows 安装包已生成到 `release/` 目录。\n');
