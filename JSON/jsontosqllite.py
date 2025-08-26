import json
import sqlite3
import os

# --- Configuração ---
# Coloque o nome do seu arquivo JSON aqui
JSON_FILE_PATH = 'D:/Projetos/toponimia_Ouro_Branco/JSON/bairros.json'
# Nome do arquivo do banco de dados que será criado
DB_FILE_PATH = 'bairros_database.sqlite3'

# Apaga o banco de dados antigo para garantir uma migração limpa a cada execução
if os.path.exists(JSON_FILE_PATH):
    print("Caminho existe")
else:
    print("caminho não existe")
if os.path.exists(DB_FILE_PATH):
    os.remove(DB_FILE_PATH)

# --- Conexão e Criação do Banco de Dados ---
try:
    conn = sqlite3.connect(DB_FILE_PATH)
    cursor = conn.cursor()

    # --- Criação das Tabelas ---
    
    # 1. Tabela de Bairros
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Bairros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        nome TEXT NOT NULL,
        titulo TEXT,
        imagem_capa TEXT,
        descricao TEXT
    );
    ''')
    print("Tabela 'Bairros' criada com sucesso.")

    # 2. Tabela de Ruas (com a nova coluna 'slug')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Ruas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bairro_id INTEGER NOT NULL,
        slug TEXT NOT NULL,
        nome_oficial TEXT NOT NULL,
        imagemHomenageado TEXT,
        significado TEXT,
        localizacao TEXT,
        legislacao TEXT,
        codigo TEXT,
        regional TEXT,
        mapa TEXT,
        imagem TEXT,
        FOREIGN KEY (bairro_id) REFERENCES Bairros (id)
    );
    ''')
    print("Tabela 'Ruas' criada com sucesso.")

    # --- Leitura do JSON ---
    with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # --- Inserção dos Dados ---
    bairros_data = data.get('bairros', {})
    
    # Itera sobre cada bairro no JSON
    for bairro_slug, bairro_info in bairros_data.items():
        print(f"Processando bairro: {bairro_info.get('nome')}...")
        
        cursor.execute(
            'INSERT INTO Bairros (slug, nome, titulo, imagem_capa, descricao) VALUES (?, ?, ?, ?, ?)',
            (
                bairro_slug,
                bairro_info.get('nome'),
                bairro_info.get('titulo'),
                bairro_info.get('imagem_capa'),
                bairro_info.get('descricao')
            )
        )
        
        # Pega o ID do bairro que acabamos de inserir para criar a relação
        bairro_id = cursor.lastrowid
        
        # Itera sobre cada rua dentro do bairro atual
        ruas_data = bairro_info.get('ruas', {})
        for rua_slug, rua_info in ruas_data.items():
            cursor.execute(
                '''INSERT INTO Ruas (bairro_id, slug, nome_oficial, imagemHomenageado, significado, 
                                     localizacao, legislacao, codigo, regional, mapa, imagem)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (
                    bairro_id,
                    rua_slug, # A chave original da rua no JSON (ex: "Afonso Sardinha")
                    rua_info.get('nome_oficial'),
                    rua_info.get('imagemHomenageado'),
                    rua_info.get('significado'),
                    rua_info.get('localizacao'),
                    rua_info.get('legislacao'),
                    rua_info.get('codigo'),
                    rua_info.get('regional'),
                    rua_info.get('mapa'),
                    rua_info.get('imagem')
                )
            )
    
    # Salva (commita) todas as alterações no arquivo do banco de dados
    conn.commit()
    print("\nMigração concluída com sucesso!")
    print(f"Banco de dados salvo em: {DB_FILE_PATH}")

except Exception as e:
    print(f"Ocorreu um erro: {e}")
finally:
    if conn:
        conn.close()