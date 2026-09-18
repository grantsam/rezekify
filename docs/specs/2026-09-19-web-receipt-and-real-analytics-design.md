# REZEKIFY: Multipart Web Receipt Ingestion & Real Analytics Visualization

**Document Type:** Architectural & Technical Design Specification (Spec)  
**Document ID:** `SPEC-2026-09-19-WEB-RECEIPT-ANALYTICS`  
**Target File:** `docs/specs/2026-09-19-web-receipt-and-real-analytics-design.md`  
**Author:** Principal System Architect  
**Status:** Approved for Implementation  
**Project Classification:** Program Komputer / Rekayasa Perangkat Lunak Berbasis Kecerdasan Buatan (HKI)  

---

## 1. Executive Summary & Goals

### 1.1 Context & Phase 1 Evaluation Review
During Phase 1, Rezekify successfully implemented its foundational deterministic double-entry accounting engine (`LedgerService`), the dynamic daily safe runway calculator (`RunwayService`), the zero-cost rotary key pool (`RotaryKeyPool`), the Telegram multimodal gateway, and a responsive web dashboard.

However, the post-Phase 1 architectural evaluation identified two critical capability gaps in the Web client and API gateway layers:
1. **Multipart Web Receipt Ingestion Gap:**
   - In the initial implementation, the Web client's `OmniInputHero` component allowed users to select an image file, but the submission handler in `DashboardPage.tsx` simply formatted the filename into a text string (`"${text} [Lampiran file: ${file.name}]"`) and dispatched it to the JSON-only `/api/v1/dashboard/ai-chat` endpoint.
   - The binary image payload was never transmitted over the network.
   - The backend lacked an authenticated, multipart-capable endpoint to ingest raw image files, enforce MIME and payload constraints, and route the binary data to the Gemini 2.5 Flash Vision OCR pipeline.
2. **Analytics Stub & Visualization Gap:**
   - The `GET /api/v1/analytics/spending-breakdown` endpoint was a non-functional stub returning a static empty payload (`{"period": period, "breakdown": []}`).
   - The frontend `ExpenseCharts.tsx` component rendered hardcoded static mock data (seven static days and four static categories) disconnected from the user's actual database ledger.
   - The UI lacked dynamic data fetching, reactive re-querying upon new transaction submissions, and accessible zero-data empty states.

### 1.2 Core Goals
This specification defines the complete architectural design and interface contracts to resolve both gaps:
* **Deliver Multipart Web Receipt Ingestion:**
  Deploy `POST /api/v1/dashboard/ai-receipt` accepting `multipart/form-data` with binary validation (JPEG, PNG, WebP; maximum 10MB), integrating directly with `AgentOrchestrator` and Gemini 2.5 Flash Vision OCR.
* **Deliver Deterministic Spending Analytics:**
  Implement two deterministic aggregation methods in `RunwayService` (`get_daily_spending_breakdown` and `get_category_spending_breakdown`) and expose them via `GET /api/v1/analytics/spending-breakdown?period=(daily|monthly)` with strict Pydantic v2 schemas.
* **Modernize Frontend Interaction & Reactive Visualization:**
  Refactor `OmniInputHero` into an accessible drag-and-drop dropzone with client-side thumbnail previews, file removal controls, and `FormData` network dispatch. Upgrade `ExpenseCharts` to dynamic client-side fetching with smooth Framer Motion bar animations and zero-data states. Wire `DashboardPage` to trigger reactive refreshes across summary telemetry, transaction history, and charts upon receipt submission.

---

## 2. Core Invariants Preserved

