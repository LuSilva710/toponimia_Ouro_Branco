import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db', 'bairros_database.sqlite3');
const PORT = process.env.PORT || 3000;

// DB (somente leitura = mais seguro em produção)
const db = new Database(DB_PATH, { readonly: true });

// App
const app = express();

// Segurança básica
app.use(helmet({
  contentSecurityPolicy: false, // ajuste caso sirva front junto
}));
const allowlist = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowlist.length === 0 || allowlist.includes(origin)) return cb(null, true);
    return cb(new Error('CORS bloqueado'), false);
  }
}));
app.use(compression());
app.use(express.json());

// Rate limit (evita abuso)
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 120, // 120 req/min por IP
}));

// Helpers
const toBairro = r => r && ({
  id: r.id,
  slug: r.slug,
  nome: r.nome,
  titulo: r.titulo,
  imagem_capa: r.imagem_capa,
  descricao: r.descricao
});
const toRua = r => r && ({
  id: r.id,
  bairro_id: r.bairro_id,
  slug: r.slug,
  nome_oficial: r.nome_oficial,
  imagemHomenageado: r.imagemHomenageado,
  significado: r.significado,
  localizacao: r.localizacao,
  legislacao: r.legislacao,
  codigo: r.codigo,
  regional: r.regional,
  mapa: r.mapa,
  imagem: r.imagem
});

// Endpoints (somente leitura)
// GET /api/bairros -> lista bairros (ordenados por titulo)
app.get('/api/bairros', (req, res) => {
  const rows = db.prepare('SELECT * FROM Bairros ORDER BY titulo COLLATE NOCASE ASC').all();
  res.json({ bairros: rows.map(toBairro) });
});

// GET /api/bairros/:slug -> detalhe do bairro
app.get('/api/bairros/:slug', (req, res) => {
  const bairro = db.prepare('SELECT * FROM Bairros WHERE slug = ?').get(req.params.slug);
  if (!bairro) return res.status(404).json({ error: 'Bairro não encontrado' });
  res.json({ bairro: toBairro(bairro) });
});

// GET /api/bairros/:slug/ruas?letra=A&search=pena
app.get('/api/bairros/:slug/ruas', (req, res) => {
  const b = db.prepare('SELECT id FROM Bairros WHERE slug = ?').get(req.params.slug);
  if (!b) return res.status(404).json({ error: 'Bairro não encontrado' });

  const clauses = ['bairro_id = @bairro_id'];
  const params = { bairro_id: b.id };

  if (req.query.letra) {
    clauses.push("UPPER(SUBSTR(nome_oficial,1,1)) = UPPER(@letra)");
    params.letra = String(req.query.letra).slice(0,1);
  }
  if (req.query.search) {
    params.q = `%${req.query.search}%`;
    clauses.push('(nome_oficial LIKE @q OR significado LIKE @q OR localizacao LIKE @q)');
  }

  const sql = `
    SELECT * FROM Ruas
    WHERE ${clauses.join(' AND ')}
    ORDER BY nome_oficial COLLATE NOCASE ASC
  `;
  const rows = db.prepare(sql).all(params);
  res.json({ ruas: rows.map(toRua) });
});

// GET /api/ruas/:slug -> detalhe da rua por slug
app.get('/api/ruas/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM Ruas WHERE slug = ?').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Rua não encontrada' });
  res.json({ rua: toRua(row) });
});

// (Opcional) servir seu front estático localmente
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`API ouvindo em http://localhost:${PORT}`);
});
