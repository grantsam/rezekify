# Rezekify — Exhaustive Multi-Level Use Case Catalog (L0 to L3)

**Document ID:** ARCH-003 | **Version:** 1.0.0 | **Framework:** Cockburn Goal Hierarchy & Kruchten 4+1 View Model  
**Target Environment:** Docker Compose (PostgreSQL 16 + FastAPI + Nginx + React SPA) | **Status:** Active

---

## Section 1: Methodological Framework & Taxonomy

### 1.1 Cockburn Altitude Definitions

The Rezekify use case architecture is structured using Alistair Cockburn's Goal Hierarchy (altitude taxonomy). This ensures strict vertical traceability from executive enterprise capability down to wire-level protocols and binary packet structures.

| Altitude | Metaphor | Abstraction Level | Scope & Question Answered | Primary Artifact in Rezekify |
| :--- | :--- | :--- | :--- | :--- |
| **L0** | **Helicopter / Cloud** (Summary Level) | Strategic Enterprise Capabilities | *"What macro business value does the platform deliver?"* Cross-cutting architectural capabilities spanning multiple human goals and system boundaries. | Enterprise Capability Matrix (Section 3) |
| **L1** | **Sea-Level** (User Goal Level) | Elementary Business Processes | *"What does the end user want to accomplish in a single sitting?"* Transactional interactions that leave domain entities in a consistent, persistent state. | Sea-Level User Goal Catalog (Section 4) |
| **L2** | **Fish-Level** (Component Choreography) | Internal Architectural Flows | *"How do internal subsystems, services, and domain models collaborate to fulfill the goal?"* Design-by-Contract interaction protocols between FastAPI routers, orchestrators, ledger services, and external APIs. | Subsystem Choreography Specifications (Section 5) |
| **L3** | **Sub-Marine** (Wire Microprocess) | Wire-Level & Storage Primitives | *"What exact bytes cross the network boundary and how are bytes laid out in storage?"* HTTP payloads, JSON schemas, cryptographic byte sequences, SQL indexes, and memory algorithms. | Wire & Storage Microprocess Catalog (Section 6) |

---

### 1.2 Kruchten 4+1 View Model Integration

Philippe Kruchten's 4+1 View Model provides four structural views of software architecture centered on an overarching Use Case View. The diagram below illustrates how each architectural view maps directly to the layers of this multi-level catalog:

```mermaid
flowchart TD
    subgraph UseCaseView["1. Use Case View (Center)"]
        L0["L0: Macro-Capabilities (Sec 3)"]
        L1["L1: Sea-Level User Goals (Sec 4)"]
    end

    subgraph LogicalView["2. Logical View"]
        Actors["Enterprise Boundary & Actors (Sec 2)"]
        DomainModels["Domain Entities: User, Account, Vault, Transaction, LedgerEntry"]
    end

    subgraph ProcessView["3. Process View"]
        L2Choreography["L2: Component Choreographies (Sec 5)"]
        Concurrency["Pessimistic Locks (SELECT FOR UPDATE), Concurrency & Invariants"]
    end

    subgraph DevelopmentView["4. Development View"]
        CodeModules["Source Modules: api/v1/*_router.py, services/*, agent/*, core/*"]
        DbSchemas["Database Migrations: alembic/versions/*"]
    end

    subgraph PhysicalView["5. Physical View"]
        DockerNetwork["Docker Compose: Web SPA (:80), FastAPI (:8000), PostgreSQL (:5432)"]
        WireProtocols["L3: Wire Payloads, Cryptographic Formats, Indexes (Sec 6)"]
    end

    UseCaseView --> LogicalView
    UseCaseView --> ProcessView
    LogicalView --> DevelopmentView
    ProcessView --> DevelopmentView
    DevelopmentView --> PhysicalView
    ProcessView --> PhysicalView
```

- **Logical View**: Maps system actors, domain boundaries, and class relationships (Section 2, Section 5 DbC specifications).
- **Process View**: Captures dynamic interaction protocols, thread execution contexts, and transactional locking mechanics (Section 5 L2 choreographies).
- **Development View**: Cites real file paths, package structures, module dependencies, and code hierarchies (`rezekify/services/*`, `rezekify/agent/*`, `rezekify/api/v1/*`).
- **Physical View**: Documents network topology, runtime execution nodes, container boundaries, and protocol wire formats (Section 6 L3 wire structures).
- **Use Case View**: Serves as the central organizing nexus binding all views together into verifiable business capabilities (Sections 3 and 4).

---

## Section 2: Enterprise Boundary & System Actors

### 2.1 Actor Definitions

Every boundary-crossing event in Rezekify originates from or terminates at an explicit system actor.

| Actor Name | Classification | Trigger Channel / Protocol | Role & Operational Description |
| :--- | :--- | :--- | :--- |
| **End User (Human)** | Primary Human | Web HTTPS (React SPA) / Telegram (HTTPS) | Interacts with the system to record transactions, view runway analytics, configure financial accounts/vaults, manage BYOK keys, and query spending limits. |
| **System Timer** | Internal Automated | In-Memory Sweep / Cron Event Loop | Periodically triggers sliding-window rate limiter bucket eviction, runway cache invalidation, and daily cycle rollover tracking. |
| **Gemini API** | External Secondary | HTTPS REST (`generativelanguage.googleapis.com`) | Google Gemini 2.5 Flash endpoint used for natural language entity extraction, zero-shot receipt OCR parsing, and native 1-hop audio note understanding. |
| **Groq API** | External Secondary | HTTPS REST (`api.groq.com`) | Groq Llama 4 Scout (17B) and Whisper Large V3 endpoints providing secondary failover for text/vision entity extraction and high-accuracy speech-to-text (STT). |
| **BYOK Endpoint** | External Secondary | HTTPS REST (Custom URL / OpenAI or Anthropic Spec) | User-configured Bring-Your-Own-Key external inference server, allowing zero-cost multi-tenant offloading to user-owned API quotas. |
| **Telegram Bot API** | External Secondary | Webhook HTTPS POST (`core.telegram.org/bots/api`) | Delivers inbound conversational messages, receipt photographs, and voice memos from the Telegram cloud into the FastAPI gateway. |
| **PostgreSQL Database** | Internal Secondary | TCP Protocol (`psycopg2` / `localhost:5432`) | ACID-compliant relational persistence store hosting accounts, double-entry ledger transactions, user settings, chat records, and relational indexes. |

---

### 2.2 Enterprise Boundary Diagram

The enterprise boundary isolates untrusted human inputs and third-party AI services from the core deterministic ledger engine.

```mermaid
flowchart LR
    subgraph ExternalActors["External Actors"]
        UserWeb["End User (Web SPA)"]
        UserTg["End User (Telegram Client)"]
        GeminiExt["Google Gemini API"]
        GroqExt["Groq API (Llama + Whisper)"]
        ByokExt["Custom BYOK Endpoint"]
        TelegramCloud["Telegram Bot API Cloud"]
    end

    subgraph RezekifyBoundary["Rezekify Enterprise Boundary"]
        subgraph IngestionLayer["Ingestion & Gateway Subsystem"]
            Nginx["Nginx Reverse Proxy (:80/:443)"]
            FastAPIGateway["FastAPI Gateway Router (/api/v1/gateway)"]
            FastAPIDashboard["FastAPI Dashboard Router (/api/v1/dashboard)"]
            FastAPIAuth["FastAPI Auth Router (/api/v1/auth)"]
            FastAPITx["FastAPI Transaction Router (/api/v1/transactions)"]
            RateLimitEngine["RateLimiter (Sliding Window Monotonic)"]
        end

        subgraph IntelligenceLayer["Cognitive Extraction Subsystem"]
            AgentOrch["AgentOrchestrator"]
            RuntimeAgent["ReActAgent Runtime"]
            KeyPool["RotaryKeyPool (Round-Robin & Cooldown)"]
            ByokAdapter["BYOK Adapter Factory (OpenAI/Anthropic)"]
        end

        subgraph CoreDeterministicLayer["Core Deterministic Financial Subsystem"]
            LedgerSvc["LedgerService (Double-Entry Engine)"]
            RunwaySvc["RunwayService (Runway & Simulation Engine)"]
            AuthSvc["AuthService (Identity & Pairing Engine)"]
            CryptoUtil["Crypto Module (Fernet PBKDF2 HMAC-SHA256)"]
        end

        subgraph PersistenceLayer["Storage & Data Subsystem"]
            PostgreSQL[("PostgreSQL 16 DB Engine")]
            LedgerTables[("accounts, transactions, ledger_entries")]
            UserTables[("users, user_settings, vaults, categories, chat_messages")]
        end
    end

    UserWeb -->|HTTPS REST| Nginx
    UserTg -->|HTTPS| TelegramCloud
    TelegramCloud -->|Webhook POST| Nginx
    Nginx --> FastAPIGateway
    Nginx --> FastAPIDashboard
    Nginx --> FastAPIAuth
    Nginx --> FastAPITx

    FastAPIGateway --> RateLimitEngine
    FastAPIDashboard --> RateLimitEngine

    FastAPIDashboard --> AgentOrch
    FastAPIGateway --> AgentOrch
    AgentOrch --> RuntimeAgent
    RuntimeAgent --> KeyPool
    RuntimeAgent --> ByokAdapter

    KeyPool -->|REST HTTPS| GeminiExt
    KeyPool -->|REST HTTPS| GroqExt
    ByokAdapter -->|REST HTTPS| ByokExt

    AgentOrch --> LedgerSvc
    AgentOrch --> RunwaySvc
    FastAPITx --> LedgerSvc
    FastAPIDashboard --> RunwaySvc
    FastAPIAuth --> AuthSvc
    FastAPIAuth --> CryptoUtil

    LedgerSvc -->|SELECT FOR UPDATE / COMMIT| PostgreSQL
    RunwaySvc -->|Aggregates / SUM| PostgreSQL
    AuthSvc -->|CRUD / Verification| PostgreSQL
```

