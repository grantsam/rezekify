# Rezekify — Dynamic Interaction Flows & Sequence Specifications

**Document ID:** ARCH-004 | **Version:** 1.0.0 | **Framework:** Concurrency Models, Sequence Diagrams & FSM  
**Target Environment:** Docker Compose (PostgreSQL 16 + FastAPI + Nginx) | **Status:** Active  

---

## Section 1: Master Dynamic Architecture Overview

### 1.1 Ingress-to-Egress Bus Topology

Rezekify handles multi-modal ingress traffic from two primary entry points: web clients operating a single-page React 18 interface, and automated webhooks dispatched by the Telegram Bot API platform. Ingress, mediation, persistence, and external model egress are structured according to the topology below:

```
                        ┌─────────────────────────────────────────────────────────────┐
  End User (SPA) ──HTTPS──► │ Nginx :80 (Container: rezekify-nginx)                     │
  [Browser Fetch / SPA] │   ├─ Static Assets (/usr/share/nginx/html)                  │
                        │   └─ /api/v1/* ──reverse proxy──►                           │
                        │                                                             │
  Telegram API ──POST──► │ Uvicorn :8000 (2 workers, asyncio, rezekify-backend)       │
  [/gateway/telegram]   │   ├─ Async Handlers (FastAPI Event Loop)                    │
                        │   │   ├─ POST /dashboard/ai-chat                            │
                        │   │   ├─ POST /dashboard/ai-receipt                         │
                        │   │   └─ POST /dashboard/ai-voice                           │
                        │   │        │                                                │
                        │   │        └──httpx.AsyncClient (timeout=20.0s)──►          │
                        │   │             ├─ Google Gemini 2.5 Flash REST API         │
                        │   │             ├─ Groq Whisper & Llama Vision REST API     │
                        │   │             └─ User Custom BYOK Endpoint (SSRF Guarded) │
                        │   │                                                         │
                        │   ├─ Sync Handlers (FastAPI Threadpool Worker Threads)      │
                        │   │   ├─ POST /gateway/telegram (Telegram webhook)          │
                        │   │   │    └──google-genai SDK / groq SDK (Blocking)        │
                        │   │   ├─ CRUD (/accounts, /vaults, /transactions, /auth)    │
                        │   │   └─ In-Memory State (Process-Local RAM):               │
                        │   │        ├─ _runway_cache (TTL 15s, Max 5000)             │
                        │   │        ├─ RateLimiter._history (Deques, Max 5000)       │
                        │   │        ├─ _processed_update_ids (Dedup, Max 10000)      │
                        │   │        ├─ TelegramGateway.failed_pairing_attempts       │
                        │   │        └─ RotaryKeyPool.cooldowns (Epoch Timestamps)    │
                        │   │                                                         │
                        │   └─ SQLAlchemy Session (psycopg2 sync driver) ──►          │
                        │        pool_size=3, max_overflow=2, pool_recycle=1800s     │
                        │        pool_pre_ping=True, pool_timeout=10s                 │
                        │                                                             │
                        │ PostgreSQL 16 :5432 (Container: rezekify-db)               │
                        │   max_connections=30 (Dedicated Storage Engine)             │
                        └─────────────────────────────────────────────────────────────┘
```

### 1.2 Synchronous vs Asynchronous Message Boundaries

The system intentionally segregates operations across asynchronous non-blocking event loops, synchronous threadpools, and transactional database boundaries to maximize throughput while guaranteeing absolute double-entry accounting integrity.

| Boundary | Sync / Async | Underlying Mechanism | Timeout / Limits | Purpose & Fail-Safe Invariants |
| :--- | :--- | :--- | :--- | :--- |
| **Browser SPA → Nginx** | Async | HTTP/1.1 over TCP / TLS | Keep-Alive 65s | Static React bundle delivery and reverse proxy ingress forwarding. |
| **Nginx → Uvicorn** | Async | HTTP reverse proxy pass | `proxy_read_timeout 90s` | Buffers incoming client uploads; supports long-running multi-modal inference. |
| **Browser → apiClient** | Async | Fetch API (`AbortController`) | Default: 90s, Refresh: 15s | Protects client UI against hanging network states; aborts stale telemetry. |
| **Route Handler → Database** | Sync | SQLAlchemy `SessionLocal` via `psycopg2` | `pool_timeout=10s`, `statement_timeout` | Executes in threadpool; strict row locking via `with_for_update()`. |
| **Async Routes → Gemini / Groq** | Async | `httpx.AsyncClient` | `timeout=20.0s` | Non-blocking LLM/Vision/STT requests without stalling Uvicorn event loop. |
| **Sync Routes → Gemini / Groq** | Sync | `google-genai` / `groq` SDK | SDK Network Default | Runs inside threadpool for Telegram webhook processing. |
| **FastAPI Startup → PostgreSQL** | Sync | `sqlalchemy.engine.connect()` retry loop | 30 attempts × 2.0s delay | Prevents application crash loops during Docker container orchestration boot. |
| **Frontend Token Refresh** | Async | Singleton Promise Pattern | `timeout=15.0s` | De-duplicates concurrent 401 token refresh requests into a single flight. |

---

## Section 2: Exhaustive Sequence Diagrams

### SD-01: User Registration & First Login

This sequence captures full user onboarding: form submission, input validation, bcrypt password hashing, double token emission (short-lived access token and HttpOnly refresh cookie), and redirection to the application dashboard.

```mermaid
sequenceDiagram
    autonumber
    actor User as End User
    participant Browser as Browser UI
    participant AuthPage as AuthPage.tsx
    participant apiClient as apiClient.ts
    participant auth_router as auth_router.py
    participant rate_limiter as RateLimiter (auth_limiter)
    participant AuthService as AuthService (auth.py)
    participant security as security.py (bcrypt / jose)
    participant DB as PostgreSQL 16 (User Table)

    User->>AuthPage: Fill Registration Form (email, password, full_name)
    User->>AuthPage: Click "Daftar Akun"
    AuthPage->>apiClient: register(email, password, full_name)
    apiClient->>auth_router: POST /api/v1/auth/register {email, password, full_name}
    
    auth_router->>rate_limiter: __call__(request)
    alt Rate Limit Exceeded (>10 req / 60s)
        rate_limiter-->>auth_router: HTTPException(429, "Too Many Requests")
        auth_router-->>apiClient: HTTP 429 Rate Limit Exceeded
        apiClient-->>AuthPage: Error: Terlalu banyak permintaan
        AuthPage-->>User: Tampilkan pesan error cooldown
    else Rate Limit OK
        rate_limiter-->>auth_router: Allow execution
        auth_router->>AuthService: register(email, password, full_name)
        AuthService->>DB: query(User).filter_by(email=email).first()
        
        alt Email Already Registered
            DB-->>AuthService: User Record Exists
            AuthService-->>auth_router: raise ValueError("Email already registered")
            auth_router-->>apiClient: HTTP 400 Bad Request {"detail": "Email already registered"}
            apiClient-->>AuthPage: Throw Error
            AuthPage-->>User: Tampilkan notifikasi "Email sudah terdaftar"
        else Email Available
            DB-->>AuthService: None
            AuthService->>security: hash_password(password)
            security-->>AuthService: bcrypt_hashed_password
            AuthService->>DB: add(User(email, password_hash, full_name, monthly_cycle_day=1))
            AuthService->>DB: commit()
            AuthService->>DB: refresh(user)
            DB-->>AuthService: Persisted User instance (UUID)
            AuthService-->>auth_router: User instance
            
            auth_router->>security: create_access_token({"sub": str(user.id), "email": user.email})
            security-->>auth_router: access_token (exp: 60m)
            auth_router->>security: create_refresh_token({"sub": str(user.id), "email": user.email, "type": "refresh"})
            security-->>auth_router: refresh_token (exp: 30d)
            
            auth_router->>auth_router: set_refresh_cookie(response, refresh_token)
            auth_router-->>apiClient: HTTP 200 OK + Set-Cookie: refresh_token (HttpOnly, SameSite=Lax)<br/>{"access_token": "...", "user": {...}}
            
            apiClient->>apiClient: setAuthToken(access_token) [localStorage]
            apiClient-->>AuthPage: RegisterResponse
            AuthPage->>Browser: Redirect to "/dashboard"
            Browser-->>User: Render Dashboard Shell
        end
    end
```

