const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('busAPI', {
  getAlerts: () => ipcRenderer.invoke('busAPI:getAlerts'),
  getStationboard: (stopID) => ipcRenderer.invoke('busAPI:getStationboard', stopID),
  getStops: (lat, lng) => ipcRenderer.invoke('busAPI:getStops', lat, lng),
  getServices: (lat, lng) => ipcRenderer.invoke('busAPI:getServices', lat, lng),
  getService: (busID) => ipcRenderer.invoke('busAPI:getService', busID),
  relaunch: () => ipcRenderer.invoke("app:relaunch"),
  centralEvent: (callback) => ipcRenderer.on('centralEvent', (_event, event, value) => callback(event, value)),
})