import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@lib/supabase.js'
import { Navbar } from '@components/layout/Navbar.jsx'
import { computeSummary } from './statsUtils.js'
import {
  CategoriaChart,
  GeneroChart,
  TimelineChart,
  WafflePanorama,
  WordCloud,
} from './Charts.jsx'

const SUMMARY_META = [
  { id: 'total-ruas', icon: 'bi-signpost-2', label: 'Total de Ruas', key: 'totalRuas' },
  { id: 'total-bairros', icon: 'bi-geo-alt', label: 'Bairros', key: 'totalBairros' },
  { id: 'total-homenageados', icon: 'bi-people', label: 'Homenageados', key: 'homenageados' },
  { id: 'total-incompletas', icon: 'bi-exclamation-triangle', label: 'Sem Dados Completos', key: 'incompletas' },
]

function SummarySkeleton() {
  return (
    <div className="summary-cards" id="summary-cards" aria-hidden="true">
      {SUMMARY_META.map((item) => (
        <div className="summary-card summary-card--skeleton" key={item.id}>
          <div className="summary-icon skeleton-pulse" />
          <div className="summary-value skeleton-line skeleton-line--value" />
          <div className="summary-label skeleton-line skeleton-line--label" />
        </div>
      ))}
    </div>
  )
}

function ChartsSkeleton() {
  return (
    <div className="charts-grid charts-grid--skeleton" id="charts-container" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <div className="chart-card chart-card--skeleton" key={n}>
          <div className="skeleton-line skeleton-line--title" />
          <div className="skeleton-chart-block skeleton-pulse" />
        </div>
      ))}
    </div>
  )
}

export default function EstatisticasPage() {
  const [ruas, setRuas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const loadData = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase
        .from('ruas')
        .select('*')
        .order('nome_oficial', { ascending: true })

      if (signal?.aborted) return
      if (fetchError) throw fetchError

      setRuas(data || [])
    } catch (err) {
      if (signal?.aborted) return
      console.error(err)
      const detail = err?.message ? ` (${err.message})` : ''
      setError(`Não foi possível carregar as estatísticas.${detail}`)
      setRuas([])
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadData(controller.signal)
    return () => controller.abort()
  }, [loadData, reloadKey])

  const summary = useMemo(() => computeSummary(ruas), [ruas])

  async function handleExport(e) {
    const btn = e.currentTarget
    setExporting(true)
    try {
      const { PdfGeneratorService } = await import('@legacy/services/PdfGeneratorService.js')
      await PdfGeneratorService.exportFullReport(btn)
    } catch (err) {
      console.error(err)
      setError('Falha ao exportar o PDF. Tente novamente.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <a href="#main" className="skip-link">Pular para conteúdo</a>
      <Navbar active="estatisticas" />

      <main id="main" className="stats-main" tabIndex={-1} aria-busy={loading || undefined}>
        <div className="container-fluid px-4">
          <div className="stats-header">
            <h1>Análise da Toponímia Urbana</h1>
            <button
              type="button"
              className="btn btn-primary"
              id="btn-exportar-pdf"
              onClick={handleExport}
              disabled={exporting || loading || !!error || ruas.length === 0}
            >
              <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
              {exporting ? 'Preparando…' : 'Exportar PDF'}
            </button>
          </div>

          <div
            id="stats-loading-status"
            className="visually-hidden"
            role="status"
            aria-live="polite"
          >
            {loading ? 'Carregando estatísticas, aguarde.' : error ? error : 'Estatísticas carregadas.'}
          </div>

          {loading && (
            <div className="stats-loading-banner" role="status" aria-live="polite">
              <div className="stats-spinner" aria-hidden="true" />
              <div>
                <strong>Carregando estatísticas…</strong>
                <p>Buscando ruas e montando os gráficos. Isso pode levar alguns segundos.</p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="alert alert-danger d-flex flex-wrap align-items-center justify-content-between gap-2" role="alert">
              <span>{error}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {loading ? (
            <>
              <SummarySkeleton />
              <ChartsSkeleton />
            </>
          ) : (
            !error && (
              <>
                <div className="summary-cards" id="summary-cards">
                  {SUMMARY_META.map((item) => (
                    <div className="summary-card" key={item.id}>
                      <div className="summary-icon">
                        <i className={`bi ${item.icon}`} aria-hidden="true" />
                      </div>
                      <div className="summary-value" id={item.id}>
                        {summary[item.key]}
                      </div>
                      <div className="summary-label">{item.label}</div>
                    </div>
                  ))}
                </div>

                {summary.coberturaBaixa && (
                  <div className="alert alert-info" id="alerta-cobertura" role="alert">
                    <i className="bi bi-info-circle me-1" aria-hidden="true" />
                    <span id="texto-cobertura">{summary.textoCobertura}</span>
                  </div>
                )}

                <div className="charts-grid" id="charts-container">
                  <CategoriaChart ruas={ruas} />
                  <GeneroChart ruas={ruas} />
                  <WafflePanorama ruas={ruas} />
                  <TimelineChart ruas={ruas} />
                  <WordCloud ruas={ruas} />
                </div>
              </>
            )
          )}
        </div>
      </main>
    </>
  )
}
