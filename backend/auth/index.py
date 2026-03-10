import json
import os
import hashlib
import secrets
import psycopg2

SCHEMA = "t_p56529697_book_bundle_creator"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()


def handler(event: dict, context) -> dict:
    """Регистрация и вход пользователя. action: register | login"""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    body_raw = event.get("body", "")
    if isinstance(body_raw, dict):
        body = body_raw
    else:
        try:
            body = json.loads(body_raw) if body_raw else {}
        except Exception:
            body = {}

    action = body.get("action", "")
    username = (body.get("username", "") or "").strip().lower()
    password = body.get("password", "") or ""

    if not username or not password:
        return {
            "statusCode": 400,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": "Введите логин и пароль"}),
        }

    pwd_hash = hash_password(password)
    conn = get_conn()
    cur = conn.cursor()

    try:
        if action == "register":
            try:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.users (username, password_hash) VALUES (%s, %s) RETURNING id",
                    (username, pwd_hash),
                )
                user_id = cur.fetchone()[0]
                cur.execute(
                    f"INSERT INTO {SCHEMA}.user_data (user_id, data) VALUES (%s, %s)",
                    (user_id, json.dumps({"bundles": [], "categories": []})),
                )
                conn.commit()
                token = secrets.token_hex(32)
                return {
                    "statusCode": 200,
                    "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"token": f"{user_id}:{token}", "user_id": user_id, "username": username}),
                }
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                return {
                    "statusCode": 409,
                    "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"error": "Такой логин уже занят"}),
                }

        elif action == "login":
            cur.execute(
                f"SELECT id, username FROM {SCHEMA}.users WHERE username = %s AND password_hash = %s",
                (username, pwd_hash),
            )
            row = cur.fetchone()
            if not row:
                return {
                    "statusCode": 401,
                    "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"error": "Неверный логин или пароль"}),
                }
            user_id, uname = row
            token = secrets.token_hex(32)
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"token": f"{user_id}:{token}", "user_id": user_id, "username": uname}),
            }
        else:
            return {
                "statusCode": 400,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "Неизвестное действие"}),
            }
    finally:
        cur.close()
        conn.close()
