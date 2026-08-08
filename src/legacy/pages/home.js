// Importa o client Supabase do módulo compartilhado
import { supabase } from '../../lib/supabase.js'

// Cache para as instâncias de mini-mapas do Leaflet ativos na página
const activeMiniMaps = {};

function destruirMiniMapa(ruaId) {
    if (activeMiniMaps[ruaId]) {
        try {
            activeMiniMaps[ruaId].remove();
        } catch (err) {
            console.error('Erro ao destruir mini-mapa:', err);
        }
        delete activeMiniMaps[ruaId];
    }
}

/**
 * Função utilitária para normalizar caminhos de assets vindos do banco de dados.
 * Remove prefixos antigos como 'assets/' ou '/assets/' e garante caminho absoluto.
 */
function normalizePath(path) {
    if (!path) return '';
    let p = path.trim();
    // Remove ./ inicial
    p = p.replace(/^\.\//, '');
    // Remove / inicial para facilitar o replace do assets
    p = p.replace(/^\//, '');
    // Remove o prefixo assets/ se existir
    p = p.replace(/^assets\//, '');
    // Retorna caminho relativo (funciona melhor com a base do Vite)
    return p;
}

/**
 * NOVA FUNÇÃO: Gera dinamicamente as seções do alfabeto (A-Z) no HTML.
 */
function gerarSecoesAlfabeto() {
    const mainDoc = document.getElementById('main-doc');
    if (!mainDoc) return;

    // Gera o alfabeto de 'A' a 'Z'
    for (let i = 65; i <= 90; i++) {
        const letra = String.fromCharCode(i);

        // Cria os elementos HTML para cada letra
        const section = document.createElement('section');
        section.id = letra;
        section.className = 'main-section';

        const header = document.createElement('header');
        header.textContent = letra;

        const article = document.createElement('article');

        // Container para os cards das ruas
        const divRuas = document.createElement('div');
        divRuas.className = 'section-ruas';

        // Monta a estrutura
        article.appendChild(divRuas);
        section.appendChild(header);
        section.appendChild(article);

        // Adiciona a seção completa ao <main>
        mainDoc.appendChild(section);
    }
}


// Função para criar elementos da ficha de informações da rua (responsivo)
function criarFichaRua(rua) {
    const container = document.createElement('div');
    container.className = 'ficha-toponimica';
    container.innerHTML = `
        <div class="ficha-metadados">
            <div class="meta-item meta-nome">
                <span class="meta-label">Nome Oficial</span>
                <span class="meta-value">${rua.nome_oficial || '---'}</span>
            </div>
            <div class="meta-item meta-localizacao">
                <span class="meta-label">Localização</span>
                <span class="meta-value">${rua.localizacao || '---'}</span>
            </div>
            <div class="meta-item meta-legislacao">
                <span class="meta-label">Legislação</span>
                <span class="meta-value">${rua.legislacao || '---'}</span>
            </div>
            <div class="meta-item meta-codigo">
                <span class="meta-label">Código</span>
                <span class="meta-value">${rua.codigo || '---'}</span>
            </div>
            <div class="meta-item meta-regional">
                <span class="meta-label">Regional</span>
                <span class="meta-value">${rua.regional || '---'}</span>
            </div>
        </div>
        <div class="ficha-conteudo">
            <div class="ficha-col-principal">
                <div class="ficha-secao">
                    <h4 class="secao-titulo"><i class="bi bi-info-circle" aria-hidden="true"></i> Significado / Histórico</h4>
                    <p class="secao-texto">${rua.significado || 'Significado não disponível.'}</p>
                </div>
                <div class="ficha-secao">
                    <h4 class="secao-titulo"><i class="bi bi-map" aria-hidden="true"></i> Localização Geográfica</h4>
                    <div class="ficha-mapa-container">
                        ${(rua.lat && rua.lng)
                            ? `<div id="mini-map-${rua.id}" class="mini-map"></div>`
                            : (rua.mapa ? `<iframe src="${rua.mapa}" width="100%" height="320" style="border:0;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : '<div class="no-map">Mapa não disponível.</div>')}
                    </div>
                </div>
            </div>
            ${(rua.imagemHomenageado || rua.imagem) ? `
            <div class="ficha-col-midia">
                ${rua.imagemHomenageado ? `
                <div class="midia-card">
                    <h5 class="midia-titulo">Homenageado(a)</h5>
                    <div class="midia-img-wrapper">
                        <img src="${normalizePath(rua.imagemHomenageado)}" alt="Imagem do Homenageado">
                    </div>
                </div>
                ` : ''}
                ${rua.imagem ? `
                <div class="midia-card">
                    <h5 class="midia-titulo">Imagem da Rua</h5>
                    <div class="midia-img-wrapper">
                        <img src="${normalizePath(rua.imagem)}" alt="Imagem da rua">
                    </div>
                </div>
                ` : ''}
            </div>
            ` : ''}
        </div>
    `;
    return container;
}

// Função para exibir uma introdução sobre o bairro selecionado
function exibirIntroducaoBairro(bairro) {
    // Atualiza a imagem de capa
    const coverDiv = document.getElementById('bairro-cover');
    if (coverDiv && bairro.imagem_capa) {
        coverDiv.innerHTML = `<img src="${normalizePath(bairro.imagem_capa)}" alt="Capa do bairro ${bairro.nome}">`;
    } else if (coverDiv) {
        // Se não houver imagem, usar gradiente padrão
        coverDiv.style.background = 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)';
    }

    // Atualiza o título
    const tituloDiv = document.getElementById('bairro-titulo');
    if (tituloDiv) {
        tituloDiv.textContent = bairro.titulo || bairro.nome;
    }

    // Atualiza a descrição
    const descricaoDiv = document.getElementById('bairro-descricao');
    if (descricaoDiv && bairro.descricao) {
        descricaoDiv.textContent = bairro.descricao;
    } else if (descricaoDiv) {
        descricaoDiv.textContent = '';
    }
}

// Função para agrupar ruas por letra do alfabeto
function agruparRuasPorLetra(ruas) {
    const ruasPorLetra = {};
    for (const nomeRua in ruas) {
        const nomeSemPrefixo = nomeRua.replace(/^(Rua|Antônio|Ana)\s+/i, "").trim();
        const primeiraLetra = nomeSemPrefixo.charAt(0).toUpperCase();

        if (!ruasPorLetra[primeiraLetra]) {
            ruasPorLetra[primeiraLetra] = [];
        }
        ruasPorLetra[primeiraLetra].push({ nome: nomeRua, detalhes: ruas[nomeRua] });
    }
    return ruasPorLetra;
}

// Função para exibir os detalhes de uma rua (accordion acessível)
function idDetalhesRua(nome) {
    return 'detalhes-' + String(nome).replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase();
}

function fecharTodosDetalhes(exceptCard = null) {
    document.querySelectorAll('.rua-card[aria-expanded="true"]').forEach(btn => {
        if (btn !== exceptCard) btn.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.detalhes-rua').forEach(panel => {
        if (exceptCard && panel.previousElementSibling === exceptCard) return;
        
        // Destruir mapa associado antes de remover o painel para liberar memória
        const miniMapContainer = panel.querySelector('.mini-map');
        if (miniMapContainer) {
            const match = miniMapContainer.id.match(/^mini-map-(.+)$/);
            if (match && match[1]) {
                destruirMiniMapa(match[1]);
            }
        }
        
        panel.remove();
    });
}

function exibirDetalhesRua(rua, card) {
    const panelId = card.getAttribute('aria-controls');
    const isOpen = card.getAttribute('aria-expanded') === 'true';

    if (isOpen) {
        const panel = card.nextElementSibling;
        if (panel?.classList.contains('detalhes-rua')) {
            destruirMiniMapa(rua.id);
            panel.remove();
        }
        card.setAttribute('aria-expanded', 'false');
        return;
    }

    fecharTodosDetalhes(card);

    const divDetalhes = document.createElement('div');
    divDetalhes.classList.add('detalhes-rua');
    divDetalhes.id = panelId;
    divDetalhes.setAttribute('role', 'region');
    divDetalhes.setAttribute('aria-label', `Detalhes de ${rua.nome_oficial || card.dataset.ruaNome}`);
    divDetalhes.appendChild(criarFichaRua(rua));

    card.parentNode.insertBefore(divDetalhes, card.nextSibling);
    card.setAttribute('aria-expanded', 'true');

    // Inicializar o mini-mapa com Leaflet se as coordenadas estiverem disponíveis
    if (rua.lat && rua.lng) {
        const containerId = `mini-map-${rua.id}`;
        // Timeout para garantir que o contêiner já esteja renderizado e visível no DOM
        setTimeout(() => {
            const container = document.getElementById(containerId);
            if (!container) return;

            destruirMiniMapa(rua.id);

            try {
                const miniMap = L.map(containerId, {
                    center: [rua.lat, rua.lng],
                    zoom: 16,
                    zoomControl: true,
                    dragging: !L.Browser.mobile,
                    tap: !L.Browser.mobile
                });

                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: 'abcd',
                    maxZoom: 20
                }).addTo(miniMap);

                L.marker([rua.lat, rua.lng]).addTo(miniMap)
                    .bindPopup(`<b>${rua.nome_oficial}</b><br>${rua.localizacao || ''}`)
                    .openPopup();

                activeMiniMaps[rua.id] = miniMap;
            } catch (err) {
                console.error('Erro ao inicializar mini-mapa do Leaflet:', err);
                // Fallback para iframe se disponível
                if (rua.mapa) {
                    container.innerHTML = `<iframe src="${rua.mapa}" width="100%" height="380" style="border:0;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
                } else {
                    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--medium-gray);">Mapa não disponível.</div>';
                }
            }
        }, 150);
    }
}

