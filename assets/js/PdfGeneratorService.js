/**
 * PdfGeneratorService.js
 * Módulo para geração de Dossiê Toponímico (Estilo Arquivo Histórico)
 * Referência Visual: AHM-SP (2021_AHM_Jogo Arquivo Nômade)
 */

import { supabase } from './supabase-client.js'

// ============================================
// CONSTANTES E CONFIGURAÇÕES (ESTILO ARQUIVO)
// ============================================
const ESTILO = {
    papel: '#FDFBF7',     // Bege arquivo
    linha: '#8C7E6D',     // Sépia para bordas
    textoForte: '#2C2621', 
    recorte: [180, 180, 180] // Cinza claro para o tracejado
}

const CORES_CATEGORIA = {
    antropotoponimo: '#8E3E56', // Tons dessaturados (mais sóbrios)
    fitotoponimo: '#3D6142',
    axiotoponimo: '#4B3B6D',
    hagiotoponimo: '#2E5E7A',
    corotoponimo: '#A3543A',
    zootoponimo: '#316B61',
    litotoponimo: '#4D5D66',
    sociotoponimo: '#7A7D4D',
    outro: '#A0A0A0',
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
    let n = String(cat).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    n = n.replace(/[-_\s\u00a0]+/g, '')
    while (n.endsWith('toponimos')) n = n.slice(0, -1)
    return CORES_CATEGORIA[n] !== undefined ? n : 'outro'
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
            reader.readAsDataURL(blob)
        })
    } catch { return null }
}

/**
 * Função auxiliar para anexar um PDF externo ao final do documento gerado
 */
async function anexarCruzadinha(jspdfBuffer) {
    try {
        if (!window.PDFLib) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/pdf-lib/dist/pdf-lib.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        const { PDFDocument, rgb, degrees } = window.PDFLib;
        
        const mainPdf = await PDFDocument.load(jspdfBuffer);
        
        // Busca o arquivo da cruzadinha (tentando caminhos comuns e tratando espaços)
        const filePath = 'assets/docs/Cruzadinha (A4).pdf';
        const encodedPath = encodeURI(filePath);
        
        let response = null;
        const tries = [
            './' + encodedPath,
            '../' + encodedPath,
            '../../' + encodedPath,
            window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) + '/' + encodedPath,
            '/' + encodedPath // Tenta da raiz do domínio
        ];

        for (const url of tries) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    response = res;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!response || !response.ok) {
            console.error('ERRO: Não foi possível carregar a cruzadinha em nenhuma das rotas:', tries);
            return jspdfBuffer;
        }
        
        const extraPdfBuffer = await response.arrayBuffer();
        const extraPdf = await PDFDocument.load(extraPdfBuffer);
        
        const pages = await mainPdf.copyPages(extraPdf, extraPdf.getPageIndices());
        
        const [embeddedPages] = [await mainPdf.embedPages(pages)];
        
        for (let i = 0; i < pages.length; i++) {
            const originalPage = pages[i];
            const embeddedPage = embeddedPages[i];
            const { width: origW, height: origH } = originalPage.getSize();
            const isLandscape = origW > origH;

            // Cria uma nova página A4 Retrato (595.28 x 841.89 pontos)
            const newPage = mainPdf.addPage([595.28, 841.89]);
            const PAGE_W = 595.28;
            const PAGE_H = 841.89;
            
            // Área disponível dentro das bordas tracejadas (7mm = 19.84 pts) para igualar ao jspdf
            const BORDER_PAD = 19.84; 
            const AVAIL_W = PAGE_W - (BORDER_PAD * 2);
            const AVAIL_H = PAGE_H - (BORDER_PAD * 2);
            
            let scale, drawX, drawY, rotate;

            if (isLandscape) {
                // Maximiza para caber na área disponível, mantendo proporção
                scale = Math.min(AVAIL_W / origH, AVAIL_H / origW);
                const drawW = origH * scale;
                const drawH = origW * scale;
                drawX = BORDER_PAD + (AVAIL_W - drawW) / 2;
                drawY = BORDER_PAD + (AVAIL_H - drawH) / 2;
                rotate = degrees(90);

                newPage.drawPage(embeddedPage, {
                    x: drawX + drawW, 
                    y: drawY,
                    width: origW * scale,
                    height: origH * scale,
                    rotate: rotate,
                });
            } else {
                // Já é retrato
                scale = Math.min(AVAIL_W / origW, AVAIL_H / origH);
                const drawW = origW * scale;
                const drawH = origH * scale;
                drawX = BORDER_PAD + (AVAIL_W - drawW) / 2;
                drawY = BORDER_PAD + (AVAIL_H - drawH) / 2;
                rotate = degrees(0);

                newPage.drawPage(embeddedPage, {
                    x: drawX,
                    y: drawY,
                    width: drawW,
                    height: drawH,
                    rotate: rotate,
                });
            }
            

            // Desenha as 4 linhas da borda separadamente para garantir o efeito tracejado (dashArray)
            const bx = BORDER_PAD;
            const by = BORDER_PAD;
            const bw = PAGE_W - (BORDER_PAD * 2);
            const bh = PAGE_H - (BORDER_PAD * 2);
            const borderStyle = {
                color: rgb(0.7, 0.7, 0.7),
                thickness: 0.85,
                dashArray: [5.6, 5.6],
            };

            newPage.drawLine({ start: { x: bx, y: by }, end: { x: bx + bw, y: by }, ...borderStyle });
            newPage.drawLine({ start: { x: bx + bw, y: by }, end: { x: bx + bw, y: by + bh }, ...borderStyle });
            newPage.drawLine({ start: { x: bx + bw, y: by + bh }, end: { x: bx, y: by + bh }, ...borderStyle });
            newPage.drawLine({ start: { x: bx, y: by + bh }, end: { x: bx, y: by }, ...borderStyle });

            // Adiciona a indicação de recorte igual às outras páginas
            newPage.drawText('Destaque para o seu Dossie de Campo', {
                x: PAGE_W / 2 - 55,
                y: PAGE_H - 14, // 5mm do topo
                size: 8,
                color: rgb(0.5, 0.5, 0.5),
            });
        }
        
        return await mainPdf.save();
    } catch (err) {
        console.error('Erro ao mesclar e estilizar PDFs:', err);
        return jspdfBuffer;
    }
}

