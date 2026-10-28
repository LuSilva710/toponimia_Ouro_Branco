import { useMemo, useState } from 'react'
import {
  CAMPOS_PESQUISA,
  CORES,
  CORES_GENERO,
  buildBairroStats,
  buildGeneroData,
  buildProgressoPesquisa,
  rotuloCategoriaToponimica,
} from './statsUtils.js'
import { useChart } from './useChart.js'

function BarraProgresso({ valor, cor = 'var(--dark-gray)', rotulo }) {
  return (
    <div
      className="stat-progress"
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={rotulo}
    >
      <div className="stat-progress-fill" style={{ width: `${valor}%`, background: cor }} />
    </div>
  )
}

// ─── Igualdade de gênero ─────────────────────────────────────────────────────

export function PainelGenero({ ruas }) {
  const g = useMemo(() => buildGeneroData(ruas), [ruas])

  const canvasRef = useChart((canvas, Chart) => {
    if (!g.decadas.length) return null
    const total = (d) => g.porDecada[d].masculino + g.porDecada[d].feminino
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: g.decadas.map((d) => `${d}s`),
        datasets: [
          {
            label: 'Mulheres',
            data: g.decadas.map((d) => g.porDecada[d].feminino),
            backgroundColor: CORES_GENERO.feminino,
            borderRadius: 4,
          },
          {
            label: 'Homens',
            data: g.decadas.map((d) => g.porDecada[d].masculino),
            backgroundColor: CORES_GENERO.masculino,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          colors: { enabled: false },
          legend: { position: 'bottom', labels: { color: '#4f3414', boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const t = total(g.decadas[ctx.dataIndex])
                const p = t ? Math.round((ctx.raw / t) * 100) : 0
                return ` ${ctx.dataset.label}: ${ctx.raw} (${p}% da década)`
              },
            },
          },
        },
        scales: {
          x: { stacked: true, ticks: { color: '#4f3414' }, grid: { display: false } },
          y: { stacked: true, ticks: { color: '#4f3414', precision: 0 }, grid: { color: 'rgba(124,82,32,0.10)' } },
        },
      },
    })
  }, [g])

  return (
    <div className="chart-card chart-card-full" id="painel-genero">
      <h3><i className="bi bi-gender-ambiguous me-2" aria-hidden="true" />Igualdade de Gênero nas Homenagens</h3>
      <div className="genero-layout">
        <div className="genero-destaque">
          <div className="genero-destaque-numero">
            <span style={{ color: CORES_GENERO.feminino }}>{g.mulheresEm10}</span> em cada 10
          </div>
          <p className="genero-destaque-texto">
            pessoas homenageadas com nome de rua são <strong>mulheres</strong>.
          </p>
          <ul className="genero-numeros">
            <li><span className="dot" style={{ background: CORES_GENERO.feminino }} />{g.contagem.feminino} mulheres ({g.pctFeminino}%)</li>
            <li><span className="dot" style={{ background: CORES_GENERO.masculino }} />{g.contagem.masculino} homens ({100 - g.pctFeminino}%)</li>
            <li><span className="dot" style={{ background: CORES_GENERO.neutro }} />{g.contagem.neutro} nomes que não homenageiam pessoas</li>
            <li><span className="dot" style={{ background: '#cbd5e1' }} />{g.contagem.naoClassificado} ruas ainda sem gênero classificado</li>
          </ul>
        </div>
        <div className="genero-periodo">
          <p className="chart-card-desc">
            Homenagens a pessoas por década da lei de denominação. Baseado nas{' '}
            <strong>{g.pessoasComAno} de {g.pessoas}</strong> pessoas homenageadas cuja lei tem ano registrado.
          </p>
          {g.decadas.length ? (
            <div className="genero-chart-wrap">
              <canvas ref={canvasRef} id="chart-genero-periodo" aria-label="Homenagens a mulheres e homens por década" role="img" />
            </div>
          ) : (
            <p className="timeline-empty-msg">Ainda não há leis com ano registrado para ruas com gênero classificado.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Comparativo por bairro ──────────────────────────────────────────────────

const COLUNAS_BAIRRO = [
  { key: 'nome', label: 'Bairro', num: false, alinhar: 'start' },
  { key: 'total', label: 'Ruas', num: true, alinhar: 'end' },
  { key: 'pctCatDominante', label: 'Perfil toponímico', num: true, alinhar: 'start' },
  { key: 'pctFeminino', label: 'Mulheres homenageadas', num: true, alinhar: 'end' },
  { key: 'pctSignificado', label: 'História pesquisada', num: true, alinhar: 'end' },
]

export function ComparativoBairros({ ruas }) {
  const linhas = useMemo(() => buildBairroStats(ruas), [ruas])
  const [ordem, setOrdem] = useState({ key: 'total', dir: 'desc' })

  const ordenadas = useMemo(() => {
    const { key, dir } = ordem
    const fator = dir === 'asc' ? 1 : -1
    return [...linhas].sort((a, b) => {
      const va = a[key]
      const vb = b[key]
      // Bairros sem dado (null) sempre no fim, em qualquer direção
      if (va == null && vb == null) return a.nome.localeCompare(b.nome)
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
      return cmp * fator || a.nome.localeCompare(b.nome)
    })
  }, [linhas, ordem])

  function ordenarPor(key, num) {
    setOrdem((o) => (o.key === key ? { key, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: num ? 'desc' : 'asc' }))
  }

  return (
    <div className="chart-card chart-card-full" id="comparativo-bairros">
      <h3><i className="bi bi-table me-2" aria-hidden="true" />Comparativo por Bairro</h3>
      <p className="chart-card-desc">
        Clique no título de uma coluna para ordenar. <em>Perfil toponímico</em> é a categoria mais frequente no bairro;
        <em> mulheres homenageadas</em> considera só as ruas com nome de pessoa já classificadas.
      </p>
      <div className="table-responsive bairros-table-wrap">
        <table className="table bairros-table align-middle mb-0">
          <thead>
            <tr>
              {COLUNAS_BAIRRO.map((c) => {
                const ativa = ordem.key === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={c.alinhar === 'end' ? 'text-end' : ''}
                    aria-sort={ativa ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" className="th-sort" onClick={() => ordenarPor(c.key, c.num)}>
                      {c.label}
                      <i
                        className={`bi ${ativa ? (ordem.dir === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill') : 'bi-chevron-expand'} ms-1`}
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((b) => (
              <tr key={b.nome}>
                <th scope="row" className="fw-semibold">{b.nome}</th>
                <td className="text-end">{b.total}</td>
                <td>
                  {b.catDominante ? (
                    <span className="perfil-cat">
                      <span className="dot" style={{ background: CORES[b.catDominante] }} />
                      {rotuloCategoriaToponimica(b.catDominante)}
                      <span className="text-muted ms-1">({b.pctCatDominante}%)</span>
                    </span>
                  ) : (
                    <span className="text-muted">sem classificação</span>
                  )}
                </td>
                <td className="text-end">
                  {b.pctFeminino == null ? (
                    <span className="text-muted">–</span>
                  ) : (
                    <>
                      {b.feminino} de {b.pessoas} <span className="text-muted">({b.pctFeminino}%)</span>
                    </>
                  )}
                </td>
                <td className="text-end">
                  <div className="celula-progresso">
                    <BarraProgresso valor={b.pctSignificado} rotulo={`História pesquisada em ${b.nome}`} />
                    <span>{b.pctSignificado}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Progresso da pesquisa ───────────────────────────────────────────────────

export function ProgressoPesquisa({ ruas }) {
  const p = useMemo(() => buildProgressoPesquisa(ruas), [ruas])
  const pendencias = useMemo(
    () =>
      [...p.porBairro]
        .map((b) => ({ ...b, soma: Object.values(b.pendentes).reduce((s, n) => s + n, 0) }))
        .filter((b) => b.soma > 0)
        .sort((a, b) => b.soma - a.soma || a.nome.localeCompare(b.nome)),
    [p],
  )

  return (
    <div className="chart-card chart-card-full" id="progresso-pesquisa">
      <h3><i className="bi bi-list-check me-2" aria-hidden="true" />Progresso da Pesquisa</h3>
      <p className="chart-card-desc">
        Quanto do acervo já está preenchido. <strong>{p.completas} de {ruas.length}</strong> ruas têm todos os campos.
        Os campos são editados no painel administrativo.
      </p>

      <div className="progresso-lista">
        {p.geral.map((c) => (
          <div className="progresso-item" key={c.key}>
            <div className="progresso-item-topo">
              <span>{c.label}</span>
              <span className="progresso-item-num">
                {c.feitas} de {c.total} <strong>{c.pct}%</strong>
              </span>
            </div>
            <BarraProgresso
              valor={c.pct}
              rotulo={`${c.label}: ${c.pct}% preenchido`}
              cor={c.pct >= 80 ? '#16a34a' : c.pct >= 40 ? '#d97706' : '#dc2626'}
            />
          </div>
        ))}
      </div>

      {pendencias.length > 0 && (
        <details className="pendencias">
          <summary>Ver o que falta em cada bairro</summary>
          <div className="table-responsive mt-2">
            <table className="table table-sm pendencias-table align-middle mb-0">
              <caption className="visually-hidden">Ruas sem cada campo, por bairro</caption>
              <thead>
                <tr>
                  <th scope="col">Bairro</th>
                  <th scope="col" className="text-end">Ruas</th>
                  {CAMPOS_PESQUISA.map((c) => (
                    <th scope="col" className="text-end" key={c.key}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendencias.map((b) => (
                  <tr key={b.nome}>
                    <th scope="row" className="fw-semibold">{b.nome}</th>
                    <td className="text-end">{b.total}</td>
                    {CAMPOS_PESQUISA.map((c) => {
                      const n = b.pendentes[c.key]
                      return (
                        <td className={`text-end ${n ? 'pendente' : 'completo'}`} key={c.key}>
                          {n ? `faltam ${n}` : <i className="bi bi-check-lg" aria-label="completo" />}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