// ========================================
// FUNÇÕES DE ESTADOS DE CARREGAMENTO
// ========================================

// Função para mostrar skeleton screens
function mostrarSkeletons(quantidade = 5) {
    const mainDoc = document.getElementById('main-doc');
    if (mainDoc) {
        mainDoc.setAttribute('aria-busy', 'true');
        let announcer = document.getElementById('loading-announcer');
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'loading-announcer';
            announcer.className = 'visually-hidden';
            announcer.setAttribute('role', 'status');
            announcer.setAttribute('aria-live', 'polite');
            mainDoc.insertAdjacentElement('afterbegin', announcer);
        }
        announcer.textContent = 'Carregando ruas, aguarde.';
    }

    const secoesLetras = document.querySelectorAll('.section-ruas');
    secoesLetras.forEach(secao => {
        secao.innerHTML = '';
        for (let i = 0; i < quantidade; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-card';
            skeleton.setAttribute('aria-hidden', 'true');
            skeleton.innerHTML = `
                <div class="skeleton-content">
                    <div class="skeleton-line skeleton-title"></div>
                    <div class="skeleton-line skeleton-text"></div>
                </div>
                <div class="skeleton-line skeleton-badge"></div>
            `;
            secao.appendChild(skeleton);
        }
    });
}

// Função para mostrar spinner de carregamento
function mostrarSpinner(container) {
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.setAttribute('role', 'status');
    spinner.setAttribute('aria-live', 'polite');
    spinner.innerHTML = `
        <div class="spinner" aria-hidden="true"></div>
        <div class="loading-text">Carregando ruas...</div>
    `;
    container.appendChild(spinner);
}

