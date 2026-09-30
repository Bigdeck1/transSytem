"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAuthIPC = setupAuthIPC;
const electron_1 = require("electron");
const utils_1 = require("./utils");
// =========================
// RATE LIMITING MAPS
// =========================
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION = 15 * 60 * 1000; // 15 minutes
const recoveryAttempts = new Map();
const MAX_RECOVERY_ATTEMPTS = 5;
// =========================
// SIGNUP VERIFICATION CODES (in-memory, same pattern as recovery)
// =========================
const signupCodes = new Map();
const signupVerifyAttempts = new Map();
const MAX_SIGNUP_VERIFY_ATTEMPTS = 5;
// =========================
// SUPER ADMIN CREDENTIALS (hardcoded)
// =========================
const SUPER_ADMIN_USERNAME = "admin";
const SUPER_ADMIN_EMAIL = "admin@jrr.com";
const SUPER_ADMIN_PASSWORD = "admin";
function setupAuthIPC() {
    electron_1.ipcMain.handle("login", async (_, email, password) => {
        try {
            // Input sanitization
            email = (email || "").trim().toLowerCase();
            password = (password || "").trim();
            if (!email || !password) {
                return null;
            }
            // ─── SUPER ADMIN CHECK (hardcoded) ───
            if ((email === SUPER_ADMIN_USERNAME || email === SUPER_ADMIN_EMAIL) && password === SUPER_ADMIN_PASSWORD) {
                console.log("[AUTH] Super admin login successful.");
                return {
                    id: "super_admin",
                    username: "admin",
                    email: "admin@jrr.com",
                    firstname: "Super",
                    lastname: "Admin",
                    role: "super_admin",
                    account_status: "approved",
                    email_verified: true,
                };
            }
            // Rate limiting check
            const attempt = loginAttempts.get(email);
            if (attempt && attempt.lockedUntil > Date.now()) {
                const remainingMin = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
                console.warn(`[AUTH] Account locked for ${email}. ${remainingMin} min remaining.`);
                return { error: `Too many failed attempts. Account locked for ${remainingMin} more minute(s).` };
            }
            console.log(`[AUTH] Login attempt for: ${email}`);
            const { data: authData, error: authErr } = await utils_1.supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (!authErr && authData?.user) {
                // Successful Supabase Auth login — reset attempts
                loginAttempts.delete(email);
                console.log(`[AUTH] Supabase Auth success: ${authData.user.id}`);
                // Check the users table for account_status and email_verified
                const { data: userRow } = await utils_1.supabase
                    .from("users")
                    .select("email_verified, account_status, role")
                    .eq("email", email)
                    .maybeSingle();
                if (userRow) {
                    if (userRow.email_verified === false) {
                        console.warn(`[AUTH] Login blocked: email not verified for ${email}`);
                        return { error: "Please verify your email before logging in." };
                    }
                    if (userRow.account_status !== "approved") {
                        console.warn(`[AUTH] Login blocked: account not approved for ${email} (status: ${userRow.account_status})`);
                        return { error: "Your account is pending admin approval. Please wait for an administrator to approve your account." };
                    }
                }
                const { data: empData, error: empErr } = await utils_1.supabase
                    .from("employees")
                    .select("*")
                    .eq("supabase_user_id", authData.user.id)
                    .maybeSingle();
                if (empErr)
                    console.error(`[AUTH] Employee lookup error: ${empErr.message}`);
                if (empData) {
                    console.log(`[AUTH] Employee found: ${empData.id}`);
                    return empData;
                }
                else {
                    console.log(`[AUTH] No employee linked to user ${authData.user.id}`);
                }
            }
            else if (authErr) {
                console.warn(`[AUTH] Supabase Auth failed: ${authErr.message}`);
            }
            // ─── PLAINTEXT FALLBACK (gated behind verification + approval) ───
            console.log(`[AUTH] Falling back to Users table for: ${email}`);
            const { data, error } = await utils_1.supabase
                .from("users")
                .select("*")
                .eq("email", email)
                .eq("password", password)
                .maybeSingle();
            if (error)
                console.error(`[AUTH] Users table lookup error: ${error.message}`);
            if (!data) {
                // Track failed attempt
                const current = loginAttempts.get(email) || { count: 0, lockedUntil: 0 };
                current.count += 1;
                if (current.count >= MAX_LOGIN_ATTEMPTS) {
                    current.lockedUntil = Date.now() + LOGIN_LOCK_DURATION;
                    console.warn(`[AUTH] Account LOCKED for ${email} after ${MAX_LOGIN_ATTEMPTS} failed attempts.`);
                }
                loginAttempts.set(email, current);
                console.log(`[AUTH] No match in Users table for: ${email} (attempt ${current.count}/${MAX_LOGIN_ATTEMPTS})`);
                return null;
            }
            // ─── GATE: Check email_verified and account_status ───
            if (data.email_verified === false) {
                console.warn(`[AUTH] Login blocked (fallback): email not verified for ${email}`);
                return { error: "Please verify your email before logging in." };
            }
            if (data.account_status && data.account_status !== "approved") {
                console.warn(`[AUTH] Login blocked (fallback): account not approved for ${email} (status: ${data.account_status})`);
                return { error: "Your account is pending admin approval. Please wait for an administrator to approve your account." };
            }
            // Successful login — reset attempts
            loginAttempts.delete(email);
            console.log(`[AUTH] User table success: ${data.id}`);
            return data;
        }
        catch (err) {
            console.error("[AUTH] Unexpected error:", (0, utils_1.getErrorMessage)(err));
            return null;
        }
    });
    // =========================
    // REGISTRATION (with email verification)
    // =========================
    electron_1.ipcMain.handle("supabase-register", async (_, userData) => {
        try {
            const { username, email, password, firstname, lastname, phone } = userData;
            // Input validation
            if (!email || !password || !username) {
                return { success: false, error: "Email, password, and username are required." };
            }
            if (password.length < 8) {
                return { success: false, error: "Password must be at least 8 characters." };
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return { success: false, error: "Invalid email format." };
            }
            // Check if username or email already taken
            const { data: existingUser } = await utils_1.supabase
                .from("users")
                .select("id")
                .or(`email.eq.${email},username.eq.${username}`)
                .maybeSingle();
            if (existingUser) {
                return { success: false, error: "An account with this email or username already exists." };
            }
            const { data: authData, error: authError } = await utils_1.supabase.auth.signUp({
                email,
                password,
                options: { data: { username, full_name: `${firstname} ${lastname}` } },
            });
            if (authError)
                return { success: false, error: authError.message };
            if (!authData.user)
                return { success: false, error: "Registration failed." };
            // Insert into users table with security fields
            const { error: profileError } = await utils_1.supabase.from("users").insert([{
                    id: authData.user.id,
                    username,
                    email,
                    password,
                    firstname,
                    lastname,
                    phone: phone || null,
                    email_verified: false,
                    account_status: "pending",
                    role: "user",
                }]);
            if (profileError) {
                console.error("[AUTH] Profile insert error:", profileError.message);
                return { success: false, error: "Failed to create user profile: " + profileError.message };
            }
            // ─── SEND VERIFICATION CODE VIA SMTP ───
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            signupCodes.set(email.toLowerCase(), {
                code,
                expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            });
            signupVerifyAttempts.set(email.toLowerCase(), 0);
            let nodemailer;
            try {
                nodemailer = require("nodemailer");
            }
            catch {
                console.error("[AUTH] Nodemailer not installed — verification code not sent.");
                return { success: true, requiresVerification: true, warning: "Verification email could not be sent (SMTP not configured)." };
            }
            const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
            const smtpPort = Number(process.env.SMTP_PORT || 587);
            const smtpUser = process.env.SMTP_USER || "";
            const smtpPass = process.env.SMTP_PASS || "";
            if (!smtpUser || !smtpPass) {
                console.error("[AUTH] SMTP credentials not configured.");
                return { success: true, requiresVerification: true, warning: "SMTP not configured — code logged to console.", code };
            }
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: { user: smtpUser, pass: smtpPass },
            });
            const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h1 style="color: #1e40af; margin-top: 0;">JRR Transport</h1>
          <p>Welcome! Please verify your email to complete registration.</p>
          <p>Your verification code is:</p>
          <div style="background: #e0e7ff; padding: 16px; font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center; color: #1e40af; border-radius: 8px; margin: 24px 0;">
            ${code}
          </div>
          <p style="color: #64748b; font-size: 13px;">This code will expire in 15 minutes. If you didn't create this account, you can safely ignore this email.</p>
        </div>
      `;
            try {
                await transporter.sendMail({
                    from: `"JRR Transport Security" <${smtpUser}>`,
                    to: email,
                    subject: `JRR Transport — Email Verification Code`,
                    html: htmlBody,
                });
                console.log(`[AUTH] Verification code sent to ${email}`);
            }
            catch (mailErr) {
                console.error("[AUTH] Failed to send verification email:", mailErr.message);
                return { success: true, requiresVerification: true, warning: "Failed to send verification email. Please try again." };
            }
            return { success: true, requiresVerification: true };
        }
        catch (err) {
            return { success: false, error: (0, utils_1.getErrorMessage)(err) };
        }
    });
    // =========================
    // VERIFY SIGNUP CODE
    // =========================
    electron_1.ipcMain.handle("auth:verifySignupCode", async (_, email, code) => {
        try {
            email = (email || "").trim().toLowerCase();
            const record = signupCodes.get(email);
            if (!record)
                return { success: false, error: "No verification code found. Please register again." };
            if (Date.now() > record.expires) {
                signupCodes.delete(email);
                signupVerifyAttempts.delete(email);
                return { success: false, error: "Verification code has expired. Please register again." };
            }
            // Rate limit verification attempts
            const attempts = signupVerifyAttempts.get(email) || 0;
            if (attempts >= MAX_SIGNUP_VERIFY_ATTEMPTS) {
                signupCodes.delete(email);
                signupVerifyAttempts.delete(email);
                return { success: false, error: "Too many failed attempts. Please register again." };
            }
            if (record.code !== code.trim()) {
                signupVerifyAttempts.set(email, attempts + 1);
                const remaining = MAX_SIGNUP_VERIFY_ATTEMPTS - (attempts + 1);
                return { success: false, error: `Invalid verification code. ${remaining} attempt(s) remaining.` };
            }
            // Successful verification — update the users table
            const { error: updateErr } = await utils_1.supabase
                .from("users")
                .update({ email_verified: true })
                .eq("email", email);
            if (updateErr) {
                console.error("[AUTH] Failed to update email_verified:", updateErr.message);
                return { success: false, error: "Verification succeeded but failed to update profile." };
            }
            // Clean up
            signupCodes.delete(email);
            signupVerifyAttempts.delete(email);
            console.log(`[AUTH] Email verified for ${email}`);
            return { success: true };
        }
        catch (err) {
            return { success: false, error: (0, utils_1.getErrorMessage)(err) };
        }
    });
    // =========================
    // RESEND SIGNUP VERIFICATION CODE
    // =========================
    electron_1.ipcMain.handle("auth:resendSignupCode", async (_, email) => {
        try {
            email = (email || "").trim().toLowerCase();
            // Check user exists and is not yet verified
            const { data: user } = await utils_1.supabase
                .from("users")
                .select("id, email_verified")
                .eq("email", email)
                .maybeSingle();
            if (!user)
                return { success: false, error: "No account found with this email." };
            if (user.email_verified)
                return { success: false, error: "Email is already verified." };
            // Generate new code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            signupCodes.set(email, {
                code,
                expires: Date.now() + 15 * 60 * 1000,
            });
            signupVerifyAttempts.set(email, 0);
            // Send via SMTP
            let nodemailer;
            try {
                nodemailer = require("nodemailer");
            }
            catch {
                return { success: false, error: "Email service not available." };
            }
            const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
            const smtpPort = Number(process.env.SMTP_PORT || 587);
            const smtpUser = process.env.SMTP_USER || "";
            const smtpPass = process.env.SMTP_PASS || "";
            if (!smtpUser || !smtpPass) {
                return { success: false, error: "SMTP not configured." };
            }
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: { user: smtpUser, pass: smtpPass },
            });
            const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h1 style="color: #1e40af; margin-top: 0;">JRR Transport</h1>
          <p>Here is your new verification code:</p>
          <div style="background: #e0e7ff; padding: 16px; font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center; color: #1e40af; border-radius: 8px; margin: 24px 0;">
            ${code}
          </div>
          <p style="color: #64748b; font-size: 13px;">This code will expire in 15 minutes.</p>
        </div>
      `;
            await transporter.sendMail({
                from: `"JRR Transport Security" <${smtpUser}>`,
                to: email,
                subject: `JRR Transport — New Verification Code`,
                html: htmlBody,
            });
            return { success: true };
        }
        catch (err) {
            return { success: false, error: (0, utils_1.getErrorMessage)(err) };
        }
    });
    // =========================
    // ADMIN: GET PENDING USERS
    // =========================
    electron_1.ipcMain.handle("admin:getPendingUsers", async () => {
        try {
            const { data, error } = await utils_1.supabaseAdmin
                .from("users")
                .select("id, username, email, firstname, lastname, email_verified, account_status, role")
                .eq("account_status", "pending")
                .order("email", { ascending: true });
            if (error) {
                console.error("[ADMIN] getPendingUsers error:", error.message);
                return { success: false, error: error.message };
            }
            return { success: true, data: data || [] };
        }
        catch (err) {
            return { success: false, error: (0, utils_1.getErrorMessage)(err) };
        }
    });
    // =========================
    // ADMIN: GET ALL USERS
    // =========================
    electron_1.ipcMain.handle("admin:getAllUsers", async () => {
        try {
            const { data, error } = await utils_1.supabaseAdmin
                .from("users")
                .select("id, username, email, firstname, lastname, email_verified, account_status, role")
                .order("email", { ascending: true });
            if (error) {
                console.error("[ADMIN] getAllUsers error:", error.message);
                return { success: false, error: error.message };
            }
            return { success: true, data: data || [] };
        }
        catch (err) {
            return { success: false, error: (0, utils_1.getErrorMessage)(err) };
        }
    });
    // =========================
    // ADMIN: APPROVE USER
    // =========================
    electron_1.ipcMain.handle("admin:approveUser", async (_, userId) => {
        try {
            const { error } = await utils_1.supabaseAdmin
                .from("users")
                .update({ account_status: "approved", email_verified: true })
                .eq("id", userId);
            if (error) {
                console.error("[ADMIN] approveUser error:", error.message);
                return { success: false, error: error.message };
            }
            console.log(`[ADMIN] User ${userId} approved.`);
            return { success: true };
        }
        catch (err) {
            return { success: false, error: (0, utils_1.getErrorMessage)(err) };
        }
    });
    // =========================
    // ADMIN: REJECT USER
    // =========================
    electron_1.ipcMain.handle("admin:rejectUser", async (_, userId) => {
        try {
            const { error } = await utils_1.supabaseAdmin
                .from("users")
                .update({ account_status: "rejected" })
                .eq("id", userId);
            if (error) {
                console.error("[ADMIN] rejectUser error:", error.message);
                return { success: false, error: error.message };
            }
            console.log(`[ADMIN] User ${userId} rejected.`);
            return { success: true };
        }
        catch (err) {
            return { success: false, error: (0, utils_1.getErrorMessage)(err) };
        }
    });
    // =========================
    // ADMIN: DELETE USER
    // =========================
    electron_1.ipcMain.handle("admin:deleteUser", async (_, userId) => {
        try {
            // Delete from users table
            const { error: dbErr } = await utils_1.supabaseAdmin
                .from("users")
                .delete()
                .eq("id", userId);
            if (dbErr) {
                console.error("[ADMIN] deleteUser DB error:", dbErr.message);
                return { success: false, error: dbErr.message };
            }
            // Try to delete from Supabase Auth too
            try {
                await utils_1.supabaseAdmin.auth.admin.deleteUser(userId);
            }
            catch (authErr) {
                console.warn("[ADMIN] Auth user cleanup failed (may not exist):", authErr);
            }
            console.log(`[ADMIN] User ${userId} deleted.`);
            return { success: true };
        }
        catch (err) {
            return { success: false, error: (0, utils_1.getErrorMessage)(err) };
        }
    });
    // --- Custom Desktop Password Recovery (SMTP based) ---
    // Store verification codes temporarily in memory
    const recoveryCodes = new Map();
    electron_1.ipcMain.handle("auth:sendRecoveryCode", async (_, email) => {
        try {
            email = (email || "").trim().toLowerCase();
            if (!email)
                return { success: false, error: "Email is required." };
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return { success: false, error: "Invalid email format." };
            }
            // 1. Check if user exists in the `users` table
            const { data: user, error: userErr } = await utils_1.supabase.from("users").select("id").eq("email", email).maybeSingle();
            if (!user) {
                // For security, you might want to return success anyway to prevent email enumeration,
                // but for usability we'll return an error.
                return { success: false, error: "No account found with this email." };
            }
            // 2. Generate a 6-digit code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            // Store code (valid for 15 minutes) and reset attempt counter
            recoveryCodes.set(email, {
                code,
                expires: Date.now() + 15 * 60 * 1000
            });
            recoveryAttempts.set(email, 0);
            // 3. Send via Nodemailer using configured SMTP
            let nodemailer;
            try {
                nodemailer = require("nodemailer");
            }
            catch {
                return { success: false, error: "Nodemailer is not installed." };
            }
            const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
            const smtpPort = Number(process.env.SMTP_PORT || 587);
            const smtpUser = process.env.SMTP_USER || "";
            const smtpPass = process.env.SMTP_PASS || "";
            if (!smtpUser || !smtpPass) {
                return { success: false, error: "SMTP credentials not configured in system environment." };
            }
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: { user: smtpUser, pass: smtpPass }
            });
            const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h1 style="color: #1e40af; margin-top: 0;">JRR Transport</h1>
          <p>You requested a password reset for your account.</p>
          <p>Your verification code is:</p>
          <div style="background: #e0e7ff; padding: 16px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #1e40af; border-radius: 8px; margin: 24px 0;">
            ${code}
          </div>
          <p style="color: #64748b; font-size: 13px;">This code will expire in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `;
            await transporter.sendMail({
                from: `"JRR Transport Security" <${smtpUser}>`,
                to: email,
                subject: `JRR Transport — Password Reset Request`,
                html: htmlBody
            });
            return { success: true };
        }
        catch (err) {
            console.error("[AUTH] sendRecoveryCode error:", err);
            return { success: false, error: (0, utils_1.getErrorMessage)(err) };
        }
    });
    electron_1.ipcMain.handle("auth:verifyRecoveryCode", async (_, email, code) => {
        try {
            email = (email || "").trim().toLowerCase();
            const record = recoveryCodes.get(email);
            if (!record)
                return { success: false, error: "No recovery code requested or code expired." };
            if (Date.now() > record.expires) {
                recoveryCodes.delete(email);
                recoveryAttempts.delete(email);
                return { success: false, error: "Recovery code has expired. Please request a new one." };
            }
            // Rate limit verification attempts
            const attempts = recoveryAttempts.get(email) || 0;
            if (attempts >= MAX_RECOVERY_ATTEMPTS) {
                recoveryCodes.delete(email);
                recoveryAttempts.delete(email);
                return { success: false, error: "Too many failed attempts. Please request a new code." };
            }
            if (record.code !== code.trim()) {
                recoveryAttempts.set(email, attempts + 1);
                const remaining = MAX_RECOVERY_ATTEMPTS - (attempts + 1);
                return { success: false, error: `Invalid verification code. ${remaining} attempt(s) remaining.` };
            }
            // Successful verification — reset attempts
            recoveryAttempts.delete(email);
            return { success: true };
        }
        catch (err) {
            return { success: false, error: (0, utils_1.getErrorMessage)(err) };
        }
    });
    electron_1.ipcMain.handle("auth:updatePasswordWithCode", async (_, email, code, newPassword) => {
        try {
            email = (email || "").trim().toLowerCase();
            newPassword = (newPassword || "").trim();
            // Password strength validation
            if (newPassword.length < 8) {
                return { success: false, error: "Password must be at least 8 characters." };
            }
            // 1. Double check the code
            const record = recoveryCodes.get(email);
            if (!record || record.code !== code.trim() || Date.now() > record.expires) {
                return { success: false, error: "Session invalid or expired." };
            }
            // 2. Get user ID
            const { data: user, error: userErr } = await utils_1.supabase.from("users").select("id").eq("email", email).single();
            if (userErr || !user)
                return { success: false, error: "User not found." };
            const uid = user.id;
            // 3. Update Supabase Auth (using Admin API)
            if (utils_1.supabaseAdmin) {
                const { error: authErr } = await utils_1.supabaseAdmin.auth.admin.updateUserById(uid, { password: newPassword });
                if (authErr)
                    console.warn("[AUTH] Admin API update warning:", authErr.message);
            }
            // 4. Update fallback 'users' table
            const { error: dbErr } = await utils_1.supabase.from("users").update({ password: newPassword }).eq("id", uid);
            if (dbErr)
                return { success: false, error: "Failed to update user profile: " + dbErr.message };
            // Clear the code so it can't be used again
            recoveryCodes.delete(email);
            return { success: true };
        }
        catch (err) {
            return { success: false, error: (0, utils_1.getErrorMessage)(err) };
        }
    });
}
//# sourceMappingURL=auth.js.map