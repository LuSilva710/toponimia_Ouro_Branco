import json
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# --- Config ---
JSON_FILE_PATH = r'D:/Projetos/toponimia_Ouro_Branco/JSON/bairros.json'

load_dotenv()
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']  # service role para ignorar RLS na carga
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def upsert_bairro(bairro_slug, bairro_info):
    payload = {
        "slug": bairro_slug,
        "nome": bairro_info.get("nome"),
        "titulo": bairro_info.get("titulo"),
        "imagem_capa": bairro_info.get("imagem_capa"),
        "descricao": bairro_info.get("descricao"),
    }
    # upsert por slug (coluna única)
    res = sb.table("bairros").upsert(payload, on_conflict="slug").execute()
    if res.data and len(res.data) > 0:
        return res.data[0]["id"]
    # fallback: buscar id
    res = sb.table("bairros").select("id").eq("slug", bairro_slug).single().execute()
    return res.data["id"]

def upsert_rua(bairro_id, rua_slug, rua_info):
    payload = {
        "bairro_id": bairro_id,
        "slug": rua_slug,
        "nome_oficial": rua_info.get("nome_oficial"),
        "imagemhomenageado": rua_info.get("imagemHomenageado"),
        "significado": rua_info.get("significado"),
        "localizacao": rua_info.get("localizacao"),
        "legislacao": rua_info.get("legislacao"),
        "codigo": rua_info.get("codigo"),
        "regional": rua_info.get("regional"),
        "mapa": rua_info.get("mapa"),
        "imagem": rua_info.get("imagem"),
    }
    # upsert garantindo unicidade por (bairro_id, slug)
    res = sb.table("ruas").upsert(
        payload,
        on_conflict="bairro_id,slug",
        ignore_duplicates=False
    ).execute()
    return res

def main():
    if not os.path.exists(JSON_FILE_PATH):
        raise FileNotFoundError(f"JSON não encontrado: {JSON_FILE_PATH}")

    with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    bairros_data = data.get("bairros", {})
    print(f"Encontrados {len(bairros_data)} bairros no JSON.")

    for bairro_slug, bairro_info in bairros_data.items():
        print(f"- Bairro: {bairro_info.get('nome')} ({bairro_slug})")
        bairro_id = upsert_bairro(bairro_slug, bairro_info)

        ruas_data = bairro_info.get("ruas", {})
        batch = []
        for rua_slug, rua_info in ruas_data.items():
            batch.append({
                "bairro_id": bairro_id,
                "slug": rua_slug,
                "nome_oficial": rua_info.get("nome_oficial"),
                "imagemhomenageado": rua_info.get("imagemHomenageado"),
                "significado": rua_info.get("significado"),
                "localizacao": rua_info.get("localizacao"),
                "legislacao": rua_info.get("legislacao"),
                "codigo": rua_info.get("codigo"),
                "regional": rua_info.get("regional"),
                "mapa": rua_info.get("mapa"),
                "imagem": rua_info.get("imagem"),
            })

        # insere em lote (ajuste o tamanho se seu JSON for grande)
        if batch:
            # upsert em lote por (bairro_id, slug)
            res = sb.table("ruas").upsert(
                batch,
                on_conflict="bairro_id,slug",
                ignore_duplicates=False
            ).execute()
            print(f"  ↳ {len(batch)} ruas upsertadas")

    print("Migração para Supabase concluída.")

if __name__ == "__main__":
    main()
