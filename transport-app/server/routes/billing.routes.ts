import { Router, Request, Response } from "express";
import { supabase, handleSupabase } from "../config/supabase";

export const billingRouter = Router();

// GET all invoices
billingRouter.get("/", async (_req: Request, res: Response) => {
  const { data } = await supabase
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
billingRouter.get("/last-number", async (_req: Request, res: Response) => {
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return res.json(data?.invoice_number || null);
});

// GET billing stats
billingRouter.get("/stats", async (_req: Request, res: Response) => {
  const { data: invoices } = await supabase.from("invoices").select("amount, status");
  const total = invoices?.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0) || 0;
  const pending = invoices?.filter(i => i.status === "Pending" || i.status === "Unpaid").length || 0;
  return res.json({ totalRevenue: total, pendingInvoices: pending });
});

// CREATE invoice
billingRouter.post("/", async (req: Request, res: Response) => {
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

  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("invoice_number", invoiceData.invoice_number)
    .maybeSingle();

  if (existing) {
    return res.status(400).json({ success: false, ok: false, error: `Invoice number "${invoiceData.invoice_number}" already exists.` });
  }

  const result = await handleSupabase(
    supabase.from("invoices").insert([invoiceData]).select().single()
  );
  return res.json(result);
});

// UPDATE invoice
billingRouter.put("/:id", async (req: Request, res: Response) => {
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

  const result = await handleSupabase(
    supabase.from("invoices").update(data).eq("id", id).select()
  );
  return res.json(result);
});

// DELETE invoice
billingRouter.delete("/:id", async (req: Request, res: Response) => {
  const result = await handleSupabase(
    supabase.from("invoices").delete().eq("id", req.params.id)
  );
  return res.json(result);
});