All modifications strictly adhere to the five non-negotiable architectural invariants of Rezekify:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REZEKIFY ARCHITECTURAL INVARIANTS                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Deterministic Math      │ Python decimal.Decimal & SQL NUMERIC(15,2).    │
│                            │ Zero LLM calculation of balances or runway.    │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 2. Balanced Ledger         │ Strict Double-Entry: Sum(Debit) = Sum(Credit). │
│                            │ Unbalanced transactions atomically rolled back.│
├────────────────────────────┼────────────────────────────────────────────────┤
│ 3. Tenant Isolation        │ Strict Row-Level Scoping: WHERE user_id = :uid │
│                            │ on every query, aggregation, and mutation.     │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 4. Rotary Key Resilience   │ RotaryKeyPool multi-key round-robin for Gemini │
│                            │ 2.5 Flash Vision OCR with HTTP 429 failover.   │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 5. Zero-Bloat Scope        │ Daily Safe Runway + H-7 Bills focus only.      │
│                            │ Strict rejection of yearly queries (HTTP 422). │
└────────────────────────────┴────────────────────────────────────────────────┘
```

### 2.1 Invariant 1: Deterministic Math via `decimal.Decimal`
The Large Language Model is strictly confined to entity extraction (identifying amount, account, category, and vendor/note). All spending aggregations, daily safe runway threshold comparisons, and category percentage shares are computed using Python `decimal.Decimal` and PostgreSQL `NUMERIC(15, 2)` functions.
* Category percentage shares are computed as:
  $$\text{percentage} = \left( \frac{\text{Category Expense}}{\text{Total Cycle Expense}} \times 100 \right)\text{.quantize(Decimal('0.1'))}$$
* Daily spending comparisons evaluate:
  $$\text{is\_over\_budget} = (\text{Daily Total Expense} > \text{Daily Safe Runway})$$
* Floating-point IEEE 754 arithmetic is strictly prohibited in financial calculation paths.

### 2.2 Invariant 2: Balanced Ledger Execution
When receipt OCR extracts an expense transaction, the resulting financial entries are posted through `LedgerService.record_expense()`:
* **DEBIT:** Category Account (Expense) $\rightarrow +X$
* **CREDIT:** Asset Account (Cash / Bank / E-Wallet) $\rightarrow -X$
* Verification invariant:
  $$\sum \text{Debit} - \sum \text{Credit} = 0$$
Any failure during posting triggers an immediate database transaction rollback.

### 2.3 Invariant 3: Row-Level Tenant Isolation
Every database query in `RunwayService` and `AgentOrchestrator` filters explicitly by `user_id == current_user.id`. Subqueries and aggregations on `transactions`, `ledger_entries`, `accounts`, `vaults`, and `categories` mandate tenant isolation at the SQL query level, preventing cross-tenant data exposure.

### 2.4 Invariant 4: Zero-Cost Rotary Key Pool Resilience
Multimodal vision processing utilizes `RotaryKeyPool.from_env("GEMINI_API_KEYS")`. If a key encounters rate limits (`HTTP 429` or `RESOURCE_EXHAUSTED`), the pool marks the key with an exponential cooldown, advances the rotary index, and attempts the OCR call with subsequent keys without dropping user requests.

### 2.5 Invariant 5: Zero-Bloat Scope (Strict Rejection of Yearly Aggregation)
In alignment with Rezekify's core philosophy (focusing on immediate daily liquidity and 7-day upcoming commitments), long-term yearly aggregation is rejected. The analytics query parameter validation schema strictly enforces `^(daily|monthly)$`. Requests specifying `period=yearly` are rejected immediately with HTTP 422 Unprocessable Entity.

---

## 3. Backend Architecture & API Contracts

```
                                 HTTP POST (multipart/form-data)
                                 /api/v1/dashboard/ai-receipt
                                 [file (UploadFile), message (Form)]
                                               │
                                               ▼
                                 ┌───────────────────────────┐
                                 │   MIME & Size Validator   │
                                 │   • JPEG, PNG, WebP only  │
                                 │   • Max 10MB payload      │
                                 └─────────────┬─────────────┘
                                               │ (Valid bytes)
                                               ▼
                                 ┌───────────────────────────┐
                                 │     AgentOrchestrator     │
                                 └─────────────┬─────────────┘
                                               │
                         ┌─────────────────────┴─────────────────────┐
                         │                                           │
                         ▼                                           ▼
             ┌───────────────────────┐                   ┌───────────────────────┐
             │   Gemini 2.5 Flash    │                   │     LedgerService     │
             │   Vision OCR Engine   │                   │  • Double-Entry Post  │
             │   (RotaryKeyPool)     │                   │  • Balance Mutation   │
             └───────────────────────┘                   └───────────────────────┘
                                                                     │
                                                                     ▼
                                                         ┌───────────────────────┐
                                                         │     RunwayService     │
                                                         │  • calculate_runway() │
                                                         │  • get_daily_break... │
                                                         │  • get_category_br... │
                                                         └───────────────────────┘
```

### 3.1 Endpoint: `POST /api/v1/dashboard/ai-receipt`

#### 3.1.1 Endpoint Signature & Validation Rules
* **Path:** `/api/v1/dashboard/ai-receipt`
* **Method:** `POST`
* **Authentication:** `Bearer <JWT_ACCESS_TOKEN>` (via `get_current_user` dependency)
* **Content-Type:** `multipart/form-data`
* **Request Parameters:**
  * `file`: `UploadFile = File(...)` (Required).
  * `message`: `Optional[str] = Form(None)` (Optional supplemental notes from the user, e.g., *"makan siang sama tim"*).
* **Validation Invariants:**
  1. **MIME Type Whitelist:** Must strictly match one of:
     * `image/jpeg`
     * `image/png`
     * `image/webp`
     If the uploaded file presents any other content type, reject with:
     `HTTP 400 Bad Request` $\rightarrow$ `{"detail": "Format file tidak didukung. Harap unggah struk berformat JPEG, PNG, atau WebP."}`
  2. **Payload Size Guard:** Maximum allowable size is **10 MB** ($10 \times 1024 \times 1024 = 10,485,760\text{ bytes}$).
     The file stream is read into memory with chunked size tracking. If accumulated bytes exceed 10 MB, reject with:
     `HTTP 413 Payload Too Large` $\rightarrow$ `{"detail": "Ukuran file melebihi batas maksimal 10MB."}`
  3. **Empty File Guard:** If payload is 0 bytes, reject with:
     `HTTP 400 Bad Request` $\rightarrow$ `{"detail": "File yang diunggah kosong."}`

#### 3.1.2 Response Contract
```json
{
  "reply": "✅ Tercatat dari Struk: Rp 48.500 (Kopi Kenangan & Roti) via BCA.\n📊 Sisa Jatah Belanja Hari Ini: Rp 72.150 (14 hari menuju siklus baru).",
  "transaction_id": "8f3b2d10-3d74-4b52-9b2f-3d1f42e5b7a1",
  "extracted_data": {
    "action": "expense",
    "amount": 48500.00,
    "account_name": "BCA",
    "category_name": "Makanan & Minuman",
    "note": "Kopi Kenangan & Roti"
  }
}
```

Pydantic v2 Response Model:
```python
class ReceiptExtractedData(BaseModel):
    action: str
    amount: Decimal
    account_name: Optional[str] = None
    category_name: Optional[str] = None
    note: Optional[str] = None

