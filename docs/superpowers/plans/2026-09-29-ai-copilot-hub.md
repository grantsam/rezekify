# AI Copilot Hub & Live Interactive Financial Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Rezekify's AI experience from a fleeting 44px terminal strip and toast notification into a full-featured, persistent AI Copilot Hub (`AIChatView`) with a real-time sticky telemetry strip, rich interactive transaction action bubbles (with one-click inline cancel), an expanding multimodal console, database-persisted chat history, and an AI spotlight hero on the overview dashboard.

**Architecture:** Add a tenant-isolated `chat_messages` table linked to `transactions` via Alembic migration `006`. Enrich the backend `/api/v1/dashboard/ai-chat*` endpoints to return structured transaction entities and telemetry snapshots alongside natural replies. Build dedicated React components (`AIChatView`, `ChatTelemetryStrip`, `ChatMessageList`, `ChatTransactionCard`, `ChatOmniInput`) and integrate the `'chat'` route into `Sidebar`, `BottomDock`, and `OverviewView`.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, React 18, TypeScript, Tailwind CSS, HeroUI, Lucide React, Framer Motion, Vitest, Pytest.

**Spec:** `docs/superpowers/specs/2026-09-29-ai-copilot-hub-design.md`

## Global Constraints
- Core Invariant 1: All balances, double-entry ledger entries, and daily safe runway calculations run strictly in Python with `decimal.Decimal`. The LLM never computes money.
- Core Invariant 2: Double-entry balanced ledger ($\sum \text{Debit} = \sum \text{Credit}$).
- Core Invariant 3: Row-level tenant isolation: `WHERE user_id = current_user_id` enforced on all chat queries and mutations.
- Impeccable Design: Dark slate background (`#0c0c0e`, surface `#141417`, card `#1c1c21`), minimum 38px/44px touch targets, mobile responsiveness (360px up to 4K), accessible contrast, motion transitions <= 250ms.
- Deterministic rollbacks: Canceling a transaction via chat card deletes the transaction via double-entry rollback and refreshes telemetry immediately.

## Review Focus
1. Chat message tenant leakage: Ensure `GET` and `DELETE /api/v1/dashboard/ai-chat/messages` strictly filter by `current_user.id` and never return or modify another tenant's messages.
2. Transaction deletion cascade / set null: Ensure deleting a transaction (from ledger or inline button) sets `chat_messages.transaction_id = NULL` without deleting or corrupting the chat message row itself.
3. Multimodal error resiliency: When custom BYOK or unsupported capability fails (e.g. Anthropic audio), ensure the error response is cleanly persisted and formatted without crashing the chat list UI.
4. Telemetry synchronization: Ensure the sticky telemetry strip in `AIChatView` and the dashboard telemetry numbers remain strictly in sync after chat mutations or transaction cancellations.
5. Multimodal voice & receipt attachments: Ensure image preview thumbnail and audio recording can be cancelled cleanly without memory leaks or hanging media streams.

---

### Task 1: Data Model (`ChatMessage`) & Alembic Migration 006

**Files:**
- Modify: `rezekify/db/models.py:150-220`
- Create: `rezekify/db/migrations/versions/006_ai_chat_messages.py`
- Test: `tests/test_chat_messages_model.py`

**Interfaces:**
- Produces: `ChatMessage` model (`id`, `user_id`, `role`, `content`, `transaction_id`, `metadata_json`, `created_at`) with relationships on `User.chat_messages` and `Transaction.chat_message`.

- [ ] **Step 1: Write the failing model and migration test**

