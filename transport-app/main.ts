if (require('electron-squirrel-startup')) app.quit();

import { app, BrowserWindow } from "electron";
import path from "path";
import { setupAllIPC } from "./ipc/index";
import { supabase } from "./ipc/utils";

// --------------------
// Path Resolution Helper
// --------------------
const __dirnameResolved = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(process.execPath);

// --------------------
// Electron Window logic
// --------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1900,
    height: 900,
    icon: path.join(__dirnameResolved, "..", "assets", "logo.png"),
    webPreferences: {
      preload: path.join(__dirnameResolved, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  //REMOVE "//" when updating the app
  // Only open DevTools in development mode
  //if (!app.isPackaged) {
  // win.webContents.openDevTools();
  //}

  const indexPath = path.join(__dirnameResolved, "..", "renderer", "html", "index.html");
  win.loadFile(indexPath);
  win.setMenuBarVisibility(false);
}

// --------------------
// App Lifecycle
// --------------------
app.whenReady().then(() => {
  setupAllIPC();
  createWindow();
  setupRealtimeSubscriptions();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// --------------------
// Realtime Logic
// --------------------
function forwardToAllWindows(channel: string, payload: any) {
  BrowserWindow.getAllWindows().forEach((w) => {
    try {
      w.webContents.send(channel, payload);
    } catch (e) {
      console.warn("Failed to send realtime to window:", e);
    }
  });
}

function setupRealtimeSubscriptions() {
  try {
    supabase
      .channel("realtime_trips")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, (payload: any) => {
        forwardToAllWindows("realtime-update", { table: "trips", payload });
      })
      .subscribe();

    supabase
      .channel("realtime_vehicles")
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, (payload: any) => {
        forwardToAllWindows("realtime-update", { table: "vehicles", payload });
      })
      .subscribe();

    supabase
      .channel("realtime_employees")
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, (payload: any) => {
        forwardToAllWindows("realtime-update", { table: "employees", payload });
      })
      .subscribe();

    supabase
      .channel("realtime_notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload: any) => {
        forwardToAllWindows("realtime-update", { table: "notifications", payload });
      })
      .subscribe();

    supabase
      .channel("realtime_attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, (payload: any) => {
        forwardToAllWindows("realtime-update", { table: "attendance", payload });
      })
      .subscribe();

    supabase
      .channel("realtime_invoices")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, (payload: any) => {
        forwardToAllWindows("realtime-update", { table: "invoices", payload });
      })
      .subscribe();

    supabase
      .channel("realtime_time_off_requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "time_off_requests" }, (payload: any) => {
        forwardToAllWindows("realtime-update", { table: "time_off_requests", payload });
      })
      .subscribe();

    supabase
      .channel("realtime_clients")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, (payload: any) => {
        forwardToAllWindows("realtime-update", { table: "clients", payload });
      })
      .subscribe();

    console.log("Realtime subscriptions initialized");
  } catch (err) {
    console.error("Failed to setup realtime.");
  }
}