---

## Section 3: Level 0 (L0) Macro-Capabilities

### 3.1 Strategic Enterprise Capabilities

Level 0 macro-capabilities represent strategic business outcomes delivered by Rezekify. Each capability unites multiple sea-level use cases to provide autonomous, mathematically infallible personal finance management.

| L0-ID | Strategic Enterprise Capability | Business Value & Strategic Rationale | Subsystems Involved | Primary L1 Use Cases |
| :--- | :--- | :--- | :--- | :--- |
| **L0-CAP-01** | **Autonomous Multi-Modal Recording** | Eliminates cognitive overhead and user friction in bookkeeping by accepting unstructured Indonesian text, cash receipts, and voice memos, transforming them into structured double-entry ledger entries without human data entry. | `AgentOrchestrator`, `ReActAgent`, `LedgerService`, `RotaryKeyPool`, `dashboard_router`, `gateway_router` | L1-UC-01, L1-UC-02, L1-UC-03, L1-UC-04, L1-UC-05, L1-UC-14 |
| **L0-CAP-02** | **Deterministic Runway Intelligence** | Prevents mid-month insolvency by maintaining real-time daily safe spending thresholds and simulating proposed purchases against non-negotiable fixed obligations, with zero LLM arithmetic hallucinations. | `RunwayService`, `dashboard_router`, `analytics_router`, PostgreSQL Aggregate Views | L1-UC-06, L1-UC-07, L1-UC-16 |
| **L0-CAP-03** | **Omni-Channel Ubiquitous Access** | Provides frictionless access across both modern desktop/mobile web dashboards and instant messaging (Telegram Bot), synchronizing states seamlessly with zero data discrepancies. | `TelegramGateway`, `FastAPI Router`, React SPA Client, `AuthService` | L1-UC-01, L1-UC-13, L1-UC-14 |
| **L0-CAP-04** | **Financial Commitment Containment** | Isolates committed liabilities (sinking funds, fixed utility bills, loan amortizations) from liquid cash, physically locking funds to ensure mandatory bills can never be spent on discretionary items. | `Vault` Entity, `LedgerService`, `RunwayService`, `vaults_router` | L1-UC-12 |
| **L0-CAP-05** | **Zero-Cost AI Infrastructure Resilience** | Guarantees continuous high-availability multimodal AI operation on public zero-cost infrastructure via automatic round-robin key cycling, dynamic rate-limit cooldown tracking, and multi-tier failovers. | `RotaryKeyPool`, `ReActAgent`, Groq Fallback Adapter, Gemini REST Engine | L1-UC-01, L1-UC-02, L1-UC-03, L1-UC-15 |
| **L0-CAP-06** | **Tenant-Isolated Multi-User Platform** | Enforces strict data segregation, cryptographic at-rest storage for user-provided API credentials, and JWT rotation across all tenant interactions to guarantee zero inter-user data leakage. | `AuthService`, `CryptoUtil`, `security.py`, Row-Level Query Filters (`WHERE user_id = :uid`) | L1-UC-08, L1-UC-09, L1-UC-10, L1-UC-11, L1-UC-15 |

---

## Section 4: Level 1 (L1) User Goal Catalog

Level 1 use cases represent discrete, complete tasks initiated by an actor to achieve a tangible business goal in a single sitting.

| L1-ID | User Goal Name | Primary Trigger Event | Primary Actor | Mandatory Preconditions | Nominal Business Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **L1-UC-01** | Record Expense via AI Chat | User enters text (e.g. *"kopi susu 18rb bca"*). | End User | Authenticated session; at least 1 active Account exists. | Expense transaction posted, account deducted, debit/credit ledger entries created, runway updated. |
| **L1-UC-02** | Record Expense via Receipt Photo | User uploads receipt photo (JPEG/PNG/WebP). | End User | Authenticated session; valid image $\le$ 10MB; at least 1 active Account. | OCR extracts vendor, items, total; expense posted to double-entry ledger; updated runway returned. |
| **L1-UC-03** | Record Expense via Voice Note | User uploads audio voice note (WebM/OGG/WAV). | End User | Authenticated session; valid audio $\le$ 10MB; at least 1 active Account. | Audio transcribed verbatim, entities extracted, expense posted, confirmation with runway returned. |
| **L1-UC-04** | Record Income | User sends income prompt (e.g. *"gaji 8jt BCA"*). | End User | Authenticated session; at least 1 active destination Account. | Income transaction posted, destination account balance increased, operational runway expanded. |
| **L1-UC-05** | Transfer Between Accounts | User sends transfer prompt (e.g. *"transfer 500rb BCA ke GoPay"*). | End User | Authenticated session; $\ge$ 2 distinct active Accounts exist. | Balanced transfer recorded; source account credited, destination account debited; runway invariant preserved. |
| **L1-UC-06** | Check Runway Status | User sends *"cek runway"* or clicks dashboard summary. | End User | Authenticated session. | System calculates and displays liquid cash, locked reserves, daily safe runway, and health status. |
| **L1-UC-07** | Simulate Purchase Impact | User submits planned discretionary purchase amount. | End User | Authenticated session; active runway profile configured. | System outputs projected runway drop, daily threshold adjustment, and deterministic safety verdict. |
| **L1-UC-08** | Register New Account | User submits registration form (email, password, name). | End User | Target email address is not currently registered in the database. | User entity persisted with bcrypt hash; access token returned; HttpOnly refresh cookie set. |
| **L1-UC-09** | Login to Platform | User submits email and password credentials. | End User | User account exists with matching bcrypt password hash. | JWT access token issued; HttpOnly refresh cookie set; user profile returned. |
| **L1-UC-10** | Manage Financial Accounts | User creates, edits, or deactivates financial accounts. | End User | Authenticated session; valid account type (`CASH`, `BANK`, `EWALLET`, `LIABILITY`). | Account state mutated in database; soft-delete flag updated if deactivating. |
| **L1-UC-11** | Manage Expense Categories | User creates, modifies, or deletes an expense category. | End User | Authenticated session; valid category name, icon, and hex color. | Category mutated; deleting a category cleanly nullifies ledger category references without balance data loss. |
| **L1-UC-12** | Manage Commitment Vaults | User creates, updates, locks, unlocks, or deletes a vault. | End User | Authenticated session; target amount and allocation valid. | Vault state updated; locked vaults immediately deduct from liquid cash to compute operational runway. |
| **L1-UC-13** | Pair Telegram Bot | User requests pairing code on Web and sends `/link CODE` to Bot. | End User | Authenticated web session; active Telegram user account. | User `telegram_chat_id` linked; pairing code consumed and cleared; bot sends confirmation. |
| **L1-UC-14** | Record via Telegram Bot | User sends text, receipt image, or voice note to Telegram bot. | End User | Telegram chat ID is paired to an existing user; at least 1 active Account. | Gateway processes input through `AgentOrchestrator`; transaction posted; reply sent back to Telegram chat. |
| **L1-UC-15** | Configure BYOK AI | User configures custom AI endpoint, protocol, and API key. | End User | Authenticated session; valid BYOK base URL, protocol, and key. | Endpoint validated via live ping; API key encrypted at rest via Fernet PBKDF2; settings persisted. |
| **L1-UC-16** | View Spending Analytics | User requests 7-day daily trend or monthly cycle breakdown. | End User | Authenticated session; period is strictly `daily` or `monthly`. | Deterministic spending breakdown returned; daily spending marked `is_over_budget` against threshold. |
| **L1-UC-17** | Edit / Delete Transaction | User modifies or deletes an existing historical transaction. | End User | Authenticated session; transaction belongs to authenticated user. | Reversal-and-repost pattern executed atomically; balances reconciled; runway cache cleared. |
| **L1-UC-18** | View & Clear Chat History | User views paginated messages or clears omni-chat history. | End User | Authenticated session. | Chat history retrieved or cleared; underlying ledger transactions remain immutable. |

