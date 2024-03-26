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
                <td colspan="5">${rua.significado}</td>
            </tr>
            <tr>
                <td colspan="4">
                    <iframe src="${rua.mapa}" width="100%" height="380" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
                </td>
                <td colspan="1">
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
    const divDetalhes = document.createElement('div');

    const tabelaRua = criarTabelaRua(rua);
    divDetalhes.appendChild(tabelaRua);

    // Inserir os detalhes da rua logo abaixo do link da rua clicada
    linkRua.parentNode.insertBefore(divDetalhes, linkRua.nextSibling);
}

// Função para exibir as ruas de uma letra do alfabeto
function exibirRuasPorLetra(ruas) {
    const ruasPorLetra = agruparRuasPorLetra(ruas);

    for (let letra in ruasPorLetra) {
        const secaoLetra = document.getElementById(letra);
        const divRuas = secaoLetra.querySelector('.section-ruas');
        divRuas.innerHTML = '';

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


// Função principal
function main() {
    fetch('assets/JSON/bairros.json')
        .then(response => response.json())
        .then(data => {
            const dropdownBairros = document.getElementById('dropdown-bairros');

            // Função para atualizar as ruas ao selecionar um bairro
            dropdownBairros.addEventListener('change', () => {
                const bairroSelecionado = dropdownBairros.value;
                const ruasDoBairro = data.bairros[bairroSelecionado].ruas;
                exibirRuasPorLetra(ruasDoBairro);
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
