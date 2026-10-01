// preload.ts
import { contextBridge, ipcRenderer } from "electron";

interface UserData {
  username: string;
  email: string;
  password: string;
  firstname: string;
  lastname: string;
  phone?: string;
}

interface TripData {
  trip_number: string;
  driver_id: string;
  vehicle_id: number | string;
  client_id?: number | string | null;
  customer_number?: string;
  pickup_location: string;
  delivery_location: string;
  pickup_time: string;
  delivery_time: string;
  cargo: string;
  status?: string;
}

interface AttendanceFilters {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
}

interface CreateEmployeePayload {
  employee_id: string;
  full_name: string;
  email?: string;
  phone?: string | null;
  status?: string;
  position?: string;
  department?: string;
  auth_email?: string;
  auth_password?: string;
}

contextBridge.exposeInMainWorld("api", {
  // --------------------
  // Auth
  // --- Auth API ---
  login: (e: string, p: string) => ipcRenderer.invoke("login", e, p),
  register: (data: any) => ipcRenderer.invoke("supabase-register", data),
  
  // Custom SMTP-based Password Recovery
  resetPassword: (email: string) => 
    ipcRenderer.invoke("auth:sendRecoveryCode", email),
  verifyRecoveryCode: (email: string, code: string) => 
    ipcRenderer.invoke("auth:verifyRecoveryCode", email, code),
  updatePasswordWithCode: (email: string, code: string, newPassword: string) => 
    ipcRenderer.invoke("auth:updatePasswordWithCode", email, code, newPassword),

  // Email Verification (Signup)
  verifySignupCode: (email: string, code: string) =>
    ipcRenderer.invoke("auth:verifySignupCode", email, code),
  resendSignupCode: (email: string) =>
    ipcRenderer.invoke("auth:resendSignupCode", email),

  // Super Admin Operations
  admin: {
    getPendingUsers: () => ipcRenderer.invoke("admin:getPendingUsers"),
    getAllUsers: () => ipcRenderer.invoke("admin:getAllUsers"),
    approveUser: (userId: string) => ipcRenderer.invoke("admin:approveUser", userId),
    rejectUser: (userId: string) => ipcRenderer.invoke("admin:rejectUser", userId),
    deleteUser: (userId: string) => ipcRenderer.invoke("admin:deleteUser", userId),
    updateUserRole: (userId: string, role: string) => ipcRenderer.invoke("admin:updateUserRole", userId, role),
  },

  // --------------------
  // Employees
  // --------------------
  getEmployees: () => ipcRenderer.invoke("get-employees"),

  getEmployeeById: (id: string) =>
    ipcRenderer.invoke("get-employee-by-id", id),

  addEmployee: (data: any) =>
    ipcRenderer.invoke("add-employee", data),

  updateEmployee: (id: string, data: any) =>
    ipcRenderer.invoke("update-employee", id, data),

  deleteEmployee: (id: string) =>
    ipcRenderer.invoke("delete-employee", id),

  // Admin create employee + Supabase Auth user
  createEmployee: (payload: CreateEmployeePayload) =>
    ipcRenderer.invoke("create-employee", payload),

  // Sync existing account by email
  syncEmployeeAccountByEmail: (employeeId: string, email: string) =>
    ipcRenderer.invoke("sync-employee-account-by-email", employeeId, email),

  getEmployeeByUser: (userId: string) =>
    ipcRenderer.invoke("get-employee-by-user", userId),

  getNextEmployeeId: () =>
    ipcRenderer.invoke("get-next-employee-id"),

  // --------------------
  // Time Off
  // --------------------
  getTimeOffRequests: () =>
    ipcRenderer.invoke("get-timeoff-requests"),

  addTimeOffRequest: (data: any) =>
    ipcRenderer.invoke("add-timeoff-request", data),

  updateTimeOffRequestStatus: (id: string, status: string) =>
    ipcRenderer.invoke("update-timeoff-status", id, status),

  // Auto recalc
  recalculateStatuses: () =>
    ipcRenderer.invoke("recalculate-statuses"),

  // --------------------
  // Vehicles
  // --------------------
  getVehicles: () =>
    ipcRenderer.invoke("get-vehicles"),

  addVehicle: (data: any) =>
    ipcRenderer.invoke("add-vehicle", data),

  updateVehicle: (id: string, data: any) =>
    ipcRenderer.invoke("update-vehicle", id, data),

  deleteVehicle: (id: string) =>
    ipcRenderer.invoke("delete-vehicle", id),

  setVehicleStatus: (id: number | string, status: string) =>
    ipcRenderer.invoke("set-vehicle-status", id, status),

  submitVehicleAssessment: (data: any) =>
    ipcRenderer.invoke("vehicles:submitAssessment", data),

  getVehicleAssessments: (vehicleId?: number | string) =>
    ipcRenderer.invoke("vehicles:getAssessments", vehicleId),

  clearVehicleMaintenance: (vehicleId: number | string, notes?: string) =>
    ipcRenderer.invoke("vehicles:clearMaintenance", vehicleId, notes),

  getMaintenanceSchedules: (vehicleId?: number | string) =>
    ipcRenderer.invoke("vehicles:getMaintenanceSchedules", vehicleId),

  logMaintenanceService: (payload: any) =>
    ipcRenderer.invoke("vehicles:logMaintenanceService", payload),

  getFuelEconomy: (vehicleId?: number | string) =>
    ipcRenderer.invoke("vehicles:getFuelEconomy", vehicleId),

  // --------------------
  // Tracking & Estimation
  // --------------------
  tracking: {
    getDualLegEstimate: (payload: {
      hq: { lat: number; lng: number; address?: string };
      pickup: { lat: number; lng: number; address?: string };
      delivery: { lat: number; lng: number; address?: string };
    }) => ipcRenderer.invoke("tracking:getDualLegEstimate", payload),

    estimatePackage: (input: any) =>
      ipcRenderer.invoke("tracking:estimatePackage", input),

    updateDriverLocation: (data: any) =>
      ipcRenderer.invoke("tracking:updateDriverLocation", data),

    getLiveFleetLocations: () =>
      ipcRenderer.invoke("tracking:getLiveFleetLocations"),
  },

  // --------------------
  // Trips & Multi-Stop Runs
  // --------------------
  getTrips: () =>
    ipcRenderer.invoke("get-trips"),

  addTrip: (data: TripData) =>
    ipcRenderer.invoke("add-trip", data),

  updateTripStatus: (id: string | number, status: string) =>
    ipcRenderer.invoke("update-trip-status", id, status),

  deleteTrip: (id: string | number) =>
    ipcRenderer.invoke("delete-trip", id),

  updateTrip: (id: string | number, updates: any) =>
    ipcRenderer.invoke("update-trip", id, updates),

  getTripStops: (tripId: string | number) =>
    ipcRenderer.invoke("trips:getStops", tripId),

  addTripStops: (tripId: string | number, stops: any[]) =>
    ipcRenderer.invoke("trips:addStops", tripId, stops),

  updateTripStop: (stopId: string | number, updates: any) =>
    ipcRenderer.invoke("trips:updateStop", stopId, updates),

  setDriverStatus: (driverId: string, status: string) =>
    ipcRenderer.invoke("set-driver-status", driverId, status),

  // --------------------
  // Clients
  // --------------------
  getClients: () =>
    ipcRenderer.invoke("get-clients"),

  addClient: (data: any) =>
    ipcRenderer.invoke("add-client", data),

  updateClient: (id: string, data: any) =>
    ipcRenderer.invoke("update-client", id, data),

  deleteClient: (id: string) =>
    ipcRenderer.invoke("delete-client", id),

  getClientHistory: (options: any) =>
    ipcRenderer.invoke("get-client-history", options),

  // --------------------
  // Dashboard
  // --------------------
  getDashboardStats: () =>
    ipcRenderer.invoke("get-dashboard-stats"),

  getRecentTrips: () =>
    ipcRenderer.invoke("get-recent-trips"),

  // --------------------
  // Realtime Updates
  // --------------------
  onRealtime: (cb: (evt: any, data: any) => void) => {
    ipcRenderer.on("realtime-update", cb);
    return () => ipcRenderer.removeListener("realtime-update", cb);
  },

  // --------------------
  // Billing
  // --------------------
  billing: {
    getAll: () => ipcRenderer.invoke("billing:getAll"),
    create: (data: any) => ipcRenderer.invoke("billing:create", data),
    delete: (id: number) => ipcRenderer.invoke("billing:delete", id),
    update: (id: number, data: any) =>
      ipcRenderer.invoke("billing:update", id, data),
    getLastNumber: () => ipcRenderer.invoke("billing:getLastNumber"),
    getStats: () => ipcRenderer.invoke("billing:getStats"),
  },

  // --------------------
  // Attendance
  // --------------------
  getAttendance: (employeeId: string) =>
    ipcRenderer.invoke("get-attendance", employeeId),

  addAttendance: (data: any) =>
    ipcRenderer.invoke("add-attendance", data),

  getAllAttendance: (options?: AttendanceFilters) =>
    ipcRenderer.invoke("get-all-attendance", options),

  // --------------------
  // Payroll
  // --------------------
  payroll: {
    getMyMonthly: (userId: string, monthYYYYMM: string) =>
      ipcRenderer.invoke("payroll:getMyMonthly", userId, monthYYYYMM),

    getMonthlyAll: (monthYYYYMM: string) =>
      ipcRenderer.invoke("payroll:getMonthlyAll", monthYYYYMM),

    sendPayslipEmail: (data: any) =>
      ipcRenderer.invoke("payroll:sendPayslipEmail", data),

    finalize: (monthYYYYMM: string) =>
      ipcRenderer.invoke("payroll:finalize", monthYYYYMM),
  },

  // --------------------
  // Notifications
  // --------------------
  notifications: {
    getAll: () => ipcRenderer.invoke("notifications:getAll"),
    create: (data: any) => ipcRenderer.invoke("notifications:create", data),
    triggerAlarm: (data: any) => ipcRenderer.invoke("notifications:triggerAlarm", data),
    broadcast: (data: any) => ipcRenderer.invoke("notifications:broadcast", data),
    markRead: (id: string) => ipcRenderer.invoke("notifications:markRead", id),
    delete: (id: string) => ipcRenderer.invoke("notifications:delete", id),
  },

  // --------------------
  // Proof of Delivery (e-POD)
  // --------------------
  epod: {
    submit: (payload: any) => ipcRenderer.invoke("epod:submit", payload),
    get: (tripId: number | string) => ipcRenderer.invoke("epod:get", tripId),
  },

  // --------------------
  // Expenses & Fuel
  // --------------------
  expenses: {
    log: (payload: any) => ipcRenderer.invoke("expenses:log", payload),
    getByTrip: (tripId: number | string) => ipcRenderer.invoke("expenses:getByTrip", tripId),
    getByVehicle: (vehicleId: number | string) => ipcRenderer.invoke("expenses:getByVehicle", vehicleId),
    getFleetSummary: () => ipcRenderer.invoke("expenses:getFleetSummary"),
  },

  // --------------------
  // Incidents & SOS Alerts
  // --------------------
  incidents: {
    report: (payload: any) => ipcRenderer.invoke("incidents:report", payload),
    getAll: () => ipcRenderer.invoke("incidents:getAll"),
    updateStatus: (incidentId: number, status: string) =>
      ipcRenderer.invoke("incidents:updateStatus", { incidentId, status }),
  },

  // --------------------
  // Car Rental API
  // --------------------
  rentals: {
    getAll: () => ipcRenderer.invoke("rentals:getAll"),
    getById: (id: number | string) => ipcRenderer.invoke("rentals:getById", id),
    checkAvailability: (payload: { vehicle_id: number | string; start_datetime: string; end_datetime: string; exclude_agreement_id?: number | string }) =>
      ipcRenderer.invoke("rentals:checkAvailability", payload),
    create: (payload: any) => ipcRenderer.invoke("rentals:create", payload),
    updateStatus: (id: number | string, status: string) =>
      ipcRenderer.invoke("rentals:updateStatus", id, status),
    checkout: (payload: any) => ipcRenderer.invoke("rentals:checkout", payload),
    return: (payload: any) => ipcRenderer.invoke("rentals:return", payload),
    delete: (id: number | string) => ipcRenderer.invoke("rentals:delete", id),
  },

  // --------------------
  // Super Admin Governance API
  // --------------------
  governance: {
    getAuditLogs: (options?: any) => ipcRenderer.invoke("governance:getAuditLogs", options),
    logAction: (payload: any) => ipcRenderer.invoke("governance:logAction", payload),
  },
});