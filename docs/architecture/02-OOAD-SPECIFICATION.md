# Rezekify — Master Object-Oriented Analysis & Design (OOAD) Specification

**Document ID:** ARCH-002 | **Version:** 1.0.0 | **Framework:** UML 2.5 & GoF Design Patterns  
**Target Architecture:** Multi-Modal Autonomous Financial Engine | **Status:** Active

---

## Section 1: Domain Model & Object Philosophy

### 1.1 Core Domain Entity Topology

Rezekify implements a strictly bounded personal finance domain centered on deterministic double-entry accounting. Rather than relying on loose account aggregations, the domain models financial realities as immutable ledger mutations anchored to an authenticated user identity.

The entity relationship model comprises eight core domain entities structured around the `User` aggregate root:

```
                      +-------------------+
                      |       User        |
                      +-------------------+
                        |   |   |   |   |   |
         +--------------+   |   |   |   |   +--------------+
         |      +-----------+   |   |   +-----------+      |
         |      |               |   |               |      |
      1  | 1 1  | *          1  | * | 1          1  | * 1  | *
         v      v               v   v               v      v
  +--------------+ +---------+ +---------+ +----------+ +-----------+ +-------------+
  | UserSettings | | Account | |  Vault  | | Category | |Transaction| | ChatMessage |
  +--------------+ +---------+ +---------+ +----------+ +-----------+ +-------------+
                        ^           ^           ^            | 1            | 0..1
                        |           |           |            v *            v
                        |           |           |     +-------------+       |
                        | *         | *         | *   | LedgerEntry | <-----+
                        +-----------+-----------+---- +-------------+
```

```
                        ENTITY MULTIPLICITY TOPOLOGY
┌────────────────────────────┬──────────────┬──────────────────────────────────────────┐
│ Relationship               │ Multiplicity │ Semantic & Integrity Guarantee           │
├────────────────────────────┼──────────────┼──────────────────────────────────────────┤
│ User ──> UserSettings      │ 1 : 1        │ Configuration aggregate, cascade delete  │
│ User ──> Account           │ 1 : N        │ Financial liquidity nodes (CASH/BANK)   │
│ User ──> Vault             │ 1 : N        │ Ring-fenced savings & fixed bill targets │
│ User ──> Category          │ 1 : N        │ Classification taxonomy (EXPENSE/INCOME) │
│ User ──> Transaction       │ 1 : N        │ Temporal event wrappers                  │
│ User ──> ChatMessage       │ 1 : N        │ Conversation audit trail                 │
│ Transaction ──> LedgerEntry│ 1 : N (N=2)  │ Balanced double-entry debit/credit pairs │
│ LedgerEntry ──> Account    │ N : 0..1     │ Balance-mutating leg of transaction      │
│ LedgerEntry ──> Category   │ N : 0..1     │ Income/expense classification leg        │
│ LedgerEntry ──> Vault      │ N : 0..1     │ Earmarked reserve allocation leg         │
│ ChatMessage ──> Transaction│ N : 0..1     │ Conversational provenance linking        │
└────────────────────────────┴──────────────┴──────────────────────────────────────────┘
```

#### Object Isolation & Ownership Principles
1. **Tenant Bounding**: Every entity possesses a foreign key reference to `User` (`user_id`). The system enforces strict tenant isolation: no transaction, ledger entry, or account mutation can bridge distinct `user_id` scopes.
2. **Double-Entry Equilibrium**: A `Transaction` is not a balance holder; it is an audit envelope. Actual balance mutations exist solely as balanced pairs of `LedgerEntry` records where $\sum \text{Debit} = \sum \text{Credit}$.
3. **Immutability via Reversal**: Rather than modifying historical ledger entries in place, transaction modifications follow a deterministic reversal-and-repost pattern, maintaining immutable ledger integrity.

---

### 1.2 Core Execution Loops

#### 1.2.1 Agentic Natural Language to Ledger Pipeline

The primary interaction pipeline converts unstructured multi-modal input (conversational Indonesian text, audio voice memos, or camera receipt images) into balance-mutating, double-entry ledger transactions:

```
[User Input: Text / Image / Audio]
               │
               ▼
   ReActAgent.process_input() / process_audio()
               │ (RotaryKeyPool with Gemini 2.5 Flash -> Groq Fallback)
               ▼
   JSON Payload Extraction
   {
     "action": "expense" | "income" | "transfer" | "query_runway",
     "amount": 45000,
     "account_name": "BCA",
     "category_name": "Makanan",
     "note": "Nasi goreng kambing"
   }
               │
               ▼
   AgentOrchestrator._execute_action()
               │
               ├── Fuzzy account resolution (Account.name ILIKE or highest balance)
               ├── Category sanitization and creation (Category.name)
               ▼
   LedgerService.record_expense() / record_income() / record_transfer()
               │
               ├── SELECT ... FOR UPDATE (Account row-level lock)
               ├── Create Transaction audit record
               ├── Insert balanced LedgerEntry pair (DEBIT Category, CREDIT Account)
               ├── Mutate Account.current_balance
               └── Flush and Commit (Session)
               │
               ▼
   RunwayService.clear_cache(user_id)
               │
               ▼
   RunwayService.calculate_runway(user_id)
               │
               ▼
   EnrichedChatResponse (Text, TransactionSummary, TelemetrySnapshot)
```

#### 1.2.2 Runway Calculation Mathematical Formulation

The Daily Safe Runway metric provides deterministic answers regarding daily spending limits without risking debt or defaulting on recurring commitments. The calculation adheres strictly to the following formula:

