import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LabSync — Intelligent Lab IDE",
  description: "Diagnostic intelligence for college programming labs. Zero-setup cloud IDE with real-time monitoring, AI-guided hints, and instructor dashboards.",
  icons: {
    icon: '/favicon.svg',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('labsync-theme');
                if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
              } catch(e) {}
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
