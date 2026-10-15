---
title: "PocketLedger: a private expense desk for freelancers"
published: false
tags: devchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12).*

## What I Built

Freelancers often lose the same hour twice: first collecting receipts, then trying to remember which project each purchase belonged to. Accounting suites can feel heavy for a solo business, while cloud receipt tools send financial documents to a service the freelancer may not control.

I built **PocketLedger**, a local expense desk for independent designers, developers, photographers, and consultants. Drop in a receipt image or paste invoice text; a local vision model drafts the details. The freelancer checks and edits each field, assigns a client or project, marks tax records themselves, then saves the expense to a searchable ledger and exports it for a bookkeeper.

The product is aimed at solo freelancers who want simple receipt capture without a hosted accounting workflow. The business hypothesis is a one-time paid setup with optional onboarding and support. I have not validated pricing or interviewed a first user yet. The next test is to sit with a freelancer while they enter real expenses and see whether client tracking and the export fit their current workflow.

## Demo

The app runs locally at `http://127.0.0.1:8000`. For a public submission, add a short screen recording that shows receipt review, saving an expense, and the CSV export. The app stays local, so a hosted demo would defeat the privacy goal.

## Code

Add the public repository URL here after pushing the project. The MIT-licensed source includes the Python app, browser interface, setup guide, and local data storage.

## How I Built It

PocketLedger uses **Qwen2.5-VL 3B** through Ollama for local receipt understanding. Ollama receives the image and a JSON schema, and returns a structured draft. The browser puts the draft in an editable form; Python's standard-library HTTP server stores confirmed fields in SQLite. The original image is not stored. The app binds to loopback and makes no hosted AI request.

The interface is plain HTML, CSS, and JavaScript; the backend and database need no Python package installation. After installing the app and downloading the model once, receipt extraction can work offline. A local model is optional for manual expense entry.

## Why Does Open Innovation Matter?

Receipts reveal vendors, dates, purchases, and sometimes personal information. A local open-weight model lets PocketLedger read them without sending each image to a cloud AI provider. That keeps the extraction step on the user's computer and avoids per-scan API fees. Once the model is downloaded, the user can work offline, swap to another compatible vision model, or change the extraction schema to fit their bookkeeping habits.

This open setup fits the narrow task: understand a short document and draft predictable fields. The model does not make a tax decision or silently book an expense. The freelancer remains in control of the amount and tax marker. The trade-off is that users need enough local disk and memory for the model, and they must review imperfect readings.

## Limits and Next Step

Receipt quality affects extraction accuracy. Currency values stay in their original currency; PocketLedger does not convert them, calculate tax, or encrypt the local SQLite database. The deductible marker is a user-controlled record, not tax advice. The next milestone is a first-user trial and changes based on what a freelancer finds inconvenient.