// ============================================
// COMPONENTES DO PDF (DOSSIÊ PATRIMONIAL)
// ============================================

function aplicarGuiaRecorte(pdf, W, H) {
    pdf.setGState(pdf.GState({ opacity: 0.6 }));
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.3);
    pdf.setLineDash([2, 2]); 
    pdf.rect(7, 7, W - 14, H - 14, 'S');
    pdf.setLineDash([]);
    pdf.setGState(pdf.GState({ opacity: 1 }));
    
    pdf.setFontSize(8);
    pdf.text('✂  Destaque para o seu Dossiê de Campo', W/2, 5, { align: 'center' });
}

function pdfCapa(pdf, W, H, totalRuas, totalBairros, imgHeroB64) {
    pdf.setFillColor(253, 251, 247);
    pdf.rect(0, 0, W, H, 'F');

    if (imgHeroB64) {
        try { 
            pdf.setGState(pdf.GState({ opacity: 0.2 }));
            pdf.addImage(imgHeroB64, 'PNG', 0, 0, W, H, undefined, 'FAST');
            pdf.setGState(pdf.GState({ opacity: 1 }));
        } catch {}
    }

    pdf.setFont('times', 'bold');
    pdf.setFontSize(26);
    pdf.setTextColor(44, 38, 33);
    pdf.text('DICIONÁRIO DE RUAS', W/2, H/2 - 10, {align:'center'});
    pdf.setFontSize(14);
    pdf.text('OURO BRANCO - MINAS GERAIS', W/2, H/2 + 2, {align:'center'});

    pdf.setDrawColor(140, 126, 109);
    pdf.line(W/2 - 50, H/2 + 15, W/2 + 50, H/2 + 15);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`${totalRuas} logradouros catalogados`, W/2, H/2 + 22, {align:'center'});
    pdf.text(`${totalBairros} bairros registrados`, W/2, H/2 + 28, {align:'center'});

    pdf.setFontSize(7);
    pdf.text('PROJETO TOPONÍMIA URBANA | IFMG CAMPUS OURO BRANCO', W/2, H - 15, {align:'center'});
}

