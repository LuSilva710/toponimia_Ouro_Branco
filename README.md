# 🗺️ Toponímia Urbana de Ouro Branco

[![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-green)]()
[![License](https://img.shields.io/badge/License-MIT-blue)]()
[![PWA](https://img.shields.io/badge/PWA-Ready-orange)]()

O projeto **Toponímia Urbana de Ouro Branco** é uma plataforma interativa voltada para a catalogação, preservação e análise histórica dos nomes de logradouros do município de Ouro Branco, Minas Gerais. Desenvolvido como parte de um trabalho acadêmico (TCC) no **IFMG — Campus Ouro Branco**.

## 🚀 Funcionalidades

- **Dicionário de Ruas:** Consulta detalhada de significados e legislação de cada via.
- **Mapa Interativo:** Visualização geoespacial com categorização toponímica.
- **Estatísticas e Panorama:** Gráficos dinâmicos revelando a distribuição de nomes por gênero, época e categoria.
- **Chatbot ONIM:** Assistente virtual inteligente capaz de responder perguntas históricas e estatísticas sobre a cidade.
- **PWA (Progressive Web App):** Instalação direta no smartphone e suporte a visualização offline.
- **Classificação por IA:** Pipeline automatizado para categorização toponímica de grandes volumes de dados.

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript (ES6+).
- **Banco de Dados:** [Supabase](https://supabase.com/) (PostgreSQL).
- **Cartografia:** [Leaflet.js](https://leafletjs.com/).
- **AI Backend:** [Groq](https://groq.com/), Google Gemini e Ollama (local).
- **Build Tool:** [Vite](https://vitejs.dev/).
- **AI Infrastructure:** `ai-provider-kit` (Módulo unificado para integração de modelos de linguagem).

## 🤖 Inteligência Artificial no Projeto

A plataforma utiliza um ecossistema de IA robusto e resiliente:
1. **Chatbot ONIM:** Implementa a técnica de **RAG (Retrieval-Augmented Generation)** para garantir respostas baseadas apenas em fatos históricos reais contidos no banco de dados, evitando alucinações.
2. **Automação de Dados:** Scripts especializados classificam automaticamente novos logradouros utilizando modelos de linguagem de ponta (LLMs).
3. **Resiliência Multi-Provider:** O sistema alterna automaticamente entre Groq, Gemini e Ollama caso um serviço fique offline ou atinja limites de cota.

## 📦 Como Instalar e Rodar

1. Clone o repositório:
```bash
git clone https://github.com/SeuUsuario/toponimia_Ouro_Branco.git
cd toponimia_Ouro_Branco
```

2. Instale as dependências:
```bash
npm install
```

3. Configure o arquivo `.env` (use o `.env.example` como base):
```bash
cp .env.example .env
```

4. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

## ⚛️ Migração React (em andamento)

O app ainda é **multi-page Vite**; a pasta `src/` já segue layout preparado para React:

- `src/pages/` + `src/components/` — UI React
- `src/lib/` / `src/features/` — infra e domínio
- `src/legacy/` — páginas ainda em HTML+JS
- Página **Sobre** (`about.html`) já roda em React

Ver detalhes em `src/README.md`.

## 📊 Scripts de IA

- `npm run ai:classify`: classifica ruas pendentes via IA (`scripts/ai/ai-classify.mjs`)
- `npm run ai:build`: compila o `ai-provider-kit`
- Schema do banco: `supabase/migrations/`

Ferramentas auxiliares (georref / manutenção): `scripts/geo/` e `scripts/maintenance/`.

---
