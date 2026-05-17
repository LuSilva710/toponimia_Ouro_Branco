
import fs from 'fs';
import path from 'path';

const inputPath = './scripts/missing_streets.json';
const outputPath = './sql/20_auto_classification.sql';

const masculineKeywords = [
  'antônio', 'josé', 'joão', 'luiz', 'pedro', 'francisco', 'geraldo', 'sebastião', 'manoel', 'manuel', 
  'carlos', 'roberto', 'mário', 'vicente', 'domingos', 'jorge', 'paulo', 'henrique', 'wilson', 'getúlio', 
  'rui', 'cônego', 'padre', 'frei', 'dom', 'doutor', 'dr.', 'professor', 'prof.', 'coronel', 'cel.', 
  'general', 'tenente', 'ten.', 'capitão', 'cap.', 'barão', 'conde', 'visconde', 'marquês', 'monsenhor', 
  'vereador', 'ver.', 'prefeito', 'governador', 'ministro', 'engenheiro', 'eng.', 'arquiteto', 'advogado', 
  'são', 'santo', 'amaro', 'vidal', 'luiz', 'paula', 'amintas', 'rui', 'rodrigo', 'aprígio', 'cláudio', 
  'dias', 'baldomero', 'ayres', 'rezende', 'eschwege', 'toledo', 'salvador', 'silvio', 'nicolau', 'vitoriano',
  'clodomiro', 'cristiano', 'mario', 'castro', 'edmundo', 'machado', 'monteiro', 'fagundes', 'milton', 
  'euclides', 'norival', 'otoni', 'aristides', 'dorvalino', 'david', 'edgar', 'andré', 'pires', 'queiros', 
  'galdino', 'frederico', 'jaime', 'olegário', 'clemente', 'aparecido', 'robério', 'onésimo', 'rosalino', 
  'vasco', 'pero', 'pascoal', 'martim', 'jerônimo', 'fernao', 'monlevade', 'alfredo', 'alicio', 'celestino', 
  'hermógenes', 'ascendino', 'inocêncio', 'louis', 'pandiá', 'renato', 'juvencino', 'percival', 'lauro', 
  'willy', 'vanilson', 'ozanan', 'camarinho', 'elizontino', 'osório', 'aliperte', 'anestor', 'izidro', 
  'vital', 'faustino', 'paulino', 'vicente', 'ivo', 'jorge', 'anacleto', 'firmo', 'patrocínio', 'rimijo', 
  'rezende', 'afonso', 'fernando', 'peixoto', 'assunção', 'arantes', 'hermogenes', 'leoncio', 'teodoro', 
  'gurgel', 'gentil', 'eloi', 'jacob', 'miguel', 'rangel', 'aluísio', 'coelho', 'graciliano', 'érico', 
  'casimiro', 'natalino', 'anselmo', 'arundino', 'brás', 'garcia', 'astor', 'aureliano', 'gumercindo', 
  'pedrosa', 'teófilo', 'juscelino', 'levindo', 'martins', 'waldemar', 'orione', 'aparício', 'florencio', 
  'xisto', 'guatimosim', 'mauá', 'rafael', 'schuch', 'donato', 'miranda', 'claudionor', 'silvestre', 
  'arthur', 'augusto', 'tomás', 'emílio', 'durval', 'nicolau', 'nicomedes', 'evencio', 'sérvulo', 'ayres', 
  'apolinário', 'conceição', 'mapa', 'nuno', 'jadir', 'arzão', 'sabino', 'alberto', 'sardinha', 'wigg'
];

const feminineKeywords = [
  'maria', 'ana', 'terezinha', 'tereza', 'rosa', 'lucia', 'lúcia', 'aparecida', 'lourdes', 'conceição', 
  'rita', 'helena', 'isabel', 'alice', 'olinda', 'eulália', 'geraldina', 'roselmira', 'virginita', 
  'áurea', 'stella', 'sinésia', 'irmã', 'dona', 'senhora', 'sra.', 'santa', 'olímpia', 'ivanilde', 
  'mercília', 'gaivota', 'amarantina', 'consença', 'augusta', 'mariana', 'boavista', 'terezinha', 
  'inês', 'rosália', 'roselmira', 'áurea', 'piedade', 'guaira', 'francisca', 'auxiliadora', 'ermenegilda', 
  'tavares', 'rodrigues', 'sinésia', 'reis', 'stella', 'izabel', 'silveria', 'aparecida', 'sílvia', 
  'petrina', 'conceição', 'cecília', 'júlia', 'olinda', 'ercilia', 'deijanira', 'augusta', 'mariza', 
  'olga', 'dorvalina', 'eurides', 'meireles', 'aparecida', 'eulália', 'penha', 'ana', 'geralda', 'firmina'
];

