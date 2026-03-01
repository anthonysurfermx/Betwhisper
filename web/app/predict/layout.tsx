import type { Metadata } from "next"
import { Web3Provider } from '@/components/web3-provider'
import { UnlinkWrapper } from '@/components/unlink-provider'
import 'mapbox-gl/dist/mapbox-gl.css'

export const metadata: Metadata = {
  title: "BetWhisper — Predict",
  description:
    "Search any prediction market. Your AI assistant scans whale wallets, detects bots, and helps you trade smarter on Monad.",
  openGraph: {
    title: "BetWhisper — Predict",
    description: "Search any prediction market. Your AI scans whale wallets, detects bots, and helps you trade smarter.",
    type: "website",
    url: "https://betwhisper.ai/predict",
    siteName: "BetWhisper",
  },
  twitter: {
    card: "summary_large_image",
    title: "BetWhisper — Predict",
    description: "Search any prediction market. Your AI scans whale wallets, detects bots, and helps you trade smarter.",
  },
}

export default function PredictLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Web3Provider>
      <UnlinkWrapper>{children}</UnlinkWrapper>
    </Web3Provider>
  )
}
