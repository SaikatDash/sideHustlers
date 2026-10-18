---
title: "PocketLedger: a private expense desk for freelancers"
published: false
tags: devchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12).*

## What I Built

Freelancers often lose the same hour twice: first collecting receipts and client invoices, then trying to remember which project each one belongs to and who still owes money. Accounting suites can feel heavy for a solo business, while cloud document tools send financial files to a service the freelancer may not control.

I built **PocketLedger**, a local money desk for independent designers, developers, photographers, and consultants. Create a local account, upload an expense receipt image or a client invoice photo, CSV, or Excel workbook. Ollama reads images and helps map unusual spreadsheet columns on the same computer. PocketLedger saves invoice details in PostgreSQL, flags uncertain rows for review, and shows billed, paid, and outstanding amounts for each client. Expense receipt drafts remain editable and exportable for a bookkeeper.

The product is aimed at solo freelancers who want simple receipt capture without a hosted accounting workflow. The business hypothesis is a one-time paid setup with optional onboarding and support. I have not validated pricing or interviewed a first user yet. The next test is to sit with a freelancer while they enter real expenses and see whether client tracking and the export fit their current workflow.

## Demo

The app runs locally at `http://127.0.0.1:8000`. For a public submission, add a short screen recording that shows invoice import, the client summary, opening an invoice, and receipt review. The app stays local, so a hosted demo would defeat the privacy goal.

## Code

Add the public repository URL here after pushing the project. The MIT-licensed source includes the Python app, browser interface, setup guide, and local data storage.

## How I Built It

PocketLedger uses **Qwen2.5-VL 3B** through Ollama for local receipt and invoice image understanding. Ollama receives the image and returns structured fields. For spreadsheet imports, the local model maps column headers to a fixed invoice schema; server-side code parses and validates amounts, dates, duplicates, and required fields before saving. FastAPI and SQLAlchemy use PostgreSQL for the configured workspace, while SQLite remains supported. Invoice images are stored with their records in the configured local database, and the app binds to loopback without hosted AI requests.

The interface is plain HTML, CSS, and JavaScript; FastAPI serves the backend and SQLAlchemy supports SQLite or PostgreSQL. After installing the app and downloading the model once, receipt extraction can work offline. A local model is optional for manual expense entry.

## Why Does Open Innovation Matter?

Receipts and invoices reveal vendors, dates, prices, client relationships, and sometimes personal information. A local open-weight model lets PocketLedger read them without sending each image or spreadsheet to a cloud AI provider. That keeps extraction and column mapping on the user's computer and avoids per-document API fees. Once the model is downloaded, the user can work offline, swap to another compatible model, or change the extraction schema to fit their niche bookkeeping needs. Keeping invoice records separate from expenses also makes client receivables visible without corrupting spending totals.

This open setup fits the narrow task: understand a short document and draft predictable fields. The model does not make a tax decision or silently book an expense. The freelancer remains in control of the amount and tax marker. The trade-off is that users need enough local disk and memory for the model, and they must review imperfect readings.

## Limits and Next Step

Image quality and spreadsheet headings affect extraction accuracy. Currency values stay in their original currency; PocketLedger does not convert them, calculate tax, or encrypt the local database and receipt files. The deductible marker is a user-controlled record, not tax advice. The next milestone is a first-user trial and changes based on what a freelancer finds inconvenient.
