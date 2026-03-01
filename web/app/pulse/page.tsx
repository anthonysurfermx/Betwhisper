'use client'

import { useWeb3 } from '@/components/web3-provider'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Wallet, LogOut, Shield, Zap, TrendingUp,
  Users, Activity, Radio, MapPin, Eye, EyeOff,
  Clock, Crosshair, Navigation, X
} from 'lucide-react'
import Link from 'next/link'
import { usePulseStream } from '@/hooks/use-pulse-stream'
import { useSounds } from '@/hooks/use-sounds'

// ─── Mapbox GL (dynamic import to avoid SSR) ──────────

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

// Manhattan center
const MAP_CENTER: [number, number] = [-73.9857, 40.7484]
const MAP_ZOOM = 12.5

const AMOUNT_MIDPOINT: Record<string, number> = { '1-10': 5, '10-50': 30, '50-100': 75, '100+': 150 }

// Neighborhood hotspot labels
const HOTSPOT_LABELS = [
  { lat: 40.7505, lng: -73.9934, label: 'MSG', icon: '🏟️', minZoom: 12 },
  { lat: 40.7420, lng: -73.9918, label: 'HACKATHON', icon: '⚡', minZoom: 13 },
  { lat: 40.7410, lng: -73.9897, label: 'FLATIRON', icon: '', minZoom: 13.5 },
  { lat: 40.7440, lng: -73.9937, label: 'CHELSEA', icon: '', minZoom: 13.5 },
  { lat: 40.7359, lng: -73.9911, label: 'UNION SQ', icon: '', minZoom: 13.5 },
  { lat: 40.7580, lng: -73.9855, label: 'TIMES SQ', icon: '', minZoom: 13 },
  { lat: 40.7484, lng: -73.9857, label: 'PENN STN', icon: '', minZoom: 13.5 },
]

// ─── Types ─────────────────────────────────────────────

interface HeatmapPoint {
  lng: number
  lat: number
  intensity: number
  side: string
  timestamp: number
  executionMode?: 'direct' | 'unlink'
  marketName?: string
  walletHash?: string
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
  zkPrivateCount: number
  zkPrivatePct: number
}

// ─── Mapbox Heatmap ────────────────────────────────────

function MapboxHeatmap({
  points,
  onMapReady,
  onPointClick,
}: {
  points: HeatmapPoint[]
  onMapReady?: (map: mapboxgl.Map) => void
  onPointClick?: (point: HeatmapPoint, screenPos: { x: number; y: number }) => void
}) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    if (!MAPBOX_TOKEN) return

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

      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()

      map.on('load', () => {
        // Heatmap thermal layer (background glow)
        map.addSource('pulse-heat', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })

        map.addLayer({
          id: 'pulse-heatmap',
          type: 'heatmap',
          source: 'pulse-heat',
          paint: {
            'heatmap-weight': ['get', 'intensity'],
            'heatmap-intensity': [
              'interpolate', ['linear'], ['zoom'],
              10, 0.8, 13, 1.5, 16, 2.5,
            ],
            'heatmap-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 15, 13, 30, 16, 50,
            ],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0, 0, 0, 0)',
              0.1, 'rgba(15, 25, 80, 0.4)',
              0.25, 'rgba(50, 20, 140, 0.6)',
              0.4, 'rgba(131, 110, 249, 0.7)',
              0.55, 'rgba(180, 40, 60, 0.8)',
              0.7, 'rgba(220, 100, 20, 0.85)',
              0.85, 'rgba(255, 180, 30, 0.9)',
              1.0, 'rgba(255, 240, 80, 0.95)',
            ],
            'heatmap-opacity': 0.6,
          },
        })

        // Clickable circle layer for direct trades — colored by side
        map.addSource('pulse-circles', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })

        map.addLayer({
          id: 'pulse-circles-glow',
          type: 'circle',
          source: 'pulse-circles',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 13, 16, 16, 28],
            'circle-color': [
              'case',
              ['==', ['get', 'side'], 'No'], 'rgba(255, 59, 48, 0.15)',
              'rgba(16, 185, 129, 0.15)',
            ],
            'circle-blur': 1,
          },
        })

        map.addLayer({
          id: 'pulse-circles-core',
          type: 'circle',
          source: 'pulse-circles',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 13, 6, 16, 10],
            'circle-color': [
              'case',
              ['==', ['get', 'side'], 'No'], 'rgba(255, 59, 48, 0.8)',
              'rgba(16, 185, 129, 0.8)',
            ],
            'circle-blur': 0.3,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': [
              'case',
              ['==', ['get', 'side'], 'No'], 'rgba(255, 59, 48, 0.4)',
              'rgba(16, 185, 129, 0.4)',
            ],
          },
        })

        // ZK Privacy layer
        map.addSource('pulse-zk', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })

        map.addLayer({
          id: 'pulse-zk-glow',
          type: 'circle',
          source: 'pulse-zk',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 13, 22, 16, 40],
            'circle-color': 'rgba(131, 110, 249, 0.15)',
            'circle-blur': 1,
          },
        })

        map.addLayer({
          id: 'pulse-zk-core',
          type: 'circle',
          source: 'pulse-zk',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 13, 8, 16, 14],
            'circle-color': [
              'interpolate', ['linear'], ['get', 'intensity'],
              0.3, 'rgba(131, 110, 249, 0.6)',
              0.7, 'rgba(167, 130, 255, 0.8)',
              1.0, 'rgba(200, 180, 255, 0.95)',
            ],
            'circle-blur': 0.4,
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(131, 110, 249, 0.3)',
          },
        })

        // Click handler for trade circles
        map.on('click', 'pulse-circles-core', (e) => {
          if (!e.features?.[0]) return
          const props = e.features[0].properties
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates
          if (props && onPointClick) {
            onPointClick({
              lat: coords[1], lng: coords[0],
              intensity: props.intensity || 0.5,
              side: props.side || 'Yes',
              timestamp: props.timestamp || Date.now(),
              marketName: props.marketName || '',
              walletHash: props.walletHash || 'anon',
            }, { x: e.point.x, y: e.point.y })
          }
        })

        map.on('click', 'pulse-zk-core', (e) => {
          if (!e.features?.[0]) return
          const props = e.features[0].properties
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates
          if (props && onPointClick) {
            onPointClick({
              lat: coords[1], lng: coords[0],
              intensity: props.intensity || 0.5,
              side: props.side || 'Yes',
              timestamp: props.timestamp || Date.now(),
              executionMode: 'unlink',
              marketName: props.marketName || '',
              walletHash: props.walletHash || 'anon',
            }, { x: e.point.x, y: e.point.y })
          }
        })

        // Pointer cursor on hover
        map.on('mouseenter', 'pulse-circles-core', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'pulse-circles-core', () => { map.getCanvas().style.cursor = '' })
        map.on('mouseenter', 'pulse-zk-core', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'pulse-zk-core', () => { map.getCanvas().style.cursor = '' })

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

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const directPoints = points.filter(p => p.executionMode !== 'unlink')
    const zkPoints = points.filter(p => p.executionMode === 'unlink')

    const makeFeatures = (pts: HeatmapPoint[]) => pts.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      properties: {
        intensity: p.intensity,
        side: p.side,
        timestamp: p.timestamp,
        marketName: p.marketName || '',
        walletHash: p.walletHash || 'anon',
      },
    }))

    const heatSource = mapRef.current.getSource('pulse-heat') as mapboxgl.GeoJSONSource
    if (heatSource) {
      heatSource.setData({ type: 'FeatureCollection', features: makeFeatures(directPoints) })
    }

    const circleSource = mapRef.current.getSource('pulse-circles') as mapboxgl.GeoJSONSource
    if (circleSource) {
      circleSource.setData({ type: 'FeatureCollection', features: makeFeatures(directPoints) })
    }

    const zkSource = mapRef.current.getSource('pulse-zk') as mapboxgl.GeoJSONSource
    if (zkSource) {
      zkSource.setData({ type: 'FeatureCollection', features: makeFeatures(zkPoints) })
    }
  }, [points, mapLoaded])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <div className="text-center px-6">
          <Radio className="w-8 h-8 text-[#836EF9]/30 mx-auto mb-3" />
          <div className="text-[11px] font-mono text-white/30 tracking-wide mb-2">
            MAPBOX TOKEN REQUIRED
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
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