function pdfPaginaContexto(pdf, W, H, logoHeaderB64) {
    pdf.addPage();
    pdf.setFillColor(253, 251, 247);
    pdf.rect(0, 0, W, H, 'F');
    aplicarGuiaRecorte(pdf, W, H);

    const headerH = 22;
    pdf.setFillColor(44, 38, 33);
    pdf.rect(7, 7, W-14, headerH, 'F');

    if (logoHeaderB64) {
        try {
            const logoW = 30;
            const logoH = 8.4;
            pdf.addImage(logoHeaderB64, 'PNG', (W - logoW) / 2, 7 + (headerH - logoH) / 2, logoW, logoH, undefined, 'FAST');
        } catch {}
    }

    const margemX = 20;
    let y = 40;

    // ── Título da Seção
    pdf.setFont('times', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(44, 38, 33);
    pdf.text('NOTAS TÉCNICAS E CONTEXTO DO PROJETO', W/2, y, { align: 'center' });
    y += 12;

    // ── Bloco: O que é a Toponímia?
    const boxW = W - (margemX * 2);
    pdf.setFont('times', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(60, 50, 45);
    const introText = 'O projeto tem como foco o estudo da toponímia urbana — ou seja, os nomes de ruas, praças e escolas — da cidade de Ouro Branco/MG. Esses nomes não são aleatórios: refletem aspectos sociais, culturais e históricos da comunidade, funcionando como guardiões da memória coletiva local. Este dossiê apresenta o resultado de anos de pesquisa documental e de campo sobre os logradouros de Ouro Branco - MG, revelando como a história da cidade está "escrita" em suas placas de rua.';
    const introLines = pdf.splitTextToSize(introText, boxW - 10);
    pdf.text(introLines, margemX + 5, y);
    y += (introLines.length * 4) + 10;

    // ── Duas Colunas: Missão e Metodologia
    const colW = (W - (margemX * 2) - 15) / 2;
    
    // Coluna Esquerda: Missão
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    pdf.text('NOSSA MISSÃO', margemX, y);
    pdf.setFont('times', 'normal');
    pdf.setFontSize(9);
    const missaoTxt = 'Resgatar a memória local e oferecer um recurso educativo para escolas e pesquisadores, promovendo o sentimento de pertencimento através do conhecimento histórico.';
    pdf.text(pdf.splitTextToSize(missaoTxt, colW), margemX, y + 5);

    // Coluna Direita: Metodologia
    pdf.setFont('times', 'bold');
    pdf.text('METODOLOGIA', margemX + colW + 15, y);
    pdf.setFont('times', 'normal');
    const metodoTxt = 'Baseada na taxonomia de Dick (1990), a pesquisa classifica os nomes em categorias (antropotopônimos, fitotopônimos, etc.) para entender as motivações das nomeações.';
    pdf.text(pdf.splitTextToSize(metodoTxt, colW), margemX + colW + 15, y + 5);
    
    y += 28;

    // ── Guia de Classificação (O Coração do Dossiê)
    pdf.setDrawColor(140, 126, 109);
    pdf.setLineWidth(0.5);
    pdf.line(margemX, y, W - margemX, y);
    y += 8;

    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    pdf.text('GUIA DE LEITURA: CLASSIFICAÇÃO TAXONÔMICA', W/2, y, { align: 'center' });
    y += 8;

    // Grid de Categorias (3 colunas)
    const catColW = (W - (margemX * 2)) / 3;
    ORDEM_CATEGORIAS.forEach((cat, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const curX = margemX + (col * catColW);
        const curY = y + (row * 10);

        const [r, g, b] = hexRgb(CORES_CATEGORIA[cat] || CORES_CATEGORIA.outro);
        pdf.setFillColor(r, g, b);
        pdf.circle(curX + 2, curY - 1, 1.2, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(44, 38, 33);
        pdf.text(rotuloCategoriaToponimica(cat).toUpperCase(), curX + 6, curY);
        
        pdf.setFont('times', 'italic');
        pdf.setFontSize(6.5);
        pdf.setTextColor(100, 90, 80);
        const descS = {
            antropotoponimo: 'Nomes de pessoas',
            fitotoponimo: 'Nomes de plantas',
            hagiotoponimo: 'Nomes de santos',
            axiotoponimo: 'Títulos e dignidades',
            corotoponimo: 'Nomes de regiões',
            zootoponimo: 'Nomes de animais',
            litotoponimo: 'Nomes de minerais',
            sociotoponimo: 'Nomes de grupos sociais',
            outro: 'Outras motivações'
        }[cat] || '';
        pdf.text(descS, curX + 6, curY + 3.5);
    });

    // ── Título da Evolução (Box Arredondado Sépia)
    y += 35;
    const titleW = 80;
    const titleH = 10;
    pdf.setFillColor(140, 126, 109);
    pdf.roundedRect((W - titleW) / 2, y, titleW, titleH, 4, 4, 'F');
    pdf.setFont('times', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(255, 255, 255);
    pdf.text('Evolução do Projeto: Toponímia', W/2, y + 4, { align: 'center' });
    pdf.text('Urbana de Ouro Branco (2016-Atual)', W/2, y + 8, { align: 'center' });
    
    y += titleH + 4;

    // ── Estrutura de Linhas (Gaiola)
    pdf.setDrawColor(140, 126, 109);
    pdf.setLineWidth(0.3);
    
    const timelineMargin = 15;
    const timelineW = W - (timelineMargin * 2);
    const startX = timelineMargin;
    const endX = W - timelineMargin;
    const forkY = y + 4;
    const itemY = forkY + 12;

    // Linha horizontal principal
    pdf.line(startX, forkY, endX, forkY);
    
    const marcos = [
        { ano: '2016-2020', desc: 'Análise da influência da Metalurgia na denominação de nomes de ruas.\nAlunos: Naiara e Dérlisson.' },
        { ano: '2019-2020', desc: 'Atenção para dinâmica de ruas, avenidas e praças.\nAlunos: Marcos Paulo e Giovana Lana.' },
        { ano: '2021', desc: 'Investigação focada na microtoponímia urbana.\nAluna: Maria Raquel Honorata.' },
        { ano: '2021-2022', desc: 'Análise dos nomes das escolas públicas.\nAlunas: Bruna dos Santos e Shirley Pereira.' },
        { ano: '2022-2023', desc: 'Continuação da análise microtoponímica.\nAlunas: Shirley Pereira e Ana Paula Rafael.' },
        { ano: '2023-2024', desc: 'Consolidação da pesquisa em microtoponímia.\nAluna: Ludmila Silva.' },
        { ano: '2024-Atual', desc: 'Finalização e início da fase de extensão.\nAlunos: Ludmila Silva e Marcos Túlio.' }
    ];

    const step = timelineW / (marcos.length - 1);
    
    marcos.forEach((m, i) => {
        const x = startX + i * step;
        
        pdf.line(x, forkY, x, itemY - 5);
        
        pdf.setFillColor(255, 255, 255);
        pdf.circle(x, itemY, 3.5, 'FD');
        pdf.setFillColor(140, 126, 109);
        pdf.circle(x, itemY, 2.2, 'F');
        
        pdf.setLineWidth(0.15);
        pdf.circle(x, itemY, 4.8, 'S');

        pdf.setFont('times', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(140, 126, 109);
        pdf.text(m.ano + ':', x, itemY + 7, { align: 'center' });
        
        pdf.setFont('times', 'normal');
        pdf.setFontSize(5.5);
        pdf.setTextColor(60, 50, 45);
        const descLines = pdf.splitTextToSize(m.desc, step - 1);
        pdf.text(descLines, x, itemY + 10, { align: 'center', lineHeightFactor: 1.15 });
    });

    // ── Rodapé
    pdf.setFont('times', 'italic');
    pdf.setFontSize(7);
    pdf.setTextColor(150, 140, 130);
    pdf.text('Dossiê gerado automaticamente pelo Portal Toponímia Urbana - IFMG Campus Ouro Branco', W/2, H - 12, { align: 'center' });
}

function pdfFichaBairro(pdf, W, H, bairroNome, ruasDoBairro, imgB64) {
    pdf.addPage();
    pdf.setFillColor(253, 251, 247);
    pdf.rect(0, 0, W, H, 'F');
    
    aplicarGuiaRecorte(pdf, W, H);

    if (imgB64) {
        try { pdf.addImage(imgB64, 'JPEG', 10, 12, W-20, 45, undefined, 'FAST'); } catch {}
    }

    pdf.setFont('times', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(44, 38, 33);
    pdf.text(`FICHA: ${bairroNome.toUpperCase()}`, 12, 68);
    
    // ── Estatísticas por Bairro (Gráfico de Barras)
    const contagem = {};
    ORDEM_CATEGORIAS.forEach(k => { contagem[k] = 0 });
    ruasDoBairro.forEach(r => {
        const cat = normalizarCategoria(r.categoria_toponimica);
        contagem[cat] = (contagem[cat] || 0) + 1;
    });
    
    const catsPresentes = ORDEM_CATEGORIAS.filter(k => contagem[k] > 0).sort((a,b) => contagem[b]-contagem[a]);
    
    let statsY = 75;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('COMPOSIÇÃO TOPONÍMICA DO BAIRRO', 12, statsY);
    
    const barMaxW = 40;
    const barH = 4;
    const gapY = 5;
    
    catsPresentes.slice(0, 5).forEach((cat, i) => {
        const rowY = statsY + 4 + (i * gapY);
        const v = contagem[cat];
        const pct = v / ruasDoBairro.length;
        const barW = Math.max(1, pct * barMaxW);
        const [r, g, b] = hexRgb(CORES_CATEGORIA[cat] || CORES_CATEGORIA.outro);
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.5);
        pdf.setTextColor(60, 50, 45);
        const label = rotuloCategoriaToponimica(cat);
        pdf.text(label, 12, rowY + 3);
        
        pdf.setFillColor(235, 230, 220); // Fundo da barra (bege mais escuro)
        pdf.rect(45, rowY, barMaxW, barH, 'F');
        pdf.setFillColor(r, g, b);
        pdf.rect(45, rowY, barW, barH, 'F');
        
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${v}`, 45 + barMaxW + 2, rowY + 3);
    });

    // Listagem de Ruas
    let y = 110;
    const NUM_COLS = 3;
    const colW = (W - 24) / NUM_COLS;
    
    pdf.setFont('times', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(44, 38, 33);
    
    ruasDoBairro.forEach((r, i) => {
        const col = i % NUM_COLS;
        const row = Math.floor(i / NUM_COLS);
        const rowY = y + (row * 4.5);
        
        if (rowY < H - 25) {
            const catR = normalizarCategoria(r.categoria_toponimica);
            const [rc, gc, bc] = hexRgb(CORES_CATEGORIA[catR] || CORES_CATEGORIA.outro);
            pdf.setDrawColor(rc, gc, bc);
            pdf.setLineWidth(0.3);
            pdf.circle(12 + (col * colW), rowY - 1, 0.5, 'S'); // Marcador colorido pela categoria
            pdf.text(r.nome_oficial || '', 15 + (col * colW), rowY);
        }
    });

    pdf.setFont('times', 'italic');
    pdf.setFontSize(8);
    pdf.text('Atividade: Identifique uma rua e pesquise seu significado no portal ONIM.', W/2, H - 12, {align:'center'});
}

/**
 * Adiciona uma página de Cards de Memória destacáveis
 */

// ============================================
// EXPORTAÇÕES PÚBLICAS
// ============================================

export const PdfGeneratorService = {
    async exportFullReport(btnElement) {
        const originalContent = btnElement.innerHTML;
        btnElement.disabled = true;
        btnElement.innerHTML = 'Preparando Dossiê...';

        try {
            const [ruasRes, bairrosRes] = await Promise.all([
                supabase.from('ruas').select('nome_oficial, categoria_toponimica, bairros(nome), significado').order('nome_oficial'),
                supabase.from('bairros').select('nome, imagem_capa').order('nome')
            ]);

            if (ruasRes.error) throw new Error(`Erro ao buscar ruas: ${ruasRes.error.message}`);
            if (bairrosRes.error) throw new Error(`Erro ao buscar bairros: ${bairrosRes.error.message}`);

            const ruas = ruasRes.data || [];
            const bairrosData = bairrosRes.data || [];

            if (ruas.length === 0) throw new Error('Nenhum dado de ruas encontrado para exportação.');

            const bairrosMap = {};
            ruas.forEach(r => {
                const n = r.bairros?.nome || 'Sem Bairro';
                if (!bairrosMap[n]) bairrosMap[n] = [];
                bairrosMap[n].push(r);
            });

            if (!window.jspdf) throw new Error('Biblioteca jsPDF não carregada. Verifique sua conexão.');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const W = 210, H = 297;

            const imgHero = await urlParaBase64('./assets/images/ouro_branco_historico.png');
            const imgLogo = await urlParaBase64('./assets/images/header/toponimia-black.png');
            
            pdfCapa(pdf, W, H, ruas.length, Object.keys(bairrosMap).length, imgHero);
            
            // Página de Contexto (Pág 2)
            pdfPaginaContexto(pdf, W, H, imgLogo);

            for (const [nome, listaRuas] of Object.entries(bairrosMap)) {
                const bairroInfo = bairrosData.find(b => b.nome === nome);
                const imgB64 = await urlParaBase64(bairroInfo?.imagem_capa);
                pdfFichaBairro(pdf, W, H, nome, listaRuas, imgB64);
            }

            // Em vez de pdf.save, geramos o buffer e tentamos anexar a cruzadinha
            const dossieBuffer = pdf.output('arraybuffer');
            const finalBuffer = await anexarCruzadinha(dossieBuffer);

            // Download do arquivo final (Dossiê + Cruzadinha)
            const blob = new Blob([finalBuffer], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'dossie-patrimonial-ouro-branco.pdf';
            link.click();
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error('Erro detalhado no PDF:', err);
            alert(`Erro ao gerar documento: ${err.message || 'Erro desconhecido'}`);
        } finally {
            btnElement.disabled = false;
            btnElement.innerHTML = originalContent;
        }
    },

    generateCertificate(jogadorNome, pontuacao) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4');

        pdf.setFillColor(44, 38, 33);
        pdf.rect(0, 0, 297, 210, 'F');

        pdf.setDrawColor(140, 126, 109);
        pdf.setLineWidth(2);
        pdf.rect(10, 10, 277, 190, 'S');

        pdf.setTextColor(253, 251, 247);
        pdf.setFontSize(28);
        pdf.text('Certificado de Participação', 148.5, 40, { align: 'center' });

        pdf.setFontSize(14);
        pdf.text('Toponímia Urbana de Ouro Branco — IFMG', 148.5, 55, { align: 'center' });

        pdf.setFontSize(16);
        pdf.text(`Certificamos que`, 148.5, 80, { align: 'center' });

        pdf.setFontSize(24);
        pdf.setTextColor(140, 126, 109);
        pdf.text(jogadorNome || 'Participante', 148.5, 95, { align: 'center' });

        pdf.setTextColor(253, 251, 247);
        pdf.setFontSize(14);
        pdf.text(`completou o Quiz Toponímia com ${pontuacao} pontos`, 148.5, 115, { align: 'center' })

        pdf.setFontSize(12);
        pdf.setTextColor(180, 170, 160);
        pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 148.5, 140, { align: 'center' });

        pdf.save(`certificado-quiz-${jogadorNome || 'participante'}.pdf`);
    }
};