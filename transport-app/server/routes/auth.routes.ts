import { Router, Request, Response } from "express";
import { supabase, supabaseAdmin, getErrorMessage } from "../config/supabase";
import nodemailer from "nodemailer";

export const authRouter = Router();

// =========================
// RATE LIMITING MAPS
// =========================
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION = 15 * 60 * 1000; // 15 minutes

const recoveryCodes = new Map<string, { code: string; expires: number }>();
const recoveryAttempts = new Map<string, number>();
const MAX_RECOVERY_ATTEMPTS = 5;

const signupCodes = new Map<string, { code: string; expires: number }>();
const signupVerifyAttempts = new Map<string, number>();
const MAX_SIGNUP_VERIFY_ATTEMPTS = 5;

// Super Admin Credentials
const SUPER_ADMIN_USERNAME = "admin";
const SUPER_ADMIN_EMAIL = "admin@jrr.com";
const SUPER_ADMIN_PASSWORD = "admin";

// ─── LOGIN ───
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    let { email, password, device_id, device_model } = req.body;
    email = (email || "").trim().toLowerCase();
    password = (password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Super admin check
    if ((email === SUPER_ADMIN_USERNAME || email === SUPER_ADMIN_EMAIL) && password === SUPER_ADMIN_PASSWORD) {
      console.log("[AUTH] Super admin login successful.");
      return res.json({
        id: "super_admin",
        username: "admin",
        email: "admin@jrr.com",
        firstname: "Super",
        lastname: "Admin",
        role: "super_admin",
        account_status: "approved",
        email_verified: true,
      });
    }

    // Rate limiting
    const attempt = loginAttempts.get(email);
    if (attempt && attempt.lockedUntil > Date.now()) {
      const remainingMin = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ error: `Too many failed attempts. Account locked for ${remainingMin} more minute(s).` });
    }

    console.log(`[AUTH] Login attempt for: ${email}`);

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    let authenticatedUser: any = null;

    if (!authErr && authData?.user) {
      loginAttempts.delete(email);

      // Check account approval
      const { data: userRow } = await supabase
        .from("users")
        .select("email_verified, account_status, role")
        .eq("email", email)
        .maybeSingle();

      if (userRow) {
        if (userRow.email_verified === false) {
          return res.status(403).json({ error: "Please verify your email before logging in." });
        }
        if (userRow.account_status !== "approved") {
          return res.status(403).json({ error: "Your account is pending admin approval. Please wait for an administrator to approve your account." });
        }
      }

      const { data: empData } = await supabase
        .from("employees")
        .select("*")
        .eq("supabase_user_id", authData.user.id)
        .maybeSingle();

      authenticatedUser = empData
        ? { ...empData, session: authData.session }
        : {
            id: authData.user.id,
            email: authData.user.email,
            role: userRow?.role || "user",
            session: authData.session,
          };
    } else {
      // Fallback check to users table
      const { data: userRecord, error: dbErr } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .eq("password", password)
        .maybeSingle();

      if (!userRecord) {
        const current = loginAttempts.get(email) || { count: 0, lockedUntil: 0 };
        const newCount = current.count + 1;
        if (newCount >= MAX_LOGIN_ATTEMPTS) {
          loginAttempts.set(email, { count: newCount, lockedUntil: Date.now() + LOGIN_LOCK_DURATION });
          return res.status(429).json({ error: `Too many failed attempts. Account locked for 15 minutes.` });
        } else {
          loginAttempts.set(email, { count: newCount, lockedUntil: 0 });
          const remaining = MAX_LOGIN_ATTEMPTS - newCount;
          return res.status(401).json({ error: `Invalid email or password. ${remaining} attempt(s) remaining.` });
        }
      }

      if (userRecord.email_verified === false) {
        return res.status(403).json({ error: "Please verify your email before logging in." });
      }
      if (userRecord.account_status !== "approved") {
        return res.status(403).json({ error: "Your account is pending admin approval." });
      }

      loginAttempts.delete(email);
      authenticatedUser = userRecord;
    }

    // ─── EMPLOYEE HARDWARE DEVICE LOCK (Account Can Only Login in a Specific Device) ───
    const isEmployeeAccount = authenticatedUser && (
      authenticatedUser.role !== "super_admin" &&
      (authenticatedUser.role === "driver" ||
       authenticatedUser.role === "employee" ||
       authenticatedUser.role === "user" ||
       authenticatedUser.job_title === "Driver" ||
       authenticatedUser.employee_id)
    );

    if (isEmployeeAccount && device_id && authenticatedUser) {
      const boundDeviceId = authenticatedUser.bound_device_id;
      const boundModel = authenticatedUser.bound_device_model || "Specific Registered Device";

      if (!boundDeviceId) {
        // Initial Login: Lock and bind employee account specifically to this device
        console.log(`[AUTH-LOCK] Locking employee account ${email} to specific device: ${device_id} (${device_model || 'Mobile Device'})`);
        try {
          await supabaseAdmin.from("employees").update({
            bound_device_id: device_id,
            bound_device_model: device_model || "Mobile Device",
            bound_device_at: new Date().toISOString()
          }).eq("id", authenticatedUser.id);

          await supabaseAdmin.from("users").update({
            bound_device_id: device_id,
            bound_device_model: device_model || "Mobile Device",
            bound_device_at: new Date().toISOString()
          }).eq("email", email);
        } catch (e) {
          console.warn("[AUTH-LOCK] Error recording bound device:", e);
        }

        authenticatedUser.bound_device_id = device_id;
        authenticatedUser.bound_device_model = device_model || "Mobile Device";
      } else if (boundDeviceId !== device_id) {
        // Different device detected! Check if Admin approved a device transfer request
        const { data: approvedReq } = await supabaseAdmin
          .from("driver_device_requests")
          .select("*")
          .eq("new_device_id", device_id)
          .eq("status", "approved")
          .order("reviewed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (approvedReq) {
          // Admin authorization verified! Update bound device to new phone
          console.log(`[AUTH-LOCK] Admin-authorized device transfer to ${device_id} for employee ${email}`);
          try {
            await supabaseAdmin.from("employees").update({
              bound_device_id: device_id,
              bound_device_model: device_model || approvedReq.new_device_model || "Mobile Device",
              bound_device_at: new Date().toISOString()
            }).eq("id", authenticatedUser.id);

            await supabaseAdmin.from("users").update({
              bound_device_id: device_id,
              bound_device_model: device_model || approvedReq.new_device_model || "Mobile Device",
              bound_device_at: new Date().toISOString()
            }).eq("email", email);
          } catch (e) {}

          authenticatedUser.bound_device_id = device_id;
        } else {
          // Device mismatch and not yet approved by Admin: Block login & log transfer request
          try {
            const { data: existingReq } = await supabaseAdmin
              .from("driver_device_requests")
              .select("id")
              .eq("driver_id", authenticatedUser.id)
              .eq("new_device_id", device_id)
              .eq("status", "pending")
              .maybeSingle();

            if (!existingReq) {
              await supabaseAdmin.from("driver_device_requests").insert({
                driver_id: authenticatedUser.id,
                current_device_id: boundDeviceId,
                new_device_id: device_id,
                new_device_model: device_model || "Unrecognized Device",
                reason: "Employee attempted login on an unauthorized device. Account can only log in on its specific assigned device.",
                status: "pending"
              });
            }
          } catch (e) {}

          return res.status(403).json({
            error: `Device Locked: This employee account can only log in on its specific registered device (${boundModel}). Login from other devices is blocked without Admin authorization.`,
            device_locked: true,
            bound_device_model: boundModel,
            pending_admin_approval: true
          });
        }
      }
    }

    return res.json(authenticatedUser);
  } catch (err: any) {
    const msg = getErrorMessage(err);
    // Detect DNS or network connectivity errors to Supabase
    const cause = err?.cause?.code || err?.code || "";
    if (msg.includes("fetch failed") || cause === "ENOTFOUND" || cause === "ECONNREFUSED" || cause === "EAI_AGAIN") {
      console.error("[AUTH] Cannot reach Supabase. Is the project paused?", cause);
      return res.status(503).json({
        error: "Cannot connect to database server. Your Supabase project may be paused — please visit supabase.com/dashboard to restore it.",
      });
    }
    return res.status(500).json({ error: msg });
  }
});

