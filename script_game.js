// Configuração inicial do jogo de palavras cruzadas
// Elementos da interface
const crosswordContainer = document.getElementById('crossword');
const cluesList = document.getElementById('clues-list');
const timerElement = document.getElementById('timer');
const statusMessage = document.getElementById('status-message');
const checkButton = document.getElementById('check-button');
const restartButton = document.getElementById('restart-button');
const hintButton = document.getElementById('hint-button');


// Dados das palavras e configurações do jogo
const words = [
    {
        word: 'ANTÔNIOMATEUSRAFAEL',
        clue: 'A Creche homenageia um antigo morador que doou parte do terreno para construção da escola. Localizada na Rua Maria Lúcia - Povoado Campo Grande.',
        start: [32, 14],
        direction: 'horizontal'
    },
    {
        word: 'JOSÉDEANCHIETA',
        clue: 'Homenagem a um grande Jesuíta e pioneiro no cenário cultural da época. Localizada na Praça José Rafael Arcanjo - Povoado de João Gote.',
        start: [5, 23],
        direction: 'vertical'
    },
    {
        word: 'OSWALDOCRUZ',
        clue: 'Grande médico sanitarista brasileiro. Localizada na Praça Divino Espírito Santo - Comunidade de Castiliano.',
        start: [16, 16],
        direction: 'vertical'
    },
    {
        word: 'OLINDALOPESFERNANDES',
        clue: 'A creche tem este nome em homenagem a uma parteira nascida em Ouro Branco, que auxiliou nascimentos da maior parte das crianças na década de 1870. Localizada na Rua Paineira - Bairro Belvedere.',
        start: [12, 7],
        direction: 'horizontal'
    },
    {
        word: 'PIOXII',
        clue: 'O Colégio recebeu esse nome em homenagem ao papa que faleceu em 1958 e foi sucedido por JoãoXXIII. Localizada na Rua José Pereira Sobrinho - Centro.',
        start: [21, 22],
        direction: 'vertical'
    },
    {
        word: 'MARIAZITA',
        clue: 'A escola recebeu este nome em homenagem à mulher leiga que ministrou as primeiras lições ao falecido prefeito Fernando de Oliveira Silva . Localizada na Rua Boa Vista - Bairro Luzia Augusta.', start: [18, 19],
        direction: 'horizontal'
    },
    {
        word: 'MARIAUXILIADORATÔRRES',
        clue: 'A homenageada era conhecida como "Dorinha" , uma cidadã de Ouro Branco , nascida em 1945. Demonstrando um profundo comprometimento como educadora, dedicou-se com fervor e idealismo à sua profissão, tornando-se uma figura proeminente como diretora da Escola Municipal "João XXIII". Localizada na Rua Arthur Tavares - Centro.',
        start: [5, 40],
        direction: 'vertical'
    },
    {
        word: 'JOSÉFRANCISCONOGUEIRA',
        clue: 'A escola recebe esse nome em homenagem a um ilustre morador de Ouro Branco, que desempenhava o papel de professor na cidade. Localizada na Rua Congonhas do Campo - Bairro Metalurgia.',
        start: [7, 21],
        direction: 'horizontal'
    },
    {
        word: 'JOSÉESTEVÃOBATISTA',
        clue: 'Primeiro prefeito de Ouro Branco. Local: Praça José Rodrigues Sobrinho - Comunidade de Olaria.',
        start: [13, 36],
        direction: 'vertical'
    },
    {
        word: 'FERNANDOFELIXDESOUZA',
        clue: 'O nome da instituição foi em homenagem ao grande bataticultor, vereador e grande incentivador e colaborador do Dr José Bernardinho Reis para a implantação da Açominas em Ouro Branco. Localizada na Rua Donato Severino de Souza - Bairro São Francisco.', start: [35, 11],
        direction: 'horizontal'
    },
    {
        word: 'MARIAFIRMINADASILVA',
        clue: 'O nome da instituição foi em homenagem a mãe do ex-prefeito Sílvio José Mapa. Localizada na Rua São Paulo - Bairro Luzia Augusta.', start: [4, 1],
        direction: 'vertical'
    },
    {
        word: 'RAIMUNDOCAMPOS',
        clue: 'O nome da instituição se deve ao fato deste homem ter sido o primeiro prefeito da cidade de Ouro Branco/MG e ter ganhado três legislatura. Localizada na Praça José Rodrigues Sobrinho - Comunidade de Olaria.',
        start: [28, 17],
        direction: 'horizontal'
    },
    {
        word: 'LIVREMENTE',
        clue: 'O emblema da escola é um pássaro simbolizando a liberdade, e o seu nome deriva-se da formação de duas palavras. Localizada na Av. Barão de Eschwege - Bairro Pioneiros.', start: [18, 14],
        direction: 'vertical'
    },
    {
        word: 'JOÃOXXIII',
        clue: 'O nome do colégio foi escolhido para homenagear o Papa que trabalhou em prol da paz internacional e da adequação da igreja aos novos tempos. Localizado na Praça Nossa Senhora Mãe dos Homens - Centro.', start: [24, 18],
        direction: 'horizontal'
    },
    {
        word: 'NOSSSENHORADOCARMO',
        clue: 'A escola recebeu este nome em homenagem à padroeira da Comunidade. Localizada na Rua Evaristto de Souza - Comunidade de Cristais.',
        start: [30, 16],
        direction: 'horizontal'
    },
    {
        word: 'GERALDOMARINOVIEIRA',
        clue: 'A escola recebe esse nome devido a escolha do prefeito na época. Foi ex-funcionário público, vereador, e filho do ex-vice-prefeito Eduardo Nicomedes. Localizada na Rua Eucalipto - Bairro Belvedere.', start: [1, 10],

        direction: 'vertical'
    },
    {
        word: 'DOMLUCIANOMENDES',
        clue: 'O nome da escola foi escolhido para homenagear o Arcebispo de Mariana. Localizada na Avenida Ouro Preto - Bairro 1º de Maio.',
        start: [25, 29],
        direction: 'horizontal'
    },
    {
        word: 'GERALDOJOSÉVIEIRA',
        clue: 'A creche recebe esse nome em homenagem a uma figura de grande influência na política de Ouro Branco. Exercendo sua influência principalmente por volta da década de 70, era muito ligado aos prefeitos da época e à educação municipal. Localizada na Rua Dr. Miguel Francisco Vieira - Bairro São Francisco.',
        start: [5, 16],
        direction: 'horizontal'
    },
    {
        word: 'CÔNEGOLUIZVIEIRADASILVA',
        clue: 'A escola recebeu esse nome em homenagem ao mais notável inconfidente e o maior líder da conspiração Republicana Mineira. Localizada na Rua Geraldina Domingos - Centro.',
        start: [22, 11],
        direction: 'horizontal'
    },
    {
        word: 'IRACEMADEALMEIDA',
        clue: 'A escola tem este nome em homenagem a primeira professora formada da cidade de Ouro Branco, que dedicou grande parte de sua vida à causa da educação, prestando relevantes serviços à comunidade. Localizada na Rua Santa Olímpia - Bairro Siderurgia.', start: [19, 1],
        direction: 'horizontal'
    },
    {
        word: 'JOSÉBRÁSDOSREIS',
        clue: 'A escola homenagea um ouro branquense muito culto, que destinava parte de seu tempo como professor, principalmente aos analfabetos da comunidade, ensinando com muita maestria a arte de ler e escrever. Localizada na Rua José Guilherme - Centro.',
        start: [2, 26],
        direction: 'vertical'
    },
    {
        word: 'LEVINDOCOSTACARVALHO',
        clue: 'Recebeu este nome em homenagem a um cidadão ilustre e de família tradicional da cidade de Ouro Branco. Inclusive esta foi uma das primeiras famílias de Ouro Branco que, devido às suas características, tais como organização e trabalho, marcaram época no comércio e na história da respectiva cidade. Localizada na Rua Amarantina - Bairro 1° de Maio.',
        start: [19, 30],
        direction: 'vertical'
    },
    {
        word: 'MARIACORREIACOUTINHO',
        clue: 'O nome da instituição é em homenagem a uma das fundadoras da APAE Ouro Branco para atender as crianças com atendimentos especiais. Localizada na Rua Anhanguera - Bairro Siderurgia.',
        start: [11, 33],
        direction: 'vertical'
    }
];

