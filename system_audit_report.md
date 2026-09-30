#  JRR Transport System — Full Audit Report

> Comprehensive analysis of loopholes, security vulnerabilities, logic flaws, input validation gaps, and recommended improvements.

---

##  CRITICAL — Security Vulnerabilities

### 1. Plaintext Password Storage in `users` Table
**File:** [auth.ts](file:///c:/transSytem/transport-app/ipc/auth.ts#L33-L42)

The login handler falls back to a `users` table that stores passwords as **plaintext**. The registration flow also inserts the raw password into this table.

```diff
 // Line 41 — direct plaintext comparison
-  .eq("password", password)
 // Line 71 — plaintext insertion
-  insert([{ ... password, ... }])
```

**Risk:** If the database is compromised, every user credential is exposed instantly.

---

### 2. Supabase Service Role Key Exposed in `.env`
**File:** [.env](file:///c:/transSytem/transport-app/.env)

The `SUPABASE_SERVICE_ROLE_KEY` grants **full admin access** to the database, bypassing all Row Level Security. This key is bundled inside the Electron app and can be extracted from the packaged binary.

**Risk:** Any user could extract this key and have full read/write/delete access to the entire database.

---

### 3. SMTP Credentials in Plain `.env`
**File:** [.env](file:///c:/transSytem/transport-app/.env#L8-L9)

The Gmail App Password is stored in plaintext. Combined with issue #2, this means an attacker could send emails as the company.

---

### 4. Recovery Code in Email Subject Line
**File:** [auth.ts](file:///c:/transSytem/transport-app/ipc/auth.ts#L145)

```javascript
subject: `Your Password Reset Code: ${code}`,
```

The 6-digit recovery code is visible in the **email subject**, which shows in notification previews without opening the email.

---

### 5. No Rate Limiting on Login or Recovery
**Files:** [auth.ts](file:///c:/transSytem/transport-app/ipc/auth.ts#L5), [auth.ts](file:///c:/transSytem/transport-app/ipc/auth.ts#L85)

There are no limits on login attempts or recovery code requests. An attacker could:
- Brute force passwords
- Flood the SMTP server with recovery emails
- Brute force the 6-digit recovery code (only 1 million combinations)

---

### 6. No Recovery Code Attempt Limiting
**File:** [auth.ts](file:///c:/transSytem/transport-app/ipc/auth.ts#L156-L173)

The `verifyRecoveryCode` handler allows unlimited attempts to guess the 6-digit code without locking out or invalidating.

---

##  HIGH — Logic Loopholes

### 7. Auth Guard is Client-Side Only
**File:** [auth_guard.js](file:///c:/transSytem/transport-app/renderer/js/auth_guard.js)

The auth check is purely `localStorage`-based. There is **no server-side session validation**. A user can:
- Manually set `localStorage.user` to any JSON object and gain access
- Once logged in, the session **never expires**

---

### 8. No Role-Based Access Control (RBAC)
**Files:** All IPC handlers

Every logged-in user has access to **every operation**: delete employees, finalize payroll, approve time-off, delete clients. There is no distinction between Admin and Employee roles.

---

### 9. Trip Status Conflicts — Double-Booking
**File:** [trips.ts](file:///c:/transSytem/transport-app/ipc/trips.ts#L11-L39)

When adding a trip, the handler sets the driver and vehicle to "in-use" but **never checks** if they are already assigned to another active trip. This allows:
- Same driver assigned to 2+ overlapping trips
- Same vehicle dispatched on 2+ trips simultaneously

---

### 10. Vehicle Status Reset on Any Trip Completion
**File:** [trips.ts](file:///c:/transSytem/transport-app/ipc/trips.ts#L56-L63)

When a trip is "completed," both the driver and vehicle are set to "available." But if the driver/vehicle has **another active trip**, this incorrectly overrides their status.

---

### 11. Delete Operations Have No Cascade Protection
**Files:** [vehicles.ts](file:///c:/transSytem/transport-app/ipc/vehicles.ts#L18-L20), [index.ts](file:///c:/transSytem/transport-app/ipc/index.ts#L42-L44)

Deleting a vehicle or client does **not** check for active references:
- A vehicle with active trips can be deleted, orphaning trip records
- A client with invoices can be deleted, breaking billing data

---

### 12. Payroll Finalize Overwrites Without Confirmation
**File:** [payroll.ts](file:///c:/transSytem/transport-app/ipc/payroll.ts#L248-L253)

The finalize handler deletes all existing paychecks for a period and re-inserts. If called twice accidentally, the first batch of paychecks is permanently lost with no audit trail.

---

### 13. Registration Stores Password in Users Table AND Creates Supabase Auth
**File:** [auth.ts](file:///c:/transSytem/transport-app/ipc/auth.ts#L58-L79)

The `supabase-register` handler creates a Supabase Auth user **and** inserts the plaintext password into the `users` table. This creates a dual-auth system where passwords can get out of sync.

---

##  MEDIUM — Data Integrity Issues

### 14. Invoice Number Not Auto-Validated for Uniqueness
**File:** [index.ts](file:///c:/transSytem/transport-app/ipc/index.ts#L92-L93)

Invoice creation does not validate if the invoice number already exists, potentially creating duplicate invoice numbers.

---

### 15. Employee ID Generation Race Condition
**File:** [employees.ts](file:///c:/transSytem/transport-app/ipc/employees.ts#L180-L205)

The `get-next-employee-id` handler reads all employee IDs and computes the next one. If two admins register employees simultaneously, they could receive the **same** employee ID.

---

### 16. Attendance Has No Duplicate Day Check
**File:** [requests.ts](file:///c:/transSytem/transport-app/ipc/requests.ts#L54-L60)

The `add-attendance` handler does not check if an attendance record already exists for an employee on the same date, allowing duplicate entries that corrupt payroll calculations.

---

### 17. Time-Off Request Status Conflict with `recalculate-statuses`
**File:** [requests.ts](file:///c:/transSytem/transport-app/ipc/requests.ts#L6-L43)

The `recalculate-statuses` handler bulk-updates time-off requests by date, overwriting "Approved"/"Denied" statuses with "Completed," "Ongoing," or "Pending." An admin's manual approval gets overwritten.

---

### 18. Payroll Hours Calculation Ignores Overnight Shifts
**File:** [payroll.ts](file:///c:/transSytem/transport-app/ipc/payroll.ts#L286-L293)

```javascript
const diff = (outMs - inMs) / (1000 * 60 * 60);
return diff > 0 ? diff : 0;
```

If an employee checks in at 10 PM and checks out at 6 AM, the result is **negative**, returning 0 hours.

---

##  INPUT VALIDATION LOOPHOLES

### 19. Employee Registration — No Email Format Enforcement (Backend)
**File:** [employee_management.js](file:///c:/transSytem/transport-app/renderer/js/employee_management.js#L314-L335)

The frontend has `type="email"` on the HTML input, but the JS validation only checks `if (!email)`. The backend handler in [employees.ts](file:///c:/transSytem/transport-app/ipc/employees.ts#L30-L107) does **zero email validation**. A user could submit:
- `"not-an-email"` by modifying the DOM
- An empty string with whitespace: `"   "`

---

### 20. Employee Registration — Negative Daily Rate / Salary Accepted
**File:** [employee_management.js](file:///c:/transSytem/transport-app/renderer/js/employee_management.js#L325-L326)

```javascript
const daily_rate = parseFloat(document.getElementById("empDailyRate")?.value || "0");
const salary = parseFloat(document.getElementById("empSalary")?.value || "0");
```

There is **no minimum value check**. An admin can enter:
- **Negative values** like `-500` daily rate — corrupting payroll calculations
- **Extremely high values** like `999999999` — no upper bound

The HTML input has `type="number"` but no `min="0"` attribute. The backend doesn't validate either.

---

### 21. Employee Registration — Position/Department is Free-Text
**File:** [employee_management.html](file:///c:/transSytem/transport-app/renderer/html/employee_management.html#L144-L150)

Position and Department are plain `<input type="text">` fields instead of dropdowns. This causes:
- **Inconsistent data**: "Driver" vs "driver" vs "DRIVER" vs "Drivr" (typos)
- **Broken logic**: Status page checks `position === "Driver"` (case-sensitive) to determine trip eligibility. A typo means drivers won't be tracked.

---

### 22. Employee Edit — Can Change Email Without Re-syncing Auth
**File:** [employee_management.js](file:///c:/transSytem/transport-app/renderer/js/employee_management.js#L444-L473)

The edit form allows changing an employee's email, but this **does not update their Supabase Auth email**. Result: the employee can no longer log in because Auth still has the old email.

---

### 23. Trip Creation — No Date Validation (Past Dates / Reversed Range)
**File:** [scheduling_page.js](file:///c:/transSytem/transport-app/renderer/js/scheduling_page.js#L453-L465)

The trip form accepts:
- **Past dates** for pickup time — you can create a trip "scheduled" for yesterday
- **Delivery time before pickup time** — a trip that "arrives before it departs"
- **Empty date fields** — the form doesn't mark datetime fields as `required`

---

### 24. Trip Creation — Disabled Drivers/Vehicles Can Be Force-Selected
**File:** [scheduling_page.js](file:///c:/transSytem/transport-app/renderer/js/scheduling_page.js#L377-L383)

When editing a trip, **all disabled states are removed** from driver/vehicle options:
```javascript
Array.from(inputs.driver.options).forEach(opt => opt.disabled = false);
Array.from(inputs.vehicle.options).forEach(opt => opt.disabled = false);
```

This means during edit mode, a user can reassign a trip to an already-busy driver or vehicle. The backend has **no server-side validation** for this.

---

### 25. Billing — No Amount Validation
**File:** [billing.js](file:///c:/transSytem/transport-app/renderer/js/billing.js#L176-L194)

```javascript
amount: Number(amount.value || 0),
```

The invoice form accepts:
- **Negative amounts** — creates a "credit" invoice with no business logic to support it
- **Zero amounts** — creates invoices worth $0
- **No required fields** — all fields except invoice number can be blank

---

### 26. Billing — Due Date Can Be Before Issue Date
**File:** [billing.js](file:///c:/transSytem/transport-app/renderer/js/billing.js#L184-L185)

```javascript
issue_date: issueDate.value,
due_date: dueDate.value,
```

There is **no validation** that `due_date >= issue_date`. An invoice can be created with a due date in the past or before the issue date.

---

### 27. Vehicle Registration — No Duplicate Plate Number Check
**Files:** [vehicles_page.js](file:///c:/transSytem/transport-app/renderer/js/vehicles_page.js#L162-L186), [vehicles.ts](file:///c:/transSytem/transport-app/ipc/vehicles.ts#L10-L12)

Neither the frontend nor backend checks if a license plate already exists. Two vehicles can be registered with the **exact same plate number**, causing confusion in trip assignment and billing.

---

### 28. Vehicle Registration — No Plate Format Validation
**File:** [vehicles_page.html](file:///c:/transSytem/transport-app/renderer/html/vehicles_page.html#L156)

The plate input is a plain text field with no pattern validation. Users can enter anything: emojis, special characters, or blank spaces.

---

### 29. Client Form — No Required Field Enforcement
**File:** [client_history_page.js](file:///c:/transSytem/transport-app/renderer/js/client_history_page.js#L367-L390)

The add client form collects `name`, `email`, `phone`, `client_type`, and `status` but:
- **No fields are validated** before submission
- A client can be created with **blank name** and **blank email**
- No email format check at all
- No phone format check

---

### 30. Client Form — No Duplicate Client Check
**File:** [index.ts](file:///c:/transSytem/transport-app/ipc/index.ts#L34-L36)

The `add-client` handler does a blind insert. Two clients with the exact same name, email, and phone can be created, leading to data confusion.

---

### 31. Password Reset — Minimum Password is Only 6 Characters
**File:** [forgot_password_page.js](file:///c:/transSytem/transport-app/renderer/js/forgot_password_page.js#L162)

```javascript
if (newPass.length < 6) { ... }
```

The password reset accepts 6-character passwords, while registration requires 8 characters. This inconsistency lets users set **weaker passwords** through the reset flow. Neither flow enforces complexity (uppercase, numbers, special chars).

---

### 32. Registration — No Duplicate Username/Email Check (Frontend)
**File:** [signup_page.js](file:///c:/transSytem/transport-app/renderer/js/signup_page.js#L53-L101)

The signup form does not pre-check if the email or username already exists before submitting. The user only gets an error **after** the server rejects it. No debounced availability check.

---

### 33. XSS Risk — Employee Data Rendered via `innerHTML`
**File:** [employee_management.js](file:///c:/transSytem/transport-app/renderer/js/employee_management.js#L248-L290)

Employee data (name, email, position) is injected directly into the DOM using template literals inside `innerHTML`:
```javascript
tr.innerHTML = `<div style="font-weight: 700;">${emp.full_name}</div>`;
```

If an employee name contains `<script>alert('XSS')</script>`, it would execute. The **Client History page** correctly uses `escapeHtml()`, but employee, vehicle, billing, and scheduling pages do **NOT**.

---

### 34. Phone Number — No Format Validation Anywhere
**Files:** All form pages

Phone numbers across all modules (employees, clients) accept any string:
- Letters: `"abcdefg"`
- Too short: `"123"`
- Too long: `"00000000000000000000"`
- Special characters: `"++--//"`

No validation on frontend or backend.

---

## 📊 Summary Table — All Input Validation Issues

| # | Module | Field | Issue | Severity |
|---|--------|-------|-------|----------|
| 19 | Employee | Email | No backend validation | High |
| 20 | Employee | Daily Rate / Salary | Accepts negative values | High |
| 21 | Employee | Position / Department | Free-text causes inconsistency | High |
| 22 | Employee | Email (Edit) | Auth email not synced on change | High |
| 23 | Trip | Pickup/Delivery Time | Past dates and reversed ranges | High |
| 24 | Trip | Driver/Vehicle (Edit) | Disabled protection removed | High |
| 25 | Billing | Amount | Accepts negative and zero | Medium |
| 26 | Billing | Due Date | Can be before issue date | Medium |
| 27 | Vehicle | Plate Number | No duplicate check | Medium |
| 28 | Vehicle | Plate Number | No format validation | Low |
| 29 | Client | All Fields | No required field enforcement | Medium |
| 30 | Client | Client Record | No duplicate check | Medium |
| 31 | Auth | New Password | Min 6 chars (vs 8 for signup) | Medium |
| 32 | Auth | Email/Username | No pre-check for duplicates | Low |
| 33 | All Pages | Display Fields | XSS via innerHTML (no escaping) | High |
| 34 | All Pages | Phone Number | No format validation | Low |

---

## 🔵 RECOMMENDED FEATURES & IMPROVEMENTS

### Security Improvements
| # | Feature | Priority |
|---|---------|----------|
| 1 | **Remove plaintext password storage** — Migrate to Supabase Auth only | Critical |
| 2 | **Add login attempt limiting** — Lock after 5 failed attempts for 15 min | Critical |
| 3 | **Add session expiry** — Auto-logout after inactivity (e.g., 30 min) | High |
| 4 | **Implement RBAC** — Admin vs. Employee roles with restricted operations | High |
| 5 | **Remove recovery code from email subject** | Medium |
| 6 | **Add audit logging** — Log who performed delete/update operations | Medium |
| 7 | **Encrypt sensitive .env values** at build time | Medium |

### Business Logic Improvements
| # | Feature | Priority |
|---|---------|----------|
| 8 | **Driver/vehicle availability check** before trip assignment | High |
| 9 | **Cascade protection** — Prevent deleting vehicles/clients with active references | High |
| 10 | **Attendance duplicate guard** — Prevent double check-in on same date | High |
| 11 | **Overnight shift support** in payroll hour calculation | Medium |
| 12 | **Payroll audit trail** — Don't delete old paychecks; mark as "superseded" | Medium |
| 13 | **Invoice number uniqueness validation** | Medium |
| 14 | **Employee ID generation locking** to prevent race conditions | Low |

### Input Validation Fixes
| # | Feature | Priority |
|---|---------|----------|
| 15 | **Add `escapeHtml()` to all innerHTML rendering** across all pages | Critical |
| 16 | **Use dropdown selects for Position/Department** instead of free-text | High |
| 17 | **Add `min="0"` on all financial inputs** (daily rate, salary, amount) | High |
| 18 | **Validate date ranges** — delivery after pickup, due after issue | High |
| 19 | **Add duplicate checks** — plate numbers, client records, invoice numbers | Medium |
| 20 | **Enforce consistent password policy** — min 8 chars everywhere | Medium |
| 21 | **Add phone format validation** with regex pattern | Medium |
| 22 | **Server-side validation** for all IPC handlers (don't trust frontend) | High |

### UX/Feature Additions
| # | Feature | Priority |
|---|---------|----------|
| 23 | **Session timeout warning** — Modal "Your session will expire in 5 minutes" | High |
| 24 | **Confirmation modal for destructive actions** (delete employee, vehicle, client) | High |
| 25 | **Activity log page** — Track all admin actions with timestamps | Medium |
| 26 | **Pagination on all tables** — Large datasets will slow down rendering | Medium |
| 27 | **Password strength indicator** on registration/reset pages | Low |
| 28 | **Dark mode support for email templates** (payslip, recovery code) | Low |

---

## ⚡ Quick Wins — Highest Impact, Lowest Effort

These are the most impactful changes that can be fixed with minimal code:

1. **Add `min="0"` to all number inputs** — Employee daily rate/salary, billing amount
2. **Replace Position/Department text inputs with `<select>` dropdowns**
3. **Add date validation** — Prevent delivery before pickup, due before issue
4. **Add `escapeHtml()` utility** to employee, vehicle, billing, and scheduling pages
5. **Add duplicate plate number check** before vehicle registration
6. **Fix password policy** — Set minimum to 8 everywhere
7. **Remove recovery code from email subject line**
8. **Add `required` attributes** to all mandatory form fields
9. **Add server-side financial value validation** — Reject negative rates/amounts
10. **Fix overnight shift calculation** in payroll

---

> **Next Step:** Let me know which items you'd like me to implement first and I'll start working on them.