class ReceiptUploadResponse(BaseModel):
    reply: str
    transaction_id: Optional[UUID] = None
    extracted_data: ReceiptExtractedData
```

#### 3.1.3 Vision OCR Pipeline Integration
1. The endpoint reads `await file.read()`.
2. Validates MIME type and byte length.
3. Instantiates `AgentOrchestrator(db=db, key_pool=RotaryKeyPool.from_env("GEMINI_API_KEYS"))`.
4. Calls `orchestrator.handle_receipt(user_id=current_user.id, image_bytes=content, mime_type=file.content_type, user_note=message)`.
5. `AgentOrchestrator` invokes `ReActAgent.process_input(user_id=user_id, text=user_note or "Struk belanja", image_bytes=image_bytes, mime_type=mime_type)`.
6. `ReActAgent` packages `types.Part.from_bytes(data=image_bytes, mime_type=mime_type)` into Gemini 2.5 Flash `contents` payload.
7. If Gemini extracts an `expense` action:
   - Resolves or creates user-scoped category via `_resolve_or_create_category()`.
   - Resolves target account (matching extracted account name, or falling back to the user's highest balance account).
   - Posts balanced entry via `LedgerService.record_expense()`.
   - Generates dynamic runway telemetry string via `RunwayService.calculate_runway()`.
   - Returns both the natural language reply and structured extraction metadata.

---

### 3.2 RunwayService Analytics Methods

The `RunwayService` in `rezekify/services/runway.py` is extended with two deterministic analytical methods:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            RunwayService Extensions                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ + get_daily_spending_breakdown(user_id: UUID, days: int = 7,                │
│                                today: Optional[date] = None)                │
│   -> DailySpendingBreakdownReport                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ + get_category_spending_breakdown(user_id: UUID,                            │
│                                   today: Optional[date] = None)             │
│   -> CategorySpendingBreakdownReport                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 3.2.1 Method: `get_daily_spending_breakdown(user_id, days=7, today=None)`
* **Purpose:** Computes actual historical daily expenditure over the last $N$ calendar days (default $N=7$) and benchmarks each day against the user's current `daily_safe_runway`.
* **Algorithmic Specification:**
  1. If `today` is `None`, default to `date.today()`.
  2. Compute date window:
     $$\text{start\_date} = \text{today} - \text{timedelta}(\text{days} = \text{days} - 1)$$
     $$\text{end\_date} = \text{today}$$
  3. Query `ledger_entries` joined with `transactions` and `categories`:
     ```sql
     SELECT 
         CAST(t.transaction_date AS DATE) AS tx_date,
         COALESCE(SUM(le.amount), 0) AS total_amount
     FROM transactions t
     JOIN ledger_entries le ON le.transaction_id = t.id
     JOIN categories c ON le.category_id = c.id
     WHERE t.user_id = :user_id
       AND le.entry_type = 'DEBIT'
       AND c.category_type = 'EXPENSE'
       AND CAST(t.transaction_date AS DATE) >= :start_date
       AND CAST(t.transaction_date AS DATE) <= :end_date
     GROUP BY CAST(t.transaction_date AS DATE)
     ORDER BY tx_date ASC;
     ```
  4. **Zero-Fill Invariant:** The database may contain zero transactions for specific calendar days. The service constructs a continuous sequence of all $N$ dates between `start_date` and `end_date`. Missing dates are populated with `Decimal("0.00")`.
  5. **Runway Benchmark Calculation:**
     - Retrieve current safe runway:
       $$\text{daily\_safe} = \text{self.calculate\_runway}(\text{user\_id}, \text{today}=\text{today}).\text{daily\_safe\_runway}$$
     - For each day in the sequence:
       $$\text{is\_over\_budget} = (\text{day\_amount} > \text{daily\_safe})$$
  6. Return a strongly-typed `DailySpendingBreakdownReport`:
     ```python
     class DailyBreakdownItem(NamedTuple):
         date: date
         day_label: str  # Indonesian abbreviation: 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'
         amount: Decimal
         safe_runway_threshold: Decimal
         is_over_budget: bool

     class DailySpendingBreakdownReport(NamedTuple):
         period: str  # 'daily'
         daily_safe_runway: Decimal
         total_spent_in_period: Decimal
         items: List[DailyBreakdownItem]
     ```

#### 3.2.2 Method: `get_category_spending_breakdown(user_id, today=None)`
* **Purpose:** Computes expense distribution grouped by category for the user's *current monthly billing cycle*.
* **Billing Cycle Date Arithmetic:**
  1. Retrieve `user.monthly_cycle_day` from the `users` table.
  2. Determine the active cycle start date ($\text{cycle\_start}$):
     - If $\text{today.day} \ge \text{cycle\_day}$:
       $$\text{cycle\_start} = \text{date}(\text{today.year}, \text{today.month}, \text{cycle\_day})$$
     - If $\text{today.day} < \text{cycle\_day}$:
       Calculate preceding month. If $\text{today.month} == 1$, previous month is 12 of $\text{today.year} - 1$, else $\text{today.month} - 1$.
       Let $\text{max\_days} = \text{monthrange}(\text{prev\_year}, \text{prev\_month})[1]$.
       $$\text{effective\_cycle\_day} = \min(\text{cycle\_day}, \text{max\_days})$$
       $$\text{cycle\_start} = \text{date}(\text{prev\_year}, \text{prev\_month}, \text{effective\_cycle\_day})$$
  3. Determine cycle end date ($\text{cycle\_end} = \text{today}$).
* **SQL Aggregation:**
  ```sql
  SELECT 
      c.id AS category_id,
      c.name AS category_name,
      c.color AS category_color,
      COALESCE(SUM(le.amount), 0) AS category_total
  FROM ledger_entries le
  JOIN transactions t ON le.transaction_id = t.id
  JOIN categories c ON le.category_id = c.id
  WHERE t.user_id = :user_id
    AND le.entry_type = 'DEBIT'
    AND c.category_type = 'EXPENSE'
    AND CAST(t.transaction_date AS DATE) >= :cycle_start
    AND CAST(t.transaction_date AS DATE) <= :cycle_end
  GROUP BY c.id, c.name, c.color
  ORDER BY category_total DESC;
  ```
* **Deterministic Percentage Arithmetic:**
  1. Compute cycle total expense:
     $$\text{total\_spent} = \sum \text{category\_total}$$
  2. If $\text{total\_spent} == 0$: return `items = []`, $\text{total\_spent} = \text{Decimal('0.00')}$.
  3. For each category:
     $$\text{percentage} = \left( \frac{\text{category\_total}}{\text{total\_spent}} \times 100 \right)\text{.quantize(Decimal('0.1'))}$$
* Return a strongly-typed `CategorySpendingBreakdownReport`:
  ```python
  class CategoryBreakdownItem(NamedTuple):
      category_id: UUID
      category_name: str
      amount: Decimal
      percentage: Decimal
      color: str

  class CategorySpendingBreakdownReport(NamedTuple):
      period: str  # 'monthly'
      cycle_start_date: date
      cycle_end_date: date
      total_spent: Decimal
      items: List[CategoryBreakdownItem]
  ```

---

### 3.3 Endpoint: `GET /api/v1/analytics/spending-breakdown`

#### 3.3.1 Query Specification & Route Declaration
* **Path:** `/api/v1/analytics/spending-breakdown`
* **Method:** `GET`
* **Authentication:** `Bearer <JWT_ACCESS_TOKEN>` (via `get_current_user`)
* **Query Parameter:**
  * `period: str = Query("daily", pattern="^(daily|monthly)$")`
* **HTTP Status Codes:**
  * `200 OK`: Successful breakdown retrieval.
  * `401 Unauthorized`: Missing or invalid JWT.
  * `422 Unprocessable Entity`: Any period other than `daily` or `monthly` (e.g., `period=yearly` triggers FastAPI/Pydantic regex validation failure).

#### 3.3.2 Strict Pydantic Response Models
```python
from datetime import date
from decimal import Decimal
from typing import List, Literal, Union
from uuid import UUID
from pydantic import BaseModel, Field

