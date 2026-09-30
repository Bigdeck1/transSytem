import { Router, Request, Response } from "express";
import { supabaseAdmin, supabase } from "../config/supabase";

export const dashboardRouter = Router();

// GET dashboard KPI stats
dashboardRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const client = supabaseAdmin || supabase;
    const [{ count: employees }, { count: clients }, { count: vehicles }, { count: trips }] =
      await Promise.all([
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
  } catch (err) {
    return res.json({ employeeCount: 0, clientCount: 0, vehicleCount: 0, tripCount: 0 });
  }
});
