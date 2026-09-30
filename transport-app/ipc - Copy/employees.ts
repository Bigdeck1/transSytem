import { ipcMain } from "electron";
import { supabase, supabaseAdmin, handleSupabase } from "./utils";

export function setupEmployeeIPC() {
  ipcMain.handle("get-employees", async () => {
    const { data } = await supabase.from("employees").select("*").order("id");
    return data || [];
  });

  ipcMain.handle("get-employee-by-id", async (_, id: string) => {
    const { data } = await supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data;
  });

  ipcMain.handle("add-employee", async (_, employeeData) => {
    const cleanEmployeeData = { ...employeeData };
    delete cleanEmployeeData.employee_pin4;

    // Validate required fields
    if (!cleanEmployeeData.full_name || !cleanEmployeeData.full_name.trim()) {
      return { error: "Employee name is required." };
    }

    // Validate email
    if (cleanEmployeeData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmployeeData.email.trim())) {
        return { error: "Invalid email format." };
      }
    }

    // Validate financial fields
    if (cleanEmployeeData.daily_rate !== undefined && Number(cleanEmployeeData.daily_rate) < 0) {
      return { error: "Daily rate cannot be negative." };
    }
    if (cleanEmployeeData.salary !== undefined && Number(cleanEmployeeData.salary) < 0) {
      return { error: "Salary cannot be negative." };
    }

    const res = await handleSupabase(
      supabase.from("employees").insert([cleanEmployeeData]).select()
    );
    if (!res.success) return { error: res.error };
    return { data: res.data };
  });

  ipcMain.handle("create-employee", async (_, payload) => {
    try {
      const { full_name, email, phone, status, position, department, auth_password, daily_rate, salary } = payload;
      const employee_id = payload.employee_id;

      // Server-side validation
      if (!full_name || !full_name.trim()) {
        return { ok: false, message: "Employee name is required." };
      }
      if (!email || !email.trim()) {
        return { ok: false, message: "Email is required." };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return { ok: false, message: "Invalid email format." };
      }
      if (daily_rate !== undefined && Number(daily_rate) < 0) {
        return { ok: false, message: "Daily rate cannot be negative." };
      }
      if (salary !== undefined && Number(salary) < 0) {
        return { ok: false, message: "Salary cannot be negative." };
      }

      console.log(`[IPC][create-employee] Processing registration for ${full_name} (${email})`);

      // 1. Create Supabase Auth user via Admin API
      let { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: auth_password,
        email_confirm: true,
        user_metadata: { full_name }
      });

      // Handle "User already exists" conflict
      if (authError && authError.message.toLowerCase().includes("already registered")) {
        console.warn(`[IPC][create-employee] User ${email} already exists in Auth. Attempting to link existing ID.`);
        // Try to fetch existing user to get their ID
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.users?.find(u => u.email === email);
        if (existingUser) {
          authData = { user: existingUser } as any;
          authError = null;
        } else {
          return { ok: false, message: "User exists in Auth but could not be retrieved. Please contact support." };
        }
      }

      if (authError) {
        console.error("[IPC][create-employee] Auth Error:", authError.message);
        return { ok: false, message: `Auth Error: ${authError.message}` };
      }
      
      if (!authData?.user) {
        return { ok: false, message: "Failed to create or retrieve Auth user." };
      }

      console.log(`[IPC][create-employee] Auth identity verified: ${authData.user.id}`);

      // 2. Create Employee Profile via Admin client
      const insertData = {
        employee_id,
        full_name,
        email,
        phone,
        status,
        position,
        department,
        daily_rate: Number(daily_rate) || 0,
        salary: Number(salary) || 0,
        supabase_user_id: authData.user.id,
        hire_date: new Date().toISOString().split('T')[0]
      };

      console.log("[IPC][create-employee] Database Insert:", JSON.stringify(insertData));

      const { error: empError } = await supabaseAdmin
        .from("employees")
        .insert([insertData]);

      if (empError) {
        console.error("[IPC][create-employee] Database Error:", empError.message);
        // If DB fails, we might want to cleanup the Auth user, but for now we report the error
        let errorMsg = empError.message;
        if (empError.message.includes("column")) {
          errorMsg = `Database Mismatch: The 'employees' table is missing some columns (possibly daily_rate or salary). Error: ${empError.message}`;
        }
        return { ok: false, message: errorMsg };
      }

      console.log(`[IPC][create-employee] Registration successful for ${employee_id}`);
      return { ok: true };
    } catch (err) {
      console.error("[IPC][create-employee] Critical Crash:", err);
      return { ok: false, message: `Unexpected System Error: ${String(err)}` };
    }
  });


  ipcMain.handle("update-employee", async (_, id: string, updatedData) => {
    const cleanUpdatedData = { ...updatedData };
    delete cleanUpdatedData.employee_pin4;

    const res = await handleSupabase(
      supabase.from("employees").update(cleanUpdatedData).eq("id", id).select()
    );
    if (!res.success) return { error: res.error };
    return { data: res.data };
  });

  ipcMain.handle("delete-employee", async (_, id: string) => {
    // Cascade protection: check for active trips
    const { data: activeTrips } = await supabase
      .from("trips")
      .select("id, trip_number")
      .eq("driver_id", id)
      .in("status", ["pending", "scheduled", "in transit", "in-transit"]);

    if (activeTrips && activeTrips.length > 0) {
      return {
        success: false,
        error: `Cannot delete: employee has ${activeTrips.length} active trip(s). Complete or cancel them first.`
      };
    }

    // Attempt to clean up the Supabase Auth user before deleting the DB row
    try {
      const { data: emp } = await supabase.from("employees").select("supabase_user_id").eq("id", id).maybeSingle();
      if (emp?.supabase_user_id) {
        await supabaseAdmin.auth.admin.deleteUser(emp.supabase_user_id);
        console.log(`[IPC][delete-employee] Auth user ${emp.supabase_user_id} deleted.`);
      }
    } catch (authCleanupErr) {
      console.warn("[IPC][delete-employee] Auth user cleanup failed (continuing with DB delete):", authCleanupErr);
    }

    const res = await handleSupabase(
      supabase.from("employees").delete().eq("id", id)
    );
    return { success: res.success, error: res.error };
  });

  ipcMain.handle("set-driver-status", async (_, driver_id: string, status: string) => {
    const res = await handleSupabase(
      supabase.from("employees").update({ status }).eq("id", driver_id).select()
    );
    return { success: res.success, data: res.data, error: res.error };
  });

  ipcMain.handle("get-employee-by-user", async (_, userId: string) => {
    const { data } = await supabase
      .from("employees")
      .select("*")
      .eq("supabase_user_id", userId)
      .maybeSingle();
    return data;
  });

  ipcMain.handle("sync-employee-account-by-email", async (_, employeeId: string, email: string) => {
    try {
      const { data: emp, error: empErr } = await supabase.from("employees").select("*").eq("id", employeeId).single();
      if (empErr || !emp) return { success: false, error: "Employee not found." };

      const { data: existingUser } = await supabase.from("users").select("id").eq("email", email).maybeSingle();

      if (!existingUser) {
        const password = `EMP${(email.split("@")[0] || email).toUpperCase()}`;
        const { data: newUser, error: createErr } = await supabase.auth.signUp({ email, password });
        if (createErr || !newUser.user) return { success: false, error: createErr?.message || "Failed to create user." };

        await supabase.from("users").insert([{ id: newUser.user.id, email, username: email.split("@")[0], password }]);
        await supabase.from("employees").update({ supabase_user_id: newUser.user.id }).eq("id", employeeId);

        return { success: true, message: "Account created and synced.", tempPassword: password };
      }

      await supabase.from("employees").update({ supabase_user_id: existingUser.id }).eq("id", employeeId);
      return { success: true, message: "Existing account synced." };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("get-next-employee-id", async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("employee_id");

      if (error) throw error;

      const START = 8;
      let max = START - 1;

      (data || []).forEach((emp) => {
        const s = String(emp.employee_id || "").trim().toUpperCase();
        if (s.startsWith("EMP")) {
          const n = parseInt(s.slice(3), 10);
          if (Number.isFinite(n) && n > max) max = n;
        }
      });

      const next = max + 1;
      return `EMP${String(next).padStart(4, "0")}`;
    } catch (err) {
      console.error("[IPC] Error getting next employee ID:", err);
      return "EMP0008"; // Fallback
    }
  });
}