class DailySpendingItemModel(BaseModel):
    date: date
    day_label: str = Field(..., description="Localized Indonesian day abbreviation (e.g. Sen, Sel, Rab)")
    amount: Decimal = Field(..., description="Total expenses recorded on this day")
    safe_runway_threshold: Decimal = Field(..., description="Benchmark daily safe runway threshold")
    is_over_budget: bool = Field(..., description="True if amount exceeds safe_runway_threshold")

class DailySpendingResponse(BaseModel):
    period: Literal["daily"]
    daily_safe_runway: Decimal
    total_spent_in_period: Decimal
    items: List[DailySpendingItemModel]

class CategorySpendingItemModel(BaseModel):
    category_id: UUID
    category_name: str
    amount: Decimal
    percentage: Decimal = Field(..., description="Percentage of total cycle spending, e.g. 42.5")
    color: str

class MonthlySpendingResponse(BaseModel):
    period: Literal["monthly"]
    cycle_start_date: date
    cycle_end_date: date
    total_spent: Decimal
    items: List[CategorySpendingItemModel]

SpendingBreakdownResponse = Union[DailySpendingResponse, MonthlySpendingResponse]
```

#### 3.3.3 Sample JSON Payloads

**Daily Response (`?period=daily`):**
```json
{
  "period": "daily",
  "daily_safe_runway": 70000.00,
  "total_spent_in_period": 395000.00,
  "items": [
    {
      "date": "2026-09-13",
      "day_label": "Min",
      "amount": 35000.00,
      "safe_runway_threshold": 70000.00,
      "is_over_budget": false
    },
    {
      "date": "2026-09-14",
      "day_label": "Sen",
      "amount": 45000.00,
      "safe_runway_threshold": 70000.00,
      "is_over_budget": false
    },
    {
      "date": "2026-09-15",
      "day_label": "Sel",
      "amount": 62000.00,
      "safe_runway_threshold": 70000.00,
      "is_over_budget": false
    },
    {
      "date": "2026-09-16",
      "day_label": "Rab",
      "amount": 28000.00,
      "safe_runway_threshold": 70000.00,
      "is_over_budget": false
    },
    {
      "date": "2026-09-17",
      "day_label": "Kam",
      "amount": 85000.00,
      "safe_runway_threshold": 70000.00,
      "is_over_budget": true
    },
    {
      "date": "2026-09-18",
      "day_label": "Jum",
      "amount": 55000.00,
      "safe_runway_threshold": 70000.00,
      "is_over_budget": false
    },
    {
      "date": "2026-09-19",
      "day_label": "Sab",
      "amount": 85000.00,
      "safe_runway_threshold": 70000.00,
      "is_over_budget": true
    }
  ]
}
```

**Monthly Response (`?period=monthly`):**
```json
{
  "period": "monthly",
  "cycle_start_date": "2026-09-01",
  "cycle_end_date": "2026-09-19",
  "total_spent": 1000000.00,
  "items": [
    {
      "category_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "category_name": "Makanan & Minuman",
      "amount": 450000.00,
      "percentage": 45.0,
      "color": "#6366f1"
    },
    {
      "category_id": "7ca85f64-5717-4562-b3fc-2c963f66afa7",
      "category_name": "Kebutuhan Kos",
      "amount": 250000.00,
      "percentage": 25.0,
      "color": "#10b981"
    },
    {
      "category_id": "8da85f64-5717-4562-b3fc-2c963f66afa8",
      "category_name": "Transportasi",
      "amount": 200000.00,
      "percentage": 20.0,
      "color": "#0ea5e9"
    },
    {
      "category_id": "9ea85f64-5717-4562-b3fc-2c963f66afa9",
      "category_name": "Hiburan",
      "amount": 100000.00,
      "percentage": 10.0,
      "color": "#f59e0b"
    }
  ]
}
```

---

## 4. Frontend Architecture & Impeccable Design Standards

The Web client implements the **HeroUI** design philosophy and uses **Framer Motion** (`motion/react` / `framer-motion`) primitives to deliver high tactile responsiveness, fluid micro-interactions, and accessible feedback loops.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                DashboardPage                                │
│  • Manages reactive refresh trigger (refreshTrigger counter)               │
│  • Coordinates OmniInputHero submission and child view synchronization      │
└───────────────────────┬─────────────────────────────┬───────────────────────┘
                        │                             │
                        ▼                             ▼
         ┌─────────────────────────────┐┌─────────────────────────────┐
         │        OmniInputHero        ││        ExpenseCharts        │
         │  • Drag & Drop Zone         ││  • Dynamic Fetching         │
         │  • Thumbnail Preview        ││  • Period Toggle (D/M)      │
         │  • Multipart FormData Post  ││  • Framer Motion Bar Charts │
         │  • Direct /ai-receipt Call  ││  • Zero-Data Empty States   │
         └─────────────────────────────┘└─────────────────────────────┘
```

