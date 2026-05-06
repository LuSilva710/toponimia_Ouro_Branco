/**
 * PdfGeneratorService.js
 * Módulo independente para geração de PDFs (Relatórios e Certificados)
 * Utiliza a biblioteca jsPDF
 */

import { supabase } from './supabase-client.js'

// ============================================
// CONSTANTES E CONFIGURAÇÕES
// ============================================
const CORES = {
  antropotoponimo: '#ED4A7B',
  fitotoponimo: '#109655',
  axiotoponimo: '#6B4B9A',
  hagiotoponimo: '#29B6F6',
  corotoponimo: '#FF7043',
  zootoponimo: '#26A69A',
  litotoponimo: '#607D8B',
  sociotoponimo: '#C5CB81',
  outro: '#DFDFDF',
}

const ROTULO_CATEGORIA = {
  antropotoponimo: 'Antropotopônimo',
  fitotoponimo: 'Fitotopônimo',
  axiotoponimo: 'Axiotopônimo',
  hagiotoponimo: 'Hagiotopônimo',
  corotoponimo: 'Corotopônimo',
  zootoponimo: 'Zootopônimo',
  litotoponimo: 'Litotopônimo',
  sociotoponimo: 'Sociotopônimo',
  outro: 'Outro / sem classificação',
}

const ORDEM_CATEGORIAS = [
  'antropotoponimo', 'fitotoponimo', 'axiotoponimo', 'hagiotoponimo',
  'corotoponimo', 'zootoponimo', 'litotoponimo', 'sociotoponimo', 'outro',
]

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

function hexRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}

function rotuloCategoriaToponimica(chaveNormalizada) {
  return ROTULO_CATEGORIA[chaveNormalizada] || (chaveNormalizada.charAt(0).toUpperCase() + chaveNormalizada.slice(1))
}

function normalizarCategoria(cat) {
  if (!cat) return 'outro'
  let n = String(cat)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim()
  n = n.replace(/[-_\s\u00a0]+/g, '')
  while (n.endsWith('toponimos')) n = n.slice(0, -1)
  if (CORES[n] !== undefined) return n
  return 'outro'
}

