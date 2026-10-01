import { ipcMain } from "electron";
import { supabase, handleSupabase } from "./utils";

export function setupGovernanceIPC() {
  // Get audit logs
  ipcMain.handle("governance:getAuditLogs", async (_, options?: { limit?: number; module?: string }) => {
    let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false });
    if (options?.module) {
      query = query.eq("module", options.module);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching audit logs:", error);
      return [];
    }
    return data || [];
  });

  // Log action
  ipcMain.handle("governance:logAction", async (_, payload: { user_id?: string; username?: string; user_role?: string; action: string; module: string; details?: any }) => {
    return handleSupabase(
      supabase.from("audit_logs").insert([{
        user_id: payload.user_id || null,
        username: payload.username || "System Admin",
        user_role: payload.user_role || "admin",
        action: payload.action,
        module: payload.module,
        details: payload.details || {}
      }])
    );
  });
}
