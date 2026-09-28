# AI Copilot Hub & Live Interactive Financial Chat

Date: 2026-09-29
Status: Approved (brainstorming) — pending implementation plan
Path type: Architectural

## Intent & Success Criteria

Rezekify currently exposes its AI agent as a thin 44px terminal-style command strip (`QuickCaptureBar`) sitting above the main dashboard. AI replies only flash briefly as floating notification toasts that disappear after 4 seconds, without persistent conversation history or direct visual evidence of ledger/runway mutations.

The user wants a truly **AI-centric experience**:
1. A dedicated **AI Copilot Hub** view (`AIChatView`) accessible directly from desktop navigation and mobile bottom dock.
2. A **Sticky Financial Telemetry Strip** at the top of the chat showing live operational cash, daily safe runway, and health status that immediately pulses and reflects mutations in real time.
3. **Rich Interactive Action Bubbles**: AI responses display structured cards with transaction details (Amount, Account, Category, Remaining Account Balance) and immediate inline actions (*"Batalkan / Hapus Transaksi"*, *"Buka di Buku Besar"*).
4. **Persistent Chat History** synced in the database across user sessions (`chat_messages` table).
5. **Spotlight Hero on Dashboard**: Replaces the awkward terminal input on the Overview view with an inviting AI spotlight hero card with quick prompt chips that seamlessly route to the AI Copilot Hub.

## Decisions (Locked)

1. **Interaction Paradigm:** Dedicated AI Hub (`activeView === 'chat'`) rather than an always-open split pane or a fleeting toast notification.
2. **Chat Persistence:** Stored in PostgreSQL database (`chat_messages` table) per tenant/user, rather than transient `localStorage`.
3. **Live Feedback Contract:** The API response from `/api/v1/dashboard/ai-chat`, `/ai-receipt`, and `/ai-voice` is enriched with structured transaction details, telemetry snapshot, and a database-persisted message ID. The frontend updates local telemetry and ledger caches synchronously upon receiving the reply.
4. **Inline Transaction Rollback:** Each transaction card inside an AI bubble includes a one-click cancel/undo button that invokes the existing double-entry transaction deletion, updates the sticky telemetry bar, and marks the card as `[Dibatalkan]`.
5. **Deterministic Math Invariant:** In strict accordance with Rezekify Invariant 1 & 2, all financial calculations (runway, balance, debits/credits) continue to be calculated deterministically in Python using `decimal.Decimal`. The LLM only extracts structured entities (`action`, `amount`, `account_name`, `category_name`, `note`).
6. **Mobile Accessibility:** Minimum 38px/44px touch targets, mobile bottom dock elevated Copilot button, responsive expanding input console with camera receipt upload and voice recording.

## Design

### 1. Data Model & Database Migration
- **Table:** `chat_messages`
  - `id`: `GUID`, primary key, default `uuid.uuid4`.
  - `user_id`: `GUID`, ForeignKey(`users.id`, ondelete="CASCADE"), nullable=False, indexed.
  - `role`: `String(20)`, nullable=False (`"user"` or `"assistant"`).
  - `content`: `Text`, nullable=False.
  - `transaction_id`: `GUID`, ForeignKey(`transactions.id`, ondelete="SET NULL"), nullable=True, indexed.
  - `metadata_json`: `Text`, nullable=True (stores optional JSON string for audio transcriptions, BYOK errors, or action metadata).
  - `created_at`: `DateTime(timezone=True)`, default `utc_now`, indexed with `user_id` as `Index("idx_chat_messages_user_created", "user_id", "created_at")`.
- **Relationships:**
  - `User.chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")`
  - `Transaction.chat_message = relationship("ChatMessage", back_populates="transaction", uselist=False)`
- **Alembic Revision `006_ai_chat_messages`:**
  - Creates table `chat_messages` with proper foreign keys and indexes.
  - Downgrade drops table `chat_messages`.