$$\text{operational\_free\_cash} = \max\left(0, \sum_{\text{type} \in \{\text{CASH}, \text{BANK}, \text{EWALLET}\}} \text{Account.current\_balance} - \sum_{\text{is\_locked} = \text{True}} \text{Vault.allocated\_amount}\right)$$

$$\text{days\_remaining} = \max\left(1, \text{days\_until\_next\_cycle\_day}\right)$$

$$\text{daily\_safe\_runway} = \left(\frac{\text{operational\_free\_cash}}{\text{days\_remaining}}\right)_{(\text{quantized to } 0.01)}$$

$$\text{health\_status} = \begin{cases} 
\text{CRITICAL}, & \text{if } \text{operational\_free\_cash} \le 0 \\
\text{WARNING}, & \text{if } \text{daily\_safe\_runway} < \text{User.safe\_runway\_threshold} \\
\text{HEALTHY}, & \text{otherwise}
\end{cases}$$

#### 1.2.3 Transaction Update State Machine (Reversal-and-Repost)

When a transaction is edited, the system preserves accounting integrity by executing a deterministic state machine:

```
  +──────────────────────────────────────────+
  |              1. LOCATE_TX                |
  |  Fetch Transaction by ID and user_id     |
  +──────────────────────────────────────────+
                       │
                       ▼
  +──────────────────────────────────────────+
  |           2. REVERSE_BALANCES            |
  |  Iterate existing LedgerEntries:         |
  |  - Re-credit debited accounts            |
  |  - Re-debit credited accounts            |
  +──────────────────────────────────────────+
                       │
                       ▼
  +──────────────────────────────────────────+
  |           3. DETERMINE_TYPE              |
  |  Identify original vs new TX type        |
  |  (EXPENSE vs INCOME vs TRANSFER)         |
  +──────────────────────────────────────────+
                       │
                       ▼
  +──────────────────────────────────────────+
  |          4. VALIDATE_ENTITIES            |
  |  Validate Account, Category, & Vault IDs |
  |  under current tenant scope              |
  +──────────────────────────────────────────+
                       │
                       ▼
  +──────────────────────────────────────────+
  |         5. APPLY_NEW_MUTATIONS           |
  |  Acquire FOR UPDATE row locks            |
  |  Apply new balance adjustments           |
  +──────────────────────────────────────────+
                       │
                       ▼
  +──────────────────────────────────────────+
  |          6. PURGE_OLD_ENTRIES            |
  |  DELETE FROM ledger_entries WHERE tx_id  |
  +──────────────────────────────────────────+
                       │
                       ▼
  +──────────────────────────────────────────+
  |          7. CREATE_NEW_ENTRIES           |
  |  Insert balanced replacement entries     |
  +──────────────────────────────────────────+
                       │
                       ▼
  +──────────────────────────────────────────+
  |          8. UPDATE_METADATA              |
  |  Update description, date, receipt_url   |
  +──────────────────────────────────────────+
                       │
                       ▼
  +──────────────────────────────────────────+
  |               9. COMMIT                  |
  |  Flush, commit session, invalidate cache |
  +──────────────────────────────────────────+
```

---

### 1.3 Context Injection & Prompt Composition

The orchestration runtime transforms unstructured natural language into structured JSON actions using Indonesian prompts and few-shot guidance.

#### 1.3.1 Structured System Prompts
- **Text & Vision Extraction (`SYSTEM_PROMPT`)**: Enforces JSON emission matching `{action, amount, account_name, category_name, note, from_account, to_account}`. Explicitly commands the LLM to output valid JSON without markdown wrapping or conversational commentary.
- **Audio Voice Transcription (`AUDIO_SYSTEM_PROMPT`)**: Extends the schema to mandate a `transcription` string field containing the Indonesian speech-to-text transcript alongside the extracted financial entities.

