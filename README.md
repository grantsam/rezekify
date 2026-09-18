# rezekify (UNAPPROVED) - Autonomous Multi-Modal Personal Finance Manager & Deterministic Runway Engine

rezekify is an autonomous personal finance system providing multi-modal transaction capture (receipt images, audio voice notes, free-form text via Telegram and Web), deterministic double-entry bookkeeping, strict runway analysis, and proactive anomaly/burn alerts.

## Key Documentation

- **Product Requirements Document (PRD)**: [`docs/PRD_REZEKIFY.md`](docs/PRD_REZEKIFY.md)
- **Architecture & Design Specification**: [`docs/specs/2026-09-18-rezekify-financial-manager-design.md`](docs/specs/2026-09-18-rezekify-financial-manager-design.md)
- **Implementation Plan**: [`docs/plans/2026-09-18-rezekify-financial-manager.md`](docs/plans/2026-09-18-rezekify-financial-manager.md)

## Architecture Overview

The system operates across three decoupled tiers:

1. **Deterministic Financial Ledger (PostgreSQL & SQLAlchemy 2.0)**
   - Strict double-entry debit/credit ledger enforcing `sum(debits) == sum(credits)`.
   - Immutable historical postings, multi-currency support with fixed IDR anchor, and deterministic runway calculus (`liquid_reserves / 90_day_burn_rate`).

2. **Multimodal AI Agent Runtime (Gemini & Groq Key Pool)**
   - Rotary Key Pool with multi-key round-robin rotation and automatic cooldown on HTTP 429 quota exhaustion.
   - Multimodal ingestion:
     - Voice notes: Transcribed via Groq Whisper (`whisper-large-v3`).
     - Receipt images: Structured OCR extraction via Google Gemini (`gemini-2.5-flash`).
     - Text parsing & categorization: Structured Pydantic extraction using Gemini / Groq Llama 3.3 70B.
   - Deterministic validation gate converting agent extractions into valid double-entry ledger proposals.

3. **Client Gateways & Proactive Interfaces**
   - **Telegram Bot**: Frictionless conversational entry point for instant receipt snaps, voice notes, and quick balances.
   - **FastAPI Backend**: REST & WebSocket APIs for real-time runway dashboards, transaction approval flows, and telemetry.
   - **React Frontend**: Modern, responsive analytics dashboard for cash flow visualization, budget pacing, and ledger audit trails.

## Quick Start

### 1. Environment Setup

```bash
# Clone and enter directory
cd "C:\Grant code\rezekify"

# Copy environment template
cp .env.example .env
# Edit .env with your PostgreSQL credentials and API keys

# Install Python dependencies
pip install -e .
```

### 2. Run Database & Backend

```bash
# Start backend API
uvicorn rezekify.api.main:app --reload --port 8000
```
