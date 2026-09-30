"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupPayrollIPC = setupPayrollIPC;
const electron_1 = require("electron");
const utils_1 = require("./utils");
const notifications_1 = require("./notifications");
function setupPayrollIPC() {
    electron_1.ipcMain.handle("payroll:getMyMonthly", async (_, userId, monthYYYYMM) => {
        try {
            if (!userId)
                return { ok: false, message: "Missing userId" };
            if (!monthYYYYMM || !/^\d{4}-\d{2}$/.test(monthYYYYMM))
                return { ok: false, message: "Invalid month format. Use YYYY-MM." };
            const { data: emp, error: empErr } = await utils_1.supabase.from("employees").select("id, employee_id, full_name, daily_rate").eq("supabase_user_id", userId).single();
            if (empErr || !emp)
                return { ok: false, message: "Employee not linked." };
            const startDate = `${monthYYYYMM}-01`;
            const end = new Date(startDate);
            end.setMonth(end.getMonth() + 1);
            const endDate = end.toISOString().slice(0, 10);
            const { data: rows, error: attErr } = await utils_1.supabase.from("attendance").select("id, date, check_in, check_out").eq("employee_id", emp.id).gte("date", startDate).lt("date", endDate).order("date", { ascending: true });
            if (attErr)
                return { ok: false, message: attErr.message };
            const dailyRate = Number(emp.daily_rate ?? 0);
            const STD_HOURS = 8;
            const days = (rows ?? []).map((r) => {
                const hrs = calcHours(r.check_in, r.check_out);
                // NOTE: Pay is capped at 1 full day (no overtime). Intentional business rule.
                const amount = dailyRate * Math.min(hrs / STD_HOURS, 1);
                return { date: r.date, check_in: r.check_in, check_out: r.check_out, hours: Number(hrs.toFixed(2)), day_amount: Number(amount.toFixed(2)) };
            });
            const totalHours = days.reduce((s, d) => s + d.hours, 0);
            const grossPay = days.reduce((s, d) => s + d.day_amount, 0);
            return {
                ok: true,
                employee: { id: emp.id, employee_code: emp.employee_id, full_name: emp.full_name, daily_rate: dailyRate },
                period: { month: monthYYYYMM, startDate, endDate },
                summary: { totalDaysWithTimeout: days.filter((d) => d.hours > 0).length, totalHours: Number(totalHours.toFixed(2)), grossPay: Number(grossPay.toFixed(2)), bonus: 0, deductions: 0, netPay: Number(grossPay.toFixed(2)) },
                days
            };
        }
        catch (err) {
            return { ok: false, message: err?.message || "Unknown error" };
        }
    });
    electron_1.ipcMain.handle("payroll:getMonthlyAll", async (_, monthYYYYMM) => {
        try {
            if (!monthYYYYMM || !/^\d{4}-\d{2}$/.test(monthYYYYMM))
                return { ok: false, message: "Invalid month format." };
            const startDate = `${monthYYYYMM}-01`;
            const end = new Date(startDate);
            end.setMonth(end.getMonth() + 1);
            const endDate = end.toISOString().slice(0, 10);
            const [{ data: emps, error: empErr }, { data: att, error: attErr }] = await Promise.all([
                utils_1.supabase.from("employees").select("id, employee_id, full_name, daily_rate, status, department, position, email").order("full_name", { ascending: true }),
                utils_1.supabase.from("attendance").select("employee_id, date, check_in, check_out").gte("date", startDate).lt("date", endDate)
            ]);
            if (empErr)
                return { ok: false, message: empErr.message };
            if (attErr)
                return { ok: false, message: attErr.message };
            const STD_HOURS = 8;
            const byEmp = new Map();
            for (const row of att ?? []) {
                if (!byEmp.has(row.employee_id))
                    byEmp.set(row.employee_id, []);
                byEmp.get(row.employee_id).push(row);
            }
            const payroll = (emps ?? []).map((e) => {
                const rows = byEmp.get(e.id) ?? [];
                const dailyRate = Number(e.daily_rate ?? 0);
                const days = rows.map((r) => {
                    const hrs = calcHours(r.check_in, r.check_out);
                    const amount = dailyRate * Math.min(hrs / STD_HOURS, 1);
                    return { date: r.date, check_in: r.check_in, check_out: r.check_out, hours: Number(hrs.toFixed(2)), day_amount: Number(amount.toFixed(2)) };
                });
                const totalHours = days.reduce((s, d) => s + d.hours, 0);
                const grossPay = days.reduce((s, d) => s + d.day_amount, 0);
                return {
                    employee: { id: e.id, employee_code: e.employee_id, full_name: e.full_name, department: e.department, position: e.position, status: e.status, daily_rate: dailyRate, email: e.email },
                    summary: { totalDaysWithTimeout: days.filter((d) => d.hours > 0).length, totalHours: Number(totalHours.toFixed(2)), grossPay: Number(grossPay.toFixed(2)), bonus: 0, deductions: 0, netPay: Number(grossPay.toFixed(2)) },
                    days
                };
            });
            const totals = payroll.reduce((acc, p) => { acc.gross += p.summary.grossPay; acc.net += p.summary.netPay; acc.totalEmployees += 1; return acc; }, { gross: 0, net: 0, totalEmployees: 0 });
            return {
                ok: true,
                period: { month: monthYYYYMM, startDate, endDate },
                totals: { gross: Number(totals.gross.toFixed(2)), net: Number(totals.net.toFixed(2)), employees: totals.totalEmployees },
                payroll
            };
        }
        catch (err) {
            return { ok: false, message: err?.message || "Unknown error" };
        }
    });
    // ===========================
    // SEND PAYSLIP EMAIL
    // ===========================
    electron_1.ipcMain.handle("payroll:sendPayslipEmail", async (_, data) => {
        try {
            // Dynamic import of nodemailer (it may or may not be installed)
            let nodemailer;
            try {
                nodemailer = require("nodemailer");
            }
            catch {
                return { ok: false, message: "Nodemailer is not installed. Run: npm install nodemailer" };
            }
            const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
            const smtpPort = Number(process.env.SMTP_PORT || 587);
            const smtpUser = process.env.SMTP_USER || "";
            const smtpPass = process.env.SMTP_PASS || "";
            console.log(`[Payroll Email] SMTP Config: host=${smtpHost}, port=${smtpPort}, user=${smtpUser}, pass=${'*'.repeat(smtpPass.length)} (${smtpPass.length} chars)`);
            if (!smtpUser || !smtpPass) {
                return { ok: false, message: "SMTP credentials not configured. Set SMTP_USER and SMTP_PASS in your .env file." };
            }
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: { user: smtpUser, pass: smtpPass }
            });
            const money = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 32px;">
          <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 24px 32px; border-radius: 16px 16px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">JRR Transport</h1>
            <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Payslip — ${data.period}</p>
          </div>
          <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 8px 0; color: #64748b;">Employee</td><td style="padding: 8px 0; font-weight: 700; text-align: right;">${data.employeeName}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Employee Code</td><td style="padding: 8px 0; font-weight: 700; text-align: right;">${data.employeeCode || '-'}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Daily Rate</td><td style="padding: 8px 0; font-weight: 700; text-align: right;">${money(data.dailyRate)}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Days Worked</td><td style="padding: 8px 0; font-weight: 700; text-align: right;">${data.daysWorked}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Total Hours</td><td style="padding: 8px 0; font-weight: 700; text-align: right;">${data.totalHours}</td></tr>
              <tr style="border-top: 2px solid #e2e8f0;"><td style="padding: 12px 0; color: #64748b;">Gross Pay</td><td style="padding: 12px 0; font-weight: 700; text-align: right;">${money(data.grossPay)}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Bonus</td><td style="padding: 8px 0; font-weight: 700; text-align: right; color: #10b981;">${money(data.bonus)}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Deductions</td><td style="padding: 8px 0; font-weight: 700; text-align: right; color: #ef4444;">-${money(data.deductions)}</td></tr>
              <tr style="border-top: 2px solid #1e40af;"><td style="padding: 12px 0; font-weight: 800; font-size: 16px;">Net Pay</td><td style="padding: 12px 0; font-weight: 900; text-align: right; font-size: 18px; color: #1e40af;">${money(data.netPay)}</td></tr>
            </table>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; text-align: center;">This is an automated payslip from JRR Transport Management System.</p>
          </div>
        </div>
      `;
            await transporter.sendMail({
                from: `"JRR Transport Payroll" <${smtpUser}>`,
                to: data.employeeEmail,
                subject: `Payslip for ${data.period} — ${data.employeeName}`,
                html: htmlBody
            });
            return { ok: true };
        }
        catch (err) {
            console.error("[Payroll Email Error]", err);
            return { ok: false, message: err?.message || "Failed to send email" };
        }
    });
    // =============================================
    // FINALIZE & PUBLISH PAYROLL TO PAYCHECKS TABLE
    // =============================================
    electron_1.ipcMain.handle("payroll:finalize", async (_, monthYYYYMM) => {
        try {
            if (!monthYYYYMM || !/^\d{4}-\d{2}$/.test(monthYYYYMM)) {
                return { ok: false, message: "Invalid month format. Use YYYY-MM." };
            }
            // 1. Get all active employees with daily rates
            const { data: employees, error: empErr } = await utils_1.supabaseAdmin
                .from("employees")
                .select("id, employee_id, full_name, email, daily_rate")
                .in("status", ["active", "available", "in-use"]);
            if (empErr || !employees?.length) {
                return { ok: false, message: empErr?.message || "No employees found." };
            }
            // 2. Compute date range for the month
            const startDate = `${monthYYYYMM}-01`;
            const end = new Date(startDate);
            end.setMonth(end.getMonth() + 1);
            const endDate = end.toISOString().slice(0, 10);
            const STD_HOURS = 8;
            // 3. Process each employee's attendance into paycheck data
            const paychecks = [];
            for (const emp of employees) {
                const { data: attendance } = await utils_1.supabaseAdmin
                    .from("attendance")
                    .select("id, date, check_in, check_out")
                    .eq("employee_id", emp.id)
                    .gte("date", startDate)
                    .lt("date", endDate)
                    .order("date", { ascending: true });
                const dailyRate = Number(emp.daily_rate ?? 0);
                let totalHours = 0;
                let grossPay = 0;
                (attendance ?? []).forEach((r) => {
                    const hrs = calcHours(r.check_in, r.check_out);
                    totalHours += hrs;
                    grossPay += dailyRate * Math.min(hrs / STD_HOURS, 1);
                });
                // Skip employees with zero hours
                if (totalHours === 0)
                    continue;
                const deductions = 0; // Placeholder for future SSS/PhilHealth/Tax
                const netPay = grossPay - deductions;
                // End date of the period is last day of the month
                const payPeriodEnd = new Date(end);
                payPeriodEnd.setDate(payPeriodEnd.getDate() - 1);
                paychecks.push({
                    employee_id: emp.id,
                    pay_period_start: startDate,
                    pay_period_end: payPeriodEnd.toISOString().slice(0, 10),
                    gross_pay: Number(grossPay.toFixed(2)),
                    deductions: Number(deductions.toFixed(2)),
                    net_pay: Number(netPay.toFixed(2)),
                    hours_worked: Number(totalHours.toFixed(2)),
                    status: "paid",
                    payment_date: new Date().toISOString().slice(0, 10)
                });
            }
            if (paychecks.length === 0) {
                return { ok: false, message: "No attendance data found for this period." };
            }
            // 4. Delete existing paychecks for this period then insert fresh ones
            await utils_1.supabaseAdmin
                .from("paychecks")
                .delete()
                .gte("pay_period_start", startDate)
                .lt("pay_period_start", endDate);
            const { error: insertErr } = await utils_1.supabaseAdmin
                .from("paychecks")
                .insert(paychecks);
            if (insertErr) {
                return { ok: false, message: "Failed to save paychecks: " + insertErr.message };
            }
            // 5. Create notifications for each employee
            const monthLabel = new Date(startDate).toLocaleDateString("en-US", { month: "long", year: "numeric" });
            for (const pc of paychecks) {
                await (0, notifications_1.createNotificationForEmployee)(pc.employee_id, "Paycheck Ready", `Your paycheck for ${monthLabel} has been finalized. Net pay: ₱${pc.net_pay.toLocaleString()}.`, "paycheck");
            }
            return {
                ok: true,
                message: `Successfully finalized ${paychecks.length} paychecks for ${monthLabel}.`,
                count: paychecks.length
            };
        }
        catch (err) {
            console.error("[Payroll Finalize Error]", err);
            return { ok: false, message: err?.message || "Failed to finalize payroll." };
        }
    });
}
function calcHours(check_in, check_out) {
    if (!check_in || !check_out)
        return 0;
    const inMs = Date.parse(`1970-01-01T${check_in}`);
    let outMs = Date.parse(`1970-01-01T${check_out}`);
    if (Number.isNaN(inMs) || Number.isNaN(outMs))
        return 0;
    // Handle overnight shifts (check_out is earlier than check_in = crossed midnight)
    if (outMs <= inMs) {
        outMs += 24 * 60 * 60 * 1000; // Add 24 hours
    }
    const diff = (outMs - inMs) / (1000 * 60 * 60);
    return diff > 0 ? diff : 0;
}
//# sourceMappingURL=payroll.js.map