#### 1.3.2 Compositional Injection Pipeline
```
┌────────────────────────────────────────────────────────────────────────┐
│ Context Injection Pipeline                                             │
├────────────────────────────────────────────────────────────────────────┤
│ Parts List:                                                            │
│ 1. System Instruction Part: SYSTEM_PROMPT                              │
│ 2. Text Content Part: "Input pengguna: {user_input_text}"              │
│ 3. Optional Multi-Modal Part:                                          │
│    - Vision: {"mime_type": mime_type, "data": receipt_image_bytes}     │
│    - Audio:  {"mime_type": mime_type, "data": audio_bytes}             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Section 2: UML 2.5 Structural Domain Models

### 2.1 Complete Domain Class Diagram

```mermaid
classDiagram
    direction TB

    class AccountType {
        <<enumeration>>
        CASH
        BANK
        EWALLET
        LIABILITY
    }

    class CategoryType {
        <<enumeration>>
        EXPENSE
        INCOME
    }

    class EntryType {
        <<enumeration>>
        DEBIT
        CREDIT
    }

    class VaultType {
        <<enumeration>>
        SAVINGS
        FIXED_BILL
    }

    class AIProvider {
        <<enumeration>>
        SYSTEM
        CUSTOM
    }

    class AIProtocol {
        <<enumeration>>
        OPENAI
        ANTHROPIC
    }

    class GUID {
        <<TypeDecorator>>
        +load_dialect_impl(dialect)
        +process_bind_param(value, dialect)
        +process_result_value(value, dialect)
        +cache_ok: bool
    }

    class User {
        +UUID id
        +String email
        +String password_hash
        +String full_name
        +int telegram_chat_id
        +String telegram_pairing_code
        +datetime pairing_code_expires_at
        +int monthly_cycle_day
        +Decimal safe_runway_threshold
        +String currency
        +datetime created_at
        +verify_password(plain_password) bool
    }

    class Account {
        +UUID id
        +UUID user_id
        +String name
        +AccountType account_type
        +Decimal current_balance
        +bool is_active
        +datetime created_at
    }

    class Vault {
        +UUID id
        +UUID user_id
        +String name
        +VaultType vault_type
        +Decimal target_amount
        +Decimal allocated_amount
        +date target_date
        +bool is_locked
        +datetime created_at
    }

    class Category {
        +UUID id
        +UUID user_id
        +String name
        +CategoryType category_type
        +String icon
        +String color
    }

    class Transaction {
        +UUID id
        +UUID user_id
        +String description
        +String raw_input_text
        +String receipt_image_url
        +String source_channel
        +datetime transaction_date
        +datetime created_at
    }

    class LedgerEntry {
        +UUID id
        +UUID transaction_id
        +UUID user_id
        +UUID account_id
        +UUID category_id
        +UUID vault_id
        +EntryType entry_type
        +Decimal amount
    }

    class UserSettings {
        +UUID id
        +UUID user_id
        +AIProvider ai_provider
        +AIProtocol ai_protocol
        +String ai_base_url
        +String ai_model
        +String encrypted_api_key
        +String key_hint
        +bool is_custom_ai_enabled
        +datetime created_at
        +datetime updated_at
    }

    class ChatMessage {
        +UUID id
        +UUID user_id
        +String role
        +String content
        +UUID transaction_id
        +String metadata_json
        +datetime created_at
    }

    User "1" *-- "0..*" Account : owns
    User "1" *-- "0..*" Vault : allocates
    User "1" *-- "0..*" Category : defines
    User "1" *-- "0..*" Transaction : logs
    User "1" *-- "1" UserSettings : configures
    User "1" *-- "0..*" ChatMessage : transacts

    Transaction "1" *-- "2..*" LedgerEntry : cascades
    Transaction "1" o-- "0..1" ChatMessage : provenanced_by

    LedgerEntry "0..*" --> "0..1" Account : balances
    LedgerEntry "0..*" --> "0..1" Category : classifies
    LedgerEntry "0..*" --> "0..1" Vault : reserves

    Account --> AccountType
    Category --> CategoryType
    LedgerEntry --> EntryType
    Vault --> VaultType
    UserSettings --> AIProvider
    UserSettings --> AIProtocol
    User ..> GUID
    Account ..> GUID
    Vault ..> GUID
    Category ..> GUID
    Transaction ..> GUID
    LedgerEntry ..> GUID
    UserSettings ..> GUID
    ChatMessage ..> GUID
```

---

### 2.2 Service Layer Class Diagram

```mermaid
classDiagram
    direction TB

    class Session {
        <<SQLAlchemy ORM>>
        +add(entity)
        +add_all(entities)
        +flush()
        +commit()
        +rollback()
        +refresh(entity)
        +query(entity)
    }

    class LedgerService {
        -Session db
        -bool auto_commit
        +__init__(db: Session, auto_commit: bool)
        +record_expense(user_id: UUID, account_id: UUID, category_id: UUID, amount: Decimal, description: str, source_channel: str, raw_input_text: str, receipt_image_url: str, transaction_date: datetime) Transaction
        +record_income(user_id: UUID, account_id: UUID, category_id: UUID, amount: Decimal, description: str, source_channel: str, raw_input_text: str, transaction_date: datetime) Transaction
        +record_transfer(user_id: UUID, from_account_id: UUID, to_account_id: UUID, amount: Decimal, description: str, transaction_date: datetime) Transaction
        +delete_transaction(user_id: UUID, transaction_id: UUID) bool
        +update_transaction(user_id: UUID, transaction_id: UUID, amount: Decimal, description: str, account_id: UUID, category_id: UUID, to_account_id: UUID, transaction_date: datetime, receipt_image_url: str) Transaction
        -_maybe_commit() void
    }

    class RunwayReport {
        <<NamedTuple>>
        +Decimal total_liquid_cash
        +Decimal vault_locked_cash
        +Decimal operational_free_cash
        +int days_remaining
        +Decimal daily_safe_runway
        +str health_status
        +List~UpcomingBill~ upcoming_bills
    }

    class SimulationReport {
        <<NamedTuple>>
        +Decimal current_daily_runway
        +Decimal projected_daily_runway
        +Decimal daily_drop_amount
        +bool is_safe
        +str advice
    }

    class UpcomingBill {
        <<NamedTuple>>
        +str name
        +Decimal target_amount
        +Decimal allocated_amount
        +date target_date
        +int days_until_due
    }

    class DailySpendingBreakdownReport {
        <<NamedTuple>>
        +str period
        +Decimal daily_safe_runway
        +Decimal total_spent_in_period
        +List~DailyBreakdownItem~ items
    }

    class CategorySpendingBreakdownReport {
        <<NamedTuple>>
        +str period
        +date cycle_start_date
        +date cycle_end_date
        +Decimal total_spent
        +List~CategoryBreakdownItem~ items
    }

    class RunwayService {
        -Session db
        -_cache: Dict
        +__init__(db: Session)
        +calculate_runway(user_id: UUID, today: date, use_cache: bool) RunwayReport
        +simulate_purchase(user_id: UUID, planned_amount: Decimal, today: date) SimulationReport
        +get_daily_spending_breakdown(user_id: UUID, days: int, today: date) DailySpendingBreakdownReport
        +get_category_spending_breakdown(user_id: UUID, today: date) CategorySpendingBreakdownReport
        +get_upcoming_bills(user_id: UUID, today: date) List~UpcomingBill~
        +clear_cache(user_id: Optional~UUID~) void$
    }

    class AuthService {
        -Session db
        +__init__(db: Session)
        +register(email: str, password: str, full_name: str) User
        +login(email: str, password: str) str
        +generate_telegram_pairing_code(user_id: UUID) str
        +link_telegram_chat_id(telegram_chat_id: int, pairing_code: str) User
    }

    LedgerService --> Session : operates on
    RunwayService --> Session : queries
    AuthService --> Session : persists
    LedgerService ..> RunwayService : invalidates cache
    RunwayService ..> RunwayReport : produces
    RunwayService ..> SimulationReport : produces
    RunwayService ..> UpcomingBill : aggregates
    RunwayService ..> DailySpendingBreakdownReport : produces
    RunwayService ..> CategorySpendingBreakdownReport : produces
