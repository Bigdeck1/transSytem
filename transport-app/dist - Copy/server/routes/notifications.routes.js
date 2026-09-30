"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
exports.createNotificationForEmployee = createNotificationForEmployee;
const express_1 = require("express");
const supabase_1 = require("../config/supabase");
exports.notificationsRouter = (0, express_1.Router)();
// Helper function used by other route modules
async function createNotificationForEmployee(employeeId, title, message, type = "other") {
    try {
        await supabase_1.supabaseAdmin.from("notifications").insert([{
                employee_id: employeeId,
                title,
                message,
                type,
                is_read: false
            }]);
    }
    catch (err) {
        console.warn("[SERVER][Notifications] Failed to create notification:", err);
    }
}
// GET all notifications (admin view)
exports.notificationsRouter.get("/", async (_req, res) => {
    const { data } = await supabase_1.supabaseAdmin
        .from("notifications")
        .select(`
      *,
      employees:employee_id ( full_name, employee_id )
    `)
        .order("created_at", { ascending: false });
    return res.json(data || []);
});
// CREATE single notification
exports.notificationsRouter.post("/", async (req, res) => {
    const { employee_id, title, message, type, urgency, target_role, metadata } = req.body;
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabaseAdmin.from("notifications").insert([{
            employee_id,
            title,
            message,
            type: type || "other",
            urgency: urgency || "normal",
            target_role: target_role || "driver",
            metadata: metadata || {},
            is_read: false
        }]).select());
    return res.json(result);
});
// TRIGGER URGENT ALARM / SOS ALERT
exports.notificationsRouter.post("/alarm", async (req, res) => {
    try {
        const { title, message, target_role, metadata } = req.body;
        const targetRole = target_role || "all";
        let query = supabase_1.supabaseAdmin.from("employees").select("id");
        if (targetRole === "driver") {
            query = query.ilike("position", "%driver%");
        }
        const { data: employees, error: empErr } = await query;
        if (empErr || !employees?.length) {
            return res.status(400).json({ success: false, error: empErr?.message || "No recipients found." });
        }
        const notifications = employees.map(emp => ({
            employee_id: emp.id,
            title,
            message,
            type: "alert",
            urgency: "alarm",
            target_role: targetRole,
            metadata: metadata || {},
            is_read: false
        }));
        const { error } = await supabase_1.supabaseAdmin.from("notifications").insert(notifications);
        if (error)
            return res.status(500).json({ success: false, error: error.message });
        return res.json({ success: true, count: notifications.length });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err?.message || "Unknown error" });
    }
});
// BROADCAST notification to all active employees
exports.notificationsRouter.post("/broadcast", async (req, res) => {
    try {
        const { title, message, type, urgency } = req.body;
        const { data: employees, error: empErr } = await supabase_1.supabaseAdmin
            .from("employees")
            .select("id")
            .in("status", ["active", "available", "in-use"]);
        if (empErr || !employees?.length) {
            return res.status(400).json({ success: false, error: empErr?.message || "No active employees found." });
        }
        const notifications = employees.map(emp => ({
            employee_id: emp.id,
            title,
            message,
            type: type || "announcement",
            urgency: urgency || "normal",
            target_role: "all",
            is_read: false
        }));
        const { error } = await supabase_1.supabaseAdmin
            .from("notifications")
            .insert(notifications);
        if (error)
            return res.status(500).json({ success: false, error: error.message });
        return res.json({ success: true, count: notifications.length });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err?.message || "Unknown error" });
    }
});
// REGISTER push device token
exports.notificationsRouter.post("/device-token", async (req, res) => {
    const { employee_id, expo_push_token, platform } = req.body;
    if (!employee_id || !expo_push_token) {
        return res.status(400).json({ success: false, error: "employee_id and expo_push_token are required." });
    }
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabaseAdmin.from("device_tokens").upsert({
        employee_id,
        expo_push_token,
        platform: platform || "android",
        updated_at: new Date().toISOString()
    }).select());
    return res.json(result);
});
// MARK notification as read
exports.notificationsRouter.patch("/:id/read", async (req, res) => {
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabaseAdmin.from("notifications").update({ is_read: true }).eq("id", req.params.id).select());
    return res.json(result);
});
// DELETE notification
exports.notificationsRouter.delete("/:id", async (req, res) => {
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabaseAdmin.from("notifications").delete().eq("id", req.params.id));
    return res.json(result);
});
//# sourceMappingURL=notifications.routes.js.map