# Taxonomia toponímica de Dick (1990)

Base metodológica do projeto para classificar os nomes de logradouros de Ouro Branco.

- **No código:** [`src/lib/taxonomiaDick.js`](../src/lib/taxonomiaDick.js) é a fonte única (ids, nomes, definições, exemplos e cores padrão).
- **Quem usa:** painel admin (campo *Categoria Toponímica*), estatísticas, mapa, PDF, `scripts/ai/ai-classify.mjs` e o prompt do chatbot ONIM.

## Como alterar

1. Edite `src/lib/taxonomiaDick.js`.
2. Rode `npm run taxonomia:sync`, que regenera `supabase/functions/onim-chat/taxonomia.ts` (o prompt do chatbot).
3. Publique a função: `npx supabase functions deploy onim-chat --project-ref <ref> --use-api`.
4. Faça commit e push. O site é publicado pelo GitHub Actions.

O valor gravado em `ruas.categoria_toponimica` é o `id` da taxe: minúsculo e sem acento (ex.: `antropotoponimo`).
Valores antigos com acento ou maiúscula continuam sendo reconhecidos (`normalizarTaxe`).

## Decisões do projeto

| Tema | Decisão atual | Observação |
|------|---------------|------------|
| Título + nome próprio ("Doutor Pedrinho", "Presidente Prudente") | Classificado como **antropotopônimo** | Pela definição de Dick (abaixo), é **axiotopônimo**. A regra fica em `REGRA_TITULO_COM_NOME`, em `scripts/ai/ai-classify.mjs`. Por isso o acervo tem 0 axiotopônimos. **Pendente de decisão da equipe.** |
| Hagiotopônimo e mitotopônimo | Ids próprios, marcados como subdivisões de hierotopônimo | Dick os apresenta como subdivisões. O acervo já usava `hagiotoponimo`. |
| Nome sem enquadramento | `outro` | Não é uma taxe de Dick: serve para valores vazios ou desconhecidos. |

---

## Texto de referência

No Brasil, o modelo taxionômico proposto por Dick (1980) foi concebido com base nas camadas do léxico toponímico
brasileiro e tem servido de base metodológica para a maioria dos estudos toponímicos desenvolvidos no país.
Trata-se de uma nova maneira de analisar a toponímia, até então limitada à reconstituição de etimologias ou a
serviço do mapeamento das terras, isto porque a autora parte do conteúdo semântico do topônimo para depois
investigar a intencionalidade do denominador no ato do batismo de um acidente qualquer. De acordo com a autora:

> O sistema classificatório que elaboramos, em 1980, difere do de Stewart na finalidade. Possui uma visível base
> terminológica e se organizou no plano sincrônico das significações sígnicas, para evitar, na medida do possível,
> a recorrência à diacronia, na primeira etapa do processo. A pesquisa do material ilustrativo foi realizada no
> Índice dos Topônimos do Brasil, 1:1.000.000 (IBGE, 1968) e teve como objetivo reconhecer as características da
> nomenclatura onomástica brasileira, determinando-lhe o padrão motivador e dando-lhe um tratamento
> semântico-distribuicional por áreas de ocorrência, segundo os parâmetros lexicais e terminológicos pertinentes.
> (DICK, 1999, p. 141-142)

Na sua primeira versão, o modelo de classificação de Dick (1980) continha dezenove categorias. No entanto, foi
reformulado em 1990, chegando a vinte e sete taxes divididas, de acordo com a natureza motivacional (semântica),
em dois grupos: i) onze taxes de natureza física, que caracterizam o ambiente em todos os aspectos de sua
formação (rios, córregos, dimensões, formações topográficas, árvores, animais etc.), e ii) dezesseis de natureza
antropocultural, que caracterizam as manifestações psíquicas, sociais e culturais do homem, no meio em que se
encontra, como estado de ânimo, sentimentos, nomes de natureza religiosa, títulos, nomes próprios, nomes de
cidades, estados, países etc.:

### A. Taxionomias de natureza física