```

---

### 2.3 Agentic Layer Class Diagram

```mermaid
classDiagram
    direction TB

    class RotaryKeyPool {
        -List~str~ keys
        -int current_index
        -int cooldown_seconds
        -Dict~str, float~ cooldowns
        -Dict~str, Any~ client_cache
        +__init__(keys: List~str~, cooldown_seconds: int)
        +from_env(env_var: str, cooldown_seconds: int) RotaryKeyPool$
        +get_current_key() str
        +report_rate_limit(key: str, custom_cooldown: Optional~int~) void
        +get_gemini_client(api_key: str) Any
        +get_groq_client(api_key: str) Any
    }

    class BYOKConfig {
        <<dataclass>>
        +str protocol
        +str base_url
        +str model
        +str api_key
    }

    class BaseBYOKAdapter {
        <<interface>>
        +process_input(text: str, image_bytes: Optional~bytes~, mime_type: str) Dict
        +process_audio(audio_bytes: bytes, mime_type: str, text_context: Optional~str~) Dict
        +ping() bool
    }

    class OpenAICompatibleAdapter {
        +BYOKConfig config
        +float timeout
        +__init__(config: BYOKConfig, timeout: float)
        +process_input(text: str, image_bytes: Optional~bytes~, mime_type: str) Dict
        +process_audio(audio_bytes: bytes, mime_type: str, text_context: Optional~str~) Dict
        +ping() bool
        -_headers() Dict
        -_raise_for_auth_rate(resp: Response)$ void
    }

    class AnthropicCompatibleAdapter {
        +BYOKConfig config
        +float timeout
        +__init__(config: BYOKConfig, timeout: float)
        +process_input(text: str, image_bytes: Optional~bytes~, mime_type: str) Dict
        +process_audio(audio_bytes: bytes, mime_type: str, text_context: Optional~str~) Dict
        +ping() bool
        -_headers() Dict
        -_raise_for_auth_rate(resp: Response)$ void
    }

    class ReActAgent {
        -RotaryKeyPool gemini_pool
        -RotaryKeyPool groq_pool
        -str gemini_model
        -str groq_model
        -bool is_byok
        -BaseBYOKAdapter byok
        +__init__(gemini_pool: RotaryKeyPool, groq_pool: RotaryKeyPool, gemini_model: str, groq_model: str, is_byok: bool, byok: Optional~BaseBYOKAdapter~)
        +process_input(user_id: UUID, text: str, image_bytes: bytes, mime_type: str) Dict
        +process_audio(audio_bytes: bytes, mime_type: str, text_context: str) Dict
        +aprocess_input(user_id: UUID, text: str, image_bytes: bytes, mime_type: str) Dict
        +aprocess_audio(audio_bytes: bytes, mime_type: str, text_context: str) Dict
        +transcribe_audio(audio_bytes: bytes, filename: str) str
        -_fallback_groq(text: str) Dict
        -_fallback_groq_vision(text: str, image_bytes: bytes, mime_type: str) Dict
        -_clean_json_response(text: str)$ Dict
    }

    class AgentOrchestrator {
        -Session db
        -RotaryKeyPool key_pool
        -ReActAgent default_agent
        +__init__(db: Session, key_pool: RotaryKeyPool, agent: ReActAgent)
        +extract_entities(text: str, image_bytes: bytes, user_id: UUID, mime_type: str) Dict
        +extract_entities_async(text: str, image_bytes: bytes, user_id: UUID, mime_type: str) Dict
        +handle_message(user_id: UUID, text: str, image_bytes: bytes, mime_type: str) str
        +handle_message_async(user_id: UUID, text: str, image_bytes: bytes, mime_type: str) str
        +handle_voice(user_id: UUID, audio_bytes: bytes, mime_type: str, text_context: str) str
        +handle_voice_async(user_id: UUID, audio_bytes: bytes, mime_type: str, text_context: str) str
        -_resolve_agent_for_user(user_id: UUID) Tuple~Optional~ReActAgent~, bool~
        -_resolve_account(user_id: UUID, account_name: Optional~str~) Optional~Account~
        -_resolve_or_create_category(user_id: UUID, category_name: Optional~str~, cat_type: CategoryType) Category
        -_execute_action(user_id: UUID, entities: Dict, text: str) Dict
    }

    BaseBYOKAdapter <|.. OpenAICompatibleAdapter : realizes
    BaseBYOKAdapter <|.. AnthropicCompatibleAdapter : realizes
    OpenAICompatibleAdapter o-- BYOKConfig
    AnthropicCompatibleAdapter o-- BYOKConfig
    ReActAgent o-- RotaryKeyPool : manages rotation
    ReActAgent o-- BaseBYOKAdapter : optional delegation
    AgentOrchestrator o-- ReActAgent : coordinates
    AgentOrchestrator o-- RotaryKeyPool : references