---

## Section 5: Level 2 (L2) Component Choreography Specifications

Every Level 2 specification defines the internal component choreography, strict preconditions, alternative flows, exception handling, postconditions, and system invariants using the Design-by-Contract (DbC) formalism.

---

### L2-UC-01: AI Chat Text to Ledger Mutation

```mermaid
sequenceDiagram
    autonumber
    actor User as End User
    participant Router as dashboard_router
    participant Limiter as RateLimiter
    participant DB as PostgreSQL Session
    participant Orch as AgentOrchestrator
    participant Agent as ReActAgent
    participant ExtAI as Gemini 2.5 Flash
    participant Ledger as LedgerService
    participant Runway as RunwayService

    User->>Router: POST /api/v1/dashboard/ai-chat {"message": "makan siang 25rb gopay"}
    Router->>Limiter: __call__(request) [sliding window check]
    Limiter-->>Router: Pass (OK)
    Router->>DB: ChatMessage(role="user", content=...)
    Router->>DB: commit()
    Router->>Orch: handle_message_async(user_id, text)
    Orch->>Orch: extract_entities_async()
    Orch->>Agent: aprocess_input(user_id, text)
    Agent->>ExtAI: POST generateContent (SYSTEM_PROMPT + text)
    ExtAI-->>Agent: JSON Candidate {"action": "expense", "amount": 25000, "account_name": "gopay", ...}
    Agent-->>Orch: Parsed entity dictionary
    Orch->>Orch: _execute_action(user_id, entities, text)
    Orch->>Orch: _resolve_account(user_id, "gopay")
    Orch->>Orch: _resolve_or_create_category(user_id, "Makanan", EXPENSE)
    Orch->>Ledger: record_expense(user_id, account_id, category_id, amount, ...)
    Ledger->>DB: SELECT * FROM accounts WHERE id=:id FOR UPDATE
    Ledger->>DB: UPDATE accounts SET current_balance = current_balance - 25000
    Ledger->>DB: INSERT INTO transactions, ledger_entries (DEBIT & CREDIT)
    Ledger->>Runway: clear_cache(user_id)
    Orch->>Runway: calculate_runway(user_id)
    Runway-->>Orch: RunwayReport(operational_free, daily_safe, days_remaining, ...)
    Orch->>DB: commit()
    Orch-->>Router: dict(reply, transaction_id, transaction, telemetry)
    Router->>DB: ChatMessage(role="assistant", content=reply, metadata_json=...)
    Router->>DB: commit()
    Router-->>User: EnrichedChatResponse
```

#### Design-by-Contract Specification

1. **Use Case ID & Name**: `L2-UC-01` — AI Chat Text → Ledger Mutation
2. **Primary Actor & Stakeholders**:
   - Primary: End User (Human via Web Dashboard)
   - Stakeholders: Personal Finance Manager (guaranteeing balanced accounts and zero math hallucinations)
3. **Trigger & Preconditions**:
   - Trigger: User submits a natural language message to `POST /api/v1/dashboard/ai-chat`.
   - Preconditions:
     - User is authenticated with a valid Bearer JWT (`current_user` resolved by `get_current_user`).
     - Request rate does not exceed `ai_chat_limiter` threshold (15 requests/minute).
     - User has at least one active `Account` record in the database.
4. **Main Success Scenario**:
   1. `dashboard_router.ai_chat_omni_input` receives `ChatRequest(message)`.
   2. Router instantiates and commits a new `ChatMessage(role="user", content=message, user_id=current_user.id)`.
   3. Router initializes `AgentOrchestrator(db=db, key_pool=key_pool)` and awaits `orchestrator.handle_message_async(user_id, text)`.
   4. Orchestrator calls `extract_entities_async(text, user_id=user_id)`.
   5. Orchestrator invokes `_resolve_agent_for_user(user_id)` to check for active BYOK configuration; defaults to system `ReActAgent`.
   6. `ReActAgent.aprocess_input` selects an active API key from `RotaryKeyPool` and invokes `_call_gemini_rest_async`.
   7. Google Gemini 2.5 Flash returns JSON candidate string containing structured intent (`action="expense"`, `amount=25000`, `account_name="gopay"`, `category_name="Makanan"`, `note="makan siang"`).
   8. `ReActAgent` parses JSON via `_clean_json_response`.
   9. Orchestrator evaluates `_execute_action` with parsed entities.
   10. `_resolve_account` queries `Account` matching name substring (`"gopay"`) under `current_user.id`.
   11. `_resolve_or_create_category` queries or creates `Category` under `current_user.id` with wildcard-sanitized name.
   12. Orchestrator invokes `LedgerService.record_expense(user_id, account_id, category_id, amount, description, source_channel="AI_AGENT", raw_input_text=text)`.
   13. `LedgerService` locks target account row using `.with_for_update()`, decrements `account.current_balance -= amount`, creates `Transaction` row, and creates paired `LedgerEntry` rows (`DEBIT` on category, `CREDIT` on account).
   14. `LedgerService` calls `RunwayService.clear_cache(user_id)`.
   15. Orchestrator calls `RunwayService.calculate_runway(user_id)` to re-evaluate telemetry deterministically.
   16. Orchestrator issues `db.commit()` and `db.refresh(account)`.
   17. Router instantiates and persists `ChatMessage(role="assistant", content=reply, transaction_id=tx.id, metadata_json=...)`.
   18. Router returns `EnrichedChatResponse` containing text reply, transaction summary, and live telemetry snapshot.
5. **Alternative Branches**:
   - **A1: Runway Status Inquiry**: If user message matches `"cek runway"`, `"runway"`, `"saldo"`, or `"status"`, `extract_entities_async` immediately returns `{"action": "query_runway"}` without invoking external LLMs. Orchestrator queries `RunwayService.calculate_runway(user_id)`, formats text response, and returns without mutating ledger.
   - **A2: Custom BYOK Routing**: If user has enabled custom AI in `UserSettings`, `_resolve_agent_for_user` decrypts the user's API key via `decrypt_key()` and routes the request to `BYOKAdapter` (OpenAI or Anthropic compatible).
   - **A3: Account Name Resolution Fallback**: If LLM entity extraction fails to identify an account name, `_resolve_account` falls back to the user's active account holding the highest `current_balance`.
6. **Exception Recovery**:
   - **E1: Rate Limit Exceeded (HTTP 429)**: `ai_chat_limiter` catches excessive requests, computes `retry_after` seconds, and raises `HTTPException(429, headers={"Retry-After": ...})`. No database transactions occur.
   - **E2: Gemini 429 / Quota Exhaustion**: `ReActAgent` catches 429 from Gemini REST call, reports rate limit to `RotaryKeyPool.report_rate_limit(key)`, and cycles to the next key. If all Gemini keys are exhausted, it invokes `_fallback_groq` via Groq Llama 4 Scout.
   - **E3: Ledger Mutation Failure**: If `amount <= 0` or database lock fails, `LedgerService` raises `ValueError`. Orchestrator catches exception, issues `db.rollback()`, and returns error reply `{"reply": "❌ Gagal mencatat pengeluaran: ...", "transaction_id": None}`.
7. **Postconditions**:
   - Success: `Transaction` and 2 `LedgerEntry` rows committed; `account.current_balance` decremented by exact `Decimal` amount; user and assistant `ChatMessage` rows saved; `_runway_cache` for user invalidated and rebuilt.
   - Failure: Database rolled back; account balance untouched; error message returned; no orphaned ledger records.
8. **System Invariants**:
   - Double-entry balance invariant: $\sum \text{Debit} = \sum \text{Credit} = \text{amount}$.
   - Multi-tenant boundary: all queries and mutations enforce `WHERE user_id = current_user.id`.
   - Zero LLM arithmetic: balance mutation is calculated exclusively by Python's `Decimal` subtraction.

---

### L2-UC-02: Receipt Image OCR to Ledger Mutation