```python
# tests/test_chat_messages_model.py
import uuid
import pytest
from sqlalchemy import inspect
from rezekify.db.models import User, Transaction, ChatMessage

def test_chat_message_model_fields_and_relationships(db_session, sample_user):
    tx = Transaction(
        user_id=sample_user.id,
        description="Makan siang",
        source_channel="WEB_AI",
    )
    db_session.add(tx)
    db_session.commit()

    msg_user = ChatMessage(
        user_id=sample_user.id,
        role="user",
        content="makan siang 45rb",
    )
    msg_ai = ChatMessage(
        user_id=sample_user.id,
        role="assistant",
        content="✅ Tercatat: Rp 45,000",
        transaction_id=tx.id,
        metadata_json='{"action": "expense"}',
    )
    db_session.add_all([msg_user, msg_ai])
    db_session.commit()

    db_session.refresh(sample_user)
    db_session.refresh(tx)

    assert len(sample_user.chat_messages) == 2
    assert tx.chat_message is not None
    assert tx.chat_message.id == msg_ai.id

    # Test transaction delete sets transaction_id to NULL (ON DELETE SET NULL)
    db_session.delete(tx)
    db_session.commit()

    db_session.refresh(msg_ai)
    assert msg_ai.transaction_id is None
    assert msg_ai.content == "✅ Tercatat: Rp 45,000"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_chat_messages_model.py -v`
Expected: FAIL with `ImportError: cannot import name 'ChatMessage' from 'rezekify.db.models'`

- [ ] **Step 3: Implement `ChatMessage` model in `rezekify/db/models.py` and Alembic migration `006`**

Add `ChatMessage` to `rezekify/db/models.py`:
```python
class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("idx_chat_messages_user_created", "user_id", "created_at"),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(20), nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    transaction_id = Column(
        GUID,
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="chat_messages")
    transaction = relationship("Transaction", back_populates="chat_message")
```
Add `chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")` to `User`.
Add `chat_message = relationship("ChatMessage", back_populates="transaction", uselist=False)` to `Transaction`.

Create Alembic migration `rezekify/db/migrations/versions/006_ai_chat_messages.py` with `down_revision = "005_multi_provider_byok"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_chat_messages_model.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/db/models.py rezekify/db/migrations/versions/006_ai_chat_messages.py tests/test_chat_messages_model.py
git commit -m "feat(db): add ChatMessage model and 006 migration"
```

---

### Task 2: Orchestrator Enriched Result Packaging

**Files:**
- Modify: `rezekify/agent/orchestrator.py:136-240`
- Test: `tests/test_agent_orchestrator.py`

**Interfaces:**
- Consumes: `LedgerService`, `RunwayService`.
- Produces: `AgentOrchestrator.handle_message_async` and `handle_voice_async` return a dictionary containing `reply`, `transaction_id`, `transaction_summary`, and `telemetry`.

- [ ] **Step 1: Write failing test for enriched orchestrator return structure**

```python
# tests/test_agent_orchestrator.py (append)
@pytest.mark.asyncio
async def test_handle_message_async_returns_enriched_dict_with_transaction(db_session, sample_user):
    from rezekify.db.models import Account, AccountType
    acc = Account(
        user_id=sample_user.id,
        name="Kas",
        account_type=AccountType.CASH,
        current_balance=Decimal("100000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities_async = AsyncMock(
        return_value={
            "action": "expense",
            "amount": 25000,
            "account_name": "Kas",
            "category_name": "Makanan",
            "note": "Nasi Goreng",
        }
    )

    result = await orchestrator.handle_message_async(
        user_id=sample_user.id,
        text="beli nasi goreng 25rb kas",
    )
    assert isinstance(result, dict)
    assert "reply" in result
    assert "Rp 25,000" in result["reply"]
    assert result["transaction_id"] is not None
    assert result["transaction"]["amount"] == Decimal("25000")
    assert result["transaction"]["account_name"] == "Kas"
    assert result["telemetry"]["operational_free_cash"] is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_agent_orchestrator.py -k test_handle_message_async_returns_enriched_dict_with_transaction -v`
Expected: FAIL because `handle_message_async` currently returns a raw `str`.

- [ ] **Step 3: Update `AgentOrchestrator._execute_action` to return structured payload**

Modify `_execute_action` so it returns `Dict[str, Any]` with:
- `reply: str`
- `transaction_id: Optional[UUID]`
- `transaction: Optional[Dict[str, Any]]` (id, amount, account_name, category_name, description, type, account_balance_after)
- `telemetry: Optional[Dict[str, Any]]` (operational_free_cash, daily_safe_runway, days_remaining, health_status)

