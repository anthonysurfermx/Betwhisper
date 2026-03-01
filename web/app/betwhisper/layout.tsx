import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "BetWhisper — Your AI voice interface to prediction markets",
  description:
    "Name your AI assistant. Ask about any prediction market. It scans whale wallets, warns you about bots, and executes your trade on Monad.",
  keywords: ["prediction markets", "AI agent", "Polymarket", "whale tracking", "bot detection", "Monad", "voice trading"],
  metadataBase: new URL("https://betwhisper.ai"),
  openGraph: {
    title: "BetWhisper — Your AI voice interface to prediction markets",
    description: "Name your AI assistant. Ask about any prediction market. It scans whale wallets, warns you about bots, and executes your trade on Monad.",
    type: "website",
    url: "https://betwhisper.ai",
    siteName: "BetWhisper",
  },
  twitter: {
    card: "summary_large_image",
    title: "BetWhisper — Your AI voice interface to prediction markets",
    description: "Name your AI assistant. It scans whale wallets, warns you about bots, and executes your trade on Monad.",
  },
}

export default function BetWhisperLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