```mermaid
sequenceDiagram
    autonumber
    actor User as End User
    participant Router as dashboard_router
    participant Limiter as RateLimiter
    participant DB as PostgreSQL Session
    participant Orch as AgentOrchestrator
    participant Agent as ReActAgent
    participant GeminiVis as Gemini Vision (2.5 Flash)
    participant GroqVis as Groq Vision (Llama 4 Scout)
    participant Ledger as LedgerService
    participant Runway as RunwayService

    User->>Router: POST /api/v1/dashboard/ai-receipt (Multipart File + Optional Caption)
    Router->>Limiter: __call__(request) [ai_receipt_limiter]
    Limiter-->>Router: Pass (OK)
    Router->>Router: Validate MIME type & Magic Bytes (JPEG/PNG/WebP, <= 10MB)
    Router->>DB: ChatMessage(role="user", content="Foto struk kasir", metadata_json={type: receipt})
    Router->>DB: commit()
    Router->>Orch: handle_message_async(user_id, text, image_bytes, mime_type)
    Orch->>Agent: aprocess_input(user_id, text, image_bytes, mime_type)
    alt Primary Gemini Vision
        Agent->>GeminiVis: POST generateContent (inline_data base64, SYSTEM_PROMPT)
        GeminiVis-->>Agent: JSON Candidate {"action": "expense", "amount": 154000, ...}
    else Gemini Vision 429 Fallback
        Agent->>GroqVis: POST chat/completions (data:image/...base64, SYSTEM_PROMPT)
        GroqVis-->>Agent: JSON Candidate {"action": "expense", "amount": 154000, ...}
    end
    Agent-->>Orch: Parsed receipt entities
    Orch->>Ledger: record_expense(user_id, account_id, category_id, amount, ...)
    Ledger->>DB: SELECT * FROM accounts WHERE id=:id FOR UPDATE
    Ledger->>DB: UPDATE accounts SET current_balance = current_balance - amount
    Ledger->>DB: INSERT INTO transactions, ledger_entries
    Ledger->>Runway: clear_cache(user_id)
    Orch->>Runway: calculate_runway(user_id)
    Orch->>DB: commit()
    Router->>DB: ChatMessage(role="assistant", content=reply, transaction_id=tx.id)
    Router->>DB: commit()
    Router-->>User: EnrichedChatResponse (OCR summary + telemetry)
```

#### Design-by-Contract Specification

1. **Use Case ID & Name**: `L2-UC-02` — Receipt Image OCR → Ledger Mutation
2. **Primary Actor & Stakeholders**:
   - Primary: End User (Human via Web Dashboard Upload)
   - Stakeholders: Auditing & Compliance (verifiable receipt linkage and exact amount extraction)
3. **Trigger & Preconditions**:
   - Trigger: User uploads image file to `POST /api/v1/dashboard/ai-receipt`.
   - Preconditions:
     - User authenticated with active JWT token.
     - Rate limit not exceeded on `ai_receipt_limiter` (5 requests/minute).
     - File binary $\le 10\text{MB}$ ($10 \times 1024 \times 1024$ bytes).
     - Header content-type in `{"image/jpeg", "image/png", "image/webp"}`.
4. **Main Success Scenario**:
   1. `dashboard_router.ai_receipt_upload` receives `UploadFile` and optional form string `message`.
   2. Router reads file bytes into memory and verifies magic header bytes:
      - JPEG: starts with `\xff\xd8\xff`
      - PNG: starts with `\x89PNG\r\n\x1a\n`
      - WebP: starts with `RIFF` and contains `WEBP` in the first 16 bytes.
   3. Router records `ChatMessage(role="user", content=message or "Foto struk kasir", metadata_json={"type": "receipt", "filename": file.filename})` and commits.
   4. Router instantiates `AgentOrchestrator(db, key_pool)` and calls `handle_message_async(user_id, text, image_bytes=content, mime_type=file.content_type)`.
   5. Orchestrator passes image bytes to `ReActAgent.aprocess_input`.
   6. `ReActAgent` encodes image bytes into Base64 and attaches them to `inline_data` in `_call_gemini_rest_async`.
   7. Gemini 2.5 Flash extracts vendor, grand total amount, inferred payment account, and primary expense category into strict JSON.
   8. Orchestrator executes `_execute_action`, matching account via `_resolve_account` and category via `_resolve_or_create_category`.
   9. `LedgerService.record_expense` locks account via `.with_for_update()`, updates `account.current_balance`, and writes double-entry records.
   10. `RunwayService.clear_cache(user_id)` invalidates stale runway calculations.
   11. `RunwayService.calculate_runway(user_id)` calculates updated post-purchase runway.
   12. Orchestrator commits database transaction; router saves assistant `ChatMessage` and returns `EnrichedChatResponse`.
5. **Alternative Branches**:
   - **A1: Groq Vision Failover**: If Gemini returns 429 (Resource Exhausted) or fails across all keys in `RotaryKeyPool`, `ReActAgent` formats the image as `data:{mime_type};base64,...` and dispatches `_call_groq_vision_rest_async` to Groq (`meta-llama/llama-4-scout-17b-16e-instruct`).
   - **A2: Custom BYOK Vision**: If user has custom BYOK configured, the image is passed to `BYOKAdapter.process_input`.
6. **Exception Recovery**:
   - **E1: Unsupported File Header / Corrupted Image**: Router raises `HTTPException(status_code=400, detail="Format file tidak didukung atau header file tidak valid.")`. No AI calls or database writes occur.
   - **E2: Unreadable Receipt / Blurred Image**: LLM returns `action="unknown"`. Orchestrator skips ledger mutation and returns a polite clarification request (`"Saya tidak dapat membaca rincian transaksi dari gambar tersebut..."`).
   - **E3: Database Lock Timeout**: If concurrent modifications lock the account, PostgreSQL transaction rolls back. Router returns failure message, leaving balances unchanged.
7. **Postconditions**:
   - Success: Immutable `Transaction` recorded with source channel `"AI_AGENT"`; account balance decremented; 2 balanced ledger entries created; telemetry snap returned.
   - Failure: Database rolled back; 0 balance modification; client receives 400 or explanatory error response.
8. **System Invariants**:
   - Maximum upload payload ceiling: strictly 10MB in-memory.
   - Receipt image bytes never persist in database tables directly (metadata stores only references/filenames).

---

### L2-UC-03: Telegram Voice Note to Ledger Mutation

```mermaid
sequenceDiagram
    autonumber
    actor User as End User (Telegram)
    participant TG as Telegram Bot API Cloud
    participant GatewayRouter as gateway_router
    participant Bot as TelegramGateway
    participant DB as PostgreSQL Session
    participant Orch as AgentOrchestrator
    participant Agent as ReActAgent
    participant GeminiAudio as Gemini 2.5 Flash (1-Hop Native Audio)
    participant GroqWhisper as Groq Whisper Large V3 (2-Hop STT)
    participant GroqLLM as Groq Llama 4 Scout (2-Hop LLM)
    participant Ledger as LedgerService

    User->>TG: Record & Send Voice Note (.ogg)
    TG->>GatewayRouter: POST /api/v1/gateway/telegram/webhook (Update JSON)
    GatewayRouter->>Bot: handle_update(update_dict)
    Bot->>Bot: Deduplicate update_id (in-memory 300s cache)
    Bot->>DB: SELECT * FROM users WHERE telegram_chat_id = :chat_id
    DB-->>Bot: User record found
    Bot->>TG: Download audio file bytes via voice_downloader(file_id)
    TG-->>Bot: Binary OGG audio bytes (<= 10MB)
    Bot->>Orch: handle_voice(user_id, audio_bytes, caption)
    Orch->>Agent: process_audio(audio_bytes, mime_type="audio/ogg")
    alt 1-Hop Native Audio (Gemini 2.5 Flash)
        Agent->>GeminiAudio: POST generateContent (AUDIO_SYSTEM_PROMPT + Audio Part)
        GeminiAudio-->>Agent: JSON {"transcription": "beli bensin 50 ribu mandiri", "action": "expense", ...}
    else 2-Hop Fallback (Gemini Fails / 429)
        Agent->>GroqWhisper: POST /audio/transcriptions (whisper-large-v3)
        GroqWhisper-->>Agent: Plaintext "beli bensin 50 ribu mandiri"
        Agent->>GroqLLM: POST /chat/completions (Llama 4 Scout + SYSTEM_PROMPT)
        GroqLLM-->>Agent: JSON {"action": "expense", "amount": 50000, ...}
    end
    Agent-->>Orch: Parsed entities + verbatim transcription
    Orch->>Ledger: record_expense(user_id, account_id, category_id, amount, ...)
    Ledger->>DB: Lock account, mutate balance, insert tx & ledger entries
    Orch->>DB: commit()
    Orch-->>Bot: dict(reply, transcription, transaction, telemetry)
    Bot-->>GatewayRouter: Formatted Markdown response string
    GatewayRouter-->>TG: HTTP 200 (Response text sent to chat)
    TG-->>User: Display transcription & runway confirmation
```

#### Design-by-Contract Specification