// Função para remover skeletons e spinners
function limparLoading() {
    document.querySelectorAll('.skeleton-card, .loading-spinner').forEach(el => el.remove());

    const mainDoc = document.getElementById('main-doc');
    if (mainDoc) mainDoc.removeAttribute('aria-busy');

    const announcer = document.getElementById('loading-announcer');
    if (announcer) announcer.textContent = '';
}

// Função para exibir as ruas de uma letra do alfabeto com CARDS
function exibirRuasPorLetra(ruas) {
    const ruasPorLetra = agruparRuasPorLetra(ruas);
    const secoesLetras = document.querySelectorAll('.section-ruas');
    secoesLetras.forEach(secao => secao.innerHTML = ''); // Limpa todas as seções

    for (let letra in ruasPorLetra) {
        const secaoLetra = document.getElementById(letra);
        if (!secaoLetra) continue;
        const divRuas = secaoLetra.querySelector('.section-ruas');
        if (!divRuas) continue;

        ruasPorLetra[letra].forEach(rua => {
            const panelId = idDetalhesRua(rua.nome);

            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'rua-card';
            card.setAttribute('data-rua-nome', rua.nome);
            card.setAttribute('aria-expanded', 'false');
            card.setAttribute('aria-controls', panelId);
            card.setAttribute('aria-label', `Ver detalhes de ${rua.nome}`);

            const content = document.createElement('div');
            content.className = 'rua-card-content';

            const title = document.createElement('div');
            title.className = 'rua-card-title';
            title.innerHTML = `<i class="bi bi-signpost-2" aria-hidden="true"></i> ${rua.nome}`;

            const info = document.createElement('div');
            info.className = 'rua-card-info';

            const significado = rua.detalhes.significado || 'Significado não disponível';
            const significadoPreview = significado.length > 120
                ? significado.substring(0, 120) + '...'
                : significado;
            info.textContent = significadoPreview;

            content.appendChild(title);
            content.appendChild(info);

            const badge = document.createElement('div');
            badge.className = 'rua-card-badge';
            badge.setAttribute('aria-hidden', 'true');
            badge.innerHTML = `<i class="bi bi-info-circle"></i> Ver detalhes`;

            card.appendChild(content);
            card.appendChild(badge);

            card.addEventListener('click', () => {
                exibirDetalhesRua(rua.detalhes, card);
            });
            divRuas.appendChild(card);
        });
    }

    // Marca letras vazias como disabled
    marcarLetrasVazias(ruasPorLetra);
}

