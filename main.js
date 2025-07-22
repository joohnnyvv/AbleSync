const { app, Tray, Menu, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

let tray = null;
let window = null;
let processRef = null;
let connectionStatus = "disconnected";

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

function createWindow() {
  if (window && !window.isDestroyed()) {
    window.focus();
    return;
  }

  window = new BrowserWindow({
    width: 500,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
    icon: path.join(__dirname, "assets", "iconTemplate.png"),
    title: "AbleSync",
  });

  // Poprawne ładowanie pliku HTML
  if (app.isPackaged) {
    window.loadFile(path.join(__dirname, "index.html"));
  } else {
    window.loadFile("index.html");
  }

  // Handle window close
  window.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });

  window.on("closed", () => {
    window = null; // Clear the reference
  });

  window.on("ready-to-show", () => {
    window.show();
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, "assets", "iconTemplate.png"));

  const contextMenu = Menu.buildFromTemplate([
    { label: "Zamknij serwer", click: stopServer },
    {
      label: "Zakończ aplikację",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("AbleSync");
  tray.setContextMenu(contextMenu);

  // Handle tray click
  tray.on("click", () => {
    if (!window || window.isDestroyed()) {
      createWindow();
    } else {
      window.isVisible() ? window.hide() : window.show();
    }
  });
}

function getScriptPath(mode) {
  if (app.isPackaged) {
    // Try app.asar.unpacked first (if asarUnpack is configured)
    const unpackedPath = path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "dist",
      mode,
      "src",
      "index.js"
    );

    // Fallback to app directory (current situation)
    const appPath = path.join(
      process.resourcesPath,
      "app",
      "dist",
      mode,
      "src",
      "index.js"
    );

    console.log(
      `Checking unpacked path: ${unpackedPath} - exists: ${fs.existsSync(
        unpackedPath
      )}`
    );
    console.log(
      `Checking app path: ${appPath} - exists: ${fs.existsSync(appPath)}`
    );

    // Check which one exists
    if (fs.existsSync(unpackedPath)) {
      console.log("Using unpacked path");
      return unpackedPath;
    } else if (fs.existsSync(appPath)) {
      console.log("Using app path");
      return appPath;
    } else {
      console.error(`Neither path exists: ${unpackedPath} or ${appPath}`);
      // Let's also try some other possible locations
      const alternativePaths = [
        path.join(process.resourcesPath, "dist", mode, "src", "index.js"),
        path.join(__dirname, "dist", mode, "src", "index.js"),
        path.join(process.cwd(), "dist", mode, "src", "index.js"),
      ];

      for (const altPath of alternativePaths) {
        console.log(
          `Trying alternative: ${altPath} - exists: ${fs.existsSync(altPath)}`
        );
        if (fs.existsSync(altPath)) {
          return altPath;
        }
      }

      return appPath; // Return something, will fail gracefully later
    }
  } else {
    return path.join(__dirname, "dist", mode, "src", "index.js");
  }
}

function startServer(mode) {
  const scriptPath = getScriptPath(mode);
  if (processRef) return;

  const electronPath = process.execPath;

  console.log(`Starting ${mode} from: ${scriptPath}`);
  console.log(`Script exists: ${fs.existsSync(scriptPath)}`);

  processRef = spawn(electronPath, [scriptPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
    },
    cwd: app.isPackaged ? path.join(process.resourcesPath, "app") : __dirname,
  });

  processRef.stdout.on("data", (data) => {
    const message = data.toString();
    if (window) window.webContents.send("log", message);

    // Updated status detection for UDP
    if (/Live connected/.test(message)) {
      window.webContents.send("ableton-status", true);
    } else if (/Got connection!/.test(message)) {
      window.webContents.send("ableton-status", true);
    } else if (/UDP Multicast uruchomiony/.test(message)) {
      // Master UDP server started
      window.webContents.send("websocket-status", true);
    } else if (/Nasłuchiwanie UDP Multicast/.test(message)) {
      // Slave UDP client started listening
      window.webContents.send("websocket-status", true);
    } else if (/Połączono z masterem/.test(message)) {
      // Slave connected to master
      window.webContents.send("websocket-status", true);
    } else if (
      /Serwer zatrzymany/.test(message) ||
      /Zamykanie.*UDP/.test(message)
    ) {
      window.webContents.send("ableton-status", false);
      window.webContents.send("websocket-status", false);
    } else if (/Utracono połączenie z masterem/.test(message)) {
      window.webContents.send("websocket-status", false);
    }
  });

  processRef.stderr.on("data", (data) => {
    const message = data.toString();
    if (window) window.webContents.send("log", "[ERR] " + message);
  });

  processRef.on("close", () => {
    connectionStatus = "disconnected";
    processRef = null;
    updateTrayTooltip();
    if (window) window.webContents.send("log", "Serwer zatrzymany.\n");
  });
}

