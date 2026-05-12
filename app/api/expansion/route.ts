import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Known personal/generic email domains that aren't college-specific
const PERSONAL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com",
  "icloud.com", "protonmail.com", "aol.com", "zoho.com", "yandex.com",
  "mail.com", "gmx.com", "rediffmail.com",
]);

/**
 * GET /api/expansion
 * 
 * No params    → returns full leaderboard
 * ?lookup=DOMAIN → returns the canonical college name for that domain (autocomplete)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lookup = searchParams.get("lookup");

    // --- LOOKUP MODE: Given a domain, return the established college name ---
    if (lookup) {
      const domain = lookup.toLowerCase().trim();

      const { data } = await supabaseAdmin
        .from("expansion_requests")
        .select("college_name")
        .eq("email_domain", domain)
        .order("created_at", { ascending: true })
        .limit(10);

      if (data && data.length > 0) {
        // Count votes for each college_name variant to pick the most popular
        const nameVotes: Record<string, number> = {};
        for (const row of data) {
          const name = row.college_name;
          nameVotes[name] = (nameVotes[name] || 0) + 1;
        }
        // Sort by votes descending
        const sorted = Object.entries(nameVotes).sort((a, b) => b[1] - a[1]);
        const canonicalName = sorted[0][0];
        const allNames = sorted.map(([name]) => name);

        return NextResponse.json({
          found: true,
          canonical_name: canonicalName,
          all_names: allNames,
          count: data.length,
        });
      }

      return NextResponse.json({ found: false });
    }

    // --- LEADERBOARD MODE ---
    const { data, error } = await supabaseAdmin
      .from("campus_leaderboard")
      .select("*")
      .limit(15);

    if (error) {
      console.error("Leaderboard fetch error:", error);
      return NextResponse.json({ leaderboard: [] });
    }

    return NextResponse.json({ leaderboard: data || [] });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json({ leaderboard: [] });
  }
}

/**
 * POST /api/expansion — Submit an expansion request
 * 
 * Domain validation:
 * - College emails: domain must match existing entries for that college, OR start a new domain
 * - Personal emails (gmail, etc): must pick an existing college name OR start a new one
 * - A student can only have ONE expansion request (unique on student_email)
 */
export async function POST(req: Request) {
  try {
    const { college_name, student_email, campus_size, ref } = await req.json();

    if (!college_name || !student_email) {
      return NextResponse.json(
        { error: "College name and email are required" },
        { status: 400 }
      );
    }

    const email = student_email.toLowerCase().trim();
    const domain = email.split("@")[1] || "";
    const isPersonalEmail = PERSONAL_DOMAINS.has(domain);

    // Reject personal emails — we need college/workplace emails for campus verification
    if (isPersonalEmail) {
      return NextResponse.json(
        { error: "Personal emails (Gmail, Yahoo, etc.) are not accepted. Please use your college or workplace email." },
        { status: 400 }
      );
    }

    // --- CHECK 1: Has this email already submitted a request? (one per student) ---
    const { data: existingByEmail } = await supabaseAdmin
      .from("expansion_requests")
      .select("id, college_name")
      .eq("student_email", email)
      .single();

    if (existingByEmail) {
      return NextResponse.json(
        {
          error: `You've already requested expansion for ${existingByEmail.college_name}! Share the link to fast-track it.`,
        },
        { status: 409 }
      );
    }

    // --- CHECK 2: Domain-trust validation (non-personal emails only) ---
    // If a college domain (e.g., @iemcal.ac.in) is already linked to "IEM Kolkata",
    // the user's college_name input must match that — or we auto-correct it.
    let finalCollegeName = college_name.trim();

    if (!isPersonalEmail && domain) {
      // Check if this domain already has entries
      const { data: domainEntries } = await supabaseAdmin
        .from("expansion_requests")
        .select("college_name")
        .eq("email_domain", domain)
        .limit(10);

      if (domainEntries && domainEntries.length > 0) {
        // Domain already exists — use the canonical (most popular) name
        const nameVotes: Record<string, number> = {};
        for (const row of domainEntries) {
          nameVotes[row.college_name] = (nameVotes[row.college_name] || 0) + 1;
        }
        const canonical = Object.entries(nameVotes).sort((a, b) => b[1] - a[1])[0][0];
        finalCollegeName = canonical;
      }
    }

    // --- INSERT ---
    const { error } = await supabaseAdmin.from("expansion_requests").insert({
      college_name: finalCollegeName,
      student_email: email,
      campus_size: campus_size || null,
      referrer: ref || null,
      email_domain: domain,
      status: "pending",
    });

    if (error) {
      console.error("Insert error:", error);
      // Handle unique constraint violation gracefully
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "You've already submitted an expansion request!" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to submit request" },
        { status: 500 }
      );
    }

    // --- TELEGRAM NOTIFICATION ---
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId =
      process.env.TELEGRAM_EXPANSION_CHANNEL_ID ||
      process.env.TELEGRAM_SUPPORT_CHANNEL_ID ||
      process.env.TELEGRAM_CHANNEL_ID;

    if (botToken && chatId) {
      const text = `🏫 *New Campus Expansion Request*\n\n*College:* ${finalCollegeName}\n*Email:* ${email}\n*Domain:* ${domain}\n*Campus Size:* ${campus_size || "Not specified"}\n*Referrer:* ${ref || "Direct"}`;

      try {
        await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              parse_mode: "Markdown",
            }),
          }
        );
      } catch (tgError) {
        console.error("Telegram ping failed:", tgError);
      }
    }

    // --- FETCH UPDATED COUNT ---
    // Use email_domain for grouping if it's a college email
    let collegeCount = 1;
    if (domain) {
      const { data: countData } = await supabaseAdmin
        .from("campus_leaderboard")
        .select("*")
        .eq("email_domain", domain)
        .single();
      collegeCount = countData?.request_count || 1;
    }

    return NextResponse.json({
      success: true,
      college_name: finalCollegeName,
      college_count: collegeCount,
    });
  } catch (error) {
    console.error("Expansion request error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
