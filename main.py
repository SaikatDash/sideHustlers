"""PocketLedger — a local-first receipt and expense organizer."""

from __future__ import annotations

import csv
import io
import json
import os
import re
import sqlite3
import urllib.error
import urllib.request
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("POCKETLEDGER_DB", ROOT / "pocketledger.db"))
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8000"))
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5vl:3b")
MAX_BODY = 12 * 1024 * 1024
CATEGORIES = ["Meals", "Software", "Travel", "Supplies", "Marketing", "Utilities", "Other"]

EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "vendor": {"type": "string"},
        "date": {"type": "string", "description": "Date in YYYY-MM-DD format, or empty if unknown."},
        "amount": {"type": "number", "description": "Final amount paid, as a positive number."},
        "currency": {"type": "string", "description": "Three-letter currency code when identifiable."},
        "category": {"type": "string", "enum": CATEGORIES},
        "description": {"type": "string", "description": "Short useful note about this expense."},
        "needs_review": {"type": "boolean"},
    },
    "required": ["vendor", "date", "amount", "currency", "category", "description", "needs_review"],
}


def connect_db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("""CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor TEXT NOT NULL,
        spent_on TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        category TEXT NOT NULL DEFAULT 'Other',
        description TEXT NOT NULL DEFAULT '',
        client_name TEXT NOT NULL DEFAULT '',
        is_deductible INTEGER NOT NULL DEFAULT 0,
        source_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    columns = {row[1] for row in con.execute("PRAGMA table_info(expenses)")}
    if "client_name" not in columns:
        con.execute("ALTER TABLE expenses ADD COLUMN client_name TEXT NOT NULL DEFAULT ''")
    if "is_deductible" not in columns:
        con.execute("ALTER TABLE expenses ADD COLUMN is_deductible INTEGER NOT NULL DEFAULT 0")
    con.commit()
    return con


def json_bytes(payload: object) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = "PocketLedger/1.0"

    def log_message(self, _format: str, *_args: object) -> None:
        # Do not log request bodies: they can contain private receipt data.
        print(f"[{self.log_date_time_string()}] {self.command} {self.path.split('?')[0]}")

    def send_bytes(self, data: bytes, content_type: str, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, payload: object, status: int = 200) -> None:
        self.send_bytes(json_bytes(payload), "application/json; charset=utf-8", status)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length < 1 or length > MAX_BODY:
            raise ValueError("Please send a file smaller than 8 MB.")
        payload = json.loads(self.rfile.read(length))
        if not isinstance(payload, dict):
            raise ValueError("Expected a JSON object.")
        return payload

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/":
            self.send_bytes((ROOT / "index.html").read_bytes(), "text/html; charset=utf-8")
        elif path == "/styles.css":
            self.send_bytes((ROOT / "styles.css").read_bytes(), "text/css; charset=utf-8")
        elif path == "/app.js":
            self.send_bytes((ROOT / "app.js").read_bytes(), "text/javascript; charset=utf-8")
        elif path == "/api/health":
            self.health()
        elif path == "/api/expenses":
            self.list_expenses()
        elif path == "/api/export.csv":
            self.export_csv()
        else:
            self.send_json({"error": "Not found."}, 404)

    def health(self) -> None:
        connected, available = False, False
        try:
            req = urllib.request.Request(f"{OLLAMA_URL}/api/tags")
            with urllib.request.urlopen(req, timeout=2) as response:
                tags = json.loads(response.read())
            connected = True
            requested_model = MODEL if ":" in MODEL else f"{MODEL}:latest"
            available = any(item.get("name", "").lower() == requested_model.lower() for item in tags.get("models", []))
        except (urllib.error.URLError, TimeoutError, ValueError, OSError):
            pass
        self.send_json({"ollama": connected, "model_ready": available, "model": MODEL, "database": "local"})

    def list_expenses(self) -> None:
        with connect_db() as con:
            rows = [dict(row) for row in con.execute("SELECT * FROM expenses ORDER BY spent_on DESC, id DESC")]
        self.send_json(rows)

    def export_csv(self) -> None:
        with connect_db() as con:
            rows = con.execute("SELECT spent_on, vendor, category, description, client_name, is_deductible, amount, currency FROM expenses ORDER BY spent_on DESC")
            stream = io.StringIO()
            writer = csv.writer(stream)
            writer.writerow(["Date", "Vendor", "Category", "Description", "Amount", "Currency"])
            writer.writerows(rows)
        data = stream.getvalue().encode("utf-8-sig")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="pocketledger-expenses.csv"')
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        try:
            data = self.read_json()
            if path == "/api/extract":
                self.extract(data)
            elif path == "/api/expenses":
                self.create_expense(data)
            else:
                self.send_json({"error": "Not found."}, 404)
        except ValueError as exc:
            self.send_json({"error": str(exc)}, 400)
        except Exception as exc:  # Keep private receipt text out of the server log.
            self.send_json({"error": f"Could not complete that request: {exc}"}, 500)

    def extract(self, data: dict) -> None:
        text = str(data.get("text", "")).strip()[:12000]
        image = data.get("image")
        if not text and not image:
            self.send_json({"error": "Add a receipt image or paste its text first."}, 400)
            return
        prompt = (
            "Read this freelancer business receipt or invoice. Extract only information visible in the source. "
            "Use the final total paid, not a subtotal. Choose the closest category from the allowed list. "
            "Use ISO YYYY-MM-DD dates. Use an empty string for unknown vendor/date/currency and 0 for unknown amount. "
            "Set needs_review true if any important field is unclear or inferred. Never invent missing facts."
        )
        if text:
            prompt += "\n\nReceipt text:\n" + text
        payload = {
            "model": MODEL,
            "prompt": prompt,
            "format": EXTRACTION_SCHEMA,
            "stream": False,
            "images": [image.split(",", 1)[1]] if image and "," in image else [],
            "options": {"temperature": 0, "num_ctx": 4096},
        }
        try:
            request = urllib.request.Request(
                f"{OLLAMA_URL}/api/generate",
                data=json_bytes(payload),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=180) as response:
                result = json.loads(response.read())
            fields = json.loads(result.get("response", "{}"))
            if not isinstance(fields, dict):
                raise ValueError("The model returned an unexpected result.")
            fields["amount"] = max(0, round(float(fields.get("amount") or 0), 2))
            fields["vendor"] = str(fields.get("vendor", ""))[:120]
            fields["date"] = str(fields.get("date", ""))[:10]
            fields["currency"] = str(fields.get("currency") or "USD").upper()[:3]
            if fields.get("category") not in CATEGORIES:
                fields["category"] = "Other"
            fields["description"] = str(fields.get("description", ""))[:240]
            fields["needs_review"] = bool(fields.get("needs_review")) or not fields["vendor"] or not fields["date"] or not fields["amount"]
            self.send_json(fields)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                self.send_json({"error": f"Ollama is available, but {MODEL} is not ready yet. Once its download finishes, retry extraction."}, 503)
                return
            self.send_json({"error": f"Ollama could not process this receipt (HTTP {exc.code}). You can still enter the details manually."}, 502)
        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", "Ollama is not responding")
            self.send_json({"error": f"Can't reach Ollama at {OLLAMA_URL}. Start Ollama and make sure {MODEL} is installed. ({reason})"}, 503)
        except (TimeoutError, json.JSONDecodeError, TypeError, ValueError) as exc:
            self.send_json({"error": f"The receipt could not be read. You can still enter the details manually. ({exc})"}, 422)

    def create_expense(self, data: dict) -> None:
        vendor = re.sub(r"\s+", " ", str(data.get("vendor", "")).strip())[:120]
        spent_on = str(data.get("date", "")).strip()
        try:
            date.fromisoformat(spent_on)
            amount = round(float(data.get("amount", 0)), 2)
        except (ValueError, TypeError):
            raise ValueError("Add a valid date and amount.")
        if not vendor or amount <= 0 or amount > 10_000_000:
            raise ValueError("Add a vendor and a positive amount.")
        currency = re.sub(r"[^A-Z]", "", str(data.get("currency", "USD")).upper())[:3] or "USD"
        category = data.get("category") if data.get("category") in CATEGORIES else "Other"
        description = str(data.get("description", "")).strip()[:240]
        client_name = re.sub(r"\s+", " ", str(data.get("client_name", "")).strip())[:120]
        is_deductible = 1 if data.get("is_deductible", False) else 0
        source_name = re.sub(r"[\r\n]", "", str(data.get("source_name", "")))[:160]
        with connect_db() as con:
            cur = con.execute(
                "INSERT INTO expenses (vendor, spent_on, amount, currency, category, description, client_name, is_deductible, source_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (vendor, spent_on, amount, currency, category, description, client_name, is_deductible, source_name),
            )
            row = dict(con.execute("SELECT * FROM expenses WHERE id = ?", (cur.lastrowid,)).fetchone())
        self.send_json(row, 201)

    def do_DELETE(self) -> None:
        match = re.fullmatch(r"/api/expenses/(\d+)", urlparse(self.path).path)
        if not match:
            self.send_json({"error": "Not found."}, 404)
            return
        with connect_db() as con:
            con.execute("DELETE FROM expenses WHERE id = ?", (int(match.group(1)),))
        self.send_json({"ok": True})


if __name__ == "__main__":
    connect_db().close()
    print(f"PocketLedger is ready at http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
