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
  title: "VoiceSwap — The AI payment agent that lives in your glasses",
  description:
    "An autonomous AI agent on Meta Ray-Ban glasses. It sees, listens, and pays — on Monad. No phone, no wallet apps, no friction.",
  keywords: ["AI agent", "autonomous payments", "Meta Ray-Ban", "smart glasses", "Monad", "Gemini Live", "USDC", "voice payments"],
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
  metadataBase: new URL("https://www.voiceswap.cc"),
  openGraph: {
    title: "VoiceSwap — The AI payment agent that lives in your glasses",
    description: "An autonomous AI agent on Meta Ray-Ban glasses. It sees, listens, and pays — on Monad. No phone, no wallet apps, no friction.",
    type: "website",
    url: "https://www.voiceswap.cc",
    siteName: "VoiceSwap",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VoiceSwap — The AI payment agent that lives in your glasses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VoiceSwap — The AI payment agent that lives in your glasses",
    description: "An autonomous AI agent on Meta Ray-Ban glasses. It sees, listens, and pays — on Monad.",
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
