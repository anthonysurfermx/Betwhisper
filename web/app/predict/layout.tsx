import type { Metadata } from "next"
import { Web3Provider } from '@/components/web3-provider'
import 'mapbox-gl/dist/mapbox-gl.css'

export const metadata: Metadata = {
  title: "BetWhisper — Predict",
  description:
    "Search any prediction market. Your AI assistant scans whale wallets, detects bots, and helps you place informed bets on Monad.",
  openGraph: {
    title: "BetWhisper — Predict",
    description: "Search any prediction market. Your AI scans whale wallets, detects bots, and helps you bet smarter.",
    type: "website",
    url: "https://betwhisper.ai/predict",
    siteName: "BetWhisper",
  },
  twitter: {
    card: "summary_large_image",
    title: "BetWhisper — Predict",
    description: "Search any prediction market. Your AI scans whale wallets, detects bots, and helps you bet smarter.",
  },
}

export default function PredictLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <Web3Provider>{children}</Web3Provider>
}