---

### SD-02: AI Chat Text to Ledger Mutation (Happy Path)

This sequence illustrates the conversion of Indonesian conversational text into a double-entry ledger mutation, followed by deterministic runway recalculation and chat history enrichment.

```mermaid
sequenceDiagram
    autonumber
    actor User as End User
    participant AIChatView as AIChatView.tsx
    participant apiClient as apiClient.ts
    participant dashboard_router as dashboard_router.py
    participant AgentOrchestrator as AgentOrchestrator (orchestrator.py)
    participant ReActAgent as ReActAgent (runtime.py)
    participant GeminiAPI as Google Gemini 2.5 Flash REST
    participant LedgerService as LedgerService (ledger.py)
    participant RunwayService as RunwayService (runway.py)
    participant DB as PostgreSQL 16

    User->>AIChatView: Enter text: "Makan siang Padang 35000 potong GoPay"
    AIChatView->>apiClient: submitChatMessage("Makan siang Padang 35000 potong GoPay")
    apiClient->>dashboard_router: POST /api/v1/dashboard/ai-chat<br/>Authorization: Bearer <token><br/>{"message": "Makan siang Padang 35000 potong GoPay"}
    
    dashboard_router->>DB: add(ChatMessage(user_id=uid, role="user", content="..."))
    dashboard_router->>DB: commit()
    
    dashboard_router->>AgentOrchestrator: handle_message_async(user_id=uid, text="...")
    AgentOrchestrator->>AgentOrchestrator: extract_entities_async(text, user_id=uid)
    AgentOrchestrator->>ReActAgent: aprocess_input(user_id=uid, text="...")
    
    ReActAgent->>GeminiAPI: POST /v1beta/models/gemini-2.5-flash:generateContent?key=KEY_1
    GeminiAPI-->>ReActAgent: HTTP 200 OK: {"candidates": [{"content": {"parts": [{"text": "{\"action\": \"expense\", \"amount\": 35000, \"account_name\": \"GoPay\", \"category_name\": \"Makanan\", \"note\": \"Makan siang Padang\"}"}]}}]}
    ReActAgent->>ReActAgent: _clean_json_response()
    ReActAgent-->>AgentOrchestrator: Parsed Entity Dict
    
    AgentOrchestrator->>AgentOrchestrator: _execute_action(user_id, entities, text)
    AgentOrchestrator->>AgentOrchestrator: _resolve_account(user_id, "GoPay")
    AgentOrchestrator->>DB: query(Account).filter(user_id=uid, name ILIKE '%GoPay%').first()
    DB-->>AgentOrchestrator: Account(id=acc_uuid, name="GoPay", balance=500000)
    
    AgentOrchestrator->>AgentOrchestrator: _resolve_or_create_category(user_id, "Makanan", EXPENSE)
    AgentOrchestrator->>DB: query(Category).filter(user_id=uid, name ILIKE '%Makanan%').first()
    DB-->>AgentOrchestrator: Category(id=cat_uuid, name="Makanan")
    
    AgentOrchestrator->>LedgerService: record_expense(user_id=uid, account_id=acc_uuid, category_id=cat_uuid, amount=35000, description="Makan siang Padang")
    LedgerService->>DB: query(Account).filter_by(id=acc_uuid, user_id=uid).with_for_update().one()
    DB-->>LedgerService: Locked Account row
    LedgerService->>LedgerService: account.current_balance -= Decimal('35000') (Now: 465000)
    LedgerService->>DB: add(Transaction(user_id=uid, description="Makan siang Padang"))
    LedgerService->>DB: flush()
    LedgerService->>DB: add_all([Debit Entry (Category), Credit Entry (Account)])
    LedgerService->>DB: flush()
    LedgerService->>RunwayService: clear_cache(user_id=uid)
    RunwayService->>RunwayService: Invalidate _runway_cache entries for user_id
    LedgerService-->>AgentOrchestrator: Transaction instance
    
    AgentOrchestrator->>RunwayService: calculate_runway(user_id=uid)
    RunwayService->>DB: Sum liquid balances, vaults, and cycle calculations
    DB-->>RunwayService: Aggregates
    RunwayService-->>AgentOrchestrator: RunwayReport(daily_safe_runway=125000, operational_free_cash=3750000, ...)
    
    AgentOrchestrator->>DB: commit()
    AgentOrchestrator-->>dashboard_router: {reply: "...", transaction: {...}, telemetry: {...}}
    
    dashboard_router->>DB: add(ChatMessage(user_id=uid, role="assistant", content=reply, metadata_json=...))
    dashboard_router->>DB: commit()
    dashboard_router->>DB: refresh(assistant_msg)
    
    dashboard_router-->>apiClient: EnrichedChatResponse
    apiClient-->>AIChatView: Update State with assistant message, Transaction Card & Telemetry
    AIChatView-->>User: Display Assistant Card and Updated Safe Daily Runway
```

---

### SD-03: Receipt Image OCR with Groq Vision Fallback

This sequence details the execution path when an uploaded shopping receipt encounters a rate limit (HTTP 429) on the primary Gemini rotary key pool and automatically fails over to the Groq Vision multi-modal adapter.