// ─── SIGNUP / REGISTER ───
authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, email, password, firstname, lastname, phone } = req.body;
    if (!email || !password || !username) {
      return res.status(400).json({ success: false, error: "Missing required fields." });
    }

    // Check duplicate
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, email, username")
      .or(`email.eq.${email.trim().toLowerCase()},username.eq.${username.trim()}`)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ success: false, error: "User with this email or username already exists." });
    }

    // Create Supabase Auth user
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password.trim(),
      email_confirm: true,
      user_metadata: { username, firstname, lastname, phone }
    });

    const uid = authData?.user?.id;

    // Generate 6-digit signup verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    signupCodes.set(email.trim().toLowerCase(), {
      code,
      expires: Date.now() + 15 * 60 * 1000
    });

    // Insert user into users table with pending status
    const { data: newRow, error: insertErr } = await supabase
      .from("users")
      .insert([{
        id: uid || undefined,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        firstname: firstname || "",
        lastname: lastname || "",
        phone: phone || "",
        email_verified: false,
        account_status: "pending",
        role: "user"
      }])
      .select()
      .single();

    if (insertErr) {
      return res.status(500).json({ success: false, error: insertErr.message });
    }

    // Try sending email via SMTP
    try {
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      if (smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_PORT === "465",
          auth: { user: smtpUser, pass: smtpPass }
        });

        await transporter.sendMail({
          from: `"JRR Transport Security" <${smtpUser}>`,
          to: email.trim().toLowerCase(),
          subject: "JRR Transport — Verification Code",
          html: `<div style="font-family: Arial; padding: 20px;"><h2>Your Verification Code</h2><h1 style="color: #2563eb; letter-spacing: 4px;">${code}</h1><p>Valid for 15 minutes.</p></div>`
        });
      }
    } catch (mailErr) {
      console.warn("[AUTH] Signup mail send error:", mailErr);
    }

    return res.json({ success: true, data: newRow, requiresVerification: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// ─── VERIFY SIGNUP CODE ───
authRouter.post("/verify-signup-code", async (req: Request, res: Response) => {
  try {
    let { email, code } = req.body;
    email = (email || "").trim().toLowerCase();
    code = (code || "").trim();

    const record = signupCodes.get(email);
    if (!record || Date.now() > record.expires) {
      return res.status(400).json({ success: false, error: "Verification code expired or not found." });
    }

    if (record.code !== code) {
      const attempts = (signupVerifyAttempts.get(email) || 0) + 1;
      signupVerifyAttempts.set(email, attempts);
      if (attempts >= MAX_SIGNUP_VERIFY_ATTEMPTS) {
        signupCodes.delete(email);
        return res.status(429).json({ success: false, error: "Too many failed attempts. Request a new code." });
      }
      return res.status(400).json({ success: false, error: `Invalid code. ${MAX_SIGNUP_VERIFY_ATTEMPTS - attempts} attempt(s) remaining.` });
    }

    // Mark verified in DB
    await supabase.from("users").update({ email_verified: true }).eq("email", email);
    signupCodes.delete(email);
    signupVerifyAttempts.delete(email);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// ─── RESEND SIGNUP CODE ───
authRouter.post("/resend-signup-code", async (req: Request, res: Response) => {
  try {
    let { email } = req.body;
    email = (email || "").trim().toLowerCase();

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    signupCodes.set(email, {
      code,
      expires: Date.now() + 15 * 60 * 1000
    });
    signupVerifyAttempts.set(email, 0);

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_PORT === "465",
        auth: { user: smtpUser, pass: smtpPass }
      });

      await transporter.sendMail({
        from: `"JRR Transport Security" <${smtpUser}>`,
        to: email,
        subject: "JRR Transport — Verification Code",
        html: `<div style="font-family: Arial; padding: 20px;"><h2>Your Verification Code</h2><h1 style="color: #2563eb; letter-spacing: 4px;">${code}</h1></div>`
      });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// ─── PASSWORD RECOVERY: SEND CODE ───
authRouter.post("/send-recovery-code", async (req: Request, res: Response) => {
  try {
    let { email } = req.body;
    email = (email || "").trim().toLowerCase();

    const { data: user } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (!user) {
      return res.status(404).json({ success: false, error: "No account found with this email." });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    recoveryCodes.set(email, {
      code,
      expires: Date.now() + 15 * 60 * 1000
    });
    recoveryAttempts.set(email, 0);

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass) {
      return res.status(500).json({ success: false, error: "SMTP credentials not configured on server." });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === "465",
      auth: { user: smtpUser, pass: smtpPass }
    });

    await transporter.sendMail({
      from: `"JRR Transport Security" <${smtpUser}>`,
      to: email,
      subject: "JRR Transport — Password Reset Request",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h1 style="color: #1e40af; margin-top: 0;">JRR Transport</h1>
          <p>You requested a password reset for your account.</p>
          <p>Your verification code is:</p>
          <div style="background: #e0e7ff; padding: 16px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #1e40af; border-radius: 8px; margin: 24px 0;">
            ${code}
          </div>
          <p style="color: #64748b; font-size: 13px;">This code will expire in 15 minutes.</p>
        </div>
      `
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// ─── PASSWORD RECOVERY: VERIFY CODE ───
authRouter.post("/verify-recovery-code", async (req: Request, res: Response) => {
  try {
    let { email, code } = req.body;
    email = (email || "").trim().toLowerCase();
    code = (code || "").trim();

    const record = recoveryCodes.get(email);
    if (!record || Date.now() > record.expires) {
      return res.status(400).json({ success: false, error: "Recovery code has expired. Please request a new one." });
    }

    const attempts = recoveryAttempts.get(email) || 0;
    if (attempts >= MAX_RECOVERY_ATTEMPTS) {
      recoveryCodes.delete(email);
      return res.status(429).json({ success: false, error: "Too many failed attempts. Please request a new code." });
    }

    if (record.code !== code) {
      recoveryAttempts.set(email, attempts + 1);
      const remaining = MAX_RECOVERY_ATTEMPTS - (attempts + 1);
      return res.status(400).json({ success: false, error: `Invalid code. ${remaining} attempt(s) remaining.` });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// ─── PASSWORD RECOVERY: UPDATE PASSWORD ───
authRouter.post("/update-password-with-code", async (req: Request, res: Response) => {
  try {
    let { email, code, newPassword } = req.body;
    email = (email || "").trim().toLowerCase();
    code = (code || "").trim();
    newPassword = (newPassword || "").trim();

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: "Password must be at least 8 characters." });
    }

    const record = recoveryCodes.get(email);
    if (!record || record.code !== code || Date.now() > record.expires) {
      return res.status(400).json({ success: false, error: "Session invalid or expired." });
    }

    const { data: user } = await supabase.from("users").select("id").eq("email", email).single();
    if (!user) return res.status(404).json({ success: false, error: "User not found." });

    // Update in Supabase Auth
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.id, { password: newPassword });
    } catch (authErr) {
      console.warn("[AUTH] Admin API update warning:", authErr);
    }

    // Update in users table
    await supabase.from("users").update({ password: newPassword }).eq("id", user.id);
    recoveryCodes.delete(email);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// ─── SUPER ADMIN OPERATIONS ───
authRouter.get("/admin/pending-users", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, username, email, firstname, lastname, email_verified, account_status, role")
      .eq("account_status", "pending")
      .order("email", { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, data: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

authRouter.get("/admin/all-users", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, username, email, firstname, lastname, email_verified, account_status, role")
      .order("email", { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, data: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

authRouter.post("/admin/approve-user", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ account_status: "approved", email_verified: true })
      .eq("id", userId)
      .select()
      .single();
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

authRouter.post("/admin/reject-user", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ account_status: "rejected" })
      .eq("id", userId)
      .select()
      .single();
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

authRouter.delete("/admin/user/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    await supabaseAdmin.from("users").delete().eq("id", userId);
    try {
      if (typeof userId === "string") {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
    } catch {}
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// ─── DRIVER DEVICE TRANSFER & PHONE LOCK APPROVALS ───
authRouter.get("/admin/driver-device-requests", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("driver_device_requests")
      .select(`
        *,
        employees:driver_id ( full_name, employee_id, phone, bound_device_id, bound_device_model )
      `)
      .order("requested_at", { ascending: false });

    if (error) {
      // Fallback in-memory or empty array if table not yet migrated
      return res.json({ success: true, data: [] });
    }
    return res.json({ success: true, data: data || [] });
  } catch (err: any) {
    return res.json({ success: true, data: [] });
  }
});

authRouter.post("/admin/approve-device-request", async (req: Request, res: Response) => {
  try {
    const { requestId, driverId, newDeviceId, newDeviceModel, reviewer } = req.body;
    if (!requestId || !driverId || !newDeviceId) {
      return res.status(400).json({ success: false, error: "Missing required parameters." });
    }

    // 1. Mark request approved
    await supabaseAdmin
      .from("driver_device_requests")
      .update({
        status: "approved",
        reviewed_by: reviewer || "Admin",
        reviewed_at: new Date().toISOString()
      })
      .eq("id", requestId);

    // 2. Transfer driver binding to new phone
    await supabaseAdmin
      .from("employees")
      .update({
        bound_device_id: newDeviceId,
        bound_device_model: newDeviceModel || "Mobile Device",
        bound_device_at: new Date().toISOString()
      })
      .eq("id", driverId);

    await supabaseAdmin
      .from("users")
      .update({
        bound_device_id: newDeviceId,
        bound_device_model: newDeviceModel || "Mobile Device",
        bound_device_at: new Date().toISOString()
      })
      .eq("id", driverId);

    return res.json({ success: true, message: "Device transfer authorized successfully." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

authRouter.post("/admin/reject-device-request", async (req: Request, res: Response) => {
  try {
    const { requestId, reviewer } = req.body;
    await supabaseAdmin
      .from("driver_device_requests")
      .update({
        status: "rejected",
        reviewed_by: reviewer || "Admin",
        reviewed_at: new Date().toISOString()
      })
      .eq("id", requestId);

    return res.json({ success: true, message: "Device transfer request rejected." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

authRouter.post("/admin/reset-driver-device", async (req: Request, res: Response) => {
  try {
    const { driverId } = req.body;
    if (!driverId) return res.status(400).json({ success: false, error: "driverId is required." });

    await supabaseAdmin.from("employees").update({
      bound_device_id: null,
      bound_device_model: null,
      bound_device_at: null
    }).eq("id", driverId);

    await supabaseAdmin.from("users").update({
      bound_device_id: null,
      bound_device_model: null,
      bound_device_at: null
    }).eq("id", driverId);

    return res.json({ success: true, message: "Driver phone unlinked successfully. Driver can now bind a new device on next login." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// ─── SUPER ADMIN IT API GATEWAY MODIFICATION ───
authRouter.get("/super-admin/api-configs", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin.from("api_configurations").select("*");
    if (error || !data || data.length === 0) {
      // Default baseline configurations
      return res.json({
        success: true,
        data: [
          { key: "express_backend", category: "backend", label: "JRR Backend Server", endpoint_url: "http://localhost:3000", status: "active" },
          { key: "supabase_db", category: "database", label: "Supabase Postgres DB", endpoint_url: "https://uocavssoqmwjstmvdgwq.supabase.co", status: "active" },
          { key: "osrm_routing", category: "maps", label: "OSRM Route Optimization", endpoint_url: "https://router.project-osrm.org", status: "active" },
          { key: "iot_telemetry", category: "iot", label: "IoT ESP32 Webhook", endpoint_url: "/api/tracking/iot/telemetry", status: "active" },
          { key: "smtp_mail", category: "smtp", label: "SMTP Gmail Gateway", endpoint_url: "smtp://smtp.gmail.com:587", status: "active" }
        ]
      });
    }
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.json({ success: true, data: [] });
  }
});

authRouter.post("/super-admin/api-configs", async (req: Request, res: Response) => {
  try {
    const { key, endpoint_url, api_key, status } = req.body;
    if (!key || !endpoint_url) {
      return res.status(400).json({ success: false, error: "key and endpoint_url are required." });
    }

    const { data, error } = await supabaseAdmin
      .from("api_configurations")
      .upsert({
        key,
        endpoint_url,
        api_key: api_key || null,
        status: status || "active",
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});
