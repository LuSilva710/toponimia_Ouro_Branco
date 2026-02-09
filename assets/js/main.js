// Torne seu arquivo um módulo e crie o client aqui.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://vtsuctcmycaiooeubjnk.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c3VjdGNteWNhaW9vZXViam5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMTI5MjYsImV4cCI6MjA3MjY4ODkyNn0.YvkjnpNLF-BZALghTD3fTJ7bQbzqc1_ZNlLCb0rUq3Y'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
// (opcional) expõe globalmente:
window.supabase = supabase

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


// Função para criar elementos da tabela de informações da rua
function criarTabelaRua(rua) {
    const tabela = document.createElement('table');
    tabela.innerHTML = `
        <thead>
            <tr>
                <th>Nome Oficial</th>
                <th>Localização</th>
                <th>Legislação</th>
                <th>Código</th>
                <th>Regional</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>${rua.nome_oficial || ''}</td>
                <td>${rua.localizacao || ''}</td>
                <td>${rua.legislacao || ''}</td>
                <td>${rua.codigo || ''}</td>
                <td>${rua.regional || ''}</td>
            </tr>
            <tr>
                <td colspan="3">${rua.significado || 'Significado não disponível.'}</td>
                <td colspan="2">
                    ${rua.imagemHomenageado ? `<img src="${rua.imagemHomenageado}" alt="Imagem do Homenageado" style="max-width: 65%; display: block; margin: auto;">` : ''}
                </td>
            </tr>
            <tr>
                <td colspan="3">
                    ${rua.mapa ? `<iframe src="${rua.mapa}" width="100%" height="380" style="border:0;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : 'Mapa não disponível.'}
                </td>
                <td colspan="2">
                    ${rua.imagem ? `<img src="${rua.imagem}" alt="Imagem da rua" style="max-width: 90%;">` : ''}
                </td>
            </tr>
        </tbody>
    `;
    return tabela;
}

// Função para exibir uma introdução sobre o bairro selecionado
function exibirIntroducaoBairro(bairro) {
    // Atualiza a imagem de capa
    const coverDiv = document.getElementById('bairro-cover');
    if (coverDiv && bairro.imagem_capa) {
        coverDiv.innerHTML = `<img src="${bairro.imagem_capa}" alt="Capa do bairro ${bairro.nome}">`;
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

// Função para exibir os detalhes de uma rua
function exibirDetalhesRua(rua, card) {
    // Fecha qualquer outra tabela que esteja aberta
    const tabelaAberta = document.querySelector('.detalhes-rua');
    if (tabelaAberta) {
        // Se a tabela clicada já está aberta, apenas a fecha.
        if (tabelaAberta.previousSibling === card) {
            tabelaAberta.remove();
            return;
        }
        tabelaAberta.remove();
    }

    const divDetalhes = document.createElement('div');
    divDetalhes.classList.add('detalhes-rua');
    const tabelaRua = criarTabelaRua(rua);
    divDetalhes.appendChild(tabelaRua);

    // Insere após o card clicado
    card.parentNode.insertBefore(divDetalhes, card.nextSibling);
}

// ========================================
// FUNÇÕES DE ESTADOS DE CARREGAMENTO
// ========================================

// Função para mostrar skeleton screens
function mostrarSkeletons(quantidade = 5) {
    const secoesLetras = document.querySelectorAll('.section-ruas');
    secoesLetras.forEach(secao => {
        secao.innerHTML = '';
        for (let i = 0; i < quantidade; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-card';
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
    spinner.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text">Carregando ruas...</div>
    `;
    container.appendChild(spinner);
}

