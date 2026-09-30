document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("tableBody");
  const monthFilter = document.getElementById("monthFilter");
  const searchInput = document.getElementById("searchInput");
  const employeeSelect = document.getElementById("employeeSelect");
  const generateBtn = document.getElementById("generateBtn");

  // Default to current month
  monthFilter.value = new Date().toISOString().slice(0, 7);

  // State
  let allEmployees = [];
  let currentPayrollData = null; // Stores the full getMonthlyAll result

  function money(n) {
    return `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // ===========================
  // LOAD EMPLOYEES INTO SELECTOR
  // ===========================
  async function loadEmployeeSelector() {
    try {
      allEmployees = (await window.api.getEmployees()) || [];
      employeeSelect.innerHTML = '<option value="all">All Employees</option>';
      allEmployees.forEach(emp => {
        const opt = document.createElement("option");
        opt.value = emp.id;
        opt.textContent = `${emp.full_name} (${emp.employee_id || ''})`;
        employeeSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Failed to load employees:", err);
    }
  }

  // ===========================
  // UPDATE STATS CARDS
  // ===========================
  function updateStats(stats) {
    const setStatValue = (id, val) => {
      const card = document.getElementById(id);
      if (card) {
        const h2 = card.querySelector("h2") || card.querySelector(".stat-value");
        if (h2) h2.textContent = val;
      }
    };
    setStatValue("totalSalaries", money(stats.netPay));
    setStatValue("totalBonuses", money(stats.bonus));
    setStatValue("totalDeductions", money(stats.deductions));
    setStatValue("employeesProcessed", stats.employeeCount);
  }

  // ===========================
  // RENDER TABLE (ALL EMPLOYEES)
  // ===========================
  function renderAllEmployees(payrollList, month, searchTerm = "") {
    tableBody.innerHTML = "";

    const filterText = searchInput?.value?.trim().toLowerCase() || "";

    if (!filterText) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:var(--text-muted);">
        <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
        Please use the search bar to display payroll data.
      </td></tr>`;
      updateStats({ netPay: 0, bonus: 0, deductions: 0, employeeCount: 0 });
      return;
    }

    if (!payrollList || payrollList.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:var(--text-muted);">
        <div style="font-size: 48px; margin-bottom: 12px;">📊</div>
        No payroll data for this period.
      </td></tr>`;
      updateStats({ netPay: 0, bonus: 0, deductions: 0, employeeCount: 0 });
      return;
    }

    // Filter by search
    let filtered = payrollList;
    if (searchTerm) {
      filtered = payrollList.filter(p =>
        p.employee.full_name.toLowerCase().includes(searchTerm) ||
        (p.employee.employee_code || "").toLowerCase().includes(searchTerm)
      );
    }

    // Aggregate stats
    const totalNet = filtered.reduce((s, p) => s + p.summary.netPay, 0);
    const totalBonus = filtered.reduce((s, p) => s + p.summary.bonus, 0);
    const totalDeductions = filtered.reduce((s, p) => s + p.summary.deductions, 0);
    updateStats({
      netPay: totalNet,
      bonus: totalBonus,
      deductions: totalDeductions,
      employeeCount: filtered.length
    });

    filtered.forEach((p, i) => {
      const emp = p.employee;
      const sum = p.summary;

      const tr = document.createElement("tr");
      tr.className = "animate-fadeIn";
      tr.style.animationDelay = `${Math.min(i * 0.04, 0.5)}s`;

      tr.innerHTML = `
        <td>
          <strong>${emp.full_name}</strong><br><small style="color: var(--text-muted);">${emp.employee_code || ''}</small>
        </td>
        <td>${month}</td>
        <td style="font-weight: 700;">${sum.totalDaysWithTimeout}</td>
        <td>${money(sum.grossPay)}</td>
        <td style="color: var(--success);">${money(sum.bonus)}</td>
        <td style="color: var(--error);">-${money(sum.deductions)}</td>
        <td><strong>${money(sum.netPay)}</strong></td>
        <td><span class="badge badge-info">Computed</span></td>
        <td style="text-align: right;">
          <button class="btn-secondary view-payslip-btn" style="padding: 6px 14px; font-size: 12px;" data-emp-id="${emp.id}">
            View Payslip
          </button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // Bind view buttons
    document.querySelectorAll(".view-payslip-btn").forEach(btn => {
      btn.onclick = () => openPayslipModal(btn.dataset.empId);
    });
  }

  // ===========================
  // OPEN PAYSLIP MODAL
  // ===========================
  function openPayslipModal(empId) {
    if (!currentPayrollData) return;
    const entry = currentPayrollData.payroll.find(p => p.employee.id === empId);
    if (!entry) return;

    const modal = document.getElementById("viewModal");
    const modalBody = document.getElementById("modalBody");
    const emp = entry.employee;
    const sum = entry.summary;

    const dayRows = entry.days.length > 0 ? entry.days.map(d => `
      <tr>
        <td>${String(d.date).slice(0, 10)}</td>
        <td>${d.check_in || "-"}</td>
        <td>${d.check_out || "-"}</td>
        <td>${d.hours.toFixed(2)}</td>
        <td>${money(d.day_amount)}</td>
      </tr>
    `).join("") : `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 20px;">No attendance records this period.</td></tr>`;

    modalBody.innerHTML = `
      <div class="payslip-section">
        <div>
          <div class="ps-label">Employee</div>
          <div class="ps-value">${emp.full_name}</div>
        </div>
        <div>
          <div class="ps-label">Employee Code</div>
          <div class="ps-value">${emp.employee_code || '-'}</div>
        </div>
        <div>
          <div class="ps-label">Department</div>
          <div class="ps-value">${emp.department || '-'}</div>
        </div>
        <div>
          <div class="ps-label">Position</div>
          <div class="ps-value">${emp.position || '-'}</div>
        </div>
        <div>
          <div class="ps-label">Daily Rate</div>
          <div class="ps-value" style="color: var(--primary);">${money(emp.daily_rate)}</div>
        </div>
        <div>
          <div class="ps-label">Days Worked</div>
          <div class="ps-value" style="color: var(--success);">${sum.totalDaysWithTimeout}</div>
        </div>
      </div>

      <div style="background: var(--gradient-primary); color: white; padding: 16px 20px; border-radius: 12px; margin: 16px 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center;">
        <div>
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; opacity: 0.8;">Gross</div>
          <div style="font-size: 18px; font-weight: 900;">${money(sum.grossPay)}</div>
        </div>
        <div>
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; opacity: 0.8;">Deductions</div>
          <div style="font-size: 18px; font-weight: 900;">-${money(sum.deductions)}</div>
        </div>
        <div>
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; opacity: 0.8;">Net Pay</div>
          <div style="font-size: 18px; font-weight: 900;">${money(sum.netPay)}</div>
        </div>
      </div>

      <h3 style="font-size: 14px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Daily Breakdown</h3>
      <div style="max-height: 250px; overflow-y: auto; border-radius: 8px; border: 1px solid var(--border-subtle);">
        <table class="payslip-days-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>In</th>
              <th>Out</th>
              <th>Hours</th>
              <th>Pay</th>
            </tr>
          </thead>
          <tbody>${dayRows}</tbody>
        </table>
      </div>
    `;

    // Store current payslip employee for email
    window._currentPayslipEmployee = { emp, sum, days: entry.days, period: currentPayrollData.period };

    modal.classList.remove("hidden");
    modal.style.display = "flex";

    // Clear email status
    const emailArea = document.getElementById("emailStatusArea");
    if (emailArea) emailArea.innerHTML = "";
  }

  // ===========================
  // LOAD PAYROLL
  // ===========================
  async function loadPayroll() {
    const month = monthFilter.value;
    const selectedEmp = employeeSelect.value;

    try {
      const payload = await window.api.payroll.getMonthlyAll(month);
      if (!payload?.ok) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--text-muted);">
          ${payload?.message || "Failed to load payroll"}
        </td></tr>`;
        return;
      }

      currentPayrollData = payload;
      window._currentPayroll = payload;

      let payrollList = payload.payroll;

      // Filter to selected employee if not "all"
      if (selectedEmp !== "all") {
        payrollList = payrollList.filter(p => p.employee.id === selectedEmp);
      }

      renderAllEmployees(payrollList, month);
    } catch (err) {
      console.error("Failed to load payroll:", err);
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--error);">
        Error loading payroll data
      </td></tr>`;
    }
  }

  // ===========================
  // GENERATE BUTTON
  // ===========================
  generateBtn.addEventListener("click", loadPayroll);

  // ===========================
  // FINALIZE BUTTON
  // ===========================
  const finalizeBtn = document.getElementById("finalizeBtn");
  if (finalizeBtn) {
    finalizeBtn.addEventListener("click", async () => {
      const month = monthFilter.value;
      if (!currentPayrollData || !currentPayrollData.payroll || currentPayrollData.payroll.length === 0) {
        alert("Please generate payroll data first before finalizing.");
        return;
      }

      const confirmMsg = `Are you sure you want to finalize payroll for ${month}? This will publish paychecks to the mobile app and notify employees.`;
      if (!confirm(confirmMsg)) return;

      const originalText = finalizeBtn.innerHTML;
      finalizeBtn.innerHTML = '<i class="lucide-loader"></i> Finalizing...';
      finalizeBtn.disabled = true;

      try {
        const result = await window.api.payroll.finalize(month);
        if (result.ok) {
          alert(`Success! ${result.message}`);
        } else {
          alert(`Failed to finalize payroll: ${result.message}`);
        }
      } catch (err) {
        console.error(err);
        alert("An error occurred while finalizing payroll.");
      } finally {
        finalizeBtn.innerHTML = originalText;
        finalizeBtn.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    });
  }

  // ===========================
  // EMPLOYEE SELECT CHANGE
  // ===========================
  employeeSelect.addEventListener("change", () => {
    if (currentPayrollData) {
      const selectedEmp = employeeSelect.value;
      let payrollList = currentPayrollData.payroll;
      if (selectedEmp !== "all") {
        payrollList = payrollList.filter(p => p.employee.id === selectedEmp);
      }
      renderAllEmployees(payrollList, monthFilter.value);
    }
  });

  // ===========================
  // MONTH CHANGE
  // ===========================
  monthFilter.addEventListener("input", loadPayroll);

  // ===========================
  // SEARCH
  // ===========================
  searchInput?.addEventListener("input", () => {
    if (!currentPayrollData) return;
    const term = searchInput.value.toLowerCase();
    const selectedEmp = employeeSelect.value;
    let payrollList = currentPayrollData.payroll;
    if (selectedEmp !== "all") {
      payrollList = payrollList.filter(p => p.employee.id === selectedEmp);
    }
    renderAllEmployees(payrollList, monthFilter.value, term);
  });

  // ===========================
  // EXPORT LOGIC
  // ===========================
  document.getElementById("exportBtn")?.addEventListener("click", () => {
    const payload = window._currentPayroll;
    if (!payload || !payload.ok || !payload.payroll.length) {
      alert("No payroll data to export.");
      return;
    }

    const dataToExport = payload.payroll.map(p => ({
      Employee: p.employee.full_name,
      Code: p.employee.employee_code,
      Department: p.employee.department || '-',
      Month: payload.period.month,
      Days_Worked: p.summary.totalDaysWithTimeout,
      Total_Hours: p.summary.totalHours,
      Gross_Pay: p.summary.grossPay,
      Bonus: p.summary.bonus,
      Deductions: p.summary.deductions,
      Net_Pay: p.summary.netPay,
      Status: "Computed"
    }));

    window.exportToCSV(`Payroll_All_${payload.period.month}.csv`, dataToExport);
  });

  // ===========================
  // SEND EMAIL
  // ===========================
  document.getElementById("sendEmailBtn")?.addEventListener("click", async () => {
    const ps = window._currentPayslipEmployee;
    if (!ps) {
      alert("No payslip data available.");
      return;
    }

    const emailArea = document.getElementById("emailStatusArea");
    const empEmail = ps.emp.email || allEmployees.find(e => e.id === ps.emp.id)?.email;

    if (!empEmail) {
      if (emailArea) emailArea.innerHTML = `<div class="email-status error">⚠️ No email registered for this employee.</div>`;
      return;
    }

    if (emailArea) emailArea.innerHTML = `<div class="email-status sending">⏳ Sending payslip to ${empEmail}...</div>`;

    try {
      const result = await window.api.payroll.sendPayslipEmail({
        employeeEmail: empEmail,
        employeeName: ps.emp.full_name,
        employeeCode: ps.emp.employee_code,
        period: ps.period.month,
        dailyRate: ps.emp.daily_rate,
        daysWorked: ps.sum.totalDaysWithTimeout,
        totalHours: ps.sum.totalHours,
        grossPay: ps.sum.grossPay,
        bonus: ps.sum.bonus,
        deductions: ps.sum.deductions,
        netPay: ps.sum.netPay
      });

      if (result?.ok) {
        if (emailArea) emailArea.innerHTML = `<div class="email-status success"> Payslip sent to ${empEmail} successfully!</div>`;
      } else {
        if (emailArea) emailArea.innerHTML = `<div class="email-status error"> ${result?.message || 'Failed to send email.'}</div>`;
      }
    } catch (err) {
      console.error("Email send error:", err);
      if (emailArea) emailArea.innerHTML = `<div class="email-status error"> Error: ${err.message || 'Unknown error'}</div>`;
    }
  });

  // ===========================
  // CLOSE MODAL
  // ===========================
  document.getElementById("closeModal").addEventListener("click", () => {
    const modal = document.getElementById("viewModal");
    modal.classList.add("hidden");
    modal.style.display = "none";
  });

  // ===========================
  // INITIAL LOAD
  // ===========================
  await loadEmployeeSelector();
  await loadPayroll();
});