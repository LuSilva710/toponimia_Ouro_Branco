# 🧠 ai-provider-kit

Um kit de integração de IA leve e agnóstico de provedor para Node.js, desenvolvido para o projeto Toponímia de Ouro Branco.

## ✨ Por que usar?

O `ai-provider-kit` permite que o sistema utilize diferentes modelos de Inteligência Artificial (LLMs) sem precisar reescrever o código da aplicação. Ele abstrai toda a lógica de comunicação em uma interface simples e unificada.

## 🚀 Provedores Suportados

- **Groq / OpenAI API**: Suporta qualquer endpoint compatível com OpenAI (incluindo xAI Grok e Groq).
- **Google Gemini**: Integração nativa via API REST.
- **Codex / Ollama**: Suporte a modelos locais para privacidade e custo zero.

## 🛠️ Como usar

### 1. Compilação
Como é escrito em TypeScript, você deve compilá-lo antes de usar no seu projeto Node.js:
```bash
npm run build
```

### 2. Integração
```javascript
import { generateText, generateJson, getProviderLabel } from './ai-provider-kit/dist/index.js';

// Gerar texto simples
const resposta = await generateText("Você é um historiador.", "Quem foi Tiradentes?");

// Gerar dados estruturados (JSON)
const dados = await generateJson("Classifique este nome.", "Rua Getúlio Vargas");
```

## ⚙️ Configuração (Env Vars)

O kit lê automaticamente as seguintes variáveis do ambiente:

- `AI_PROVIDER`: "openai", "gemini" ou "codex".
- `OPENAI_API_KEY`: Sua chave do Groq/OpenAI.
- `OPENAI_BASE_URL`: O endpoint da API (ex: `https://api.groq.com/openai/v1`).
- `GEMINI_API_KEY`: Sua chave do Google AI Studio.

## 📄 Licença

Este módulo é parte integrante do projeto Toponímia de Ouro Branco e segue a licença MIT.