### 2. Backend REST API Endpoints (`rezekify/api/v1/dashboard_router.py`)
- **Enriched Chat Response Schema:**
  ```python
  class TransactionSummary(BaseModel):
      id: UUID
      amount: Decimal
      account_name: str
      category_name: str
      description: str
      type: str  # EXPENSE, INCOME, TRANSFER
      account_balance_after: Optional[Decimal] = None

  class TelemetrySnapshot(BaseModel):
      operational_free_cash: Decimal
      daily_safe_runway: Decimal
      days_remaining: int
      health_status: str

  class EnrichedChatResponse(BaseModel):
      reply: str
      message_id: Optional[UUID] = None
      transaction: Optional[TransactionSummary] = None
      telemetry: Optional[TelemetrySnapshot] = None
      transcription: Optional[str] = None
  ```
- **Endpoints:**
  - `GET /api/v1/dashboard/ai-chat/messages`:
    - Query params: `limit: int = 50`, `offset: int = 0`.
    - Returns list of `ChatMessageResponse` sorted chronologically (oldest to newest for chat feed rendering).
    - Eager loads related `Transaction` and its ledger entries to compute `account_balance_after`.
  - `POST /api/v1/dashboard/ai-chat`:
    - Persists user message (`role="user"`).
    - Runs orchestrator `handle_message_async`.
    - Persists assistant response (`role="assistant"`, linking `transaction_id` if a transaction was recorded).
    - Computes current telemetry snapshot and returns `EnrichedChatResponse`.
  - `POST /api/v1/dashboard/ai-receipt`:
    - Persists user receipt message (`role="user"`, metadata includes file receipt indicator).
    - Runs orchestrator vision OCR.
    - Persists assistant response and returns `EnrichedChatResponse`.
  - `POST /api/v1/dashboard/ai-voice`:
    - Persists user voice message (`role="user"`, metadata includes transcription).
    - Runs voice pipeline and returns `EnrichedChatResponse`.
  - `DELETE /api/v1/dashboard/ai-chat/messages`:
    - Deletes all chat messages for `current_user.id` (resets conversation history without deleting underlying ledger transactions).

### 3. Frontend Architecture (`frontend/src/`)
- **Navigation & Routing:**
  - `Sidebar.tsx`: Add navigation item `id: 'chat'`, label: `'AI Copilot'`, icon: `Sparkles` between *Ringkasan* and *Buku Besar*.
  - `BottomDock.tsx`: Center elevated floating button switches to `'chat'`.
  - `AppLayout.tsx`: Support `activeView: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings'`.
  - `DashboardPage.tsx`: Manage active view, chat state, and coordinate data refreshes across views.
- **Components:**
  - `components/AIChatView.tsx`: Main chat container with:
    - **Header Sticky Telemetry Strip:** Live cards for Saldo Bebas, Jatah Aman Hari Ini, Sisa Siklus with real-time numeric pulse and reset chat button.
    - **Message Feed (`components/ChatMessageList.tsx`):**
      - User message bubbles (right aligned, dark slate `#1c1c21`).
      - Assistant message bubbles (left aligned, branded accent `#141417` border).
      - **Embedded Transaction Card (`components/ChatTransactionCard.tsx`):**
        - Shows formatted currency (e.g. `- Rp 45.000`), account name, category badge, description.
        - Shows updated account balance.
        - Action buttons: "Batalkan Transaksi" (calls `deleteTransaction`, flashes status, updates telemetry) and "Buka di Buku Besar" (navigates to `ledger` view).
    - **Multimodal Omni Console (`components/ChatOmniInput.tsx`):**
      - Expanding multi-line textarea with keyboard shortcuts (`Enter` to submit, `Shift+Enter` for new line).
      - Image attachment preview thumbnail with remove button.
      - Voice recording visualizer with duration timer and stop/cancel controls.
      - Branded glowing Send button (`disabled` when loading or empty).
  - `components/OverviewView.tsx`:
    - Replace `QuickCaptureBar` with **AI Assistant Spotlight Hero**:
      - Headline: *"Asisten Keuangan Rezekify"* with ambient glow.
      - Quick prompt suggestions (*"Makan siang 35rb Gopay"*, *"Cek Runway"*, *"Unggah Struk"*, *"Simulasi Beli Laptop"*).
      - Clicking any prompt navigates to `activeView = 'chat'` and pre-populates or submits the prompt.