// Função para remover skeletons e spinners
function limparLoading() {
    document.querySelectorAll('.skeleton-card, .loading-spinner').forEach(el => el.remove());
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
            // Criar CARD em lista
            const card = document.createElement('div');
            card.className = 'rua-card';

            // Container de conteúdo (lado esquerdo)
            const content = document.createElement('div');
            content.className = 'rua-card-content';

            // Título do card
            const title = document.createElement('div');
            title.className = 'rua-card-title';
            title.innerHTML = `<i class="bi bi-signpost-2"></i> ${rua.nome}`;

            // Informações do card (preview)
            const info = document.createElement('div');
            info.className = 'rua-card-info';

            // Trunca o significado para preview
            const significado = rua.detalhes.significado || 'Significado não disponível';
            const significadoPreview = significado.length > 120
                ? significado.substring(0, 120) + '...'
                : significado;
            info.textContent = significadoPreview;

            // Monta o conteúdo
            content.appendChild(title);
            content.appendChild(info);

            // Badge (lado direito)
            const badge = document.createElement('div');
            badge.className = 'rua-card-badge';
            badge.innerHTML = `<i class="bi bi-info-circle"></i> Ver detalhes`;

            // Monta o card
            card.appendChild(content);
            card.appendChild(badge);

            // Evento de click para expandir detalhes
            card.addEventListener('click', function () {
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
            if (ruasPorLetra[letra] && ruasPorLetra[letra].length > 0) {
                // Remove disabled se tiver ruas
                navItem.classList.remove('disabled');
            } else {
                // Adiciona disabled se não tiver ruas
                navItem.classList.add('disabled');
            }
        }
    });
}

// --- LÓGICA DE CARREGAMENTO DA API ---

let _bairrosIndexCache = null

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

async function carregarRuasDoBairro(slug) {
    if (!_bairrosIndexCache) await carregarBairros()
    const bairro = _bairrosIndexCache[slug]
    if (!bairro) return {}

    const { data, error } = await supabase
        .from('ruas')
        .select(`*`) // Seleciona todas as colunas
        .eq('bairro_id', bairro.id)
        .order('nome_oficial', { ascending: true })

    if (error) throw error

    const ruasIndex = {}
    for (const rua of data) {
        const adaptada = { ...rua, imagemHomenageado: rua.imagemhomenageado }
        delete adaptada.imagemhomenageado
        ruasIndex[rua.nome_oficial] = adaptada

        // Adiciona ao array global para busca
        _todasRuas.push({ nome: rua.nome_oficial, detalhes: adaptada });
    }
    return ruasIndex
}

// --- FUNCIONALIDADE DE BUSCA COM AUTOCOMPLETE ---
let _todasRuas = [];

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

// Função para mostrar sugestões de autocomplete
function mostrarSugestoes(query) {
    const autocompleteDiv = document.getElementById('searchAutocomplete');
    const queryLower = query.trim().toLowerCase();

    // Se a busca estiver vazia ou muito curta, esconde autocomplete
    if (!queryLower || queryLower.length < 2) {
        autocompleteDiv.classList.remove('active');
        autocompleteDiv.innerHTML = '';
        return;
    }

    const resultados = [];

    // Buscar em todas as ruas carregadas
    _todasRuas.forEach(({ nome, detalhes }) => {
        const nomeMatch = nome.toLowerCase().includes(queryLower);
        const significadoMatch = detalhes.significado &&
            detalhes.significado.toLowerCase().includes(queryLower);
        const localizacaoMatch = detalhes.localizacao &&
            detalhes.localizacao.toLowerCase().includes(queryLower);

        if (nomeMatch || significadoMatch || localizacaoMatch) {
            resultados.push({ nome, detalhes });
        }
    });

    // Limita a 10 resultados
    const resultadosLimitados = resultados.slice(0, 10);

    // Monta o HTML do autocomplete
    if (resultadosLimitados.length === 0) {
        autocompleteDiv.innerHTML = `
            <div class="autocomplete-no-results">
                <i class="bi bi-search"></i>
                Nenhuma rua encontrada
            </div>
        `;
    } else {
        const header = `<div class="autocomplete-header">${resultadosLimitados.length} resultado${resultadosLimitados.length > 1 ? 's' : ''} encontrado${resultadosLimitados.length > 1 ? 's' : ''}</div>`;

        const items = resultadosLimitados.map(rua => {
            const primeiraLetra = rua.nome.replace(/^(Rua|Antônio|Ana)\s+/i, "").trim().charAt(0).toUpperCase();
            return `
                <div class="autocomplete-item" data-rua="${rua.nome}" data-letra="${primeiraLetra}">
                    <div class="autocomplete-item-title">
                        <i class="bi bi-signpost-2"></i>
                        ${rua.nome}
                        <span class="autocomplete-item-badge">${primeiraLetra}</span>
                    </div>
                    <div class="autocomplete-item-info">${rua.detalhes.localizacao || 'Localização não disponível'}</div>
                </div>
            `;
        }).join('');

        autocompleteDiv.innerHTML = header + items;

        // Adiciona eventos de click nos itens
        autocompleteDiv.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const nomeRua = item.getAttribute('data-rua');
                const letra = item.getAttribute('data-letra');
                navegarParaRua(letra, nomeRua);

                // Esconde autocomplete e limpa input
                autocompleteDiv.classList.remove('active');
                document.getElementById('searchInput').value = '';
            });
        });
    }

    // Mostra o autocomplete
    autocompleteDiv.classList.add('active');
}

