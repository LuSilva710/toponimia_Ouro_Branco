// Importa o client Supabase do módulo compartilhado
import { supabase } from './supabase-client.js'

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
                    ${rua.imagemHomenageado ? `<img src="${normalizePath(rua.imagemHomenageado)}" alt="Imagem do Homenageado" style="max-width: 65%; display: block; margin: auto;">` : ''}
                </td>
            </tr>
            <tr>
                <td colspan="3">
                    ${rua.mapa ? `<iframe src="${rua.mapa}" width="100%" height="380" style="border:0;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : 'Mapa não disponível.'}
                </td>
                <td colspan="2">
                    ${rua.imagem ? `<img src="${normalizePath(rua.imagem)}" alt="Imagem da rua" style="max-width: 90%;">` : ''}
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
            card.setAttribute('data-rua-nome', rua.nome);

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
let _todasRuas = [];

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

            const isExpanded = card.nextSibling && card.nextSibling.classList && card.nextSibling.classList.contains('detalhes-rua');
            if (!isExpanded) {
                card.click();
            }
        }
    }, 150);
}

function filtrarRuas(query) {
    const queryLower = removerAcentos(query.trim().toLowerCase());

    // Se a busca estiver vazia, limpa tudo e restaura o estado original
    if (!queryLower || queryLower.length < 2) {
        limparBusca(false); // false para não focar o input novamente
        return;
    }

    // Adiciona feedback de loading no input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.classList.add('search-loading');
    }

    const resultados = {};
    let totalResultados = 0;

    // Buscar em todas as ruas carregadas
    _todasRuas.forEach(({ nome, detalhes }) => {
        const nomeNorm = removerAcentos(nome.toLowerCase());
        const sigNorm = detalhes.significado ? removerAcentos(detalhes.significado.toLowerCase()) : '';
        const nomeMatch = nome.toLowerCase().includes(queryLower);
        const significadoMatch = detalhes.significado &&
            detalhes.significado.toLowerCase().includes(queryLower);
        const localizacaoMatch = detalhes.localizacao &&
            detalhes.localizacao.toLowerCase().includes(queryLower);

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
        <button class="clear-search-btn" onclick="limparBusca()">
            <i class="bi bi-x-circle"></i>
            Limpar busca
        </button>
    `;
    feedback.appendChild(headerDiv);

    // Se houver resultados, cria a lista de cards
    if (quantidade > 0 && resultados) {
        const listDiv = document.createElement('div');
        listDiv.className = 'search-results-list';

        Object.entries(resultados).forEach(([nome, detalhes]) => {
            const card = document.createElement('div');
            card.className = 'search-result-card';
            card.style.cursor = 'pointer';

            const nomeBairro = obterNomeBairro(detalhes.bairro_id);
            const slugBairro = obterSlugBairro(detalhes.bairro_id);

            // Cabeçalho do card
            const cardHeader = document.createElement('div');
            cardHeader.className = 'search-result-card-header';
            cardHeader.style.marginBottom = '0';
            cardHeader.innerHTML = `
                <span class="search-result-card-title">
                    <i class="bi bi-signpost-2"></i> ${nome}
                </span>
                <span class="search-result-card-bairro"><i class="bi bi-geo-alt-fill"></i> ${nomeBairro || 'Sem Bairro'}</span>
            `;
            card.appendChild(cardHeader);

            // Redireciona ao clicar no card
            card.addEventListener('click', (e) => {
                e.preventDefault();
                if (slugBairro) {
                    irParaRuaNoBairro(slugBairro, nome);
                }
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

// Função para limpar a busca
window.limparBusca = function (shouldFocus = true) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        if (shouldFocus) searchInput.focus();
    }

    // Remove feedback
    const feedback = document.querySelector('.search-results-info');
    if (feedback) feedback.remove();

    // Remove loading do input
    searchInput?.classList.remove('search-loading');

    // Restaura as ruas do bairro selecionado se possível
    const dropdownMenu = document.querySelector('.dropdown-menu');
    const bairoAtivo = dropdownMenu?.querySelector('.dropdown-item.active') ||
        dropdownMenu?.querySelector('.dropdown-item');

    if (bairoAtivo) {
        const slug = bairoAtivo.getAttribute('href').replace('#', '');
        // Usamos uma variável global se existir ou tentamos disparar o clique
        // Para simplificar, vamos apenas disparar o clique se for manual ou 
        // recarregar o bairro atual se tivermos o slug
        if (window.renderBairroAtual) {
            window.renderBairroAtual(slug);
        }
    }
}

async function main() {
    try {
        // Primeiro, gera a estrutura HTML das seções do alfabeto
        gerarSecoesAlfabeto();

        // Mostra skeleton screens enquanto carrega
        mostrarSkeletons(3);

        const bairrosIndex = await carregarBairros();
        await carregarTodasRuas(); // Pré-carrega todas as ruas para busca global rápida
        // Lógica do Dropdown Customizado
        const dropdownTrigger = document.querySelector('.dropdown-trigger');
        const dropdownMenu = document.querySelector('.dropdown-menu-custom');
        const selectedBairroSpan = document.getElementById('selected-bairro');
        const bairroList = document.getElementById('bairro-list');

        if (dropdownTrigger && dropdownMenu && bairroList) {
          // Fechar ao clicar fora
          document.addEventListener('click', (e) => {
            if (!dropdownTrigger.contains(e.target) && !dropdownMenu.contains(e.target)) {
              dropdownMenu.classList.remove('active');
            }
          });

          // Toggle abrir/fechar
          dropdownTrigger.addEventListener('click', () => {
            dropdownMenu.classList.toggle('active');
          });

          // Preencher a lista de bairros
          bairroList.innerHTML = '';
          
          // Bairros da API
          Object.entries(bairrosIndex).forEach(([slug, b]) => {
            const li = document.createElement('li');
            li.textContent = b.nome;
            li.addEventListener('click', () => {
              selectedBairroSpan.textContent = b.nome;
              dropdownMenu.classList.remove('active');
              renderBairro(slug);
            });
            bairroList.appendChild(li);
          });
        }


        async function renderBairro(slug) {
            console.log("Renderizando bairro:", slug)
            const bairroInfo = bairrosIndex[slug];
            if (!bairroInfo) return;

            // Limpa a busca ao trocar de bairro
            const feedback = document.querySelector('.search-results-info');
            if (feedback) feedback.remove();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';

            // Mostra skeleton ao trocar de bairro
            mostrarSkeletons(3);

            const ruasIndex = await carregarRuasDoBairro(slug);
            const bairroComRuas = { ...bairroInfo, ruas: ruasIndex };

            // Limpa skeletons antes de exibir
            limparLoading();

            exibirIntroducaoBairro(bairroComRuas);
            exibirRuasPorLetra(bairroComRuas.ruas);

            // Atualiza o estado visual do menu (bairro ativo)
            document.querySelectorAll('.dropdown-item').forEach(link => {
                if (link.getAttribute('href') === `#${slug}`) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });

            // Sincroniza o dropdown customizado
            const selectedBairroSpan = document.getElementById('selected-bairro');
            if (selectedBairroSpan && bairroInfo) {
              selectedBairroSpan.textContent = bairroInfo.nome;
            }
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

        // Carrega o primeiro bairro por padrão
        if (Object.keys(bairrosIndex).length > 0) {
            const primeiroSlug = Object.keys(bairrosIndex)[0];
            renderBairro(primeiroSlug);
        }

        // Configurar busca com debounce de 400ms
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                filtrarRuas(e.target.value);
            }, 400));

            // Permite busca imediata ao pressionar Enter
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    filtrarRuas(e.target.value);
                }
            });
        }

        // Configurar clique no ícone de busca como um botão de pesquisa
        const searchIcon = document.querySelector('.search-icon');
        if (searchIcon && searchInput) {
            searchIcon.addEventListener('click', () => {
                filtrarRuas(searchInput.value);
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


    // Ativação das letras do nav lateral
    document.querySelectorAll("#navside li").forEach((item) => {
        item.addEventListener("click", () => {
            document.querySelectorAll("#navside li").forEach((el) => el.classList.remove("active"));
            item.classList.add("active");
        });
    });
});
