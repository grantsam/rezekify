# Security Policy & Architecture

This document outlines the security architecture, threat model, defensive controls, and vulnerability disclosure procedures for Rezekify.

---

## 1. Vulnerability Reporting & Disclosure

Rezekify takes the security of financial and personal data seriously. We welcome responsible security research and disclosure.

### Responsible Disclosure Guidelines
- **Do not file public GitHub issues** for suspected security vulnerabilities or active exploits.
- Report all vulnerabilities directly via email to: **security@rezekify.internal** (or the project maintainer's listed security contact).
- Provide detailed steps to reproduce the issue, including environment details, proof-of-concept payloads, and potential impact.
- Allow reasonable time for remediation prior to public disclosure.

### Response Time Commitments
- **Initial Triage & Acknowledgment**: Within 48 hours of receipt.
- **Severity Assessment & Mitigation Plan**: Within 5 business days.
- **Patch Release SLA**:
  - *Critical (CVSS 9.0–10.0)*: Hotfix release within 72 hours of confirmed triage.
  - *High (CVSS 7.0–8.9)*: Fix delivered within 14 calendar days.
  - *Medium/Low*: Addressed in the next planned maintenance cycle.

---

## 2. Supported Versions

Security updates and patches are actively maintained for the following versions:

| Version | Supported          | Status                                    |
|---------|--------------------|-------------------------------------------|
| 1.0.x   | Yes                | Active support, current stable release    |
| < 1.0.0 | No                 | End of life; operators must upgrade       |

---

## 3. Core Security Architecture & Defensive Controls

Rezekify employs a defense-in-depth architecture designed for zero trust between application components, untrusted LLM outputs, and multi-tenant data boundaries.

```
                          Untrusted Perimeter
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │      Nginx Edge Proxy     │
                    │  (TLS Term, HTTPS Only)   │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │    RateLimiter & Auth     │
                    │ (Sliding Window, JWT+CSRF)│
                    └─────────────┬─────────────┘
                                  │
                                  ▼
               ┌──────────────────────────────────────┐
               │    AI Agent / Telegram Ingestion     │
               │   (SSRF Guard, Update Deduplication) │
               └──────────────────┬───────────────────┘
                                  │
                                  │ JSON Proposal Only (No DB Access)
                                  ▼
               ========================================
               THE DETERMINISTIC BARRIER (LedgerService)
               ========================================
               - Row-Level Locking (SELECT FOR UPDATE)
               - Strict Invariant & Balance Checks
               - Mandatory Tenant Scoping (user_id)
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │ PostgreSQL Database (ACID)│
                    │ (Isolated Docker Network) │
                    └───────────────────────────┘
```

### Prompt Injection Defense & The Deterministic Barrier
Large Language Models (LLMs) are treated as untrusted computation components. Prompt injection attacks (direct or indirect via poisoned receipts or conversational input) cannot directly alter account balances, forge transactions, or bypass financial constraints.

1. **Entity Proposal Separation**:
   - The LLM agent has no direct database write access or execution permissions.
   - The agent strictly outputs structured JSON entity proposals (e.g., `ProposedTransaction(amount, type, category_id, date)`).
2. **Deterministic Ledger Validation**:
   - All mutations pass through `LedgerService`.
   - The service enforces strict accounting invariants, non-negative balance constraints where applicable, foreign key integrity, and row-level locks (`SELECT FOR UPDATE`) before any commit.
   - If an LLM hallucinates or is coerced to emit invalid financial mutations (such as negative transfer amounts or non-existent account IDs), `LedgerService` rejects the operation with a deterministic validation error.

### Row-Level Tenant Isolation
Rezekify guarantees strict isolation between multi-tenant accounts:
- **Mandatory Filter Injection**: Every database query and mutation path explicitly binds `WHERE user_id = current_user_id`.
- **Ownership Verification on Lookups**: All category, account, budget, and transaction lookups verify ownership against the active session tenant.
- **Cross-Tenant Impersonation Prevention**: No endpoint accepts a target `user_id` parameter; identity is derived exclusively from verified JWT authentication context.

### Server-Side Request Forgery (SSRF) Protection
To protect internal infrastructure when users configure custom OpenRouter, Ollama, or OpenAI-compatible inference endpoints, Rezekify enforces rigorous URL validation via `validate_base_url(base_url, resolve=True)` in `rezekify/agent/providers/base.py`:
- **Scheme Restriction**: Only `https://` (or `http://` explicitly restricted to local development environments) is accepted.
- **Address Range Blocking**: Blocks private IPv4/IPv6 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback addresses (`127.0.0.0/8`, `::1`), link-local addresses (`169.254.0.0/16`, `fe80::/10`), and multicast addresses.
- **DNS Pinning & Resolution Validation**: Resolves hostnames prior to connection initialization to eliminate DNS rebinding attacks against internal infrastructure.

### Tenant Secret & BYOK Encryption at Rest
Tenant API keys (Bring-Your-Own-Key model for LLM providers) are protected using envelope encryption in `rezekify/core/crypto.py`:
- **Key Derivation**: PBKDF2-HMAC-SHA256 with 600,000 iterations and a cryptographically secure salt.
- **Symmetric Cipher**: Fernet (AES-128-CBC with PKCS7 padding and HMAC-SHA256 authentication).
- **Dual-Key Fallback**: Supports seamless cryptographic rotation with a primary active key and secondary legacy key fallback.
- **Redaction & Masking**: Sensitive keys are never returned in full via the API; displays are masked (e.g., `...4x8B`).

### Authentication & Session Security
- **Password Storage**: Passwords are hashed using native `bcrypt` with work factor 12, safe against the 72-byte truncation boundary.
- **Access Tokens**: Short-lived (30 minutes) signed JSON Web Tokens (HS256) carrying minimal user identity claims.
- **Refresh Tokens**: Long-lived (7 days) refresh tokens delivered exclusively over `HttpOnly`, `SameSite=Lax` cookies scoped strictly to the `/api/v1/auth` path.
- **Constant-Time Verification**: Password and token comparisons use constant-time operations (`secrets.compare_digest`) to prevent timing side-channel attacks.
- **Revocation**: Logout immediately invalidates refresh tokens and purges client cookies.

### Rate Limiting & Denial of Service Protection
In-memory sliding-window rate limiters (`RateLimiter` in `rezekify/core/rate_limit.py`) track request volume using monotonic clocks (`time.monotonic()`) and sliding-window double-ended queues (`deque`):
- **Auth Endpoints**: 10 requests / minute per client IP.
- **AI Chat Agent**: 15 requests / minute per authenticated user.
- **AI Receipt OCR Processing**: 5 requests / minute per authenticated user.
- **AI Provider Key Validation**: 10 requests / minute per authenticated user.
- **Memory Protection**: Scheduled sliding-window sweeps purge inactive IP/user buckets to prevent unbounded memory growth.

### Telegram Gateway Security
The Telegram bot interface connects to the core application via webhook and polling architectures with multiple defensive layers:
- **Webhook Authentication**: Every incoming webhook payload must include the `X-Telegram-Bot-Api-Secret-Token` header, validated with `secrets.compare_digest`.
- **Replay Attack Defense**: A sliding 5-minute update deduplication cache (`_processed_update_ids`) discards duplicate or replayed update payloads.
- **Pairing Code Security**:
  - High-entropy 6-character alphanumeric pairing codes.
  - Strict 15-minute time-to-live (TTL).
  - Rate-limited pairing attempts: maximum 5 failed attempts per 15-minute window per Telegram `chat_id`.
  - Atomic pairing: linking a new chat automatically unlinks prior associations.

---

## 4. Best Practices for Operators & Self-Hosters

Operators deploying Rezekify in production environments must follow these deployment recommendations:

1. **SECRET_KEY Entropy**:
   - Generate high-entropy secret keys using a cryptographically secure pseudo-random number generator (CSPRNG):
     ```bash
     openssl rand -hex 32
     ```
   - Application startup validates `SECRET_KEY` through `pydantic-settings`. Default development keys are rejected when `ENVIRONMENT=production`.

2. **Container Security & Non-Root Execution**:
   - The production container (`Dockerfile.backend`) executes under a dedicated non-root user `rezekify` with `UID 10001` and `GID 10001`.
   - Never run containers with root privileges or with Docker socket binding.

3. **Network Isolation**:
   - The PostgreSQL database must never expose port `5432` to the public network or host interfaces.
   - Restrict database communication to the internal Docker bridge network (`rezekify_net`).

4. **TLS Termination & Edge Hardening**:
   - Always terminate TLS at a hardened reverse proxy (such as Nginx, Caddy, or Cloudflare) using modern TLS (TLS 1.2+ / TLS 1.3).
   - Configure HTTP Strict Transport Security (HSTS):
     ```nginx
     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
     ```
   - Set standard defensive headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).