### 4.1 UI Design Tokens & Styling Primitives
* **Design Philosophy:** Dark-mode first, high visual hierarchy, clean financial typography.
* **Palette:**
  * Backgrounds: `slate-950` (base), `slate-900/90` (card surface), `slate-800/80` (elevated control).
  * Brand Accents: `indigo-600` (primary CTA), `indigo-400` (subtle glyph accent), `indigo-500/25` (ambient borders).
  * Telemetry Status:
    * `emerald-400` / `emerald-500`: Healthy / within runway.
    * `rose-400` / `rose-500`: Critical / exceeded daily safe runway limit.
    * `amber-400` / `amber-500`: Impending commitments / warnings.
* **Typography:** `tabular-nums` applied across all Rupiah figures, currency amounts, percentages, and dates to eliminate visual jitter during transitions.

---

### 4.2 OmniInputHero Component Specification

#### 4.2.1 Component State & Interaction Model
1. **Drag-and-Drop Dropzone:**
   - Listens to `onDragEnter`, `onDragOver`, `onDragLeave`, and `onDrop` events on the outer container.
   - Sets `isDraggingOver: boolean`. When active:
     - Container border transitions from `border-indigo-500/25` to `border-indigo-400 border-dashed bg-indigo-950/40 shadow-indigo-500/20`.
     - Ambient background displays a pulsating receipt drop icon.
   - On drop: Inspects `e.dataTransfer.files[0]`. Validates MIME against `image/jpeg`, `image/png`, `image/webp`. If valid, assigns to `file` state; otherwise displays immediate client validation error.
2. **Client Thumbnail Preview with Object URL:**
   - When a valid file is staged:
     - Generates object URL: `const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);`.
     - Ensures proper memory hygiene by executing `URL.revokeObjectURL(previewUrl)` in a cleanup effect.
   - Renders a floating preview pill containing:
     - Aspect-square $40\times 40\text{px}$ image thumbnail with rounded corners and subtle border.
     - Filename and formatted file size (e.g. `struk_bca.jpg (142 KB)`).
     - Accessible "Hapus" button (with `aria-label="Hapus lampiran struk"`) that resets `file` to `null` and clears the native input element.
3. **Smart Network Dispatch (Multipart vs. JSON):**
   - The submission contract:
     ```typescript
     interface OmniInputHeroProps {
       onSubmit: (payload: { text: string; file: File | null }) => Promise<void>;
       isLoading: boolean;
     }
     ```
   - If `file !== null`:
     - Creates a `FormData` instance:
       ```typescript
       const formData = new FormData();
       formData.append('file', file);
       if (text.trim()) {
         formData.append('message', text.trim());
       }
       ```
     - Submits via `apiFetch('/dashboard/ai-receipt', { method: 'POST', body: formData })`.
   - If `file === null`:
     - Submits via `apiFetch('/dashboard/ai-chat', { method: 'POST', body: JSON.stringify({ message: text.trim() }) })`.
4. **Spring Animations & Micro-Interactions:**
   - Uses `motion.div` from `framer-motion` for the file preview pill:
     `initial={{ opacity: 0, y: 8, scale: 0.95 }}`
     `animate={{ opacity: 1, y: 0, scale: 1 }}`
     `exit={{ opacity: 0, y: -8, scale: 0.95 }}`
     `transition={{ type: "spring", stiffness: 350, damping: 25 }}`