1. **Use Case ID & Name**: `L2-UC-03` — Telegram Voice Note → Ledger Mutation
2. **Primary Actor & Stakeholders**:
   - Primary: End User (Human via Telegram Mobile/Desktop App)
   - Stakeholders: System Reliability (handling transient webhook timeouts and non-standard audio encodings)
3. **Trigger & Preconditions**:
   - Trigger: Telegram Bot API delivers webhook `POST` containing `message.voice` or `message.audio` to `/api/v1/gateway/telegram/webhook`.
   - Preconditions:
     - Telegram webhook payload is valid JSON and contains `update_id` and `message.chat.id`.
     - In-memory deduplication check passes (`update_id` not processed within last 300 seconds).
     - Sender's `telegram_chat_id` is linked to an existing `User` record in PostgreSQL.
     - Audio file size is $\le 10\text{MB}$.
4. **Main Success Scenario**:
   1. `gateway_router.telegram_webhook` passes update dictionary to `TelegramGateway.handle_update`.
   2. `handle_update` verifies `update_id` against `_processed_update_ids` deduplication cache.
   3. Gateway extracts `chat.id` and verifies user pairing via `db.query(User).filter_by(telegram_chat_id=chat_id).first()`.
   4. Gateway extracts `file_id` from `message.voice` and invokes `self.voice_downloader(file_id)` to fetch binary bytes from Telegram cloud.
   5. Gateway calls `TelegramGateway.process_voice_message`, which delegates to `AgentOrchestrator.handle_voice(user_id, audio_bytes, caption)`.
   6. Orchestrator calls `ReActAgent.process_audio(audio_bytes, mime_type="audio/ogg", text_context=caption)`.
   7. **1-Hop Pipeline**: `ReActAgent` packages audio bytes into Gemini inline part with `AUDIO_SYSTEM_PROMPT` and dispatches to Gemini 2.5 Flash.
   8. Gemini 2.5 Flash simultaneously generates the verbatim Indonesian transcription and the structured entity JSON (`transcription="beli bensin 50 ribu mandiri"`, `action="expense"`, `amount=50000`, `account_name="mandiri"`, `category_name="Transport"`).
   9. Orchestrator resolves account via `_resolve_account` and category via `_resolve_or_create_category`.
   10. Orchestrator invokes `LedgerService.record_expense` with `source_channel="TELEGRAM_VOICE"`.
   11. Account balance is decremented; double-entry records are created; runway cache is cleared.
   12. Database transaction commits atomically.
   13. Gateway formats response with verbatim transcription header: `🎙️ Transkripsi: "beli bensin 50 ribu mandiri"\n\n✅ Tercatat: Rp 50,000 (Pengeluaran) via Mandiri...`.
   14. Webhook returns HTTP 200 with the formatted message string to Telegram.
5. **Alternative Branches**:
   - **A1: 2-Hop Audio Fallback**: If Gemini native audio call fails or returns 429 on all keys in `gemini_pool`, `ReActAgent` falls back to 2-hop execution:
     1. Dispatches audio bytes to Groq Whisper Large V3 (`_call_groq_whisper_rest_async`) with `language="id"`, receiving text transcription.
     2. Dispatches text transcription to Groq Llama 4 Scout (`_fallback_groq`) with `SYSTEM_PROMPT` to extract transaction entities.
     3. Merges transcription and entities, proceeding with standard ledger recording.
6. **Exception Recovery**:
   - **E1: Duplicate Webhook Delivery**: If `update_id` exists in `_processed_update_ids`, gateway returns `"Update sudah diproses sebelumnya (duplikat)."` immediately without reprocessing or double-charging.
   - **E2: Unlinked Telegram Account**: If `telegram_chat_id` has no matching user, gateway returns: `"Akun Telegram Anda belum terhubung ke rezekify. Silakan login ke Web Dashboard dan hubungkan akun dengan kode /link KODE."`
   - **E3: Garbled Audio / Inaudible Voice**: If transcription is empty and action is `"unknown"`, gateway returns: `"⚠️ Suara tidak terdengar jelas atau audio kosong. Silakan ulangi rekaman suara Anda."` No database records are written.
7. **Postconditions**:
   - Success: Double-entry expense committed; balance decremented; user receives confirmation message with verbatim transcription in Telegram chat.
   - Failure: Ledger untouched; error explanation sent to Telegram chat; webhook returns 200 (preventing Telegram cloud retry storm).
8. **System Invariants**:
   - Webhook idempotency: exactly-once processing guaranteed per Telegram `update_id` within 300s window.
   - Deterministic decimal math: LLM provides entity tokens; `LedgerService` calculates decimal balances.

---

### L2-UC-04: Transaction Update (Reversal-and-Repost Pattern)

```mermaid
sequenceDiagram
    autonumber
    actor User as End User
    participant Router as transactions_router
    participant DB as PostgreSQL Session
    participant Ledger as LedgerService
    participant Runway as RunwayService

    User->>Router: PUT /api/v1/transactions/{id} (amount, description, account_id, category_id)
    Router->>Ledger: update_transaction(user_id, id, amount, description, account_id, ...)
    Ledger->>DB: SELECT * FROM transactions WHERE id=:id AND user_id=:uid FOR UPDATE
    DB-->>Ledger: Return Transaction tx with existing ledger_entries
    Note over Ledger,DB: Step B: Reverse Previous Account Balances
    loop Each existing LedgerEntry in tx.ledger_entries
        Ledger->>DB: SELECT * FROM accounts WHERE id=entry.account_id FOR UPDATE
        alt entry.entry_type == CREDIT
            Ledger->>DB: UPDATE accounts SET current_balance = current_balance + entry.amount
        else entry.entry_type == DEBIT
            Ledger->>DB: UPDATE accounts SET current_balance = current_balance - entry.amount
        end
    end
    Note over Ledger,DB: Step C & D: Validate New Entities & Apply New Mutations
    Ledger->>DB: SELECT * FROM accounts WHERE id=:new_account_id FOR UPDATE
    Ledger->>DB: UPDATE accounts SET current_balance = current_balance - new_amount
    Note over Ledger,DB: Step E: Purge Historical Entries & Insert New Entries
    Ledger->>DB: DELETE FROM ledger_entries WHERE transaction_id = tx.id
    Ledger->>DB: INSERT INTO ledger_entries (DEBIT Category, CREDIT Account)
    Note over Ledger,DB: Step F: Update Metadata & Clear Cache
    Ledger->>DB: UPDATE transactions SET description=:desc, transaction_date=:date
    Ledger->>Runway: clear_cache(user_id)
    Ledger->>DB: commit()
    Router-->>User: Updated Transaction Response (200 OK)
```

#### Design-by-Contract Specification

1. **Use Case ID & Name**: `L2-UC-04` — Transaction Update (Reversal-and-Repost)
2. **Primary Actor & Stakeholders**:
   - Primary: End User (via Manual Transaction Edit Dialog)
   - Stakeholders: Financial Auditors (maintaining complete accounting integrity without balance drift)
3. **Trigger & Preconditions**:
   - Trigger: User submits modified transaction data to `PUT /api/v1/transactions/{id}`.
   - Preconditions:
     - User is authenticated with active JWT token (`current_user.id`).
     - Target `transaction_id` exists and is owned by `current_user.id`.
     - New `amount` is strictly greater than zero ($> 0$).
     - Target `account_id` exists and is owned by `current_user.id`.
4. **Main Success Scenario**:
   1. `transactions_router.update_transaction` receives transaction payload and invokes `LedgerService(db).update_transaction(...)`.
   2. **Step A (Locate & Lock)**: `LedgerService` queries `Transaction` filtering by `id == transaction_id` and `user_id == user_id`.
   3. **Step B (Reversal Phase)**: For each existing `LedgerEntry` linked to the transaction:
      - If `entry.account_id` is set, `Account` is queried `.with_for_update()`.
      - If `entry.entry_type == CREDIT`, balance is restored: `acc.current_balance += entry.amount`.
      - If `entry.entry_type == DEBIT`, balance is reversed: `acc.current_balance -= entry.amount`.
   4. **Step C (Type Determination)**: Service verifies whether transaction is `EXPENSE`, `INCOME`, or `TRANSFER` based on original or explicit type parameter.
   5. **Step D (Mutation Phase)**:
      - For `EXPENSE`: locks new `Account` via `.with_for_update()`, verifies new `Category`, and subtracts new amount: `new_acc.current_balance -= amount`. Prepares new `DEBIT` entry for category and `CREDIT` entry for account.
      - For `INCOME`: locks new `Account`, adds new amount: `new_acc.current_balance += amount`. Prepares new `DEBIT` entry for account and `CREDIT` entry for category.
      - For `TRANSFER`: locks both source and destination accounts using ordered UUID locking (preventing deadlocks); decrements source, increments destination.
   6. **Step E (Ledger Purge & Re-post)**: Service deletes all old `LedgerEntry` records belonging to the transaction (`db.delete(old_entry)`) and flushes. Then adds all replacement balanced `LedgerEntry` records via `db.add_all(new_entries)`.
   7. **Step F (Metadata Update)**: Updates `tx.description` and optional `tx.transaction_date`.
   8. Service invokes `RunwayService.clear_cache(user_id=user_id)` and commits the transaction.
   9. Router returns updated transaction schema with refreshed balances.