```mermaid
sequenceDiagram
    autonumber
    actor User as End User
    participant AIChatView as AIChatView.tsx
    participant apiClient as apiClient.ts
    participant dashboard_router as dashboard_router.py
    participant AgentOrchestrator as AgentOrchestrator
    participant ReActAgent as ReActAgent
    participant RotaryKeyPool as RotaryKeyPool (Gemini)
    participant GeminiAPI as Gemini 2.5 Flash Endpoint
    participant GroqPool as RotaryKeyPool (Groq)
    participant GroqVisionAPI as Groq Llama-4 Scout Vision API
    participant LedgerService as LedgerService
    participant DB as PostgreSQL 16

    User->>AIChatView: Upload receipt image (receipt.jpg, 1.2MB)
    AIChatView->>apiClient: submitChatReceipt(file, caption="Struk Superindo")
    apiClient->>dashboard_router: POST /api/v1/dashboard/ai-receipt (multipart/form-data)
    
    dashboard_router->>dashboard_router: Validate mime_type ("image/jpeg"), magic bytes, file_size <= 10MB
    dashboard_router->>DB: add(ChatMessage(user_id=uid, role="user", content="[Foto Struk] Struk Superindo"))
    dashboard_router->>DB: commit()
    
    dashboard_router->>AgentOrchestrator: handle_message_async(user_id, caption, image_bytes, "image/jpeg")
    AgentOrchestrator->>ReActAgent: aprocess_input(user_id, caption, image_bytes, "image/jpeg")
    
    loop Gemini Key Pool Attempt
        ReActAgent->>RotaryKeyPool: get_current_key()
        RotaryKeyPool-->>ReActAgent: gemini_key_1
        ReActAgent->>GeminiAPI: POST /v1beta/models/gemini-2.5-flash:generateContent?key=gemini_key_1
        GeminiAPI-->>ReActAgent: HTTP 429 Resource Exhausted
        ReActAgent->>RotaryKeyPool: report_rate_limit(gemini_key_1, cooldown=60s)
        ReActAgent->>RotaryKeyPool: get_current_key()
        RotaryKeyPool-->>ReActAgent: gemini_key_2
        ReActAgent->>GeminiAPI: POST /v1beta/models/gemini-2.5-flash:generateContent?key=gemini_key_2
        GeminiAPI-->>ReActAgent: HTTP 429 Resource Exhausted
        ReActAgent->>RotaryKeyPool: report_rate_limit(gemini_key_2, cooldown=60s)
    end
    
    Note over ReActAgent, GroqVisionAPI: All Gemini keys exhausted. Initiating Groq Vision Fallback.
    
    ReActAgent->>GroqPool: get_current_key()
    GroqPool-->>ReActAgent: groq_key_1
    ReActAgent->>ReActAgent: _call_groq_vision_rest_async(groq_key_1, text, image_bytes, "image/jpeg")
    ReActAgent->>GroqVisionAPI: POST /openai/v1/chat/completions<br/>{"model": "meta-llama/llama-4-scout-17b-16e-instruct", "messages": [...base64 image...]}
    GroqVisionAPI-->>ReActAgent: HTTP 200 OK: {"choices": [{"message": {"content": "{\"action\": \"expense\", \"amount\": 148500, \"account_name\": \"BCA\", \"category_name\": \"Belanja\", \"note\": \"Superindo Belanja Mingguan\"}"}}]}
    
    ReActAgent->>ReActAgent: _clean_json_response()
    ReActAgent-->>AgentOrchestrator: Extracted Entities
    
    AgentOrchestrator->>LedgerService: record_expense(uid, account_id, category_id, 148500, "Superindo Belanja Mingguan")
    LedgerService->>DB: Mutate balance & persist balanced ledger entries
    DB-->>LedgerService: Success
    LedgerService-->>AgentOrchestrator: Transaction committed
    
    AgentOrchestrator-->>dashboard_router: {reply: "...", transaction: {...}, telemetry: {...}}
    dashboard_router->>DB: add(ChatMessage(user_id=uid, role="assistant", content=reply, ...))
    dashboard_router->>DB: commit()
    dashboard_router-->>apiClient: EnrichedChatResponse
    apiClient-->>AIChatView: Render receipt transaction confirmation card
```

---

### SD-04: Voice Note with 2-Hop Fallback

This sequence demonstrates voice processing when the 1-Hop direct Gemini audio multimodal pipeline fails, triggering the 2-Hop fallback: Groq Whisper transcription followed by Groq Llama extraction.

```mermaid
sequenceDiagram
    autonumber
    actor User as End User
    participant Browser as Browser Audio Recorder
    participant apiClient as apiClient.ts
    participant dashboard_router as dashboard_router.py
    participant AgentOrchestrator as AgentOrchestrator
    participant ReActAgent as ReActAgent
    participant GeminiAPI as Gemini 2.5 Flash Audio REST
    participant GroqWhisper as Groq Whisper Large v3
    participant GroqLLM as Groq Llama LLM
    participant LedgerService as LedgerService
    participant DB as PostgreSQL 16

    User->>Browser: Record audio: "Beli bensin pertamax 50 ribu cash"
    Browser->>apiClient: submitChatVoice(audioBlob, "audio/webm")
    apiClient->>dashboard_router: POST /api/v1/dashboard/ai-voice (multipart/form-data)
    
    dashboard_router->>dashboard_router: Validate mime_type in ALLOWED_VOICE_MIMES, size <= 10MB
    dashboard_router->>AgentOrchestrator: handle_voice_async(user_id, audio_bytes, mime_type="audio/webm")
    AgentOrchestrator->>ReActAgent: aprocess_audio(audio_bytes, mime_type="audio/webm")
    
    Note over ReActAgent, GeminiAPI: Hop 1: Attempt direct multi-modal audio inference via Gemini
    ReActAgent->>GeminiAPI: POST /v1beta/models/gemini-2.5-flash:generateContent (base64 audio)
    GeminiAPI-->>ReActAgent: HTTP 503 Model Overloaded / Timeout
    
    Note over ReActAgent, GroqLLM: Hop 1 Failed. Initiating 2-Hop Groq Pipeline.
    
    Note over ReActAgent, GroqWhisper: Hop 2a: Whisper Audio Transcription
    ReActAgent->>GroqWhisper: POST /openai/v1/audio/transcriptions<br/>model="whisper-large-v3", language="id", file="voice.webm"
    GroqWhisper-->>ReActAgent: HTTP 200 OK: {"text": "Beli bensin Pertamax 50.000 cash"}
    
    Note over ReActAgent, GroqLLM: Hop 2b: Text Entity Extraction
    ReActAgent->>GroqLLM: POST /openai/v1/chat/completions<br/>Prompt: Extract JSON from "Beli bensin Pertamax 50.000 cash"
    GroqLLM-->>ReActAgent: HTTP 200 OK: {"action": "expense", "amount": 50000, "account_name": "Cash", "category_name": "Transport", "note": "Bensin Pertamax"}
    
    ReActAgent-->>AgentOrchestrator: {transcription: "Beli bensin Pertamax 50.000 cash", action: "expense", ...}
    
    AgentOrchestrator->>LedgerService: record_expense(uid, cash_acc_id, transport_cat_id, 50000, "Bensin Pertamax")
    LedgerService->>DB: Apply mutations atomically
    DB-->>LedgerService: OK
    
    AgentOrchestrator-->>dashboard_router: Response with transcription, reply, tx card, and telemetry
    dashboard_router->>DB: add(ChatMessage(user_id, role="user", content="Beli bensin Pertamax 50.000 cash"))
    dashboard_router->>DB: add(ChatMessage(user_id, role="assistant", content=reply, ...))
    dashboard_router->>DB: commit()
    
    dashboard_router-->>apiClient: EnrichedChatResponse
    apiClient-->>Browser: Update UI with speech transcript badge and transaction card
```