// Função para navegar até uma rua específica
function navegarParaRua(letra, nomeRua) {
    // Primeiro, faz scroll até a seção da letra
    const secao = document.getElementById(letra);
    if (secao) {
        secao.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Aguarda um pouco para o scroll terminar, então destaca a rua
        setTimeout(() => {
            const cards = secao.querySelectorAll('.rua-card');
            cards.forEach(card => {
                const titulo = card.querySelector('.rua-card-title');
                if (titulo && titulo.textContent.includes(nomeRua)) {
                    // Destaca temporariamente
                    card.style.backgroundColor = 'rgba(255, 235, 59, 0.2)';
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Remove destaque após 2 segundos
                    setTimeout(() => {
                        card.style.backgroundColor = '';
                    }, 2000);
                }
            });
        }, 500);
    }
}

async function main() {
    try {
        // Primeiro, gera a estrutura HTML das seções do alfabeto
        gerarSecoesAlfabeto();

        // Mostra skeleton screens enquanto carrega
        mostrarSkeletons(3);

        const bairrosIndex = await carregarBairros();
        const dropdownLinks = document.querySelectorAll('.dropdown-item');

        async function renderBairro(slug) {
            console.log("Renderizando bairro:", slug);
            const bairroInfo = bairrosIndex[slug];
            if (!bairroInfo) return;

            // Mostra skeleton ao trocar de bairro
            mostrarSkeletons(3);

            const ruasIndex = await carregarRuasDoBairro(slug);
            const bairroComRuas = { ...bairroInfo, ruas: ruasIndex };

            // Limpa skeletons antes de exibir
            limparLoading();

            exibirIntroducaoBairro(bairroComRuas);
            exibirRuasPorLetra(bairroComRuas.ruas);
        }

        dropdownLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const slug = link.getAttribute('href').replace('#', '');
                renderBairro(slug);
            });
        });

        // Carrega o primeiro bairro por padrão
        if (Object.keys(bairrosIndex).length > 0) {
            const primeiroSlug = Object.keys(bairrosIndex)[0];
            renderBairro(primeiroSlug);
        }

        // Configurar a busca com debounce e autocomplete
        const searchInput = document.getElementById('searchInput');
        const autocompleteDiv = document.getElementById('searchAutocomplete');

        if (searchInput) {
            const debouncedSearch = debounce(mostrarSugestoes, 300);
            searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });

            // Esconde autocomplete ao clicar fora
            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !autocompleteDiv.contains(e.target)) {
                    autocompleteDiv.classList.remove('active');
                }
            });

            // Esconde ao pressionar ESC
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    autocompleteDiv.classList.remove('active');
                    searchInput.value = '';
                }
            });
        }

    } catch (err) {
        console.error('Erro ao carregar da API:', err);
        // Opcional: Mostrar uma mensagem de erro para o usuário na tela
        const mainDoc = document.getElementById('main-doc');
        if (mainDoc) {
            mainDoc.innerHTML = `<p style="text-align: center; color: red;">Não foi possível carregar os dados. Verifique sua conexão e tente novamente.</p>`;
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

    // Chatbot
    const chatbotButton = document.getElementById('chatbotButton');
    const chatbot = document.getElementById('chatbot');
    const closeChatbotButton = document.getElementById('closeChatbotButton');
    const chatbotMessages = document.getElementById('chatbotMessages');

    chatbotButton.addEventListener('click', function () {
        chatbot.style.display = "block";
        chatbotMessages.innerHTML = "Olá, <br> Se você conhece a história de alguma rua que não está presente em nosso dicionário, comente aqui. Sua contribuição irá agregar muito para o Dicionário de Ruas de Ouro Branco!";
    });

    closeChatbotButton.addEventListener('click', function () {
        chatbot.style.display = "none";
    });

    // Ativação das letras do nav lateral
    document.querySelectorAll("#navside li").forEach((item) => {
        item.addEventListener("click", () => {
            document.querySelectorAll("#navside li").forEach((el) => el.classList.remove("active"));
            item.classList.add("active");
        });
    });
});