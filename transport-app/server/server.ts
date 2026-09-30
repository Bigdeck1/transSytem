import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { authRouter } from "./routes/auth.routes";
import { employeesRouter } from "./routes/employees.routes";
import { tripsRouter } from "./routes/trips.routes";
import { vehiclesRouter } from "./routes/vehicles.routes";
import { requestsRouter } from "./routes/requests.routes";
import { payrollRouter } from "./routes/payroll.routes";
import { billingRouter } from "./routes/billing.routes";
import { clientsRouter } from "./routes/clients.routes";
import { dashboardRouter } from "./routes/dashboard.routes";
import { notificationsRouter } from "./routes/notifications.routes";
import { trackingRouter } from "./routes/tracking.routes";
import epodRouter from "./routes/epod.routes";
import expensesRouter from "./routes/expenses.routes";
import incidentsRouter from "./routes/incidents.routes";
import publicTrackingRouter from "./routes/public_tracking.routes";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware — CORS configured for cross-device / cross-network access
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, same-origin)
    if (!origin) return callback(null, true);
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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.path.startsWith("/css") && !req.path.startsWith("/js") && !req.path.startsWith("/assets")) {
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.path}`);
  }
  next();
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/trips", tripsRouter);
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/payroll", payrollRouter);
app.use("/api/billing", billingRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/tracking", trackingRouter);
app.use("/api/epod", epodRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/incidents", incidentsRouter);
app.use(publicTrackingRouter);

// Health check — used by Docker, Render, Railway, and monitoring tools
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "online",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// Static Assets Hosting
const rendererPath = path.resolve(__dirname, "..", "renderer");
const assetsPath = path.resolve(__dirname, "..", "assets");

app.use("/assets", express.static(assetsPath));
app.use(express.static(rendererPath));

// Redirect root to login page
app.get("/", (_req: Request, res: Response) => {
  res.redirect("/html/index.html");
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
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
  console.log(` JRR Transport Web App is running!`);
  console.log(` Local URL:   http://localhost:${PORT}`);
  console.log(` Network URL: http://${lanIP}:${PORT}`);
  console.log(`   (Use the Network URL on phones/other devices)`);
  console.log(` Database:    Supabase Cloud`);
  console.log(`====================================================`);
});

export default app;
