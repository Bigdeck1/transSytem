document.addEventListener("DOMContentLoaded", () => {
    const dataButtons = document.querySelectorAll('.selection-btn');
    const formatButtons = document.querySelectorAll('.format-btn');
    let selectedType = 'shipments';
    let selectedFormat = 'excel';

    // Fetch Data for Preview
    async function loadPreview() {
        const countEl = document.getElementById('previewCount');
        const fieldsEl = document.getElementById('previewFields');
        
        if (countEl) countEl.textContent = 'Loading...';
        if (fieldsEl) fieldsEl.innerHTML = '';
        
        try {
            let data = [];
            switch(selectedType) {
                case 'shipments':
                case 'deliveries':
                    data = await window.api.getTrips();
                    break;
                case 'vehicles':
                    data = await window.api.getVehicles();
                    break;
                case 'routes':
                    const trips = await window.api.getTrips();
                    data = (trips || []).map(t => ({ trip: t.trip_number, route: `${t.pickup_location} ➔ ${t.delivery_location}` }));
                    break;
                case 'employees':
                    data = await window.api.getEmployees();
                    break;
                case 'attendance':
                    data = await window.api.getAllAttendance();
                    break;
                case 'invoices':
                    const invRes = await window.api.billing.getAll();
                    data = invRes.ok ? invRes.data : [];
                    break;
                case 'clients':
                    data = await window.api.getClients();
                    break;
                case 'payroll':
                    const month = document.getElementById('dateFrom')?.value?.slice(0, 7) || new Date().toISOString().slice(0, 7);
                    const payRes = await window.api.payroll.getMonthlyAll(month);
                    data = payRes.ok ? payRes.payroll.map(p => ({
                        Employee: p.employee.full_name,
                        Code: p.employee.employee_code,
                        Month: payRes.period.month,
                        DaysWorked: p.summary.totalDaysWithTimeout,
                        TotalHours: p.summary.totalHours,
                        GrossPay: p.summary.grossPay,
                        Bonus: p.summary.bonus,
                        Deductions: p.summary.deductions,
                        NetPay: p.summary.netPay
                    })) : [];
                    break;
            }
            
            // Filter by date range if applicable
            const fromDate = document.getElementById('dateFrom')?.value;
            const toDate = document.getElementById('dateTo')?.value;
            
            if (fromDate && toDate && data && data.length > 0) {
                const from = new Date(fromDate);
                const to = new Date(toDate);
                to.setHours(23, 59, 59, 999); // Include entire end day
                
                data = data.filter(item => {
                    // Try to find a date field
                    const dateStr = item.created_at || item.issue_date || item.date || item.pickup_time;
                    if (!dateStr) return true; // If no date field, include it
                    
                    const itemDate = new Date(dateStr);
                    if (isNaN(itemDate.getTime())) return true;
                    
                    return itemDate >= from && itemDate <= to;
                });
            }
            
            if (countEl) {
                countEl.textContent = data && data.length ? data.length : 0;
            }
            
            if (fieldsEl) {
                if (data && data.length > 0) {
                    const sample = data[0];
                    const keys = Object.keys(sample);
                    fieldsEl.innerHTML = keys.map(k => `<span style="background: var(--bg-main); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border);">${k}</span>`).join('');
                } else {
                    fieldsEl.innerHTML = '<span style="color: var(--text-muted);">No records found matching criteria</span>';
                }
            }
            
            // Store globally so the download button doesn't have to re-fetch
            window._currentReportData = data;
            
        } catch (err) {
            console.error("Preview load failed:", err);
            if (countEl) countEl.textContent = 'Error loading data';
            if (fieldsEl) fieldsEl.innerHTML = '';
        }
    }

    // Handle Data Type Selection
    dataButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            dataButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedType = btn.dataset.type;
            const summaryType = document.getElementById('summaryType');
            if (summaryType) summaryType.textContent = btn.textContent.trim();
            loadPreview();
        });
    });

    // Handle Format Selection
    formatButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            formatButtons.forEach(b => {
                b.style.borderColor = 'var(--border)';
                b.style.background = 'var(--card-bg)';
            });
            btn.style.borderColor = 'var(--primary)';
            btn.style.background = 'rgba(59, 130, 246, 0.05)';
            selectedFormat = btn.dataset.format;
        });
    });

    // Sync Date Filters
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    
    // Restrict report dates to today or earlier
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateFrom) dateFrom.max = todayStr;
    if (dateTo) dateTo.max = todayStr;

    if (dateFrom) dateFrom.addEventListener('change', () => { 
        if (dateFrom.value && dateTo && dateTo.value && dateFrom.value > dateTo.value) {
            dateTo.value = dateFrom.value;
        }
        updateSummary(); 
        loadPreview(); 
    });
    if (dateTo) dateTo.addEventListener('change', () => { 
        if (dateTo.value && dateFrom && dateFrom.value && dateTo.value < dateFrom.value) {
            dateFrom.value = dateTo.value;
        }
        updateSummary(); 
        loadPreview(); 
    });

    function updateSummary() {
        const from = dateFrom?.value;
        const to = dateTo?.value;
        const summaryRange = document.getElementById('summaryRange');
        if (summaryRange) summaryRange.textContent = from && to ? `${from} to ${to}` : 'All Time';
    }

    // Initial load for default selection
    loadPreview();

    // MAIN EXPORT LOGIC
    const genBtn = document.getElementById('generateReportBtn');
    if (genBtn) {
        genBtn.addEventListener('click', async () => {
            const originalText = genBtn.innerHTML;
            
            try {
                genBtn.disabled = true;
                genBtn.innerHTML = '<i class="spinner"></i> Compiling...';

                // Use the data already fetched by the preview
                let data = window._currentReportData;

                if (!data) {
                    // Fallback if preview didn't load
                    switch(selectedType) {
                        case 'shipments':
                        case 'deliveries':
                            data = await window.api.getTrips();
                            break;
                        case 'vehicles':
                            data = await window.api.getVehicles();
                            break;
                        case 'routes':
                            const tripsFall = await window.api.getTrips();
                            data = (tripsFall || []).map(t => ({ trip: t.trip_number, route: `${t.pickup_location} ➔ ${t.delivery_location}` }));
                            break;
                        case 'employees':
                            data = await window.api.getEmployees();
                            break;
                        case 'attendance':
                            data = await window.api.getAllAttendance();
                            break;
                        case 'invoices':
                            const invResFall = await window.api.billing.getAll();
                            data = invResFall.ok ? invResFall.data : [];
                            break;
                        case 'clients':
                            data = await window.api.getClients();
                            break;
                        case 'payroll':
                            const monthFall = document.getElementById('dateFrom')?.value?.slice(0, 7) || new Date().toISOString().slice(0, 7);
                            const payResFall = await window.api.payroll.getMonthlyAll(monthFall);
                            data = payResFall.ok ? payResFall.payroll.map(p => ({
                                Employee: p.employee.full_name,
                                Code: p.employee.employee_code,
                                Month: payResFall.period.month,
                                DaysWorked: p.summary.totalDaysWithTimeout,
                                TotalHours: p.summary.totalHours,
                                GrossPay: p.summary.grossPay,
                                Bonus: p.summary.bonus,
                                Deductions: p.summary.deductions,
                                NetPay: p.summary.netPay
                            })) : [];
                            break;
                    }
                }

                if (!data || data.length === 0) {
                    alert("No records found for the selected criteria.");
                    return;
                }

                // Export using shared utility
                const filename = `JRR_Report_${selectedType}_${new Date().toISOString().split('T')[0]}.csv`;
                window.exportToCSV(filename, data);

            } catch (err) {
                console.error("Export Error:", err);
                alert("System failed to generate file: " + err.message);
            } finally {
                genBtn.disabled = false;
                genBtn.innerHTML = originalText;
            }
        });
    }
});
