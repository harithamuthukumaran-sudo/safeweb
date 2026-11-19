import React, { useMemo } from 'react'

const CLASSIFICATIONS = {
  safe:       { color: '#10b981', track: '#10b98130', label: 'Low Risk' },
  suspicious: { color: '#f59e0b', track: '#f59e0b30', label: 'Suspicious' },
  dangerous:  { color: '#f43f5e', track: '#f43f5e30', label: 'Dangerous' },
}

/**
 * Animated SVG arc gauge for displaying a 0-100 risk score.
 * Uses a stroke-dasharray trick — no canvas or external library.
 */
export default function RiskScoreMeter({ score = 0, classification = 'safe', size = 200 }) {
  const { color, track } = CLASSIFICATIONS[classification] || CLASSIFICATIONS.safe
  const radius     = (size / 2) - 20
  const circumference = radius * Math.PI  // half-circle arc
  const filled    = ((100 - score) / 100) * circumference
  const cx = size / 2
  const cy = size / 2 + 20

  const badgeClass = {
    safe:       'badge-safe',
    suspicious: 'badge-suspicious',
    dangerous:  'badge-dangerous',
  }[classification] || 'badge-safe'

  return (
    <div className="flex flex-col items-center gap-3 animate-fade-in">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Track arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={track}
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circumference - filled} ${filled}`}
          style={{
            filter: `drop-shadow(0 0 8px ${color}99)`,
            transition: 'stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        {/* Score number */}
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.22}
          fontWeight="800"
          fontFamily="Inter, sans-serif"
        >
          {score}
        </text>
        {/* /100 label */}
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fill="#ffffff60"
          fontSize={size * 0.07}
          fontFamily="Inter, sans-serif"
        >
          out of 100
        </text>
      </svg>
      <span className={`px-4 py-1 rounded-full text-sm font-semibold ${badgeClass}`}>
        {CLASSIFICATIONS[classification]?.label || 'Unknown'}
      </span>
    </div>
  )
}
