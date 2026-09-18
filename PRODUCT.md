# Rezekify — Product Context

## Product Truth
Rezekify is an autonomous personal finance assistant and deterministic runway engine designed for students and freelancers. It combines effortless conversational and multimodal AI ingestion with 100% deterministic, double-entry mathematical calculations.

## Target Audience & Personas
1. **Mahasiswa Rantau (University Students Living Away from Home):** Needs low-friction expense logging (casual text or photo receipts) and proactive daily allowance guidance to avoid mid-month financial collapse.
2. **Freelancers & Gig Workers:** Irregular income across multiple bank and e-wallet buckets (BCA, GoPay, OVO). Needs multi-account balance consolidation, pre-purchase simulation, and real-time safe daily runway calculations.

## Core Pillars
1. **Zero-Friction Ingestion:** Natural language texting and receipt upload as the hero center of gravity.
2. **Dynamic Daily Safe Runway:** Daily Safe Runway = (Total Liquid Cash - Locked Vault Reserves) / Days Remaining.
3. **Deterministic Core:** Zero LLM math. All monetary arithmetic, balances, and runway metrics are computed deterministically with `decimal.Decimal` in Python.
4. **Virtual Vaults & Impending Bills (H-7):** Sinking funds and fixed commitments locked away from operational cash, with an urgent warning banner for bills due within 7 days.
5. **Zero-Bloat Scope:** Focused strictly on Daily Runway and Monthly category allocations. No vanity metrics or confusing yearly graphs.

## Interface Mode
**Operate:** High scanability, rapid task execution, calm financial reassurance, high-contrast traffic-light status indicators (Emerald for Healthy, Amber for Warning, Rose for Critical).