1. **Astrotopônimos**: topônimos relativos aos corpos celestes em geral. Ex.: Estrela (AH BA); Rio da Estrela (ES); Saturno (AH ES).
2. **Cardinotopônimos**: topônimos relativos às posições geográficas em geral. Ex.: Praia do Leste (PR); Serra do Norte (MT); Entre-Rios (AH AM); Ribeirão do Norte (MG); Lagoa do Sul (SC).
3. **Cromotopônimos**: topônimos relativos à escala cromática. Ex.: Rio Branco (AM); Rio Negro (AM); Rio Pardo (SP); Serra Azul (SP).
4. **Dimensiotopônimos**: topônimos relativos às características dimensionais dos acidentes geográficos, como extensão, comprimento, grossura, largura, espessura, altura, profundidade. Ex.: Ilha Comprida (AM); Serra Curta (BA); Larga (AH GO); Riacho Grosso (CE); Morro Alto (GO); Córrego Fundo (MT); Igarapé Profundo (RO).
5. **Fitotopônimos**: topônimos de índole vegetal, espontânea, em sua individualidade (Arroio Pinheiro, RS), em conjuntos da mesma espécie (Pinheiral, AH RJ) ou de espécies diferentes (Morro da Mata, MT; Caatinga, AH BA; Serra da Caatinga, RN), além de formações não espontâneas individuais (Ribeirão Café, ES) e em conjunto (Cafezal, AH PA).
6. **Geomorfotopônimos**: topônimos relativos às formas topográficas: elevações (montanha – Montanhas, AH RN; monte – Monte Alto, AH SP; morro – Morro Azul, AH RS; colina – Colinas, AH GO; coxilha – Coxilha, AH RS), depressões do terreno (vale – Vale Fundo, AH MG; baixada – Baixadão, AF/AH MT) e formações litorâneas (costa – Costa Rica, AH MT; cabo – Cabo Frio, AH RJ; angra – Angra dos Reis, AH RJ; ilha – Ilhabela, AH SP; porto – Porto Velho, AH RO).
7. **Hidrotopônimos**: topônimos resultantes de acidentes hidrográficos em geral. Ex.: água – Serra das Águas (GO), Água Boa, AH MG; rio – Riozinho, AH PI, Rio Preto, AH SP; córrego – Córrego Novo, AH MG; ribeirão – Ribeirão Preto, AH SP; braço – Braço do Norte, AH BA; foz – Foz do Riozinho, AH AM.
8. **Litotopônimos**: topônimos de índole mineral, relativos também à constituição do solo, representados por indivíduos (barro – Lagos do Barro, BA; barreiro – Córrego do Barreiro, AM; tijuco – Tijuco Preto, AH SP; ouro – Arroio do Ouro, RS), conjunto da mesma espécie (Córrego Tijucal, SP) ou de espécies diferentes (Minas Gerais, AH MG; Cristália, AH MG; Pedreiras, AH MG).
9. **Meteorotopônimos**: topônimos relativos a fenômenos atmosféricos. Ex.: vento – Serra do Vento (PB), Ventania, AH SP, Botucatu, AH SP; neve – Riacho das Neves (BA); chuva – Cachoeira da Chuva (RO), Cachoeira do Chuvisco (MT), Chuva, AH MG; trovão – Trovão, AH AM, Cachoeira Trovoada (PA).
10. **Morfotopônimos**: topônimos que refletem o sentido de forma geométrica. Ex.: Curva Grande, AH AM; Ilha Quadrada (RS); Lagoa Redonda (BA); Triângulo, AH MT.
11. **Zootopônimos**: topônimos de índole animal, representados por indivíduos domésticos (boi – Rio do Boi, MG) e não domésticos (onça – Lagoa da Onça, RJ), e da mesma espécie em grupos (boiada – Ribeirão da Boiada, SP; Vacaria, AH RS; Tapiratiba, AH SP).

### B. Taxionomias de natureza antropocultural