const neuterKeywords = [
  'rua um', 'rua dois', 'rua três', 'rua quatro', 'rua cinco', 'rua seis', 'rua sete', 'rua oito', 'rua nove', 'rua dez',
  'ipê', 'jequitibá', 'peroba', 'braúna', 'sucupira', 'eucalipto', 'candeia', 'manacá', 'camélias', 'rosas', 'orquídeas', 
  'hortências', 'pau brasil', 'cabiuna', 'pinheiro', 'cerejeira', 'sibipiruna', 'palmeiras', 'beija-flor', 'sabiá', 
  'gaivota', 'faisão', 'rouxinol', 'tucano', 'cardeal', 'bem-te-vi', 'brasil', 'minas gerais', 'ouro branco', 
  'belo horizonte', 'rio de janeiro', 'são paulo', 'bahia', 'ceará', 'goiás', 'paraná', 'amazonas', 'vitória', 
  'curitiba', 'porto alegre', 'belém', 'fortaleza', 'maceió', 'natal', 'terezina', 'aracaju', 'brasília', 
  'goiânia', 'cuiabá', 'campo grande', 'palmas', 'porto velho', 'boa vista', 'macapá', 'rio branco', 'alagoas', 
  'amapá', 'espírito santo', 'mato grosso', 'paraíba', 'pernambuco', 'piauí', 'rio grande', 'rondônia', 'roraima', 
  'santa catarina', 'sergipe', 'tocantins', 'distrito federal', 'gerdau', 'açominas', 'acesita', 'belgo mineira', 
  'cimetal', 'coferraz', 'consider', 'cosigua', 'cosim', 'lafersa', 'mannesmam', 'siderbrás', 'villares',
  'santana', 'camélias', 'cabiuna', 'pinheiro', 'cerejeira', 'eucalipto', 'candeia', 'jequitibá', 'jacarandá', 
  'missões', 'faisão', 'gaivota', 'sabiá', 'amarantina', 'beija-flor', 'cachoeira', 'casa grande', 'entre rios', 
  'itaverava', 'barra mansa', 'jeceaba', 'lamim', 'piranga', 'rio espera', 'queluzito', 'senhora de oliveira', 
  'fiel', 'siderbrás', 'villares', 'pains', 'belo vale', 'carandaí', 'cristais', 'itabirito', 'oliveira', 
  'mariana', 'morro', 'alagoas', 'amapá', 'bahia', 'belém', 'belo horizonte', 'boa vista', 'brasília', 
  'campo grande', 'ceará', 'sibipiruna', 'céu', 'rotas', 'cuiabá', 'dois', 'rouxinol', 'tucano', 'cardeal', 
  'rosas', 'serra', 'park', 'distrito federal', 'fortaleza', 'salanacia', 'hortências', 'orquídeas', 
  'acesita', 'aço norte', 'goiás', 'macapá', 's1-vl3', 's2-vl4', 's7-vl5', 'anhanguera', 'belgo mineira', 
  'cimetal', 'maceió', 'manaus', 'maranhão', 'coferraz', 'consider', 'piedade', 'moeda', 'cosigua', 'cosim', 
  'minas gerais', 'palmas', 'acre', 'seringueira', 'rondônia', 'dedine', 'ferro brasileiro', 'terezina', 
  'guaira', 'amazonas', 'aracaju', 'itaunense', 'lobo leite', 'amestista', 'lafersa', 'safira', 'curitiba', 
  'santa gema', 'paraná', 'topázio', 'turquesa', 'patriótica', 'rio grandense', 'florianópolis', 'natal', 
  'pará', 'porto alegre', 'vitória', 'goiânia', 'rubi', 'lavoura', 'flores', 'mercês', 'esmeralda', 'cruzeiro', 
  'ametista', 'sagrados corações', 'santa cruz', 'paraíba', 'paineira', 'pernambuco', 'piauí', 'porto velho', 
  'argentina', 'aparecida', 'belo vale', 'carandaí', 'lafersa', 'burnier', 'frança', 'itália', 'nações unidas', 
  'portugal', 'rio de janeiro', 'roraima', 'salvador', 'sergipe', 'tocantins', 'mato grosso', 'congonhas', 
  'itabirito', 'mariana', 'ouro preto', 'desterro', 'aparecida', 'espírito santo', 'fernando de noronha', 
  'leite', 'suaçui'
];

