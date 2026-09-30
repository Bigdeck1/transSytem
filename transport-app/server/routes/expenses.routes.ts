import { Router } from "express";
import { supabaseAdmin, supabase } from "../config/supabase";

const router = Router();
const db = supabaseAdmin || supabase;

// POST /api/expenses/log
router.post("/log", async (req, res) => {
  const { tripId, driverId, vehicleId, expenseType, amount, liters, odometer, receiptPhotoUrl, notes } = req.body;

  if (!expenseType || amount === undefined) {
    return res.status(400).json({ ok: false, error: "Missing required fields (expenseType, amount)" });
  }

  try {
    const { data, error } = await db
      .from("trip_expenses")
      .insert([{
        trip_id: tripId ? Number(tripId) : null,
        driver_id: driverId || null,
        vehicle_id: vehicleId ? Number(vehicleId) : null,
        expense_type: expenseType,
        amount: Number(amount),
        liters: liters ? Number(liters) : null,
        odometer: odometer ? Number(odometer) : null,
        receipt_photo_url: receiptPhotoUrl || null,
        notes: notes || null,
      }])
      .select("*")
      .single();

    if (error) throw error;
    res.json({ ok: true, success: true, data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/expenses/trip/:tripId
router.get("/trip/:tripId", async (req, res) => {
  try {
    const { data, error } = await db
      .from("trip_expenses")
      .select("*")
      .eq("trip_id", req.params.tripId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ ok: true, success: true, data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/expenses/vehicle/:vehicleId
router.get("/vehicle/:vehicleId", async (req, res) => {
  try {
    const { data, error } = await db
      .from("trip_expenses")
      .select("*")
      .eq("vehicle_id", req.params.vehicleId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ ok: true, success: true, data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/expenses/fleet-summary
router.get("/fleet-summary", async (req, res) => {
  try {
    const { data, error } = await db
      .from("trip_expenses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const expenses: any[] = data || [];
    const totalAmount = expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    const fuelExpenses = expenses.filter((e: any) => e.expense_type === 'fuel');
    const totalFuelAmount = fuelExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    const totalLiters = fuelExpenses.reduce((sum: number, e: any) => sum + Number(e.liters || 0), 0);
    const tollAmount = expenses.filter((e: any) => e.expense_type === 'toll').reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

    res.json({
      ok: true,
      success: true,
      summary: {
        totalAmount,
        totalFuelAmount,
        totalLiters,
        tollAmount,
        avgPricePerLiter: totalLiters > 0 ? Number((totalFuelAmount / totalLiters).toFixed(2)) : 0,
        count: expenses.length,
      },
      records: expenses,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
