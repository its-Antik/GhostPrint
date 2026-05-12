import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Extract email domain from an email address.
 * e.g., "antik@heritageit.edu.in" → "heritageit.edu.in"
 */
function extractDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() || "";
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      // Admin bypass — always allowed
      if (user.email === process.env.ADMIN_EMAIL) {
        await ensureProfile(user);
        return true;
      }

      // Multi-Tenant Check: look up the user's domain in the colleges table
      const domain = extractDomain(user.email);

      const { data: college } = await supabaseAdmin
        .from("colleges")
        .select("email_domain, is_active")
        .eq("email_domain", domain)
        .single();

      if (college && college.is_active) {
        // Domain is registered and active — allow sign-in
        await ensureProfile(user);
        return true;
      }

      // Fallback: legacy check for Heritage (in case colleges table doesn't exist yet)
      if (domain === "heritageit.edu.in") {
        await ensureProfile(user);
        return true;
      }

      // Reject — user will be redirected to /auth/error (expansion funnel)
      return false;
    },

    // Expose college_domain in the JWT session so the frontend can use it
    async jwt({ token, user }) {
      if (user?.email) {
        token.college_domain = extractDomain(user.email);
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.college_domain) {
        (session.user as any).college_domain = token.college_domain;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin', 
    error: '/auth/error', 
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  }
});

// Auto-create profile row on first sign-in, tagged with college_domain
async function ensureProfile(user: any) {
  try {
    const domain = extractDomain(user.email);

    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id, college_domain')
      .eq('username', user.email)
      .single();

    if (!existing) {
      await supabaseAdmin.from('profiles').insert({
        username: user.email,
        full_name: user.name || "",
        avatar_url: user.image || "",
        department: "",
        whatsapp_no: "",
        is_runner_active: false,
        balance: 0,
        bw_rate: 2,
        color_rate: 5,
        college_domain: domain,
      });
      console.log("Created profile for:", user.email, "domain:", domain);
    } else if (!existing.college_domain) {
      // Backfill domain for existing profiles that don't have it
      await supabaseAdmin
        .from('profiles')
        .update({ college_domain: domain })
        .eq('username', user.email);
      console.log("Backfilled domain for:", user.email, "→", domain);
    }
  } catch (err) {
    console.error("ensureProfile error:", err);
  }
}

export { handler as GET, handler as POST };
