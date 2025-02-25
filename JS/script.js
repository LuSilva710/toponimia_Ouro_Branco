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
                <img src="${rua.imagemHomenageado}" alt="Imagem do Homenageado" style="max-width: 65%; display: block; margin-left: auto; margin-right: auto;"></td>
            </tr>
            <tr>
                <td colspan="3">
                    <iframe src="${rua.mapa}" width="100%" height="380" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
                </td>
                <td colspan="2">
                    <img src="${rua.imagem}" alt="Imagem da rua" style="max-width: 90%;">
                </td>
            </tr>
        </tbody>
    `;
    return tabela;
}

// Função para agrupar ruas por letra do alfabeto
function agruparRuasPorLetra(ruas) {
    const ruasPorLetra = {};

    for (const nomeRua in ruas) {
        const primeiraLetra = nomeRua.charAt(0).toUpperCase();
        if (!ruasPorLetra[primeiraLetra]) {
            ruasPorLetra[primeiraLetra] = [];
        }
        ruasPorLetra[primeiraLetra].push({ nome: nomeRua, detalhes: ruas[nomeRua] });
    }

    return ruasPorLetra;
}

// Função para exibir os detalhes de uma rua
function exibirDetalhesRua(rua, linkRua) {
    // Verificar se há uma tabela já aberta
    const tabelaAberta = document.querySelector('.detalhes-rua');
    if (tabelaAberta) {
        tabelaAberta.parentNode.removeChild(tabelaAberta); // Remover tabela aberta
        return; // Retorna para evitar a abertura de uma nova tabela
    }

    const divDetalhes = document.createElement('div');
    divDetalhes.classList.add('detalhes-rua'); // Adicionar classe para rastreamento

    const tabelaRua = criarTabelaRua(rua);
    divDetalhes.appendChild(tabelaRua);

    // Inserir os detalhes da rua logo abaixo do link da rua clicada
    linkRua.parentNode.insertBefore(divDetalhes, linkRua.nextSibling);
}
 
// Função para exibir as ruas de uma letra do alfabeto
function exibirRuasPorLetra(ruas) {
    const ruasPorLetra = agruparRuasPorLetra(ruas);

    // Limpar todas as seções de letras antes de exibir as ruas do novo bairro
    const secoesLetras = document.querySelectorAll('.section-ruas');
    secoesLetras.forEach(secao => {
        secao.innerHTML = '';
    });

    for (let letra in ruasPorLetra) {
        const secaoLetra = document.getElementById(letra);
        const divRuas = secaoLetra.querySelector('.section-ruas');

        ruasPorLetra[letra].forEach(rua => {
            const linkRua = document.createElement('a');
            linkRua.href = '#';
            linkRua.textContent = rua.nome;
            linkRua.addEventListener('click', function(event) {
                event.preventDefault();
                exibirDetalhesRua(rua.detalhes, linkRua);
            });

            divRuas.appendChild(linkRua);
            divRuas.appendChild(document.createElement('br'));
        });
    }
}



// Listar bairros em ordem alfabética
function main() {
    fetch('/JSON/bairros.json')
        .then(response => response.json())
        .then(data => {
            const dropdownLinks = document.querySelectorAll('.dropdown-item');

            // Função para atualizar as ruas ao clicar em um bairro
            dropdownLinks.forEach(link => {
                link.addEventListener('click', (event) => {
                    event.preventDefault(); // Evitar comportamento padrão do link
                    const bairroSelecionado = link.getAttribute('href').replace('#', '');
                    const ruasDoBairro = data.bairros[bairroSelecionado].ruas;
                    exibirRuasPorLetra(ruasDoBairro);
                });
            });

            // Exibir as ruas do primeiro bairro na lista por padrão
            const primeiroBairro = Object.keys(data.bairros)[0];
            const ruasDoPrimeiroBairro = data.bairros[primeiroBairro].ruas;
            exibirRuasPorLetra(ruasDoPrimeiroBairro);
        })
        .catch(error => {
            console.error('Erro ao carregar JSON de ruas:', error);
        });
}


// Chamada da função principal
main();

// Minimizar o menu do toggler
document.addEventListener("DOMContentLoaded", function() {
    const dropdownLinks = document.querySelectorAll('.dropdown-item');
    const navbarToggler = document.querySelector('.navbar-toggler');
    const navbarCollapse = document.querySelector('.navbar-collapse');

    // Fechar o menu ao clicar em um link do dropdown
    dropdownLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navbarCollapse.classList.contains('show')) {
                navbarToggler.click(); // Fecha o menu
            }
        });
    });

    // Fechar o menu ao rolar a tela
    window.addEventListener('scroll', function() {
        if (navbarCollapse.classList.contains('show')) {
            navbarToggler.click(); // Fecha o menu
        }
    });
});



document.addEventListener("DOMContentLoaded", function() {
    const returnTopButton = document.getElementById('returnTopButton');

    // Adiciona um evento de clique ao botão "Voltar ao topo"
    returnTopButton.addEventListener('click', function() {
        // Scroll suave para o topo da página
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
});


// Chatbot
document.addEventListener("DOMContentLoaded", function() {
    const chatbotButton = document.getElementById('chatbotButton');
    const chatbot = document.getElementById('chatbot');
    const closeChatbotButton = document.getElementById('closeChatbotButton');
    const chatbotMessages = document.getElementById('chatbotMessages');
  
    chatbotButton.addEventListener('click', function() {
      chatbot.style.display = "block";
      chatbotMessages.innerHTML = "Olá, <br> Se você conhece a história de alguma rua que não está presente em nosso dicionário, comente aqui. Sua contribuição irá agregar muito para o Dicionário de Ruas de Ouro Branco!";
    });
  
    closeChatbotButton.addEventListener('click', function() {
      chatbot.style.display = "none";
    });
  });
  
  document.querySelectorAll("#navside li").forEach((item) => {
    item.addEventListener("click", () => {
      document
        .querySelectorAll("#navside li")
        .forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
    });
  });
  