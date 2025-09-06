// Torne seu arquivo um módulo e crie o client aqui.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://vtsuctcmycaiooeubjnk.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c3VjdGNteWNhaW9vZXViam5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMTI5MjYsImV4cCI6MjA3MjY4ODkyNn0.YvkjnpNLF-BZALghTD3fTJ7bQbzqc1_ZNlLCb0rUq3Y'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
// (opcional) expõe globalmente:
window.supabase = supabase
const { data: ping, error: pingErr } = await supabase
    .from('bairros')
    .select('id')
    .limit(1)

console.log('ping bairros:', ping, pingErr)

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
                <td>${rua.nome_oficial}</td>
                <td>${rua.localizacao}</td>
                <td>${rua.legislacao}</td>
                <td>${rua.codigo}</td>
                <td>${rua.regional}</td>
            </tr>
            <tr>
                <td colspan="3">${rua.significado}</td>
                <td colspan="2">
                    <img src="${rua.imagemHomenageado}" alt="Imagem do Homenageado" style="max-width: 65%; display: block; margin: auto;">
                </td>
            </tr>
            <tr>
                <td colspan="3">
                    <iframe src="${rua.mapa}" width="100%" height="380" style="border:0;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
                </td>
                <td colspan="2">
                    <img src="${rua.imagem}" alt="Imagem da rua" style="max-width: 90%;">
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
        const nomeSemPrefixo = nomeRua.replace(/^Rua\s+/i, "")
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
    const tabelaAberta = document.querySelector('.detalhes-rua');
    if (tabelaAberta) {
        tabelaAberta.parentNode.removeChild(tabelaAberta);
        return;
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
    const secoesLetras = document.querySelectorAll('.section-ruas');
    secoesLetras.forEach(secao => secao.innerHTML = '');

    for (let letra in ruasPorLetra) {
        const secaoLetra = document.getElementById(letra);
        if (!secaoLetra) continue;
        const divRuas = secaoLetra.querySelector('.section-ruas');

        ruasPorLetra[letra].forEach(rua => {
            const linkRua = document.createElement('a');
            linkRua.href = '#';
            linkRua.textContent = rua.nome;
            linkRua.addEventListener('click', function (event) {
                event.preventDefault();
                exibirDetalhesRua(rua.detalhes, linkRua);
            });
            divRuas.appendChild(linkRua);
            divRuas.appendChild(document.createElement('br'));
        });
    }
}

const API_BASE = "https://zxojqtxkaxgcnnsgoxub.supabase.co"; // se usar bundler; caso contrário deixe '' e sirva no mesmo host

// cache simples em memória pra evitar consultas repetidas
let _bairrosIndexCache = null

async function carregarBairros() {
    // Busca lista de bairros
    const { data, error } = await supabase
        .from('bairros')
        .select('id, slug, nome, titulo, imagem_capa, descricao')
        .order('nome', { ascending: true })

    if (error) throw error

    // Converte array -> objeto indexado por slug (como seu código espera)
    const bairrosIndex = {}
    for (const b of data) bairrosIndex[b.slug] = b

    _bairrosIndexCache = bairrosIndex
    return bairrosIndex
}

async function carregarRuasDoBairro(slug) {
    // Pegamos o bairro_id do cache (carregado por carregarBairros)
    if (!_bairrosIndexCache) await carregarBairros();
    const bairro = _bairrosIndexCache[slug];
    if (!bairro) return {};

    const { data, error } = await supabase
        .from('ruas')
        .select(`
            id,
            bairro_id,
            slug,
            nome_oficial,
            imagemhomenageado,
            significado,
            localizacao,
            legislacao,
            codigo,
            regional,
            mapa,
            imagem
        `)
        .eq('bairro_id', bairro.id)
        .order('nome_oficial', { ascending: true });

    if (error) throw error;
    const ruasIndex = {};
    for (const rua of data) {
        // A linha 'delete' foi removida aqui.
        const adaptada = { ...rua, imagemHomenageado: rua.imagemhomenageado };
        ruasIndex[rua.nome_oficial] = adaptada;
    }
    return ruasIndex;
}

async function main() {
    try {
        const bairrosIndex = await carregarBairros();
        const dropdownLinks = document.querySelectorAll('.dropdown-item');

        async function renderBairro(slug) {
            console.log("Render bairro:",slug)
            const bairroInfo = bairrosIndex[slug];
            if (!bairroInfo) return;

            // busca ruas via API
            const ruasIndex = await carregarRuasDoBairro(slug);

            // adapta para seu formato antigo:
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
        const primeiroSlug = Object.keys(bairrosIndex)[0];
        renderBairro(primeiroSlug);
    } catch (err) {
        console.error('Erro ao carregar da API:', err);
    }
}

main();

// Minimizar o menu do toggler ao clicar ou rolar
document.addEventListener("DOMContentLoaded", function () {
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
});

// Botão de voltar ao topo
document.addEventListener("DOMContentLoaded", function () {
    const returnTopButton = document.getElementById('returnTopButton');
    returnTopButton.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

// Chatbot
document.addEventListener("DOMContentLoaded", function () {
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
});

// Ativação das letras do nav lateral
document.querySelectorAll("#navside li").forEach((item) => {
    item.addEventListener("click", () => {
        document.querySelectorAll("#navside li").forEach((el) => el.classList.remove("active"));
        item.classList.add("active");
    });
});