```

---

### 2.4 Core Infrastructure Class Diagram

```mermaid
classDiagram
    direction TB

    class BaseSettings {
        <<pydantic_settings>>
    }

    class Settings {
        +str PROJECT_NAME
        +str ENVIRONMENT
        +str DATABASE_URL
        +str SECRET_KEY
        +str ALGORITHM
        +int ACCESS_TOKEN_EXPIRE_MINUTES
        +str ENCRYPTION_KEY
        +str GEMINI_API_KEYS
        +str GROQ_API_KEYS
        +str GEMINI_MODEL
        +str GROQ_MODEL
        +str GROQ_AUDIO_MODEL
        +str TELEGRAM_BOT_TOKEN
        +str TELEGRAM_WEBHOOK_URL
        +int RATE_LIMIT_DEFAULT_PER_MINUTE
        +int RATE_LIMIT_AI_PER_MINUTE
        +validate_database_url(v) str
        +validate_encryption_key(v) str
    }

    class RateLimiter {
        -int max_requests
        -int window_seconds
        -Dict~str, List~float~~ requests
        -Lock _lock
        +__init__(max_requests: int, window_seconds: int)
        +is_allowed(key: str) bool
        +get_retry_after(key: str) int
        +check_rate_limit(request: Request) void
    }

    class TypeDecorator {
        <<SQLAlchemy>>
    }

    class GUID {
        +cache_ok: bool
        +load_dialect_impl(dialect) TypeEngine
        +process_bind_param(value, dialect) Any
        +process_result_value(value, dialect) Optional~UUID~
    }

    BaseSettings <|-- Settings : inherits
    TypeDecorator <|-- GUID : specializes
```

---

## Section 3: Design Pattern Catalog

### 3.1 Strategy Pattern — BYOK Protocol Adapters

- **Intent**: Provide interchangeable AI protocol implementations conforming to a unified execution contract, isolating the core orchestrator from vendor-specific payload variations (OpenAI ChatCompletions vs. Anthropic Messages API).
- **Location**: `rezekify/agent/providers/base.py`, `rezekify/agent/providers/openai_compatible.py`, `rezekify/agent/providers/anthropic_compatible.py`

#### Structural Diagram
```mermaid
classDiagram
    class ProviderStrategy {
        <<interface>>
        +process_input(text, image_bytes, mime_type) Dict
        +process_audio(audio_bytes, mime_type, text_context) Dict
        +ping() bool
    }
    class OpenAICompatibleAdapter {
        +process_input(text, image_bytes, mime_type) Dict
        +process_audio(audio_bytes, mime_type, text_context) Dict
        +ping() bool
    }
    class AnthropicCompatibleAdapter {
        +process_input(text, image_bytes, mime_type) Dict
        +process_audio(audio_bytes, mime_type, text_context) Dict
        +ping() bool
    }
    ProviderStrategy <|.. OpenAICompatibleAdapter
    ProviderStrategy <|.. AnthropicCompatibleAdapter
```

#### Key Code Contract
```python
# rezekify/agent/providers/base.py
class CapabilityUnsupported(Exception):
    """Raised when a protocol/endpoint does not support a requested modality."""

def get_adapter(config: BYOKConfig):
    """Returns the protocol adapter instance for the given config."""
    if config.protocol == "OPENAI":
        from rezekify.agent.providers.openai_compatible import OpenAICompatibleAdapter
        return OpenAICompatibleAdapter(config)
    if config.protocol == "ANTHROPIC":
        from rezekify.agent.providers.anthropic_compatible import AnthropicCompatibleAdapter
        return AnthropicCompatibleAdapter(config)
    raise ValueError(f"Protokol AI tidak dikenal: {config.protocol}")
```

---

### 3.2 Factory Method Pattern — Adapter Selection & Key Pool Construction

- **Intent**: Encapsulate object creation logic for both volatile external protocol adapters and resilient key pools initialized from delimited environment variables.
- **Location**:
  - `rezekify/agent/providers/base.py`: `get_adapter(config: BYOKConfig)`
  - `rezekify/agent/key_pool.py`: `RotaryKeyPool.from_env(env_var: str, cooldown_seconds: int)`

#### Structural Diagram
```mermaid
classDiagram
    class RotaryKeyPool {
        +from_env(env_var: str, cooldown_seconds: int)$ RotaryKeyPool
    }
    class AdapterFactory {
        <<module>>
        +get_adapter(config: BYOKConfig) BaseBYOKAdapter
    }
    AdapterFactory ..> OpenAICompatibleAdapter : instantiates
    AdapterFactory ..> AnthropicCompatibleAdapter : instantiates
```

#### Key Code Contract
```python
# rezekify/agent/key_pool.py
@classmethod
def from_env(cls, env_var: str = "GEMINI_API_KEYS", cooldown_seconds: int = 60) -> "RotaryKeyPool":
    raw = os.getenv(env_var, "")
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    if not keys:
        logger.warning(f"Key pool '{env_var}' kosong atau tidak diset.")
    return cls(keys=keys, cooldown_seconds=cooldown_seconds)
```

---

### 3.3 Facade Pattern — AgentOrchestrator

- **Intent**: Provide a unified, high-level interface that shields client routers from the multi-layered complexities of agent resolution, credential decryption, fuzzy entity reconciliation, double-entry ledger mutation, and real-time runway recalculation.
- **Location**: `rezekify/agent/orchestrator.py:AgentOrchestrator`

#### Structural Diagram
```mermaid
classDiagram
    class ClientRouter {
        <<FastAPI / Telegram>>
    }
    class AgentOrchestrator {
        <<Facade>>
        +handle_message(user_id, text, image_bytes, mime_type) str
        +handle_voice(user_id, audio_bytes, mime_type, text_context) str
    }
    class Subsystem_ReActAgent {
        +process_input()
        +process_audio()
    }
    class Subsystem_LedgerService {
        +record_expense()
        +record_income()
    }
    class Subsystem_RunwayService {
        +calculate_runway()
    }
    class Subsystem_Encryption {
        +decrypt_key()
    }

    ClientRouter --> AgentOrchestrator
    AgentOrchestrator --> Subsystem_ReActAgent
    AgentOrchestrator --> Subsystem_LedgerService
    AgentOrchestrator --> Subsystem_RunwayService
    AgentOrchestrator --> Subsystem_Encryption