function classify(name) {
  const n = name.toLowerCase();
  
  // Ordem de prioridade: Neutro (geográfico/natureza) > Feminino > Masculino
  // Muitas vezes nomes geográficos contêm "São" ou "Santa" (ex: São Paulo, Santa Luzia), 
  // mas aqui o contexto de "Gênero do Homenageado" sugere Neutro para cidades.
  
  for (const k of neuterKeywords) {
    if (n.includes(k)) return 'neutro';
  }
  for (const k of feminineKeywords) {
    if (n.includes(k)) return 'feminino';
  }
  for (const k of masculineKeywords) {
    if (n.includes(k)) return 'masculino';
  }
  return 'neutro'; // Default
}

function getCategory(name) {
  const n = name.toLowerCase();
  if (n.includes('rua ') || n.includes('avenida ') || n.includes('praça ') || n.includes('travessa ')) {
    // Check specific categories
    if (n.includes('são ') || n.includes('santo ') || n.includes('santa ') || n.includes('nossa senhora') || n.includes('dom orione')) return 'hagiotoponimo';
    if (n.includes('professor') || n.includes('barão') || n.includes('conde') || n.includes('cônego') || n.includes('padre') || n.includes('doutor') || n.includes('dr.')) return 'axiotoponimo';
    
    // Default to antropotoponimo if it has keywords that look like a person
    const isPerson = [...masculineKeywords, ...feminineKeywords].some(k => n.includes(k));
    if (isPerson) return 'antropotoponimo';
  }
  
  // Nature categories
  for (const k of ['ipê', 'jequitibá', 'peroba', 'braúna', 'sucupira', 'eucalipto', 'candeia', 'manacá', 'camélias', 'rosas', 'orquídeas', 'hortências', 'pau brasil', 'cabiuna', 'pinheiro', 'cerejeira', 'sibipiruna', 'palmeiras']) {
    if (n.includes(k)) return 'fitotoponimo';
  }
  for (const k of ['beija-flor', 'sabiá', 'gaivota', 'faisão', 'rouxinol', 'tucano', 'cardeal', 'bem-te-vi']) {
    if (n.includes(k)) return 'zootoponimo';
  }
  for (const k of ['rubi', 'safira', 'topázio', 'turquesa', 'ametista', 'esmeralda', 'amestista', 'pedra', 'rocha']) {
    if (n.includes(k)) return 'litotoponimo';
  }
  for (const k of ['brasil', 'minas gerais', 'ouro branco', 'belo horizonte', 'rio de janeiro', 'são paulo', 'bahia', 'ceará', 'goiás', 'paraná', 'amazonas', 'vitória', 'curitiba', 'porto alegre', 'belém', 'fortaleza', 'maceió', 'natal', 'terezina', 'aracaju', 'brasília', 'goiânia', 'cuiabá', 'campo grande', 'palmas', 'porto velho', 'boa vista', 'macapá', 'rio branco', 'alagoas', 'amapá', 'espírito santo', 'mato grosso', 'paraíba', 'pernambuco', 'piauí', 'rio grande', 'rondônia', 'roraima', 'santa catarina', 'sergipe', 'tocantins', 'distrito federal', 'mariana', 'itabirito', 'congonhas', 'ouro preto', 'queluzito', 'jeceaba', 'lamim', 'piranga', 'rio espera', 'senhora de oliveira']) {
    if (n.includes(k)) return 'corotoponimo';
  }
  for (const k of ['gerdau', 'açominas', 'acesita', 'belgo mineira', 'cimetal', 'coferraz', 'consider', 'cosigua', 'cosim', 'lafersa', 'mannesmam', 'siderbrás', 'villares', 'dedine', 'ferro brasileiro', 'aço norte']) {
    if (n.includes(k)) return 'sociotoponimo';
  }
  
  return 'outro';
}

const streets = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
let sql = '-- Classificação automática de ruas\n';

streets.forEach(name => {
  const gen = classify(name);
  const cat = getCategory(name);
  // Escapar aspas simples para o SQL
  const safeName = name.replace(/'/g, "''");
  sql += `UPDATE ruas SET genero_homenageado = '${gen}', categoria_toponimica = '${cat}' WHERE LOWER(nome_oficial) = '${safeName.toLowerCase()}';\n`;
});

fs.writeFileSync(outputPath, sql);
console.log('SQL gerado com sucesso em ' + outputPath);