async function urlParaBase64(url) {
  if (!url) return null
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

// ============================================
// COMPONENTES DO PDF (Dicionário)
// ============================================

function pdfCapa(pdf, W, H, totalRuas, totalBairros, imgHeroB64) {
  if (imgHeroB64) {
    try { pdf.addImage(imgHeroB64, 'PNG', 0, 0, W, H, undefined, 'FAST') }
    catch { pdf.setFillColor(26, 26, 26); pdf.rect(0, 0, W, H, 'F') }
  } else {
    pdf.setFillColor(26, 26, 26); pdf.rect(0, 0, W, H, 'F')
  }

  pdf.setFillColor(0, 0, 0)
  pdf.setGState(pdf.GState({ opacity: 0.91 }))
  pdf.rect(0, 0, W, H, 'F')
  pdf.setGState(pdf.GState({ opacity: 1 }))

  pdf.setFillColor(15, 15, 15); pdf.rect(0, 0, W, 10, 'F')
  pdf.setFillColor(255, 255, 255)
  pdf.setGState(pdf.GState({ opacity: 0.1 }))
  pdf.rect(0, 9, W, 0.5, 'F')
  pdf.setGState(pdf.GState({ opacity: 1 }))

  pdf.setFillColor(255, 255, 255)
  pdf.setGState(pdf.GState({ opacity: 0.15 }))
  pdf.roundedRect(W/2 - 22, 22, 44, 9, 4, 4, 'F')
  pdf.setGState(pdf.GState({ opacity: 1 }))
  pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(255,255,255)
  pdf.text('IFMG · Instituto Federal de Minas Gerais', W/2, 28, {align:'center'})

  pdf.setFont('helvetica','bold'); pdf.setFontSize(34); pdf.setTextColor(255,255,255)
  pdf.text('Dicionário de Ruas', W/2, H/2 - 24, {align:'center'})
  pdf.text('de Ouro Branco', W/2, H/2 - 6, {align:'center'})

  pdf.setFont('helvetica','normal'); pdf.setFontSize(12); pdf.setTextColor(220, 220, 220)
  pdf.text('Descubra a história e significado por trás dos nomes das ruas da cidade', W/2, H/2 + 10, {align:'center'})

  pdf.setDrawColor(255,255,255); pdf.setLineWidth(0.3)
  pdf.setGState(pdf.GState({ opacity: 0.3 }))
  pdf.line(W/2 - 55, H/2 + 18, W/2 + 55, H/2 + 18)
  pdf.setGState(pdf.GState({ opacity: 1 }))

  const cardW = 55, cardH2 = 22, cardY = H/2 + 24, gap = 10
  const totalX = W/2 - cardW - gap/2
  const bairrX = W/2 + gap/2

  ;[totalX, bairrX].forEach(cx => {
    pdf.setFillColor(255,255,255)
    pdf.setGState(pdf.GState({ opacity: 0.12 }))
    pdf.roundedRect(cx, cardY, cardW, cardH2, 4, 4, 'F')
    pdf.setGState(pdf.GState({ opacity: 1 }))
  })

  pdf.setFont('helvetica','bold'); pdf.setFontSize(22); pdf.setTextColor(255,255,255)
  pdf.text(String(totalRuas), totalX + cardW/2, cardY + 13, {align:'center'})
  pdf.text(String(totalBairros), bairrX + cardW/2, cardY + 13, {align:'center'})

  pdf.setFont('helvetica','normal'); pdf.setFontSize(8); pdf.setTextColor(200,200,200)
  pdf.text('Logradouros catalogados', totalX + cardW/2, cardY + 19.5, {align:'center'})
  pdf.text('Bairros registrados', bairrX + cardW/2, cardY + 19.5, {align:'center'})

  pdf.setFont('helvetica','italic'); pdf.setFontSize(8); pdf.setTextColor(160,160,160)
  pdf.text('Classificação Taxonômica segundo Dick (1990)', W/2, cardY + cardH2 + 12, {align:'center'})

  pdf.setFillColor(0,0,0)
  pdf.setGState(pdf.GState({ opacity: 0.5 }))
  pdf.rect(0, H - 14, W, 14, 'F')
  pdf.setGState(pdf.GState({ opacity: 1 }))
  pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5); pdf.setTextColor(180,180,180)
  pdf.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 10, H - 5)
  pdf.text('Ouro Branco, Minas Gerais', W/2, H - 5, {align:'center'})
  pdf.text('Projeto TCC · IFMG', W - 10, H - 5, {align:'right'})
}