---

### SD-05: JWT Token Refresh Flow

This sequence models how client requests encountering an expired access token (`HTTP 401`) coordinate through a singleton promise (`refreshPromise`) to prevent race conditions during refresh token rotation.

```mermaid
sequenceDiagram
    autonumber
    actor User as End User
    participant ComponentA as DashboardView.tsx
    participant ComponentB as AccountsList.tsx
    participant apiClient as apiClient.ts (Singleton refreshPromise)
    participant auth_router as auth_router.py
    participant DB as PostgreSQL 16

    Note over ComponentA, ComponentB: Two concurrent requests fire simultaneously after access token expiry
    ComponentA->>apiClient: apiFetch("/dashboard/summary")
    ComponentB->>apiClient: apiFetch("/accounts")
    
    par Concurrent Inflight Requests
        apiClient->>auth_router: GET /api/v1/dashboard/summary (Bearer expired_token)
        apiClient->>auth_router: GET /api/v1/accounts (Bearer expired_token)
    end
    
    auth_router-->>apiClient: HTTP 401 Unauthorized (expired_token)
    auth_router-->>apiClient: HTTP 401 Unauthorized (expired_token)
    
    Note over apiClient: First 401 initiates executeTokenRefresh()<br/>Second 401 attaches to existing refreshPromise
    
    apiClient->>auth_router: POST /api/v1/auth/refresh (Cookie: refresh_token=XYZ)
    
    auth_router->>auth_router: Read HttpOnly cookie "refresh_token"
    auth_router->>auth_router: jwt.decode(refresh_token, SECRET_KEY, algorithms=["HS256"])
    alt Token Invalid / Expired / Blacklisted
        auth_router-->>apiClient: HTTP 401 Unauthorized
        apiClient->>apiClient: clearAuthToken()
        apiClient-->>ComponentA: Error: Session Expired
        apiClient-->>ComponentB: Error: Session Expired
        Note over apiClient: Redirect window.location to "/login"
    else Token Valid
        auth_router->>DB: query(User).filter_by(id=sub).first()
        DB-->>auth_router: User Record Found
        auth_router->>auth_router: create_access_token({"sub": user.id, "email": user.email})
        auth_router->>auth_router: create_refresh_token({"sub": user.id, "email": user.email, "type": "refresh"})
        auth_router->>auth_router: set_refresh_cookie(response, new_refresh_token)
        auth_router-->>apiClient: HTTP 200 OK + Set-Cookie: refresh_token=NEW_XYZ<br/>{"access_token": "NEW_ACCESS_TOKEN"}
        
        apiClient->>apiClient: setAuthToken("NEW_ACCESS_TOKEN")
        apiClient->>apiClient: Resolve refreshPromise
        
        par Retry Original Requests with New Access Token
            apiClient->>auth_router: GET /api/v1/dashboard/summary (Bearer NEW_ACCESS_TOKEN)
            apiClient->>auth_router: GET /api/v1/accounts (Bearer NEW_ACCESS_TOKEN)
        end
        
        auth_router-->>apiClient: HTTP 200 OK (Summary Data)
        auth_router-->>apiClient: HTTP 200 OK (Accounts Data)
        
        apiClient-->>ComponentA: Return Summary Payload
        apiClient-->>ComponentB: Return Accounts Payload
    end
```

---

### SD-06: Telegram Bot Pairing & First Message

This sequence displays the Telegram onboarding flow: pairing code generation in the Web SPA, pairing command dispatch via Telegram webhook, brute-force rate limit evaluation, account linking, and subsequent financial message execution.

```mermaid
sequenceDiagram
    autonumber
    actor User as End User
    participant SettingsModal as SettingsModal.tsx
    participant apiClient as apiClient.ts
    participant auth_router as auth_router.py
    participant AuthService as AuthService
    participant TelegramApp as Telegram Mobile / Desktop App
    participant TelegramServers as Telegram Webhook Dispatcher
    participant gateway_router as gateway_router.py
    participant TelegramGateway as TelegramGateway (telegram_bot.py)
    participant AgentOrchestrator as AgentOrchestrator
    participant DB as PostgreSQL 16

    User->>SettingsModal: Click "Hubungkan Telegram"
    SettingsModal->>apiClient: generateTelegramPairingCode()
    apiClient->>auth_router: POST /api/v1/auth/telegram-pairing-code
    auth_router->>AuthService: generate_telegram_pairing_code(user_id)
    AuthService->>AuthService: Generate "DK-" + 6 hex chars (e.g. DK-A8F201)
    AuthService->>DB: user.telegram_pairing_code = "DK-A8F201", expires_at = now + 15m
    AuthService->>DB: commit()
    AuthService-->>auth_router: "DK-A8F201"
    auth_router-->>apiClient: {"pairing_code": "DK-A8F201"}
    apiClient-->>SettingsModal: Display code DK-A8F201 to user
    
    User->>TelegramApp: Send message: "/start DK-A8F201"
    TelegramApp->>TelegramServers: Post message to @rezekify_bot
    TelegramServers->>gateway_router: POST /api/v1/gateway/telegram<br/>X-Telegram-Bot-Api-Secret-Token: <SECRET><br/>{"update_id": 99281, "message": {"chat": {"id": 12345678}, "text": "/start DK-A8F201"}}
    
    gateway_router->>gateway_router: Verify HMAC Secret Token Header
    gateway_router->>TelegramGateway: handle_update(payload)
    TelegramGateway->>TelegramGateway: Check update_id in _processed_update_ids (dedup)
    TelegramGateway->>TelegramGateway: process_text_message(chat_id=12345678, text="/start DK-A8F201")
    
    TelegramGateway->>TelegramGateway: Evaluate failed_pairing_attempts[12345678]
    alt Attempts > 5 in last 15 minutes
        TelegramGateway-->>gateway_router: "Terlalu banyak percobaan gagal. Silakan coba 15 menit lagi."
    else Attempts Permitted
        TelegramGateway->>AuthService: link_telegram_chat_id(pairing_code="DK-A8F201", chat_id=12345678)
        AuthService->>DB: query(User).filter_by(telegram_pairing_code="DK-A8F201").first()
        DB-->>AuthService: Matched User record
        AuthService->>DB: user.telegram_chat_id = 12345678, user.telegram_pairing_code = None
        AuthService->>DB: commit()
        AuthService-->>TelegramGateway: True
        TelegramGateway-->>gateway_router: "✅ Berhasil menghubungkan akun Telegram Anda dengan Rezekify!"
    end
    
    gateway_router-->>TelegramServers: HTTP 200 OK {"method": "sendMessage", "text": "✅ Berhasil..."}
    TelegramServers-->>TelegramApp: Render confirmation message
    
    Note over User, DB: Subsequent financial interaction from paired Telegram client
    User->>TelegramApp: Send text: "Kopi Kenangan 22000 BCA"
    TelegramApp->>TelegramServers: Ingress
    TelegramServers->>gateway_router: POST /api/v1/gateway/telegram (chat_id=12345678)
    gateway_router->>TelegramGateway: process_text_message(12345678, "Kopi Kenangan 22000 BCA")
    TelegramGateway->>DB: query(User).filter_by(telegram_chat_id=12345678).first()
    DB-->>TelegramGateway: Authenticated User
    TelegramGateway->>AgentOrchestrator: handle_message(user.id, "Kopi Kenangan 22000 BCA")
    AgentOrchestrator->>DB: Execute Ledger Mutation & Runway Query
    DB-->>AgentOrchestrator: Committed
    AgentOrchestrator-->>TelegramGateway: Formatted Indonesian response string
    TelegramGateway-->>gateway_router: HTTP reply payload
    gateway_router-->>TelegramServers: sendMessage
    TelegramServers-->>TelegramApp: Render response: "☕ Pengeluaran Kopi Kenangan Rp 22.000 berhasil dicatat..."
```