// Função para marcar letras sem ruas como disabled
function marcarLetrasVazias(ruasPorLetra) {
    const todasLetras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    todasLetras.forEach(letra => {
        const navItem = document.querySelector(`#navside a[href="#${letra}"]`)?.parentElement;

        if (navItem) {
            const link = navItem.querySelector('a');
            if (ruasPorLetra[letra] && ruasPorLetra[letra].length > 0) {
                navItem.classList.remove('disabled');
                navItem.removeAttribute('aria-disabled');
                if (link) {
                    link.removeAttribute('aria-disabled');
                    link.removeAttribute('title');
                }
            } else {
                navItem.classList.add('disabled');
                navItem.setAttribute('aria-disabled', 'true');
                if (link) {
                    link.setAttribute('aria-disabled', 'true');
                    link.setAttribute('title', 'Nenhuma rua neste bairro começa com esta letra');
                }
            }
        }
    });
}

// --- Dropdown de bairro (combobox acessível) ---

function initBairroCombobox({ trigger, menu, list, selectedSpan, bairrosIndex, onSelect }) {
    let activeIndex = -1;
    let isOpen = false;

    function getOptions() {
        return [...list.querySelectorAll('[role="option"]')];
    }

    function setOpen(open) {
        isOpen = open;
        trigger.setAttribute('aria-expanded', String(open));
        menu.classList.toggle('active', open);
        if (open) {
            menu.focus();
        } else {
            activeIndex = -1;
            getOptions().forEach(opt => opt.classList.remove('is-focused'));
        }
    }

    function focusOption(index) {
        const options = getOptions();
        if (!options.length) return;
        activeIndex = ((index % options.length) + options.length) % options.length;
        options.forEach((opt, i) => opt.classList.toggle('is-focused', i === activeIndex));
        options[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    function selectOption(li) {
        const slug = li.dataset.slug;
        selectedSpan.textContent = li.textContent;
        getOptions().forEach(opt => {
            opt.setAttribute('aria-selected', opt === li ? 'true' : 'false');
        });
        setOpen(false);
        trigger.focus();
        onSelect(slug);
    }

    list.innerHTML = '';
    Object.entries(bairrosIndex).forEach(([slug, b]) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.dataset.slug = slug;
        li.textContent = b.nome;
        li.addEventListener('click', () => selectOption(li));
        list.appendChild(li);
    });

    trigger.addEventListener('click', () => setOpen(!isOpen));

    trigger.addEventListener('keydown', (e) => {
        const options = getOptions();
        if (!options.length) return;

        if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End', 'Escape'].includes(e.key)) {
            e.preventDefault();
        }

        if (e.key === 'Escape') {
            setOpen(false);
            return;
        }

        if (!isOpen && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
            setOpen(true);
            const selectedIdx = options.findIndex(o => o.getAttribute('aria-selected') === 'true');
            focusOption(selectedIdx >= 0 ? selectedIdx : 0);
            return;
        }

        if (!isOpen) return;

        if (e.key === 'ArrowDown') focusOption(activeIndex + 1);
        else if (e.key === 'ArrowUp') focusOption(activeIndex - 1);
        else if (e.key === 'Home') focusOption(0);
        else if (e.key === 'End') focusOption(options.length - 1);
        else if ((e.key === 'Enter' || e.key === ' ') && activeIndex >= 0) {
            selectOption(options[activeIndex]);
        }
    });

    menu.addEventListener('keydown', (e) => {
        const options = getOptions();
        if (!options.length) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            trigger.focus();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusOption(activeIndex + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusOption(activeIndex - 1);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (activeIndex >= 0) selectOption(options[activeIndex]);
        }
    });

    document.addEventListener('click', (e) => {
        if (!trigger.contains(e.target) && !menu.contains(e.target)) {
            setOpen(false);
        }
    });

    return {
        setSelected(slug) {
            const li = list.querySelector(`[data-slug="${slug}"]`);
            if (!li) return;
            selectedSpan.textContent = li.textContent;
            getOptions().forEach(opt => {
                opt.setAttribute('aria-selected', opt === li ? 'true' : 'false');
            });
        }
    };
}

