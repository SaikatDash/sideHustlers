<div align="center">

# PocketLedger

### Your freelance money. Your machine. ✨

**A private, local-first expense and invoice desk powered by open-weight AI.**

[![Hacktoberfest](https://img.shields.io/badge/Hacktoberfest-2026-ff6f61?style=for-the-badge&logo=hacktoberfest&logoColor=white)](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)
[![MLH](https://img.shields.io/badge/MLH-Open%20Source-111827?style=for-the-badge&logo=majorleaguehacking&logoColor=white)](https://mlh.io/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776ab?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-83ac91?style=for-the-badge)](LICENSE)

[**Try the live demo ↗**](https://saikatpocketledger.netlify.app) · [**Read the challenge submission ↗**](SUBMISSION.md)

</div>

> 🧾 **Capture → Review → Organize → Export**
>
> PocketLedger turns paper receipts and digital invoices into a searchable, exportable ledger while keeping your documents and data on your machine.

## The problem

Independent designers, developers, photographers, and consultants often finish a client project with receipts scattered across email, a camera roll, and a wallet. At tax time, they still have to remember what each purchase was for, which client it belonged to, and whether they already logged it. General accounting suites can be more product than a solo freelancer needs, while cloud AI receipt tools ask users to send invoices, purchase details, and sometimes personal information to a service they do not control.

**PocketLedger is for the solo freelancer who wants the tedious first pass done without handing over their books.** Drop in a receipt image or paste its text. A local vision model drafts the merchant, date, amount, currency, and category. The freelancer checks and edits every field, assigns a client or project, marks the expense for tax records, and saves it to a private local ledger. Search the ledger or export it as CSV for a bookkeeper.

## Who would pay for it?

The first customer is an independent freelancer who wants a fast receipt workflow without a monthly cloud accounting subscription. The business hypothesis is a one-time paid desktop setup, with optional paid onboarding and support for freelancers who want help choosing a local model or preparing a bookkeeper-friendly export. There is no per-receipt API bill, so usage does not add inference costs. The willingness-to-pay hypothesis still needs real freelancer interviews and a first-user trial.

## What it does

| | Workflow | What happens |
|---|---|---|
| 📸 | **Capture** | Add a receipt or invoice as an image, text, CSV, or Excel workbook. |
| 🤖 | **Extract** | Ollama and Qwen2.5-VL create a structured local draft. |
| ✅ | **Review** | Check and edit every field before saving anything. |
| 👥 | **Organize** | Track clients, projects, categories, payment status, and deductions. |
| 📊 | **Understand** | See monthly spending, category breakdowns, and invoice totals. |
| 📤 | **Export** | Download a searchable CSV for your bookkeeper. |
| 🔒 | **Stay private** | Keep data on your device with no hosted AI calls. |

<details>
<summary><strong>See the full feature set</strong> ▾</summary>

- Extracts receipt details from JPG, PNG, or WEBP images, or pasted receipt text, using a local Ollama model.
- Automatically analyzes an uploaded image and saves a draft, including uncertain results marked for review. Users can reopen the receipt and edit saved details.
- Imports client invoices from invoice photos (JPG, PNG, WEBP), CSV files, and Excel workbooks (.xlsx). Ollama reads photos locally and can map unfamiliar spreadsheet column headings; invoice records are saved in PostgreSQL.
- Shows each client's billed and paid totals, outstanding balances, and invoice list. Open an invoice to see the extracted details and original image, or remove an imported record.
- Records category, currency, client or project, and a user-controlled business-deductible flag.
- Provides a searchable ledger, monthly spending view, category breakdown, and CSV export.
- Click any expense to review all saved details and its receipt image when one was kept.
- Includes sign-up and sign-in stored in PostgreSQL, with a sample account for exploring the example ledger. Each local account sees its own expenses; no email or cloud account is needed.
- Uses SQLite by default to keep your current ledger working. PostgreSQL is also supported through `DATABASE_URL`. Expense receipt images remain local files; invoice images are stored in the configured database with account ownership checks.
- Works without Ollama for manual entry. Once Python, Ollama, and the model are installed, the app can run without an internet connection.

</details>

## Run it

Requirements: Python 3.10 or newer and [Ollama](https://ollama.com/download). The default `qwen2.5vl:3b` vision model is about 3.2 GB to download.

1. Install Ollama, start it, and download a vision model once:

   ```sh
   ollama pull qwen2.5vl:3b
   ```

2. Install the app packages and start PocketLedger:

   ```sh
   python -m pip install -r requirements.txt
   python main.py
   ```

3. Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Do not open `index.html` with VS Code Live Server; its static preview cannot handle sign-in, AI, or database requests.

Use the included sample login to explore the example ledger:

| Username | Password |
| --- | --- |
| `demo@pocketledger.local` | `PocketLedger2026!` |

New accounts need a username and a password of at least 10 characters. Passwords are stored as one-way hashes in PostgreSQL, and each account sees only its own expenses. The sample account is available for exploring the example ledger. The first model run may take longer while Ollama loads it. The AI status panel shows whether Ollama and your selected model are ready. If they are unavailable, manual entry and the ledger still work.

### Live Deployed Link : https://saikatpocketledger.netlify.app

> ⚠️ The live frontend is useful for exploring the interface. Local Python, Ollama, and PostgreSQL are required for the complete private workflow.

### Importing client invoices

Open **Client invoices** in the sidebar and choose a JPG, PNG, WEBP, CSV, or `.xlsx` file. PDF upload is not supported yet; export a PDF's table to CSV/Excel or save a page as an image. For spreadsheets, use one invoice per row, with **Client** and **Amount** as the required headers. Invoice Number, Invoice Date, Due Date, Currency, Status, and Description are helpful optional headers. The right-side **Ask PocketLedger** chat answers questions about workflows, column names, and common import errors. An image is read by your local Ollama vision model. For spreadsheets, PocketLedger detects common header names, CSV delimiters, and header rows even when the file includes a title line. Ollama can map less familiar headings; if the client and amount columns are still unclear, choose them from a simple column picker. Download the sample CSV from the invoice screen to get a ready-to-fill format. Imports are limited to 500 rows and 10 MB per file. Duplicate client/invoice-number pairs and rows with invalid amounts are reported; rows with no client name are saved as **Needs review** so they remain visible. The client dashboard includes billed, paid, due, and overdue totals plus a payment progress chart. Review extracted invoice values yourself; local AI can misread unclear documents. Currency totals are kept separate rather than converted.

The **Ask PocketLedger** help chat retrieves relevant notes about the app and uses the configured Ollama model to answer questions such as how to add an expense or why a CSV import failed. It requires a signed-in account and a running local model. Questions are not stored; each answer shows which help notes it used.

### Optional PostgreSQL setup

The app uses your existing `pocketledger.db` automatically unless `DATABASE_URL` is set. To use PostgreSQL, start Docker Desktop, then run `docker compose up -d` from this folder. Copy `.env.example` to `.env` and uncomment the local connection line:

```env
DATABASE_URL=postgresql+psycopg://pocketledger:pocketledger-local@127.0.0.1:5433/pocketledger
```

Restart PocketLedger to connect. PostgreSQL runs inside a Docker container, but its files are stored in Docker's named volume on this same computer. When the PostgreSQL database is empty, the app copies the existing local sample ledger into PostgreSQL and creates the sample login above. Keep the PostgreSQL port restricted to your own device. If you use an already-running PostgreSQL server, set `DATABASE_URL` in `.env` to its database, user, and password instead.

### Settings

Set environment variables before starting the app to change its local configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_MODEL` | `qwen2.5vl:3b` | Ollama vision model tag |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama address; keep it on loopback for local use |
| `DATABASE_URL` | Local `pocketledger.db` | SQLAlchemy URL; set to `postgresql+psycopg://...` to use PostgreSQL |
| `PORT` | `8000` | Local web app port |

For example, in PowerShell you can set `$env:OLLAMA_MODEL = "your-vision-model"` before `python main.py`. Choose an Ollama model that supports both image input and JSON-schema output.

## How it works

```mermaid
flowchart LR
    A[Receipt image or pasted text] --> B[Browser on your device]
    B -->|Local request| C[PocketLedger · FastAPI]
    C -->|JSON schema + optional image| D[Ollama · open-weight vision model]
    D -->|Structured extraction draft| C
    C --> B
    B -->|Saved draft · review any time| E[(SQLite or PostgreSQL)]
    E -->|Search, summary, CSV| B
```

The app binds to `127.0.0.1`, sends inference requests only to the configured Ollama endpoint, and does not call a hosted AI API. Ollama receives the image only for the extraction request. The user can choose to retain expense images in a local `receipts/` folder; imported invoice images are stored in the configured database (by default the local PostgreSQL container). Opening a record shows its details and retained image.

## Why open innovation matters here

Receipt images reveal spending habits, vendors, dates, and sometimes addresses or partial payment information. A closed cloud model would require sending those details to an outside service and could add a fee to every scan. With an open-weight model served locally by Ollama, the private extraction step stays on the freelancer's computer, and after the model download the workflow can run offline. The user decides whether to retain each receipt image locally for later reference. There is no per-token bill or vendor lock-in: users can choose another compatible vision model, change the prompt, or adapt the schema to their bookkeeping needs.

The open approach works especially well for this narrow task: read a short business document and draft a small, predictable set of fields. The model does not decide tax treatment or silently book anything. People review its suggestions, correct mistakes, and remain responsible for whether an expense is deductible.

## Privacy and practical limits

- This is a local utility, not a hosted multi-user service. Accounts and expenses are stored on this computer. Keep it bound to `127.0.0.1` and do not expose its port to a public network. Password recovery is not available because accounts do not use email.
- Kept receipt images live in the local `receipts/` folder and are not encrypted. They are ignored by Git; use device encryption and account protections, and include the folder in backups only if you want receipt copies backed up too.
- Install Python, Ollama, and the chosen model before expecting the app to work fully offline. Model downloads need internet access once.
- Extraction quality depends on the model, image quality, handwriting, and receipt layout. Review the merchant, date, currency, and total before saving.
- Currency totals are never converted. The overview charts one currency at a time; each ledger row retains its original currency.
- The deductible marker is a personal bookkeeping aid, not tax advice or an automatic tax determination.
- PocketLedger does not encrypt its database or receipt files. Use your device's disk encryption and account protections if the data is sensitive.

## Built with

Python · FastAPI · SQLAlchemy · SQLite / PostgreSQL · HTML · CSS · JavaScript · Ollama · Qwen2.5-VL (default model)

## Hacktoberfest

<div align="center">

### 🏆 Built for the Hacktoberfest Open-Source AI Challenge

**Side Hustle · Open Source · Local AI · Privacy by design**

[![DEV Challenge](https://img.shields.io/badge/DEV%20Challenge-Side%20Hustle-3b49df?style=flat-square&logo=dev.to&logoColor=white)](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)
[![MLH Community](https://img.shields.io/badge/MLH-Community-111827?style=flat-square&logo=majorleaguehacking&logoColor=white)](https://mlh.io/)

</div>

PocketLedger is an open-source AI project for the **Side Hustle** theme. It focuses on a clear customer: freelancers who want private receipt capture and client-aware expense tracking without a recurring cloud inference fee. A useful next step is to put it in front of one freelancer, watch them log a real expense, and revise the workflow based on what slows them down.

The [Hacktoberfest Open-Source AI Challenge: Week 2](https://dev.to/challenges/hacktoberfest-week2-2026-10-12) closes **October 18, 2026 at 11:59 PM PDT** (October 19 at 12:29 PM IST) and asks participants to publish a project write-up on DEV with the `devchallenge` and `hf26challenge` tags.

See [`SUBMISSION.md`](SUBMISSION.md) for a draft project write-up to adapt after trying the app.

### Search tags

`mlh` · `hacktoberfest` · `open-source-ai` · `side-hustle` · `local-ai` · `ollama` · `privacy`

## Contributing

Issues and pull requests are welcome. Before a larger change, open an issue to agree on the scope. Keep the local-first promise intact: no hosted AI calls, no uploading original receipts, and no logging receipt contents.

## License

MIT. See [`LICENSE`](LICENSE).