5. **Alternative Branches**:
   - **A1: Type Transition (Expense to Transfer)**: If transaction type changes, service validates that both `from_account_id` and `to_account_id` are provided, distinct, and owned by user before posting new entries.
6. **Exception Recovery**:
   - **E1: Cross-Tenant Tampering**: If user attempts to update a transaction belonging to another user, `filter_by(id=transaction_id, user_id=user_id).one()` raises `NoResultFound`. Service maps this to `404 Not Found`.
   - **E2: Negative or Zero Amount**: If `amount <= 0`, service raises `ValueError("Amount must be positive.")`. Router catches and returns HTTP 400.
   - **E3: Inactive or Missing Target Account**: If target account does not belong to user, service raises `ValueError("Account not found or access denied.")`. Database session rolls back; prior balances remain exactly as they were.
7. **Postconditions**:
   - Success: Historical ledger entries deleted; new balanced ledger entries created; account balances accurately reflect reversal plus re-post; `_runway_cache` evicted.
   - Failure: Database rolled back; account balances restored to original values; no partial ledger modifications.
8. **System Invariants**:
   - Atomicity: Reversal and re-post occur inside a single ACID database transaction.
   - Zero Drift: Sum of all account balances in the system equals net initial balances + total income - total expenses at all times.

---

### L2-UC-05: Dynamic Runway Calculation & Health Evaluation

```mermaid
sequenceDiagram
    autonumber
    actor User as End User
    participant Router as dashboard_router
    participant Runway as RunwayService
    participant Cache as In-Memory TTL Cache
    participant DB as PostgreSQL Session

    User->>Router: GET /api/v1/dashboard/summary
    Router->>Runway: calculate_runway(user_id, today, use_cache=True)
    Runway->>Runway: Lazy sweep expired cache entries (every 60s)
    Runway->>Cache: Lookup (user_id, today)
    alt Cache Hit (< 15s old)
        Cache-->>Runway: Cached RunwayReport
        Runway-->>Router: Cached RunwayReport
    else Cache Miss / Expired
        Runway->>DB: SELECT * FROM users WHERE id = :user_id
        DB-->>Runway: user (monthly_cycle_day, safe_runway_threshold)
        Runway->>DB: SELECT COALESCE(SUM(current_balance), 0) FROM accounts WHERE user_id=:uid AND account_type IN ('CASH', 'BANK', 'EWALLET')
        DB-->>Runway: liquid_sum
        Runway->>DB: SELECT COALESCE(SUM(allocated_amount), 0) FROM vaults WHERE user_id=:uid AND is_locked = TRUE
        DB-->>Runway: vault_sum
        Runway->>Runway: operational_free = MAX(0, liquid_sum - vault_sum)
        Runway->>Runway: Calculate days_remaining to effective monthly_cycle_day (via monthrange)
        Runway->>Runway: daily_safe = (operational_free / days_remaining).quantize(0.01)
        Runway->>Runway: Determine health_status (CRITICAL, WARNING, HEALTHY)
        Runway->>DB: SELECT * FROM vaults WHERE user_id=:uid AND vault_type='FIXED_BILL' AND allocated < target AND target_date BETWEEN today AND today+7
        DB-->>Runway: List of upcoming bills
        Runway->>Cache: Store (user_id, today) -> (RunwayReport, timestamp)
        Runway-->>Router: Fresh RunwayReport
    end
    Router-->>User: DashboardSummaryResponse (200 OK)
```

#### Design-by-Contract Specification

1. **Use Case ID & Name**: `L2-UC-05` — Runway Calculation & Health Evaluation
2. **Primary Actor & Stakeholders**:
   - Primary: End User (via Web Dashboard Home View)
   - Stakeholders: Product Owner (enforcing the core daily safe spending invariant)
3. **Trigger & Preconditions**:
   - Trigger: User navigates to dashboard or calls `GET /api/v1/dashboard/summary`.
   - Preconditions:
     - User is authenticated with active JWT token.
     - User entity exists with valid `monthly_cycle_day` ($1 \le d \le 31$) and `safe_runway_threshold`.
4. **Main Success Scenario**:
   1. `dashboard_router.get_dashboard_summary` calls `RunwayService(db).calculate_runway(current_user.id)`.
   2. `RunwayService` performs amortized cache cleanup: if `now - _last_runway_sweep > 60.0` or cache size $\ge 5000$, evicts expired keys.
   3. Service checks in-memory `_runway_cache` for key `(user_id, today)`. If present and age $< 15.0$ seconds, immediately returns cached `RunwayReport`.
   4. On cache miss, service queries `User` table for `monthly_cycle_day` and `safe_runway_threshold`.
   5. Service computes `liquid_sum` via SQL aggregate:
      ```sql
      SELECT COALESCE(SUM(current_balance), 0.00)
      FROM accounts
      WHERE user_id = :uid AND account_type IN ('CASH', 'BANK', 'EWALLET')
      ```
   6. Service computes locked reserves `vault_sum` via SQL aggregate:
      ```sql
      SELECT COALESCE(SUM(allocated_amount), 0.00)
      FROM vaults
      WHERE user_id = :uid AND is_locked = TRUE
      ```
   7. Service computes operational free cash: $\text{operational\_free} = \max(0.00, \text{liquid\_sum} - \text{vault\_sum})$.
   8. Service calculates `days_remaining` until the user's monthly cycle reset:
      - Uses `calendar.monthrange(year, month)` to cap `cycle_day` to maximum days in current month (`effective_cycle_day`).
      - If `today.day < effective_cycle_day`, $\text{days\_remaining} = \text{effective\_cycle\_day} - \text{today.day}$.
      - Otherwise, calculates days remaining in current month plus effective cycle day of the subsequent month.
      - Enforces minimum boundary: $\text{days\_remaining} \ge 1$.
   9. Service computes deterministic daily safe runway:
      $$\text{daily\_safe} = \left(\frac{\text{operational\_free}}{\text{days\_remaining}}\right).\text{quantize}(\text{Decimal}("0.01"))$$
   10. Evaluates health status against user threshold:
       - If $\text{operational\_free} \le 0.00 \implies \text{"CRITICAL"}$.
       - Else if $\text{daily\_safe} < \text{safe\_runway\_threshold} \implies \text{"WARNING"}$.
       - Else $\implies \text{"HEALTHY"}$.
   11. Queries upcoming bills via `get_upcoming_bills(user_id, today)`: retrieves vaults where `vault_type == 'FIXED_BILL'`, `allocated_amount < target_amount`, `target_date >= today`, and $(target\_date - today) \le 7\text{ days}$.
   12. Constructs `RunwayReport`, writes to `_runway_cache[(user_id, today)] = (report, now)`, and returns report.
   13. Router transforms into `DashboardSummaryResponse` and sends HTTP 200.
5. **Alternative Branches**:
   - **A1: Negative Free Cash (Locked Vault Overhang)**: If `vault_sum > liquid_sum`, `operational_free` evaluates to exactly `Decimal("0.00")` via `max()`, preventing negative daily allowances. Health status evaluates to `"CRITICAL"`.
6. **Exception Recovery**:
   - **E1: Missing User Record**: `db.query(User).filter_by(id=user_id).one()` raises `NoResultFound`. Router converts to HTTP 404.
7. **Postconditions**:
   - Success: Deterministic report returned; cache entry refreshed; zero database mutations.
   - Failure: HTTP error returned; no cache pollution.
8. **System Invariants**:
   - Deterministic Decimal Precision: All monetary math uses `decimal.Decimal` with 2 decimal places (`0.01`). Floating point arithmetic is prohibited.
   - Commitment Containment: Locked vault reserves are strictly non-spendable; they never contribute to `operational_free_cash`.

---

### L2-UC-06: Telegram Bot Secure Account Pairing

