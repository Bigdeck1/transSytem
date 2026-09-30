import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load .env
const envPath = path.resolve(__dirname, "..", "..", ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`[SERVER] .env loaded from: ${envPath}`);
} else {
  dotenv.config();
  console.log(`[SERVER] .env loaded from default process directory`);
}

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL) console.error("[SERVER] CRITICAL: SUPABASE_URL is missing! Check your .env file.");
if (!SUPABASE_KEY) console.error("[SERVER] CRITICAL: SUPABASE_KEY is missing! Check your .env file.");
if (!SUPABASE_SERVICE_ROLE_KEY) console.warn("[SERVER] WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations will be limited.");

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type ApiResponse<T = any> = {
  success: boolean;
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export async function handleSupabase<T>(
  promise: PromiseLike<{ data: T | null; error: any }>
): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await promise;
    if (error) {
      console.error("[SERVER] Supabase error:", error.message);
      return { success: false, ok: false, error: error.message, message: error.message };
    }
    return { success: true, ok: true, data: data as T };
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error("[SERVER] Unexpected error:", msg);
    return { success: false, ok: false, error: msg, message: msg };
  }
}
