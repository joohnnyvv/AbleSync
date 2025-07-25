const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  startServer: (mode) => ipcRenderer.send("start-server", mode),
  startSlave: () => ipcRenderer.send("start-slave"),
  stopServer: () => ipcRenderer.send("stop-server"),
  onLog: (callback) => ipcRenderer.on("log", (_, msg) => callback(msg)),
  onAbletonStatus: (callback) =>
    ipcRenderer.on("ableton-status", (_, status) => callback(status)),
  onWebsocketStatus: (callback) =>
    ipcRenderer.on("websocket-status", (_, status) => callback(status)),
  saveLogs: (logContent) => ipcRenderer.send("save-logs", logContent),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  saveThreshold: (threshold) => ipcRenderer.send("save-threshold", threshold),
  getThreshold: () => ipcRenderer.invoke("get-threshold"),
  updateThreshold: (threshold) =>
    ipcRenderer.send("update-threshold", threshold),
});
