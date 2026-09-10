/**
 * Smoke browser das páginas MPA (Playwright).
 * Uso: node scripts/smoke-mpa.mjs [baseUrl]
 * Ex.: node scripts/smoke-mpa.mjs http://127.0.0.1:4173
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv[2] || 'http://127.0.0.1:4173/toponimia_Ouro_Branco').replace(/\/$/, '')

const CASES = [
  {
    id: 'home',
    path: '/index.html',
    checks: [
      { name: 'root-react', sel: '#root > *' },
      { name: 'navbar', sel: 'nav.navbar, .navbar' },
      { name: 'onim-button', sel: '#newChatbotButton' },
    ],
  },
  {
    id: 'about',
    path: '/about.html',
    checks: [{ name: 'root-react', sel: '#root > *' }],
  },
  {
    id: 'mapa',
    path: '/mapa.html',
    checks: [
      { name: 'root-react', sel: '#root > *' },
      { name: 'map-container', sel: '#map, .leaflet-container, [class*="mapa"]', soft: true },
    ],
  },
  {
    id: 'estatisticas',
    path: '/estatisticas.html',
    checks: [
      { name: 'root-react', sel: '#root > *' },
      { name: 'export-or-title', sel: '#btn-exportar-pdf, h1', soft: true },
    ],
  },
  {
    id: 'admin',
    path: '/admin.html',
    checks: [{ name: 'root-react', sel: '#root > *' }],
  },
  {
    id: 'portal',
    path: '/portaleducativo.html',
    checks: [
      { name: 'root-react', sel: '#root > *' },
      { name: 'quiz-link', sel: 'a[href*="quiz"]', soft: true },
    ],
  },
  {
    id: 'quiz',
    path: '/games/quiz.html',
    checks: [
      { name: 'root-react', sel: '#root > *' },
      { name: 'game-chrome', sel: '.navbar-brand' },
    ],
  },
  {
    id: 'associacao',
    path: '/games/associacao.html',
    checks: [
      { name: 'root-react', sel: '#root > *' },
      { name: 'game-chrome', sel: '.navbar-brand' },
    ],
  },
  {
    id: 'cruzadinha',
    path: '/games/cruzadinha.html',
    checks: [
      { name: 'root-react', sel: '#root > *' },
      { name: 'title', sel: '.game-title' },
      { name: 'grid', sel: '#crossword .grid-cell' },
      { name: 'check-btn', sel: 'button.game-button.check' },
      { name: 'hint-btn', sel: 'button.game-button.hint' },
      { name: 'clues', sel: '#clues-list li' },
    ],
  },
  {
    id: 'ranking',
    path: '/games/ranking.html',
    checks: [
      { name: 'root-react', sel: '#root > *' },
      { name: 'game-chrome', sel: '.navbar-brand' },
    ],
  },
]

function nowIso() {
  return new Date().toISOString()
}

async function runCase(page, c) {
  const url = `${BASE}${c.path}`
  const result = {
    id: c.id,
    path: c.path,
    url,
    ok: true,
    checks: [],
    consoleErrors: [],
    pageError: null,
  }

  const onConsole = (msg) => {
    if (msg.type() === 'error') result.consoleErrors.push(msg.text())
  }
  const onPageError = (err) => {
    result.pageError = String(err)
    result.ok = false
  }

  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    if (!resp || !resp.ok()) {
      result.ok = false
      result.checks.push({ name: 'http', pass: false, detail: `status ${resp?.status()}` })
    } else {
      result.checks.push({ name: 'http', pass: true, detail: `status ${resp.status()}` })
    }

    await page.waitForTimeout(800)

    for (const check of c.checks) {
      const count = await page.locator(check.sel).count()
      const pass = count > 0
      if (!pass && !check.soft) result.ok = false
      result.checks.push({
        name: check.name,
        pass,
        soft: !!check.soft,
        detail: `count=${count} sel=${check.sel}`,
      })
    }
  } catch (err) {
    result.ok = false
    result.pageError = String(err)
  } finally {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
  }

  return result
}

async function main() {
  // Default: Chromium do Playwright (`npx playwright install chromium`).
  // Override: SMOKE_CHANNEL=chrome|msedge se preferir browser do sistema.
  const launchOpts = { headless: true }
  if (process.env.SMOKE_CHANNEL) {
    launchOpts.channel = process.env.SMOKE_CHANNEL
  }
  const browser = await chromium.launch(launchOpts)
  const page = await browser.newPage()
  const results = []

  for (const c of CASES) {
    process.stdout.write(`Smoke ${c.id}... `)
    const r = await runCase(page, c)
    results.push(r)
    console.log(r.ok ? 'PASS' : 'FAIL')
  }

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  const report = {
    ranAt: nowIso(),
    baseUrl: BASE,
    summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
    results,
  }

  const outDir = join(__dirname, '..', '.cursor', 'qa-reports')
  mkdirSync(outDir, { recursive: true })
  const outJson = join(outDir, `smoke-mpa-${Date.now()}.json`)
  writeFileSync(outJson, JSON.stringify(report, null, 2), 'utf8')

  const mdLines = [
    `# Smoke MPA — ${report.ranAt}`,
    '',
    `Base: \`${BASE}\``,
    '',
    `**${report.summary.passed}/${report.summary.total} passou** (${report.summary.failed} falhou)`,
    '',
    '| Página | Resultado | Detalhe |',
    '|--------|-----------|---------|',
  ]
  for (const r of results) {
    const fails = r.checks.filter((c) => !c.pass && !c.soft).map((c) => c.name)
    const softFails = r.checks.filter((c) => !c.pass && c.soft).map((c) => c.name)
    const detail = [
      fails.length ? `fail: ${fails.join(', ')}` : '',
      softFails.length ? `soft: ${softFails.join(', ')}` : '',
      r.pageError ? `error: ${r.pageError.slice(0, 120)}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
    mdLines.push(`| ${r.id} | ${r.ok ? 'PASS' : 'FAIL'} | ${detail || 'ok'} |`)
  }
  mdLines.push('', `JSON: \`${outJson}\``, '')
  const outMd = join(outDir, 'smoke-mpa-latest.md')
  writeFileSync(outMd, mdLines.join('\n'), 'utf8')

  console.log('\n' + mdLines.join('\n'))
  if (failed.length) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