---

### 4.3 ExpenseCharts Component Specification

#### 4.3.1 Dynamic Client-Side Fetching
The component replaces all hardcoded static arrays with active client-side network requests:
* **Props Contract:**
  ```typescript
  interface ExpenseChartsProps {
    refreshTrigger?: number; // Monotonically increasing counter from parent
  }
  ```
* **Fetch Lifecycle:**
  - Manages `period: 'daily' | 'monthly'`.
  - Re-triggers query whenever `period` changes OR `refreshTrigger` increments.
  - Endpoint queried: `/analytics/spending-breakdown?period=${period}`.
  - Tracks loading (`isLoading`) and error (`error`) states.

#### 4.3.2 Animated Daily Bar Chart Architecture
* **Layout:** A relative coordinate frame with 7 columns corresponding to the returned contiguous dates.
* **Bar Sizing Algorithm:**
  - Determine local maximum:
    $$\text{max\_amount} = \max(\text{safe\_runway\_threshold}, \max_{i}(\text{item}_i.\text{amount}))$$
  - Height percentage for day $i$:
    $$\text{height\_pct} = \begin{cases} 
      0\% & \text{if } \text{item}_i.\text{amount} == 0 \\
      \max\left(6\%, \left(\frac{\text{item}_i.\text{amount}}{\text{max\_amount}}\right) \times 100\right) & \text{if } \text{item}_i.\text{amount} > 0 
    \end{cases}$$
* **Threshold Reference Line:**
  - An absolute horizontal dashed rule rendered at:
    $$\text{line\_bottom\_pct} = \left(\frac{\text{safe\_runway\_threshold}}{\text{max\_amount}}\right) \times 100$$
  - Displays indicator tag: `"Batas Jatah Harian: Rp {safe_runway_threshold}"`.
* **Motion Spring Animation:**
  - Each bar animates vertically:
    ```tsx
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: `${height_pct}%` }}
      transition={{ type: "spring", stiffness: 220, damping: 20, delay: index * 0.05 }}
      className={item.is_over_budget ? "bg-rose-500" : "bg-indigo-500"}
    />
    ```
* **Accessible Tooltip / Popover:**
  - Hovering over a bar reveals exact date, expenditure, and budget deviation (e.g. `+Rp 15.000 melebihi jatah` or `-Rp 25.000 hemat`).