---

### SD-07: Transaction Update (Reversal-and-Repost)

This sequence details the `reversal-and-repost` accounting pattern inside `LedgerService.update_transaction()`, showing row-level locking, balance restoration, validation of new targets, mutation, and cache purging.

```mermaid
sequenceDiagram
    autonumber
    actor User as End User
    participant EditModal as EditTransactionModal.tsx
    participant apiClient as apiClient.ts
    participant tx_router as transactions_router.py
    participant LedgerService as LedgerService
    participant RunwayService as RunwayService
    participant DB as PostgreSQL 16

    User->>EditModal: Edit transaction (change amount from 50.000 to 75.000, new Category)
    User->>EditModal: Click "Simpan Perubahan"
    EditModal->>apiClient: updateTransaction(tx_id, payload)
    apiClient->>tx_router: PUT /api/v1/transactions/{tx_id}<br/>{"amount": 75000, "description": "Makan Malam", "category_id": "...", "account_id": "..."}
    
    tx_router->>LedgerService: update_transaction(user_id, tx_id, amount=75000, ...)
    
    Note over LedgerService, DB: Step A: Locate Transaction with Row-Level Multi-Tenant Filter
    LedgerService->>DB: query(Transaction).filter_by(id=tx_id, user_id=uid).one()
    DB-->>LedgerService: Existing Transaction with loaded ledger_entries
    
    Note over LedgerService, DB: Step B: Reverse Previous Account Balance Mutations
    loop For each existing ledger entry
        alt entry.account_id is present
            LedgerService->>DB: query(Account).filter_by(id=entry.account_id, user_id=uid).with_for_update().one()
            DB-->>LedgerService: Locked Account record
            alt entry.entry_type == CREDIT
                LedgerService->>LedgerService: account.current_balance += entry.amount (Restores credited funds)
            else entry.entry_type == DEBIT
                LedgerService->>LedgerService: account.current_balance -= entry.amount (Reverses debited funds)
            end
        end
    end
    
    Note over LedgerService, DB: Step C: Validate Ownership of New Entities & Lock Target Accounts
    LedgerService->>DB: query(Account).filter_by(id=new_acc_id, user_id=uid).with_for_update().one()
    DB-->>LedgerService: Locked Target Account record
    LedgerService->>DB: query(Category).filter_by(id=new_cat_id, user_id=uid).one()
    DB-->>LedgerService: Validated Category record
    
    Note over LedgerService, DB: Step D: Apply New Balance Modifications & Purge Historical Entries
    LedgerService->>LedgerService: target_account.current_balance -= Decimal('75000')
    LedgerService->>DB: Delete existing LedgerEntry rows for tx_id
    LedgerService->>DB: flush()
    
    Note over LedgerService, DB: Step E: Post New Balanced Ledger Entries
    LedgerService->>DB: add_all([New Debit Entry (Category), New Credit Entry (Account)])
    LedgerService->>LedgerService: tx.description = "Makan Malam", tx.amount = 75000
    LedgerService->>DB: flush()
    
    LedgerService->>RunwayService: clear_cache(user_id=uid)
    RunwayService->>RunwayService: Invalidate in-memory _runway_cache
    
    LedgerService->>DB: commit()
    LedgerService->>DB: refresh(tx)
    DB-->>LedgerService: Updated Transaction
    
    LedgerService-->>tx_router: Transaction instance
    tx_router-->>apiClient: TransactionItemResponse
    apiClient-->>EditModal: Success
    EditModal-->>User: Close modal, refresh table & runway widget
```

---

### SD-08: BYOK Configuration & Validation

This sequence models the Bring-Your-Own-Key configuration workflow, including strict Server-Side Request Forgery (SSRF) hostname and IP validation, live endpoint pinging, and PBKDF2 Fernet encryption at rest.

```mermaid
sequenceDiagram
    autonumber
    actor User as End User
    participant SettingsModal as SettingsModal.tsx
    participant apiClient as apiClient.ts
    participant settings_router as settings_router.py
    participant base_provider as base.py (validate_base_url)
    participant adapter_factory as get_adapter(config)
    participant BYOKAdapter as OpenAICompatibleAdapter / AnthropicAdapter
    participant RemoteEndpoint as User AI Server (e.g. Ollama, OpenRouter, vLLM)
    participant crypto as crypto.py (encrypt_key)
    participant DB as PostgreSQL 16 (UserSettings Table)

    User->>SettingsModal: Enter BYOK Config (Protocol: OPENAI, URL: https://api.openrouter.ai/v1, Key: sk-or-..., Model: qwen-2.5)
    User->>SettingsModal: Click "Uji Koneksi"
    SettingsModal->>apiClient: validateAIKey({protocol, base_url, api_key, model})
    apiClient->>settings_router: POST /api/v1/settings/ai/validate
    
    settings_router->>base_provider: validate_base_url("https://api.openrouter.ai/v1", resolve=True)
    base_provider->>base_provider: Verify https:// scheme (blocks file://, http://)
    base_provider->>base_provider: socket.getaddrinfo("api.openrouter.ai")
    base_provider->>base_provider: Check IP candidates against private/loopback/link-local ranges
    alt Target IP is 127.0.0.1 or 192.168.x.x (SSRF Attempt)
        base_provider-->>settings_router: raise ValueError("base_url menunjuk ke alamat privat/loopback")
        settings_router-->>apiClient: HTTP 400 Bad Request
        apiClient-->>SettingsModal: Error: Alamat endpoint tidak diizinkan
    else Target IP is Valid Public IP
        base_provider-->>settings_router: Cleaned base_url ("https://api.openrouter.ai/v1")
        settings_router->>adapter_factory: get_adapter(BYOKConfig(...))
        adapter_factory-->>settings_router: OpenAICompatibleAdapter instance
        settings_router->>BYOKAdapter: ping()
        BYOKAdapter->>RemoteEndpoint: GET /models or POST /chat/completions (test prompt)
        
        alt 401 Unauthorized / Invalid Key
            RemoteEndpoint-->>BYOKAdapter: HTTP 401 Unauthorized
            BYOKAdapter-->>settings_router: raise AuthError()
            settings_router-->>apiClient: HTTP 400 Bad Request {"detail": "Kunci API ditolak (401)"}
            apiClient-->>SettingsModal: Tampilkan status invalid
        else 200 OK Verified
            RemoteEndpoint-->>BYOKAdapter: HTTP 200 OK
            BYOKAdapter-->>settings_router: Return True
            settings_router-->>apiClient: {"valid": true, "message": "Koneksi berhasil diverifikasi."}
            apiClient-->>SettingsModal: Tampilkan checklist hijau "Koneksi Valid"
            
            User->>SettingsModal: Click "Simpan Pengaturan AI"
            SettingsModal->>apiClient: updateAISettings({is_custom_ai_enabled: true, ...})
            apiClient->>settings_router: PUT /api/v1/settings/ai
            
            settings_router->>crypto: encrypt_key(raw_api_key)
            crypto->>crypto: Fernet(PBKDF2_HMAC_SHA256).encrypt(bytes)
            crypto-->>settings_router: Encrypted Fernet Token
            settings_router->>crypto: mask_key(raw_api_key)
            crypto-->>settings_router: Masked hint (e.g. "sk-o...019a")
            
            settings_router->>DB: Update UserSettings record (encrypted_api_key, key_hint, provider=CUSTOM, ...)
            settings_router->>DB: commit()
            settings_router->>DB: refresh(settings_rec)
            settings_router-->>apiClient: AISettingsResponse
            apiClient-->>SettingsModal: Notifikasi "Pengaturan AI Tersimpan"
        end
    end
```