function pdfPaginaContexto(pdf, W, H, logoHeaderB64) {
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, W, H, 'F')

  const headerH = 22
  pdf.setFillColor(0, 0, 0)
  pdf.rect(0, 0, W, headerH, 'F')

  if (logoHeaderB64) {
    try {
      const logoW = 30
      const logoH = 8.4
      pdf.addImage(logoHeaderB64, 'PNG', (W - logoW) / 2, (headerH - logoH) / 2, logoW, logoH, undefined, 'FAST')
    } catch {}
  }

  const margemX = 22
  const gapColunas = 18
  const colW = (W - (margemX * 2) - gapColunas) / 2
  const colEsqX = margemX
  const colDirX = margemX + colW + gapColunas

  let yAtual = headerH + 18

  const blocos = [
    {
      titulo: 'Sobre o Projeto',
      texto: 'Propõe-se a continuidade do estudo da toponímia urbana ouro-branquense a partir da análise da motivação dos topônimos relativos aos espaços públicos de Ouro Branco - MG, resgatando a história local.',
      lado: 'esquerda',
      cor: [130, 90, 70]
    },
    {
      titulo: 'Nossa Missão',
      texto: 'Mostrar que os topônimos não são escolhidos aleatoriamente; permeiam questões sociopolíticas e culturais. Contribui para estudos linguísticos na inter-relação língua, cultura e sociedade.',
      lado: 'direita',
      cor: [130, 90, 70]
    },
    {
      titulo: 'Nossa Jornada',
      texto: 'Revela as histórias por trás dos nomes dos espaços públicos. Consolida-se com o portal educativo para compartilhar descobertas com a comunidade e escolas da região.',
      lado: 'esquerda',
      cor: [130, 90, 70]
    },
  ]

  blocos.forEach((bloco) => {
    const x = bloco.lado === 'direita' ? colDirX : colEsqX
    const tituloLinhas = pdf.splitTextToSize(bloco.titulo, colW - 10)
    const textoLinhas = pdf.splitTextToSize(bloco.texto, colW - 10)
    const alturaTitulo = tituloLinhas.length * 6
    const alturaTexto = textoLinhas.length * 4.8
    const blocoH = alturaTitulo + alturaTexto + 4

    pdf.setFillColor(250, 250, 252)
    pdf.roundedRect(x - 4, yAtual - 5, colW + 4, blocoH + 3, 1.5, 1.5, 'F')
    
    pdf.setFillColor(bloco.cor[0], bloco.cor[1], bloco.cor[2])
    pdf.rect(x - 4, yAtual - 5, 1.8, blocoH + 3, 'F')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.setTextColor(30, 30, 30)
    pdf.text(tituloLinhas, x + 2, yAtual)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(70, 70, 70)
    pdf.text(textoLinhas, x + 2, yAtual + alturaTitulo - 1)

    yAtual += blocoH + 8
  })

  const yTimelineBase = 238
  const margemTimeline = 20
  const widthTimeline = W - (margemTimeline * 2)
  
  pdf.setFillColor(240, 235, 230)
  pdf.roundedRect(W/2 - 40, yTimelineBase - 32, 80, 10, 5, 5, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(130, 90, 70)
  pdf.text('LINHA DO TEMPO DO PROJETO', W / 2, yTimelineBase - 25, { align: 'center' })

  pdf.setDrawColor(130, 90, 70)
  pdf.setLineWidth(0.8)
  pdf.line(margemTimeline, yTimelineBase, W - margemTimeline, yTimelineBase)

  const marcos = [
    { ano: '2018-2020', titulo: 'Fase Inicial', desc: 'Análise de nomeação de ruas, avenidas e praças de Ouro Branco.', alunos: 'Naiara e Dérlisson' },
    { ano: '2019-2020', titulo: 'Expansão da Equipe', desc: 'Continuação da análise da toponímia urbana.', alunos: 'Marcos Paulo e Giovana' },
    { ano: '2021-2022', titulo: 'Foco nas Escolas', desc: 'Investigação focada na microtoponímia.', alunos: 'Maria Raquel, Bruna e Shirley' },
    { ano: '2023-Pres.', titulo: 'Portal Educativo', desc: 'Desenvolvimento do portal educativo.', alunos: 'Ludmila e Marcos Túlio' }
  ]

  const step = widthTimeline / (marcos.length - 1)
  
  marcos.forEach((marco, i) => {
    const x = margemTimeline + (i * step)
    const intercalado = i % 2 === 0 ? 1 : -1
    
    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(130, 90, 70)
    pdf.setLineWidth(1)
    pdf.circle(x, yTimelineBase, 2.8, 'FD')
    pdf.setFillColor(130, 90, 70)
    pdf.circle(x, yTimelineBase, 1.2, 'F')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(130, 90, 70)
    pdf.text(marco.ano, x, yTimelineBase - (intercalado * 10), { align: 'center' })

    const yTextoBase = yTimelineBase + (intercalado * 8)
    
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(30, 30, 30)
    pdf.text(marco.titulo, x, yTextoBase + (intercalado * 2), { align: 'center' })

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(80, 80, 80)
    const descLinhas = pdf.splitTextToSize(marco.desc, (widthTimeline / marcos.length) - 6)
    pdf.text(descLinhas, x, yTextoBase + (intercalado * 7), { align: 'center' })

    const yAlunos = yTextoBase + (intercalado * (7 + (descLinhas.length * 4)))
    pdf.setFillColor(130, 90, 70)
    pdf.circle(x - 2, yAlunos + (intercalado * 2), 0.6, 'F')
    pdf.circle(x + 2, yAlunos + (intercalado * 2), 0.6, 'F')

    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(7)
    pdf.setTextColor(100, 100, 100)
    pdf.text(marco.alunos, x, yAlunos + (intercalado * 5), { align: 'center' })
  })

  pdf.setDrawColor(220, 220, 220)
  pdf.setLineWidth(0.3)
  pdf.line(margemX, H - 16, W - margemX, H - 16)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(110, 110, 110)
  pdf.text('Dicionário Toponímico de Ouro Branco-MG', margemX, H - 10.5)
  pdf.text('Pág. 2', W - margemX, H - 10.5, { align: 'right' })
}

