import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { app } from "electron";

// Path Resolution
const __dirnameResolved = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(process.execPath);

const envCandidates = [
  app?.isPackaged ? path.join(process.resourcesPath, ".env") : "",
  path.join(__dirnameResolved, "..", ".env"),
  path.join(__dirnameResolved, "..", "..", ".env"),
  path.join(process.cwd(), ".env"),
].filter(Boolean);

const envPath = envCandidates.find(p => fs.existsSync(p)) || "";

if (envPath) {
  dotenv.config({ path: envPath });
  console.log(`[AUTH] .env loaded from: ${envPath}`);
} else {
  console.warn(`[AUTH] .env not found in candidate paths. Using existing environment variables.`);
}

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Validation
if (!SUPABASE_URL) console.error("[AUTH] CRITICAL: SUPABASE_URL is missing! Check your .env file.");
if (!SUPABASE_KEY) console.error("[AUTH] CRITICAL: SUPABASE_KEY is missing! Check your .env file.");

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type ApiResponse<T = any> = {
  success: boolean;
  ok: boolean; // Alias for success (used by frontend)
  data?: T;
  error?: string;
  message?: string; // Alias for error (used by frontend)
};

export async function handleSupabase<T>(
  promise: PromiseLike<{ data: T | null; error: any }>
): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await promise;
    if (error) {
      console.error("[IPC] Supabase error:", error.message);
      return { success: false, ok: false, error: error.message, message: error.message };
    }
    return { success: true, ok: true, data: data as T };
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error("[IPC] Unexpected error:", msg);
    return { success: false, ok: false, error: msg, message: msg };
  }
}