Update existing callers or add backwards-compatibility helper if needed.

- [ ] **Step 4: Run tests to verify all orchestrator tests pass**

Run: `pytest tests/test_agent_orchestrator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/orchestrator.py tests/test_agent_orchestrator.py
git commit -m "feat(orchestrator): return structured transaction and telemetry payload"
```

---

### Task 3: Backend REST API Endpoints for AI Chat History & Enriched Processing

**Files:**
- Create: `rezekify/schemas/chat.py`
- Modify: `rezekify/api/v1/dashboard_router.py:150-250`
- Test: `tests/test_dashboard_ai_chat.py`

**Interfaces:**
- Produces:
  - `GET /api/v1/dashboard/ai-chat/messages` -> `List[ChatMessageResponse]`
  - `POST /api/v1/dashboard/ai-chat` -> `EnrichedChatResponse`
  - `POST /api/v1/dashboard/ai-receipt` -> `EnrichedChatResponse`
  - `POST /api/v1/dashboard/ai-voice` -> `EnrichedChatResponse`
  - `DELETE /api/v1/dashboard/ai-chat/messages` -> `{"status": "cleared"}`

- [ ] **Step 1: Write failing tests for chat endpoints**

```python
# tests/test_dashboard_ai_chat.py
from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4
from fastapi.testclient import TestClient
from rezekify.api.main import app
from rezekify.core.security import create_access_token
from rezekify.db.models import Account, AccountType, ChatMessage

def test_chat_messages_lifecycle_and_tenant_isolation(sample_user, db_session):
    client = TestClient(app)
    token = create_access_token({"sub": str(sample_user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Post a chat message
    with patch(
        "rezekify.agent.orchestrator.AgentOrchestrator.handle_message_async",
        new_callable=AsyncMock,
        return_value={
            "reply": "✅ Tercatat: Rp 30,000",
            "transaction_id": None,
            "transaction": None,
            "telemetry": {
                "operational_free_cash": Decimal("100000"),
                "daily_safe_runway": Decimal("10000"),
                "days_remaining": 10,
                "health_status": "HEALTHY",
            },
        },
    ):
        res = client.post("/api/v1/dashboard/ai-chat", json={"message": "beli bensin 30rb"}, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "reply" in data
        assert data["telemetry"]["operational_free_cash"] == 100000

    # 2. Get chat history
    get_res = client.get("/api/v1/dashboard/ai-chat/messages", headers=headers)
    assert get_res.status_code == 200
    messages = get_res.json()
    assert len(messages) >= 2
    assert messages[-2]["role"] == "user"
    assert messages[-2]["content"] == "beli bensin 30rb"
    assert messages[-1]["role"] == "assistant"

    # 3. Clear chat messages
    del_res = client.delete("/api/v1/dashboard/ai-chat/messages", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "cleared"

    # 4. Verify messages are empty
    get_res_after = client.get("/api/v1/dashboard/ai-chat/messages", headers=headers)
    assert len(get_res_after.json()) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_dashboard_ai_chat.py -v`
Expected: FAIL with 404 or 422 for `/ai-chat/messages`

- [ ] **Step 3: Implement schemas in `rezekify/schemas/chat.py` and endpoints in `dashboard_router.py`**

In `rezekify/schemas/chat.py`:
- `TransactionSummary`
- `TelemetrySnapshot`
- `EnrichedChatResponse`
- `ChatMessageResponse`

