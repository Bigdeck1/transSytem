import { Router, Request, Response } from "express";
import { supabase, supabaseAdmin } from "../config/supabase";
import { createNotificationForEmployee } from "./notifications.routes";
import nodemailer from "nodemailer";

export const payrollRouter = Router();

function calcHours(check_in?: string | null, check_out?: string | null): number {
  if (!check_in || !check_out) return 0;
  const inMs = Date.parse(`1970-01-01T${check_in}`);
  let outMs = Date.parse(`1970-01-01T${check_out}`);
  if (Number.isNaN(inMs) || Number.isNaN(outMs)) return 0;
  if (outMs <= inMs) {
    outMs += 24 * 60 * 60 * 1000;
  }
  const diff = (outMs - inMs) / (1000 * 60 * 60);
  return diff > 0 ? diff : 0;
}

// GET single employee monthly payroll
payrollRouter.get("/my-monthly", async (req: Request, res: Response) => {
  try {
    const { userId, month } = req.query;
    if (!userId) return res.status(400).json({ ok: false, message: "Missing userId" });
    if (!month || !/^\d{4}-\d{2}$/.test(String(month))) {
      return res.status(400).json({ ok: false, message: "Invalid month format. Use YYYY-MM." });
    }

    const monthYYYYMM = String(month);
    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("id, employee_id, full_name, daily_rate")
      .eq("supabase_user_id", userId)
      .single();

    if (empErr || !emp) return res.status(404).json({ ok: false, message: "Employee not linked." });

    const startDate = `${monthYYYYMM}-01`;
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + 1);
    const endDate = end.toISOString().slice(0, 10);

    const { data: rows, error: attErr } = await supabase
      .from("attendance")
      .select("id, date, check_in, check_out")
      .eq("employee_id", emp.id)
      .gte("date", startDate)
      .lt("date", endDate)
      .order("date", { ascending: true });

    if (attErr) return res.status(500).json({ ok: false, message: attErr.message });

    const dailyRate = Number(emp.daily_rate ?? 0);
    const STD_HOURS = 8;

    const days = (rows ?? []).map((r: any) => {
      const hrs = calcHours(r.check_in, r.check_out);
      const amount = dailyRate * Math.min(hrs / STD_HOURS, 1);
      return {
        date: r.date,
        check_in: r.check_in,
        check_out: r.check_out,
        hours: Number(hrs.toFixed(2)),
        day_amount: Number(amount.toFixed(2))
      };
    });

    const totalHours = days.reduce((s: number, d: any) => s + d.hours, 0);
    const grossPay = days.reduce((s: number, d: any) => s + d.day_amount, 0);

    return res.json({
      ok: true,
      employee: { id: emp.id, employee_code: emp.employee_id, full_name: emp.full_name, daily_rate: dailyRate },
      period: { month: monthYYYYMM, startDate, endDate },
      summary: {
        totalDaysWithTimeout: days.filter((d: any) => d.hours > 0).length,
        totalHours: Number(totalHours.toFixed(2)),
        grossPay: Number(grossPay.toFixed(2)),
        bonus: 0,
        deductions: 0,
        netPay: Number(grossPay.toFixed(2))
      },
      days
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err?.message || "Unknown error" });
  }
});

// GET all employees monthly payroll
payrollRouter.get("/monthly-all", async (req: Request, res: Response) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(String(month))) {
      return res.status(400).json({ ok: false, message: "Invalid month format. Use YYYY-MM." });
    }

    const monthYYYYMM = String(month);
    const startDate = `${monthYYYYMM}-01`;
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + 1);
    const endDate = end.toISOString().slice(0, 10);

    const [{ data: emps, error: empErr }, { data: att, error: attErr }] = await Promise.all([
      supabase.from("employees").select("id, employee_id, full_name, daily_rate, status, department, position, email").order("full_name", { ascending: true }),
      supabase.from("attendance").select("employee_id, date, check_in, check_out").gte("date", startDate).lt("date", endDate)
    ]);

    if (empErr) return res.status(500).json({ ok: false, message: empErr.message });
    if (attErr) return res.status(500).json({ ok: false, message: attErr.message });

    const STD_HOURS = 8;
    const byEmp = new Map<string, any[]>();
    for (const row of att ?? []) {
      if (!byEmp.has(row.employee_id)) byEmp.set(row.employee_id, []);
      byEmp.get(row.employee_id)!.push(row);
    }

    const payroll = (emps ?? []).map((e: any) => {
      const rows = byEmp.get(e.id) ?? [];
      const dailyRate = Number(e.daily_rate ?? 0);
      const days = rows.map((r: any) => {
        const hrs = calcHours(r.check_in, r.check_out);
        const amount = dailyRate * Math.min(hrs / STD_HOURS, 1);
        return {
          date: r.date,
          check_in: r.check_in,
          check_out: r.check_out,
          hours: Number(hrs.toFixed(2)),
          day_amount: Number(amount.toFixed(2))
        };
      });

      const totalHours = days.reduce((s: number, d: any) => s + d.hours, 0);
      const grossPay = days.reduce((s: number, d: any) => s + d.day_amount, 0);

      return {
        employee: {
          id: e.id,
          employee_code: e.employee_id,
          full_name: e.full_name,
          department: e.department,
          position: e.position,
          status: e.status,
          daily_rate: dailyRate,
          email: e.email
        },
        summary: {
          totalDaysWithTimeout: days.filter((d: any) => d.hours > 0).length,
          totalHours: Number(totalHours.toFixed(2)),
          grossPay: Number(grossPay.toFixed(2)),
          bonus: 0,
          deductions: 0,
          netPay: Number(grossPay.toFixed(2))
        },
        days
      };
    });

    const totals = payroll.reduce((acc, p) => {
      acc.gross += p.summary.grossPay;
      acc.net += p.summary.netPay;
      acc.totalEmployees += 1;
      return acc;
    }, { gross: 0, net: 0, totalEmployees: 0 });

    return res.json({
      ok: true,
      period: { month: monthYYYYMM, startDate, endDate },
      totals: {
        gross: Number(totals.gross.toFixed(2)),
        net: Number(totals.net.toFixed(2)),
        employees: totals.totalEmployees
      },
      payroll
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err?.message || "Unknown error" });
  }
});

