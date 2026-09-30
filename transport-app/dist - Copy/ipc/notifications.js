"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupNotificationIPC = setupNotificationIPC;
exports.createNotificationForEmployee = createNotificationForEmployee;
const electron_1 = require("electron");
const utils_1 = require("./utils");
function setupNotificationIPC() {
    // Get all notifications (admin view)
    electron_1.ipcMain.handle("notifications:getAll", async () => {
        const { data } = await utils_1.supabaseAdmin
            .from("notifications")
            .select(`
        *,
        employees:employee_id ( full_name, employee_id )
      `)
            .order("created_at", { ascending: false });
        return data || [];
    });
    // Create a notification for a specific employee
    electron_1.ipcMain.handle("notifications:create", async (_, payload) => {
        return (0, utils_1.handleSupabase)(utils_1.supabaseAdmin.from("notifications").insert([{
                employee_id: payload.employee_id,
                title: payload.title,
                message: payload.message,
                type: payload.type || "other",
                urgency: payload.urgency || "normal",
                target_role: payload.target_role || "driver",
                metadata: payload.metadata || {},
                is_read: false
            }]).select());
    });
    // Trigger Urgent Alarm / SOS Alert (Broadcasts to all admins or drivers with alarm sound)
    electron_1.ipcMain.handle("notifications:triggerAlarm", async (_, payload) => {
        try {
            const targetRole = payload.target_role || "all";
            let query = utils_1.supabaseAdmin.from("employees").select("id");
            if (targetRole === "driver") {
                query = query.ilike("position", "%driver%");
            }
            const { data: employees, error: empErr } = await query;
            if (empErr || !employees?.length) {
                return { success: false, error: empErr?.message || "No matching recipients found." };
            }
            const notifications = employees.map(emp => ({
                employee_id: emp.id,
                title: payload.title,
                message: payload.message,
                type: "alert",
                urgency: "alarm",
                target_role: targetRole,
                metadata: payload.metadata || {},
                is_read: false
            }));
            const { error } = await utils_1.supabaseAdmin.from("notifications").insert(notifications);
            if (error)
                return { success: false, error: error.message };
            return { success: true, count: notifications.length };
        }
        catch (err) {
            return { success: false, error: err?.message || "Unknown error" };
        }
    });
    // Broadcast a notification to ALL employees
    electron_1.ipcMain.handle("notifications:broadcast", async (_, payload) => {
        try {
            const { data: employees, error: empErr } = await utils_1.supabaseAdmin
                .from("employees")
                .select("id")
                .in("status", ["active", "available", "in-use"]);
            if (empErr || !employees?.length) {
                return { success: false, error: empErr?.message || "No active employees found." };
            }
            const notifications = employees.map(emp => ({
                employee_id: emp.id,
                title: payload.title,
                message: payload.message,
                type: payload.type || "announcement",
                urgency: payload.urgency || "normal",
                target_role: "all",
                is_read: false
            }));
            const { error } = await utils_1.supabaseAdmin
                .from("notifications")
                .insert(notifications);
            if (error)
                return { success: false, error: error.message };
            return { success: true, count: notifications.length };
        }
        catch (err) {
            return { success: false, error: err?.message || "Unknown error" };
        }
    });
    // Mark notification as read
    electron_1.ipcMain.handle("notifications:markRead", async (_, id) => {
        return (0, utils_1.handleSupabase)(utils_1.supabaseAdmin.from("notifications").update({ is_read: true }).eq("id", id).select());
    });
    // Delete a notification
    electron_1.ipcMain.handle("notifications:delete", async (_, id) => {
        return (0, utils_1.handleSupabase)(utils_1.supabaseAdmin.from("notifications").delete().eq("id", id));
    });
}
/**
 * Helper: Insert a notification for a specific employee.
 * Used internally by other IPC modules (trips, requests, payroll).
 */
async function createNotificationForEmployee(employeeId, title, message, type = "other", urgency = "normal") {
    try {
        await utils_1.supabaseAdmin.from("notifications").insert([{
                employee_id: employeeId,
                title,
                message,
                type,
                urgency,
                is_read: false
            }]);
    }
    catch (err) {
        console.warn("[Notifications] Failed to create notification:", err);
    }
}
//# sourceMappingURL=notifications.js.map