#### 4.3.3 Animated Monthly Category Breakdown Architecture
* **Layout:** Ordered vertical list of categories sorted descending by expenditure.
* **Row Composition:**
  - Category header: Name, Rupiah formatted amount (`Rp 450.000`), and percentage share pill (`45.0%`).
  - Progress bar track (`h-2.5 bg-slate-800 rounded-full overflow-hidden`).
  - Progress fill with dynamic background color (using category's registered hex color or fallback to palette tokens) and spring animation:
    ```tsx
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${item.percentage}%` }}
      transition={{ type: "spring", stiffness: 180, damping: 22, delay: index * 0.08 }}
      style={{ backgroundColor: item.color }}
      className="h-full rounded-full"
    />
    ```

#### 4.3.4 Accessible Zero-Data Empty State
If the API returns `items: []` (or all amounts are `0.00`):
* Renders an accessible empty state container with:
  * Soft slate illustration / `BarChart3` icon in `slate-600`.
  * Headline: *"Belum Ada Pengeluaran Tercatat"*.
  * Copy: *"Belum ada transaksi pengeluaran pada periode ini. Unggah struk atau ketik transaksi Anda pada Omni-Input di atas untuk melihat analitik langsung."*
  * Avoids awkward broken zero-height axes or NaN percentage divisions.

---

### 4.4 DashboardPage Reactive Refresh Synchronization

`DashboardPage.tsx` serves as the central state coordinator:
1. Maintains a state variable: `const [refreshTrigger, setRefreshTrigger] = useState<number>(0);`.
2. When `OmniInputHero` completes submission (whether through `/dashboard/ai-chat` or `/dashboard/ai-receipt`):
   ```typescript
   // 1. Fetch updated summary KPIs (Runway, Liquid Cash, Upcoming Bills)
   // 2. Fetch updated recent transaction list
   await loadData();
   // 3. Trigger immediate re-query of charts
   setRefreshTrigger((prev) => prev + 1);
   ```
3. Passes `refreshTrigger` to `<ExpenseCharts refreshTrigger={refreshTrigger} />`.
4. This ensures that uploading a receipt immediately recalculates:
   - Safe daily runway telemetry.
   - Account balance deductions.
   - Daily spending bar for today.
   - Monthly category share progress bars.
   - Ledger transactions table.
   Zero manual browser reloads required.

---

## 5. Error Handling & Edge Cases

| Failure Mode / Edge Case | Detection Layer | Error Code / Handling Behavior | User & System Consequence |
|---|---|---|---|
| **Unsupported File MIME** (e.g. `.pdf`, `.txt`, `.heic`, `.zip`) | FastAPI `ai-receipt` router | `400 Bad Request` | Transaction rejected; user notified to upload JPEG, PNG, or WebP; 0 database writes. |
| **Payload > 10MB** | FastAPI `ai-receipt` router | `413 Payload Too Large` | Stream aborted; returns friendly Indonesian payload limit message; prevents OOM. |
| **Empty File Upload** (0 bytes) | FastAPI `ai-receipt` router | `400 Bad Request` | Rejects empty stream; prompts user to select a valid image file. |
| **Unreadable / Corrupted Receipt** (Blurry photo, cut-off total) | `ReActAgent` / Gemini Vision | Returns `{"action": "unknown"}` | Responds: *"⚠️ Struk tidak terbaca jelas. Pastikan foto terang dan menampilkan total belanja."*; No ledger mutation. |
| **Missing Account in Receipt** (Receipt does not specify payment method) | `AgentOrchestrator._resolve_account` | Fallback to highest balance account | If user has accounts, charges highest liquid balance account; if 0 accounts exist, fails gracefully with setup instructions. |
| **New Unrecognized Category** (e.g. "Klinik Hewan") | `AgentOrchestrator._resolve_or_create_category` | Auto-provisions category | Automatically creates Category row scoped to `user_id` with `EXPENSE` type; preserves foreign key integrity. |
| **Zero Spending Days in 7-Day Window** | `RunwayService.get_daily_spending_breakdown` | Zero-filling sequence | Date sequence guaranteed complete; days with no transactions output `amount: 0.00`, `is_over_budget: false`. |
| **Zero Spending in Current Billing Cycle** | `RunwayService.get_category_spending_breakdown` | Empty list with `total_spent: 0.00` | Returns empty `items: []`; prevents division by zero (`amount / total_spent`); UI renders empty state. |
| **Yearly Query Request** (`?period=yearly`) | FastAPI Query Regex Validation | `422 Unprocessable Entity` | Immediate rejection at schema gateway; enforces Zero-Bloat Invariant. |
| **Gemini Rate Limit (HTTP 429 / 503)** | `RotaryKeyPool` | Key rotation & cooldown | Switches to next API key automatically; retries request; transparent to user. |
| **Network Failure during Multipart Upload** | Frontend `apiFetch` | Catches network exception | UI displays error notice banner; re-enables submit button; preserves typed text and staged file. |

---

## 6. Testing Strategy & Quality Gates

The implementation must pass strict automated quality gates across backend and frontend before deployment.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            QUALITY GATE PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Backend Lint & Types    │ ruff check . ; mypy rezekify                   │
│ 2. Backend Unit & API      │ pytest tests/test_runway_service.py            │
│                            │ pytest tests/test_api_endpoints.py             │
│ 3. Frontend Build & Types  │ cd frontend && npx tsc --noEmit                │
│ 4. Frontend Unit & UI      │ cd frontend && npm run test (Vitest)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Backend Test Plan (`pytest`)

#### 6.1.1 Runway Analytics Unit Tests (`tests/test_runway_service.py`)
1. **`test_get_daily_spending_breakdown_continuous_seven_days`:**
   - Sets up a user with a transaction on Day 1, Day 3, and Day 7.
   - Verifies that `get_daily_spending_breakdown()` returns exactly 7 items.
   - Verifies that Day 2, 4, 5, and 6 contain `amount == Decimal("0.00")`.
   - Verifies that `is_over_budget` is correctly set to `True` only when `amount > daily_safe_runway`.
2. **`test_get_category_spending_breakdown_current_billing_cycle`:**
   - Populates transactions in previous billing cycle and current billing cycle.
   - Verifies that only current cycle transactions are included.
   - Verifies that percentages sum up to $100.0\%$ (allowing for decimal quantize rounding).
   - Verifies ordering by `amount` descending.
3. **`test_get_category_spending_breakdown_zero_expenses`:**
   - Tests a new user with zero transactions.
   - Confirms return of `total_spent == Decimal("0.00")` and `items == []` without `ZeroDivisionError`.

#### 6.1.2 REST Endpoint Tests (`tests/test_api_endpoints.py`)
1. **`test_ai_receipt_upload_success`:**
   - Uses `TestClient` to post `multipart/form-data` with dummy JPEG image bytes to `/api/v1/dashboard/ai-receipt`.
   - Mocks `AgentOrchestrator.handle_receipt` returning structured expense.
   - Asserts HTTP 200, validates presence of `reply`, `transaction_id`, and `extracted_data`.
2. **`test_ai_receipt_upload_invalid_mime`:**
   - Posts a file with `content_type="application/pdf"` or `text/plain`.
   - Asserts HTTP 400 Bad Request.
3. **`test_ai_receipt_upload_size_limit_exceeded`:**
   - Posts a simulated stream exceeding 10MB ($11\text{ MB}$).
   - Asserts HTTP 413 Payload Too Large.
4. **`test_analytics_spending_breakdown_daily_endpoint`:**
   - Queries `GET /api/v1/analytics/spending-breakdown?period=daily`.
   - Asserts HTTP 200 and validates against `DailySpendingResponse` schema.
5. **`test_analytics_spending_breakdown_monthly_endpoint`:**
   - Queries `GET /api/v1/analytics/spending-breakdown?period=monthly`.
   - Asserts HTTP 200 and validates against `MonthlySpendingResponse` schema.
6. **`test_analytics_spending_breakdown_rejects_yearly`:**
   - Queries `GET /api/v1/analytics/spending-breakdown?period=yearly`.
   - Asserts HTTP 422 Unprocessable Entity (confirming Zero-Bloat Invariant).

---

### 6.2 Frontend Test Plan (`vitest` + `@testing-library/react`)

#### 6.2.1 `OmniInputHero.test.tsx`
1. **Drag-and-Drop Interaction:**
   - Simulates `dragenter`, `dragover`, and `drop` with mock image `File`.
   - Asserts that file thumbnail appears and displays filename and size.
2. **File Removal:**
   - Clicks "Hapus" button on the thumbnail pill.
   - Asserts that staged file is cleared and thumbnail unmounts.
3. **Multipart FormData Dispatch:**
   - Stages a mock image file, inputs text, and submits the form.
   - Verifies that `onSubmit` receives `{ text, file }` and triggers `POST` to `/dashboard/ai-receipt` with a `FormData` instance containing `file` and `message`.
4. **Text-Only Submission Fallback:**
   - Submits text without a file.
   - Verifies fallback dispatch to `/dashboard/ai-chat` with JSON body.

#### 6.2.2 `ExpenseCharts.test.tsx`
1. **Dynamic Data Fetching:**
   - Mocks `apiFetch` returning daily breakdown data.
   - Renders component; asserts that daily bars render with Rupiah amounts.
2. **Period Switching:**
   - Clicks "Bulanan (Monthly)" toggle.
   - Asserts call to `/analytics/spending-breakdown?period=monthly`.
   - Verifies rendering of category progress bars and percentage labels.
3. **Zero-Data State:**
   - Mocks `apiFetch` returning empty `items: []`.
   - Asserts that empty state headline *"Belum Ada Pengeluaran Tercatat"* is rendered.
4. **Reactive Refresh:**
   - Updates `refreshTrigger` prop.
   - Asserts that `apiFetch` is re-invoked to pull fresh analytics data.

#### 6.2.3 `DashboardPage.test.tsx`
1. **Receipt Ingestion to Dashboard Refresh Flow:**
   - Simulates receipt submission in `OmniInputHero`.
   - Verifies that `loadData` runs and `refreshTrigger` increments, updating summary telemetry, recent transactions table, and `ExpenseCharts`.

---

## 7. Implementation Roadmap & File Changes

The implementation will be executed systematically following the Red $\rightarrow$ Green $\rightarrow$ Refactor lifecycle:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXECUTION ROADMAP                                │
├──────┬──────────────────────────────────────────┬───────────────────────────┤
│ Step │ Action & Component                       │ Primary Files             │
├──────┼──────────────────────────────────────────┼───────────────────────────┤
│ 1    │ RunwayService Analytics Methods (TDD)    │ rezekify/services/runway.py│
│      │ • get_daily_spending_breakdown           │ tests/test_runway_servi...│
│      │ • get_category_spending_breakdown        │                           │
├──────┼──────────────────────────────────────────┼───────────────────────────┤
│ 2    │ Backend Analytics & Receipt Endpoints    │ rezekify/api/v1/dashbo... │
│      │ • POST /api/v1/dashboard/ai-receipt      │ tests/test_api_endpoin... │
│      │ • GET /api/v1/analytics/spending-break...│                           │
├──────┼──────────────────────────────────────────┼───────────────────────────┤
│ 3    │ Frontend API Types & Client Method       │ frontend/src/types/api.ts │
│      │ • SpendingBreakdownResponse models       │ frontend/src/services/... │
│      │ • FormData handling in apiFetch          │                           │
├──────┼──────────────────────────────────────────┼───────────────────────────┤
│ 4    │ Frontend OmniInputHero Modernization     │ frontend/src/component... │
│      │ • Drag & drop dropzone + thumbnail       │ frontend/src/__tests__... │
│      │ • FormData submission                    │                           │
├──────┼──────────────────────────────────────────┼───────────────────────────┤
│ 5    │ Frontend ExpenseCharts Modernization     │ frontend/src/component... │
│      │ • Client-side fetch + period toggle      │ frontend/src/__tests__... │
│      │ • Framer Motion bars + zero state        │                           │
├──────┼──────────────────────────────────────────┼───────────────────────────┤
│ 6    │ DashboardPage Reactive Integration       │ frontend/src/pages/Das... │
│      │ • refreshTrigger synchronization         │ frontend/src/__tests__... │
├──────┼──────────────────────────────────────────┼───────────────────────────┤
│ 7    │ Quality Gate Verification                │ pytest, ruff, vitest, tsc │
└──────┴──────────────────────────────────────────┴───────────────────────────┘
```

---

## 8. Intellectual Property (HKI) Technical Summary

This specification constitutes a core technical module of the computer program registered under the title:
> **"Rezekify: Sistem Manajemen Keuangan Personal Otonom Berbasis Pembukuan Berpasangan Deterministik dan Orkestrasi Agen Multimodal"**

### Technical Claims:
1. **Claim 1 (Deterministic Analytics via Ledger Isolation):**
   A computer-implemented method for computing daily spending benchmarks and cycle category percentages directly from double-entry balanced ledger entries, isolating statistical calculations from generative artificial intelligence models to eliminate computational hallucination.
2. **Claim 2 (Multipart Multimodal Ingestion Pipeline):**
   A secure, streaming multipart ingestion architecture validating image MIME signatures and size boundaries prior to rotary key agent allocation, ensuring zero-downtime parsing across distributed multimodal vision models without financial calculation leakage.
3. **Claim 3 (Reactive Runway Dashboard Synchronization):**
   A state-synchronized user interface paradigm wherein asynchronous extraction of receipt artifacts deterministically triggers simultaneous updates across liquid cash metrics, daily safe runway benchmarks, and historical telemetry charts without full client reloads.

---
*End of Design Specification.*
