import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-geist",
})
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "BetWhisper — Trade Polymarket from your glasses",
  description:
    "The fastest way to trade prediction markets. Just say what you want to bet on. BetWhisper handles the rest. No phone, no app switching, no screens.",
  keywords: ["prediction markets", "Polymarket", "Meta Ray-Ban", "smart glasses", "voice trading", "AI agent", "sports betting", "crypto predictions"],
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
  metadataBase: new URL("https://betwhisper.ai"),
  openGraph: {
    title: "BetWhisper — Trade Polymarket from your glasses",
    description: "The fastest way to trade prediction markets. Just say what you want to bet on. No phone needed.",
    type: "website",
    url: "https://betwhisper.ai",
    siteName: "BetWhisper",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BetWhisper — Trade Polymarket from your glasses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BetWhisper — Trade Polymarket from your glasses",
    description: "The fastest way to trade prediction markets. Just say what you want to bet on. No phone needed.",
    images: ["/og-image.png"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased bg-black text-white">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