// --- LÓGICA DE CARREGAMENTO DA API ---

let _bairrosIndexCache = null
let _todasRuas = [];
let _bairroAtualSlug = null;
let _bairroCombobox = null;

async function carregarBairros() {
    const { data, error } = await supabase
        .from('bairros')
        .select('id, slug, nome, titulo, imagem_capa, descricao')
        .order('nome', { ascending: true })

    if (error) throw error

    const bairrosIndex = {}
    for (const b of data) bairrosIndex[b.slug] = b

    _bairrosIndexCache = bairrosIndex
    return bairrosIndex
}

async function carregarTodasRuas() {
    const { data, error } = await supabase
        .from('ruas')
        .select(`*`)
        .order('nome_oficial', { ascending: true })

    if (error) throw error

    _todasRuas = data.map(rua => {
        const adaptada = { ...rua, imagemHomenageado: rua.imagemhomenageado }
        delete adaptada.imagemhomenageado
        return { nome: rua.nome_oficial, detalhes: adaptada }
    })
}

async function carregarRuasDoBairro(slug) {
    if (!_bairrosIndexCache) await carregarBairros()
    const bairro = _bairrosIndexCache[slug]
    if (!bairro) return {}

    if (_todasRuas.length === 0) {
        await carregarTodasRuas()
    }

    const ruasIndex = {}
    _todasRuas.forEach(({ nome, detalhes }) => {
        if (detalhes.bairro_id === bairro.id) {
            ruasIndex[nome] = detalhes
        }
    })
    return ruasIndex
}

// --- FUNCIONALIDADE DE BUSCA ---

// Função debounce para otimizar a busca
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Função para filtrar e exibir ruas baseado na busca
// Função para filtrar e exibir ruas baseado na busca
const removerAcentos = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function obterNomeBairro(bairroId) {
    if (!_bairrosIndexCache) return '';
    const bairro = Object.values(_bairrosIndexCache).find(b => b.id === bairroId);
    return bairro ? bairro.nome : '';
}

function obterSlugBairro(bairroId) {
    if (!_bairrosIndexCache) return '';
    const bairro = Object.values(_bairrosIndexCache).find(b => b.id === bairroId);
    return bairro ? bairro.slug : '';
}

async function irParaRuaNoBairro(slugBairro, nomeRua) {
    limparBusca(false);

    if (window.renderBairroAtual) {
        await window.renderBairroAtual(slugBairro);
    }

    setTimeout(() => {
        const card = document.querySelector(`[data-rua-nome="${nomeRua}"]`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const isExpanded = card.getAttribute('aria-expanded') === 'true';
            if (!isExpanded) {
                card.click();
            }
        }
    }, 150);
}

function filtrarRuas(query) {
    const queryLower = removerAcentos(query.trim().toLowerCase());

    // Se a busca estiver vazia ou com menos de 2 caracteres, restaura o estado original sem limpar o input
    if (!queryLower || queryLower.length < 2) {
        restaurarEstadoOriginal();
        return;
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.classList.add('search-loading');
    }

    const searchStatus = document.getElementById('search-status');
    if (searchStatus) searchStatus.textContent = 'Buscando...';

    const resultados = {};
    let totalResultados = 0;

    // Buscar em todas as ruas carregadas
    _todasRuas.forEach(({ nome, detalhes }) => {
        const nomeNorm = removerAcentos(nome.toLowerCase());
        const sigNorm = detalhes.significado ? removerAcentos(detalhes.significado.toLowerCase()) : '';
        const nomeMatch = nomeNorm.includes(queryLower);
        const significadoMatch = sigNorm.includes(queryLower);
        const localizacaoMatch = detalhes.localizacao &&
            removerAcentos(detalhes.localizacao.toLowerCase()).includes(queryLower);

        if (nomeMatch || significadoMatch || localizacaoMatch) {
            resultados[nome] = detalhes;
            totalResultados++;
        }
    });

    // Mostra feedback de busca com os resultados correspondentes
    mostrarFeedbackBusca(totalResultados, query, resultados);

    // Remove feedback de loading do input
    if (searchInput) {
        searchInput.classList.remove('search-loading');
    }
}

