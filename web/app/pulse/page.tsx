'use client'

import { useWeb3 } from '@/components/web3-provider'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Wallet, LogOut, Shield, Zap, TrendingUp,
  Users, Activity, Radio, MapPin
} from 'lucide-react'
import Link from 'next/link'

// ─── Mapbox GL (dynamic import to avoid SSR) ──────────

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

// Manhattan center
const MAP_CENTER: [number, number] = [-73.9857, 40.7484]
const MAP_ZOOM = 12.5

// ─── Types ─────────────────────────────────────────────

interface HeatmapPoint {
  lng: number
  lat: number
  intensity: number
  side: string
  timestamp: number
}

interface PulseStats {
  marketName: string
  conditionId: string
  teamA: { name: string; pct: number; price: number }
  teamB: { name: string; pct: number; price: number }
  activeTraders: number
  totalVolume: number
  spikeIndicator: number
  globalComparison: string
}

// ─── Mapbox Heatmap ────────────────────────────────────

function MapboxHeatmap({
  points,
  onMapReady,
}: {
  points: HeatmapPoint[]
  onMapReady?: (map: mapboxgl.Map) => void
}) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    if (!MAPBOX_TOKEN) return

    // Dynamic import to avoid SSR issues (CSS loaded via layout.tsx)
    import('mapbox-gl').then((mapboxgl) => {
      mapboxgl.default.accessToken = MAPBOX_TOKEN

      const map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: MAP_CENTER,
        zoom: MAP_ZOOM,
        pitch: 0,
        bearing: 0,
        interactive: true,
        attributionControl: false,
      })

      // Disable rotation for cleaner demo look
      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()

      map.on('load', () => {
        // Add empty source for heatmap data
        map.addSource('pulse-heat', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })

        // Heatmap layer - thermal vision style
        map.addLayer({
          id: 'pulse-heatmap',
          type: 'heatmap',
          source: 'pulse-heat',
          paint: {
            // Weight based on intensity property
            'heatmap-weight': ['get', 'intensity'],
            // Increase intensity with zoom
            'heatmap-intensity': [
              'interpolate', ['linear'], ['zoom'],
              10, 0.8,
              13, 1.5,
              16, 2.5,
            ],
            // Radius grows with zoom
            'heatmap-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 15,
              13, 30,
              16, 50,
            ],
            // Thermal color ramp: transparent -> blue -> purple -> red -> orange -> yellow
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0, 0, 0, 0)',
              0.1, 'rgba(15, 25, 80, 0.4)',
              0.25, 'rgba(50, 20, 140, 0.6)',
              0.4, 'rgba(131, 110, 249, 0.7)',   // #836EF9 brand purple
              0.55, 'rgba(180, 40, 60, 0.8)',
              0.7, 'rgba(220, 100, 20, 0.85)',
              0.85, 'rgba(255, 180, 30, 0.9)',
              1.0, 'rgba(255, 240, 80, 0.95)',
            ],
            // Full opacity at all zoom levels
            'heatmap-opacity': 0.85,
          },
        })

        mapRef.current = map
        setMapLoaded(true)
        onMapReady?.(map)
      })
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update heatmap data when points change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const source = mapRef.current.getSource('pulse-heat') as mapboxgl.GeoJSONSource
    if (!source) return

    const features = points.map((p) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [p.lng, p.lat],
      },
      properties: {
        intensity: p.intensity,
        side: p.side,
      },
    }))

    source.setData({
      type: 'FeatureCollection',
      features,
    })
  }, [points, mapLoaded])

  // No token fallback
  if (!MAPBOX_TOKEN) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <div className="text-center px-6">
          <Radio className="w-8 h-8 text-[#836EF9]/30 mx-auto mb-3" />
          <div className="text-[11px] font-mono text-white/30 tracking-wide mb-2">
            MAPBOX TOKEN REQUIRED
          </div>
          <div className="text-[10px] font-mono text-white/15 max-w-xs">
            Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      {/* Vignette overlay for cinematic edges */}
      <div
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </>
  )
}

// ─── Scan Line Animation ───────────────────────────────

function ScanLine({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[15]">
      <div
        className="absolute left-0 right-0 h-[2px] animate-scan"
        style={{
          background: 'linear-gradient(to right, transparent, rgba(131,110,249,0.5), transparent)',
          boxShadow: '0 0 20px 4px rgba(131,110,249,0.3)',
        }}
      />
    </div>
  )
}

// ─── Privacy Badge ─────────────────────────────────────

function PulsePrivacyBadge() {
  return (
    <div className="absolute top-16 left-3 md:left-6 z-20">
      <div className="flex items-center gap-2 px-3 py-1.5 backdrop-blur-md bg-black/40 border border-white/[0.06]">
        <Shield className="w-3 h-3 text-emerald-500" />
        <span className="text-[9px] font-mono text-emerald-500/80 tracking-[1.5px] uppercase">
          Encrypted by Unlink
        </span>
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
      </div>
    </div>
  )
}

