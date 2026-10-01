import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { WalletProvider } from "@/hooks/useWallet";

/** Live GitHub Pages URL (repo name includes trailing hyphen). */
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://kshot3000.github.io/Night-Messenger-"
).replace(/\/$/, "");
const siteUrlSlash = `${siteUrl}/`;
const ogImage = `${siteUrl}/og.png`;
const icon = (path: string) =>
  `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrlSlash),
  title: {
    default: "Night Messenger — Your words. Your space.",
    template: "%s · Night Messenger",
  },
  description:
    "A calmer messaging experience for the Midnight ecosystem. Explore a free, open-source local preview.",
  applicationName: "Night Messenger",
  authors: [{ name: "Kshot", url: "https://github.com/Kshot3000" }],
  keywords: [
    "Midnight",
    "privacy",
    "messenger",
    "ZK",
    "selective disclosure",
    "Lace",
    "E2EE",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrlSlash,
    siteName: "Night Messenger",
    title: "Night Messenger — Your words. Your space.",
    description:
      "Your words. Not the world’s. Explore Night Messenger, an open-source local messaging preview for the Midnight ecosystem.",
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "Night Messenger — black & white ninja + sakura",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Night Messenger",
    description:
      "A calmer messaging experience for Midnight. Explore the free, open-source local preview.",
    images: [ogImage],
  },
  icons: {
    icon: [
      { url: icon("/favicon.ico") },
      { url: icon("/icon.svg"), type: "image/svg+xml" },
    ],
    apple: [{ url: icon("/apple-touch-icon.png") }],
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