```mermaid
sequenceDiagram
    autonumber
    actor User as End User (Web & Telegram)
    participant WebRouter as auth_router
    participant AuthSvc as AuthService
    participant DB as PostgreSQL Session
    participant BotAPI as Telegram Bot API Cloud
    participant GatewayRouter as gateway_router
    participant BotGateway as TelegramGateway

    User->>WebRouter: POST /api/v1/auth/telegram-pairing-code
    WebRouter->>AuthSvc: generate_telegram_pairing_code(current_user.id)
    AuthSvc->>AuthSvc: Loop up to 5x: candidate = "DK-" + random base32(6)
    AuthSvc->>DB: Check active collision (telegram_pairing_code == candidate AND expires_at > now)
    AuthSvc->>DB: Clean up stale expired records with candidate
    AuthSvc->>DB: UPDATE users SET telegram_pairing_code=:code, pairing_code_expires_at = now() + 15 min
    AuthSvc->>DB: commit()
    AuthSvc-->>WebRouter: "DK-W7K9M2"
    WebRouter-->>User: {"pairing_code": "DK-W7K9M2", "expires_in_minutes": 15}

    Note over User,BotGateway: User opens Telegram and sends "/link DK-W7K9M2"
    User->>BotAPI: Send "/link DK-W7K9M2"
    BotAPI->>GatewayRouter: POST /api/v1/gateway/telegram/webhook (update JSON)
    GatewayRouter->>BotGateway: handle_update() -> process_text_message(chat_id, text)
    BotGateway->>BotGateway: Check brute-force attempts (< 5 fails in 15 min for chat_id)
    BotGateway->>AuthSvc: link_telegram_chat_id(telegram_chat_id=chat_id, pairing_code="DK-W7K9M2")
    AuthSvc->>DB: SELECT * FROM users WHERE telegram_pairing_code = :code AND pairing_code_expires_at > now()
    DB-->>AuthSvc: User record found
    AuthSvc->>DB: Unlink old user if chat_id was previously claimed
    AuthSvc->>DB: UPDATE users SET telegram_chat_id=:chat_id, telegram_pairing_code=NULL, pairing_code_expires_at=NULL
    AuthSvc->>DB: commit()
    AuthSvc-->>BotGateway: User linked successfully
    BotGateway-->>GatewayRouter: Welcome message string
    GatewayRouter-->>BotAPI: HTTP 200 (Success text)
    BotAPI-->>User: "🎉 Selamat datang Grant! Akun rezekify Anda berhasil terhubung..."
```

#### Design-by-Contract Specification

1. **Use Case ID & Name**: `L2-UC-06` — Telegram Bot Secure Account Pairing
2. **Primary Actor & Stakeholders**:
   - Primary: End User (initiating via Web, completing via Telegram)
   - Stakeholders: Security & Multi-Tenancy (preventing chat hijacking and unauthorized account linkage)
3. **Trigger & Preconditions**:
   - Trigger: User clicks "Dapatkan Kode Pairing" on Web Settings page, then sends `/link DK-XXXXXX` to the Telegram bot.
   - Preconditions:
     - User has an active authenticated web session.
     - Telegram user possesses a unique `chat_id`.
4. **Main Success Scenario**:
   1. User calls `POST /api/v1/auth/telegram-pairing-code`.
   2. `AuthService.generate_telegram_pairing_code(user_id)` generates candidate code: prefix `"DK-"` followed by 6 cryptographic base32 characters from alphabet `"23456789ABCDEFGHJKLMNPQRSTUVWXYZ"` (avoiding ambiguous characters 0, 1, I, O).
   3. Service checks collision loop against active unexpired codes (`pairing_code_expires_at > now`).
   4. Stale expired records holding the same code are sanitized (`telegram_pairing_code = None`).
   5. Code is assigned to user with `pairing_code_expires_at = now + timedelta(minutes=15)` and committed.
   6. Web client receives code and displays 1-click deep link: `https://t.me/rezekify_bot?start=DK-XXXXXX`.
   7. User opens bot and sends `/start DK-XXXXXX` or `/link DK-XXXXXX`.
   8. Telegram delivers webhook to `TelegramGateway.process_text_message`.
   9. Gateway checks in-memory `failed_pairing_attempts[chat_id]`: if $\ge 5$ failed attempts in the last 15 minutes, rejects with rate limit warning.
   10. Gateway invokes `AuthService.link_telegram_chat_id(chat_id, pairing_code)`.
   11. `AuthService` queries `User` matching code and verifies `pairing_code_expires_at > now()`.
   12. If `chat_id` was previously linked to another user, cleanly unlinks the old user (`existing.telegram_chat_id = None`).
   13. Assigns `user.telegram_chat_id = chat_id`, nullifies `user.telegram_pairing_code` and `user.pairing_code_expires_at` (one-time consumption), and commits.
   14. Bot clears `failed_pairing_attempts[chat_id]` and sends personalized confirmation message to the Telegram chat.
5. **Alternative Branches**:
   - **A1: Direct Unlink from Web**: User clicks "Putuskan Koneksi Telegram" (`POST /api/v1/settings/telegram/unlink`). Backend sets `user.telegram_chat_id = None`, immediately terminating bot webhook access for that chat.
6. **Exception Recovery**:
   - **E1: Expired or Invalid Pairing Code**: `link_telegram_chat_id` raises `ValueError("Kode pairing tidak valid atau telah kedaluwarsa.")`. Gateway logs attempt timestamp in `failed_pairing_attempts[chat_id]` and returns error message to user.
   - **E2: Brute-Force Rate Limiting**: If 5 failed attempts occur within 15 minutes for a `chat_id`, gateway rejects further attempts with: `"❌ Terlalu banyak percobaan gagal. Silakan coba lagi dalam 15 menit."`
7. **Postconditions**:
   - Success: `User.telegram_chat_id` set; pairing code destroyed; Telegram bot immediately ready to accept voice, text, and receipt transactions.
   - Failure: Database untouched; failed attempt counter incremented; user informed of rejection.
8. **System Invariants**:
   - Single-use entropy: pairing code is destroyed upon successful link or after 15 minutes.
   - Bijective constraint: one Telegram `chat_id` links to at most one Rezekify user at any given time.

---

## Section 6: Level 3 (L3) Sub-Marine Microprocesses

Level 3 specifications document the physical byte layouts, transport wire protocols, cryptographic derivation routines, database indexes, and memory algorithms executing beneath the service layer.

---

### L3-01: Gemini REST API Call Wire Payload

When `ReActAgent._call_gemini_rest_async` executes multimodal or text extraction, it formats an outbound HTTPS request directly to the Google Generative Language REST endpoint.

#### Protocol Specification
- **Method & URL**: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}`
- **Headers**:
  ```http
  Content-Type: application/json
  Accept: application/json
  User-Agent: Rezekify-Agent/1.0
  ```
- **Timeout**: `20.0` seconds (via `httpx.AsyncClient`)

#### Outbound JSON Request Body
```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Anda adalah asisten cerdas pencatatan keuangan Rezekify.\nTugas Anda adalah mengekstrak entitas transaksi keuangan dari teks atau struk belanja pengguna.\n\nEkstrak informasi menjadi JSON murni dengan skema berikut:\n{\n  \"action\": \"expense\" | \"income\" | \"transfer\" | \"query_runway\" | \"unknown\",\n  \"amount\": number (nominal transaksi positif, tanpa titik/koma),\n  \"account_name\": string (nama akun/metode pembayaran misal BCA, GoPay, Cash),\n  \"category_name\": string (kategori misal Makanan, Transport, Belanja),\n  \"note\": string (deskripsi singkat barang/keperluan),\n  \"from_account\": string (hanya untuk transfer),\n  \"to_account\": string (hanya untuk transfer)\n}\nHanya kembalikan JSON valid tanpa teks pengantar atau markdown blocks."
        },
        {
          "text": "Input pengguna: makan siang padang 28rb bayar gopay"
        },
        {
          "inline_data": {
            "mime_type": "image/jpeg",
            "data": "/9j/4AAQSkZJRgABAQEASABIAAD/2wBD..."
          }
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.1,
    "responseMimeType": "application/json"
  }
}
```

#### Inbound JSON Response Parsing
```python
# rezekify/agent/runtime.py line 372-374
data = resp.json()
candidate_text = data["candidates"][0]["content"]["parts"][0]["text"]
return self._clean_json_response(candidate_text)
```

---

### L3-02: Groq Whisper STT Wire Payload

When audio transcription falls back to Groq Whisper (`_call_groq_whisper_rest_async` or `transcribe_audio`), the runtime sends a multipart/form-data POST request.

#### Protocol Specification
- **Method & URL**: `POST https://api.groq.com/openai/v1/audio/transcriptions`
- **Headers**:
  ```http
  Authorization: Bearer gsk_sampleGroqApiKeyString123456789
  Accept: application/json
  ```
- **Content-Type**: `multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW`

