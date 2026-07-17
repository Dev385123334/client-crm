import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = 'https://vndpfwxshbbjjyrptuhn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZHBmd3hzaGJiamp5cnB0dWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjQ3MzcsImV4cCI6MjA5NDI0MDczN30.JCo3KQxjCGzG3ChtZnLqmzrqc12moI_jUBVHKrgz7Q0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  // 1. Try to fetch existing deposits (will require auth)
  const { data: deposits, error } = await supabase.from('bank_deposits').select('*').order('date', { ascending: false });
  if (error) {
    console.log('Cannot read deposits directly (expected without auth). Need to authenticate first.');
    console.log('Error:', error.message);
  } else {
    console.log(`Found ${deposits.length} existing deposits`);
  }

  // 2. Try to sign up or sign in
  const email = `admin-${Date.now()}@antigravitytesting.com`;
  const password = 'Temp1234!';
  
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role: 'admin' } }
  });
  
  if (signUpError) {
    console.log('Sign up error:', signUpError.message);
  } else {
    console.log('Signed up as:', email);
    console.log('Session:', signUpData.session ? 'Has session' : 'No session (check email)');
  }
}

main().catch(console.error);
