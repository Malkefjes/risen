const { app, BrowserWindow, Menu } = require('electron');

function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#07090f',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true }
  });
  win.loadFile('game/index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
