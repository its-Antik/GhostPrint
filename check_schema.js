const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, serviceKey);

async function check() {
  // 1. Get the full schema definition for the profiles table
  const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${serviceKey}`);
  const spec = await res.json();
  
  if (spec.definitions && spec.definitions.profiles) {
    const profilesSchema = spec.definitions.profiles.properties;
    console.log("=== PROFILES TABLE COLUMNS ===");
    for (const [col, info] of Object.entries(profilesSchema)) {
      console.log(`  ${col}: ${info.type} (format: ${info.format || 'none'})`);
    }
  } else {
    console.log("No 'profiles' table found in schema!");
  }

  // 2. Fetch any existing profile rows
  const { data: profiles, error } = await supabase.from('profiles').select('*').limit(5);
  console.log("\n=== EXISTING PROFILES DATA ===");
  if (error) {
    console.log("ERROR:", error.message);
  } else {
    console.log(JSON.stringify(profiles, null, 2));
  }

  // 3. Check RLS policies by trying to insert with anon key
  const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const anonClient = createClient(supabaseUrl, anonKey);
  const { error: anonErr } = await anonClient
    .from('profiles')
    .update({ department: 'test' })
    .eq('username', 'nonexistent@test.com');
  console.log("\n=== ANON KEY UPDATE ATTEMPT ===");
  console.log(anonErr ? `ERROR: ${anonErr.message} (code: ${anonErr.code})` : "Success (no rows matched but no RLS block)");
}

check();
