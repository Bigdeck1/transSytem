"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.employeesRouter = void 0;
const express_1 = require("express");
const supabase_1 = require("../config/supabase");
exports.employeesRouter = (0, express_1.Router)();
// GET all employees
exports.employeesRouter.get("/", async (_req, res) => {
    const { data } = await supabase_1.supabase.from("employees").select("*").order("id");
    return res.json(data || []);
});
// GET next employee ID
exports.employeesRouter.get("/next-id", async (_req, res) => {
    try {
        const { data, error } = await supabase_1.supabase.from("employees").select("employee_id");
        if (error)
            throw error;
        const START = 8;
        let max = START - 1;
        (data || []).forEach((emp) => {
            const s = String(emp.employee_id || "").trim().toUpperCase();
            if (s.startsWith("EMP")) {
                const n = parseInt(s.slice(3), 10);
                if (Number.isFinite(n) && n > max)
                    max = n;
            }
        });
        const next = max + 1;
        return res.json(`EMP${String(next).padStart(4, "0")}`);
    }
    catch (err) {
        console.error("[SERVER] Error getting next employee ID:", err);
        return res.json("EMP0008");
    }
});
// GET employee by ID
exports.employeesRouter.get("/:id", async (req, res) => {
    const { data } = await supabase_1.supabase
        .from("employees")
        .select("*")
        .eq("id", req.params.id)
        .maybeSingle();
    return res.json(data);
});
// GET employee by supabase_user_id
exports.employeesRouter.get("/by-user/:userId", async (req, res) => {
    const { data } = await supabase_1.supabase
        .from("employees")
        .select("*")
        .eq("supabase_user_id", req.params.userId)
        .maybeSingle();
    return res.json(data);
});
// ADD employee (basic insert)
exports.employeesRouter.post("/", async (req, res) => {
    const cleanEmployeeData = { ...req.body };
    delete cleanEmployeeData.employee_pin4;
    if (!cleanEmployeeData.full_name || !cleanEmployeeData.full_name.trim()) {
        return res.status(400).json({ error: "Employee name is required." });
    }
    if (cleanEmployeeData.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmployeeData.email.trim())) {
            return res.status(400).json({ error: "Invalid email format." });
        }
    }
    if (cleanEmployeeData.daily_rate !== undefined && Number(cleanEmployeeData.daily_rate) < 0) {
        return res.status(400).json({ error: "Daily rate cannot be negative." });
    }
    if (cleanEmployeeData.salary !== undefined && Number(cleanEmployeeData.salary) < 0) {
        return res.status(400).json({ error: "Salary cannot be negative." });
    }
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabase.from("employees").insert([cleanEmployeeData]).select());
    return res.json(result);
});
// CREATE employee + Supabase Auth account (Admin)
exports.employeesRouter.post("/create", async (req, res) => {
    try {
        const { full_name, email, phone, status, position, department, auth_password, daily_rate, salary, employee_id } = req.body;
        if (!full_name || !full_name.trim()) {
            return res.status(400).json({ ok: false, message: "Employee name is required." });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ ok: false, message: "Email is required." });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({ ok: false, message: "Invalid email format." });
        }
        if (daily_rate !== undefined && Number(daily_rate) < 0) {
            return res.status(400).json({ ok: false, message: "Daily rate cannot be negative." });
        }
        if (salary !== undefined && Number(salary) < 0) {
            return res.status(400).json({ ok: false, message: "Salary cannot be negative." });
        }
        console.log(`[SERVER][create-employee] Processing registration for ${full_name} (${email})`);
        // 1. Create Supabase Auth user via Admin API
        let { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
            email,
            password: auth_password || `EMP${employee_id?.slice(-4) || "1234"}`,
            email_confirm: true,
            user_metadata: { full_name }
        });
        if (authError && authError.message.toLowerCase().includes("already registered")) {
            const { data: users } = await supabase_1.supabaseAdmin.auth.admin.listUsers();
            const existingUser = users?.users?.find(u => u.email === email);
            if (existingUser) {
                authData = { user: existingUser };
                authError = null;
            }
            else {
                return res.status(400).json({ ok: false, message: "User exists in Auth but could not be retrieved." });
            }
        }
        if (authError) {
            return res.status(400).json({ ok: false, message: `Auth Error: ${authError.message}` });
        }
        if (!authData?.user) {
            return res.status(400).json({ ok: false, message: "Failed to create Auth user." });
        }
        // 2. Create Employee Profile via Admin client
        const insertData = {
            employee_id,
            full_name,
            email,
            phone,
            status: status || "active",
            position: position || "Staff",
            department: department || "General",
            daily_rate: Number(daily_rate) || 0,
            salary: Number(salary) || 0,
            supabase_user_id: authData.user.id,
            hire_date: new Date().toISOString().split("T")[0]
        };
        const { error: empError } = await supabase_1.supabaseAdmin
            .from("employees")
            .insert([insertData]);
        if (empError) {
            return res.status(400).json({ ok: false, message: `Database Error: ${empError.message}` });
        }
        return res.json({ ok: true, success: true });
    }
    catch (err) {
        return res.status(500).json({ ok: false, message: `Unexpected error: ${(0, supabase_1.getErrorMessage)(err)}` });
    }
});
// UPDATE employee
exports.employeesRouter.put("/:id", async (req, res) => {
    const cleanUpdatedData = { ...req.body };
    delete cleanUpdatedData.employee_pin4;
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabase.from("employees").update(cleanUpdatedData).eq("id", req.params.id).select());
    return res.json(result);
});
// DELETE employee + Auth user cleanup
exports.employeesRouter.delete("/:id", async (req, res) => {
    const { id } = req.params;
    // Cascade protection: check active trips
    const { data: activeTrips } = await supabase_1.supabase
        .from("trips")
        .select("id, trip_number")
        .eq("driver_id", id)
        .in("status", ["pending", "scheduled", "in transit", "in-transit"]);
    if (activeTrips && activeTrips.length > 0) {
        return res.status(400).json({
            success: false,
            ok: false,
            error: `Cannot delete: employee has ${activeTrips.length} active trip(s). Complete or cancel them first.`
        });
    }
    try {
        const { data: emp } = await supabase_1.supabase.from("employees").select("supabase_user_id").eq("id", id).maybeSingle();
        if (emp?.supabase_user_id) {
            await supabase_1.supabaseAdmin.auth.admin.deleteUser(emp.supabase_user_id);
        }
    }
    catch (authCleanupErr) {
        console.warn("[SERVER] Auth cleanup warning:", authCleanupErr);
    }
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabase.from("employees").delete().eq("id", id));
    return res.json(result);
});
// SET driver status
exports.employeesRouter.patch("/:id/status", async (req, res) => {
    const { status } = req.body;
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabase.from("employees").update({ status }).eq("id", req.params.id).select());
    return res.json(result);
});
// SYNC employee account by email
exports.employeesRouter.post("/sync-email", async (req, res) => {
    try {
        const { employeeId, email } = req.body;
        const { data: emp, error: empErr } = await supabase_1.supabase.from("employees").select("*").eq("id", employeeId).single();
        if (empErr || !emp)
            return res.status(404).json({ success: false, error: "Employee not found." });
        const { data: existingUser } = await supabase_1.supabase.from("users").select("id").eq("email", email).maybeSingle();
        if (!existingUser) {
            const password = `EMP${(email.split("@")[0] || email).toUpperCase()}`;
            const { data: newUser, error: createErr } = await supabase_1.supabase.auth.signUp({ email, password });
            if (createErr || !newUser.user)
                return res.status(400).json({ success: false, error: createErr?.message || "Failed to create user." });
            await supabase_1.supabase.from("users").insert([{ id: newUser.user.id, email, username: email.split("@")[0], password }]);
            await supabase_1.supabase.from("employees").update({ supabase_user_id: newUser.user.id }).eq("id", employeeId);
            return res.json({ success: true, message: "Account created and synced.", tempPassword: password });
        }
        await supabase_1.supabase.from("employees").update({ supabase_user_id: existingUser.id }).eq("id", employeeId);
        return res.json({ success: true, message: "Existing account synced." });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: (0, supabase_1.getErrorMessage)(err) });
    }
});
//# sourceMappingURL=employees.routes.js.map