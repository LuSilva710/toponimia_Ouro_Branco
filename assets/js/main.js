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
        const p = document.createElement('p');
        const a = document.createElement('a');
        a.className = 'section-ruas';

        const divInfo = document.createElement('div');
        divInfo.className = 'section-rua-info';

        const hr = document.createElement('hr');

        // Monta a estrutura
        p.appendChild(a);
        p.appendChild(divInfo);
        p.appendChild(hr);
        article.appendChild(p);
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

// Função para exibir introdução dinâmica do bairro
function exibirIntroducaoBairro(bairro) {
    const capaContainer = document.getElementById('capa-bairro');
    capaContainer.innerHTML = `
        <h2 class="mb-3">${bairro.titulo}</h2>
        <img src="${bairro.imagem_capa}" alt="Imagem do bairro ${bairro.titulo}" class="img-fluid rounded mb-3" style="max-height: 300px; object-fit: cover;">
        <p class="lead">${bairro.descricao}</p>
        <hr>
    `;
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
function exibirDetalhesRua(rua, linkRua) {
    // Fecha qualquer outra tabela que esteja aberta
    const tabelaAberta = document.querySelector('.detalhes-rua');
    if (tabelaAberta) {
        // Se a tabela clicada já está aberta, apenas a fecha.
        if (tabelaAberta.previousSibling === linkRua) {
            tabelaAberta.remove();
            return;
        }
        tabelaAberta.remove();
    }

    const divDetalhes = document.createElement('div');
    divDetalhes.classList.add('detalhes-rua');
    const tabelaRua = criarTabelaRua(rua);
    divDetalhes.appendChild(tabelaRua);
    linkRua.parentNode.insertBefore(divDetalhes, linkRua.nextSibling);
}

// Função para exibir as ruas de uma letra do alfabeto
function exibirRuasPorLetra(ruas) {
    const ruasPorLetra = agruparRuasPorLetra(ruas);
    const navItems = document.querySelectorAll("#navside li");

    document.querySelectorAll('.main-section').forEach(section => {
        if (section.id !== "Introdução") {
            section.style.display = 'none';
            const divRuas = section.querySelector('.section-ruas');
            if (divRuas) divRuas.innerHTML = '';
        }
    });

    navItems.forEach(item => {
        const link = item.querySelector("a");
        if (!link) return;

        const letraLink = link.getAttribute("href").replace("#", "");

        if (link.textContent.includes("↓")) return;

        if (ruasPorLetra[letraLink]) {
            item.classList.remove("nav-item-disabled");

            const secaoConteudo = document.getElementById(letraLink);
            if (secaoConteudo) {
                secaoConteudo.style.display = 'block'; // Torna a seção visível

                const divRuas = secaoConteudo.querySelector('.section-ruas');

                ruasPorLetra[letraLink].forEach(rua => {
                    const linkRua = document.createElement('a');
                    linkRua.href = '#';
                    linkRua.textContent = rua.nome;
                    linkRua.style.display = 'block';
                    linkRua.addEventListener('click', (e) => {
                        e.preventDefault();
                        exibirDetalhesRua(rua.detalhes, linkRua);
                    });
                    divRuas.appendChild(linkRua);
                });
            }
        } else {
            item.classList.add("nav-item-disabled");

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
    }
    return ruasIndex
}

async function main() {
    try {
        // Primeiro, gera a estrutura HTML das seções do alfabeto
        gerarSecoesAlfabeto();

        const bairrosIndex = await carregarBairros();
        const dropdownLinks = document.querySelectorAll('.dropdown-item');

        async function renderBairro(slug) {
            console.log("Renderizando bairro:", slug);
            const bairroInfo = bairrosIndex[slug];
            if (!bairroInfo) return;

            // --- NOVA LINHA: Atualiza o nome no Header ---
            const labelBairro = document.getElementById('nomeBairroExibido');
            if (labelBairro) {
                labelBairro.textContent = bairroInfo.nome; // Usa o nome amigável do bairro
            }

            const ruasIndex = await carregarRuasDoBairro(slug);
            const bairroComRuas = { ...bairroInfo, ruas: ruasIndex };

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