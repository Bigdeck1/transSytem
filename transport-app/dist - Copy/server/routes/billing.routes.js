"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingRouter = void 0;
const express_1 = require("express");
const supabase_1 = require("../config/supabase");
exports.billingRouter = (0, express_1.Router)();
// GET all invoices
exports.billingRouter.get("/", async (_req, res) => {
    const { data } = await supabase_1.supabase
        .from("invoices")
        .select(`
      *,
      clients:client_id ( name ),
      employees:driver_id ( full_name ),
      vehicles:vehicle_id ( plate )
    `)
        .order("id", { ascending: false });
    return res.json(data || []);
});
// GET last invoice number
exports.billingRouter.get("/last-number", async (_req, res) => {
    const { data } = await supabase_1.supabase
        .from("invoices")
        .select("invoice_number")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
    return res.json(data?.invoice_number || null);
});
// GET billing stats
exports.billingRouter.get("/stats", async (_req, res) => {
    const { data: invoices } = await supabase_1.supabase.from("invoices").select("amount, status");
    const total = invoices?.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0) || 0;
    const pending = invoices?.filter(i => i.status === "Pending" || i.status === "Unpaid").length || 0;
    return res.json({ totalRevenue: total, pendingInvoices: pending });
});
// CREATE invoice
exports.billingRouter.post("/", async (req, res) => {
    const invoiceData = req.body;
    if (!invoiceData.invoice_number) {
        return res.status(400).json({ success: false, ok: false, error: "Invoice number is required." });
    }
    if (invoiceData.amount !== undefined && Number(invoiceData.amount) < 0) {
        return res.status(400).json({ success: false, ok: false, error: "Invoice amount cannot be negative." });
    }
    if (invoiceData.issue_date && invoiceData.due_date) {
        if (new Date(invoiceData.due_date) < new Date(invoiceData.issue_date)) {
            return res.status(400).json({ success: false, ok: false, error: "Due date cannot be before issue date." });
        }
    }
    const { data: existing } = await supabase_1.supabase
        .from("invoices")
        .select("id")
        .eq("invoice_number", invoiceData.invoice_number)
        .maybeSingle();
    if (existing) {
        return res.status(400).json({ success: false, ok: false, error: `Invoice number "${invoiceData.invoice_number}" already exists.` });
    }
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabase.from("invoices").insert([invoiceData]).select().single());
    return res.json(result);
});
// UPDATE invoice
exports.billingRouter.put("/:id", async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    if (data.amount !== undefined && Number(data.amount) < 0) {
        return res.status(400).json({ success: false, ok: false, error: "Invoice amount cannot be negative." });
    }
    if (data.issue_date && data.due_date) {
        if (new Date(data.due_date) < new Date(data.issue_date)) {
            return res.status(400).json({ success: false, ok: false, error: "Due date cannot be before issue date." });
        }
    }
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabase.from("invoices").update(data).eq("id", id).select());
    return res.json(result);
});
// DELETE invoice
exports.billingRouter.delete("/:id", async (req, res) => {
    const result = await (0, supabase_1.handleSupabase)(supabase_1.supabase.from("invoices").delete().eq("id", req.params.id));
    return res.json(result);
});
//# sourceMappingURL=billing.routes.js.map