function stopServer() {
  if (processRef) {
    processRef.kill();
    processRef = null;
  }
}

ipcMain.on("save-logs", async (event, logContent) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Zapisz logi",
      defaultPath: "logi.txt",
      filters: [{ name: "Pliki tekstowe", extensions: ["txt"] }],
    });

    if (!canceled && filePath) {
      try {
        fs.writeFileSync(filePath, logContent);
        console.log("Logi zapisane do:", filePath);
      } catch (writeErr) {
        console.error("Błąd zapisu pliku:", writeErr);
      }
    }
  } catch (err) {
    console.error("Błąd podczas zapisu logów:", err);
  }
});

// Updated slave startup - no longer needs IP input since multicast is used
ipcMain.on("start-slave", () => {
  if (processRef) {
    stopServer();
  }

  const scriptPath = getScriptPath("slave");

  console.log("Starting slave from:", scriptPath);
  console.log("Script exists:", fs.existsSync(scriptPath));

  // Send info to UI
  if (window) {
    window.webContents.send(
      "log",
      `[INFO] Uruchamianie slave z UDP Multicast...\n`
    );
  }

  // Use Electron's Node.js runtime
  const electronPath = process.execPath;

  processRef = spawn(electronPath, [scriptPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
    },
    cwd: app.isPackaged
      ? path.join(process.resourcesPath, "app")
      : path.join(__dirname, ".."),
  });

  // Add process event handlers
  processRef.stdout.on("data", (data) => {
    const message = data.toString();
    console.log(`[Slave] ${message}`);
    if (window) window.webContents.send("log", message);
  });

  processRef.stderr.on("data", (data) => {
    const message = data.toString();
    console.error(`[Slave ERR] ${message}`);

    if (window) {
      // UDP-specific error handling
      if (message.includes("EADDRINUSE")) {
        window.webContents.send(
          "log",
          `[ERR] Port 8080 jest już używany\n` +
            `Sprawdź czy nie działa już inny slave lub master\n`
        );
      } else if (message.includes("EACCES")) {
        window.webContents.send(
          "log",
          `[ERR] Brak uprawnień do UDP Multicast\n` +
            `Spróbuj uruchomić aplikację jako administrator\n`
        );
      } else {
        window.webContents.send("log", `[ERR] ${message}`);
      }
    }
  });

  processRef.on("close", (code) => {
    console.log(`Slave process exited with code ${code}`);
    if (window)
      window.webContents.send(
        "log",
        `Serwer slave zatrzymany (kod: ${code})\n`
      );
    processRef = null;
  });

  processRef.on("error", (err) => {
    console.error("Failed to start slave process:", err);
    if (window)
      window.webContents.send(
        "log",
        `[ERR] Błąd uruchamiania slave: ${err.message}\n`
      );
  });
});

function updateTrayTooltip() {
  tray.setToolTip(
    `AbleSync (${
      connectionStatus === "connected" ? "Połączony" : "Rozłączony"
    })`
  );
}

ipcMain.on("start-server", (_, mode) => startServer(mode));
ipcMain.on("stop-server", () => stopServer());

app.enableSandbox();
app.setLoginItemSettings({
  openAtLogin: true,
  path: app.getPath("exe"),
});

let appIsQuitting = false;

app.on("before-quit", () => {
  appIsQuitting = true;
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", (e) => {
  if (process.platform !== "darwin") {
    app.quit();
  } else {
    e.preventDefault();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});