1. **Animotopônimos ou Nootopônimos**: topônimos relativos à vida psíquica, à cultura espiritual, abrangendo todos os produtos do psiquismo humano, cuja matéria-prima fundamental, e em seu aspecto mais importante como fato cultural, não pertence à cultura física. Ex.: vitória – Vitória, AH CE; triunfo – Triunfo, AH AC; saudade – Cachoeira da Saudade (MT); belo – Belo Campo, AH BA; feio – Rio Feio (SP).
2. **Antropotopônimos**: topônimos relativos aos nomes próprios individuais. Ex.: prenome – Abel, AH MG, Benedito (igarapé, MT), Fátima, AH MT; hipocorístico – Bentinho, AH MG, Chiquita (ilha, MT), Nico (igarapé, AC); prenome + alcunha – Fernão Velho, AH AL, Joaquim Preto (igarapé do, PA), Jorge Pequeno (ribeirão, MG), Maria Magra (serra da, MG), Pedro Ligeiro, AH GO; apelidos de família – Abreu, AH RS, Barbosa (arroio, RS), Silva, AH PA, Tavares (rio, SP); prenome + apelido de família – Antonio Amaral, AH MG, Francisco Dantas, AH RN, Manoel Alves (rio, GO).
3. **Axiotopônimos**: topônimos relativos aos títulos e dignidades de que se fazem acompanhar os nomes próprios individuais. Ex.: Presidente Prudente, AH SP; Doutor Pedrinho, AH SC; Duque de Caxias, AH RJ.
4. **Corotopônimos**: topônimos relativos aos nomes de cidades, países, estados, regiões e continentes. Ex.: Brasil, AH AM; Europa, AH AC; Amazonas, AH BA; Uruguai, AH MG.
5. **Cronotopônimos**: topônimos que encerram indicadores cronológicos, representados, em Toponímia, pelos adjetivos novo/nova, velho/velha. Ex.: Velha Boipeba, AH BA; Rio Novo Mundo (GO); Nova Viçosa, AH BA; Velha e Nova Emas, AH SP.
6. **Ecotopônimos**: topônimos relativos às habitações de um modo geral. Ex.: Casa da Telha, AH BA; Ocauçu, AH SP; Sobrado, AH BA.
7. **Ergotopônimos**: topônimos relativos aos elementos da cultura material. Ex.: flecha – Córrego da Flecha (MT); jangada – Jangada, MT; relógio – Relógio, AH PR.
8. **Etnotopônimos**: topônimos referentes aos elementos étnicos, isolados ou não (povos, tribos, castas). Ex.: Guarani, AH PE; Ilha do Francês (RJ); Rio Xavante (MT); Chavantes, AH SP; Árabe (arroio, RS).
9. **Dirrematotopônimos**: topônimos constituídos por frases ou enunciados linguísticos. Ex.: Há Mais Tempo, AH MA; Valha-me Deus, AH MA; Vai Quem Quer (igarapé, AM); Deus me Livre, AH BA.
10. **Hierotopônimos**: topônimos relativos aos nomes sagrados de diferentes crenças (cristã, hebraica, maometana etc.). Ex.: Cristo Rei, AH PR; Jesus (rio, GO); Alá (lago, AM); Nossa Senhora da Glória, AH AM; às efemérides religiosas: Natividade, AH GO; Natal, AH AC; às associações religiosas: Cruz de Malta, AH SC; aos locais de culto: igreja – Serra da Igreja (PR); capela – Capela, AH AL; Capelazinha, AH MG. Os hierotopônimos podem apresentar, ainda, duas subdivisões:
    - a) **hagiotopônimos**: topônimos relativos aos santos e santas do hagiológio romano. Ex.: São Paulo, AH SP; Santa Tereza, AH GO; Santana da Boa Vista, AH RS;
    - b) **mitotopônimos**: topônimos relativos às entidades mitológicas. Ex.: saci – Ribeirão do Saci (ES); curupira – Lago Curupira (AM); jurupari – Jurupari, AH AM; anhangá – Anhangá, AH BA.
11. **Historiotopônimos**: topônimos relativos aos movimentos de cunho histórico-social e aos seus membros, assim como às datas correspondentes. Ex.: Independência, AH AC; Rio 7 de Setembro (MT); Inconfidência, AH RJ; Inconfidentes, AH MG; Rua Vinte e Um de Abril (SP).
12. **Hodotopônimos (ou Odotopônimos)**: topônimos relativos às vias de comunicação rural ou urbana. Ex.: Estradas, AH AM; Avenida, AH BA; Córrego do Atalho (GO); Travessa, AH BA; Rua de Palha, AH BA; Ladeira, AH MA.
13. **Numerotopônimos**: topônimos relativos aos adjetivos numerais. Ex.: Duas Barras, AH BA; Duas Pontes, AH RO; Três Coroas, AH RS.
14. **Poliotopônimos**: topônimos constituídos pelos vocábulos “vila”, “aldeia”, “cidade”, “povoado”, “arraial”. Ex.: Rio da Cidade (RJ); Serra da Aldeia (PB); Arraial, AH BA; Taubaté, AH SP.
15. **Sociotopônimos**: topônimos relativos às atividades profissionais, aos locais de trabalho e aos pontos de encontro dos membros de uma comunidade (largo, pátio, praça). Ex.: Sapateiro (serra do, SP); Pescador, AH MG; Serra dos Tropeiros (MG); Córrego Engenho Novo (MG); Oficina, AH MG.
16. **Somatotopônimos**: topônimos empregados em relação metafórica às partes do corpo humano ou do animal. Ex.: Cotovelo, AH MG; Pé de Boi, AH SE; Pé de Galinha, AH BA; Rio da Mão Esquerda (AL); Lagoa da Mão Quebrada (PI); Igarapé do Dedo (RR); Córrego do Dedo Cortado (GO); Dedo Grosso, AH SC.

(DICK, 1990, p. 31-34)

## Referências

- DICK, Maria Vicentina de Paula do Amaral. *A motivação toponímica e a realidade brasileira*. São Paulo: Edições Arquivo do Estado, 1990.
- DICK, 1999, p. 141-142 — citada no texto acima. **Referência completa a confirmar** na bibliografia do TCC.

> Siglas dos exemplos, conforme o original: **AH** = acidente humano (cidade, vila, povoado); **AF** = acidente físico.