In `rezekify/api/v1/dashboard_router.py`:
- Implement `GET /ai-chat/messages` (filtering by `current_user.id`, sorted by `created_at ASC`).
- Implement `DELETE /ai-chat/messages` (deletes user's chat messages, leaves transactions intact).
- Update `POST /ai-chat`, `POST /ai-receipt`, `POST /ai-voice` to persist messages to `chat_messages` table and return `EnrichedChatResponse`.

- [ ] **Step 4: Run tests to verify all chat tests pass**

Run: `pytest tests/test_dashboard_ai_chat.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/schemas/chat.py rezekify/api/v1/dashboard_router.py tests/test_dashboard_ai_chat.py
git commit -m "feat(api): implement chat messages history and enriched responses"
```

---

### Task 4: Frontend API Client & Types

**Files:**
- Modify: `frontend/src/types/api.ts:60-110`
- Modify: `frontend/src/services/apiClient.ts:180-220`
- Test: `frontend/src/__tests__/apiClient.test.ts`

**Interfaces:**
- Produces:
  - TypeScript interfaces: `ChatMessageItem`, `TransactionSummary`, `TelemetrySnapshot`, `EnrichedChatResponse`.
  - API functions: `getChatMessages()`, `clearChatMessages()`, `submitChatMessage()`, `submitChatReceipt()`, `submitChatVoice()`.

- [ ] **Step 1: Write failing frontend tests for apiClient chat methods**

```typescript
// frontend/src/__tests__/apiClient.test.ts (add test block)
describe('apiClient chat endpoints', () => {
  it('getChatMessages fetches list of messages', async () => {
    // mock apiFetch returning mock ChatMessageItem[]
  });

  it('clearChatMessages calls DELETE /dashboard/ai-chat/messages', async () => {
    // mock apiFetch returning { status: 'cleared' }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- -t "apiClient chat endpoints"`
Expected: FAIL (functions not defined)

- [ ] **Step 3: Implement types in `api.ts` and functions in `apiClient.ts`**

Export:
```typescript
export interface TransactionSummary {
  id: string;
  amount: number;
  account_name: string;
  category_name: string;
  description: string;
  type: string;
  account_balance_after?: number;
}

export interface TelemetrySnapshot {
  operational_free_cash: number;
  daily_safe_runway: number;
  days_remaining: number;
  health_status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface EnrichedChatResponse {
  reply: string;
  message_id?: string;
  transaction?: TransactionSummary;
  telemetry?: TelemetrySnapshot;
  transcription?: string;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  transaction_id?: string | null;
  transaction?: TransactionSummary | null;
  created_at: string;
  metadata?: Record<string, any>;
}
```

Add `getChatMessages`, `clearChatMessages`, `submitChatMessage`, `submitChatReceipt`, `submitChatVoice` to `apiClient.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- -t "apiClient chat endpoints"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/services/apiClient.ts frontend/src/__tests__/apiClient.test.ts
git commit -m "feat(frontend): add chat API client methods and types"
```

---

### Task 5: Interactive Chat Transaction Card Component

**Files:**
- Create: `frontend/src/components/ChatTransactionCard.tsx`
- Test: `frontend/src/__tests__/ChatTransactionCard.test.tsx`

**Interfaces:**
- Consumes: `TransactionSummary`, `onCancelTransaction(id: string)`, `onViewInLedger()`.
- Produces: Rendered card with formatted amount, account, category, balance after, and inline cancel button with loading and disabled states.

- [ ] **Step 1: Write failing test for `ChatTransactionCard`**

```typescript
// frontend/src/__tests__/ChatTransactionCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatTransactionCard } from '../components/ChatTransactionCard';

describe('ChatTransactionCard', () => {
  const sampleTx = {
    id: 'tx-123',
    amount: 45000,
    account_name: 'BCA',
    category_name: 'Makanan',
    description: 'Makan siang',
    type: 'EXPENSE',
    account_balance_after: 955000,
  };

  it('renders amount, category, account, and remaining balance', () => {
    render(<ChatTransactionCard transaction={sampleTx} onCancel={vi.fn()} onViewLedger={vi.fn()} />);
    expect(screen.getByText(/Rp\s*45[.,]000/)).toBeInTheDocument();
    expect(screen.getByText('BCA')).toBeInTheDocument();
    expect(screen.getByText('Makanan')).toBeInTheDocument();
  });

  it('triggers onCancel when Batalkan button is clicked', () => {
    const handleCancel = vi.fn();
    render(<ChatTransactionCard transaction={sampleTx} onCancel={handleCancel} onViewLedger={vi.fn()} />);
    const cancelBtn = screen.getByRole('button', { name: /batalkan transaksi/i });
    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledWith('tx-123');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- -t "ChatTransactionCard"`
Expected: FAIL (component not found)

- [ ] **Step 3: Implement `ChatTransactionCard.tsx`**

Build component adhering to Impeccable standards:
- Dark slate surface `#141417`, border `border-zinc-800/80`.
- Minimum 38px touch target for buttons.
- State for `isCancelling` and `isCancelled`.
- Color coded badge for transaction type.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- -t "ChatTransactionCard"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatTransactionCard.tsx frontend/src/__tests__/ChatTransactionCard.test.tsx
git commit -m "feat(frontend): implement ChatTransactionCard component"
```

---

### Task 6: Sticky Telemetry Strip Component

**Files:**
- Create: `frontend/src/components/ChatTelemetryStrip.tsx`
- Test: `frontend/src/__tests__/ChatTelemetryStrip.test.tsx`

**Interfaces:**
- Consumes: `telemetry: TelemetrySnapshot | null`, `onResetChat: () => void`, `isResetting?: boolean`.
- Produces: Sticky top bar with operational free cash, daily safe runway, days remaining, health indicator, and reset chat button.

- [ ] **Step 1: Write failing test for `ChatTelemetryStrip`**

```typescript
// frontend/src/__tests__/ChatTelemetryStrip.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatTelemetryStrip } from '../components/ChatTelemetryStrip';

describe('ChatTelemetryStrip', () => {
  const sampleTelemetry = {
    operational_free_cash: 1740000,
    daily_safe_runway: 145000,
    days_remaining: 12,
    health_status: 'HEALTHY' as const,
  };

  it('renders operational free cash, safe runway, and health status', () => {
    render(<ChatTelemetryStrip telemetry={sampleTelemetry} onResetChat={vi.fn()} />);
    expect(screen.getByText(/Rp\s*1[.,]740[.,]000/)).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*145[.,]000/)).toBeInTheDocument();
    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
  });

  it('calls onResetChat when reset button is confirmed', () => {
    const onReset = vi.fn();
    render(<ChatTelemetryStrip telemetry={sampleTelemetry} onResetChat={onReset} />);
    const resetBtn = screen.getByRole('button', { name: /bersihkan riwayat/i });
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- -t "ChatTelemetryStrip"`
Expected: FAIL

- [ ] **Step 3: Implement `ChatTelemetryStrip.tsx`**

Build with Framer Motion number pulse on changes, WCAG-compliant status badges (`HEALTHY` = emerald, `WARNING` = amber, `CRITICAL` = rose), and minimum 38px touch targets.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- -t "ChatTelemetryStrip"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatTelemetryStrip.tsx frontend/src/__tests__/ChatTelemetryStrip.test.tsx
git commit -m "feat(frontend): implement ChatTelemetryStrip component"
```

---

### Task 7: Multimodal Omni Console Component

**Files:**
- Create: `frontend/src/components/ChatOmniInput.tsx`
- Test: `frontend/src/__tests__/ChatOmniInput.test.tsx`

**Interfaces:**
- Consumes:
  - `onSubmit: (text: string, file: File | null) => Promise<void> | void`
  - `onVoiceSubmit: (blob: Blob, caption?: string) => Promise<void> | void`
  - `isLoading?: boolean`
- Produces: Expanding textarea, image dropzone/attachment preview, voice recorder controls, send button.

- [ ] **Step 1: Write failing test for `ChatOmniInput`**

```typescript
// frontend/src/__tests__/ChatOmniInput.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatOmniInput } from '../components/ChatOmniInput';

describe('ChatOmniInput', () => {
  it('submits text when Enter is pressed (without Shift)', () => {
    const handleSubmit = vi.fn();
    render(<ChatOmniInput onSubmit={handleSubmit} onVoiceSubmit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/tanya atau catat/i);
    fireEvent.change(textarea, { target: { value: 'makan 20rb bca' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(handleSubmit).toHaveBeenCalledWith('makan 20rb bca', null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- -t "ChatOmniInput"`
Expected: FAIL

- [ ] **Step 3: Implement `ChatOmniInput.tsx`**

Include:
- Multiline expanding textarea (`rows={1}`, max height 160px).
- Camera/Struk attachment button + chip preview with remove (X) button.
- Voice recording visualizer with duration timer, cancel, and stop/send buttons.
- Modern send button with loading spinner when `isLoading` is true.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- -t "ChatOmniInput"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatOmniInput.tsx frontend/src/__tests__/ChatOmniInput.test.tsx
git commit -m "feat(frontend): implement ChatOmniInput component"
```

---

### Task 8: Dedicated AI Copilot View (`AIChatView`) & Message List

**Files:**
- Create: `frontend/src/components/ChatMessageList.tsx`
- Create: `frontend/src/components/AIChatView.tsx`
- Test: `frontend/src/__tests__/AIChatView.test.tsx`

**Interfaces:**
- Consumes: `onNavigateToLedger: () => void`, `onDataMutated: () => Promise<void>`.
- Produces: Full view managing message feed, sticky telemetry, optimistic updates, and auto-scroll to latest message.

- [ ] **Step 1: Write failing test for `AIChatView`**

```typescript
// frontend/src/__tests__/AIChatView.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AIChatView } from '../components/AIChatView';
import * as apiClient from '../services/apiClient';

vi.mock('../services/apiClient');

describe('AIChatView', () => {
  it('loads and renders chat message history on mount', async () => {
    vi.spyOn(apiClient, 'getChatMessages').mockResolvedValue([
      { id: '1', role: 'user', content: 'halo ai', created_at: new Date().toISOString() },
      { id: '2', role: 'assistant', content: 'Halo! Ada yang bisa saya bantu?', created_at: new Date().toISOString() },
    ]);

    render(<AIChatView onNavigateToLedger={vi.fn()} onDataMutated={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('halo ai')).toBeInTheDocument();
      expect(screen.getByText('Halo! Ada yang bisa saya bantu?')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- -t "AIChatView"`
Expected: FAIL

- [ ] **Step 3: Implement `ChatMessageList.tsx` and `AIChatView.tsx`**

Integrate:
- `ChatTelemetryStrip` at the top with live data.
- Scrollable message container with auto-scroll on new message.
- Support rendering user bubbles and assistant bubbles.
- When an assistant message has a `transaction`, embed `ChatTransactionCard`.
- Cancel transaction handler calling `deleteTransaction` and refreshing telemetry.
- `ChatOmniInput` pinned at the bottom.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- -t "AIChatView"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatMessageList.tsx frontend/src/components/AIChatView.tsx frontend/src/__tests__/AIChatView.test.tsx
git commit -m "feat(frontend): implement AIChatView and ChatMessageList"
```

---

### Task 9: Navigation Shell & Dock Integration

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx:45-75`
- Modify: `frontend/src/components/BottomDock.tsx:15-60`
- Modify: `frontend/src/components/AppLayout.tsx:6-30`
- Test: `frontend/src/__tests__/NavigationShell.test.tsx`

**Interfaces:**
- Consumes: `activeView: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings'`.
- Produces: Sidebar with "AI Copilot" item (`Sparkles` icon), BottomDock with elevated glowing Copilot button.

- [ ] **Step 1: Update navigation tests for 'chat' view item**

```typescript
// frontend/src/__tests__/NavigationShell.test.tsx
it('renders AI Copilot navigation link and responds to click', () => {
  const onViewChange = vi.fn();
  render(<Sidebar activeView="overview" onViewChange={onViewChange} accounts={[]} user={null} onLogout={vi.fn()} onOpenCreateAccount={vi.fn()} />);
  const copilotBtn = screen.getByRole('button', { name: /ai copilot/i });
  expect(copilotBtn).toBeInTheDocument();
  fireEvent.click(copilotBtn);
  expect(onViewChange).toHaveBeenCalledWith('chat');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- -t "AI Copilot navigation link"`
Expected: FAIL

- [ ] **Step 3: Update `Sidebar.tsx`, `BottomDock.tsx`, and `AppLayout.tsx`**

In `Sidebar.tsx`:
Add `{ id: 'chat' as const, label: 'AI Copilot', icon: Sparkles }` after `overview`.

In `BottomDock.tsx`:
Center button switches to `onViewChange('chat')` with `Sparkles` icon and ambient glow.

In `AppLayout.tsx`:
Update TypeScript types to allow `'chat'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- -t "Navigation Shell Components"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/BottomDock.tsx frontend/src/components/AppLayout.tsx frontend/src/__tests__/NavigationShell.test.tsx
git commit -m "feat(navigation): add AI Copilot to Sidebar, BottomDock, and AppLayout"
```

---

### Task 10: Overview Dashboard AI Spotlight Hero & DashboardPage Integration

**Files:**
- Create: `frontend/src/components/AISpotlightHero.tsx`
- Modify: `frontend/src/components/OverviewView.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Test: `frontend/src/__tests__/OverviewView.test.tsx`
- Test: `frontend/src/__tests__/DashboardPage.test.tsx`

**Interfaces:**
- Produces:
  - `AISpotlightHero` replacing `QuickCaptureBar` on Overview.
  - Clicking prompt chips routes to `activeView = 'chat'` and pre-populates or submits prompt.
  - `DashboardPage` renders `AIChatView` when `activeView === 'chat'`.

- [ ] **Step 1: Write failing test for AISpotlightHero on OverviewView**

```typescript
// frontend/src/__tests__/OverviewView.test.tsx
it('renders AI Spotlight Hero banner with quick prompt suggestions', () => {
  const onOpenChat = vi.fn();
  render(<OverviewView summary={mockSummary} vaults={[]} accounts={[]} isLoading={false} onNavigateToVaults={vi.fn()} onOpenCreateAccount={vi.fn()} onOpenSimulateModal={vi.fn()} onOpenChat={onOpenChat} />);
  expect(screen.getByText(/Asisten Keuangan Rezekify/i)).toBeInTheDocument();
  const chip = screen.getByText(/Catat makan siang/i);
  fireEvent.click(chip);
  expect(onOpenChat).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- -t "renders AI Spotlight Hero banner"`
Expected: FAIL

- [ ] **Step 3: Implement `AISpotlightHero.tsx`, update `OverviewView.tsx` and `DashboardPage.tsx`**

Remove old `QuickCaptureBar` from `DashboardPage.tsx` overview view.
Add `AISpotlightHero` in `OverviewView.tsx`.
Render `<AIChatView />` when `activeView === 'chat'` in `DashboardPage.tsx`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix frontend test -- -t "DashboardPage Component"`
Run: `npm --prefix frontend test -- -t "OverviewView Component"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AISpotlightHero.tsx frontend/src/components/OverviewView.tsx frontend/src/pages/DashboardPage.tsx frontend/src/__tests__/OverviewView.test.tsx frontend/src/__tests__/DashboardPage.test.tsx
git commit -m "feat(dashboard): integrate AISpotlightHero and mount AIChatView"
```

---

### Task 11: End-to-End Verification & Quality Polish

**Files:**
- Test: Full backend suite (`pytest`)
- Test: Full frontend suite (`vitest run`)
- Typecheck: `mypy rezekify` & `tsc --noEmit`

- [ ] **Step 1: Run backend test suite**

Run: `pytest`
Expected: 310+ passed, 0 failures.

- [ ] **Step 2: Run frontend test suite & typecheck**

Run: `npm --prefix frontend run build` (or `npx --prefix frontend tsc --noEmit`)
Run: `npm --prefix frontend test -- --run`
Expected: 220+ tests passed, 0 failures.

- [ ] **Step 3: Run Impeccable UI polish check**

Verify 38px/44px touch targets, contrast ratios, and responsive behavior across 360px mobile and desktop viewports.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: verify end-to-end full test suite for AI Copilot Hub"
```
