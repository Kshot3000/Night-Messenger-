import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** Live GitHub Pages URL (repo name includes trailing hyphen). */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kshot3000.github.io/Night-Messenger-").replace(
  /\/$/,
  "",
);
const siteUrlSlash = `${siteUrl}/`;
const ogImage = `${siteUrl}/og.png`;
const icon = (path: string) => `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrlSlash),
  title: {
    default: "Night Messenger — Private DMs on Midnight",
    template: "%s · Night Messenger",
  },
  description:
    "Free & open-source private messaging on Midnight. E2EE bodies, on-chain existence commitments, selective disclosure — no paywalls.",
  applicationName: "Night Messenger",
  authors: [{ name: "Kshot", url: "https://github.com/Kshot3000" }],
  keywords: ["Midnight", "privacy", "messenger", "ZK", "selective disclosure", "Lace", "E2EE"],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrlSlash,
    siteName: "Night Messenger",
    title: "Night Messenger — Private DMs on Midnight",
    description:
      "1:1 DMs where plaintext stays encrypted, existence can be proven on-chain, and you choose what to disclose. Free & open source.",
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
    description: "Private messaging on Midnight with selective disclosure. Free & open source.",
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
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
