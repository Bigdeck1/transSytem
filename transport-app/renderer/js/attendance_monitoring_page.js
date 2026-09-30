(() => {
  const loader = document.getElementById("loading-overlay");
  const statsSection = document.getElementById("stats-section");
  const tableBody =
    document.getElementById("attendanceTableBody") ||
    document.getElementById("attendance-table-body");
  const dateFilter = document.getElementById("dateFilter");

  let allAttendance = [];

  // Show loader ASAP
  loader?.classList.add("visible");

  function toISODateLocal(d = new Date()) {
    // Local YYYY-MM-DD (safer than toISOString for timezone)
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatTime(time) {
    if (!time) return "-";
    // time is like "08:30:00" (Postgres time)
    const dt = new Date(`1970-01-01T${time}`);
    return Number.isNaN(dt.getTime())
      ? time
      : dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(date) {
    if (!date) return "-";
    // date is like "2026-03-02" (Postgres date) or ISO string
    const dt = new Date(date);
    return Number.isNaN(dt.getTime()) ? date : dt.toLocaleDateString();
  }

  /**
   * Calculate decimal hours between two time strings.
   * E.g. "08:00:00" to "17:30:00" → 9.50
   * Returns 0 if either is missing/invalid.
   */
  function calcDecimalHours(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const inMs = Date.parse(`1970-01-01T${checkIn}`);
    const outMs = Date.parse(`1970-01-01T${checkOut}`);
    if (Number.isNaN(inMs) || Number.isNaN(outMs)) return 0;
    const diffHrs = (outMs - inMs) / (1000 * 60 * 60);
    return diffHrs > 0 ? diffHrs : 0;
  }

  /**
   * Format decimal hours for display.
   * E.g. 7.5 → "7.50 hrs"
   */
  function formatDecimalHours(hrs) {
    if (!hrs || hrs <= 0) return "-";
    return `${hrs.toFixed(2)}`;
  }

  function getEmployeeName(row) {
    // Supports multiple shapes depending on your backend query
    return (
      row?.employee?.full_name ||
      row?.employee?.name ||
      row?.full_name ||
      row?.employee_full_name ||
      row?.employee_name ||
      "Unknown"
    );
  }

  function getStatusBadge(row) {
    // Schema: attendance.check_in, attendance.check_out
    const present = !!row?.check_in;
    return present
      ? `<span class="badge badge-info">Present</span>`
      : `<span class="badge badge-neutral">Absent</span>`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function initAttendance() {
    if (!tableBody || !statsSection) return;

    try {
      allAttendance = await window.api.getAllAttendance();
      renderAttendance();
    } catch (err) {
      console.error("Failed to load attendance:", err);
      tableBody.innerHTML =
        `<tr><td colspan="6" style="text-align:center; color: var(--error); padding: 40px;">
          <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
          Error loading attendance data
        </td></tr>`;
      if (statsSection) statsSection.innerHTML = "";
    }
  }

  function renderAttendance() {
    const selectedDate = dateFilter?.value; // "YYYY-MM-DD"
    
    if (!selectedDate) {
      tableBody.innerHTML =
        `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted);">
          <div style="font-size: 48px; margin-bottom: 12px;">📅</div>
          Please select a date to view attendance records.
        </td></tr>`;
      if (statsSection) statsSection.innerHTML = "";
      return;
    }

    const filteredAttendance = allAttendance.filter(a => {
        return String(a.date).slice(0, 10) === selectedDate;
    });

    window._currentAttendance = filteredAttendance;

    if (!Array.isArray(filteredAttendance) || filteredAttendance.length === 0) {
      tableBody.innerHTML =
        `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted);">
          <div style="font-size: 48px; margin-bottom: 12px;">📋</div>
          No attendance records found for ${selectedDate}
        </td></tr>`;
      if (statsSection) statsSection.innerHTML = "";
      return;
    }

    // Compute hours for each record
    const enrichedAttendance = filteredAttendance.map(a => {
      const hours = calcDecimalHours(a.check_in, a.check_out);
      return { ...a, _decimalHours: hours };
    });

    // Stats based on schema
    const totalRecords = enrichedAttendance.length;
    const presentToday = enrichedAttendance.filter(a => a.check_in).length;
    const totalHours = enrichedAttendance.reduce((sum, a) => sum + a._decimalHours, 0);
    const avgHours = totalRecords > 0 ? (totalHours / totalRecords) : 0;

    statsSection.innerHTML = `
      <div class="stat-card stagger-1" style="flex: 1;">
        <div class="stat-label" style="color: var(--primary);">Total Records</div>
        <div class="stat-value">${totalRecords}</div>
        <div class="stat-subtitle">Entries on ${selectedDate}</div>
      </div>
      <div class="stat-card stagger-2" style="flex: 1;">
        <div class="stat-label" style="color: var(--success);">Present</div>
        <div class="stat-value" style="color: var(--success);">${presentToday}</div>
        <div class="stat-subtitle">Checked in on ${selectedDate}</div>
      </div>
      <div class="stat-card stagger-3" style="flex: 1;">
        <div class="stat-label" style="color: var(--accent);">Total Hours</div>
        <div class="stat-value" style="color: var(--accent);">${totalHours.toFixed(2)}</div>
        <div class="stat-subtitle">Cumulative work hours</div>
      </div>
      <div class="stat-card stagger-4" style="flex: 1;">
        <div class="stat-label" style="color: var(--warning);">Avg Hours/Day</div>
        <div class="stat-value" style="color: var(--warning);">${avgHours.toFixed(2)}</div>
        <div class="stat-subtitle">Per attendance record</div>
      </div>
    `;

    // Table rows with computed hours
    tableBody.innerHTML = enrichedAttendance
      .map((a, i) => {
        const fullName = escapeHtml(getEmployeeName(a));
        const decHrs = formatDecimalHours(a._decimalHours);
        return `
          <tr class="animate-fadeIn" style="animation-delay: ${Math.min(i * 0.03, 0.5)}s;">
            <td><strong>${fullName}</strong></td>
            <td>${escapeHtml(formatDate(a.date))}</td>
            <td>${getStatusBadge(a)}</td>
            <td>${escapeHtml(formatTime(a.check_in))}</td>
            <td>${escapeHtml(formatTime(a.check_out))}</td>
            <td style="text-align: right; font-weight: 700; font-variant-numeric: tabular-nums;">${decHrs}</td>
          </tr>
        `;
      })
      .join("");
  }

  dateFilter?.addEventListener("change", renderAttendance);

  // EXPORT LOGIC
  document.getElementById("exportBtn")?.addEventListener("click", () => {
    if (!window._currentAttendance || !window._currentAttendance.length) {
      alert("No attendance data to export.");
      return;
    }

    const dataToExport = window._currentAttendance.map(a => ({
      Employee: getEmployeeName(a),
      Date: a.date,
      Status: a.check_in ? "Present" : "Absent",
      CheckIn: a.check_in || "-",
      CheckOut: a.check_out || "-",
      TotalHours: calcDecimalHours(a.check_in, a.check_out).toFixed(2)
    }));

    window.exportToCSV(`Attendance_Log_${new Date().toISOString().split('T')[0]}.csv`, dataToExport);
  });

  // Expose init function
  window.initAttendance = initAttendance;

  document.addEventListener("DOMContentLoaded", async () => {
    // Restrict date filter to today or earlier
    if (dateFilter) {
      dateFilter.max = toISODateLocal();
    }
    await initAttendance();
    loader?.classList.remove("visible");
  });
})();