```

#### Key Code Contract
```python
# rezekify/agent/orchestrator.py
def handle_message(self, user_id: UUID, text: str, image_bytes: Optional[bytes] = None, mime_type: str = "image/jpeg") -> str:
    agent, is_byok = self._resolve_agent_for_user(user_id)
    if is_byok and agent is None:
        return "Pengaturan AI kustom Anda belum lengkap atau kunci API tidak valid."
    
    entities = self.extract_entities(text, image_bytes, user_id=user_id, mime_type=mime_type)
    action_result = self._execute_action(user_id, entities, text)
    return action_result["reply"]
```

---

### 3.4 Template Method Pattern — LedgerService Record Operations

- **Intent**: Enforce an invariant sequence for recording transactions (validation -> pessimistic lock acquisition -> transaction envelope creation -> balanced ledger pair emission -> balance adjustment -> flush -> conditional commit -> cache invalidation), delegating only specific accounting legs.
- **Location**: `rezekify/services/ledger.py:LedgerService`

#### Structural Diagram
```mermaid
sequenceDiagram
    participant Client
    participant LedgerService
    participant DB as SQLAlchemy Session
    participant Runway as RunwayService Cache

    Client->>LedgerService: record_expense(...)
    Note over LedgerService: 1. Input Validation (amount > 0)
    LedgerService->>DB: 2. SELECT ... FOR UPDATE (Account)
    LedgerService->>DB: 3. Add Transaction Audit Record
    LedgerService->>DB: 4. Add Debit & Credit LedgerEntries
    Note over LedgerService: 5. Mutate Account Balance
    LedgerService->>DB: 6. flush()
    LedgerService->>DB: 7. _maybe_commit()
    LedgerService->>Runway: 8. clear_cache(user_id)
    LedgerService-->>Client: Return Transaction
```

#### Key Code Contract
```python
# rezekify/services/ledger.py
def _maybe_commit(self) -> None:
    """Helper to commit only when auto_commit=True.
    
    Enables composition inside larger units of work.
    """
    if self.auto_commit:
        self.db.commit()

def record_expense(self, user_id: UUID, account_id: UUID, category_id: Optional[UUID], amount: Decimal, ...) -> Transaction:
    if amount <= Decimal("0"):
        raise ValueError("Jumlah transaksi harus lebih besar dari 0.")
    
    account = self.db.query(Account).filter_by(id=account_id, user_id=user_id).with_for_update().first()
    if not account:
        raise ValueError("Akun tidak ditemukan.")

    tx = Transaction(user_id=user_id, description=description, ...)
    self.db.add(tx)
    self.db.flush()

    debit_entry = LedgerEntry(transaction_id=tx.id, user_id=user_id, category_id=category_id, entry_type=EntryType.DEBIT, amount=amount)
    credit_entry = LedgerEntry(transaction_id=tx.id, user_id=user_id, account_id=account.id, entry_type=EntryType.CREDIT, amount=amount)
    self.db.add_all([debit_entry, credit_entry])
    account.current_balance -= amount
    
    self.db.flush()
    self._maybe_commit()
    RunwayService.clear_cache(user_id=user_id)
    return tx
```

---

### 3.5 Chain of Responsibility — ReActAgent Failover Chain

- **Intent**: Provide resilience against provider rate limits, network timeouts, and model unavailability by chaining multiple execution handlers across tiers and modalities.
- **Location**: `rezekify/agent/runtime.py:ReActAgent`

#### Structural Diagram
```mermaid
flowchart TD
    Start([User Multi-Modal Input]) --> IsBYOK{Is BYOK Configured?}
    IsBYOK -- Yes --> BYOKAdapter[BYOK Protocol Adapter]
    IsBYOK -- No --> Modality{Modality?}

    Modality -- Audio --> GeminiAudio[Tier 1: Gemini 2.5 1-Hop Audio]
    GeminiAudio -- Success --> Output([Structured JSON])
    GeminiAudio -- Fail / 429 --> GroqSTT[Tier 2: Groq Whisper STT]
    GroqSTT --> GroqLLM[Groq Llama LLM Extraction]
    GroqLLM -- Success --> Output

    Modality -- Text/Vision --> GeminiPool[Tier 1: Gemini Rotary Key Pool]
    GeminiPool -- 429 RateLimit --> RotateKey[Rotate Key & Retry]
    RotateKey --> GeminiPool
    GeminiPool -- Pool Exhausted --> GroqFallback[Tier 2: Groq Fallback Vision/Text]
    GroqFallback -- Success --> Output

    BYOKAdapter -- RateLimitError --> ErrorOut([Raise RateLimitError])
    GroqFallback -- All Failed --> UnknownOut([Return action: unknown])
