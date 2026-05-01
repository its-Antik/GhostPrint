import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import DevProvider from "@/components/DevProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GhostPrint - Campus Print Network",
  description: "Skip the Xerox queues. Get your prints delivered to the college gate.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <DevProvider>
            {children}
          </DevProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
