"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const supabase_1 = require("../config/supabase");
exports.dashboardRouter = (0, express_1.Router)();
// GET dashboard KPI stats
exports.dashboardRouter.get("/stats", async (_req, res) => {
    try {
        const client = supabase_1.supabaseAdmin || supabase_1.supabase;
        const [{ count: employees }, { count: clients }, { count: vehicles }, { count: trips }] = await Promise.all([
            client.from("employees").select("*", { count: "exact", head: true }),
            client.from("clients").select("*", { count: "exact", head: true }),
            client.from("vehicles").select("*", { count: "exact", head: true }),
            client.from("trips").select("*", { count: "exact", head: true }),
        ]);
        return res.json({
            employeeCount: employees || 0,
            clientCount: clients || 0,
            vehicleCount: vehicles || 0,
            tripCount: trips || 0,
        });
    }
    catch (err) {
        return res.json({ employeeCount: 0, clientCount: 0, vehicleCount: 0, tripCount: 0 });
    }
});
//# sourceMappingURL=dashboard.routes.js.map