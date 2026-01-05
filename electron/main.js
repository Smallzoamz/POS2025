const { app, BrowserWindow } = require('electron')
const path = require('path')
const startServer = require('./server') // Import the Express server

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    })

    // In dev, load Vite server
    // In prod, load the local Express server or file
    const isDev = !app.isPackaged
    if (isDev) {
        win.loadURL('http://localhost:5173')
    } else {
        win.loadURL('http://localhost:3000')
    }
}

app.whenReady().then(() => {
    // Start the internal Express server
    startServer()

    const isDev = !app.isPackaged
    if (isDev) {
        createWindow()
    } else {
        // Wait for port 3000 to be ready before creating window
        const net = require('net');
        const checkServer = () => {
            const client = new net.Socket();
            client.connect({ port: 3000, host: '127.0.0.1' }, () => {
                client.end();
                createWindow();
            });
            client.on('error', () => {
                setTimeout(checkServer, 200);
            });
        };
        checkServer();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
