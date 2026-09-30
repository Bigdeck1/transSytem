import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// --- Supabase client setup ---
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// --- TypeScript types for your tables ---

export interface Paycheck {
  id: string;
  employee_id: string;
  pay_period_start: string;
  pay_period_end: string;
  gross_pay: number;
  deductions: number;
  net_pay: number;
  hours_worked: number;
  status: 'paid' | 'pending';
  payment_date: string;
  created_at: string;
}

export interface Notification {
  id: string;
  employee_id: string;
  title: string;
  message: string;
  type: 'paycheck' | 'announcement' | 'alert' | 'other';
  is_read: boolean;
  created_at: string;
}
export interface Attendance {
  id: number;               // bigint → number in TS
  employee_id: string;      // uuid → string
  date: string;             // date → string (YYYY-MM-DD)
  check_in: string | null;  // time → string or null
  check_out: string | null; // time → string or null
  created_at: string;
}
