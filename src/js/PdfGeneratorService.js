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

function normalizePath(path) {
    if (!path) return '';
    let p = path.trim();
    p = p.replace(/^\.\//, '');
    p = p.replace(/^\//, '');
    p = p.replace(/^assets\//, '');
    p = p.replace(/^public\//, '');
    const base = import.meta.env.BASE_URL || '/';
    return base + p;
}

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
        const filePath = normalizePath('docs/Cruzadinha (A4).pdf');
        const encodedPath = encodeURI(filePath);
        
        // Determina a base da URL para produção (Vite)
        const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ? import.meta.env.BASE_URL : '/';
        
        let response = null;
        const tries = [
            baseUrl + encodedPath,
            './' + encodedPath,
            '/' + encodedPath,
            window.location.origin + baseUrl + encodedPath
        ].map(url => {
            // Se a URL começar com http ou https, tratamos com cuidado para não quebrar o protocolo
            if (url.startsWith('http')) {
                const parts = url.split('://');
                return parts[0] + '://' + parts[1].replace(/\/+/g, '/');
            }
            return url.replace(/\/+/g, '/');
        });

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
    if (typeof pdf.GState === 'function') {
        try {
            pdf.setGState(pdf.GState({ opacity: 0.6 }));
        } catch (e) { console.warn('GState falhou em aplicarGuiaRecorte:', e); }
    }
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.3);
    pdf.setLineDash([2, 2]); 
    pdf.rect(7, 7, W - 14, H - 14, 'S');
    pdf.setLineDash([]);
    if (typeof pdf.GState === 'function') {
        try {
            pdf.setGState(pdf.GState({ opacity: 1 }));
        } catch (e) {}
    }
    
    pdf.setFontSize(8);
    pdf.text('Toponímia Urbana de Ouro Branco', W/2, 5, { align: 'center' });
}

function pdfCapa(pdf, W, H, totalRuas, totalBairros, imgHeroB64) {
    pdf.setFillColor(253, 251, 247);
    pdf.rect(0, 0, W, H, 'F');

    if (imgHeroB64) {
        try { 
            if (typeof pdf.GState === 'function') {
                pdf.setGState(pdf.GState({ opacity: 0.2 }));
            }
            pdf.addImage(imgHeroB64, 'PNG', 0, 0, W, H, undefined, 'FAST');
            if (typeof pdf.GState === 'function') {
                pdf.setGState(pdf.GState({ opacity: 1 }));
            }
        } catch (e) {
            console.warn('Falha ao adicionar imagem hero no PDF:', e);
        }
    }

    pdf.setFont('times', 'bold');
    pdf.setFontSize(26);
    pdf.setTextColor(44, 38, 33);
    // Quebra de linha manual dividindo o título em dois
    pdf.text(['Tradição e Memória Cultural na', 'Toponímia Urbana de Ouro Branco'], W/2, H/2 - 30, {align:'center'});

    pdf.setFontSize(20);
    pdf.text('DICIONÁRIO DE RUAS', W/2, H/2 - 5, {align:'center'});
    pdf.setFontSize(14);
    pdf.text('OURO BRANCO - MINAS GERAIS', W/2, H/2 + 7, {align:'center'});

    pdf.setDrawColor(140, 126, 109);
    pdf.line(W/2 - 50, H/2 + 18, W/2 + 50, H/2 + 18);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`${totalRuas} ruas catalogadas`, W/2, H/2 + 25, {align:'center'});
    pdf.text(`${totalBairros} bairros registrados`, W/2, H/2 + 31, {align:'center'});

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
    pdf.text('CONTEXTO DO PROJETO', W/2, y, { align: 'center' });
    y += 12;

    // ── Bloco: O que é a Toponímia?
    const boxW = W - (margemX * 2);
    pdf.setFont('times', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(60, 50, 45);
    const introText = 'O projeto tem como foco o estudo da toponímia urbana — ou seja, os nomes de ruas, praças, avenidas e escolas públicas — da cidade de Ouro Branco/MG. Esses nomes não são aleatórios: refletem aspectos sociais, culturais e históricos da comunidade, funcionando como guardiões da memória coletiva local. Este dossiê apresenta o resultado de dez anos de pesquisa documental e de campo sobre os espaços urbanos de Ouro Branco - MG, revelando como a história da cidade está "escrita".';
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
    const missaoTxt = 'Resgatar a memória local e oferecer um recurso educativo para escolas e pesquisadores, promovendo o sentimento de pertencimento por meio do conhecimento histórico.';
    pdf.text(pdf.splitTextToSize(missaoTxt, colW), margemX, y + 5);

    // Coluna Direita: Metodologia
    pdf.setFont('times', 'bold');
    pdf.text('METODOLOGIA', margemX + colW + 15, y);
    pdf.setFont('times', 'normal');
    const metodoTxt = 'Baseada na taxonomia de Dick (1990), a pesquisa classifica os nomes em categorias (antropotopônimos, fitotopônimos, etc.) para entender as motivações das nomeações.';
    pdf.text(pdf.splitTextToSize(metodoTxt, colW), margemX + colW + 15, y + 5);
    
    y += 35;

    // ── Título da Evolução (Box Arredondado Sépia)
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

    // ── Linha do Tempo Dinâmica (Estilo Infográfico)
    const timelineMargin = 30;
    const timelineW = W - (timelineMargin * 2);
    const startX = timelineMargin;
    const endX = W - timelineMargin;
    const centerY = y + 22; // Eixo central da linha do tempo

    // Desenhar o eixo principal grosso (barra de evolução)
    pdf.setFillColor(215, 208, 198); // Bege suave
    pdf.roundedRect(startX - 4, centerY - 2, timelineW + 8, 4, 2, 2, 'F');
    // Linha interna de detalhe
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.5);
    pdf.line(startX - 2, centerY, endX + 2, centerY);
    
    const marcos = [
        { ano: '2016-2020', desc: 'Análise da influência da Metalurgia na denominação de nomes de ruas.\nAlunos: Naiara e Dérlisson.' },
        { ano: '2019-2020', desc: 'Atenção para dinâmica de ruas, avenidas, praças e escolas.\nAlunos: Marcos Paulo e Giovana Lana.' },
        { ano: '2021', desc: 'Investigação focada na microtoponímia urbana.\nAluna: Maria Raquel Honorata.' },
        { ano: '2021-2022', desc: 'Análise dos nomes das escolas públicas.\nAlunas: Bruna dos Santos e Shirley Pereira.' },
        { ano: '2022-2023', desc: 'Continuação da análise microtoponímica.\nAlunas: Shirley Pereira e Ana Paula Rafael.' },
        { ano: '2023-2024', desc: 'Consolidação da pesquisa em microtoponímia.\nAluna: Ludmila Silva.' },
        { ano: '2024-Atual', desc: 'Finalização e início da fase de extensão.\nAlunos: Ludmila Silva e Marcos Túlio.' }
    ];

    const step = timelineW / (marcos.length - 1);
    
    // Paleta de cores em degradê (tons terrosos/históricos) para cada marco
    const boxColors = [
        [90, 75, 65],
        [115, 95, 80],
        [140, 115, 95],
        [165, 135, 110],
        [190, 155, 125],
        [165, 135, 110],
        [140, 115, 95]
    ];

    marcos.forEach((m, i) => {
        const x = startX + i * step;
        const isTop = i % 2 === 0;
        const c = boxColors[i];
        
        const boxW = 18;
        const boxH = 5.5;
        
        // Posição da caixinha do ano
        const boxY = isTop ? centerY - 10 - boxH : centerY + 10;
        const lineDestY = isTop ? boxY + boxH : boxY;
        
        // Haste conectora
        pdf.setDrawColor(c[0], c[1], c[2]);
        pdf.setLineWidth(0.5);
        pdf.line(x, centerY, x, lineDestY);
        
        // Marcador (Pino) no eixo principal
        pdf.setFillColor(c[0], c[1], c[2]);
        pdf.circle(x, centerY, 2.0, 'F');
        pdf.setFillColor(255, 255, 255);
        pdf.circle(x, centerY, 0.8, 'F');
        
        // Caixinha do Ano
        pdf.setFillColor(c[0], c[1], c[2]);
        pdf.roundedRect(x - (boxW/2), boxY, boxW, boxH, 1.5, 1.5, 'F');
        
        // Texto do Ano
        pdf.setFont('times', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(255, 255, 255);
        pdf.text(m.ano, x, boxY + 4, { align: 'center' });
        
        // Texto da Descrição
        pdf.setFont('times', 'normal');
        pdf.setFontSize(5.8);
        pdf.setTextColor(60, 50, 45);
        // Permitimos que o texto ocupe um pouco mais que o "step" pois eles são intercalados (não colidem)
        const descLines = pdf.splitTextToSize(m.desc, step * 1.5);
        const textH = descLines.length * 2.2;
        
        let descY;
        if (isTop) {
            descY = boxY - 1.5 - textH + 2.2; // Cresce para cima
        } else {
            descY = boxY + boxH + 3.0; // Cresce para baixo
        }
        
        pdf.text(descLines, x, descY, { align: 'center', lineHeightFactor: 1.15 });
    });

    // ── Rodapé
    pdf.setFont('times', 'italic');
    pdf.setFontSize(7);
    pdf.setTextColor(150, 140, 130);
    pdf.text('Dossiê gerado automaticamente pelo Portal Toponímia Urbana - IFMG Campus Ouro Branco', W/2, H - 12, { align: 'center' });
}

/**
 * PÁGINA 3: GLOSSÁRIO DE TAXONOMIAS
 */
function pdfPaginaCategorias(pdf, W, H) {
    pdf.addPage();
    pdf.setFillColor(253, 251, 247);
    pdf.rect(0, 0, W, H, 'F');
    aplicarGuiaRecorte(pdf, W, H);

    const margemX = 15;
    let y = 15;

    // Header da Página
    pdf.setFont('times', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(44, 38, 33);
    pdf.text('GLOSSÁRIO TAXONÔMICO', W/2, y, { align: 'center' });
    y += 2;
    pdf.setDrawColor(140, 126, 109);
    pdf.setLineWidth(0.3);
    pdf.line(W/2 - 15, y, W/2 + 15, y);
    y += 10;

    const larguraCol = (W - (margemX * 2) - 8) / 2;
    const inicioY = y;

    // ==========================================
    // COLUNA 1: NATUREZA FÍSICA
    // ==========================================
    let yF = y;
    pdf.setFillColor(61, 97, 66);
    pdf.roundedRect(margemX, yF, larguraCol, 6, 1, 1, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(255, 255, 255);
    pdf.text('NATUREZA FÍSICA', margemX + larguraCol / 2, yF + 4.2, { align: 'center' });
    yF += 10;

    const fisicas = [
        { t: 'Astrotopônimos', d: 'Corpos celestes em geral.' },
        { t: 'Cardinotopônimos', d: 'Posições geográficas em geral.', e: 'Estrema (atual Ibiai, MG)' },
        { t: 'Cromotopônimos', d: 'Escala cromática.', e: 'Piranga (MG)' },
        { t: 'Dimensiotopônimos', d: 'Dimensões de acidentes geográficos.', e: 'Alto dos Bois (Angelândia, MG)' },
        { t: 'Fitotopônimos', d: 'Índole vegetal.', e: 'Buritis (atual Andiroba, MG)' },
        { t: 'Geomorfotopônimos', d: 'Forma topográfica.', e: 'Morro Grande (B. de Cocais)' },
        { t: 'Hidrotopônimos', d: 'Acidentes hidrográficos.', e: 'Rio das Pedras (Acuruí, MG)' },
        { t: 'Litotopônimos', d: 'Índole mineral.', e: 'Itabira (MG)' },
        { t: 'Meteorotopônimos', d: 'Fenômenos atmosféricos.', e: 'Manhuaçu (MG)' },
        { t: 'Morfotopônimos', d: 'Formas geométricas.', e: 'Redondo (Alto Maranhão, MG)' },
        { t: 'Zootopônimos', d: 'Índole animal.', e: 'Macacos (Cachoeira da Prata)' }
    ];

    fisicas.forEach(c => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(61, 97, 66);
        pdf.text(c.t.toUpperCase(), margemX, yF);

        pdf.setFont('times', 'normal');
        pdf.setFontSize(6.5);
        pdf.setTextColor(44, 38, 33);
        const dLines = pdf.splitTextToSize(c.d, larguraCol - 2);
        pdf.text(dLines, margemX, yF + 2.8);

        if (c.e) {
            pdf.setFont('times', 'italic');
            pdf.setTextColor(110, 100, 95);
            pdf.text(`Ex: ${c.e}`, margemX, yF + 2.8 + (dLines.length * 2.5));
            yF += (dLines.length * 2.5) + 7.5;
        } else {
            yF += (dLines.length * 2.5) + 6.0;
        }
    });

    // ==========================================
    // COLUNA 2: NATUREZA ANTROPOCULTURAL
    // ==========================================
    let yA = inicioY;
    const x2 = margemX + larguraCol + 8;

    pdf.setFillColor(142, 62, 86);
    pdf.roundedRect(x2, yA, larguraCol, 6, 1, 1, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(255, 255, 255);
    pdf.text('NATUREZA ANTROPOCULTURAL', x2 + larguraCol / 2, yA + 4.2, { align: 'center' });
    yA += 10;

    const antropo = [
        { t: 'Animotopônimos', d: 'Vida psíquica, cultura espiritual.', e: 'Alegre (Simonésia, MG)' },
        { 
            t: 'Antropotopônimos', 
            d: 'Nomes próprios individuais. Possui as hibridizações:', 
            sub: [
                { t: 'Antropo-axiotopônimos', d: 'Pessoa precedida por um título.', e: 'Conselheiro Mata' },
                { t: 'Antropo-historiotopônimos', d: 'Feitos registrados na história.', e: 'Tomás Gonzaga' },
                { t: 'Antropo-axio-historiotopônimos', d: 'Pessoa com título e feitos registrados na história.' }
            ] 
        },
        { t: 'Axiotopônimos', d: 'Títulos e dignidades acompanhando nomes.', e: 'Conselheiro Lafaiete' },
        { t: 'Corotopônimos', d: 'Cidades, países, regiões.', e: 'Cabo Verde (MG)' },
        { t: 'Cronotopônimos', d: 'Indicadores cronológicos (Novo/Velho).', e: 'Nova Era' },
        { t: 'Dirrematopônimos', d: 'Frases ou enunciados linguísticos.', e: 'Abre Campo' },
        { t: 'Ecotopônimos', d: 'Habitações de um modo geral.', e: 'Bertioga (Ibertioga, MG)' },
        { t: 'Ergotopônimos', d: 'Elementos da cultura material.', e: 'Ferros (MG)' },
        { t: 'Etnotopônimos', d: 'Elementos étnicos, povos, tribos.', e: 'Maxacalis (Machacalis, MG)' },
        { 
            t: 'Hierotopônimos', 
            d: 'Nomes sagrados que possuem subdivisões hierárquicas:', 
            sub: [
                { t: 'Mariotopônimos', d: 'Invocações à Virgem Maria.', e: 'Mercês' },
                { t: 'Hagiotopônimos', d: 'Santos do hagiológio romano.', e: 'São Gonçalo do Sapucaí' },
                { t: 'Mitotopônimos', d: 'Entidades mitológicas.' }
            ] 
        },
        { t: 'Historiotopônimos', d: 'Movimentos históricos e datas.', e: 'Vitoriano Veloso' },
        { t: 'Hodotopônimos', d: 'Vias de comunicação (ruais/urbanas).', e: 'Pte Nova (Itutinga, MG)' },
        { t: 'Numerotopônimos', d: 'Relativos a adjetivos numerais.', e: 'Sete Lagoas (MG)' },
        { t: 'Poliotopônimos', d: 'Vila, aldeia, cidade, arraial.', e: 'Villa Nova da Rainha' },
        { t: 'Sociotopônimos', d: 'Profissões e pontos de encontro.', e: 'Curral d’El Rey (Belo Horizonte)' },
        { t: 'Somatotopônimos', d: 'Metafórica a partes do corpo.', e: 'Pé do Morro' }
    ];

    antropo.forEach(c => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(142, 62, 86);
        pdf.text(c.t.toUpperCase(), x2, yA);

        pdf.setFont('times', 'normal');
        pdf.setFontSize(6.5);
        pdf.setTextColor(44, 38, 33);
        const dLines = pdf.splitTextToSize(c.d, larguraCol - 2);
        pdf.text(dLines, x2, yA + 2.8);

        if (c.sub) {
            let subY = yA + 2.8 + (dLines.length * 2.5) + 2;
            let currentVertY = yA + 2.8; 
            pdf.setDrawColor(142, 62, 86);
            pdf.setLineWidth(0.3);
            
            c.sub.forEach((s) => {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(6.5);
                pdf.setTextColor(142, 62, 86);
                pdf.text(s.t, x2 + 5, subY);
                
                pdf.setFont('times', 'normal');
                pdf.setTextColor(60, 50, 45);
                const sDesc = s.d + (s.e ? ` Ex: ${s.e}` : '');
                const sLines = pdf.splitTextToSize(sDesc, larguraCol - 6);
                pdf.text(sLines, x2 + 5, subY + 2.5);
                
                pdf.line(x2 + 2, currentVertY, x2 + 2, subY - 1);
                pdf.line(x2 + 2, subY - 1, x2 + 4, subY - 1);
                
                currentVertY = subY - 1; 
                const itemH = 2.5 + (sLines.length * 2.5);
                subY += itemH + 1.5;
            });
            yA = subY + 3.5;
        } else {
            if (c.e) {
                pdf.setFont('times', 'italic');
                pdf.setTextColor(110, 100, 95);
                pdf.text(`Ex: ${c.e}`, x2, yA + 2.8 + (dLines.length * 2.5));
                yA += (dLines.length * 2.5) + 6.5;
            } else {
                yA += (dLines.length * 2.5) + 5.0;
            }
        }
    });

    pdf.setFont('times', 'italic');
    pdf.setFontSize(7);
    pdf.setTextColor(150, 140, 130);
    pdf.text('Dossiê Patrimonial - Toponímia Urbana de Ouro Branco', W / 2, H - 12, { align: 'center' });
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
    pdf.text('Atividade: Identifique uma rua e pesquise seu significado no site.', W/2, H - 12, {align:'center'});
}

/**
 * Adiciona uma página de Cards de Memória destacáveis
 */
async function pdfPaginaCardsMemoria(pdf, W, H, escolas) {
    const CARDS_POR_PAGINA = 8;
    const COLUNAS = 2;
    const LINHAS = 4;
    const MARGEM_SEGURANCA = 7;
    
    const CARD_W = (W - (MARGEM_SEGURANCA * 2)) / COLUNAS;
    const CARD_H = (H - (MARGEM_SEGURANCA * 2)) / LINHAS;

    for (let i = 0; i < escolas.length; i++) {
        if (i % CARDS_POR_PAGINA === 0) {
            pdf.addPage();
            pdf.setFillColor(253, 251, 247);
            pdf.rect(0, 0, W, H, 'F');
            aplicarGuiaRecorte(pdf, W, H);
        }

        const indexNaPagina = i % CARDS_POR_PAGINA;
        const col = indexNaPagina % COLUNAS;
        const row = Math.floor(indexNaPagina / COLUNAS);
        
        const x = MARGEM_SEGURANCA + (col * CARD_W);
        const y = MARGEM_SEGURANCA + (row * CARD_H);

        // Bordas do card (Tracejado para recorte)
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(0.2);
        pdf.setLineDash([2, 2]);
        pdf.rect(x, y, CARD_W, CARD_H, 'S');
        pdf.setLineDash([]);

        // Conteúdo do Card
        const padding = 5;
        const innerX = x + padding;
        const innerY = y + padding;
        const innerW = CARD_W - (padding * 2);

        // Imagem da Escola
        const imgH = 25;
        if (escolas[i].imagem_b64) {
            try {
                pdf.addImage(escolas[i].imagem_b64, 'JPEG', innerX, innerY, innerW, imgH, undefined, 'FAST');
            } catch (e) {
                pdf.setDrawColor(200, 200, 200);
                pdf.rect(innerX, innerY, innerW, imgH, 'S');
            }
        } else {
            pdf.setDrawColor(230, 230, 230);
            pdf.rect(innerX, innerY, innerW, imgH, 'F');
        }

        // Texto: Nome
        let textY = innerY + imgH + 5;
        pdf.setFont('times', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(44, 38, 33);
        const nomeSeguro = (escolas[i].nome || 'Escola sem nome').toUpperCase();
        const nomeLines = pdf.splitTextToSize(nomeSeguro, innerW);
        pdf.text(nomeLines, innerX, textY);
        textY += (nomeLines.length * 3.5) + 1.5;

        // Texto: Endereço
        pdf.setFont('times', 'normal');
        pdf.setFontSize(6);
        pdf.setTextColor(100, 90, 85);
        const enderecoLines = pdf.splitTextToSize(escolas[i].endereco || 'Endereço não informado', innerW);
        pdf.text(enderecoLines, innerX, textY);
        textY += (enderecoLines.length * 2.5) + 2.5;

        // Resumo da História (Snippet)
        const historiaTexto = escolas[i].historia;
        if (historiaTexto) {
            pdf.setFont('times', 'italic');
            pdf.setFontSize(6.5);
            pdf.setTextColor(60, 50, 45);
            const resumo = historiaTexto.length > 140 
                ? historiaTexto.substring(0, 137) + '...' 
                : historiaTexto;
            const historiaLines = pdf.splitTextToSize(resumo, innerW);
            if (Array.isArray(historiaLines)) {
                pdf.text(historiaLines.slice(0, 3).join('\n'), innerX, textY, { lineHeightFactor: 1.1 });
            }
        }

        // Classificação Taxonômica (Badge) - FIXO NO RODAPÉ
        const cat = normalizarCategoria(escolas[i].classificacao);
        const [r, g, b] = hexRgb(CORES_CATEGORIA[cat] || CORES_CATEGORIA.outro);
        const badgeY = y + CARD_H - 8; 
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(5.5);
        const larguraTexto = pdf.getTextWidth(rotuloCategoriaToponimica(cat).toUpperCase());
        
        pdf.setFillColor(r, g, b);
        pdf.roundedRect(innerX, badgeY, larguraTexto + 4, 4, 1, 1, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.text(rotuloCategoriaToponimica(cat).toUpperCase(), innerX + 2, badgeY + 3);

        // Ícone de tesoura no canto
        pdf.setFontSize(6);
        pdf.setTextColor(180, 180, 180);
        pdf.text('✂', x + 2, y + 4);
    }
}

// ============================================
// EXPORTAÇÕES PÚBLICAS
// ============================================

export const PdfGeneratorService = {
    async exportFullReport(btnElement) {
        const originalContent = btnElement.innerHTML;
        btnElement.disabled = true;
        btnElement.innerHTML = 'Preparando Dossiê...';

        try {
            const [ruasRes, bairrosRes, escolasRes] = await Promise.all([
                supabase.from('ruas').select('nome_oficial, categoria_toponimica, bairros(nome), significado').order('nome_oficial'),
                supabase.from('bairros').select('nome, imagem_capa').order('nome'),
                supabase.from('escolas').select('nome, endereco, classificacao, imagem_url, historia').order('nome')
            ]);

            if (ruasRes.error) throw new Error(`Erro ao buscar ruas: ${ruasRes.error.message}`);
            if (bairrosRes.error) throw new Error(`Erro ao buscar bairros: ${bairrosRes.error.message}`);

            const ruas = ruasRes.data || [];
            const bairrosData = bairrosRes.data || [];
            const escolasDataRaw = escolasRes?.data || [];

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

            const imgHero = await urlParaBase64(normalizePath('images/ouro_branco_historico.png'));
            const imgLogo = await urlParaBase64(normalizePath('images/header/toponimia-black.png'));
            
            pdfCapa(pdf, W, H, ruas.length, Object.keys(bairrosMap).length, imgHero);
            
            // Página de Contexto (Pág 2)
            pdfPaginaContexto(pdf, W, H, imgLogo);

            // Página 3: Glossário de Taxonomias
            pdfPaginaCategorias(pdf, W, H);

            for (const [nome, listaRuas] of Object.entries(bairrosMap)) {
                const bairroInfo = bairrosData.find(b => b.nome === nome);
                const imgB64 = await urlParaBase64(normalizePath(bairroInfo?.imagem_capa));
                pdfFichaBairro(pdf, W, H, nome, listaRuas, imgB64);
            }

            // Seção de Cards das Escolas
            if (escolasDataRaw.length > 0) {
                const escolasComImg = await Promise.all(escolasDataRaw.map(async (esc) => ({
                    ...esc,
                    imagem_b64: await urlParaBase64(normalizePath(esc.imagem_url))
                })));
                await pdfPaginaCardsMemoria(pdf, W, H, escolasComImg);
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
            console.error('ERRO CRÍTICO NA GERAÇÃO DO PDF:', err);
            let userMsg = 'Erro ao gerar documento.';
            if (err.message) {
                userMsg += `\nDetalhe: ${err.message}`;
            }
            alert(userMsg);
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
