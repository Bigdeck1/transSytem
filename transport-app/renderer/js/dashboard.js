window.initDashboard = async function () {
  const statsSection = document.getElementById("stats-section");
  const tripList = document.getElementById("trip-list");
  const ctx = document.getElementById('fleetChart')?.getContext('2d');

  let fleetChart = null;

  // Clean up previous realtime listener to prevent accumulation
  if (window._dashboardRealtimeUnsub) {
    window._dashboardRealtimeUnsub();
    window._dashboardRealtimeUnsub = null;
  }

  async function refreshData() {
    let stats = { employeeCount: 0, clientCount: 0, vehicleCount: 0, tripCount: 0 };
    let recentTrips = [];
    let vehicles = [];

    try {
      const results = await Promise.all([
        window.api.getDashboardStats().catch(() => ({ employeeCount: 0, clientCount: 0, vehicleCount: 0, tripCount: 0 })),
        window.api.getTrips().catch(() => []),
        window.api.getVehicles().catch(() => [])
      ]);

      stats = (results[0] && typeof results[0] === "object") ? results[0] : {};
      recentTrips = Array.isArray(results[1]) ? results[1] : (Array.isArray(results[1]?.data) ? results[1].data : []);
      vehicles = Array.isArray(results[2]) ? results[2] : (Array.isArray(results[2]?.data) ? results[2].data : []);
    } catch (err) {
      console.error("Dashboard Data Sync Error:", err);
    }

    renderStats(stats, vehicles, recentTrips);
    renderTrips(recentTrips);

    // Default range is 7 days
    const range = document.getElementById("fleetActivityRange")?.value || "7";
    renderChart(recentTrips, parseInt(range, 10));
  }

  function renderStats(stats, vehicles, recentTrips) {
    if (!Array.isArray(vehicles)) vehicles = [];
    if (!Array.isArray(recentTrips)) recentTrips = [];
    stats = stats || {};

    const available  = vehicles.filter(v => v && v.status === "available").length;
    const inTransit  = recentTrips.filter(t => t && (t.status === "active" || t.status === "in-transit" || t.status === "in transit")).length;
    const delivered  = recentTrips.filter(t => t && (t.status === "delivered" || t.status === "completed")).length;

    const cards = [
      {
        title: "Active Rentals",
        value: stats.activeRentalCount ?? 0,
        subtitle: "Vehicles currently rented out",
        icon: "car",
        badge: "blue"
      },
      {
        title: "Active Customers",
        value: stats.clientCount ?? 0,
        subtitle: "Hauling & rental clients",
        icon: "building-2",
        badge: "green"
      },
      {
        title: "Fleet Assets",
        value: vehicles.length,
        subtitle: `<span class="up">▲</span> ${available} available for hire`,
        icon: "truck",
        badge: "navy"
      },
      {
        title: "Hauling Dispatches",
        value: stats.tripCount ?? 0,
        subtitle: `${inTransit > 0 ? `<span class="up">${inTransit} in transit</span>` : `${delivered} delivered`}`,
        icon: "navigation",
        badge: "amber"
      }
    ];

    if (statsSection) {
      statsSection.innerHTML = cards.map((card, i) => `
        <div class="stat-card animate-slideUp stagger-${i + 1}">
          <div class="stat-icon-badge ${card.badge}">
            <i data-lucide="${card.icon}" style="width:24px;height:24px;"></i>
          </div>
          <div class="stat-body">
            <p class="stat-label">${card.title}</p>
            <p class="stat-value">${(card.value ?? 0).toLocaleString()}</p>
            <p class="stat-subtitle">${card.subtitle}</p>
          </div>
        </div>
      `).join("");
      // Re-create icons after injecting HTML
      if (window.lucide) lucide.createIcons();
    }
  }

  function renderTrips(trips) {
    if (!tripList) return;
    if (!trips || trips.length === 0) {
      tripList.innerHTML = `<p style="color:var(--text-light);font-size:14px;text-align:center;padding:24px 0;">No recent dispatches found.</p>`;
      return;
    }

    // Sort by pickup_time or created_at descending, take latest 6
    const sorted = [...trips].sort((a, b) => {
      const timeA = new Date(a.pickup_time || a.created_at || 0).getTime();
      const timeB = new Date(b.pickup_time || b.created_at || 0).getTime();
      return timeB - timeA;
    }).slice(0, 6);

    tripList.innerHTML = sorted.map(trip => {
      const dateStr = trip.pickup_time
        ? new Date(trip.pickup_time).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : 'N/A';
      const from = trip.pickup_location || 'Origin';
      const to   = trip.delivery_location || 'Destination';
      const statusClass = getPillClass(trip.status);
      return `
        <div class="trip" style="cursor:pointer;" onclick="window.location.href='scheduling_page.html'">
          <div class="trip-info">
            <strong>#${trip.trip_number || trip.id}</strong>
            <p class="route" style="font-size:12px;color:var(--text-muted);margin:3px 0 0;">${from} ➔ ${to}</p>
            <p class="date" style="font-size:11px;color:var(--text-light);margin:2px 0 0;">${dateStr}</p>
          </div>
          <span class="status-pill ${statusClass}">${trip.status || 'pending'}</span>
        </div>
      `;
    }).join("");
  }

  function renderChart(trips, days = 7) {
    if (!ctx) return;
    if (fleetChart) fleetChart.destroy();

    const chartTitle = document.querySelector(".card h2");
    if (chartTitle) chartTitle.textContent = `Fleet Activity (${days} Days)`;

    // Group trips by date (last N days)
    const daysArray = [...Array(days)].map((_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const data = daysArray.map(date => {
      return trips.filter(t => (t.pickup_time || "").startsWith(date)).length;
    });

    fleetChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: daysArray.map(d => {
          const dateObj = new Date(d + 'T00:00:00');
          return days <= 7
            ? dateObj.toLocaleDateString([], { weekday: 'short' })
            : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }),
        datasets: [
          {
            label: 'Dispatches',
            data: data,
            borderColor: '#1976D2',
            backgroundColor: 'rgba(25, 118, 210, 0.08)',
            fill: true,
            tension: 0.45,
            borderWidth: 2.5,
            pointRadius: days > 15 ? 2 : 5,
            pointBackgroundColor: '#1976D2',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          },
          {
            label: 'Delivered',
            data: daysArray.map(date =>
              trips.filter(t => (t.pickup_time||"").startsWith(date) && (t.status === "delivered" || t.status === "completed")).length
            ),
            borderColor: '#43A047',
            backgroundColor: 'rgba(67, 160, 71, 0.07)',
            fill: true,
            tension: 0.45,
            borderWidth: 2.5,
            pointRadius: days > 15 ? 2 : 5,
            pointBackgroundColor: '#43A047',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { usePointStyle: true, pointStyle: 'circle', font: { weight: '700', size: 11 }, color: '#64748B' }
          },
          tooltip: { backgroundColor: '#0D47A1', titleColor: '#fff', bodyColor: 'rgba(255,255,255,0.85)', cornerRadius: 10, padding: 12 }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false }, ticks: { color: '#94A3B8', font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 11 } } }
        }
      }
    });
  }

  function getPillClass(status) {
    switch (status?.toLowerCase()) {
      case 'active': case 'in-transit': case 'in transit': return 'in-transit';
      case 'delivered': case 'completed': return 'delivered';
      case 'scheduled': return 'scheduled';
      case 'cancelled': return 'cancelled';
      default: return 'pending';
    }
  }

  // NAVIGATION
  document.getElementById("viewAllTrips")?.addEventListener("click", () => {
    window.location.href = "scheduling_page.html";
  });

  document.getElementById("fleetActivityRange")?.addEventListener("change", async (e) => {
    const days = parseInt(e.target.value, 10);
    const trips = await window.api.getTrips().catch(() => []);
    renderChart(trips, days);
  });

  // REALTIME UPDATE — store unsubscribe to prevent listener accumulation
  if (window.api?.onRealtime) {
    window._dashboardRealtimeUnsub = window.api.onRealtime((evt, payload) => {
      console.log("Realtime Signal Received:", payload?.table);
      refreshData();
    });
  }

  // INITIAL LOAD
  await refreshData();
};
