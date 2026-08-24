import type { Exhibit, ExhibitChart } from '../types/case'

/**
 * Categorical slots 1-3 of the validated default palette. Three is the cap: a
 * fourth slot puts yellow next to orange and fails the CVD floor. Exhibits that
 * need more series should be authored as tables.
 */
const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a']

function fmt(n: number): string {
  const abs = Math.abs(n)
  const digits = abs >= 100 || Number.isInteger(n) ? 0 : abs >= 10 ? 1 : 2
  return n.toLocaleString('en-US', { maximumFractionDigits: digits })
}

function ChartTable({ chart }: { chart: ExhibitChart }) {
  return (
    <details className="chart-table">
      <summary>View as table</summary>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              {chart.categories.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.series.map((s) => (
              <tr key={s.label}>
                <th scope="row">{s.label}</th>
                {s.values.map((v, i) => (
                  <td key={i}>
                    {fmt(v)}
                    {chart.valueSuffix ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/** Grouped or stacked columns. Every bar is direct-labelled, so identity and
 *  magnitude never rest on colour alone. */
function ChartView({ chart }: { chart: ExhibitChart }) {
  const W = 620
  const H = 250
  const padL = 8
  const padR = 8
  const padT = 26
  const padB = 34

  const stacked = chart.kind === 'stacked-bar'
  const suffix = chart.valueSuffix ?? ''
  const totals = chart.categories.map((_, ci) =>
    stacked
      ? chart.series.reduce((s, ser) => s + ser.values[ci], 0)
      : Math.max(...chart.series.map((ser) => ser.values[ci])),
  )
  const max = Math.max(1, ...totals)
  const plotH = H - padT - padB
  const plotW = W - padL - padR
  const slot = plotW / chart.categories.length
  const groupPad = slot * 0.22
  const groupW = slot - groupPad * 2
  const barW = stacked ? Math.min(groupW, 96) : Math.min(groupW / chart.series.length, 72)

  const y = (v: number) => padT + plotH - (v / max) * plotH

  return (
    <div className="chart">
      {chart.series.length > 1 ? (
        <div className="chart-legend">
          {chart.series.map((s, i) => (
            <span key={s.label}>
              <i style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}

      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Chart: ${chart.categories.join(', ')}`}>
        <line
          x1={padL}
          y1={padT + plotH}
          x2={W - padR}
          y2={padT + plotH}
          stroke="#d6d9dd"
          strokeWidth="1"
        />

        {chart.categories.map((cat, ci) => {
          const groupX = padL + ci * slot + groupPad
          const bars: JSX.Element[] = []

          if (stacked) {
            const x = groupX + (groupW - barW) / 2
            let cursor = padT + plotH
            chart.series.forEach((ser, si) => {
              const v = ser.values[ci]
              const h = (v / max) * plotH
              // 2px surface gap keeps adjacent fills from reading as one mark
              const top = cursor - h
              bars.push(
                <g key={ser.label}>
                  <rect
                    x={x}
                    y={top}
                    width={barW}
                    height={Math.max(0, h - 2)}
                    rx={si === 0 ? 0 : 4}
                    fill={SERIES_COLORS[si % SERIES_COLORS.length]}
                  />
                  {h > 18 ? (
                    <text x={x + barW / 2} y={top + h / 2 + 4} className="bar-inline">
                      {fmt(v)}
                    </text>
                  ) : null}
                </g>,
              )
              cursor = top
            })
            bars.push(
              <text key="total" x={x + barW / 2} y={cursor - 8} className="bar-label">
                {fmt(totals[ci])}
                {suffix}
              </text>,
            )
          } else {
            const span = barW * chart.series.length
            const startX = groupX + (groupW - span) / 2
            chart.series.forEach((ser, si) => {
              const v = ser.values[ci]
              const x = startX + si * barW
              const top = y(v)
              bars.push(
                <g key={ser.label}>
                  <rect
                    x={x + 2}
                    y={top}
                    width={Math.max(1, barW - 4)}
                    height={padT + plotH - top}
                    rx={4}
                    fill={SERIES_COLORS[si % SERIES_COLORS.length]}
                  />
                  <text x={x + barW / 2} y={top - 8} className="bar-label">
                    {fmt(v)}
                    {suffix}
                  </text>
                </g>,
              )
            })
          }

          return (
            <g key={cat}>
              {bars}
              <text x={groupX + groupW / 2} y={H - 12} className="cat-label">
                {cat}
              </text>
            </g>
          )
        })}
      </svg>

      <ChartTable chart={chart} />
    </div>
  )
}

export function ExhibitView({ exhibit }: { exhibit: Exhibit }) {
  return (
    <figure className="exhibit">
      <figcaption>
        {exhibit.title}
        {exhibit.unitsNote ? <span className="muted"> — {exhibit.unitsNote}</span> : null}
      </figcaption>

      {exhibit.type === 'table' && exhibit.table ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {exhibit.table.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exhibit.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) =>
                    j === 0 ? (
                      <th scope="row" key={j}>
                        {String(cell)}
                      </th>
                    ) : (
                      <td key={j}>{String(cell)}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {exhibit.type === 'chart' && exhibit.chart ? <ChartView chart={exhibit.chart} /> : null}

      {exhibit.type === 'image' && exhibit.src ? (
        <img src={exhibit.src} alt={exhibit.title} />
      ) : null}

      {exhibit.type === 'text' && exhibit.text ? (
        <div className="prompt-block">{exhibit.text}</div>
      ) : null}

      {exhibit.source ? <div className="exhibit-source">Source: {exhibit.source}</div> : null}
    </figure>
  )
}