---

## Section 3: Finite State Machine (FSM) Specifications

### FSM-01: Transaction Lifecycle

A Rezekify transaction transitions from creation through balanced active state, update reconciliations, and terminal deletion. Balanced double-entry parity is maintained at every resting phase.

```mermaid
stateDiagram-v2
    [*] --> CREATED: Form Ingress or AI Extraction Triggered

    CREATED --> ACTIVE: LedgerService.record_expense / income / transfer<br/>[Account locked, entries written, balance updated, DB commit]
    
    state UPDATING {
        [*] --> REVERSING_OLD: Locate existing transaction via with_for_update
        REVERSING_OLD --> DETERMINING_TYPE: Undo balance on historical accounts
        DETERMINING_TYPE --> VALIDATING_NEW: Inspect payload (EXPENSE, INCOME, TRANSFER)
        VALIDATING_NEW --> APPLYING_MUTATIONS: Verify tenant ownership of new account/category
        APPLYING_MUTATIONS --> PURGING_ENTRIES: Apply new delta to account.current_balance
        PURGING_ENTRIES --> CREATING_ENTRIES: Delete prior LedgerEntry records
        CREATING_ENTRIES --> [*]: Insert new balanced Debit/Credit pairs
    }

    ACTIVE --> UPDATING: PUT /api/v1/transactions/{id}<br/>[User requests transaction update]
    UPDATING --> ACTIVE: Commit transaction update & clear runway cache

    ACTIVE --> DELETED: DELETE /api/v1/transactions/{id}<br/>[Reverse balance modifications, delete tx, cascade purge entries]
    
    DELETED --> [*]
```

---

### FSM-02: Vault Lock Lifecycle

The Vault lock state machine protects financial commitments from accidental depletion. When locked, funds cannot be decreased or deleted without an explicit administrative unlock action.

```mermaid
stateDiagram-v2
    [*] --> UNLOCKED: POST /api/v1/vaults [is_locked=False]
    [*] --> LOCKED: POST /api/v1/vaults [is_locked=True]

    UNLOCKED --> LOCKED: PATCH /api/v1/vaults/{id}/toggle-lock<br/>Action: vault.is_locked = True

    LOCKED --> UNLOCKED: PATCH /api/v1/vaults/{id}/toggle-lock<br/>Action: vault.is_locked = False

    state UNLOCKED {
        [*] --> EditFree
        EditFree --> DecrementAllowed: PUT /api/v1/vaults/{id}<br/>[req.allocated_amount < vault.allocated_amount]
        EditFree --> IncrementAllowed: PUT /api/v1/vaults/{id}<br/>[req.allocated_amount >= vault.allocated_amount]
        EditFree --> DeletionAllowed: DELETE /api/v1/vaults/{id}<br/>[Removes vault allocation completely]
    }

    state LOCKED {
        [*] --> EditGuarded
        EditGuarded --> AllocationBlocked: PUT /api/v1/vaults/{id}<br/>[req.allocated_amount < vault.allocated_amount]<br/>Guard: HTTP 400 Bad Request Raised
        EditGuarded --> IncrementPermitted: PUT /api/v1/vaults/{id}<br/>[req.allocated_amount >= vault.allocated_amount]
        EditGuarded --> DeleteBlocked: DELETE /api/v1/vaults/{id}<br/>Guard: HTTP 400 Bad Request Raised
    }

    UNLOCKED --> [*]: Vault Deleted
```

---

### FSM-03: User Authentication Lifecycle

This state machine tracks the lifecycle of user authentication across token issuance, active authorized operations, expiration, and session termination.

```mermaid
stateDiagram-v2
    [*] --> ANONYMOUS: Client initiates session / visits website

    ANONYMOUS --> REGISTERING: POST /api/v1/auth/register
    REGISTERING --> ANONYMOUS: Registration validation error (HTTP 400)
    REGISTERING --> AUTHENTICATED: Hash password + issue access_token + set HttpOnly refresh_token

    ANONYMOUS --> AUTHENTICATED: POST /api/v1/auth/login<br/>[Valid credentials verified]

    state AUTHENTICATED {
        [*] --> ACTIVE_TOKEN: access_token stored in memory / localStorage
        ACTIVE_TOKEN --> EXECUTING_REQUESTS: apiFetch with Authorization: Bearer
        EXECUTING_REQUESTS --> ACTIVE_TOKEN: HTTP 200 OK
    }

    AUTHENTICATED --> TOKEN_EXPIRED: Access token lifetime elapsed (60 minutes)

    state TOKEN_EXPIRED {
        [*] --> AWAITING_REFRESH: apiFetch receives HTTP 401 Unauthorized
        AWAITING_REFRESH --> REFRESHING: executeTokenRefresh() fires
        REFRESHING --> TOKEN_EXPIRED: Concurrent 401s attach to existing refreshPromise
    }

    TOKEN_EXPIRED --> AUTHENTICATED: POST /api/v1/auth/refresh returns new access_token + rotated cookie
    TOKEN_EXPIRED --> LOGGED_OUT: Refresh token invalid / expired / missing (HTTP 401)

    AUTHENTICATED --> TELEGRAM_PAIRED: POST /auth/telegram-pairing-code + bot /start command verified
    TELEGRAM_PAIRED --> AUTHENTICATED: POST /settings/telegram/unlink

    AUTHENTICATED --> LOGGED_OUT: POST /api/v1/auth/logout<br/>Action: clearAuthToken() + clear_refresh_cookie()
    LOGGED_OUT --> ANONYMOUS: Redirection to /login
```

