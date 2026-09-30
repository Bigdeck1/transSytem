"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestsRouter = void 0;
const express_1 = require("express");
const supabase_1 = require("../config/supabase");
const notifications_routes_1 = require("./notifications.routes");
exports.requestsRouter = (0, express_1.Router)();
// Recalculate time-off statuses
exports.requestsRouter.post("/recalculate-statuses", async (_req, res) => {
    try {
        const now = new Date().toISOString().split("T")[0];
        const p1 = supabase_1.supabaseAdmin
            .from("time_off_requests")
            .update({ status: "Completed" })
            .lt("end_date", now)
            .in("status", ["Approved", "Ongoing"])
            .neq("status", "Completed");
        const p2 = supabase_1.supabaseAdmin
            .from("time_off_requests")
            .update({ status: "Ongoing" })
            .lte("start_date", now)
            .gte("end_date", now)
            .eq("status", "Approved");
        await Promise.all([p1, p2]);
        return res.json({ success: true, ok: true });
    }
    catch (err) {
        return res.status(500).json({ success: false, ok: false, error: err?.message || String(err) });
    }
});
// GET attendance for single employee
exports.requestsRouter.get("/attendance/:employeeId", async (req, res) => {
    const { data } = await supabase_1.supabaseAdmin
        .from("attendance")
        .select("*")
        .eq("employee_id", req.params.employeeId)
        .order("date", { ascending: false });
    return res.json(data || []);
});
// GET all attendance with optional filters
exports.requestsRouter.get("/attendance", async (req, res) => {
    try {
        const { employeeId, startDate, endDate } = req.query;
        let q = supabase_1.supabaseAdmin
            .from("attendance")
            .select(`
        id, date, check_in, check_out, employee_id,
        employees:employee_id ( full_name, employee_id )
      `)
            .order("date", { ascending: false });
        if (employeeId)
            q = q.eq("employee_id", String(employeeId));
        if (startDate)
            q = q.gte("date", String(startDate));
        if (endDate)
            q = q.lte("date", String(endDate));
        const { data, error } = await q;
        if (error)
            throw error;
        const formatted = (data ?? []).map((r) => ({
            id: r.id,
            date: r.date,
            check_in: r.check_in,
            check_out: r.check_out,
            employee_id: r.employee_id,
            employee_name: r.employees?.full_name ?? "—",
            employee_code: r.employees?.employee_id ?? "—",
        }));
        return res.json(formatted);
    }
    catch (err) {
        return res.json([]);
    }
});
// ADD attendance record
exports.requestsRouter.post("/attendance", async (req, res) => {
    const attendanceData = req.body;
    if (!attendanceData.employee_id) {
        return res.status(400).json({ error: "Employee ID is required." });
    }
    if (!attendanceData.date) {
        return res.status(400).json({ error: "Date is required." });
    }
    // Duplicate guard
    const { data: existing } = await supabase_1.supabaseAdmin
        .from("attendance")
        .select("id")
        .eq("employee_id", attendanceData.employee_id)
        .eq("date", attendanceData.date)
        .maybeSingle();
    if (existing) {
        return res.status(400).json({ error: `Attendance record already exists for this employee on ${attendanceData.date}.` });
    }
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabaseAdmin.from("attendance").insert([attendanceData]).select());
    return res.json(result);
});
// GET time-off requests
exports.requestsRouter.get("/timeoff", async (_req, res) => {
    const { data } = await supabase_1.supabaseAdmin
        .from("time_off_requests")
        .select("*, employees:employee_id ( full_name )")
        .order("created_at", { ascending: false });
    return res.json(data || []);
});
// ADD time-off request
exports.requestsRouter.post("/timeoff", async (req, res) => {
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabaseAdmin.from("time_off_requests").insert([req.body]).select());
    return res.json(result);
});
// UPDATE time-off status
exports.requestsRouter.patch("/timeoff/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabaseAdmin.from("time_off_requests").update({ status }).eq("id", id).select().single());
    if (result.success && result.data) {
        const request = result.data;
        if (status.toLowerCase() === "approved" || status.toLowerCase() === "denied") {
            await (0, notifications_routes_1.createNotificationForEmployee)(request.employee_id, `Time-Off Request ${status}`, `Your time-off request for ${request.start_date} to ${request.end_date} has been ${status.toLowerCase()}.`, "alert");
        }
    }
    return res.json(result);
});
//# sourceMappingURL=requests.routes.js.map