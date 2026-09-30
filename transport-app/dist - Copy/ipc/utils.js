"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = exports.supabase = void 0;
exports.getErrorMessage = getErrorMessage;
exports.handleSupabase = handleSupabase;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_1 = require("electron");
// Path Resolution
const __dirnameResolved = typeof __dirname !== "undefined"
    ? __dirname
    : path_1.default.dirname(process.execPath);
const envPath = String(electron_1.app?.isPackaged
    ? path_1.default.join(process.resourcesPath, ".env")
    : path_1.default.join(__dirnameResolved, "..", "..", ".env") || "");
if (fs_1.default.existsSync(envPath)) {
    dotenv_1.default.config({ path: envPath });
    console.log(`[AUTH] .env loaded from: ${envPath}`);
}
else {
    console.error(`[AUTH] .env MISSING at: ${envPath}`);
}
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
// Validation
if (!SUPABASE_URL)
    console.error("[AUTH] CRITICAL: SUPABASE_URL is missing! Check your .env file.");
if (!SUPABASE_KEY)
    console.error("[AUTH] CRITICAL: SUPABASE_KEY is missing! Check your .env file.");
exports.supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_KEY);
exports.supabaseAdmin = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
function getErrorMessage(err) {
    return err instanceof Error ? err.message : String(err);
}
async function handleSupabase(promise) {
    try {
        const { data, error } = await promise;
        if (error) {
            console.error("[IPC] Supabase error:", error.message);
            return { success: false, ok: false, error: error.message, message: error.message };
        }
        return { success: true, ok: true, data: data };
    }
    catch (err) {
        const msg = getErrorMessage(err);
        console.error("[IPC] Unexpected error:", msg);
        return { success: false, ok: false, error: msg, message: msg };
    }
}
//# sourceMappingURL=utils.js.map