function pdfCardBairro(pdf, W, startY, cardH, bairroNome, ruasDoBairro, imgB64, idx, total) {
  const PAD = 5
  const IMG_H = imgB64 ? 22 : 0
  const HDR_H = 14
  const NUM_COLS = 4

  const contagem = {}
  Object.keys(CORES).forEach(k => { contagem[k] = 0 })
  ruasDoBairro.forEach(r => {
    const cat = normalizarCategoria(r.categoria_toponimica)
    contagem[cat] = (contagem[cat] || 0) + 1
  })
  let catPredom = 'outro', maxCt = 0
  Object.entries(contagem).forEach(([k,v]) => { if (v > maxCt) { maxCt = v; catPredom = k } })
  const [rC,gC,bC] = hexRgb(CORES[catPredom] || CORES.outro)
  const catsOrdenadas = ORDEM_CATEGORIAS.filter(k => contagem[k] > 0).sort((a,b) => contagem[b]-contagem[a])

  let innerY = startY
  if (imgB64) {
    try { pdf.addImage(imgB64, 'JPEG', 0, startY, W, IMG_H, undefined, 'FAST') }
    catch { pdf.setFillColor(170,170,185); pdf.rect(0, startY, W, IMG_H, 'F') }
    pdf.setFillColor(0,0,0)
    pdf.setGState(pdf.GState({ opacity: 0.4 }))
    pdf.rect(0, startY, W, IMG_H, 'F')
    pdf.setGState(pdf.GState({ opacity: 1 }))
    innerY = startY + IMG_H
  }

  pdf.setFillColor(rC,gC,bC)
  pdf.rect(0, innerY, W, HDR_H, 'F')
  pdf.setFont('helvetica','bold'); pdf.setFontSize(6); pdf.setTextColor(255,255,255)
  pdf.text(`${String(idx+1).padStart(2,'0')}/${String(total).padStart(2,'0')}`, W-PAD, innerY+5, {align:'right'})
  pdf.setFont('helvetica','bold'); pdf.setFontSize(13); pdf.setTextColor(255,255,255)
  pdf.text(bairroNome, PAD, innerY+8)
  pdf.setFont('helvetica','normal'); pdf.setFontSize(7); pdf.setTextColor(255,255,255)
  pdf.text(`${ruasDoBairro.length} logradouros  \u00b7  ${rotuloCategoriaToponimica(catPredom)}`, PAD, innerY+HDR_H-2)

  let y = innerY + HDR_H + 3

  const BAR_ROW_H = 5.5
  const BAR_TITLE = 5.5
  const halfCats = Math.ceil(catsOrdenadas.length / 2)

  if (catsOrdenadas.length > 0) {
    pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(55,55,75)
    pdf.text('DISTRIBUIÇÃO POR CATEGORIA TOPONÍMICA', PAD, y + 4); y += BAR_TITLE

    const barColW = (W - PAD*2) / 2 - 3
    const barLabelW = 38
    const barMax = barColW - barLabelW - 16

    catsOrdenadas.forEach((k, i) => {
      const col = i < halfCats ? 0 : 1
      const row = i < halfCats ? i : i - halfCats
      const xOff = PAD + col * (barColW + 6)
      const rowY = y + row * BAR_ROW_H

      const v = contagem[k]
      const pct = ruasDoBairro.length > 0 ? v / ruasDoBairro.length : 0
      const barW = Math.max(1, pct * barMax)
      const [rk,gk,bk] = hexRgb(CORES[k] || CORES.outro)

      pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5); pdf.setTextColor(55,55,72)
      const label = rotuloCategoriaToponimica(k)
      pdf.text(label.length > 14 ? label.slice(0,13)+'.' : label, xOff, rowY + 3.5)

      pdf.setFillColor(215,215,228); pdf.roundedRect(xOff+barLabelW, rowY+0.5, barMax, 3.5, 1, 1, 'F')
      pdf.setFillColor(rk,gk,bk);   pdf.roundedRect(xOff+barLabelW, rowY+0.5, barW,  3.5, 1, 1, 'F')

      pdf.setFont('helvetica','bold'); pdf.setFontSize(5.5); pdf.setTextColor(35,35,60)
      pdf.text(`${v} (${(pct*100).toFixed(0)}%)`, xOff+barLabelW+barMax+2, rowY+3.5)
    })

    y += halfCats * BAR_ROW_H + 2
  }

  pdf.setDrawColor(195,195,212); pdf.setLineWidth(0.2)
  pdf.line(PAD, y, W-PAD, y); y += 2.5
  pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5); pdf.setTextColor(55,55,75)
  pdf.text('LOGRADOUROS \u2014 LISTAGEM COMPLETA ALFAB\u00c9TICA', PAD, y+2.5)
  y += 5.5

  const espacoRuas = startY + cardH - y - 1
  const totalN = ruasDoBairro.length
  const rowsNeeded = Math.ceil(totalN / NUM_COLS)
  const rowH = Math.max(2.8, Math.min(5.0, espacoRuas / Math.max(rowsNeeded, 1)))
  const fontSize = Math.max(4.5, Math.min(6.5, rowH * 1.3))
  const dotR = Math.max(0.6, rowH * 0.22)
  const maxPorCol = Math.ceil(totalN / NUM_COLS)
  const ruaColW = (W - PAD*2) / NUM_COLS

  const todasRuas = [...ruasDoBairro].sort((a,b) => (a.nome_oficial||'').localeCompare(b.nome_oficial||''))
  const colTextW = ruaColW - dotR*2 - 3.5

  todasRuas.forEach((r, i) => {
    const col = Math.floor(i / maxPorCol)
    const row = i % maxPorCol
    if (col >= NUM_COLS) return
    const xR = PAD + col * ruaColW
    const rowY = y + row * rowH
    const catR = normalizarCategoria(r.categoria_toponimica)
    const [ri,gi,bi] = hexRgb(CORES[catR] || CORES.outro)
    pdf.setFillColor(ri,gi,bi); pdf.circle(xR+dotR+0.3, rowY+rowH*0.45, dotR, 'F')
    pdf.setFont('helvetica','normal'); pdf.setFontSize(fontSize); pdf.setTextColor(20,20,45)
    const nome = r.nome_oficial || '\u2014'
    const linhas = pdf.splitTextToSize(nome, colTextW)
    pdf.text(linhas, xR+dotR*2+1.5, rowY+rowH*0.65)
  })
}

