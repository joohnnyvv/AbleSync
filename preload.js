const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  startServer: (mode) => ipcRenderer.send("start-server", mode),
  startSlave: (ip) => ipcRenderer.send("start-slave", ip),
  stopServer: () => ipcRenderer.send("stop-server"),
  onLog: (callback) => ipcRenderer.on("log", (_, msg) => callback(msg)),
  onAbletonStatus: (callback) =>
    ipcRenderer.on("ableton-status", (_, status) => callback(status)),
  onWebsocketStatus: (callback) =>
    ipcRenderer.on("websocket-status", (_, status) => callback(status)),
});
