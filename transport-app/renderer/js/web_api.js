/**
 * web_api.js — Browser-native drop-in replacement for Electron's window.api
 * 
 * Provides 100% method compatibility with preload.ts by forwarding requests to
 * the Express REST backend and subscribing to Supabase Realtime via WebSockets.
 */

(function () {
  if (typeof window === "undefined") return;

  const API_BASE = window.location.origin;

  // Supabase browser client for Realtime updates
  const SUPABASE_URL = "https://uocavssoqmwjstmvdgwq.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvY2F2c3NvcW13anN0bXZkZ3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5OTg2NjEsImV4cCI6MjA3NzU3NDY2MX0.Ki2CEQ7Wqt4eTCOHs1o0mxKdcywtBh7eEk0JAe9H4xk";

  let browserSupabase = null;
  if (typeof window.supabase !== "undefined" && typeof window.supabase.createClient === "function") {
    browserSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // Universal fetch helper
  async function apiFetch(endpoint, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    try {
      const res = await fetch(url, {
        ...options,
        headers
      });

      const json = await res.json();
      return json;
    } catch (err) {
      console.error(`[web_api] Request error on ${endpoint}:`, err);
      return { success: false, ok: false, error: err.message, message: err.message };
    }
  }

  // Define window.api
  window.api = {
    // --------------------
    // Auth API
    // --------------------
    login: async (email, password) => {
      return apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
    },

    register: async (data) => {
      return apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },

    resetPassword: async (email) => {
      return apiFetch("/api/auth/send-recovery-code", {
        method: "POST",
        body: JSON.stringify({ email })
      });
    },

    verifyRecoveryCode: async (email, code) => {
      return apiFetch("/api/auth/verify-recovery-code", {
        method: "POST",
        body: JSON.stringify({ email, code })
      });
    },

    updatePasswordWithCode: async (email, code, newPassword) => {
      return apiFetch("/api/auth/update-password-with-code", {
        method: "POST",
        body: JSON.stringify({ email, code, newPassword })
      });
    },

    verifySignupCode: async (email, code) => {
      return apiFetch("/api/auth/verify-signup-code", {
        method: "POST",
        body: JSON.stringify({ email, code })
      });
    },

    resendSignupCode: async (email) => {
      return apiFetch("/api/auth/resend-signup-code", {
        method: "POST",
        body: JSON.stringify({ email })
      });
    },

    // Super Admin Operations
    admin: {
      getPendingUsers: async () => {
        return apiFetch("/api/auth/admin/pending-users");
      },
      getAllUsers: async () => {
        return apiFetch("/api/auth/admin/all-users");
      },
      approveUser: async (userId) => {
        return apiFetch("/api/auth/admin/approve-user", {
          method: "POST",
          body: JSON.stringify({ userId })
        });
      },
      rejectUser: async (userId) => {
        return apiFetch("/api/auth/admin/reject-user", {
          method: "POST",
          body: JSON.stringify({ userId })
        });
      },
      deleteUser: async (userId) => {
        return apiFetch(`/api/auth/admin/user/${encodeURIComponent(userId)}`, {
          method: "DELETE"
        });
      }
    },

    // --------------------
    // Employees
    // --------------------
    getEmployees: async () => {
      const res = await apiFetch("/api/employees");
      return Array.isArray(res) ? res : res.data || [];
    },

    getEmployeeById: async (id) => {
      return apiFetch(`/api/employees/${encodeURIComponent(id)}`);
    },

    addEmployee: async (data) => {
      return apiFetch("/api/employees", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },

    updateEmployee: async (id, data) => {
      return apiFetch(`/api/employees/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(data)
      });
    },

    deleteEmployee: async (id) => {
      return apiFetch(`/api/employees/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
    },

    createEmployee: async (payload) => {
      return apiFetch("/api/employees/create", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },

    createEmployeeAccount: async (employeeId, username, authPassword) => {
      return apiFetch("/api/employees/create", {
        method: "POST",
        body: JSON.stringify({ employee_id: employeeId, email: username, auth_password: authPassword, full_name: username })
      });
    },

    syncEmployeeAccountByEmail: async (employeeId, email) => {
      return apiFetch("/api/employees/sync-email", {
        method: "POST",
        body: JSON.stringify({ employeeId, email })
      });
    },

    getEmployeeByUser: async (userId) => {
      return apiFetch(`/api/employees/by-user/${encodeURIComponent(userId)}`);
    },

    getNextEmployeeId: async () => {
      return apiFetch("/api/employees/next-id");
    },

    setDriverStatus: async (driverId, status) => {
      return apiFetch(`/api/employees/${encodeURIComponent(driverId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
    },

    // --------------------
    // Time Off & Requests
    // --------------------
    getTimeOffRequests: async () => {
      const res = await apiFetch("/api/requests/timeoff");
      return Array.isArray(res) ? res : res.data || [];
    },

    addTimeOffRequest: async (data) => {
      return apiFetch("/api/requests/timeoff", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },

    updateTimeOffRequestStatus: async (id, status) => {
      return apiFetch(`/api/requests/timeoff/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
    },

    recalculateStatuses: async () => {
      return apiFetch("/api/requests/recalculate-statuses", {
        method: "POST"
      });
    },

    // --------------------
    // Vehicles
    // --------------------
    getVehicles: async () => {
      const res = await apiFetch("/api/vehicles");
      return Array.isArray(res) ? res : res.data || [];
    },

    addVehicle: async (data) => {
      return apiFetch("/api/vehicles", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },

    updateVehicle: async (id, data) => {
      return apiFetch(`/api/vehicles/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(data)
      });
    },

    deleteVehicle: async (id) => {
      return apiFetch(`/api/vehicles/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
    },

    setVehicleStatus: async (id, status) => {
      return apiFetch(`/api/vehicles/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
    },

    submitVehicleAssessment: async (data) => {
      return apiFetch("/api/vehicles/assessments", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },

    getVehicleAssessments: async (vehicleId) => {
      const endpoint = vehicleId ? `/api/vehicles/assessments/all?vehicle_id=${encodeURIComponent(vehicleId)}` : "/api/vehicles/assessments/all";
      const res = await apiFetch(endpoint);
      return res.data || res || [];
    },

    clearVehicleMaintenance: async (vehicleId, notes) => {
      return apiFetch(`/api/vehicles/${encodeURIComponent(vehicleId)}/clear-maintenance`, {
        method: "POST",
        body: JSON.stringify({ notes })
      });
    },

    // --------------------
    // Tracking & Estimation
    // --------------------
    tracking: {
      getDualLegEstimate: async (payload) => {
        return apiFetch("/api/tracking/estimate-route", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      estimatePackage: async (input) => {
        return apiFetch("/api/tracking/estimate-package", {
          method: "POST",
          body: JSON.stringify(input)
        });
      },
      updateDriverLocation: async (data) => {
        return apiFetch("/api/tracking/driver-location", {
          method: "POST",
          body: JSON.stringify(data)
        });
      },
      getLiveFleetLocations: async () => {
        const res = await apiFetch("/api/tracking/fleet-locations");
        return res.data || res || [];
      }
    },

    // --------------------
    // Trips
    // --------------------
    getTrips: async () => {
      const res = await apiFetch("/api/trips");
      return Array.isArray(res) ? res : res.data || [];
    },

    addTrip: async (data) => {
      return apiFetch("/api/trips", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },

    updateTripStatus: async (id, status) => {
      return apiFetch(`/api/trips/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
    },

    deleteTrip: async (id) => {
      return apiFetch(`/api/trips/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
    },

    updateTrip: async (id, updates) => {
      return apiFetch(`/api/trips/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(updates)
      });
    },

    getRecentTrips: async () => {
      const res = await apiFetch("/api/trips/recent");
      return Array.isArray(res) ? res : res.data || [];
    },

    getDashboardStats: async () => {
      const res = await apiFetch("/api/dashboard/stats");
      return (res && typeof res === "object") ? res : { employeeCount: 0, clientCount: 0, vehicleCount: 0, tripCount: 0 };
    },

    // --------------------
    // Clients
    // --------------------
    getClients: async () => {
      const res = await apiFetch("/api/clients");
      return Array.isArray(res) ? res : res.data || [];
    },

    addClient: async (data) => {
      return apiFetch("/api/clients", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },

    updateClient: async (id, data) => {
      return apiFetch(`/api/clients/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(data)
      });
    },

    deleteClient: async (id) => {
      return apiFetch(`/api/clients/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
    },

    getClientHistory: async (options = {}) => {
      const params = new URLSearchParams();
      if (options.clientId) params.append("clientId", options.clientId);
      const res = await apiFetch(`/api/clients/history?${params.toString()}`);
      return Array.isArray(res) ? res : res.data || [];
    },

    // --------------------
    // Dashboard
    // --------------------
    getDashboardStats: async () => {
      return apiFetch("/api/dashboard/stats");
    },

    // --------------------
    // Realtime Updates
    // --------------------
    onRealtime: (callback) => {
      if (!browserSupabase) {
        if (typeof window.supabase !== "undefined" && typeof window.supabase.createClient === "function") {
          browserSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
      }

      if (!browserSupabase) {
        console.warn("[web_api] Supabase JS library not found. Realtime updates disabled.");
        return () => {};
      }

      try {
        const channelName = `web_realtime_${Math.random().toString(36).substring(2, 9)}`;
        const channel = browserSupabase.channel(channelName);

        const tables = ["trips", "vehicles", "employees", "notifications", "attendance", "invoices", "time_off_requests", "clients"];
        tables.forEach((table) => {
          channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
            callback(null, { table, payload });
          });
        });

        channel.subscribe((status) => {
          console.log(`[web_api] Realtime subscription status (${channelName}):`, status);
        });

        return () => {
          try {
            browserSupabase.removeChannel(channel);
          } catch (e) {
            console.warn("[web_api] Error unsubscribing realtime channel:", e);
          }
        };
      } catch (err) {
        console.error("[web_api] Failed to setup realtime:", err);
        return () => {};
      }
    },

    // --------------------
    // Billing
    // --------------------
    billing: {
      getAll: async () => {
        const res = await apiFetch("/api/billing");
        return Array.isArray(res) ? res : res.data || [];
      },
      create: async (data) => {
        return apiFetch("/api/billing", {
          method: "POST",
          body: JSON.stringify(data)
        });
      },
      delete: async (id) => {
        return apiFetch(`/api/billing/${encodeURIComponent(id)}`, {
          method: "DELETE"
        });
      },
      update: async (id, data) => {
        return apiFetch(`/api/billing/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(data)
        });
      },
      getLastNumber: async () => {
        return apiFetch("/api/billing/last-number");
      },
      getStats: async () => {
        return apiFetch("/api/billing/stats");
      }
    },

    // --------------------
    // Attendance
    // --------------------
    getAttendance: async (employeeId) => {
      const res = await apiFetch(`/api/requests/attendance/${encodeURIComponent(employeeId)}`);
      return Array.isArray(res) ? res : res.data || [];
    },

    addAttendance: async (data) => {
      return apiFetch("/api/requests/attendance", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },

    getAllAttendance: async (options = {}) => {
      const params = new URLSearchParams();
      if (options.employeeId) params.append("employeeId", options.employeeId);
      if (options.startDate) params.append("startDate", options.startDate);
      if (options.endDate) params.append("endDate", options.endDate);
      const res = await apiFetch(`/api/requests/attendance?${params.toString()}`);
      return Array.isArray(res) ? res : res.data || [];
    },

    // --------------------
    // Payroll
    // --------------------
    payroll: {
      getMyMonthly: async (userId, monthYYYYMM) => {
        return apiFetch(`/api/payroll/my-monthly?userId=${encodeURIComponent(userId)}&month=${encodeURIComponent(monthYYYYMM)}`);
      },
      getMonthlyAll: async (monthYYYYMM) => {
        return apiFetch(`/api/payroll/monthly-all?month=${encodeURIComponent(monthYYYYMM)}`);
      },
      sendPayslipEmail: async (data) => {
        return apiFetch("/api/payroll/send-payslip", {
          method: "POST",
          body: JSON.stringify(data)
        });
      },
      finalize: async (monthYYYYMM) => {
        return apiFetch("/api/payroll/finalize", {
          method: "POST",
          body: JSON.stringify({ month: monthYYYYMM })
        });
      }
    },

    // --------------------
    // Notifications
    // --------------------
    notifications: {
      getAll: async () => {
        const res = await apiFetch("/api/notifications");
        return Array.isArray(res) ? res : res.data || [];
      },
      create: async (data) => {
        return apiFetch("/api/notifications", {
          method: "POST",
          body: JSON.stringify(data)
        });
      },
      triggerAlarm: async (data) => {
        return apiFetch("/api/notifications/alarm", {
          method: "POST",
          body: JSON.stringify(data)
        });
      },
      broadcast: async (data) => {
        return apiFetch("/api/notifications/broadcast", {
          method: "POST",
          body: JSON.stringify(data)
        });
      },
      markRead: async (id) => {
        return apiFetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
          method: "PATCH"
        });
      },
      delete: async (id) => {
        return apiFetch(`/api/notifications/${encodeURIComponent(id)}`, {
          method: "DELETE"
        });
      }
    },

    // --------------------
    // Proof of Delivery (e-POD)
    // --------------------
    epod: {
      submit: async (payload) => {
        return apiFetch("/api/epod/submit", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      get: async (tripId) => {
        return apiFetch(`/api/epod/${encodeURIComponent(tripId)}`);
      }
    },

    // --------------------
    // Expenses & Fuel
    // --------------------
    expenses: {
      log: async (payload) => {
        return apiFetch("/api/expenses/log", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      getByTrip: async (tripId) => {
        return apiFetch(`/api/expenses/trip/${encodeURIComponent(tripId)}`);
      },
      getByVehicle: async (vehicleId) => {
        return apiFetch(`/api/expenses/vehicle/${encodeURIComponent(vehicleId)}`);
      },
      getFleetSummary: async () => {
        return apiFetch("/api/expenses/fleet-summary");
      }
    },

    // --------------------
    // Incidents & SOS Alerts
    // --------------------
    incidents: {
      report: async (payload) => {
        return apiFetch("/api/incidents/report", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      getAll: async () => {
        return apiFetch("/api/incidents/all");
      },
      updateStatus: async (incidentId, status) => {
        return apiFetch(`/api/incidents/${encodeURIComponent(incidentId)}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status })
        });
      }
    }
  };

  console.log("[web_api] JRR Transport Web API bridge initialized with full method parity.");
})();
