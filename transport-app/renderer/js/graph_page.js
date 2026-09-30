// graph_page.js — Analytics with Chart.js, billing data, and employee working hours
document.addEventListener("DOMContentLoaded", async () => {

  // ---- CHART.JS DEFAULT CONFIGURATION ----
  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Outfit', 'Inter', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#64748b';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;
    Chart.defaults.plugins.legend.labels.padding = 16;
  }

  const money = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  // Distinct colors for multi-line chart (up to 12 employees)
  const lineColors = [
    '#1976D2', '#EF4444', '#43A047', '#F59E0B', '#7C3AED',
    '#06b6d4', '#f43f5e', '#14b8a6', '#0D47A1', '#ec4899',
    '#84cc16', '#a855f7'
  ];

  try {
    // ---- FETCH ALL DATA IN PARALLEL ----
    const [employees, invoices, attendance] = await Promise.all([
      window.api.getEmployees().catch(() => []),
      window.api.billing.getAll().catch(() => []),
      window.api.getAllAttendance().catch(() => [])
    ]);

    const empList = Array.isArray(employees) ? employees : [];
    const invList = Array.isArray(invoices) ? invoices : (invoices?.data || []);
    const attList = Array.isArray(attendance) ? attendance : [];

    // ================================================================
    // KPI CALCULATIONS
    // ================================================================
    const totalRevenue = invList.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const totalPayrollCost = empList.reduce((sum, emp) => sum + (Number(emp.daily_rate || 0) * 22), 0);
    const profit = totalRevenue - totalPayrollCost;
    const profitPct = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : 0;

    // Update KPI cards
    const setKPI = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setKPI('kpiRevenue', money(totalRevenue));
    setKPI('kpiPayroll', money(totalPayrollCost));
    setKPI('kpiProfit', money(profit));
    setKPI('kpiProfitPct', `${profitPct}% margin`);
    setKPI('kpiEmployees', empList.length);

    // ================================================================
    // 1. REVENUE TREND LINE CHART (billing by month, last 6 months)
    // ================================================================
    const revenueCtx = document.getElementById('revenueChart');
    if (revenueCtx && typeof Chart !== 'undefined') {
      const now = new Date();
      const months = [];
      const monthLabels = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.push(key);
        monthLabels.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
      }

      // Aggregate billing by month
      const revenueByMonth = {};
      months.forEach(m => revenueByMonth[m] = 0);
      invList.forEach(inv => {
        const d = inv.issue_date || inv.created_at || '';
        const monthKey = String(d).slice(0, 7);
        if (revenueByMonth[monthKey] !== undefined) {
          revenueByMonth[monthKey] += Number(inv.amount || 0);
        }
      });

      const revenueData = months.map(m => revenueByMonth[m]);

      new Chart(revenueCtx, {
        type: 'line',
        data: {
          labels: monthLabels,
          datasets: [{
            label: 'Revenue',
            data: revenueData,
            borderColor: '#43A047',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: '#43A047',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a',
              titleColor: '#f8fafc',
              bodyColor: '#e2e8f0',
              borderColor: '#334155',
              borderWidth: 1,
              cornerRadius: 8,
              padding: 12,
              callbacks: {
                label: (ctx) => ` Revenue: ${money(ctx.raw)}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(148, 163, 184, 0.1)' },
              ticks: { callback: (val) => money(val) }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
    }

    // ================================================================
    // 2. EXPENSE DISTRIBUTION DOUGHNUT CHART
    // ================================================================
    const expenseCtx = document.getElementById('expenseChart');
    if (expenseCtx && typeof Chart !== 'undefined') {
      const salaries = Math.round(totalPayrollCost * 0.68);
      const benefits = Math.round(totalPayrollCost * 0.14);
      const taxes = Math.round(totalPayrollCost * 0.10);
      const other = Math.round(totalPayrollCost * 0.08);

      new Chart(expenseCtx, {
        type: 'doughnut',
        data: {
          labels: ['Salaries', 'Benefits', 'Taxes', 'Other'],
          datasets: [{
            data: [salaries, benefits, taxes, other],
            backgroundColor: [
              'rgba(25, 118, 210, 0.8)',
              'rgba(99, 102, 241, 0.8)',
              'rgba(245, 158, 11, 0.8)',
              'rgba(148, 163, 184, 0.6)'
            ],
            borderColor: '#ffffff',
            borderWidth: 3,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { padding: 16, font: { size: 11, weight: '600' } }
            },
            tooltip: {
              backgroundColor: '#0f172a',
              titleColor: '#f8fafc',
              bodyColor: '#e2e8f0',
              cornerRadius: 8,
              padding: 12,
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${money(ctx.raw)}`
              }
            }
          }
        }
      });
    }

    // ================================================================
    // 3. EMPLOYEE WORKING HOURS LINE GRAPH
    // ================================================================
    const empHoursCtx = document.getElementById('employeeHoursChart');
    if (empHoursCtx && typeof Chart !== 'undefined') {
      // Build per-employee aggregated hours by date (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Create date labels for x-axis (last 30 days, grouped by week or individual days)
      const dateLabels = [];
      const dateKeys = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dateKeys.push(key);
        dateLabels.push(d.toLocaleDateString('default', { month: 'short', day: 'numeric' }));
      }

      // Filter attendance to last 30 days and compute hours per employee per day
      const empHoursMap = {}; // { empId: { date: hours } }
      const empNameMap = {}; // { empId: name }
      
      attList.forEach(a => {
        const dateStr = String(a.date).slice(0, 10);
        if (!dateKeys.includes(dateStr)) return;
        
        const empId = a.employee_id;
        if (!empId) return;
        
        if (!empHoursMap[empId]) empHoursMap[empId] = {};
        
        // Calculate hours
        let hours = 0;
        if (a.check_in && a.check_out) {
          const inMs = Date.parse(`1970-01-01T${a.check_in}`);
          const outMs = Date.parse(`1970-01-01T${a.check_out}`);
          if (!isNaN(inMs) && !isNaN(outMs)) {
            hours = Math.max(0, (outMs - inMs) / (1000 * 60 * 60));
          }
        }
        
        empHoursMap[empId][dateStr] = (empHoursMap[empId][dateStr] || 0) + hours;

        // Map employee names
        if (!empNameMap[empId]) {
          const emp = empList.find(e => e.id === empId);
          empNameMap[empId] = emp ? emp.full_name : (a.employee?.full_name || a.full_name || 'Unknown');
        }
      });

      // Create datasets (limit to top 8 employees by total hours)
      const empTotals = Object.keys(empHoursMap).map(empId => {
        const total = Object.values(empHoursMap[empId]).reduce((s, h) => s + h, 0);
        return { empId, total };
      }).sort((a, b) => b.total - a.total).slice(0, 8);

      const datasets = empTotals.map((item, idx) => {
        const color = lineColors[idx % lineColors.length];
        return {
          label: empNameMap[item.empId] || `Employee ${idx + 1}`,
          data: dateKeys.map(dk => Number((empHoursMap[item.empId][dk] || 0).toFixed(2))),
          borderColor: color,
          backgroundColor: color + '15',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 6,
          pointBackgroundColor: color,
          fill: false,
        };
      });

      // Use every 3rd label to avoid clutter
      const sparseLabels = dateLabels.map((l, i) => i % 3 === 0 ? l : '');

      new Chart(empHoursCtx, {
        type: 'line',
        data: {
          labels: sparseLabels,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: { font: { size: 10, weight: '600' }, boxWidth: 12 }
            },
            tooltip: {
              backgroundColor: '#0f172a',
              titleColor: '#f8fafc',
              bodyColor: '#e2e8f0',
              cornerRadius: 8,
              padding: 12,
              callbacks: {
                title: (items) => dateLabels[items[0].dataIndex] || '',
                label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(2)} hrs`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Hours', font: { size: 11, weight: '700' } },
              grid: { color: 'rgba(148, 163, 184, 0.1)' }
            },
            x: {
              grid: { display: false },
              ticks: { maxRotation: 45, font: { size: 10 } }
            }
          }
        }
      });
    }

    // ================================================================
    // 4. INVOICE STATUS DOUGHNUT
    // ================================================================
    const invStatusCtx = document.getElementById('invoiceStatusChart');
    if (invStatusCtx && typeof Chart !== 'undefined') {
      const statusCounts = {};
      invList.forEach(inv => {
        const st = inv.status || 'Unknown';
        statusCounts[st] = (statusCounts[st] || 0) + 1;
      });

      const statusLabels = Object.keys(statusCounts);
      const statusData = Object.values(statusCounts);
      const statusColors = statusLabels.map(s => {
        const lower = s.toLowerCase();
        if (lower === 'paid') return 'rgba(16, 185, 129, 0.8)';
        if (lower === 'pending') return 'rgba(245, 158, 11, 0.8)';
        if (lower === 'overdue' || lower === 'unpaid') return 'rgba(239, 68, 68, 0.8)';
        return 'rgba(148, 163, 184, 0.6)';
      });

      new Chart(invStatusCtx, {
        type: 'doughnut',
        data: {
          labels: statusLabels,
          datasets: [{
            data: statusData,
            backgroundColor: statusColors,
            borderColor: '#ffffff',
            borderWidth: 3,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { padding: 16, font: { size: 11, weight: '600' } }
            },
            tooltip: {
              backgroundColor: '#0f172a',
              titleColor: '#f8fafc',
              bodyColor: '#e2e8f0',
              cornerRadius: 8,
              padding: 12,
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${ctx.raw} invoices`
              }
            }
          }
        }
      });
    }

    // ================================================================
    // 5. DEPARTMENT COST ANALYSIS CARDS
    // ================================================================
    const departmentGrid = document.getElementById('departmentGrid');
    if (departmentGrid) {
      const deptMap = {};
      empList.forEach(emp => {
        const dept = emp.department || "Other";
        if (!deptMap[dept]) deptMap[dept] = { name: dept, employees: 0, cost: 0 };
        deptMap[dept].employees++;
        deptMap[dept].cost += Number(emp.daily_rate || 0) * 22;
      });
      const departmentData = Object.values(deptMap);

      departmentGrid.innerHTML = "";
      if (departmentData.length === 0) {
        departmentGrid.innerHTML = '<p style="color:var(--text-muted);text-align:center;grid-column:1/-1;padding:40px;">No department data available.</p>';
      } else {
        departmentData.forEach((dept, i) => {
          const avgPerEmp = dept.employees > 0 ? Math.round(dept.cost / dept.employees) : 0;
          const pctOfTotal = totalPayrollCost > 0 ? ((dept.cost / totalPayrollCost) * 100).toFixed(1) : 0;
          const div = document.createElement('div');
          div.className = 'dept-card animate-slideUp';
          div.style.animationDelay = `${i * 0.08}s`;
          div.innerHTML = `
            <h3>${dept.name}</h3>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 12px; color: var(--text-muted);">Employees</span>
              <span style="font-weight: 800;">${dept.employees}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 12px; color: var(--text-muted);">Monthly Cost</span>
              <span style="font-weight: 800; color: var(--primary);">${money(dept.cost)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="font-size: 12px; color: var(--text-muted);">Avg/Employee</span>
              <span style="font-weight: 700; font-size: 13px;">${money(avgPerEmp)}</span>
            </div>
            <div style="background: var(--border-subtle); border-radius: 99px; height: 6px; overflow: hidden;">
              <div style="background: var(--gradient-primary); height: 100%; width: ${pctOfTotal}%; border-radius: 99px; transition: width 0.8s ease;"></div>
            </div>
            <div style="font-size: 11px; color: var(--text-light); margin-top: 6px; text-align: right;">${pctOfTotal}% of total</div>
          `;
          departmentGrid.appendChild(div);
        });
      }
    }

  } catch (err) {
    console.error("Failed to load analytics data:", err);
    const kpiGrid = document.getElementById('kpiGrid');
    if (kpiGrid) {
      kpiGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:40px;color:var(--error);">Failed to load analytics data.</p>';
    }
  }
});