// ========================================
// FUNÇÕES DE FEEDBACK DE BUSCA
// ========================================

// Função para mostrar feedback de resultados de busca
function mostrarFeedbackBusca(quantidade, termo, resultados) {
    // Remove feedback anterior
    const feedbackAnterior = document.querySelector('.search-results-info');
    if (feedbackAnterior) feedbackAnterior.remove();

    // Se não houver termo de busca, não mostra feedback
    if (!termo || termo.length < 2) return;

    // Cria elemento de feedback
    const feedback = document.createElement('div');
    feedback.className = 'search-results-info';

    const plural = quantidade === 1 ? 'resultado' : 'resultados';
    const countText = quantidade === 0 
        ? `Nenhum resultado encontrado para "${termo}"` 
        : `${quantidade} ${plural} para "${termo}"`;

    // Cria o cabeçalho
    const headerDiv = document.createElement('div');
    headerDiv.className = 'search-results-header';
    headerDiv.innerHTML = `
        <div class="search-results-count">
            <i class="bi bi-search"></i>
            ${countText}
        </div>
        <button type="button" class="clear-search-btn">
            <i class="bi bi-x-circle" aria-hidden="true"></i>
            Limpar busca
        </button>
    `;
    feedback.appendChild(headerDiv);
    headerDiv.querySelector('.clear-search-btn').addEventListener('click', () => limparBusca());

    const searchStatus = document.getElementById('search-status');
    if (searchStatus) {
        searchStatus.textContent = countText;
    }

    // Se houver resultados, cria a lista de cards
    if (quantidade > 0 && resultados) {
        const listDiv = document.createElement('div');
        listDiv.className = 'search-results-list';

        Object.entries(resultados).forEach(([nome, detalhes]) => {
            const nomeBairro = obterNomeBairro(detalhes.bairro_id);
            const slugBairro = obterSlugBairro(detalhes.bairro_id);

            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'search-result-card';
            card.setAttribute('aria-label', `Ir para ${nome}${nomeBairro ? ` no bairro ${nomeBairro}` : ''}`);

            card.innerHTML = `
                <span class="search-result-card-header">
                    <span class="search-result-card-title">
                        <i class="bi bi-signpost-2" aria-hidden="true"></i> ${nome}
                    </span>
                    <span class="search-result-card-bairro"><i class="bi bi-geo-alt-fill" aria-hidden="true"></i> ${nomeBairro || 'Sem Bairro'}</span>
                </span>
            `;

            card.addEventListener('click', () => {
                if (slugBairro) irParaRuaNoBairro(slugBairro, nome);
            });

            listDiv.appendChild(card);
        });

        feedback.appendChild(listDiv);
    }

    // Insere o feedback após a hero section (barra de busca)
    const heroSection = document.querySelector('.hero-section');
    if (heroSection) {
        heroSection.after(feedback);
    }
}

// Função para restaurar o estado original da página (remover resultados de busca e mostrar bairro atual)
function restaurarEstadoOriginal() {
    // Remove feedback
    const feedback = document.querySelector('.search-results-info');
    if (feedback) feedback.remove();

    const searchStatus = document.getElementById('search-status');
    if (searchStatus) searchStatus.textContent = '';

    const searchInput = document.getElementById('searchInput');
    // Remove loading do input
    searchInput?.classList.remove('search-loading');

    // Restaura o bairro atual após limpar a busca
    if (_bairroAtualSlug && window.renderBairroAtual) {
        window.renderBairroAtual(_bairroAtualSlug);
    }
}

// Função para limpar a busca
window.limparBusca = function (shouldFocus = true) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        if (shouldFocus) searchInput.focus();
    }
    restaurarEstadoOriginal();
}

