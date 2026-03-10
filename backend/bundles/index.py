import json
import os
import psycopg2

SCHEMA = "t_p56529697_book_bundle_creator"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_user_id(event: dict):
    headers = event.get("headers", {}) or {}
    uid = headers.get("X-User-Id") or headers.get("x-user-id")
    if uid:
        try:
            return int(uid)
        except Exception:
            return None
    return None


def handler(event: dict, context) -> dict:
    """Сохранение и загрузка данных наборов и категорий пользователя"""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    user_id = get_user_id(event)
    if not user_id:
        return {
            "statusCode": 401,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": "Не авторизован"}),
        }

    method = event.get("httpMethod", "GET")
    conn = get_conn()
    cur = conn.cursor()

    try:
        if method == "GET":
            cur.execute(
                f"SELECT data FROM {SCHEMA}.user_data WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            data = row[0] if row else {"bundles": [], "categories": []}
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps(data, ensure_ascii=False),
            }

        elif method == "POST":
            body_raw = event.get("body", "")
            if isinstance(body_raw, dict):
                body = body_raw
            else:
                try:
                    body = json.loads(body_raw) if body_raw else {}
                except Exception:
                    body = {}

            cur.execute(
                f"SELECT id FROM {SCHEMA}.user_data WHERE user_id = %s",
                (user_id,),
            )
            exists = cur.fetchone()
            if exists:
                cur.execute(
                    f"UPDATE {SCHEMA}.user_data SET data = %s, updated_at = NOW() WHERE user_id = %s",
                    (json.dumps(body, ensure_ascii=False), user_id),
                )
            else:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.user_data (user_id, data) VALUES (%s, %s)",
                    (user_id, json.dumps(body, ensure_ascii=False)),
                )
            conn.commit()
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"ok": True}),
            }

        return {
            "statusCode": 405,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": "Method not allowed"}),
        }
    finally:
        cur.close()
        conn.close()