// ============================================
// EXPORTAÇÕES PÚBLICAS
// ============================================

export const PdfGeneratorService = {
  /**
   * Gera o relatório completo do dicionário toponímico
   */
  async exportFullReport(btnElement) {
    const originalContent = btnElement.innerHTML
    btnElement.disabled = true
    btnElement.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Gerando PDF...'

    try {
      const [{ data: ruas, error: errR }, { data: bairrosData, error: errB }] = await Promise.all([
        supabase.from('ruas').select('nome_oficial, categoria_toponimica, bairros(nome)').order('nome_oficial'),
        supabase.from('bairros').select('nome, imagem_capa').order('nome')
      ])
      if (errR) throw errR
      if (errB) throw errB

      const capaMap = {}
      bairrosData.forEach(b => { if(b.nome) capaMap[b.nome] = b.imagem_capa || null })

      const bairrosMap = {}
      ruas.forEach(r => {
        const nome = r.bairros?.nome || 'Sem Bairro'
        if (!bairrosMap[nome]) bairrosMap[nome] = []
        bairrosMap[nome].push(r)
      })
      const bairrosList = Object.entries(bairrosMap).sort((a,b) => a[0].localeCompare(b[0]))

      btnElement.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Carregando imagens...'
      const [imgHeroB64, imgLogoHeaderB64, ...imagensB64] = await Promise.all([
        urlParaBase64('./assets/images/ouro_branco_historico.png'),
        urlParaBase64('./assets/images/header/toponimia-black.png'),
        ...bairrosList.map(([nome]) => urlParaBase64(capaMap[nome]))
      ])

      btnElement.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Montando PDF...'
      const { jsPDF } = window.jspdf
      const pdf = new jsPDF('p', 'mm', 'a4')
      const W = 210, H = 297
      const FOOTER_H = 9
      const HALF = (H - FOOTER_H) / 2

      pdfCapa(pdf, W, H, ruas.length, bairrosList.length, imgHeroB64)

      pdf.addPage()
      pdfPaginaContexto(pdf, W, H, imgLogoHeaderB64)

      const totalPares = Math.ceil(bairrosList.length / 2)
      for (let i = 0; i < bairrosList.length; i += 2) {
        pdf.addPage()
        const paginaIdx = Math.floor(i / 2)

        pdf.setFillColor(245, 245, 250); pdf.rect(0, 0, W, H, 'F')
        pdf.setFillColor(25, 25, 55); pdf.rect(0, H - FOOTER_H, W, FOOTER_H, 'F')
        pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5); pdf.setTextColor(200,200,220)
        pdf.text('Dicionário Toponímico de Ouro Branco-MG · IFMG', 8, H-3.5)
        pdf.text(`Pág. ${paginaIdx + 3} / ${totalPares + 2}`, W-8, H-3.5, {align:'right'})

        const [nomeA, ruasA] = bairrosList[i]
        pdfCardBairro(pdf, W, 0, HALF, nomeA, ruasA, imagensB64[i], i, bairrosList.length)

        pdf.setDrawColor(180, 180, 200); pdf.setLineWidth(0.5)
        pdf.line(0, HALF, W, HALF)

        if (i + 1 < bairrosList.length) {
          const [nomeB, ruasB] = bairrosList[i + 1]
          pdfCardBairro(pdf, W, HALF, HALF, nomeB, ruasB, imagensB64[i + 1], i + 1, bairrosList.length)
        }
      }

      pdf.save('dicionario-toponomico-ouro-branco.pdf')
    } catch (err) {
      console.error('Erro ao exportar PDF:', err)
      alert('Erro ao gerar PDF. Tente novamente.')
    } finally {
      btnElement.disabled = false
      btnElement.innerHTML = originalContent
    }
  },

  /**
   * Gera o certificado de participação para o Quiz
   */
  generateCertificate(jogadorNome, pontuacao) {
    const { jsPDF } = window.jspdf
    const pdf = new jsPDF('l', 'mm', 'a4')

    pdf.setFillColor(15, 15, 35)
    pdf.rect(0, 0, 297, 210, 'F')

    pdf.setDrawColor(108, 99, 255)
    pdf.setLineWidth(2)
    pdf.rect(10, 10, 277, 190, 'S')

    pdf.setTextColor(108, 99, 255)
    pdf.setFontSize(28)
    pdf.text('Certificado de Participação', 148.5, 40, { align: 'center' })

    pdf.setTextColor(224, 224, 224)
    pdf.setFontSize(14)
    pdf.text('Toponímia Urbana de Ouro Branco — IFMG', 148.5, 55, { align: 'center' })

    pdf.setFontSize(16)
    pdf.text(`Certificamos que`, 148.5, 80, { align: 'center' })

    pdf.setFontSize(24)
    pdf.setTextColor(108, 99, 255)
    pdf.text(jogadorNome || 'Participante', 148.5, 95, { align: 'center' })

    pdf.setTextColor(224, 224, 224)
    pdf.setFontSize(14)
    pdf.text(`completou o Quiz Toponímia com ${pontuacao} pontos`, 148.5, 115, { align: 'center' })

    pdf.setFontSize(12)
    pdf.setTextColor(136, 136, 170)
    pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 148.5, 140, { align: 'center' })

    pdf.save(`certificado-quiz-${jogadorNome || 'participante'}.pdf`)
  }
}
