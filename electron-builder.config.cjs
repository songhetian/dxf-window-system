const fs = require('node:fs');
const path = require('node:path');

const iconPath = path.join(__dirname, 'build', 'icon.ico');
const hasIcon = fs.existsSync(iconPath);

const winConfig = {
  target: [
    {
      target: 'nsis',
      arch: ['x64'],
    },
  ],
  artifactName: '门窗造价测算系统-安装包-${version}.${ext}',
};

if (hasIcon) {
  winConfig.icon = iconPath;
}

const nsisConfig = {
  oneClick: false,
  allowToChangeInstallationDirectory: true,
  allowElevation: true,
  createDesktopShortcut: true,
  createStartMenuShortcut: true,
  shortcutName: '门窗造价测算系统',
};

if (hasIcon) {
  nsisConfig.installerIcon = iconPath;
  nsisConfig.uninstallerIcon = iconPath;
  nsisConfig.installerHeaderIcon = iconPath;
}

module.exports = {
  appId: 'com.song.window-cost-system',
  productName: '门窗造价测算系统',
  directories: {
    output: 'release',
  },
  files: [
    'dist/**/*',
    'package.json',
  ],
  extraResources: [
    {
      from: 'src/main/database/schema.sql',
      to: 'schema.sql',
    },
  ],
  asarUnpack: [
    'node_modules/better-sqlite3/**/*',
  ],
  npmRebuild: false,
  buildDependenciesFromSource: true,
  win: winConfig,
  nsis: nsisConfig,
};
