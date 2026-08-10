import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CORES,
  CORES_GENERO,
  ORDEM_CATEGORIAS,
  buildTimelineData,
  buildWaffleData,
  buildWordCloudItems,
  contarPorCategoria,
  rotuloCategoriaToponimica,
} from './statsUtils.js'
import { useChart } from './useChart.js'

export function CategoriaChart({ ruas }) {
  const contagem = useMemo(() => contarPorCategoria(ruas), [ruas])
  const keysChart = useMemo(() => ORDEM_CATEGORIAS.filter((k) => contagem[k] > 0), [contagem])

  const canvasRef = useChart((canvas, Chart) => {
    if (!keysChart.length) return null
    return new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: keysChart.map((k) => rotuloCategoriaToponimica(k)),
        datasets: [{
          data: keysChart.map((k) => contagem[k]),
          backgroundColor: keysChart.map((k) => CORES[k]),
          borderColor: keysChart.map(() => '#ffffff'),
          borderWidth: 2,
          hoverBorderColor: '#ffffff',
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          colors: { enabled: false },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.raw
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0)
                const pct = total ? ((v / total) * 100).toFixed(1) : '0'
                return ` ${ctx.label}: ${v} (${pct}%)`
              },
            },
          },
        },
      },
    })
  }, [keysChart, contagem])

  return (
    <div className="chart-card">
      <h3><i className="bi bi-pie-chart me-2" aria-hidden="true" />Distribuição por Categoria Toponímica</h3>
      <canvas ref={canvasRef} id="chart-categorias" />
      <div id="legend-html-categorias" className="custom-legend mt-3">
        {ORDEM_CATEGORIAS.map((k) => (
          <div className="custom-legend-item" key={k}>
            <span className="custom-legend-color" style={{ backgroundColor: CORES[k] }} />
            <span className="custom-legend-label">{rotuloCategoriaToponimica(k)}</span>
            <span className="custom-legend-count">{contagem[k]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function GeneroChart({ ruas }) {
  const contagem = useMemo(() => {
    const c = { masculino: 0, feminino: 0, neutro: 0 }
    ruas.forEach((r) => {
      const g = r.genero_homenageado || 'neutro'
      c[g] = (c[g] || 0) + 1
    })
    return c
  }, [ruas])

  const canvasRef = useChart((canvas, Chart) => {
    const coresGen = [CORES_GENERO.masculino, CORES_GENERO.feminino, CORES_GENERO.neutro]
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Masculino', 'Feminino', 'Neutro'],
        datasets: [{
          data: [contagem.masculino, contagem.feminino, contagem.neutro],
          backgroundColor: coresGen,
          borderColor: coresGen.map(() => '#ffffff'),
          borderWidth: 2,
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { colors: { enabled: false }, legend: { display: false } },
        scales: {
          x: { ticks: { color: '#444' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { ticks: { color: '#444' }, grid: { display: false } },
        },
      },
    })
  }, [contagem])

  return (
    <div className="chart-card">
      <h3><i className="bi bi-bar-chart me-2" aria-hidden="true" />Homenagens por Gênero</h3>
      <canvas ref={canvasRef} id="chart-genero" />
    </div>
  )
}

export function WafflePanorama({ ruas }) {
  const data = useMemo(() => buildWaffleData(ruas), [ruas])
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, rua: '', cat: '' })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.waffle-line').forEach((l) => l.classList.add('animate-in'))
          observer.unobserve(entry.target)
        }
      })
    }, { rootMargin: '0px 0px -40px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [data])

  return (
    <div className="chart-card chart-card-full" id="waffle-section">
      <h3><i className="bi bi-distribute-vertical me-2" aria-hidden="true" />Panorama Toponímico de Ouro Branco</h3>
      <div id="waffle-container" className="waffle-panorama-container" ref={containerRef}>
        <div className="waffle-cidade-header">
          <div className="waffle-cidade-title">Percepção Semântica da Malha Urbana Ouro-branquense</div>
          <div className="waffle-cidade-count">{data.ruasOrdenadas.length} logradouros processados</div>
        </div>
        <div className="waffle-grid">
          {data.ruasOrdenadas.map((r, index) => (
            <div
              key={`${r.nome_oficial}-${index}`}
              className="waffle-line"
              style={{ backgroundColor: r.color, animationDelay: `${(index % 60) * 8}ms` }}
              onMouseEnter={(e) => setTooltip({ visible: true, x: e.clientX + 15, y: e.clientY + 15, rua: r.nome_oficial, cat: r.label })}
              onMouseMove={(e) => setTooltip((t) => ({ ...t, x: e.clientX + 15, y: e.clientY + 15 }))}
              onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
            />
          ))}
        </div>
        <div className="waffle-legend">
          {data.legend.map((item) => (
            <div className="waffle-legend-item" key={item.cat}>
              <span className="waffle-legend-color" style={{ backgroundColor: item.color }} />
              <span>{item.label}:</span>
              <span className="waffle-legend-count">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div
        className="custom-waffle-tooltip"
        style={{
          visibility: tooltip.visible ? 'visible' : 'hidden',
          opacity: tooltip.visible ? 1 : 0,
          left: tooltip.x,
          top: tooltip.y,
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      >
        <strong>{tooltip.rua}</strong>
        <br />
        <span style={{ fontSize: '0.8rem', color: '#d1d5db' }}>{tooltip.cat}</span>
      </div>
    </div>
  )
}

export function TimelineChart({ ruas }) {
  const timeline = useMemo(() => buildTimelineData(ruas), [ruas])

  const canvasRef = useChart((canvas, Chart) => {
    if (!timeline) return null
    const { decadas, catsVisiveis, porDecadaCat, dadosAcumulados } = timeline
    const datasets = catsVisiveis.map((k) => ({
      type: 'bar',
      label: rotuloCategoriaToponimica(k),
      data: decadas.map((d) => porDecadaCat[d][k] || 0),
      backgroundColor: CORES[k] || CORES.outro,
      borderColor: '#ffffff',
      borderWidth: 1,
      stack: 'decadas',
      order: 2,
      yAxisID: 'y',
    }))
    datasets.push({
      type: 'line',
      label: 'Expansão Urbana (Acumulado)',
      data: dadosAcumulados,
      borderColor: '#222222',
      borderWidth: 3,
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '#222222',
      pointHoverRadius: 6,
      fill: false,
      tension: 0.4,
      order: 1,
      yAxisID: 'yTotal',
    })
    return new Chart(canvas, {
      data: { labels: decadas.map((d) => `${d}s`), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { usePointStyle: true, padding: 15, font: { size: 11 } } },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.85)',
            padding: 12,
            callbacks: {
              label: (ctx) => (ctx.dataset.type === 'line' ? ` Cúmulo: ${ctx.raw} ruas` : ` ${ctx.dataset.label}: ${ctx.raw}`),
              footer: (items) => {
                const t = items.filter((it) => it.dataset.type === 'bar').reduce((s, it) => s + (it.parsed.y || 0), 0)
                return `Total na década: ${t} ruas`
              },
            },
          },
          annotation: {
            annotations: {
              line1953: {
                type: 'line',
                xMin: decadas.indexOf(1950) !== -1 ? decadas.indexOf(1950) + 0.3 : null,
                xMax: decadas.indexOf(1950) !== -1 ? decadas.indexOf(1950) + 0.3 : null,
                borderColor: 'rgba(0,0,0,0.4)',
                borderWidth: 2,
                borderDash: [6, 6],
                label: {
                  display: true,
                  content: 'Emancipação (1953)',
                  position: 'start',
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  color: '#222',
                  font: { size: 10, weight: 'bold' },
                  padding: 4,
                },
              },
              line1976: {
                type: 'line',
                xMin: decadas.indexOf(1970) !== -1 ? decadas.indexOf(1970) + 0.6 : null,
                xMax: decadas.indexOf(1970) !== -1 ? decadas.indexOf(1970) + 0.6 : null,
                borderColor: 'rgba(0,0,0,0.4)',
                borderWidth: 2,
                borderDash: [6, 6],
                label: {
                  display: true,
                  content: 'Início Açominas (1976)',
                  position: 'end',
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  color: '#222',
                  font: { size: 10, weight: 'bold' },
                  padding: 4,
                },
              },
            },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
            title: { display: true, text: 'Novas Ruas / Década', font: { size: 10, weight: 'bold' } },
            ticks: { precision: 0 },
          },
          yTotal: {
            position: 'right',
            beginAtZero: true,
            title: { display: true, text: 'Total Acumulado', font: { size: 10, weight: 'bold' } },
            grid: { display: false },
            ticks: { precision: 0 },
          },
        },
      },
    })
  }, [timeline])

  const insight = timeline?.insight

  return (
    <div className="chart-card chart-card-full">
      <h3><i className="bi bi-clock-history me-2" aria-hidden="true" />Ruas por Década de Nomeação</h3>
      <p className="chart-card-desc">
        Cada coluna é uma década: a altura total é o número de ruas com data; as faixas coloridas mostram <strong>quantas ruas</strong> de cada <strong>categoria toponímica</strong> entraram nessa década — dá para ver a “assinatura” temporal do vocabulário urbano.
      </p>
      {insight && (
        <p id="timeline-insight" className="chart-timeline-insight">
          <span className="d-flex align-items-center gap-2">
            <i className="bi bi-lightbulb text-warning" style={{ fontSize: '1.2rem' }} aria-hidden="true" />
            <span>
              Ouro Branco expandiu significativamente a partir da década de <strong>{insight.decPico}</strong>,
              quando <strong>{insight.nPico}</strong> novas ruas ({insight.pctPico}%) foram registradas.
              O predomínio de <strong>{rotuloCategoriaToponimica(insight.catDominantePico)}</strong> sugere uma influência{' '}
              {insight.catDominantePico === 'antropotoponimo' ? 'biográfica forte' : 'histórica setorial'} nesse período.
            </span>
          </span>
        </p>
      )}
      <div className="chart-timeline-wrap">
        <canvas ref={canvasRef} id="chart-timeline" hidden={!timeline} />
        <p id="timeline-empty" className="timeline-empty-msg" hidden={!!timeline} role="status">
          Dados de década ainda não preenchidos (campo <em>década de nomeação</em> ou ano na legislação).
        </p>
      </div>
    </div>
  )
}

export function WordCloud({ ruas }) {
  const items = useMemo(() => buildWordCloudItems(ruas), [ruas])
  if (!items.length) return null
  return (
    <div className="chart-card chart-card-full">
      <h3><i className="bi bi-chat-text me-2" aria-hidden="true" />Destaques Semânticos das Biografias</h3>
      <div id="html-wordcloud" className="modern-wordcloud">
        {items.map((w) => (
          <span
            key={w.word}
            className="word-badge"
            style={{ ['--base-size']: `${w.size}rem`, color: w.color, opacity: w.opacity }}
            title={`Citada ${w.count} vezes`}
          >
            {w.word}
          </span>
        ))}
      </div>
    </div>
  )
}