// ─── Live Trade Popup ("+$1 USD" floating on map) ──────

interface TradePopup {
  id: number
  lat: number
  lng: number
  amount: string
  side: string
  isZk: boolean
  isWhale: boolean
}

function LiveTradePopups({
  popups,
  map,
}: {
  popups: TradePopup[]
  map: mapboxgl.Map | null
}) {
  const [positioned, setPositioned] = useState<(TradePopup & { x: number; y: number })[]>([])

  useEffect(() => {
    if (!map || popups.length === 0) {
      setPositioned([])
      return
    }

    const result = popups.map((p) => {
      const point = map.project([p.lng, p.lat])
      return { ...p, x: point.x, y: point.y }
    }).filter((p) => p.x > 0 && p.y > 0 && p.x < window.innerWidth && p.y < window.innerHeight)

    setPositioned(result)
  }, [popups, map])

  return (
    <div className="absolute inset-0 pointer-events-none z-[25] overflow-hidden">
      {positioned.map((popup) => (
        <div key={popup.id}>
          {/* Ripple ring at trade location */}
          <div className="absolute" style={{ left: popup.x, top: popup.y }}>
            <div className={popup.isZk ? 'animate-trade-ripple-zk' : 'animate-trade-ripple'} />
          </div>

          {/* Whale sonar — big expanding rings for $50+ */}
          {popup.isWhale && (
            <div className="absolute" style={{ left: popup.x, top: popup.y }}>
              <div className="animate-sonar-ring" style={{ animationDelay: '0s' }} />
              <div className="animate-sonar-ring" style={{ animationDelay: '0.4s' }} />
              <div className="animate-sonar-ring" style={{ animationDelay: '0.8s' }} />
            </div>
          )}

          {/* Floating "+$X" label */}
          <div
            className="absolute animate-trade-popup"
            style={{ left: popup.x, top: popup.y, transform: 'translate(-50%, -50%)' }}
          >
            <div className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md whitespace-nowrap
              ${popup.isWhale ? 'px-4 py-2' : ''}
              ${popup.isZk
                ? 'bg-emerald-500/20 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'bg-[#836EF9]/20 border border-[#836EF9]/30 shadow-[0_0_15px_rgba(131,110,249,0.3)]'
              }
            `}>
              {popup.isZk && <Shield className="w-3 h-3 text-emerald-400" />}
              <span className={`
                font-bold font-mono tabular-nums
                ${popup.isWhale ? 'text-[18px]' : 'text-[14px]'}
                ${popup.isZk ? 'text-emerald-300' : 'text-white'}
              `}>
                +${popup.amount}
              </span>
              <span className={`text-[10px] font-mono font-semibold ${popup.side === 'Yes' ? 'text-[#836EF9]' : 'text-[#FF3B30]'}`}>
                {popup.side.toUpperCase()}
              </span>
              {popup.isWhale && (
                <span className="text-[9px] font-mono text-amber-400 font-bold ml-1">WHALE</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Live Trade Feed (scrolling ticker) ────────────────

interface FeedItem {
  id: number
  amount: number
  side: string
  isZk: boolean
  timestamp: number
}

function LiveTradeFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="absolute top-16 left-3 right-3 md:left-auto md:right-6 md:w-[280px] z-20">
      <div className="backdrop-blur-md bg-black/50 border border-white/[0.06] overflow-hidden">
        <div className="px-3 py-1.5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-[#836EF9]/60" />
            <span className="text-[8px] font-mono tracking-[2px] text-white/30">LIVE FEED</span>
          </div>
          <span className="text-[8px] font-mono text-white/20 tabular-nums">{items.length} trades</span>
        </div>
        <div className="max-h-[160px] overflow-hidden">
          {items.slice(0, 6).map((item, i) => {
            const ago = Math.max(1, Math.floor((Date.now() - item.timestamp) / 1000))
            const agoStr = ago < 60 ? `${ago}s` : `${Math.floor(ago / 60)}m`
            return (
              <div
                key={item.id}
                className={`
                  flex items-center justify-between px-3 py-1.5 border-b border-white/[0.03]
                  ${i === 0 ? 'animate-feed-slide-in bg-white/[0.03]' : ''}
                `}
              >
                <div className="flex items-center gap-2">
                  {item.isZk ? (
                    <Shield className="w-3 h-3 text-emerald-500/60" />
                  ) : (
                    <div className={`w-1.5 h-1.5 rounded-full ${item.side === 'Yes' ? 'bg-[#836EF9]' : 'bg-[#FF3B30]'}`} />
                  )}
                  <span className="text-[11px] font-mono font-bold text-white tabular-nums">
                    ${item.amount}
                  </span>
                  <span className={`text-[9px] font-mono font-semibold ${item.side === 'Yes' ? 'text-[#836EF9]' : 'text-[#FF3B30]'}`}>
                    {item.side.toUpperCase()}
                  </span>
                  {item.isZk && (
                    <span className="text-[8px] font-mono text-emerald-500/50">ZK</span>
                  )}
                </div>
                <span className="text-[9px] font-mono text-white/15 tabular-nums">{agoStr}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Map Legend ────────────────────────────────────────

function MapLegend({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div className="absolute bottom-[140px] md:bottom-[130px] left-3 md:left-6 z-20">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 px-2.5 py-1.5 backdrop-blur-md bg-black/40 border border-white/[0.06]
                   hover:border-white/[0.12] transition-colors mb-2"
      >
        {visible ? <EyeOff className="w-3 h-3 text-white/30" /> : <Eye className="w-3 h-3 text-white/30" />}
        <span className="text-[8px] font-mono text-white/30 tracking-[1.5px]">LEGEND</span>
      </button>

      {visible && (
        <div className="backdrop-blur-md bg-black/60 border border-white/[0.06] p-3 animate-scale-in">
          <div className="space-y-2">
            {/* Thermal heatmap */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm" style={{
                background: 'linear-gradient(to right, rgba(50,20,140,0.8), rgba(220,100,20,0.9), rgba(255,240,80,0.95))'
              }} />
              <span className="text-[9px] font-mono text-white/40">Public trades (on-chain)</span>
            </div>
            {/* ZK circles */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-full bg-emerald-500/40 border border-emerald-500/30" />
              <span className="text-[9px] font-mono text-white/40">ZK private (Unlink)</span>
            </div>
            {/* Intensity */}
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                <div className="w-1 h-3 bg-white/10 rounded-sm" />
                <div className="w-1 h-3 bg-white/25 rounded-sm" />
                <div className="w-1 h-3 bg-white/50 rounded-sm" />
                <div className="w-1 h-3 bg-white/80 rounded-sm" />
              </div>
              <span className="text-[9px] font-mono text-white/40">Intensity = bet size</span>
            </div>
            {/* Ripple */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full border border-[#836EF9]/40 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-[#836EF9]/60" />
                </div>
              </div>
              <span className="text-[9px] font-mono text-white/40">Live trade (real-time)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Whale Alert Overlay ──────────────────────────────

function WhaleAlert({ active, amount, side, isZk }: { active: boolean; amount: number; side: string; isZk: boolean }) {
  if (!active) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-[30] flex items-center justify-center animate-sonar-overlay">
      <div className="flex flex-col items-center gap-2">
        <div className="text-[10px] font-mono tracking-[4px] text-amber-400/80 animate-sonar-text">
          WHALE ALERT
        </div>
        <div className={`
          text-[36px] md:text-[48px] font-bold font-mono tabular-nums animate-sonar-dot
          ${isZk ? 'text-emerald-400' : 'text-white'}
        `}
          style={{ textShadow: isZk ? '0 0 30px rgba(16,185,129,0.5)' : '0 0 30px rgba(131,110,249,0.5)' }}
        >
          +${amount}
        </div>
        <div className="flex items-center gap-2 animate-sonar-text" style={{ animationDelay: '0.3s' }}>
          <span className={`text-[14px] font-bold font-mono ${side === 'Yes' ? 'text-[#836EF9]' : 'text-[#FF3B30]'}`}>
            {side.toUpperCase()}
          </span>
          {isZk && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Shield className="w-4 h-4" />
              <span className="text-[10px] font-mono tracking-wider">PRIVATE</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Trade Info Popup (click on point) ────────────────

interface TradeInfoPopupData {
  point: HeatmapPoint
  screenPos: { x: number; y: number }
}

function TradeInfoPopup({ data, onClose, onFlyTo, map }: {
  data: TradeInfoPopupData | null
  onClose: () => void
  onFlyTo: (lat: number, lng: number) => void
  map: mapboxgl.Map | null
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!data || !map) { setPos(null); return }
    const update = () => {
      const pt = map.project([data.point.lng, data.point.lat])
      setPos({ x: pt.x, y: pt.y })
    }
    update()
    map.on('move', update)
    return () => { map.off('move', update) }
  }, [data, map])

  if (!data || !pos) return null

  const isZk = data.point.executionMode === 'unlink'
  const ago = Math.max(1, Math.floor((Date.now() - data.point.timestamp) / 1000))
  const agoStr = ago < 60 ? `${ago}s ago` : ago < 3600 ? `${Math.floor(ago / 60)}m ago` : `${Math.floor(ago / 3600)}h ago`
  const wallet = data.point.walletHash || 'anon'
  const walletDisplay = wallet.startsWith('0x') ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : wallet.slice(0, 8)

  return (
    <div className="absolute inset-0 pointer-events-none z-[35] overflow-hidden">
      <div
        className="absolute pointer-events-auto animate-scale-in"
        style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, calc(-100% - 16px))' }}
      >
        <div className={`backdrop-blur-xl bg-black/80 border p-3 min-w-[200px] ${
          isZk ? 'border-[#836EF9]/30' : data.point.side === 'No' ? 'border-red-500/30' : 'border-emerald-500/30'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              {isZk && <Shield className="w-3 h-3 text-[#836EF9]" />}
              <span className={`text-[11px] font-bold font-mono ${
                data.point.side === 'No' ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {data.point.side.toUpperCase()}
              </span>
              {isZk && <span className="text-[8px] font-mono text-[#836EF9]/60 px-1 border border-[#836EF9]/20">ZK</span>}
            </div>
            <button onClick={onClose} className="p-0.5 hover:bg-white/10 transition-colors">
              <X className="w-3 h-3 text-white/30" />
            </button>
          </div>
          {data.point.marketName && (
            <div className="text-[10px] font-mono text-white/60 mb-1.5 leading-tight">
              {data.point.marketName}
            </div>
          )}
          <div className="flex items-center gap-3 text-[9px] font-mono text-white/25">
            <span>{agoStr}</span>
            <span>{walletDisplay}</span>
          </div>
          <button
            onClick={() => onFlyTo(data.point.lat, data.point.lng)}
            className="mt-2 w-full py-1 text-[8px] font-mono tracking-[1px] text-white/30 border border-white/[0.06]
                       hover:bg-white/[0.04] hover:text-white/50 transition-colors flex items-center justify-center gap-1"
          >
            <Crosshair className="w-2.5 h-2.5" /> ZOOM IN
          </button>
        </div>
        {/* Arrow pointing down */}
        <div className="flex justify-center">
          <div className="w-2 h-2 bg-black/80 border-r border-b border-white/10 rotate-45 -mt-1" />
        </div>
      </div>
    </div>
  )
}

// ─── Compass / Recenter Button ──────────────────────

function CompassButton({ map, userLocation }: { map: mapboxgl.Map | null; userLocation: { lat: number; lng: number } | null }) {
  const handleRecenter = () => {
    if (!map) return
    const target = userLocation || { lat: MAP_CENTER[1], lng: MAP_CENTER[0] }
    map.flyTo({
      center: [target.lng, target.lat],
      zoom: 15,
      duration: 1500,
      essential: true,
    })
  }

  return (
    <button
      onClick={handleRecenter}
      className="absolute bottom-[200px] md:bottom-[190px] right-3 md:right-6 z-20
                 w-10 h-10 backdrop-blur-md bg-black/50 border border-white/[0.08]
                 hover:border-white/20 hover:bg-black/70 transition-all
                 flex items-center justify-center active:scale-95"
      title="Recenter map"
    >
      <Navigation className="w-4 h-4 text-white/50" />
    </button>
  )
}

// ─── Twitch-style Live Trade Overlay ─────────────────

function LiveTradeOverlay({ items }: { items: LiveOverlayItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="absolute top-[120px] left-3 md:left-6 z-[22] pointer-events-none max-w-[320px]">
      <div className="space-y-1">
        {items.slice(0, 5).map((item, i) => (
          <div
            key={item.id}
            className={`flex items-center gap-2 px-3 py-1.5 backdrop-blur-sm bg-black/30 border border-white/[0.04]
                        ${i === 0 ? 'animate-feed-slide-in' : ''}`}
            style={{ opacity: 1 - i * 0.15 }}
          >
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              item.side === 'No' ? 'bg-red-500' : 'bg-emerald-500'
            }`} />
            <span className="text-[10px] font-mono text-white/40">
              {item.walletHash}
            </span>
            <span className="text-[10px] font-mono text-white/60 font-bold">
              {item.side.toUpperCase()}
            </span>
            {item.marketName && (
              <span className="text-[9px] font-mono text-white/20 truncate">
                {item.marketName}
              </span>
            )}
            {item.isZk && <Shield className="w-2.5 h-2.5 text-[#836EF9]/50 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  )
}

interface LiveOverlayItem {
  id: number
  walletHash: string
  side: string
  marketName: string
  isZk: boolean
  timestamp: number
}

// ─── Neighborhood Labels (zoom-based) ────────────────

function NeighborhoodLabels({ map }: { map: mapboxgl.Map | null }) {
  const [labels, setLabels] = useState<{ label: string; icon: string; x: number; y: number }[]>([])

  useEffect(() => {
    if (!map) return

    const update = () => {
      const zoom = map.getZoom()
      const visible = HOTSPOT_LABELS.filter(h => zoom >= h.minZoom).map(h => {
        const pt = map.project([h.lng, h.lat])
        return { label: h.label, icon: h.icon, x: pt.x, y: pt.y }
      }).filter(p => p.x > -50 && p.y > -50 && p.x < window.innerWidth + 50 && p.y < window.innerHeight + 50)
      setLabels(visible)
    }

    update()
    map.on('move', update)
    map.on('zoom', update)
    return () => { map.off('move', update); map.off('zoom', update) }
  }, [map])

  if (labels.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
      {labels.map((l, i) => (
        <div key={i} className="absolute animate-hood-label"
          style={{ left: l.x, top: l.y, transform: 'translate(-50%, -50%)' }}
        >
          <div className="flex items-center gap-1 px-2 py-0.5 backdrop-blur-sm bg-black/30 border border-white/[0.04]">
            {l.icon && <span className="text-[10px]">{l.icon}</span>}
            <span className="text-[8px] font-mono tracking-[2px] text-white/30 animate-cluster-pulse">
              {l.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── User Location Marker (radar sweep) ──────────────

function UserLocationMarker({ map, location }: { map: mapboxgl.Map | null; location: { lat: number; lng: number } | null }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!map || !location) { setPos(null); return }
    const update = () => {
      const pt = map.project([location.lng, location.lat])
      setPos({ x: pt.x, y: pt.y })
    }
    update()
    map.on('move', update)
    map.on('zoom', update)
    return () => { map.off('move', update); map.off('zoom', update) }
  }, [map, location])

  if (!pos) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-[20] overflow-hidden">
      <div className="absolute" style={{ left: pos.x, top: pos.y }}>
        {/* Radar ping rings */}
        <div className="animate-radar-ping" />
        <div className="animate-radar-ping" style={{ animationDelay: '1s' }} />
        {/* Radar sweep line */}
        <div className="absolute w-[40px] h-[1px] origin-left animate-radar-sweep"
          style={{
            top: '50%', left: '50%',
            background: 'linear-gradient(to right, rgba(131,110,249,0.8), transparent)',
          }}
        />
        {/* Center dot */}
        <div className="absolute w-3 h-3 rounded-full bg-[#836EF9] border-2 border-white shadow-[0_0_10px_rgba(131,110,249,0.6)]"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        />
        {/* Label */}
        <div className="absolute whitespace-nowrap"
          style={{ top: '50%', left: '50%', transform: 'translate(12px, -50%)' }}
        >
          <span className="text-[9px] font-mono text-[#836EF9] tracking-[1px] bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
            YOU
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Privacy Ratio Ring (donut SVG) ──────────────────

function PrivacyRing({ zkPct, zkCount, totalCount }: { zkPct: number; zkCount: number; totalCount: number }) {
  if (totalCount === 0) return null
  const radius = 25
  const circumference = 2 * Math.PI * radius
  const zkDash = (zkPct / 100) * circumference
  const publicDash = circumference - zkDash

  return (
    <div className="absolute top-16 right-3 md:right-auto md:left-[300px] z-20">
      <div className="backdrop-blur-md bg-black/50 border border-white/[0.06] p-3 flex items-center gap-3">
        <div className="relative w-[60px] h-[60px]">
          <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
            {/* Background circle */}
            <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
            {/* Public segment */}
            <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(131,110,249,0.5)" strokeWidth="5"
              strokeDasharray={`${publicDash} ${zkDash}`} strokeDashoffset="0"
              className="animate-ring-fill"
              style={{ strokeDashoffset: 0 }}
            />
            {/* ZK segment */}
            <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(16,185,129,0.7)" strokeWidth="5"
              strokeDasharray={`${zkDash} ${publicDash}`} strokeDashoffset={-publicDash}
              className="animate-ring-fill"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[13px] font-bold font-mono text-emerald-400 tabular-nums">{zkPct}%</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[8px] font-mono tracking-[2px] text-white/25">PRIVACY RATIO</div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-emerald-500/60 rounded-sm" />
            <span className="text-[9px] font-mono text-white/40">{zkCount} ZK private</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-[#836EF9]/50 rounded-sm" />
            <span className="text-[9px] font-mono text-white/40">{totalCount - zkCount} public</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Volume Ticker (animated number) ─────────────────

function VolumeTicker({ volume, prevVolume }: { volume: number; prevVolume: number }) {
  const changed = volume !== prevVolume && prevVolume > 0
  return (
    <span className={`${changed ? 'animate-vol-tick' : ''}`} key={volume}>
      ${volume.toLocaleString()}
    </span>
  )
}

// ─── Time Machine Slider ──────────────────────────────

function TimeMachineSlider({
  visible,
  onToggle,
  value,
  onChange,
}: {
  visible: boolean
  onToggle: () => void
  value: number // 0-100 (100 = now)
  onChange: (val: number) => void
}) {
  const minutes = Math.round((100 - value) * 1.2) // 0-120 min ago

  return (
    <div className="absolute bottom-[200px] md:bottom-[190px] left-3 right-3 md:left-6 md:right-6 z-20">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 px-2.5 py-1.5 backdrop-blur-md bg-black/40 border border-white/[0.06]
                   hover:border-white/[0.12] transition-colors mb-2"
      >
        <Clock className="w-3 h-3 text-white/30" />
        <span className="text-[8px] font-mono text-white/30 tracking-[1.5px]">TIME MACHINE</span>
      </button>

      {visible && (
        <div className="backdrop-blur-md bg-black/60 border border-white/[0.06] p-3 animate-scale-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono text-white/40">
              {minutes === 0 ? 'NOW' : `${minutes}m AGO`}
            </span>
            <span className="text-[9px] font-mono text-white/20">LIVE</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-1 appearance-none bg-white/[0.06] rounded-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                       [&::-webkit-slider-thumb]:bg-[#836EF9] [&::-webkit-slider-thumb]:border-none
                       [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(131,110,249,0.5)]"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[8px] font-mono text-white/15">2h ago</span>
            <span className="text-[8px] font-mono text-white/15">now</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Privacy Badge + Trade Counter ────────────────────

function PulsePrivacyBadge({ totalTrades, zkTrades }: { totalTrades: number; zkTrades: number }) {
  return (
    <div className="absolute top-16 left-3 md:left-6 z-20 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-3 py-1.5 backdrop-blur-md bg-black/40 border border-white/[0.06]">
        <Shield className="w-3 h-3 text-emerald-500" />
        <span className="text-[9px] font-mono text-emerald-500/80 tracking-[1.5px] uppercase">
          Encrypted by Unlink
        </span>
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
      </div>
      {totalTrades > 0 && (
        <div className="flex items-center gap-3 px-3 py-1.5 backdrop-blur-md bg-black/40 border border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-white/25" />
            <span className="text-[11px] font-bold font-mono tabular-nums text-white/60">{totalTrades}</span>
            <span className="text-[7px] font-mono text-white/20 tracking-[1px]">TRADES</span>
          </div>
          {zkTrades > 0 && (
            <>
              <div className="w-px h-3 bg-white/[0.08]" />
              <div className="flex items-center gap-1">
                <Shield className="w-2.5 h-2.5 text-emerald-500/50" />
                <span className="text-[10px] font-bold font-mono tabular-nums text-emerald-400/60">{zkTrades}</span>
                <span className="text-[7px] font-mono text-emerald-400/30 tracking-[1px]">ZK</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Stats Panel ───────────────────────────────────────

function PulseStatsPanel({ stats, sseConnected, liveTradeCount, prevVolume = 0 }: { stats: PulseStats | null; sseConnected?: boolean; liveTradeCount?: number; prevVolume?: number }) {
  if (!stats) return null

  const isSpiking = stats.spikeIndicator > 2.0

  return (
    <div className="absolute bottom-3 left-3 right-3 md:bottom-6 md:left-6 md:right-6 z-20">
      <div className="backdrop-blur-xl bg-black/50 border border-white/[0.08] p-4 md:p-5">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[9px] font-mono tracking-[2px] text-white/25">PULSE MARKET</span>
              {sseConnected && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] font-mono text-emerald-500 tracking-[1px]">LIVE</span>
                </span>
              )}
              {(liveTradeCount ?? 0) > 0 && (
                <span className="text-[8px] font-mono text-[#836EF9]/60 tabular-nums">
                  +{liveTradeCount} new
                </span>
              )}
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
          <div className="h-1.5 bg-white/[0.06] flex overflow-hidden">
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
              <VolumeTicker volume={stats.totalVolume} prevVolume={prevVolume} />
            </div>
          </div>

          {stats.zkPrivateCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <div>
                <div className="text-[8px] font-mono text-emerald-400/70 tracking-[1.5px]">ZK PRIVATE</div>
                <div className="text-[13px] font-bold font-mono tabular-nums text-emerald-400">
                  {stats.zkPrivatePct}%
                </div>
              </div>
            </div>
          )}

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

// ─── Market Stream + Order Book (right sidebar) ───────

interface StreamMarket {
  name: string
  emoji: string
  category: string
  yesPrice: number
  noPrice: number
  volume: string
  trend: number // -1, 0, 1
  orders: { price: number; size: number; side: 'bid' | 'ask' }[]
}

// Build order book around a price point
function buildOrders(yesPrice: number): StreamMarket['orders'] {
  const spread = Math.max(0.001, yesPrice * 0.02)
  return [
    { price: +(yesPrice + spread).toFixed(4), size: 1200, side: 'ask' as const },
    { price: +(yesPrice + spread * 2).toFixed(4), size: 800, side: 'ask' as const },
    { price: +(yesPrice + spread * 3).toFixed(4), size: 450, side: 'ask' as const },
    { price: +(yesPrice - spread).toFixed(4), size: 950, side: 'bid' as const },
    { price: +(yesPrice - spread * 2).toFixed(4), size: 1500, side: 'bid' as const },
    { price: +(yesPrice - spread * 3).toFixed(4), size: 2200, side: 'bid' as const },
  ]
}

const NYC_MARKETS: StreamMarket[] = [
  {
    name: 'Knicks Win NBA Finals',
    emoji: '🏀',
    category: 'SPORTS',
    yesPrice: 0.045,
    noPrice: 0.955,
    volume: '$2.6M',
    trend: 1,
    orders: buildOrders(0.045),
  },
  {
    name: 'Warsh Next Fed Chair',
    emoji: '🏛️',
    category: 'POLITICS',
    yesPrice: 0.93,
    noPrice: 0.07,
    volume: '$44.6M',
    trend: 1,
    orders: buildOrders(0.93),
  },
  {
    name: 'Fed Rate Cut by July',
    emoji: '📉',
    category: 'MACRO',
    yesPrice: 0.835,
    noPrice: 0.165,
    volume: '$18.2M',
    trend: -1,
    orders: buildOrders(0.835),
  },
]

function MiniOrderBook({ orders }: { orders: StreamMarket['orders'] }) {
  const asks = orders.filter(o => o.side === 'ask').sort((a, b) => a.price - b.price)
  const bids = orders.filter(o => o.side === 'bid').sort((a, b) => b.price - a.price)
  const maxSize = Math.max(...orders.map(o => o.size))

  return (
    <div className="space-y-0">
      {asks.map((o, i) => (
        <div key={`a${i}`} className="flex items-center gap-1 h-[14px] relative">
          <div className="absolute right-0 top-0 bottom-0 bg-red-500/[0.06] transition-all duration-700"
            style={{ width: `${(o.size / maxSize) * 100}%` }}
          />
          <span className="text-[8px] font-mono text-red-400/60 w-[36px] text-right tabular-nums relative z-10">
            {o.price.toFixed(3)}
          </span>
          <span className="text-[8px] font-mono text-white/20 tabular-nums relative z-10 transition-all duration-300">
            {o.size.toLocaleString()}
          </span>
        </div>
      ))}
      <div className="h-px bg-white/[0.06] my-0.5" />
      {bids.map((o, i) => (
        <div key={`b${i}`} className="flex items-center gap-1 h-[14px] relative">
          <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/[0.06] transition-all duration-700"
            style={{ width: `${(o.size / maxSize) * 100}%` }}
          />
          <span className="text-[8px] font-mono text-emerald-400/60 w-[36px] text-right tabular-nums relative z-10">
            {o.price.toFixed(3)}
          </span>
          <span className="text-[8px] font-mono text-white/20 tabular-nums relative z-10 transition-all duration-300">
            {o.size.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// Activity message templates (rotate through these)
const ACTIVITY_TEMPLATES = [
  [
    { text: 'Whale bought {size} YES', color: 'text-emerald-400/40' },
    { text: 'New limit: {size} @ {price}', color: 'text-white/20' },
    { text: 'Fill: {size} shares @ {price}', color: 'text-[#836EF9]/40' },
    { text: 'ZK trade: ${amount} YES', color: 'text-emerald-400/40' },
    { text: 'Market moved +{delta}%', color: 'text-amber-400/40' },
    { text: 'Fill: {size} shares @ {price}', color: 'text-[#836EF9]/40' },
    { text: 'Limit order: {size} NO @ {price}', color: 'text-red-400/40' },
    { text: 'Private transfer detected', color: 'text-emerald-400/40' },
    { text: '{size} shares matched', color: 'text-white/20' },
    { text: 'Whale sold {size} NO', color: 'text-red-400/40' },
    { text: 'ZK deposit: ${amount}', color: 'text-emerald-400/40' },
    { text: 'Order filled: {size} YES', color: 'text-[#836EF9]/40' },
  ],
]

function seededActivityRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

function generateActivity(tick: number, marketIdx: number): { ago: string; text: string; color: string }[] {
  const templates = ACTIVITY_TEMPLATES[0]
  const items: { ago: string; text: string; color: string }[] = []
  for (let i = 0; i < 6; i++) {
    const seed = tick * 31 + i * 137 + marketIdx * 73
    const t = templates[(tick + i + marketIdx * 3) % templates.length]
    const size = Math.floor(seededActivityRandom(seed) * 2000 + 100)
    const price = (seededActivityRandom(seed + 1) * 0.05 + 0.02).toFixed(3)
    const amount = Math.floor(seededActivityRandom(seed + 2) * 200 + 10)
    const delta = (seededActivityRandom(seed + 3) * 0.5 + 0.1).toFixed(1)
    const ago = `${Math.floor(i * 4 + seededActivityRandom(seed + 4) * 8) + 1}s`
    const text = t.text
      .replace('{size}', size.toLocaleString())
      .replace('{price}', price)
      .replace('{amount}', amount.toString())
      .replace('{delta}', delta)
    items.push({ ago, text, color: t.color })
  }
  return items
}

function MarketStreamPanel({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [prices, setPrices] = useState(NYC_MARKETS.map(m => m.yesPrice))
  const [orderSizes, setOrderSizes] = useState(NYC_MARKETS.map(m => m.orders.map(o => o.size)))
  const [activityItems, setActivityItems] = useState(generateActivity(0, 0))
  const [realPricesLoaded, setRealPricesLoaded] = useState(false)
  const tickRef = useRef(0)

  // Fetch REAL Polymarket prices every 15s
  useEffect(() => {
    if (!visible) return
    const fetchLive = () => {
      fetch('/api/markets/live')
        .then(r => r.json())
        .then(data => {
          if (data.markets?.length > 0) {
            setPrices(prev => {
              const next = [...prev]
              const slugMap: Record<string, number> = {
                knicks: 0,
                warsh: 1,
                'rate-cut': 2,
                'fed-rate': 2,
              }
              for (const m of data.markets as { slug: string; yesPrice: number }[]) {
                for (const [key, idx] of Object.entries(slugMap)) {
                  if (m.slug?.includes(key)) { next[idx] = m.yesPrice; break }
                }
              }
              return next
            })
            setRealPricesLoaded(true)
          }
        })
        .catch(() => {})
    }
    fetchLive()
    const interval = setInterval(fetchLive, 15_000)
    return () => clearInterval(interval)
  }, [visible])

  // Simulate live price + order book ticks
  useEffect(() => {
    if (!visible) return
    const interval = setInterval(() => {
      tickRef.current++
      const tick = tickRef.current

      // Price jitter
      setPrices(prev => prev.map((p, i) => {
        const seed = Math.sin(tick * 137 + i * 431) * 10000
        const jitter = (seed - Math.floor(seed) - 0.5) * 0.002
        return Math.max(0.01, Math.min(0.99, p + jitter))
      }))

      // Order book size jitter (makes bars animate)
      setOrderSizes(prev => prev.map((sizes, mi) =>
        sizes.map((s, si) => {
          const seed = Math.sin(tick * 251 + mi * 73 + si * 19) * 10000
          const jitter = Math.floor((seed - Math.floor(seed) - 0.5) * s * 0.15)
          return Math.max(50, s + jitter)
        })
      ))

      // Rotate activity feed every 3 ticks
      if (tick % 3 === 0) {
        setActivityItems(generateActivity(tick, selectedIdx))
      }
    }, 1800)
    return () => clearInterval(interval)
  }, [visible, selectedIdx])

  // Update activity when market changes
  useEffect(() => {
    setActivityItems(generateActivity(tickRef.current, selectedIdx))
  }, [selectedIdx])

  const selected = NYC_MARKETS[selectedIdx]
  const currentOrders = selected.orders.map((o, i) => ({
    ...o,
    size: orderSizes[selectedIdx]?.[i] || o.size,
  }))

  return (
    <div className="absolute top-12 right-0 bottom-0 z-20 hidden md:flex flex-col"
      style={{ width: visible ? '260px' : '36px' }}
    >
      {/* Toggle tab */}
      <button
        onClick={onToggle}
        className="absolute top-4 left-0 -translate-x-full backdrop-blur-md bg-black/50 border border-white/[0.06]
                   border-r-0 px-1.5 py-3 hover:bg-black/70 transition-colors z-30"
      >
        <div className="flex flex-col items-center gap-1">
          <Activity className="w-3 h-3 text-[#836EF9]/60" />
          <span className="text-[7px] font-mono text-white/20 tracking-[1px] [writing-mode:vertical-lr]">
            MARKETS
          </span>
        </div>
      </button>

      {visible && (
        <div className="flex-1 backdrop-blur-xl bg-black/70 border-l border-white/[0.06] overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-[#836EF9]/60" />
                <span className="text-[8px] font-mono tracking-[2px] text-white/25">NYC MARKETS</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[7px] font-mono text-emerald-500/60">LIVE</span>
              </div>
            </div>
          </div>

          {/* Market tabs */}
          <div className="flex border-b border-white/[0.04]">
            {NYC_MARKETS.map((m, i) => (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                className={`flex-1 py-1.5 text-center transition-colors ${
                  i === selectedIdx
                    ? 'bg-white/[0.04] border-b border-[#836EF9]/40'
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                <span className="text-[12px]">{m.emoji}</span>
              </button>
            ))}
          </div>

          {/* Selected market */}
          <div className="p-3">
            {/* Market name + category */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[7px] font-mono px-1 py-0.5 border border-white/[0.08] text-white/20 tracking-[1px]">
                {selected.category}
              </span>
              {selected.trend === 1 && <TrendingUp className="w-3 h-3 text-emerald-400/60" />}
              {selected.trend === -1 && <TrendingUp className="w-3 h-3 text-red-400/60 rotate-180" />}
            </div>
            <div className="text-[11px] font-bold text-white/80 mb-2 leading-tight">
              {selected.name}
            </div>

            {/* Price display */}
            <div className="flex items-baseline gap-2 mb-3">
              <div>
                <div className="text-[7px] font-mono text-white/20">YES</div>
                <div className="text-[18px] font-bold font-mono tabular-nums text-emerald-400">
                  {prices[selectedIdx].toFixed(3)}
                </div>
              </div>
              <div>
                <div className="text-[7px] font-mono text-white/20">NO</div>
                <div className="text-[13px] font-mono tabular-nums text-red-400/60">
                  {(1 - prices[selectedIdx]).toFixed(3)}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[7px] font-mono text-white/20">VOL</div>
                <div className="text-[10px] font-mono text-white/30">{selected.volume}</div>
              </div>
            </div>

            {/* Mini order book — now with animated sizes */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[7px] font-mono tracking-[1.5px] text-white/20">ORDER BOOK</span>
                <span className="text-[7px] font-mono text-white/10">PRICE / SIZE</span>
              </div>
              <div className="border border-white/[0.04] bg-white/[0.01] p-1.5">
                <MiniOrderBook orders={currentOrders} />
              </div>
            </div>

            {/* Volume bar */}
            <div className="h-1 bg-white/[0.04] flex overflow-hidden mb-3">
              <div className="bg-emerald-500/40 transition-all duration-1000"
                style={{ width: `${prices[selectedIdx] * 100}%` }}
              />
              <div className="bg-red-500/40 transition-all duration-1000"
                style={{ width: `${(1 - prices[selectedIdx]) * 100}%` }}
              />
            </div>

            {/* Trade CTA */}
            <Link
              href={`/predict`}
              className="block w-full py-2 text-center text-[10px] font-bold font-mono tracking-[1px]
                         border border-[#836EF9]/20 text-[#836EF9]/60 hover:bg-[#836EF9]/[0.06]
                         hover:border-[#836EF9]/30 transition-colors"
            >
              TRADE THIS MARKET
            </Link>
          </div>

          {/* Activity stream (bottom) — LIVE rotating messages */}
          <div className="border-t border-white/[0.04] flex-1">
            <div className="px-3 py-1.5 flex items-center gap-1.5">
              <Zap className="w-2.5 h-2.5 text-amber-400/40" />
              <span className="text-[7px] font-mono tracking-[1.5px] text-white/15">ACTIVITY</span>
            </div>
            <div className="px-3 space-y-1 overflow-hidden max-h-[120px]">
              {activityItems.map((item, i) => (
                <div key={`${tickRef.current}-${i}`} className={`flex items-center gap-1.5 ${i === 0 ? 'animate-feed-slide-in' : ''}`}>
                  <span className="text-[7px] font-mono text-white/10 w-[20px] text-right tabular-nums flex-shrink-0">{item.ago}</span>
                  <span className={`text-[8px] font-mono ${item.color} truncate`}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
      <div className="absolute bottom-[140px] md:bottom-[130px] right-3 md:right-6 z-20">
        <button
          onClick={connect}
          disabled={isConnecting}
          className="px-6 py-3 bg-white text-black text-[12px] font-bold tracking-wide
                     hover:bg-white/90 transition-all active:scale-[0.97] flex items-center justify-center gap-2
                     disabled:opacity-50"
        >
          {isConnecting ? (
            <Activity className="w-4 h-4 animate-spin" />
          ) : (
            <Wallet className="w-4 h-4" />
          )}
          {isConnecting ? 'CONNECTING...' : 'CONNECT TO TRADE'}
        </button>
      </div>
    )
  }

  return (
    <div className="absolute bottom-[140px] md:bottom-[130px] right-3 md:right-6 z-20
                    flex flex-col md:flex-row gap-2">
      <Link
        href={buildTradeUrl('yes')}
        className="px-5 py-2.5 bg-[#836EF9] text-white text-[12px] font-bold tracking-wide
                   hover:bg-[#836EF9]/80 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
      >
        <TrendingUp className="w-3.5 h-3.5" />
        YES @ {stats.teamA.price.toFixed(2)}
      </Link>
      <Link
        href={buildTradeUrl('no')}
        className="px-5 py-2.5 bg-[#FF3B30] text-white text-[12px] font-bold tracking-wide
                   hover:bg-[#FF3B30]/80 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
      >
        <TrendingUp className="w-3.5 h-3.5" />
        NO @ {stats.teamB.price.toFixed(2)}
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
  const [tradePopups, setTradePopups] = useState<TradePopup[]>([])
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [whaleAlert, setWhaleAlert] = useState<{ active: boolean; amount: number; side: string; isZk: boolean }>({ active: false, amount: 0, side: '', isZk: false })
  const [legendVisible, setLegendVisible] = useState(false)
  const [timeMachineVisible, setTimeMachineVisible] = useState(false)
  const [timeSlider, setTimeSlider] = useState(100) // 100 = now
  const [prevVolume, setPrevVolume] = useState(0)
  const [marketStreamVisible, setMarketStreamVisible] = useState(false)
  const [tradeInfoPopup, setTradeInfoPopup] = useState<TradeInfoPopupData | null>(null)
  const [liveOverlayItems, setLiveOverlayItems] = useState<LiveOverlayItem[]>([])
  const popupIdRef = useRef(0)
  const prevPointCount = useRef(0)
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null)

  // Sound effects
  const { play: playSound } = useSounds()

  // Real-time SSE stream
  const { lastTrade, connected: sseConnected, tradeCount: liveTradeCount } = usePulseStream(true)

  // Inject SSE trades into the heatmap + show popup + feed + whale alert
  useEffect(() => {
    if (!lastTrade) return
    const midpoint = AMOUNT_MIDPOINT[lastTrade.amountBucket] || 5
    const newPoint: HeatmapPoint = {
      lat: lastTrade.lat,
      lng: lastTrade.lng,
      intensity: Math.min(0.3 + (midpoint / 200), 1.0),
      side: lastTrade.side,
      timestamp: lastTrade.timestamp,
      executionMode: lastTrade.executionMode || 'direct',
      marketName: lastTrade.marketName || '',
    }
    setPoints(prev => [newPoint, ...prev].slice(0, 500))

    const isZk = lastTrade.executionMode === 'unlink'
    const isWhale = midpoint >= 50

    // Twitch-style overlay — truncated wallet (use real hash prefix if available)
    const rawWallet = lastTrade.walletHash || ''
    const walletShort = rawWallet.length >= 6 ? `${rawWallet.slice(0, 6)}...` : `0x...${Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, '0')}`
    const popupId = ++popupIdRef.current
    setLiveOverlayItems(prev => [{
      id: popupId,
      walletHash: walletShort,
      side: lastTrade.side,
      marketName: lastTrade.marketName || '',
      isZk,
      timestamp: Date.now(),
    }, ...prev].slice(0, 8))

    // Floating "+$X" popup
    setTradePopups(prev => [...prev, {
      id: popupId,
      lat: lastTrade.lat,
      lng: lastTrade.lng,
      amount: `${midpoint}`,
      side: lastTrade.side,
      isZk,
      isWhale,
    }])

    // Add to feed
    setFeedItems(prev => [{
      id: popupId,
      amount: midpoint,
      side: lastTrade.side,
      isZk,
      timestamp: Date.now(),
    }, ...prev].slice(0, 20))

    // Sound for incoming trade
    playSound(isZk ? 'privacy' : 'receive')

    // Whale alert for big trades ($50+)
    if (isWhale) {
      setWhaleAlert({ active: true, amount: midpoint, side: lastTrade.side, isZk })
      playSound('whale')
      setTimeout(() => setWhaleAlert(prev => ({ ...prev, active: false })), 3800)
    }

    // Cleanup popup after 3s
    const popupTimer = setTimeout(() => {
      setTradePopups(prev => prev.filter(p => p.id !== popupId))
    }, 3000)

    // Scan animation
    setScanActive(true)
    const timer = setTimeout(() => setScanActive(false), 2000)
    return () => {
      clearTimeout(timer)
      clearTimeout(popupTimer)
    }
  }, [lastTrade])

  // ── User geolocation ──
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')
  const geoRequested = useRef(false)

  const handlePointClick = useCallback((point: HeatmapPoint, screenPos: { x: number; y: number }) => {
    setTradeInfoPopup({ point, screenPos })
  }, [])

  const handleFlyTo = useCallback((lat: number, lng: number) => {
    if (!mapInstanceRef.current) return
    mapInstanceRef.current.flyTo({
      center: [lng, lat],
      zoom: 16,
      duration: 1200,
      essential: true,
    })
  }, [])

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

        map.flyTo({
          center: [lng, lat],
          zoom: 14.5,
          duration: 2500,
          essential: true,
        })
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    )
  }, [])

  // Poll heatmap data every 8 seconds (less aggressive since we have SSE)
  // Filter points by time slider
  const filteredPoints = timeSlider >= 100 ? points : points.filter(p => {
    const cutoffMs = Date.now() - (100 - timeSlider) * 1.2 * 60 * 1000
    return p.timestamp >= cutoffMs
  })

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/pulse/heatmap')
      if (res.ok) {
        const data = await res.json()
        setPoints(data.points)
        setStats(prev => {
          if (prev) setPrevVolume(prev.totalVolume)
          return data.stats
        })
        setIsLoading(false)
      }
    } catch (err) {
      console.error('[Pulse] Fetch failed:', err)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 8000)
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
            <MapboxHeatmap points={filteredPoints} onMapReady={handleMapReady} onPointClick={handlePointClick} />
            <NeighborhoodLabels map={mapInstanceRef.current} />
            <ScanLine active={scanActive} />
            <LiveTradePopups popups={tradePopups} map={mapInstanceRef.current} />
            <WhaleAlert {...whaleAlert} />
            <UserLocationMarker map={mapInstanceRef.current} location={userLocation} />
            <TradeInfoPopup
              data={tradeInfoPopup}
              onClose={() => setTradeInfoPopup(null)}
              onFlyTo={handleFlyTo}
              map={mapInstanceRef.current}
            />
            <CompassButton map={mapInstanceRef.current} userLocation={userLocation} />
            <LiveTradeOverlay items={liveOverlayItems} />
            {stats && stats.zkPrivateCount > 0 && (
              <PrivacyRing zkPct={stats.zkPrivatePct} zkCount={stats.zkPrivateCount} totalCount={filteredPoints.length} />
            )}
            <PulsePrivacyBadge
              totalTrades={filteredPoints.length}
              zkTrades={filteredPoints.filter(p => p.executionMode === 'unlink').length}
            />
            <LiveTradeFeed items={feedItems} />
            <MapLegend visible={legendVisible} onToggle={() => setLegendVisible(v => !v)} />
            <TimeMachineSlider
              visible={timeMachineVisible}
              onToggle={() => setTimeMachineVisible(v => !v)}
              value={timeSlider}
              onChange={setTimeSlider}
            />
            <PulseTradeButtons
              stats={stats}
              isConnected={isConnected}
              isConnecting={isConnecting}
              connect={connect}
              userLocation={userLocation}
            />
            <PulseStatsPanel stats={stats} sseConnected={sseConnected} liveTradeCount={liveTradeCount} prevVolume={prevVolume} />
            <MarketStreamPanel visible={marketStreamVisible} onToggle={() => setMarketStreamVisible(v => !v)} />
          </>
        )}
      </div>
    </div>
  )
}
