import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  process.exit(1);
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testQuery() {
  const { data, error } = await supabaseAdmin
    .from("time_off_requests")
    .select("*, employees:employee_id ( full_name )")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
  console.log("SUCCESS:", data?.length, "records");
  if (data?.length) {
    console.log(JSON.stringify(data[0], null, 2));
  }
}

testQuery();
