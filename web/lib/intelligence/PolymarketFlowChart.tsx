import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from 'recharts';
import { CHART_COLORS } from './DefiChartTheme';

// Polymarket Order Flow Decomposition
// Shows maker vs taker volume and the cumulative edge
// Based on Becker dataset analysis patterns
const FLOW_DATA = [
  { month: 'Jan 25', makerVol: 120, takerVol: 310, makerROI: 3.2, takerROI: -8.1 },
  { month: 'Feb 25', makerVol: 145, takerVol: 380, makerROI: 2.8, takerROI: -9.4 },
  { month: 'Mar 25', makerVol: 180, takerVol: 420, makerROI: 3.5, takerROI: -7.8 },
  { month: 'Apr 25', makerVol: 210, takerVol: 490, makerROI: 4.1, takerROI: -11.2 },
  { month: 'May 25', makerVol: 280, takerVol: 620, makerROI: 3.8, takerROI: -10.5 },
  { month: 'Jun 25', makerVol: 350, takerVol: 710, makerROI: 4.4, takerROI: -12.1 },
  { month: 'Jul 25', makerVol: 420, takerVol: 850, makerROI: 3.9, takerROI: -9.8 },
  { month: 'Aug 25', makerVol: 510, takerVol: 980, makerROI: 5.1, takerROI: -13.4 },
  { month: 'Sep 25', makerVol: 600, takerVol: 1100, makerROI: 4.6, takerROI: -11.9 },
  { month: 'Oct 25', makerVol: 720, takerVol: 1300, makerROI: 5.3, takerROI: -14.2 },
  { month: 'Nov 25', makerVol: 890, takerVol: 1500, makerROI: 5.8, takerROI: -15.1 },
  { month: 'Dec 25', makerVol: 1050, takerVol: 1800, makerROI: 6.2, takerROI: -16.8 },
];

function formatVol(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`;
  return `$${value}M`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-4 py-3 text-sm"
      style={{ background: CHART_COLORS.darkSurface, borderColor: CHART_COLORS.electricBlue }}
    >
      <p className="font-semibold mb-2" style={{ color: CHART_COLORS.textLight }}>
        {label}
      </p>
      {payload.map((p: any) => {
        const isVol = p.dataKey.includes('Vol');
        return (
          <p key={p.dataKey} className="text-xs mb-1" style={{ color: p.color }}>
            {p.name}: {isVol ? formatVol(p.value) : `${p.value > 0 ? '+' : ''}${p.value}%`}
          </p>
        );
      })}
    </div>
  );
}

export function PolymarketFlowChart() {
  return (
    <div className="w-full rounded-xl border border-border bg-card p-4 my-8">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-foreground">
          Polymarket Order Flow: Maker vs Taker Volume and ROI
        </h4>
        <p className="text-xs mt-1" style={{ color: CHART_COLORS.textMuted }}>
          As volume grows, the gap between maker and taker returns widens. Takers subsidize maker profits through spread capture and adverse selection.
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={FLOW_DATA} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.gridLine} vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: CHART_COLORS.textLight, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="volume"
            orientation="left"
            tickFormatter={formatVol}
            tick={{ fill: CHART_COLORS.textMuted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={55}
            label={{ value: 'Volume', angle: -90, position: 'insideLeft', fill: CHART_COLORS.textMuted, fontSize: 10 }}
          />
          <YAxis
            yAxisId="roi"
            orientation="right"
            tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
            tick={{ fill: CHART_COLORS.textMuted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
            label={{ value: 'ROI', angle: 90, position: 'insideRight', fill: CHART_COLORS.textMuted, fontSize: 10 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar
            yAxisId="volume"
            dataKey="makerVol"
            name="Maker Volume"
            radius={[3, 3, 0, 0]}
            animationDuration={800}
            stackId="volume"
          >
            {FLOW_DATA.map((_, i) => (
              <Cell key={`m-${i}`} fill={CHART_COLORS.neonGreen} opacity={0.6} />
            ))}
          </Bar>
          <Bar
            yAxisId="volume"
            dataKey="takerVol"
            name="Taker Volume"
            radius={[3, 3, 0, 0]}
            animationDuration={800}
            stackId="volume"
          >
            {FLOW_DATA.map((_, i) => (
              <Cell key={`t-${i}`} fill="#ef4444" opacity={0.4} />
            ))}
          </Bar>
          <Line
            yAxisId="roi"
            type="monotone"
            dataKey="makerROI"
            name="Maker ROI"
            stroke={CHART_COLORS.neonGreen}
            strokeWidth={2.5}
            dot={{ r: 3, fill: CHART_COLORS.neonGreen }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="roi"
            type="monotone"
            dataKey="takerROI"
            name="Taker ROI"
            stroke="#ef4444"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#ef4444' }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="text-right text-[10px] mt-1" style={{ color: CHART_COLORS.textMuted }}>
        Data: Becker Polymarket Dataset (400M+ trades) · Analysis: @rohanpaul_ai · DeFi Mexico
      </p>
    </div>
  );
}