#### Multipart Form Body
```http
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="voice.ogg"
Content-Type: audio/ogg

[BINARY AUDIO BYTES: OggS... Vorbis/Opus stream]
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="model"

whisper-large-v3
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="language"

id
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="temperature"

0.0
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

#### Inbound JSON Response
```json
{
  "text": "beli kopi kenangan 22 ribu pake bca"
}
```

---

### L3-03: JWT Token Structure & Cookie Specification

Authentication is enforced using JSON Web Tokens (JWT) signed via HMAC-SHA256 (`HS256`).

#### 1. Short-Lived Access Token (Returned in JSON Response Body)
- **Header**:
  ```json
  {
    "alg": "HS256",
    "typ": "JWT"
  }
  ```
- **Payload**:
  ```json
  {
    "sub": "b2f63812-7dc2-4809-9488-812e9b05423f",
    "email": "user@example.com",
    "type": "access",
    "exp": 1727827200
  }
  ```
- **Expiration**: 30 minutes (`settings.ACCESS_TOKEN_EXPIRE_MINUTES = 30`).
- **Transmission**: Sent by Web SPA in `Authorization: Bearer <token>` header.

#### 2. Long-Lived Refresh Token (Stored in HttpOnly Cookie)
- **Payload**:
  ```json
  {
    "sub": "b2f63812-7dc2-4809-9488-812e9b05423f",
    "email": "user@example.com",
    "type": "refresh",
    "exp": 1728432000
  }
  ```
- **Expiration**: 7 days (`settings.REFRESH_TOKEN_EXPIRE_DAYS = 7`).
- **Set-Cookie Header Format**:
  ```http
  Set-Cookie: refresh_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Max-Age=604800; Path=/api/v1/auth; HttpOnly; SameSite=Lax
  ```
- **Security Attributes**: `HttpOnly` prevents XSS extraction; `SameSite=Lax` prevents CSRF attacks; `Path=/api/v1/auth` restricts cookie transmission strictly to token refresh and logout endpoints.

---

### L3-04: Fernet Key Encryption Wire Format

User-provided Bring-Your-Own-Key (BYOK) API credentials are never stored in plaintext. They are encrypted using symmetric Fernet encryption derived deterministically from the master application secret.

#### 1. Key Derivation Function (PBKDF2-HMAC-SHA256)
```python
# rezekify/core/crypto.py lines 33-35
secret_bytes = settings.SECRET_KEY.encode("utf-8")
PBKDF2_SALT = b"rezekify-fernet-derivation-v1"
PBKDF2_ITERATIONS = 600_000

derived = hashlib.pbkdf2_hmac("sha256", secret_bytes, PBKDF2_SALT, PBKDF2_ITERATIONS)
modern_fernet_key = base64.urlsafe_b64encode(derived)
```

#### 2. Legacy Fallback Derivation (For Backward Compatibility)
```python
# rezekify/core/crypto.py lines 38-39
legacy_digest = hashlib.sha256(secret_bytes).digest()
legacy_fernet_key = base64.urlsafe_b64encode(legacy_digest)
```

#### 3. Fernet Token Binary Structure
A Fernet ciphertext token is a URL-safe Base64-encoded string representing the following sequential binary packet:

```
┌───────────────┬─────────────────┬──────────────────┬──────────────────────┬────────────────────┐
│ Version (1 B) │ Timestamp (8 B) │ IV / Salt (16 B) │ Ciphertext (Var Len) │ HMAC Digest (32 B) │
│     0x80      │ Big-endian int  │ AES-CBC Random IV│ AES-128-CBC Encrypted│ HMAC-SHA256 of all │
│               │ 64-bit seconds  │ 128-bit          │ PKCS#7 padded data   │ preceding bytes    │
└───────────────┴─────────────────┴──────────────────┴──────────────────────┴────────────────────┘
```

#### 4. Decryption Fallback Algorithm
```python
# rezekify/core/crypto.py lines 65-75
try:
    return modern_f.decrypt(cleaned).decode("utf-8")
except (InvalidToken, Exception):
    pass

try:
    return legacy_f.decrypt(cleaned).decode("utf-8")
except (InvalidToken, Exception) as e:
    raise ValueError("Failed to decrypt API key: invalid ciphertext or signature mismatch.") from e
```

---

### L3-05: Database Index Schema & Physical Storage

To guarantee sub-10ms query execution across multi-tenant ledger aggregations and runway computations, PostgreSQL indexes are defined in `rezekify/db/models.py`.

| Table | Index Name | Indexed Columns | Index Type | Architectural Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `transactions` | `idx_transactions_user_date` | `(user_id, transaction_date)` | B-Tree (Composite) | Accelerates date-range queries for daily/monthly spending breakdown (`WHERE user_id = :uid AND transaction_date BETWEEN :s AND :e`). |
| `vaults` | `idx_vaults_user_due` | `(user_id, target_date)` | B-Tree (Composite) | Optimizes upcoming bill discovery within 7-day window (`WHERE user_id = :uid AND target_date >= today`). |
| `ledger_entries` | `idx_ledger_account_type` | `(account_id, entry_type)` | B-Tree (Composite) | Optimizes double-entry balance verification and per-account transaction reconciliations. |
| `ledger_entries` | `idx_ledger_category_type` | `(category_id, entry_type)` | B-Tree (Composite) | Speeds up category-level spending aggregations in monthly analytics queries. |
| `chat_messages` | `idx_chat_messages_user_created`| `(user_id, created_at)` | B-Tree (Composite) | Accelerates paginated chat history retrieval with ascending chronological ordering. |
| `users` | `users_email_key` | `(email)` | B-Tree (Unique) | O(1) user credential lookup during authentication. |
| `users` | `users_telegram_chat_id_key` | `(telegram_chat_id)` | B-Tree (Unique) | O(1) user identification on inbound Telegram webhook updates. |
| `users` | `users_telegram_pairing_code_key`| `(telegram_pairing_code)` | B-Tree (Unique) | Rapid lookup of expiring pairing codes during Telegram account link. |
| `accounts` | `ix_accounts_user_id` | `(user_id)` | B-Tree (Single) | Enforces fast tenant isolation when querying all accounts owned by user. |
| `vaults` | `ix_vaults_user_id` | `(user_id)` | B-Tree (Single) | Enforces fast tenant isolation for locked vault sum calculations. |
| `categories` | `ix_categories_user_id` | `(user_id)` | B-Tree (Single) | Speeds up user-scoped category listing and autocomplete resolution. |
| `transactions` | `ix_transactions_user_id` | `(user_id)` | B-Tree (Single) | Enforces tenant isolation on manual transaction listings. |
| `ledger_entries`| `ix_ledger_entries_transaction_id`| `(transaction_id)` | B-Tree (Single) | Speeds up foreign key cascading and transaction reversal lookups. |
| `ledger_entries`| `ix_ledger_entries_user_id` | `(user_id)` | B-Tree (Single) | Enforces tenant scoping across low-level ledger audit trails. |
| `user_settings` | `ix_user_settings_user_id` | `(user_id)` | B-Tree (Unique) | O(1) retrieval of BYOK keys and tenant AI configuration. |

---

### L3-06: Rate Limiter Sliding Window Algorithm

To prevent free-tier API quota exhaustion and defend against denial-of-service, `rezekify/core/rate_limit.py` implements an in-memory sliding-window algorithm backed by high-precision monotonic timestamps.

#### Algorithmic Execution Steps
1. **Key Derivation**:
   - Inspects `Authorization: Bearer <token>` header.
   - If valid JWT present $\implies$ extracts `sub` claim and forms key `user:{uuid}`.
   - Else $\implies$ falls back to client IP: `ip:{request.client.host}`.
2. **Current Timestamp**: Obtains high-resolution timestamp `now = time.monotonic()` (immune to system wall-clock adjustments).
3. **Boundary Calculation**: `boundary = now - window_seconds` (e.g. `now - 60.0`).
4. **Amortized Periodic Sweep**:
   - If `len(_history) > max_tracked_keys` ($5,000$) or `now - _last_sweep > window_seconds`:
     - Iterates through dictionary, popping timestamps $\le boundary$ from the left of each key's `collections.deque`.
     - Evicts empty keys.
     - If still over capacity, evicts oldest excess keys in batches.
5. **O(1) Active Queue Pruning**:
   - Fetches `deque` for active key: `q = self._history[key]`.
   - Pops expired timestamps from left:
     ```python
     while q and q[0] <= boundary:
         q.popleft()
     ```
6. **Limit Evaluation**:
   - If `len(q) >= max_requests`:
     - Calculates dynamic retry delay:
       $$\text{retry\_after} = \max(1, \lceil \text{window\_seconds} - (\text{now} - q[0]) \rceil)$$
     - Raises `fastapi.HTTPException(status_code=429, detail=..., headers={"Retry-After": str(retry_after)})`.
   - Else:
     - Appends current timestamp: `q.append(now)`.
     - Request proceeds to route handler.
