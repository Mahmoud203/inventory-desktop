/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const child_process = require("child_process");
const archiver = require("archiver");
const AdmZip = require("adm-zip");

// 1. Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let serverProcess = null;

// Determine data directory: %APPDATA%/Inventory App/data
const dataDir = path.join(app.getPath("userData"), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const photosDir = path.join(dataDir, "photos");
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}
process.env.ELECTRON_DATA_DIR = dataDir;

function killServer() {
  if (serverProcess) {
    try {
      if (process.platform === "win32") {
        child_process.execSync(`taskkill /pid ${serverProcess.pid} /T /F`);
      } else {
        serverProcess.kill("SIGTERM");
      }
    } catch {
      // process may already be closed
    }
    serverProcess = null;
  }
}

function waitForServer(url, timeoutMs = 30000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve(true);
        } else {
          retry();
        }
      });

      req.on("error", () => {
        retry();
      });

      req.end();
    };

    const retry = () => {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error("Timeout waiting for Next.js standalone server to start"));
      } else {
        setTimeout(check, 150);
      }
    };

    check();
  });
}

function getStandaloneServerPath() {
  const candidates = [
    path.join(process.resourcesPath, "app", "server.js"),
    path.join(process.resourcesPath, "app", ".next", "standalone", "server.js"),
    path.join(process.resourcesPath, "app.asar.unpacked", ".next", "standalone", "server.js"),
    path.join(__dirname, "..", ".next", "standalone", "server.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(process.resourcesPath, "app", "server.js");
}

function startStandaloneServer() {
  const serverPath = path.join(process.resourcesPath, "app", "server.js");
  const resolvedPath = fs.existsSync(serverPath)
    ? serverPath
    : getStandaloneServerPath();
  const serverDir = path.dirname(resolvedPath);

  const asarNodeModules = path.join(process.resourcesPath, "app.asar", "node_modules");
  const localNodeModules = path.join(serverDir, "node_modules");
  const nodePath = [localNodeModules, asarNodeModules].join(path.delimiter);

  serverProcess = child_process.spawn(process.execPath, [resolvedPath], {
    cwd: serverDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: "3000",
      HOSTNAME: "0.0.0.0",
      ELECTRON_DATA_DIR: path.join(app.getPath("userData"), "data"),
      NODE_ENV: "production",
      NODE_PATH: nodePath,
    },
    windowsHide: true,
    stdio: "inherit",
  });

  serverProcess.on("error", (err) => {
    console.error("Failed to start Next.js server:", err);
  });

  serverProcess.on("close", (code) => {
    console.log(`Next.js server exited with code ${code}`);
  });
}

function createMainWindow() {
  const iconPath = path.join(__dirname, "..", "build", "icon.ico");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "Inventory App",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: "#0A0A0A",
  });

  // Intercept navigation
  mainWindow.webContents.on("will-navigate", (event, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      // ignore
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
        shell.openExternal(url);
        return { action: "deny" };
      }
    } catch {
      // ignore
    }
    return { action: "allow" };
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    killServer();
    app.quit();
  });

  mainWindow.loadURL("http://localhost:3000");
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  if (app.isPackaged) {
    startStandaloneServer();
    try {
      await waitForServer("http://localhost:3000", 25000);
    } catch (err) {
      dialog.showErrorBox(
        "Server Startup Error",
        "Failed to start local database server: " + err.message
      );
      app.quit();
      return;
    }
  }

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  killServer();
});

// IPC Handlers
ipcMain.handle("backup", async () => {
  const dateStr = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Save Backup",
    defaultPath: `inventory-backup-${dateStr}.zip`,
    filters: [{ name: "ZIP Archives", extensions: ["zip"] }],
  });

  if (canceled || !filePath) {
    return { canceled: true, success: false };
  }

  return new Promise((resolve) => {
    const output = fs.createWriteStream(filePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      resolve({ success: true, path: filePath });
    });

    archive.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });

    archive.pipe(output);
    archive.directory(dataDir, false);
    archive.finalize();
  });
});

ipcMain.handle("restore", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Select Backup File",
    filters: [{ name: "ZIP Archives", extensions: ["zip"] }],
    properties: ["openFile"],
  });

  if (canceled || !filePaths || filePaths.length === 0) {
    return { canceled: true, success: false };
  }

  const zipPath = filePaths[0];

  const choice = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Confirm Restore",
    message: "This will replace all current data. Continue?",
    buttons: ["Cancel", "Restore and Restart"],
    defaultId: 1,
    cancelId: 0,
  });

  if (choice.response !== 1) {
    return { canceled: true, success: false };
  }

  try {
    killServer();
    await new Promise((r) => setTimeout(r, 600));

    if (fs.existsSync(dataDir)) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(dataDir, { recursive: true });

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(dataDir, true);

    app.relaunch();
    app.exit(0);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});