// SEND payslip email
payrollRouter.post("/send-payslip", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";

    if (!smtpUser || !smtpPass) {
      return res.status(500).json({ ok: false, message: "SMTP credentials not configured on server." });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass }
    });

    const money = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 32px;">
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 24px 32px; border-radius: 16px 16px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">JRR Transport</h1>
          <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Payslip — ${data.period}</p>
        </div>
        <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 8px 0; color: #64748b;">Employee</td><td style="padding: 8px 0; font-weight: 700; text-align: right;">${data.employeeName}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Employee Code</td><td style="padding: 8px 0; font-weight: 700; text-align: right;">${data.employeeCode || "-"}</td></tr>
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

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[Payroll Email Error]", err);
    return res.status(500).json({ ok: false, message: err?.message || "Failed to send email" });
  }
});

// FINALIZE & publish payroll
payrollRouter.post("/finalize", async (req: Request, res: Response) => {
  try {
    const { month } = req.body;
    if (!month || !/^\d{4}-\d{2}$/.test(String(month))) {
      return res.status(400).json({ ok: false, message: "Invalid month format. Use YYYY-MM." });
    }

    const monthYYYYMM = String(month);
    const { data: employees, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id, employee_id, full_name, email, daily_rate")
      .in("status", ["active", "available", "in-use"]);

    if (empErr || !employees?.length) {
      return res.status(400).json({ ok: false, message: empErr?.message || "No employees found." });
    }

    const startDate = `${monthYYYYMM}-01`;
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + 1);
    const endDate = end.toISOString().slice(0, 10);
    const STD_HOURS = 8;

    const paychecks: any[] = [];

    for (const emp of employees) {
      const { data: attendance } = await supabaseAdmin
        .from("attendance")
        .select("id, date, check_in, check_out")
        .eq("employee_id", emp.id)
        .gte("date", startDate)
        .lt("date", endDate)
        .order("date", { ascending: true });

      const dailyRate = Number(emp.daily_rate ?? 0);
      let totalHours = 0;
      let grossPay = 0;

      (attendance ?? []).forEach((r: any) => {
        const hrs = calcHours(r.check_in, r.check_out);
        totalHours += hrs;
        grossPay += dailyRate * Math.min(hrs / STD_HOURS, 1);
      });

      if (totalHours === 0) continue;

      const deductions = 0;
      const netPay = grossPay - deductions;

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
      return res.status(400).json({ ok: false, message: "No attendance data found for this period." });
    }

    // Delete existing paychecks for period then insert fresh
    await supabaseAdmin
      .from("paychecks")
      .delete()
      .gte("pay_period_start", startDate)
      .lt("pay_period_start", endDate);

    const { error: insertErr } = await supabaseAdmin
      .from("paychecks")
      .insert(paychecks);

    if (insertErr) {
      return res.status(500).json({ ok: false, message: "Failed to save paychecks: " + insertErr.message });
    }

    const monthLabel = new Date(startDate).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    for (const pc of paychecks) {
      await createNotificationForEmployee(
        pc.employee_id,
        "Paycheck Ready",
        `Your paycheck for ${monthLabel} has been finalized. Net pay: ₱${pc.net_pay.toLocaleString()}.`,
        "paycheck"
      );
    }

    return res.json({
      ok: true,
      message: `Successfully finalized ${paychecks.length} paychecks for ${monthLabel}.`,
      count: paychecks.length
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err?.message || "Failed to finalize payroll." });
  }
});