### 4. Live Feedback Loop & Synchronization
1. When user submits text/receipt/voice in `AIChatView`:
   - Optimistic user message is appended to the message list.
   - Assistant displays a subtle animated typing/thinking indicator.
2. Upon receiving `EnrichedChatResponse`:
   - Real assistant message replaces indicator, containing rich transaction card.
   - Sticky telemetry numbers pulse and update to the new values returned in `res.telemetry`.
   - `dashboard.refreshAll()` and `ledger.loadTransactions()` are invoked in background so if the user switches to `Overview` or `Ledger`, the tables and charts are already up to date.
3. When user clicks "Batalkan Transaksi" on a transaction card:
   - Client calls `DELETE /api/v1/ledger/transactions/{id}`.
   - Card displays `[Dibatalkan]` badge and disables the cancel button.
   - Dashboard summary is refreshed, recalculating safe runway and free cash immediately.

### 5. Testing & Verification Strategy
- **Backend Tests:**
  - Unit tests for `ChatMessage` model and relationships.
  - Alembic migration test for revision `006_ai_chat_messages`.
  - API tests in `tests/test_dashboard_ai_chat.py`:
    - `GET /api/v1/dashboard/ai-chat/messages`: verifies tenant isolation, pagination, and eager loaded transaction details.
    - `POST /api/v1/dashboard/ai-chat`: verifies persistence of user and assistant messages, transaction association, and enriched response shape.
    - `DELETE /api/v1/dashboard/ai-chat/messages`: verifies clearing chat without affecting financial ledger transactions.
- **Frontend Tests:**
  - `AIChatView.test.tsx`: tests message rendering, telemetry strip updates, transaction card rendering, and input submission.
  - `ChatTransactionCard.test.tsx`: tests cancel transaction interaction and ledger navigation.
  - `OverviewView.test.tsx`: tests the new AI spotlight hero banner and prompt chip click routing.
  - `Sidebar.test.tsx` and `BottomDock.test.tsx`: verify AI Copilot navigation triggers.
  - Typecheck (`tsc --noEmit`) and full test suite run (`vitest run`, `pytest`).

## Out of Scope (YAGNI)
- Multi-session branching chat threads (single continuous stream per tenant with reset/clear option is sufficient).
- LLM streaming/tokens via WebSockets or SSE (existing low-latency REST endpoints are fast and keep deterministic ledger synchronization rock solid).
- Direct user editing of historical chat transcripts (users can delete or record new transactions).

## Blast Radius
- `rezekify/db/models.py` (adds `ChatMessage`, relationships on `User` and `Transaction`).
- Alembic migration `006_ai_chat_messages.py`.
- `rezekify/schemas/dashboard.py` / `rezekify/api/v1/dashboard_router.py`.
- `rezekify/agent/orchestrator.py` (helpers for returning enriched transaction entity if needed).
- `frontend/src/types/api.ts` (new types: `ChatMessageItem`, `EnrichedChatResponse`, `TransactionSummary`, `TelemetrySnapshot`).
- `frontend/src/components/AIChatView.tsx`, `ChatMessageList.tsx`, `ChatTransactionCard.tsx`, `ChatOmniInput.tsx`.
- `frontend/src/components/OverviewView.tsx` (removes old QuickCaptureBar, adds AI Spotlight Hero).
- `frontend/src/components/Sidebar.tsx`, `BottomDock.tsx`, `AppLayout.tsx`, `DashboardPage.tsx`.
