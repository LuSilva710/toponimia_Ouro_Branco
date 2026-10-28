/**
 * Colunas de `ruas` usadas pelas telas. Não use select('*'): a coluna `embedding`
 * (vetor de 1536 números por rua, só para a busca do chatbot) multiplica o download
 * por ~27 (≈10 MB para 515 ruas).
 */
export const RUA_COLUNAS = [
  'id',
  'bairro_id',
  'slug',
  'nome_oficial',
  'imagemhomenageado',
  'significado',
  'localizacao',
  'legislacao',
  'codigo',
  'regional',
  'mapa',
  'imagem',
  'created_at',
  'lat',
  'lng',
  'categoria_toponimica',
  'genero_homenageado',
  'tipo_homenageado',
  'decada_nomeacao',
].join(', ')
