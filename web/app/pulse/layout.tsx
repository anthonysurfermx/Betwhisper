import type { Metadata } from "next"
import { Web3Provider } from '@/components/web3-provider'
import 'mapbox-gl/dist/mapbox-gl.css'

export const metadata: Metadata = {
  title: "BetWhisper — Pulse",
  description:
    "Geo-located crowd sentiment for prediction markets. See where the world is trading in real-time, encrypted by Unlink.",
  openGraph: {
    title: "BetWhisper — Pulse",
    description: "Geo-located crowd sentiment. See where the world is trading.",
    type: "website",
    url: "https://betwhisper.ai/pulse",
    siteName: "BetWhisper",
  },
  twitter: {
    card: "summary_large_image",
    title: "BetWhisper — Pulse",
    description: "Geo-located crowd sentiment. See where the world is trading.",
  },
}

export default function PulseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <Web3Provider>{children}</Web3Provider>
}