async function main() {
    try {
        // Primeiro, gera a estrutura HTML das seções do alfabeto
        gerarSecoesAlfabeto();

        // Mostra skeleton screens enquanto carrega
        mostrarSkeletons(3);

        const bairrosIndex = await carregarBairros();
        await carregarTodasRuas(); // Pré-carrega todas as ruas para busca global rápida
        const dropdownTrigger = document.getElementById('bairro-dropdown-trigger');
        const dropdownMenu = document.querySelector('.dropdown-menu-custom');
        const selectedBairroSpan = document.getElementById('selected-bairro');
        const bairroList = document.getElementById('bairro-list');

        async function renderBairro(slug) {
            console.log("Renderizando bairro:", slug)
            const bairroInfo = bairrosIndex[slug];
            if (!bairroInfo) return;

            _bairroAtualSlug = slug;

            const feedback = document.querySelector('.search-results-info');
            if (feedback) feedback.remove();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
            const searchStatus = document.getElementById('search-status');
            if (searchStatus) searchStatus.textContent = '';

            mostrarSkeletons(3);

            const ruasIndex = await carregarRuasDoBairro(slug);
            const bairroComRuas = { ...bairroInfo, ruas: ruasIndex };

            limparLoading();

            exibirIntroducaoBairro(bairroComRuas);
            exibirRuasPorLetra(bairroComRuas.ruas);

            document.querySelectorAll('.dropdown-item').forEach(link => {
                if (link.getAttribute('href') === `#${slug}`) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });

            _bairroCombobox?.setSelected(slug);
        }

        if (dropdownTrigger && dropdownMenu && bairroList && selectedBairroSpan) {
          _bairroCombobox = initBairroCombobox({
            trigger: dropdownTrigger,
            menu: dropdownMenu,
            list: bairroList,
            selectedSpan: selectedBairroSpan,
            bairrosIndex,
            onSelect: renderBairro,
          });
        }


        // Torna acessível globalmente for limparBusca
        window.renderBairroAtual = renderBairro;

        const dropdownLinks = document.querySelectorAll('.dropdown-item');
        dropdownLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const slug = link.getAttribute('href').replace('#', '');
                renderBairro(slug);
            });
        });

        if (Object.keys(bairrosIndex).length > 0) {
            const primeiroSlug = Object.keys(bairrosIndex)[0];
            renderBairro(primeiroSlug);
        }

        const searchInput = document.getElementById('searchInput');
        const searchSubmit = document.getElementById('searchSubmit');
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                filtrarRuas(e.target.value);
            }, 400));

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    filtrarRuas(e.target.value);
                }
            });
        }

        if (searchSubmit && searchInput) {
            searchSubmit.addEventListener('click', () => {
                filtrarRuas(searchInput.value);
                searchInput.focus();
            });
        }

    } catch (err) {
        console.error('Erro ao carregar da API:', err);
        limparLoading();
        const mainDoc = document.getElementById('main-doc');
        if (mainDoc) {
            mainDoc.removeAttribute('aria-busy');
            mainDoc.innerHTML = `<p role="alert" aria-live="assertive" style="text-align: center; color: red;">Não foi possível carregar os dados. Verifique sua conexão e tente novamente.</p>`;
        }
    }
}

// --- INICIALIZAÇÃO E EVENTOS ADICIONAIS ---

// Executa a função principal para iniciar a aplicação
main();

// Código para minimizar o menu e outros eventos
document.addEventListener("DOMContentLoaded", function () {
    // Minimizar menu dropdown
    const dropdownLinks = document.querySelectorAll('.dropdown-item');
    const navbarToggler = document.querySelector('.navbar-toggler');
    const navbarCollapse = document.querySelector('.navbar-collapse');

    dropdownLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navbarCollapse.classList.contains('show')) {
                navbarToggler.click();
            }
        });
    });

    window.addEventListener('scroll', function () {
        if (navbarCollapse.classList.contains('show')) {
            navbarToggler.click();
        }
    });

    // Botão de voltar ao topo
    const returnTopButton = document.getElementById('returnTopButton');
    returnTopButton.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });


    // Ativação das letras do nav lateral
    document.querySelectorAll("#navside li").forEach((item) => {
        item.addEventListener("click", () => {
            document.querySelectorAll("#navside li").forEach((el) => el.classList.remove("active"));
            item.classList.add("active");
        });
    });
});