---

### FSM-04: ReActAgent Failover Chain (Text & Vision)

This state machine specifies the multi-tier failover mechanics executed during entity extraction across rotary pools and provider adapters.

```mermaid
stateDiagram-v2
    [*] --> INIT: Incoming natural language or receipt payload

    INIT --> EVALUATE_PROVIDER: Inspect UserSettings.ai_provider

    state EVALUATE_PROVIDER {
        [*] --> SYSTEM_POOL: ai_provider == "SYSTEM"
        [*] --> BYOK_ADAPTER: ai_provider == "CUSTOM" and is_custom_ai_enabled
    }

    state SYSTEM_POOL {
        [*] --> TRY_GEMINI_KEY: RotaryKeyPool.get_current_key()
        
        TRY_GEMINI_KEY --> GEMINI_SUCCESS: HTTP 200 + valid JSON
        
        TRY_GEMINI_KEY --> GEMINI_RATE_LIMIT: HTTP 429 received
        GEMINI_RATE_LIMIT --> REPORT_COOLDOWN: pool.report_rate_limit(key, 60s)
        REPORT_COOLDOWN --> TRY_GEMINI_KEY: More Gemini keys available in pool
        
        REPORT_COOLDOWN --> TRY_GROQ_KEY: All Gemini keys exhausted in cooldown
        
        TRY_GEMINI_KEY --> TRY_GROQ_KEY: HTTP 500 / 503 / Non-429 Unrecoverable Error
        
        state GROQ_FALLBACK {
            TRY_GROQ_KEY --> GROQ_SUCCESS: HTTP 200 + valid JSON
            TRY_GROQ_KEY --> GROQ_RATE_LIMIT: HTTP 429 received
            GROQ_RATE_LIMIT --> GROQ_REPORT_COOLDOWN: groq_pool.report_rate_limit(key, 60s)
            GROQ_REPORT_COOLDOWN --> TRY_GROQ_KEY: More Groq keys available in pool
            GROQ_REPORT_COOLDOWN --> UNKNOWN_FALLBACK: All Groq keys exhausted
            TRY_GROQ_KEY --> UNKNOWN_FALLBACK: Groq invocation fails
        }
    }

    state BYOK_ADAPTER {
        [*] --> BYOK_EXECUTE: adapter.process_input(...)
        BYOK_EXECUTE --> BYOK_SUCCESS: HTTP 200 + valid parsed JSON
        BYOK_EXECUTE --> BYOK_AUTH_ERR: HTTP 401 [AuthError]
        BYOK_EXECUTE --> BYOK_LIMIT_ERR: HTTP 429 [RateLimitError]
        BYOK_EXECUTE --> BYOK_CAP_ERR: Unsupported Modality [CapabilityUnsupported]
        BYOK_EXECUTE --> BYOK_GENERIC_ERR: Other network/server exception
    }

    GEMINI_SUCCESS --> [*]: Return Extracted Transaction Entity Dict
    GROQ_SUCCESS --> [*]: Return Extracted Transaction Entity Dict
    BYOK_SUCCESS --> [*]: Return Extracted Transaction Entity Dict

    BYOK_AUTH_ERR --> [*]: Return {"action": "byok_error", "status_code": 401}
    BYOK_LIMIT_ERR --> [*]: Return {"action": "byok_error", "status_code": 429}
    BYOK_CAP_ERR --> [*]: Return {"action": "byok_error", "reason": "unsupported_capability"}
    BYOK_GENERIC_ERR --> [*]: Return {"action": "byok_error"}

    UNKNOWN_FALLBACK --> [*]: Return {"action": "unknown", "text": input_text}
```

---

### FSM-05: Runway Cache Lifecycle

The deterministic runway engine optimizes read performance through an in-memory TTL cache with lazy sweep amortization.

```mermaid
stateDiagram-v2
    [*] --> EMPTY: Cache initialization / process start

    EMPTY --> COMPUTING: calculate_runway(user_id, today) called
    
    COMPUTING --> POPULATED: Ledger aggregations evaluated & stored in _runway_cache[(user_id, date)]
    
    state POPULATED {
        [*] --> VALID: now - timestamp <= 15.0 seconds
        VALID --> SERVING_CACHE: Cache Hit (instant return without DB queries)
        SERVING_CACHE --> VALID
        VALID --> STALE: now - timestamp > 15.0 seconds
    }

    VALID --> EMPTY: LedgerService mutation fires RunwayService.clear_cache(user_id)
    STALE --> COMPUTING: calculate_runway called (re-evaluates DB state)
    
    POPULATED --> EVICTED: Lazy Sweep Triggered (len >= 5000 or now - sweep > 60s)
    EVICTED --> EMPTY: Expired & LRU keys purged
```

---

### FSM-06: Rate Limiter Key Lifecycle

The rate limiter tracks caller identities (authenticated user UUID or remote IP) inside sliding window timestamp deques.

```mermaid
stateDiagram-v2
    [*] --> UNTRACKED: Incoming request from unseen user/IP

    UNTRACKED --> TRACKING: Append time.monotonic() to deque
    
    state TRACKING {
        [*] --> UNDER_LIMIT: len(deque) < max_requests
        UNDER_LIMIT --> ALLOWED: Request proceeds to route handler
        ALLOWED --> UNDER_LIMIT: Next request within window
    }

    TRACKING --> RATE_LIMITED: len(deque) >= max_requests within window_seconds
    
    RATE_LIMITED --> REJECTED: Raise HTTPException(429, "Too Many Requests")
    REJECTED --> RATE_LIMITED: Subsequent requests while window is saturated
    
    RATE_LIMITED --> TRACKING: Timestamps age past (now - window_seconds), popped via popleft()
    
    TRACKING --> EVICTED: Periodic sweep identifies empty deque or capacity cap exceeded
    EVICTED --> [*]: Key removed from _history dictionary
```

---

## Section 4: Concurrency, Contention & Deadlock Avoidance

### 4.1 Database Row-Level Locking Strategy

High-frequency concurrent balance mutations—such as simultaneous webhook messages and web dashboard actions—can induce database deadlocks if accounts are locked in arbitrary sequences. To guarantee deadlock-free execution, Rezekify enforces **Strict Global Lock Ordering** across all multi-account mutations.

In `LedgerService.record_transfer()`, account identifiers are sorted lexicographically before row-level locks are acquired:

```python
# rezekify/services/ledger.py - Deadlock-free ordered lock acquisition
first_id, second_id = (
    (from_account_id, to_account_id)
    if from_account_id < to_account_id
    else (to_account_id, from_account_id)
)

acc1 = (
    self.db.query(Account)
    .filter_by(id=first_id, user_id=user_id)
    .with_for_update()
    .one()
)
acc2 = (
    self.db.query(Account)
    .filter_by(id=second_id, user_id=user_id)
    .with_for_update()
    .one()
)
```

