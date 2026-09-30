"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// preload.ts
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("api", {
    // --------------------
    // Auth
    // --- Auth API ---
    login: (e, p) => electron_1.ipcRenderer.invoke("login", e, p),
    register: (data) => electron_1.ipcRenderer.invoke("supabase-register", data),
    // Custom SMTP-based Password Recovery
    resetPassword: (email) => electron_1.ipcRenderer.invoke("auth:sendRecoveryCode", email),
    verifyRecoveryCode: (email, code) => electron_1.ipcRenderer.invoke("auth:verifyRecoveryCode", email, code),
    updatePasswordWithCode: (email, code, newPassword) => electron_1.ipcRenderer.invoke("auth:updatePasswordWithCode", email, code, newPassword),
    // Email Verification (Signup)
    verifySignupCode: (email, code) => electron_1.ipcRenderer.invoke("auth:verifySignupCode", email, code),
    resendSignupCode: (email) => electron_1.ipcRenderer.invoke("auth:resendSignupCode", email),
    // Super Admin Operations
    admin: {
        getPendingUsers: () => electron_1.ipcRenderer.invoke("admin:getPendingUsers"),
        getAllUsers: () => electron_1.ipcRenderer.invoke("admin:getAllUsers"),
        approveUser: (userId) => electron_1.ipcRenderer.invoke("admin:approveUser", userId),
        rejectUser: (userId) => electron_1.ipcRenderer.invoke("admin:rejectUser", userId),
        deleteUser: (userId) => electron_1.ipcRenderer.invoke("admin:deleteUser", userId),
    },
    // --------------------
    // Employees
    // --------------------
    getEmployees: () => electron_1.ipcRenderer.invoke("get-employees"),
    getEmployeeById: (id) => electron_1.ipcRenderer.invoke("get-employee-by-id", id),
    addEmployee: (data) => electron_1.ipcRenderer.invoke("add-employee", data),
    updateEmployee: (id, data) => electron_1.ipcRenderer.invoke("update-employee", id, data),
    deleteEmployee: (id) => electron_1.ipcRenderer.invoke("delete-employee", id),
    // Admin create employee + Supabase Auth user
    createEmployee: (payload) => electron_1.ipcRenderer.invoke("create-employee", payload),
    // Sync existing account by email
    syncEmployeeAccountByEmail: (employeeId, email) => electron_1.ipcRenderer.invoke("sync-employee-account-by-email", employeeId, email),
    getEmployeeByUser: (userId) => electron_1.ipcRenderer.invoke("get-employee-by-user", userId),
    getNextEmployeeId: () => electron_1.ipcRenderer.invoke("get-next-employee-id"),
    // --------------------
    // Time Off
    // --------------------
    getTimeOffRequests: () => electron_1.ipcRenderer.invoke("get-timeoff-requests"),
    addTimeOffRequest: (data) => electron_1.ipcRenderer.invoke("add-timeoff-request", data),
    updateTimeOffRequestStatus: (id, status) => electron_1.ipcRenderer.invoke("update-timeoff-status", id, status),
    // Auto recalc
    recalculateStatuses: () => electron_1.ipcRenderer.invoke("recalculate-statuses"),
    // --------------------
    // Vehicles
    // --------------------
    getVehicles: () => electron_1.ipcRenderer.invoke("get-vehicles"),
    addVehicle: (data) => electron_1.ipcRenderer.invoke("add-vehicle", data),
    updateVehicle: (id, data) => electron_1.ipcRenderer.invoke("update-vehicle", id, data),
    deleteVehicle: (id) => electron_1.ipcRenderer.invoke("delete-vehicle", id),
    setVehicleStatus: (id, status) => electron_1.ipcRenderer.invoke("set-vehicle-status", id, status),
    submitVehicleAssessment: (data) => electron_1.ipcRenderer.invoke("vehicles:submitAssessment", data),
    getVehicleAssessments: (vehicleId) => electron_1.ipcRenderer.invoke("vehicles:getAssessments", vehicleId),
    clearVehicleMaintenance: (vehicleId, notes) => electron_1.ipcRenderer.invoke("vehicles:clearMaintenance", vehicleId, notes),
    getMaintenanceSchedules: (vehicleId) => electron_1.ipcRenderer.invoke("vehicles:getMaintenanceSchedules", vehicleId),
    logMaintenanceService: (payload) => electron_1.ipcRenderer.invoke("vehicles:logMaintenanceService", payload),
    getFuelEconomy: (vehicleId) => electron_1.ipcRenderer.invoke("vehicles:getFuelEconomy", vehicleId),
    // --------------------
    // Tracking & Estimation
    // --------------------
    tracking: {
        getDualLegEstimate: (payload) => electron_1.ipcRenderer.invoke("tracking:getDualLegEstimate", payload),
        estimatePackage: (input) => electron_1.ipcRenderer.invoke("tracking:estimatePackage", input),
        updateDriverLocation: (data) => electron_1.ipcRenderer.invoke("tracking:updateDriverLocation", data),
        getLiveFleetLocations: () => electron_1.ipcRenderer.invoke("tracking:getLiveFleetLocations"),
    },
    // --------------------
    // Trips & Multi-Stop Runs
    // --------------------
    getTrips: () => electron_1.ipcRenderer.invoke("get-trips"),
    addTrip: (data) => electron_1.ipcRenderer.invoke("add-trip", data),
    updateTripStatus: (id, status) => electron_1.ipcRenderer.invoke("update-trip-status", id, status),
    deleteTrip: (id) => electron_1.ipcRenderer.invoke("delete-trip", id),
    updateTrip: (id, updates) => electron_1.ipcRenderer.invoke("update-trip", id, updates),
    getTripStops: (tripId) => electron_1.ipcRenderer.invoke("trips:getStops", tripId),
    addTripStops: (tripId, stops) => electron_1.ipcRenderer.invoke("trips:addStops", tripId, stops),
    updateTripStop: (stopId, updates) => electron_1.ipcRenderer.invoke("trips:updateStop", stopId, updates),
    setDriverStatus: (driverId, status) => electron_1.ipcRenderer.invoke("set-driver-status", driverId, status),
    // --------------------
    // Clients
    // --------------------
    getClients: () => electron_1.ipcRenderer.invoke("get-clients"),
    addClient: (data) => electron_1.ipcRenderer.invoke("add-client", data),
    updateClient: (id, data) => electron_1.ipcRenderer.invoke("update-client", id, data),
    deleteClient: (id) => electron_1.ipcRenderer.invoke("delete-client", id),
    getClientHistory: (options) => electron_1.ipcRenderer.invoke("get-client-history", options),
    // --------------------
    // Dashboard
    // --------------------
    getDashboardStats: () => electron_1.ipcRenderer.invoke("get-dashboard-stats"),
    getRecentTrips: () => electron_1.ipcRenderer.invoke("get-recent-trips"),
    // --------------------
    // Realtime Updates
    // --------------------
    onRealtime: (cb) => {
        electron_1.ipcRenderer.on("realtime-update", cb);
        return () => electron_1.ipcRenderer.removeListener("realtime-update", cb);
    },
    // --------------------
    // Billing
    // --------------------
    billing: {
        getAll: () => electron_1.ipcRenderer.invoke("billing:getAll"),
        create: (data) => electron_1.ipcRenderer.invoke("billing:create", data),
        delete: (id) => electron_1.ipcRenderer.invoke("billing:delete", id),
        update: (id, data) => electron_1.ipcRenderer.invoke("billing:update", id, data),
        getLastNumber: () => electron_1.ipcRenderer.invoke("billing:getLastNumber"),
        getStats: () => electron_1.ipcRenderer.invoke("billing:getStats"),
    },
    // --------------------
    // Attendance
    // --------------------
    getAttendance: (employeeId) => electron_1.ipcRenderer.invoke("get-attendance", employeeId),
    addAttendance: (data) => electron_1.ipcRenderer.invoke("add-attendance", data),
    getAllAttendance: (options) => electron_1.ipcRenderer.invoke("get-all-attendance", options),
    // --------------------
    // Payroll
    // --------------------
    payroll: {
        getMyMonthly: (userId, monthYYYYMM) => electron_1.ipcRenderer.invoke("payroll:getMyMonthly", userId, monthYYYYMM),
        getMonthlyAll: (monthYYYYMM) => electron_1.ipcRenderer.invoke("payroll:getMonthlyAll", monthYYYYMM),
        sendPayslipEmail: (data) => electron_1.ipcRenderer.invoke("payroll:sendPayslipEmail", data),
        finalize: (monthYYYYMM) => electron_1.ipcRenderer.invoke("payroll:finalize", monthYYYYMM),
    },
    // --------------------
    // Notifications
    // --------------------
    notifications: {
        getAll: () => electron_1.ipcRenderer.invoke("notifications:getAll"),
        create: (data) => electron_1.ipcRenderer.invoke("notifications:create", data),
        triggerAlarm: (data) => electron_1.ipcRenderer.invoke("notifications:triggerAlarm", data),
        broadcast: (data) => electron_1.ipcRenderer.invoke("notifications:broadcast", data),
        markRead: (id) => electron_1.ipcRenderer.invoke("notifications:markRead", id),
        delete: (id) => electron_1.ipcRenderer.invoke("notifications:delete", id),
    },
    // --------------------
    // Proof of Delivery (e-POD)
    // --------------------
    epod: {
        submit: (payload) => electron_1.ipcRenderer.invoke("epod:submit", payload),
        get: (tripId) => electron_1.ipcRenderer.invoke("epod:get", tripId),
    },
    // --------------------
    // Expenses & Fuel
    // --------------------
    expenses: {
        log: (payload) => electron_1.ipcRenderer.invoke("expenses:log", payload),
        getByTrip: (tripId) => electron_1.ipcRenderer.invoke("expenses:getByTrip", tripId),
        getByVehicle: (vehicleId) => electron_1.ipcRenderer.invoke("expenses:getByVehicle", vehicleId),
        getFleetSummary: () => electron_1.ipcRenderer.invoke("expenses:getFleetSummary"),
    },
    // --------------------
    // Incidents & SOS Alerts
    // --------------------
    incidents: {
        report: (payload) => electron_1.ipcRenderer.invoke("incidents:report", payload),
        getAll: () => electron_1.ipcRenderer.invoke("incidents:getAll"),
        updateStatus: (incidentId, status) => electron_1.ipcRenderer.invoke("incidents:updateStatus", { incidentId, status }),
    },
});
//# sourceMappingURL=preload.js.map