```

#### Key Code Contract
```python
# rezekify/agent/runtime.py
def process_input(self, user_id: Optional[UUID], text: str, image_bytes: Optional[bytes] = None, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    if self.is_byok and self.byok:
        return self._byok_process_input(text, image_bytes, mime_type)

    # Tier 1: Gemini Key Pool with rotational retry
    for _ in range(max(1, len(self.gemini_pool.keys))):
        key = self.gemini_pool.get_current_key()
        try:
            client = self.gemini_pool.get_gemini_client(key)
            response = client.models.generate_content(...)
            return self._clean_json_response(response.text)
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                self.gemini_pool.report_rate_limit(key)
                continue
            break

    # Tier 2: Groq Fallback
    try:
        if image_bytes:
            return self._fallback_groq_vision(text, image_bytes, mime_type)
        return self._fallback_groq(text)
    except Exception:
        return {"action": "unknown", "raw": text}
```

---

### 3.6 Observer Pattern — Runway Cache Invalidation

- **Intent**: Decouple the financial transaction pipeline from analytical caching concerns by triggering cache evictions whenever balance mutations occur.
- **Location**: `rezekify/services/ledger.py` notifying `rezekify/services/runway.py`

#### Structural Diagram
```mermaid
classDiagram
    class LedgerService {
        +record_expense()
        +record_income()
        +record_transfer()
        +update_transaction()
        +delete_transaction()
    }
    class RunwayService {
        -_cache: Dict
        +clear_cache(user_id)$ void
        +calculate_runway()
    }
    LedgerService ..> RunwayService : notifies on mutation
```

#### Key Code Contract
```python
# rezekify/services/runway.py
_cache: Dict[Tuple[UUID, date], Tuple[float, RunwayReport]] = {}

@classmethod
def clear_cache(cls, user_id: Optional[UUID] = None) -> None:
    """Invalidates runway cache. If user_id given, clears only that user's entries."""
    if user_id is None:
        cls._cache.clear()
    else:
        keys_to_del = [k for k in cls._cache if k[0] == user_id]
        for k in keys_to_del:
            cls._cache.pop(k, None)
```

---

### 3.7 Singleton Pattern — Application-Level Key Pool

- **Intent**: Maintain global state across independent HTTP requests and worker threads for API key rotation indexes and dynamic rate-limit cooldown timestamps.
- **Location**: `rezekify/api/deps.py:get_gemini_key_pool`

#### Structural Diagram
```mermaid
classDiagram
    class DependencyModule {
        -_gemini_key_pool: Optional~RotaryKeyPool~
        +get_gemini_key_pool() RotaryKeyPool
        +reset_gemini_key_pool() void
    }
    class RotaryKeyPool {
        -int current_index
        -Dict cooldowns
    }
    DependencyModule --> RotaryKeyPool : holds single instance
```

#### Key Code Contract
```python
# rezekify/api/deps.py
_gemini_key_pool: Optional[RotaryKeyPool] = None

def get_gemini_key_pool() -> RotaryKeyPool:
    """Returns application-level singleton RotaryKeyPool for Gemini API keys.
    
    Preserves key rotation state and rate-limit cooldown across requests.
    """
    global _gemini_key_pool
    if _gemini_key_pool is None:
        _gemini_key_pool = RotaryKeyPool.from_env("GEMINI_API_KEYS")
    return _gemini_key_pool
```

---

## Section 4: Defensive Typing, Invariants & Exception Hierarchy

### 4.1 Exception Class Hierarchy

```mermaid
classDiagram
    direction TB
    class Exception {
        <<built-in>>
    }
    class CapabilityUnsupported {
        +modality: str
    }
    class AuthError {
        +status_code: 401
    }
    class RateLimitError {
        +status_code: 429
    }
    class ValueError {
        <<built-in>>
    }
    class NoResultFound {
        <<SQLAlchemy ORM>>
    }
    class HTTPException {
        <<FastAPI>>
        +status_code: int
        +detail: str
    }

    Exception <|-- CapabilityUnsupported
    Exception <|-- AuthError
    Exception <|-- RateLimitError
    Exception <|-- ValueError
    Exception <|-- NoResultFound
    Exception <|-- HTTPException
```

#### Exception Semantics & Failure Boundaries
1. **`CapabilityUnsupported`**: Raised by protocol adapters when an endpoint cannot process a requested modality (e.g., Anthropic Messages API invoked for direct binary audio transcription). Handled by orchestrator to return user-friendly advice.
2. **`AuthError`**: Triggered when a BYOK endpoint rejects credentials with HTTP 401. Trapped at the orchestrator boundary to advise the user to re-verify settings.
3. **`RateLimitError`**: Triggered when upstream BYOK endpoints return HTTP 429. Signals exhaustion of user-provided quotas.
4. **`ValueError`**: Raised within service domains on constraint violations (e.g., non-positive amounts, identical transfer accounts, malformed cycle dates).
5. **`NoResultFound` / `HTTPException`**: Managed at the API routing boundary to emit structured RFC 7807 compliant error responses.

---

### 4.2 Input Validation & Sanitization Boundaries

Every entry point to the system applies strict type assertions, range validation, and input sanitization:

| Boundary / Parameter | Validation Rule & Constraints | Enforcement Location | Failure Outcome |
| :--- | :--- | :--- | :--- |
| **Transaction Amount** | Must be strictly positive: $\text{amount} > 0$, quantized to two decimal places (`Decimal('0.01')`). | `LedgerService.record_*()`, `TransactionCreateRequest` | `ValueError("Jumlah transaksi harus lebih besar dari 0.")` |
| **Account Transfer** | Source account must differ from destination account: `from_account_id != to_account_id`. | `LedgerService.record_transfer()` | `ValueError("Akun asal dan tujuan tidak boleh sama.")` |
| **User Password** | Length bounded between 8 and 72 characters; bcrypt 72-byte truncation enforced. | `RegisterRequest`, `hash_password()` | `422 Unprocessable Entity` |
| **User Email** | RFC 5322 email syntax validation via Pydantic `EmailStr`. | `RegisterRequest` | `422 Unprocessable Entity` |
| **Receipt Image Upload** | MIME type in `image/jpeg, image/png, image/webp`, magic byte verification, max size 10MB. | `dashboard_router.ai_receipt_upload()` | `HTTPException(400, "Format file tidak didukung / ukuran melebihi batas")` |
| **Voice Audio Upload** | MIME type in `audio/ogg, audio/mpeg, audio/wav, audio/x-m4a, audio/mp4`, max size 10MB. | `dashboard_router.ai_voice_endpoint()` | `HTTPException(400, "Format audio tidak didukung")` |
| **BYOK Base URL** | Must use `https://` scheme, host required, loopback/private/link-local/multicast IP literals blocked. Resolve check at request time. | `validate_base_url()` in `base.py` | `ValueError("base_url menunjuk ke alamat privat/loopback...")` |
| **Account/Category Names** | Strips SQL wildcards (`%`, `_`) and truncates leading/trailing whitespace. | `AgentOrchestrator._resolve_or_create_category()` | Sanitized string passed to ILIKE queries |
| **Monthly Cycle Day** | Integer range restricted to $1 \le \text{cycle\_day} \le 31$. | `UserProfileUpdateRequest` | `422 Unprocessable Entity` |
| **Safe Runway Threshold** | Non-negative numeric value: $\text{threshold} \ge 0$. | `UserProfileUpdateRequest` | `422 Unprocessable Entity` |

---

### 4.3 System Invariants

The Rezekify domain guarantees six fundamental architectural invariants across all transactions:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   REZEKIFY ARCHITECTURAL INVARIANTS                                    │
├─────┬──────────────────────┬───────────────────────────────────────────┬───────────────────────────────┤
│ No. │ Invariant Principle  │ Technical Enforcement Mechanism           │ Violation Response            │
├─────┼──────────────────────┼───────────────────────────────────────────┼───────────────────────────────┤
│ 1   │ Balanced Ledger      │ Every recorded transaction generates      │ Transaction rollbacks via DB  │
│     │                      │ exactly one DEBIT and one CREDIT          │ exception; `ValueError` on    │
│     │                      │ `LedgerEntry` with identical amounts.     │ asymmetric legs.              │
├─────┼──────────────────────┼───────────────────────────────────────────┼───────────────────────────────┤
│ 2   │ Tenant Isolation     │ Every query and balance mutation mandates │ Empty query set returned or   │
│     │                      │ explicit `filter_by(user_id=...)` or      │ `HTTPException(404)` raised.  │
│     │                      │ `filter(Model.user_id == current_user)`.  │ Cross-tenant leaks blocked.   │
├─────┼──────────────────────┼───────────────────────────────────────────┼───────────────────────────────┤
│ 3   │ Deterministic Math   │ Floating-point arithmetic is forbidden.   │ Type system compile check;    │
│     │                      │ All calculations use `decimal.Decimal` and │ runtime conversion to         │
│     │                      │ SQL `Numeric(15,2)` columns.              │ `Decimal` on bind.            │
├─────┼──────────────────────┼───────────────────────────────────────────┼───────────────────────────────┤
│ 4   │ Positive Amounts     │ Zero or negative transaction values are   │ Immediate guard rejection     │
│     │                      │ rejected prior to account locks or state  │ raising `ValueError`.         │
│     │                      │ mutations.                                │                               │
├─────┼──────────────────────┼───────────────────────────────────────────┼───────────────────────────────┤
│ 5   │ Deadlock Prevention  │ Inter-account transfers lock rows in      │ Deadlock impossible by        │
│     │ (Ordered Locks)      │ deterministic order:                      │ consistent global lock        │
│     │                      │ `min(from_id, to_id)` acquired first.     │ acquisition hierarchy.        │
├─────┼──────────────────────┼───────────────────────────────────────────┼───────────────────────────────┤
│ 6   │ Vault Lock Defense   │ Vaults marked `is_locked = True` block    │ API raises `HTTPException(400)`│
│     │                      │ deletion and disallow allocation decreases│ preventing premature capital  │
│     │                      │ before their target date expires.         │ liquidation.                  │
└─────┴──────────────────────┴───────────────────────────────────────────┴───────────────────────────────┘
```

#### Detailed Invariant Code Verifications

##### Invariant 1: Balanced Ledger
```python
# Enforced in rezekify/services/ledger.py
debit_entry = LedgerEntry(
    transaction_id=tx.id,
    user_id=user_id,
    category_id=category_id,
    entry_type=EntryType.DEBIT,
    amount=amount,
)
credit_entry = LedgerEntry(
    transaction_id=tx.id,
    user_id=user_id,
    account_id=account.id,
    entry_type=EntryType.CREDIT,
    amount=amount,
)
self.db.add_all([debit_entry, credit_entry])
```

##### Invariant 5: Ordered Lock Acquisition for Deadlock Avoidance
```python
# Enforced in rezekify/services/ledger.py:record_transfer
first_id, second_id = (
    (from_account_id, to_account_id)
    if from_account_id < to_account_id
    else (to_account_id, from_account_id)
)

first_acc = self.db.query(Account).filter_by(id=first_id, user_id=user_id).with_for_update().first()
second_acc = self.db.query(Account).filter_by(id=second_id, user_id=user_id).with_for_update().first()
```

##### Invariant 6: Vault Lock Protection
```python
# Enforced in rezekify/api/v1/vaults.py
if vault.is_locked:
    if update_data.allocated_amount is not None and update_data.allocated_amount < vault.allocated_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak dapat mengurangi alokasi dana pada brankas terkunci."
        )
```

---

*This specification serves as the authoritative object-oriented architectural contract for the Rezekify platform. All implementations and extensions must preserve these patterns, structural contracts, and invariants.*
