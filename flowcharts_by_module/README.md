# JRR Transport System — Modular Flowcharts Directory

This directory contains standalone, dedicated Mermaid flowchart files for each individual module of the system, complete with ANSI standard flowchart symbols:
- **Terminators**: `([Start / End])`
- **Operations / Tasks**: `[Action]`
- **Subroutines / Predefined Processes**: `[[Sub-Process / Function]]`
- **Decision Diamonds**: `{Condition?}`
- **Input / Output**: `[/Data Input or Display/]`
- **Databases**: `[(Table / Store)]`
- **On-Page Connectors**: `((Letter))`
- **Off-Page Connectors**: `>["OFF-PAGE: To Module XX"]`
- **Hyperlinks**: Clickable links connecting cross-module handoffs.

---

### Module Index

| File Name | Module Name | Off-Page Connections |
| :--- | :--- | :--- |
| [`00_master_lifecycle.mmd`](./00_master_lifecycle.mmd) | Master End-to-End Operational Lifecycle | Connects all 20 modules |
| [`01_auth_and_session.mmd`](./01_auth_and_session.mmd) | Authentication & Session Management | Links to 02, 04, 13, 15 |
| [`02_employee_management.mmd`](./02_employee_management.mmd) | Employee Onboarding & Identity Provisioning | Links to 01, 04, 11, 12 |
| [`03_vehicle_fleet_and_inspection.mmd`](./03_vehicle_fleet_and_inspection.mmd) | Vehicles, Pre-Trip Inspection & Quarantine | Links to 00, 04 |
| [`04_trip_scheduling.mmd`](./04_trip_scheduling.mmd) | Trip Booking, Route Calculation & Conflict Lock | Links to 02, 03, 05, 10, 16 |
| [`05_live_tracking_and_webhooks.mmd`](./05_live_tracking_and_webhooks.mmd) | Live GPS Pings & Customer Milestone Webhooks | Links to 04, 06, 14 |
| [`06_electronic_pod.mmd`](./06_electronic_pod.mmd) | Electronic Proof of Delivery (e-POD Sign-off) | Links to 05, 09 |
| [`07_incidents_and_sos.mmd`](./07_incidents_and_sos.mmd) | En-Route Incidents & SOS Panic Alarms | Links to 05, 16, 17 |
| [`08_trip_expenses.mmd`](./08_trip_expenses.mmd) | En-Route Fuel, Tolls & Road Expenses | Links to 05, 09, 18 |
| [`09_billing_and_invoicing.mmd`](./09_billing_and_invoicing.mmd) | Invoicing, Billing & Accounts Receivable | Links to 06, 10, 13, 18 |
| [`10_client_management.mmd`](./10_client_management.mmd) | Client Accounts & Cascade Safety Deletions | Links to 04, 09 |
| [`11_attendance_and_leave.mmd`](./11_attendance_and_leave.mmd) | Daily Attendance & Time-Off Lifecycle | Links to 02, 12, 16 |
| [`12_payroll_and_tax.mmd`](./12_payroll_and_tax.mmd) | Payroll Engine & TRAIN Law Tax Calculations | Links to 11, 19 |
| [`13_executive_dashboard.mmd`](./13_executive_dashboard.mmd) | Executive Command Dashboard & Fleet Telemetry | Links to 04, 05, 09 |
| [`14_public_tracking.mmd`](./14_public_tracking.mmd) | Public Consignee Self-Service Tracking Portal | Links to 05, 06 |
| [`15_user_signup_and_otp.mmd`](./15_user_signup_and_otp.mmd) | Self-Registration, Email OTP & Admin Approval | Links to 01, 17 |
| [`16_notification_center.mmd`](./16_notification_center.mmd) | Push Device Tokens, Broadcasts & Alarm Sirens | Links to 04, 07, 11 |
| [`17_admin_audit_and_health.mmd`](./17_admin_audit_and_health.mmd) | Super Admin Operations, User Roles & Health | Links to 01, 15, 20 |
| [`18_digital_reporting.mmd`](./18_digital_reporting.mmd) | Digital Reports & PDF / Excel CSV Export | Links to 04, 08, 09 |
| [`19_tax_simulator.mmd`](./19_tax_simulator.mmd) | Interactive BIR Tax Projection Simulator | Links to 12 |
| [`20_network_tunnel_proxy.mmd`](./20_network_tunnel_proxy.mmd) | Cloudflare Quick Tunnel & Mobile Proxy Access | Links to 05, 14, 17 |
