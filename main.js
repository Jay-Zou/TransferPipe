let electron = require('electron');

// app
let app = electron.app;
// Desktop window
let BrowserWindow = electron.BrowserWindow;
let mainWindow = null;

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 400,
        webPreferences: {
            // 开启 Node.js 的 API
            nodeIntegration: true
        }
    });
    // 引用 js，当然可以将代码直接写到这里
    // 引入菜单
    // require('./main/menu.js')
    mainWindow.loadFile('html/drop_file.html');
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
});