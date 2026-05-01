import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // BLOCKER: Only allow students from your college or admin email
      if (user.email === process.env.ADMIN_EMAIL) {
        await ensureProfile(user);
        return true;
      }
      const isCollegeEmail = user.email?.endsWith("@heritageit.edu.in");
      if (isCollegeEmail) {
        await ensureProfile(user);
        return true;
      }
      return false;
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

// Auto-create profile row on first sign-in
async function ensureProfile(user: any) {
  try {
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
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
      });
      console.log("Created profile for:", user.email);
    }
  } catch (err) {
    console.error("ensureProfile error:", err);
  }
}

export { handler as GET, handler as POST };