// Variáveis de controle do jogo
let timer;
let seconds = 0;
const gridSize = 45;

// Estruturas de dados para armazenamento de estado
let correctLetters = Array(gridSize).fill(null).map(() => Array(gridSize).fill(''));  // Letras corretas das palavras
let cellIsPartOfWord = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false)); // Células que fazem parte de palavras
let revealedLetters = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));  // Letras reveladas por dicas
let userAnswers = Array(gridSize).fill(null).map(() => Array(gridSize).fill(''));         // Respostas do usuário
let wordEntries = []; // Entradas de palavras com suas posições

/**
 * Funções do Timer
 * Controle do tempo de jogo
 */
function startTimer() {
    timer = setInterval(() => {
        seconds++;
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        timerElement.textContent = `Tempo: ${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timer);
}

/**
 * Preenchimento do grid lógico
 * Cria a estrutura de dados com as palavras nas posições corretas
 */
function fillGrid() {
    // Reinicializa as estruturas de dados
    correctLetters = Array(gridSize).fill(null).map(() => Array(gridSize).fill(''));
    cellIsPartOfWord = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
    wordEntries = [];

    // Posiciona cada palavra no grid
    words.forEach(item => {
        const { word, start, direction } = item;
        const [row, col] = start;
        const positions = [];

        for (let i = 0; i < word.length; i++) {
            const currentRow = direction === 'horizontal' ? row : row + i;
            const currentCol = direction === 'horizontal' ? col + i : col;

            if (currentRow >= gridSize || currentCol >= gridSize) {
                console.error(`Palavra "${word}" não cabe na posição [${row},${col}]`);
                return;
            }

            correctLetters[currentRow][currentCol] = word[i];
            cellIsPartOfWord[currentRow][currentCol] = true;
            positions.push({ row: currentRow, col: currentCol });
        }

        wordEntries.push({ word, positions });
    });
}

/**
 * Renderização do grid
 * Cria a interface visual do jogo baseada no estado atual
 */
function renderGrid() {
    crosswordContainer.innerHTML = '';
    crosswordContainer.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;

    let wordIndex = 1;
    const positionMarkers = {};

    // Marca as posições iniciais das palavras com números
    wordEntries.forEach(entry => {
        const firstPos = entry.positions[0];
        positionMarkers[`${firstPos.row},${firstPos.col}`] = wordIndex++;
    });

    // Cria cada célula do grid
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const cellElement = document.createElement('div');
            cellElement.className = 'grid-cell';

            if (cellIsPartOfWord[row][col]) {
                const input = document.createElement('input');
                input.maxLength = 1;
                input.dataset.row = row;
                input.dataset.col = col;

                // Define o valor do input baseado no estado
                input.value = revealedLetters[row][col]
                    ? correctLetters[row][col]
                    : userAnswers[row][col];

                if (revealedLetters[row][col]) {
                    input.disabled = true;
                    input.classList.add('revealed');
                }

                // Adiciona número da palavra na primeira posição
                if (positionMarkers[`${row},${col}`]) {
                    const marker = document.createElement('span');
                    marker.className = 'word-number';
                    marker.textContent = positionMarkers[`${row},${col}`];
                    cellElement.appendChild(marker);
                }

                cellElement.appendChild(input);
            } else {
                cellElement.classList.add('black-cell');
            }

            crosswordContainer.appendChild(cellElement);
        }
    }

    renderClues();
}

/**
 * Sistema de dicas
 * Revela aleatoriamente uma letra de uma palavra não resolvida
 */
function giveHint() {
    const eligibleWords = wordEntries.filter(wordEntry =>
        wordEntry.positions.some(pos => !revealedLetters[pos.row][pos.col])
    );

    if (eligibleWords.length === 0) {
        alert('Todas as dicas já foram reveladas!');
        return;
    }

    const randomWordEntry = eligibleWords[Math.floor(Math.random() * eligibleWords.length)];
    const unrevealedPositions = randomWordEntry.positions.filter(pos => !revealedLetters[pos.row][pos.col]);
    const randomPosition = unrevealedPositions[Math.floor(Math.random() * unrevealedPositions.length)];

    // Atualiza estruturas de dados
    revealedLetters[randomPosition.row][randomPosition.col] = true;
    userAnswers[randomPosition.row][randomPosition.col] = correctLetters[randomPosition.row][randomPosition.col];

    // Atualiza a interface
    const input = document.querySelector(`input[data-row="${randomPosition.row}"][data-col="${randomPosition.col}"]`);
    if (input) {
        input.value = correctLetters[randomPosition.row][randomPosition.col];
        input.disabled = true;
        input.classList.add('revealed');
    }
}

/**
 * Verificação de respostas
 * Compara as respostas do usuário com as soluções corretas
 */
function checkAnswers() {
    let allCorrect = true;

    document.querySelectorAll('#crossword input:not(.revealed)').forEach(input => {
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);
        const userInput = input.value.toUpperCase();
        const correctAnswer = correctLetters[row][col];

        // Atualiza o estado e a interface
        userAnswers[row][col] = userInput;

        if (userInput !== correctAnswer) {
            allCorrect = false;
            input.style.backgroundColor = '#FFCCCC';
        } else {
            input.style.backgroundColor = '#FFFFFF';
        }
    });

    // Atualiza mensagem de status
    if (allCorrect) {
        stopTimer();
        statusMessage.textContent = 'Parabéns! Você completou o jogo!';
        statusMessage.style.color = 'green';
    } else {
        statusMessage.textContent = 'Ainda há erros! Continue tentando!';
        statusMessage.style.color = 'red';
    }
}

/**
 * Reinício do jogo
 * Reseta todos os estados e reinicia o jogo
 */
function resetGame() {
    stopTimer();
    seconds = 0;
    timerElement.textContent = 'Tempo: 00:00';
    statusMessage.textContent = 'Preencha todas as palavras corretamente!';
    statusMessage.style.color = 'inherit';

    // Reinicializa estruturas de dados
    revealedLetters = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
    userAnswers = Array(gridSize).fill(null).map(() => Array(gridSize).fill(''));

    fillGrid();
    renderGrid();
    startTimer();
}

/**
 * Renderização das pistas
 * Exibe a lista de pistas para o jogador
 */
function renderClues() {
    cluesList.innerHTML = '';
    words.forEach((item, index) => {
        const clueItem = document.createElement('li');
        clueItem.innerHTML = `<strong>${index + 1}.</strong> ${item.clue}`;
        cluesList.appendChild(clueItem);
    });
}

// Event Listeners
document.addEventListener('input', (event) => {
    if (event.target.tagName === 'INPUT') {
        const row = parseInt(event.target.dataset.row);
        const col = parseInt(event.target.dataset.col);
        const userInput = event.target.value.toUpperCase();
        const correctAnswer = correctLetters[row][col];
        userAnswers[row][col] = userInput;

        // Verificação em tempo real
        if (userInput === correctAnswer) {
            event.target.style.backgroundColor = '#CCFFCC'; // Verde igual às dicas
        } else {
            event.target.style.backgroundColor = '#FFFFFF'; // Volta ao normal
        }
    }
});

restartButton.addEventListener('click', resetGame);
checkButton.addEventListener('click', checkAnswers);
hintButton.addEventListener('click', giveHint);

// Inicialização do jogo
fillGrid();
renderGrid();
startTimer();