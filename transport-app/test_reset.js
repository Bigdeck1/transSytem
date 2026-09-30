const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function testReset() {
  console.log('Testing password reset for: rencyanimation@gmail.com');
  const { data, error } = await supabase.auth.resetPasswordForEmail('rencyanimation@gmail.com', {
    redirectTo: 'http://localhost:3000/reset-password', // Typically Supabase requires a valid redirect URL or it might use the default site URL
  });

  if (error) {
    console.error(' Supabase Reset Password Error:', error.message, error.status, error.name);
  } else {
    console.log(' Supabase Reset Password Success:', data);
    console.log('An email should have been sent if the user exists and SMTP/email provider is configured in Supabase.');
  }
}

testReset();
