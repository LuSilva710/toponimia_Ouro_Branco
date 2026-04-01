# Toponímia Urbana de Ouro Branco

Este projeto é uma plataforma web interativa desenvolvida para catalogar, analisar e visualizar a toponímia urbana do município de Ouro Branco, Minas Gerais. O sistema permite explorar o significado e a origem dos nomes das ruas, visualizar sua distribuição geográfica e acessar dados estatísticos detalhados.

## 🚀 Funcionalidades Principais

- **Mapa Interativo**: Visualização de todas as ruas em um mapa dinâmico com georreferenciamento.
- **Filtros Avançados**: Pesquise ruas por nome, bairro, categoria toponímica (antropotopônimo, fitotopônimo, etc.) e gênero.
- **Dicionário de Ruas**: Banco de dados completo com informações detalhadas sobre cada logradouro.
- **Estatísticas**: Gráficos e tabelas que mostram a distribuição das categorias toponímicas na cidade.
- **Jogos Educativos**: Seção de jogos para aprender sobre a toponímia local de forma divertida.

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML, CSS, JavaScript
- **Framework**: Bootstrap 5
- **Mapas**: Leaflet.js, Leaflet MarkerCluster, Leaflet Heat
- **Backend & Banco de Dados**: Supabase (PostgreSQL)

## 📂 Estrutura do Projeto

- `index.html`: Página inicial com o dicionário de ruas.
- `mapa.html`: Mapa interativo com filtros e camadas.
- `estatisticas.html`: Visualização estatística dos dados.
- `portaleducativo.html`: Seção de jogos educativos.
- `about.html`: Informações sobre o projeto e a equipe.
- `assets/css/style_mapa.css`: Estilos para o mapa e sidebar.
- `assets/js/mapa.js`: Lógica do mapa e fetch de dados do Supabase.
- `assets/js/dados.js`: Dados estáticos e funções de utilidade.

## ⚙️ Configuração e Instalação

### Pré-requisitos

- Um navegador web moderno (Chrome, Firefox, Edge, Safari).
- Acesso ao banco de dados Supabase configurado.

### Instalação

1. Clone o repositório:
   ```bash
   git clone <url-do-repositorio>
   cd toponimia_Ouro_Branco
   ```

2. Configure as variáveis de ambiente (se necessário):
   Crie um arquivo `.env` na raiz do projeto com as credenciais do Supabase:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

3. Execute o servidor local:
   ```bash
   npm install
   npm run dev
   ```
   Ou, se preferir usar o editor com servidor embutido:
   - Abra a pasta no VS Code.
   - Instale a extensão **Live Server**.
   - Clique com o botão direito em `mapa.html` e selecione "Open with Live Server".

## 📊 Como Contribuir

1. Crie uma branch para sua feature:
   ```bash
   git checkout -b feature/nova-categoria
   ```
2. Faça suas alterações e teste localmente.
3. Envie um Pull Request para a branch `main`.

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 👥 Equipe

- **Ludmila Silva** - Desenvolvedora e Pesquisadora

---

Desenvolvido com ❤️ para a comunidade de Ouro Branco.