**Deadlock Avoidance Proof**:
1. Suppose Transaction $T_1$ transfers funds from Account $A$ to Account $B$ ($A < B$).
2. Concurrently, Transaction $T_2$ transfers funds from Account $B$ to Account $A$ ($B > A$).
3. Under unsorted locking, $T_1$ acquires Lock($A$) and waits for Lock($B$), while $T_2$ acquires Lock($B$) and waits for Lock($A$), creating a circular wait condition (deadlock).
4. By sorting IDs such that $A < B$, both $T_1$ and $T_2$ are required to acquire Lock($A$) before requesting Lock($B$). $T_2$ blocks on Lock($A$) until $T_1$ completes its commit, converting an unsafe circular wait into a serialized queue.

In `LedgerService.update_transaction()`, a two-phase ordered locking model is applied:
- **Phase 1 (Reversal)**: Accounts associated with old ledger entries are locked with `with_for_update()` to restore historical balances.
- **Phase 2 (Re-post)**: Accounts associated with new entries are validated and locked in sorted ID order prior to applying updated balance debits/credits.

---

### 4.2 Connection Pool Contention

Database connection resources are strictly budgeted to prevent pool exhaustion and thread starvation:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CONNECTION POOL BUDGET                          │
├──────────────────────────┬─────────────────────────────────────────────┤
│ Uvicorn Worker Count     │ 2 workers (WEB_CONCURRENCY=2)               │
│ Pool Size per Worker     │ pool_size=3                                 │
│ Max Overflow per Worker  │ max_overflow=2                              │
│ Peak Conns per Worker    │ 3 + 2 = 5 concurrent connections            │
│ Global App Peak Conns    │ 2 workers × 5 = 10 connections              │
│ PostgreSQL Server Cap    │ max_connections=30                          │
│ Safety Headroom          │ 20 unused connections (Admin / Migrations)  │
└──────────────────────────┴─────────────────────────────────────────────┘
```

**Resilience Parameters**:
- `pool_pre_ping=True`: Tests connections for liveness using `SELECT 1` prior to checkout, transparently discarding connections dropped by the database or intermediate firewalls.
- `pool_recycle=1800`: Recycles connections after 30 minutes, mitigating silent TCP connection drops on cloud container networks.
- `pool_timeout=10`: If all 5 connections in a worker pool are saturated, subsequent checkout requests block for at most 10 seconds before raising `TimeoutError`, preventing indefinite client hanging.

---

### 4.3 In-Memory Cache Thread Safety

Rezekify employs module-level dictionaries for high-speed ephemeral state:
1. `_runway_cache`: Stores precomputed `RunwayReport` tuples keyed by `(user_id, date)`.
2. `RateLimiter._history`: Stores sliding-window `deque[float]` timestamps keyed by user/IP.
3. `_processed_update_ids`: Deduplicates Telegram webhook deliveries keyed by `update_id`.
4. `TelegramGateway.failed_pairing_attempts`: Tracks brute-force pairing attempts.
5. `RotaryKeyPool.cooldowns`: Stores per-key cooldown expiration epochs.

**Thread Safety Analysis (CPython GIL & Multi-Worker Architecture)**:
- **Process Isolation**: Each Uvicorn worker process maintains its own independent memory space. No cache state is shared across process boundaries without explicit serialization.
- **GIL Atomic Operations**: In CPython 3.12, dictionary lookups (`dict.get`), assignments (`dict[k] = v`), deletions (`dict.pop`), and deque mutations (`deque.append`, `deque.popleft`) are atomic bytecode instructions (`BINARY_SUBSCR`, `STORE_SUBSCR`, `DELETE_SUBSCR`).
- **ponytail**: Current dictionary and deque structures are thread-safe under CPython's Global Interpreter Lock for single-node deployments; upgrade to Redis with centralized key expiration when scaling horizontally across multi-node clusters.

---

### 4.4 Singleton Token Refresh Race Prevention

When a user's access token expires, multiple asynchronous components on the web dashboard (e.g., summary widgets, account lists, transaction tables) may fire concurrent requests simultaneously. If each request handled 401 independently, multiple parallel `/auth/refresh` requests would hit the server, leading to race conditions where one request invalidates the refresh cookie of another.

Rezekify solves this on the client (`frontend/src/services/apiClient.ts`) using a **Singleton Promise Pattern**:

```typescript
// frontend/src/services/apiClient.ts
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAuthToken(): Promise<string | null> {
  if (refreshPromise) {
    // Attach to existing inflight refresh operation
    return refreshPromise;
  }

  const promise = (async () => {
    const refreshController = new AbortController();
    const refreshTimeout = setTimeout(() => refreshController.abort(), 15_000);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Includes HttpOnly refresh_token cookie
        signal: refreshController.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.access_token) {
        setAuthToken(data.access_token);
        return data.access_token as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(refreshTimeout);
      refreshPromise = null; // Reset singleton after completion
    }
  })();

  refreshPromise = promise;
  return promise;
}
```

**Race Prevention Invariant**:
- Only the first 401 error dispatches an HTTP request to `/auth/refresh`.
- All other concurrent 401 handlers await the identical `refreshPromise`.
- Once the token is refreshed, all stalled requests are retried concurrently with the newly issued access token.
- The `finally` block guarantees `refreshPromise = null` regardless of whether the operation succeeded, failed, or timed out.

---

### 4.5 Resource Leak Prevention

To prevent file descriptor exhaustion, memory leaks, and hanging worker threads, Rezekify enforces strict resource cleanup across all input channels:

1. **HTTP Client Lifecycle**: All external HTTP calls in `ReActAgent` use `async with httpx.AsyncClient(timeout=20.0) as client:`. This ensures network sockets, TLS sessions, and connection pools are closed immediately upon block exit.
2. **Database Session Scope**: All database sessions are injected via FastAPI dependencies (`rezekify/db/session.py`):
   ```python
   def get_db() -> Generator[Session, None, None]:
       db = SessionLocal()
       try:
           yield db
       finally:
           db.close()
   ```
   The `finally` block guarantees that checked-out connections are returned to the pool even when unhandled exceptions occur during route execution.
3. **Frontend Request Timeouts**: In `apiClient.ts`, all outgoing HTTP requests instantiate an `AbortController` coupled to a `setTimeout(..., 90_000)` timer. The timer is cleared in a `finally` block (`clearTimeout(timeoutId)`), preventing timer leaks in the browser event loop.
4. **Memory Leak Protection in Caches**:
   - `_runway_cache`: Lazy sweep runs every 60s or when cache size reaches 5,000 items, evicting stale items and truncating excess entries.
   - `RateLimiter._history`: Sweeps expired timestamps and evicts inactive keys whenever the dictionary exceeds `max_tracked_keys` (5,000 entries).
   - `_processed_update_ids`: Evicts Telegram update records older than 300 seconds whenever the cache exceeds 10,000 entries.
5. **Container Process Supervision**: The Docker Compose definition specifies `restart: unless-stopped` with standard health checks. If an unhandled thread crash occurs, Docker automatically restarts the container cleanly.
