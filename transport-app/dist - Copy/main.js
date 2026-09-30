"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
if (require('electron-squirrel-startup'))
    electron_1.app.quit();
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const index_1 = require("./ipc/index");
const utils_1 = require("./ipc/utils");
// --------------------
// Path Resolution Helper
// --------------------
const __dirnameResolved = typeof __dirname !== "undefined"
    ? __dirname
    : path_1.default.dirname(process.execPath);
// --------------------
// Electron Window logic
// --------------------
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1900,
        height: 900,
        icon: path_1.default.join(__dirnameResolved, "..", "assets", "logo.png"),
        webPreferences: {
            preload: path_1.default.join(__dirnameResolved, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    //REMOVE "//" when updating the app
    // Only open DevTools in development mode
    //if (!app.isPackaged) {
    // win.webContents.openDevTools();
    //}
    const indexPath = path_1.default.join(__dirnameResolved, "..", "renderer", "html", "index.html");
    win.loadFile(indexPath);
    win.setMenuBarVisibility(false);
}
// --------------------
// App Lifecycle
// --------------------
electron_1.app.whenReady().then(() => {
    (0, index_1.setupAllIPC)();
    createWindow();
    setupRealtimeSubscriptions();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
// --------------------
// Realtime Logic
// --------------------
function forwardToAllWindows(channel, payload) {
    electron_1.BrowserWindow.getAllWindows().forEach((w) => {
        try {
            w.webContents.send(channel, payload);
        }
        catch (e) {
            console.warn("Failed to send realtime to window:", e);
        }
    });
}
function setupRealtimeSubscriptions() {
    try {
        utils_1.supabase
            .channel("realtime_trips")
            .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, (payload) => {
            forwardToAllWindows("realtime-update", { table: "trips", payload });
        })
            .subscribe();
        utils_1.supabase
            .channel("realtime_vehicles")
            .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, (payload) => {
            forwardToAllWindows("realtime-update", { table: "vehicles", payload });
        })
            .subscribe();
        utils_1.supabase
            .channel("realtime_employees")
            .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, (payload) => {
            forwardToAllWindows("realtime-update", { table: "employees", payload });
        })
            .subscribe();
        utils_1.supabase
            .channel("realtime_notifications")
            .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload) => {
            forwardToAllWindows("realtime-update", { table: "notifications", payload });
        })
            .subscribe();
        utils_1.supabase
            .channel("realtime_attendance")
            .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, (payload) => {
            forwardToAllWindows("realtime-update", { table: "attendance", payload });
        })
            .subscribe();
        utils_1.supabase
            .channel("realtime_invoices")
            .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, (payload) => {
            forwardToAllWindows("realtime-update", { table: "invoices", payload });
        })
            .subscribe();
        utils_1.supabase
            .channel("realtime_time_off_requests")
            .on("postgres_changes", { event: "*", schema: "public", table: "time_off_requests" }, (payload) => {
            forwardToAllWindows("realtime-update", { table: "time_off_requests", payload });
        })
            .subscribe();
        utils_1.supabase
            .channel("realtime_clients")
            .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, (payload) => {
            forwardToAllWindows("realtime-update", { table: "clients", payload });
        })
            .subscribe();
        console.log("Realtime subscriptions initialized");
    }
    catch (err) {
        console.error("Failed to setup realtime.");
    }
}
//# sourceMappingURL=main.js.map