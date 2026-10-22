# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
1. **Mahasiswa Rantau (University Students Living Away from Home):** Needs low-friction expense logging (casual text or photo receipts) and proactive daily allowance guidance to avoid mid-month financial collapse.
2. **Freelancers & Gig Workers:** Irregular income across multiple bank and e-wallet buckets (BCA, GoPay, OVO). Needs multi-account balance consolidation, pre-purchase simulation, and real-time safe daily runway calculations.

## Product Purpose
Rezekify is an autonomous personal finance manager and deterministic runway engine that provides daily safe spending limits, eliminating financial anxiety for Indonesian students and freelancers. It combines effortless conversational and multimodal AI ingestion with 100% deterministic mathematical calculations.

## Positioning
Conversational and multimodal ingestion as the casual front door, strictly isolated from a 100% deterministic, double-entry mathematical core running Python `decimal.Decimal`. The LLM never calculates money, balances, or runway.

## Operating Context
- Environments: Mobile responsive browser (primary on-the-go logging) and desktop cockpit (weekly/monthly planning), plus Telegram Bot webhook gateway for instant chat/voice logging.
- Workflows: Daily casual logging (natural language text prompt, camera receipt dropzone, voice note), morning daily runway checks, pre-purchase impulse simulation, H-7 impending bill alerts.

## Capabilities and Constraints
- Capabilities: Multi-account tracking (BANK, EWALLET, CASH, LIABILITY), balanced double-entry ledger with reversal-and-repost correction, dynamic Daily Safe Runway calculation, virtual vaults (locked savings and fixed recurring bills) with autonomous rollover (+1 month), multi-modal OCR and audio parsing with rotary API key pool (Gemini 2.5 Flash + Groq fallback), BYOK encryption (Fernet PBKDF2 600k iterations).
- Constraints: Single Ubuntu VPS (1–2 GB RAM, Docker Compose), zero paid SaaS dependencies, zero-cost rotary AI key pool, zero floating-point arithmetic for currency.

## Brand Commitments
- Name: Rezekify
- Voice: Reassuring, calm, utilitarian, zero shame or judgment, anti-jargon.
- Palette & Telemetry: Modern Zinc studio (`#0c0c0e`, `#141417`), high-contrast traffic-light status indicators (Emerald for Healthy, Amber for Warning/Impending bills, Rose for Critical).

## Evidence on Hand
- SIS1-CD1 Academic Proposal Document (`docs/CD1.md`, Vigris Labs - UNESA 2026).
- Bidirectional Check-and-Balance Audit Report (`docs/audit/AUDIT_CD1_VS_PROJECT_2026-10-13.md`).
- Fully implemented test suites: 336 backend tests and 320 frontend tests across 36 test files passing.

## Product Principles
1. **Deterministic Financial Math:** Zero floating-point, zero probabilistic math; double-entry ledger journals where sum(Debit) = sum(Credit).
2. **Zero-Friction Ingestion:** Casual conversational texting and receipt dropzones are the primary center of gravity over tedious manual forms.
3. **Calm Forward Telemetry:** Single-number clarity ("Safe to spend today: Rp X") over complex retrospective accounting graphs.
4. **Single-Box Resilience:** Self-contained, lightweight footprint with robust multi-key rotation and rate-limit fallbacks on zero server cost.

## Accessibility & Inclusion
- Target: WCAG AA compliance with minimum 38x38px touch targets (44x44px for primary controls).
- Strictly zero horizontal overflow on mobile viewports down to 360px.
- High contrast ratios (>4.5:1, mostly AAA >10:1 on dark surfaces) and reduced motion support (transitions <= 250ms).
