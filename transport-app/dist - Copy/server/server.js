"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const auth_routes_1 = require("./routes/auth.routes");
const employees_routes_1 = require("./routes/employees.routes");
const trips_routes_1 = require("./routes/trips.routes");
const vehicles_routes_1 = require("./routes/vehicles.routes");
const requests_routes_1 = require("./routes/requests.routes");
const payroll_routes_1 = require("./routes/payroll.routes");
const billing_routes_1 = require("./routes/billing.routes");
const clients_routes_1 = require("./routes/clients.routes");
const dashboard_routes_1 = require("./routes/dashboard.routes");
const notifications_routes_1 = require("./routes/notifications.routes");
const tracking_routes_1 = require("./routes/tracking.routes");
const epod_routes_1 = __importDefault(require("./routes/epod.routes"));
const expenses_routes_1 = __importDefault(require("./routes/expenses.routes"));
const incidents_routes_1 = __importDefault(require("./routes/incidents.routes"));
const public_tracking_routes_1 = __importDefault(require("./routes/public_tracking.routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware — CORS configured for cross-device / cross-network access
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : [];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, same-origin)
        if (!origin)
            return callback(null, true);
        // Allow if in explicit whitelist or if no whitelist is configured (dev mode)
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(null, true); // Permissive for transport fleet — all drivers need access
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
// Request logger
app.use((req, _res, next) => {
    if (!req.path.startsWith("/css") && !req.path.startsWith("/js") && !req.path.startsWith("/assets")) {
        console.log(`[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.path}`);
    }
    next();
});
// API Routes
app.use("/api/auth", auth_routes_1.authRouter);
app.use("/api/employees", employees_routes_1.employeesRouter);
app.use("/api/trips", trips_routes_1.tripsRouter);
app.use("/api/vehicles", vehicles_routes_1.vehiclesRouter);
app.use("/api/requests", requests_routes_1.requestsRouter);
app.use("/api/payroll", payroll_routes_1.payrollRouter);
app.use("/api/billing", billing_routes_1.billingRouter);
app.use("/api/clients", clients_routes_1.clientsRouter);
app.use("/api/dashboard", dashboard_routes_1.dashboardRouter);
app.use("/api/notifications", notifications_routes_1.notificationsRouter);
app.use("/api/tracking", tracking_routes_1.trackingRouter);
app.use("/api/epod", epod_routes_1.default);
app.use("/api/expenses", expenses_routes_1.default);
app.use("/api/incidents", incidents_routes_1.default);
app.use(public_tracking_routes_1.default);
// Health check — used by Docker, Render, Railway, and monitoring tools
app.get("/api/health", (_req, res) => {
    res.json({
        status: "online",
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
    });
});
// Static Assets Hosting
const rendererPath = path_1.default.resolve(__dirname, "..", "renderer");
const assetsPath = path_1.default.resolve(__dirname, "..", "assets");
app.use("/assets", express_1.default.static(assetsPath));
app.use(express_1.default.static(rendererPath));
// Redirect root to login page
app.get("/", (_req, res) => {
    res.redirect("/html/index.html");
});
// Global Error Handler
app.use((err, _req, res, _next) => {
    console.error("[SERVER UNCAUGHT ERROR]", err);
    res.status(500).json({ error: err?.message || "Internal server error" });
});
app.listen(Number(PORT), "0.0.0.0", () => {
    // Get local network IP for device testing
    const nets = require("os").networkInterfaces();
    let lanIP = "localhost";
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if (net.family === "IPv4" && !net.internal) {
                lanIP = net.address;
                break;
            }
        }
    }
    console.log(`====================================================`);
    console.log(`🚀 JRR Transport Web App is running!`);
    console.log(`🌐 Local URL:   http://localhost:${PORT}`);
    console.log(`📱 Network URL: http://${lanIP}:${PORT}`);
    console.log(`   (Use the Network URL on phones/other devices)`);
    console.log(`📡 Database:    Supabase Cloud`);
    console.log(`====================================================`);
});
exports.default = app;
//# sourceMappingURL=server.js.map