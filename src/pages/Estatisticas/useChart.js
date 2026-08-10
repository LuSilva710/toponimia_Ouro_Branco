import { useEffect, useRef } from 'react'

/** Cria Chart.js no canvas e destrói no unmount / quando factory muda. */
export function useChart(factory, deps) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const Chart = globalThis.Chart
    if (!canvas || !Chart || !factory) return undefined

    if (Chart.defaults?.plugins) {
      Chart.defaults.plugins.colors = { enabled: false }
    }

    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    chartRef.current = factory(canvas, Chart) || null

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return canvasRef
}
