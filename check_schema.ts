import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .limit(1);
    
  if (error) {
    console.error("Error fetching orders:", error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log("Columns present in the first row:");
    console.log(Object.keys(data[0]));
  } else {
    console.log("No data found, trying to insert an empty row to see the exact error or we can just try to fetch a row.");
    // Let's query the information_schema
    // Actually, we can't easily query information_schema from the client API.
    // Let's insert a dummy row and catch the error.
    const { error: insertError } = await supabase.from('orders').insert({}).select();
    console.log("Insert error details:", insertError);
  }
}

checkSchema();
