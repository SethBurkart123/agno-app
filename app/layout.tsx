import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css"; // 📚 KaTeX styles for math rendering
import { ThemeProvider } from "@/app/contexts/theme-context";
import { AuthProvider } from "@/app/contexts/auth-context";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Minimal Chat Interface",
  description: "Elegant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <Suspense fallback={<></>}>
              {children}
            </Suspense>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}