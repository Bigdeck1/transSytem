"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientsRouter = void 0;
const express_1 = require("express");
const supabase_1 = require("../config/supabase");
exports.clientsRouter = (0, express_1.Router)();
// GET all clients
exports.clientsRouter.get("/", async (_req, res) => {
    const { data } = await supabase_1.supabase.from("clients").select("*").order("id");
    return res.json(data || []);
});
// GET client history
exports.clientsRouter.get("/history", async (req, res) => {
    const { clientId } = req.query;
    let q = supabase_1.supabase.from("trips").select("*").order("pickup_time", { ascending: false });
    if (clientId)
        q = q.eq("client_id", String(clientId));
    const { data } = await q;
    return res.json(data || []);
});
// ADD client
exports.clientsRouter.post("/", async (req, res) => {
    const clientData = req.body;
    if (!clientData.name || !clientData.name.trim()) {
        return res.status(400).json({ success: false, ok: false, error: "Client name is required." });
    }
    if (clientData.email && clientData.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(clientData.email.trim())) {
            return res.status(400).json({ success: false, ok: false, error: "Invalid email format." });
        }
        const { data: existing } = await supabase_1.supabase
            .from("clients")
            .select("id")
            .eq("email", clientData.email.trim())
            .maybeSingle();
        if (existing) {
            return res.status(400).json({ success: false, ok: false, error: `A client with email "${clientData.email}" already exists.` });
        }
    }
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabase.from("clients").insert([clientData]).select());
    return res.json(result);
});
// UPDATE client
exports.clientsRouter.put("/:id", async (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;
    if (updatedData.email && updatedData.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updatedData.email.trim())) {
            return res.status(400).json({ success: false, ok: false, error: "Invalid email format." });
        }
        const { data: existing } = await supabase_1.supabase
            .from("clients")
            .select("id")
            .eq("email", updatedData.email.trim())
            .neq("id", id)
            .maybeSingle();
        if (existing) {
            return res.status(400).json({ success: false, ok: false, error: `Another client with email "${updatedData.email}" already exists.` });
        }
    }
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabase.from("clients").update(updatedData).eq("id", id).select());
    return res.json(result);
});
// DELETE client with cascade checks
exports.clientsRouter.delete("/:id", async (req, res) => {
    const { id } = req.params;
    const { data: activeInvoices } = await supabase_1.supabase
        .from("invoices")
        .select("id, invoice_number")
        .eq("client_id", id)
        .in("status", ["Pending", "Unpaid"]);
    if (activeInvoices && activeInvoices.length > 0) {
        return res.status(400).json({
            success: false,
            ok: false,
            error: `Cannot delete: client has ${activeInvoices.length} unpaid invoice(s). Resolve them first.`
        });
    }
    const { data: activeTrips } = await supabase_1.supabase
        .from("trips")
        .select("id, trip_number")
        .eq("client_id", id)
        .in("status", ["pending", "scheduled", "in transit", "in-transit"]);
    if (activeTrips && activeTrips.length > 0) {
        return res.status(400).json({
            success: false,
            ok: false,
            error: `Cannot delete: client has ${activeTrips.length} active trip(s). Complete or cancel them first.`
        });
    }
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabase.from("clients").delete().eq("id", id));
    return res.json(result);
});
//# sourceMappingURL=clients.routes.js.map