// ─── Stats Panel ───────────────────────────────────────

function PulseStatsPanel({ stats }: { stats: PulseStats | null }) {
  if (!stats) return null

  const isSpiking = stats.spikeIndicator > 2.0

  return (
    <div className="absolute bottom-3 left-3 right-3 md:bottom-6 md:left-6 md:right-6 z-20">
      <div className="backdrop-blur-xl bg-black/50 border border-white/[0.08] p-4 md:p-5">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[9px] font-mono tracking-[2px] text-white/25 mb-0.5">
              PULSE MARKET
            </div>
            <div className="text-[17px] md:text-[20px] font-bold tracking-tight text-white">
              {stats.marketName}
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <div className="flex items-center gap-1.5 justify-end">
              <Users className="w-3 h-3 text-white/30" />
              <span className="text-[22px] font-bold font-mono tabular-nums text-white leading-none">
                {stats.activeTraders.toLocaleString()}
              </span>
            </div>
            <div className="text-[8px] font-mono text-white/25 tracking-[1.5px] mt-0.5">
              ACTIVE TRADERS
            </div>
          </div>
        </div>

        {/* Flow bar */}
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="text-[11px] font-bold text-[#836EF9] font-mono">
              {stats.teamA.name} {stats.teamA.pct}%
            </span>
            <span className="text-[11px] font-bold text-[#FF3B30] font-mono">
              {stats.teamB.pct}% {stats.teamB.name}
            </span>
          </div>
          <div className="h-1 bg-white/[0.06] flex overflow-hidden">
            <div
              className="bg-[#836EF9] transition-all duration-1000 ease-out"
              style={{ width: `${stats.teamA.pct}%` }}
            />
            <div
              className="bg-[#FF3B30] transition-all duration-1000 ease-out"
              style={{ width: `${stats.teamB.pct}%` }}
            />
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex items-center gap-4 md:gap-6 flex-wrap">
          <div>
            <div className="text-[8px] font-mono text-white/25 tracking-[1.5px]">VOLUME</div>
            <div className="text-[14px] font-bold font-mono tabular-nums text-white">
              ${stats.totalVolume.toLocaleString()}
            </div>
          </div>

          {isSpiking && (
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <div>
                <div className="text-[8px] font-mono text-amber-400/70 tracking-[1.5px]">SPIKE</div>
                <div className="text-[13px] font-bold font-mono tabular-nums text-amber-400">
                  {stats.spikeIndicator.toFixed(1)}x
                </div>
              </div>
            </div>
          )}

          <div className="hidden md:block flex-1 text-right">
            <div className="text-[10px] text-white/25 font-mono leading-relaxed">
              {stats.globalComparison}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Trade Buttons ─────────────────────────────────────

function PulseTradeButtons({
  stats,
  isConnected,
  isConnecting,
  connect,
  userLocation,
}: {
  stats: PulseStats | null
  isConnected: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  userLocation: { lat: number; lng: number } | null
}) {
  if (!stats) return null

  // Build trade URL with optional geo data
  const buildTradeUrl = (side: string) => {
    const params = new URLSearchParams({ side })
    if (userLocation) {
      params.set('lat', userLocation.lat.toFixed(4))
      params.set('lng', userLocation.lng.toFixed(4))
    }
    return `/predict?${params.toString()}`
  }

  if (!isConnected) {
    return (
      <div className="absolute bottom-[140px] md:bottom-[130px] left-3 right-3 md:left-auto md:right-6 md:w-auto z-20">
        <button
          onClick={connect}
          disabled={isConnecting}
          className="w-full md:w-auto px-6 py-3 bg-white text-black text-[12px] font-bold tracking-wide
                     hover:bg-white/90 transition-all active:scale-[0.97] flex items-center justify-center gap-2
                     disabled:opacity-50"
        >
          {isConnecting ? (
            <Activity className="w-4 h-4 animate-spin" />
          ) : (
            <Wallet className="w-4 h-4" />
          )}
          {isConnecting ? 'CONNECTING...' : 'CONNECT WALLET TO TRADE'}
        </button>
      </div>
    )
  }

  return (
    <div className="absolute bottom-[140px] md:bottom-[130px] left-3 right-3 md:left-auto md:right-6 z-20
                    flex flex-col md:flex-row gap-2">
      <Link
        href={buildTradeUrl('yes')}
        className="flex-1 md:flex-none px-5 py-2.5 bg-[#836EF9] text-white text-[12px] font-bold tracking-wide
                   hover:bg-[#836EF9]/80 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
      >
        <TrendingUp className="w-3.5 h-3.5" />
        TRADE {stats.teamA.name} @ {stats.teamA.price.toFixed(2)}
      </Link>
      <Link
        href={buildTradeUrl('no')}
        className="flex-1 md:flex-none px-5 py-2.5 bg-[#FF3B30] text-white text-[12px] font-bold tracking-wide
                   hover:bg-[#FF3B30]/80 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
      >
        <TrendingUp className="w-3.5 h-3.5" />
        TRADE {stats.teamB.name} @ {stats.teamB.price.toFixed(2)}
      </Link>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────

export default function PulsePage() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWeb3()
  const [points, setPoints] = useState<HeatmapPoint[]>([])
  const [stats, setStats] = useState<PulseStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [scanActive, setScanActive] = useState(false)
  const prevPointCount = useRef(0)
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null)

  // ── User geolocation ──
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')
  const geoRequested = useRef(false)

  // Request geolocation once map is ready → fly to user
  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    mapInstanceRef.current = map

    if (geoRequested.current) return
    geoRequested.current = true

    if (!navigator.geolocation) {
      setGeoStatus('denied')
      return
    }

    setGeoStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setUserLocation({ lat, lng })
        setGeoStatus('granted')

        // Smooth fly to user location with higher zoom
        map.flyTo({
          center: [lng, lat],
          zoom: 14.5,
          duration: 2500,
          essential: true,
        })
      },
      () => {
        // Permission denied or error — stay on Manhattan
        setGeoStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    )
  }, [])

  // Poll heatmap data every 5 seconds
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/pulse/heatmap')
      if (res.ok) {
        const data = await res.json()
        setPoints(data.points)
        setStats(data.stats)
        setIsLoading(false)
      }
    } catch (err) {
      console.error('[Pulse] Fetch failed:', err)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Trigger scan-line on new points
  useEffect(() => {
    if (points.length > prevPointCount.current && prevPointCount.current > 0) {
      setScanActive(true)
      const timer = setTimeout(() => setScanActive(false), 2000)
      prevPointCount.current = points.length
      return () => clearTimeout(timer)
    }
    prevPointCount.current = points.length
  }, [points.length])

  return (
    <div className="h-dvh bg-black text-white flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="border-b border-white/[0.06] bg-black/80 backdrop-blur-sm flex-shrink-0 z-30 relative">
        <div className="px-3 md:px-6 flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-5 h-5 border border-white/20 flex items-center justify-center group-hover:border-white/40 transition-colors">
                <span className="text-[7px] font-bold tracking-tight">BW</span>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-[#836EF9]" />
              <span className="text-[14px] font-bold tracking-tight text-white">
                PULSE
              </span>
              <div className="flex items-center gap-1.5 ml-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-mono text-emerald-500/80 tracking-[1.5px]">
                  LIVE
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <span className="text-[10px] text-white/30 font-mono hidden sm:block">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <button
                  onClick={disconnect}
                  className="p-2 border border-white/[0.08] hover:border-white/20 transition-colors"
                  title="Disconnect wallet"
                >
                  <LogOut className="w-3 h-3 text-white/40" />
                </button>
              </>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="px-3 py-1.5 bg-white text-black text-[11px] font-semibold
                           hover:bg-white/90 transition-colors active:scale-[0.97]
                           flex items-center gap-1.5 disabled:opacity-50"
              >
                <Wallet className="w-3 h-3" />
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Map + Heatmap + Overlays ── */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Radio className="w-8 h-8 text-[#836EF9]/30" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-[#836EF9] rounded-full animate-pulse" />
                </div>
              </div>
              <span className="text-[10px] font-mono text-white/20 tracking-[3px]">
                INITIALIZING PULSE
              </span>
            </div>
          </div>
        ) : (
          <>
            <MapboxHeatmap points={points} onMapReady={handleMapReady} />
            <ScanLine active={scanActive} />
            <PulsePrivacyBadge />
            <PulseTradeButtons
              stats={stats}
              isConnected={isConnected}
              isConnecting={isConnecting}
              connect={connect}
              userLocation={userLocation}
            />
            <PulseStatsPanel stats={stats} />

            {/* Top-right: signal counter + geo status */}
            <div className="absolute top-16 right-3 md:right-6 z-20 flex flex-col gap-2 items-end">
              <div className="flex items-center gap-2 px-3 py-1.5 backdrop-blur-md bg-black/40 border border-white/[0.06]">
                <Activity className="w-3 h-3 text-[#836EF9]/60" />
                <span className="text-[10px] font-mono text-white/30 tabular-nums">
                  {points.length} signals
                </span>
              </div>
              {geoStatus === 'granted' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 backdrop-blur-md bg-black/40 border border-white/[0.06]">
                  <MapPin className="w-3 h-3 text-emerald-500/60" />
                  <span className="text-[9px] font-mono text-emerald-500/50 tracking-wider">
                    YOUR AREA
                  </span>
                </div>
              )}
              {geoStatus === 'requesting' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 backdrop-blur-md bg-black/40 border border-white/[0.06]">
                  <MapPin className="w-3 h-3 text-white/20 animate-pulse" />
                  <span className="text-[9px] font-mono text-white/20 tracking-wider">
                    LOCATING...
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
