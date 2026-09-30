"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRequestIPC = setupRequestIPC;
const electron_1 = require("electron");
const utils_1 = require("./utils");
const notifications_1 = require("./notifications");
function setupRequestIPC() {
    electron_1.ipcMain.handle("recalculate-statuses", async () => {
        try {
            // Use date-only string (YYYY-MM-DD) for comparison against date-type columns
            const now = new Date().toISOString().split("T")[0];
            // IMPORTANT: Only auto-recalculate statuses that haven't been manually Approved or Denied.
            // Approved/Denied decisions are admin actions and must be preserved.
            // Mark completed (past end_date) — only for Approved/Ongoing requests, not Denied
            const p1 = utils_1.supabaseAdmin
                .from("time_off_requests")
                .update({ status: "Completed" })
                .lt("end_date", now)
                .in("status", ["Approved", "Ongoing"])
                .neq("status", "Completed");
            // Mark ongoing (within date range) — only for Approved requests
            const p2 = utils_1.supabaseAdmin
                .from("time_off_requests")
                .update({ status: "Ongoing" })
                .lte("start_date", now)
                .gte("end_date", now)
                .eq("status", "Approved");
            // Note: We no longer auto-reset to "Pending" — that overwrote admin decisions.
            await Promise.all([p1, p2]);
            return { success: true };
        }
        catch (err) {
            console.error("Error recalculating statuses:", err);
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    });
    electron_1.ipcMain.handle("get-attendance", async (_, employeeId) => {
        const { data } = await utils_1.supabaseAdmin
            .from("attendance")
            .select("*")
            .eq("employee_id", employeeId)
            .order("date", { ascending: false });
        return data || [];
    });
    electron_1.ipcMain.handle("add-attendance", async (_, attendanceData) => {
        // Validate required fields
        if (!attendanceData.employee_id) {
            return { error: "Employee ID is required." };
        }
        if (!attendanceData.date) {
            return { error: "Date is required." };
        }
        // Duplicate guard: check if attendance already exists for this employee on this date
        const { data: existing } = await utils_1.supabaseAdmin
            .from("attendance")
            .select("id")
            .eq("employee_id", attendanceData.employee_id)
            .eq("date", attendanceData.date)
            .maybeSingle();
        if (existing) {
            return { error: `Attendance record already exists for this employee on ${attendanceData.date}. Use edit instead.` };
        }
        const res = await (0, utils_1.handleSupabase)(utils_1.supabaseAdmin.from("attendance").insert([attendanceData]).select());
        if (!res.success)
            return { error: res.error };
        return { data: res.data };
    });
    electron_1.ipcMain.handle("get-all-attendance", async (_, options) => {
        try {
            let q = utils_1.supabaseAdmin
                .from("attendance")
                .select(`
            id, date, check_in, check_out, employee_id,
            employees:employee_id ( full_name, employee_id )
          `)
                .order("date", { ascending: false });
            if (options?.employeeId)
                q = q.eq("employee_id", options.employeeId);
            if (options?.startDate)
                q = q.gte("date", options.startDate);
            if (options?.endDate)
                q = q.lte("date", options.endDate);
            const { data, error } = await q;
            if (error)
                throw error;
            return (data ?? []).map((r) => ({
                id: r.id,
                date: r.date,
                check_in: r.check_in,
                check_out: r.check_out,
                employee_id: r.employee_id,
                employee_name: r.employees?.full_name ?? "—",
                employee_code: r.employees?.employee_id ?? "—",
            }));
        }
        catch (err) {
            return [];
        }
    });
    electron_1.ipcMain.handle("get-timeoff-requests", async () => {
        const { data } = await utils_1.supabaseAdmin
            .from("time_off_requests")
            .select("*, employees:employee_id ( full_name )")
            .order("created_at", { ascending: false });
        return data || [];
    });
    electron_1.ipcMain.handle("add-timeoff-request", async (_, data) => {
        return (0, utils_1.handleSupabase)(utils_1.supabaseAdmin.from("time_off_requests").insert([data]).select());
    });
    electron_1.ipcMain.handle("update-timeoff-status", async (_, id, status) => {
        const res = await (0, utils_1.handleSupabase)(utils_1.supabaseAdmin.from("time_off_requests").update({ status }).eq("id", id).select().single());
        if (res.success && res.data) {
            const request = res.data;
            if (status.toLowerCase() === "approved" || status.toLowerCase() === "denied") {
                await (0, notifications_1.createNotificationForEmployee)(request.employee_id, `Time-Off Request ${status}`, `Your time-off request for ${request.start_date} to ${request.end_date} has been ${status.toLowerCase()}.`, "alert");
            }
        }
        return res;
    });
}
//# sourceMappingURL=requests.js.map