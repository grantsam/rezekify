# Frontend Full-Stack Integration & Autonomous User Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete end-to-end user flow across frontend and backend: dedicated authentication state gating (`AuthContext`, `AuthPage`, navbar user profile & logout), account creation modal (`AccountModal`) with empty-state onboarding, fixed commitments modal (`VaultModal`), real-time what-if purchase simulator (`SimulatePurchaseModal` + `POST /api/v1/dashboard/simulate-purchase`), real multipart web receipt OCR ingestion (`POST /api/v1/dashboard/ai-receipt`), and dynamic reactive dashboard integration.

**Architecture:** A decoupled client-server architecture where FastAPI provides authenticated REST endpoints and multipart receipt ingestion, React 18 uses a lightweight `AuthContext` to gate access between `AuthPage` and `DashboardPage`, and modular action modals (`AccountModal`, `VaultModal`, `SimulatePurchaseModal`, `ManualTransactionModal`) trigger reactive re-fetching of deterministic runway telemetry.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0, Pydantic v2, PostgreSQL / SQLite in-memory, React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Vitest, `@testing-library/react`.

**Spec:** `docs/specs/2026-09-19-frontend-full-integration-design.md`

## Global Constraints
* **Deterministic Accounting:** Zero LLM calculation of balances, runway thresholds, or category percentages; all money arithmetic runs in Python `decimal.Decimal` and PostgreSQL `NUMERIC(15, 2)`.
* **Balanced Ledger:** Every transaction posted from manual entry or receipt OCR must enforce $\sum \text{Debit} = \sum \text{Credit}$.
* **Row-Level Tenant Isolation:** Every query, aggregation, and mutation enforces `WHERE user_id = current_user.id`.
* **Rotary Key Resilience:** Vision OCR calls utilize `RotaryKeyPool.from_env("GEMINI_API_KEYS")` with automatic HTTP 429 key failover.
* **Zero-Bloat Scope:** Focus strictly on Daily Safe Runway and H-7 Upcoming Bills.
* **Multipart Boundaries:** Allowed MIME types for receipt images: `image/jpeg`, `image/png`, `image/webp`; maximum payload size: 10MB ($10 \times 1024 \times 1024 = 10,485,760\text{ bytes}$); empty files rejected with HTTP 400.
* **Typography:** `tabular-nums` applied across all Rupiah amounts, percentages, and dates in the frontend.

---

### Task 1: Backend Endpoint: What-If Purchase Simulator (`POST /api/v1/dashboard/simulate-purchase`)

**Files:**
- Modify: `rezekify/api/v1/dashboard_router.py`
- Test: `tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: `RunwayService.simulate_purchase(user_id: UUID, planned_amount: Decimal)` from `rezekify.services.runway`.
- Produces:
  ```python
  class SimulatePurchaseRequest(BaseModel):
      planned_amount: Decimal

  class SimulatePurchaseResponse(BaseModel):
      current_daily_runway: Decimal
      projected_daily_runway: Decimal
      daily_drop_amount: Decimal
      is_safe: bool
      advice: str

  @dashboard_router.post("/simulate-purchase", response_model=SimulatePurchaseResponse)
  def simulate_purchase_endpoint(
      req: SimulatePurchaseRequest,
      current_user: User = Depends(get_current_user),
      db: Session = Depends(get_db),
  ) -> SimulatePurchaseResponse: ...
  ```

- [ ] **Step 1: Write the failing test for simulate-purchase endpoint**

Append to `tests/test_api_endpoints.py`:
```python
def test_simulate_purchase_api(client: TestClient, auth_headers: dict):
    # Set up holding account with funds so operational free cash exists
    client.post(
        "/api/v1/accounts",
        json={"name": "Simulate Bank", "account_type": "BANK", "initial_balance": 1500000.00},
        headers=auth_headers,
    )

    res = client.post(
        "/api/v1/dashboard/simulate-purchase",
        json={"planned_amount": 300000.00},
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "current_daily_runway" in data
    assert "projected_daily_runway" in data
    assert "daily_drop_amount" in data
    assert "is_safe" in data
    assert "advice" in data
    assert Decimal(str(data["daily_drop_amount"])) > Decimal("0.00")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api_endpoints.py::test_simulate_purchase_api -v`
Expected: FAIL with status 404 or 405 (endpoint does not exist yet).

- [ ] **Step 3: Implement minimal code in `dashboard_router.py`**

In `rezekify/api/v1/dashboard_router.py`, add schemas and route:
```python
class SimulatePurchaseRequest(BaseModel):
    planned_amount: Decimal


class SimulatePurchaseResponse(BaseModel):
    current_daily_runway: Decimal
    projected_daily_runway: Decimal
    daily_drop_amount: Decimal
    is_safe: bool
    advice: str


@dashboard_router.post("/simulate-purchase", response_model=SimulatePurchaseResponse)
def simulate_purchase_endpoint(
    req: SimulatePurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Simulates the cognitive and runway drop of a planned purchase."""
    if req.planned_amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Nominal belanja harus lebih besar dari 0.")
    service = RunwayService(db)
    report = service.simulate_purchase(user_id=current_user.id, planned_amount=req.planned_amount)
    return SimulatePurchaseResponse(
        current_daily_runway=report.current_daily_runway,
        projected_daily_runway=report.projected_daily_runway,
        daily_drop_amount=report.daily_drop_amount,
        is_safe=report.is_safe,
        advice=report.advice,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_api_endpoints.py::test_simulate_purchase_api -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/api/v1/dashboard_router.py tests/test_api_endpoints.py
git commit -m "feat(api): add what-if purchase simulation endpoint"
```

---

### Task 2: Backend Endpoint: Multipart Web Receipt OCR Ingestion (`POST /api/v1/dashboard/ai-receipt`)

**Files:**
- Modify: `rezekify/api/v1/dashboard_router.py`
- Test: `tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: `AgentOrchestrator.handle_message(user_id, text, image_bytes)`
- Produces:
  ```python
  @dashboard_router.post("/ai-receipt", response_model=ChatResponse)
  async def ai_receipt_upload(
      file: UploadFile = File(...),
      message: Optional[str] = Form(None),
      current_user: User = Depends(get_current_user),
      db: Session = Depends(get_db),
  ) -> ChatResponse: ...
  ```

- [ ] **Step 1: Write the failing test for ai-receipt endpoint**

Append to `tests/test_api_endpoints.py`:
```python
import io
from unittest.mock import patch

def test_ai_receipt_upload_endpoint(client: TestClient, auth_headers: dict):
    fake_image = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb")
    with patch("rezekify.agent.orchestrator.AgentOrchestrator.handle_message", return_value="✅ Tercatat: Rp 50,000 via BCA"):
        res = client.post(
            "/api/v1/dashboard/ai-receipt",
            files={"file": ("receipt.jpg", fake_image, "image/jpeg")},
            data={"message": "Catat struk ini"},
            headers=auth_headers,
        )
    assert res.status_code == 200
    assert "Tercatat" in res.json()["reply"]

def test_ai_receipt_upload_invalid_mime(client: TestClient, auth_headers: dict):
    fake_txt = io.BytesIO(b"not an image")
    res = client.post(
        "/api/v1/dashboard/ai-receipt",
        files={"file": ("receipt.txt", fake_txt, "text/plain")},
        headers=auth_headers,
    )
    assert res.status_code == 400
    assert "Format file tidak didukung" in res.json()["detail"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api_endpoints.py::test_ai_receipt_upload_endpoint -v`
Expected: FAIL with status 404 (endpoint not defined).

- [ ] **Step 3: Implement minimal code in `dashboard_router.py`**

In `rezekify/api/v1/dashboard_router.py`, import `File`, `Form`, `UploadFile`, and implement:
```python
ALLOWED_RECEIPT_MIMES = {"image/jpeg", "image/png", "image/webp"}
MAX_RECEIPT_BYTES = 10 * 1024 * 1024  # 10 Megabytes


@dashboard_router.post("/ai-receipt", response_model=ChatResponse)
async def ai_receipt_upload(
    file: UploadFile = File(...),
    message: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Processes multimodal receipt image uploads via Gemini Vision OCR."""
    if file.content_type not in ALLOWED_RECEIPT_MIMES:
        raise HTTPException(
            status_code=400,
            detail="Format file tidak didukung. Harap unggah file gambar (JPEG, PNG, WebP).",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File gambar kosong.")
    if len(content) > MAX_RECEIPT_BYTES:
        raise HTTPException(status_code=400, detail="Ukuran file melebihi batas maksimal 10MB.")

    orchestrator = AgentOrchestrator(db=db, key_pool=RotaryKeyPool.from_env("GEMINI_API_KEYS"))
    prompt_text = (message or "").strip() or "Foto struk kasir"
    reply = orchestrator.handle_message(
        user_id=current_user.id, text=prompt_text, image_bytes=content
    )
    return ChatResponse(reply=reply)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_api_endpoints.py::test_ai_receipt_upload_endpoint tests/test_api_endpoints.py::test_ai_receipt_upload_invalid_mime -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/api/v1/dashboard_router.py tests/test_api_endpoints.py
git commit -m "feat(api): add authenticated multipart receipt ocr upload endpoint"
```

---

### Task 3: Frontend Client Auth State & Provider (`frontend/src/context/AuthContext.tsx`)

**Files:**
- Create: `frontend/src/context/AuthContext.tsx`
- Create: `frontend/src/__tests__/AuthContext.test.tsx`
- Modify: `frontend/src/types/api.ts`

**Interfaces:**
- Consumes: `apiFetch`, `setAuthToken`, `getAuthToken`, `clearAuthToken` from `../services/apiClient`.
- Produces:
  ```typescript
  export interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    telegram_chat_id?: number | null;
  }

  export interface AuthContextType {
    user: UserProfile | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, fullName: string) => Promise<void>;
    logout: () => void;
  }

  export const AuthProvider: React.FC<{ children: React.ReactNode }> = ...
  export const useAuth = (): AuthContextType => ...
  ```

- [ ] **Step 1: Write the failing test for `AuthContext`**

Create `frontend/src/__tests__/AuthContext.test.tsx`:
```tsx
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import * as apiClient from '../services/apiClient';

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('initializes with null user when no token is present', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('successfully logs in and stores token', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/auth/login') return { access_token: 'fake_jwt_token', token_type: 'bearer' } as any;
      if (endpoint === '/auth/me') return { id: 'u1', email: 'user@rezekify.id', full_name: 'Test User' } as any;
      throw new Error('Unknown endpoint');
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await act(async () => {
      await result.current.login('user@rezekify.id', 'Password123!');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.full_name).toBe('Test User');
    expect(localStorage.getItem('rezekify_auth_token')).toBe('fake_jwt_token');
  });

  it('logs out and clears local storage', async () => {
    localStorage.setItem('rezekify_auth_token', 'initial_token');
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValueOnce({ id: 'u1', email: 'a@b.c', full_name: 'Test' } as any);

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('rezekify_auth_token')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test frontend/src/__tests__/AuthContext.test.tsx` (inside `frontend/`)
Expected: FAIL with "Cannot find module '../context/AuthContext'".

- [ ] **Step 3: Implement `frontend/src/context/AuthContext.tsx`**

Create `frontend/src/context/AuthContext.tsx`:
```tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch, getAuthToken, setAuthToken, clearAuthToken } from '../services/apiClient';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  telegram_chat_id?: number | null;
}

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const profile = await apiFetch<UserProfile>('/auth/me');
      setUser(profile);
      return profile;
    } catch {
      clearAuthToken();
      setTokenState(null);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getAuthToken();
      if (storedToken) {
        setTokenState(storedToken);
        await fetchProfile();
      }
      setIsLoading(false);
    };
    initAuth();
  }, [fetchProfile]);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ access_token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.access_token);
      setTokenState(res.access_token);
      await fetchProfile();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ access_token: string; user: UserProfile }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      setAuthToken(res.access_token);
      setTokenState(res.access_token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    clearAuthToken();
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test frontend/src/__tests__/AuthContext.test.tsx` (inside `frontend/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/context/AuthContext.tsx frontend/src/__tests__/AuthContext.test.tsx
git commit -m "feat(frontend): add auth context and session provider"
```

---

### Task 4: Frontend Dedicated Auth View (`frontend/src/pages/AuthPage.tsx`)

**Files:**
- Create: `frontend/src/pages/AuthPage.tsx`
- Create: `frontend/src/__tests__/AuthPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth` from `../context/AuthContext`.
- Produces: `export const AuthPage: React.FC = () => ...`

- [ ] **Step 1: Write the failing test for `AuthPage`**

Create `frontend/src/__tests__/AuthPage.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthPage } from '../pages/AuthPage';
import * as AuthContextModule from '../context/AuthContext';

describe('AuthPage Component', () => {
  it('renders login form by default and allows switching to register tab', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<AuthPage />);
    expect(screen.getByText(/Masuk ke Rezekify/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/nama@email.com/i)).toBeDefined();

    // Switch to register tab
    const registerTab = screen.getByRole('button', { name: /Daftar Akun/i });
    fireEvent.click(registerTab);
    expect(screen.getByPlaceholderText(/Nama Lengkap Anda/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test frontend/src/__tests__/AuthPage.test.tsx` (inside `frontend/`)
Expected: FAIL with "Cannot find module '../pages/AuthPage'".

- [ ] **Step 3: Implement `frontend/src/pages/AuthPage.tsx`**

Create `frontend/src/pages/AuthPage.tsx`:
```tsx
import React, { useState } from 'react';
import { Sparkles, Lock, Mail, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthPage: React.FC = () => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        if (!fullName.trim()) {
          throw new Error('Nama lengkap wajib diisi.');
        }
        await register(email, password, fullName);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat memproses permintaan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden text-slate-100">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl mb-3">
            <Sparkles className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
            Rezekify
          </h1>
          <p className="text-xs text-slate-400 mt-1">Autonomous Multi-Modal Runway Manager</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => { setTab('login'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'login' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Masuk (Login)
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'register' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Daftar Akun
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Nama Lengkap</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama Lengkap Anda"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Alamat Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Kata Sandi</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{tab === 'login' ? 'Masuk ke Rezekify' : 'Buat Akun Sekarang'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test frontend/src/__tests__/AuthPage.test.tsx` (inside `frontend/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AuthPage.tsx frontend/src/__tests__/AuthPage.test.tsx
git commit -m "feat(frontend): implement dedicated auth page with login and register tabs"
```

---

### Task 5: Frontend Account Creation Modal (`frontend/src/components/AccountModal.tsx`)

**Files:**
- Create: `frontend/src/components/AccountModal.tsx`
- Create: `frontend/src/__tests__/AccountModal.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` from `../services/apiClient`
- Produces:
  ```typescript
  export interface AccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => Promise<void> | void;
  }
  export const AccountModal: React.FC<AccountModalProps> = ...
  ```

- [ ] **Step 1: Write the failing test for `AccountModal`**

Create `frontend/src/__tests__/AccountModal.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountModal } from '../components/AccountModal';
import * as apiClient from '../services/apiClient';

describe('AccountModal Component', () => {
  it('renders form inputs and dispatches POST /accounts upon submit', async () => {
    const postSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValueOnce({ id: 'acc-1' } as any);
    const onSuccessMock = vi.fn();
    const onCloseMock = vi.fn();

    render(<AccountModal isOpen={true} onClose={onCloseMock} onSuccess={onSuccessMock} />);

    fireEvent.change(screen.getByPlaceholderText(/BCA, Mandiri, GoPay/i), {
      target: { value: 'Bank BCA' },
    });
    fireEvent.change(screen.getByPlaceholderText(/0/i), {
      target: { value: '1500000' },
    });

    const submitBtn = screen.getByRole('button', { name: /Simpan Rekening/i });
    fireEvent.click(submitBtn);

    expect(postSpy).toHaveBeenCalledWith('/accounts', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        name: 'Bank BCA',
        account_type: 'BANK',
        initial_balance: 1500000,
      }),
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test frontend/src/__tests__/AccountModal.test.tsx` (inside `frontend/`)
Expected: FAIL with "Cannot find module '../components/AccountModal'".

- [ ] **Step 3: Implement `frontend/src/components/AccountModal.tsx`**

Create `frontend/src/components/AccountModal.tsx`:
```tsx
import React, { useState } from 'react';
import { X, Landmark, Wallet, Banknote, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import { AccountType } from '../types/api';

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('BANK');
  const [initialBalance, setInitialBalance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const parsedBalance = parseFloat(initialBalance) || 0;
      await apiFetch('/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          account_type: accountType,
          initial_balance: parsedBalance,
        }),
      });
      setName('');
      setInitialBalance('');
      await onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menyimpan rekening.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Tambah Rekening / Dompet</h3>
              <p className="text-xs text-slate-400">Sumber dana likuid untuk transaksi keuangan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Nama Rekening / Akun</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: BCA, Mandiri, GoPay, Dompet Tunai"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Kategori / Tipe Akun</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'BANK' as AccountType, label: 'Bank', icon: Landmark },
                { type: 'EWALLET' as AccountType, label: 'e-Wallet', icon: Wallet },
                { type: 'CASH' as AccountType, label: 'Tunai', icon: Banknote },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAccountType(type)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                    accountType === type
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Saldo Awal (Rp)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm text-slate-500 font-semibold">Rp</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm tabular-nums placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Rekening'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test frontend/src/__tests__/AccountModal.test.tsx` (inside `frontend/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AccountModal.tsx frontend/src/__tests__/AccountModal.test.tsx
git commit -m "feat(frontend): implement account creation modal"
```

---

### Task 6: Frontend Fixed Commitments & Vault Creation Modal (`frontend/src/components/VaultModal.tsx`)

**Files:**
- Create: `frontend/src/components/VaultModal.tsx`
- Create: `frontend/src/__tests__/VaultModal.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` from `../services/apiClient`
- Produces:
  ```typescript
  export interface VaultModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => Promise<void> | void;
  }
  export const VaultModal: React.FC<VaultModalProps> = ...
  ```

- [ ] **Step 1: Write the failing test for `VaultModal`**

Create `frontend/src/__tests__/VaultModal.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VaultModal } from '../components/VaultModal';
import * as apiClient from '../services/apiClient';

describe('VaultModal Component', () => {
  it('submits fixed commitment bill payload to POST /vaults', async () => {
    const postSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValueOnce({ id: 'v-1' } as any);
    const onSuccessMock = vi.fn();
    const onCloseMock = vi.fn();

    render(<VaultModal isOpen={true} onClose={onCloseMock} onSuccess={onSuccessMock} />);

    fireEvent.change(screen.getByPlaceholderText(/Sewa Kos, Tagihan WiFi, Cicilan/i), {
      target: { value: 'Sewa Kos' },
    });
    fireEvent.change(screen.getByPlaceholderText(/1000000/i), {
      target: { value: '800000' },
    });

    const submitBtn = screen.getByRole('button', { name: /Kunci Komitmen/i });
    fireEvent.click(submitBtn);

    expect(postSpy).toHaveBeenCalledWith('/vaults', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"name":"Sewa Kos"'),
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test frontend/src/__tests__/VaultModal.test.tsx` (inside `frontend/`)
Expected: FAIL with "Cannot find module '../components/VaultModal'".

- [ ] **Step 3: Implement `frontend/src/components/VaultModal.tsx`**

Create `frontend/src/components/VaultModal.tsx`:
```tsx
import React, { useState } from 'react';
import { X, Calendar, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../services/apiClient';

export interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export const VaultModal: React.FC<VaultModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [vaultType, setVaultType] = useState<'FIXED_BILL' | 'SAVINGS'>('FIXED_BILL');
  const [targetAmount, setTargetAmount] = useState('');
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetAmount) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const parsedTarget = parseFloat(targetAmount) || 0;
      const parsedAllocated = parseFloat(allocatedAmount) || parsedTarget;
      await apiFetch('/vaults', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          vault_type: vaultType,
          target_amount: parsedTarget,
          allocated_amount: parsedAllocated,
          target_date: targetDate || null,
        }),
      });
      setName('');
      setTargetAmount('');
      setAllocatedAmount('');
      setTargetDate('');
      await onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menyimpan komitmen tagihan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Tambah Komitmen Tagihan H-7</h3>
              <p className="text-xs text-slate-400">Kunci dana agar tidak terpakai untuk belanja harian</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Nama Tagihan / Komitmen</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Sewa Kos, Tagihan WiFi, Cicilan"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Target Biaya (Rp)</label>
              <input
                type="number"
                required
                min="0"
                step="1000"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="1000000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Alokasi Terkunci (Rp)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={allocatedAmount}
                onChange={(e) => setAllocatedAmount(e.target.value)}
                placeholder="Sama dgn target"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Tanggal Jatuh Tempo (H-7)</label>
            <div className="relative">
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || !targetAmount}
              className="bg-amber-600 hover:bg-amber-500 text-white font-medium px-5 py-2.5 text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kunci Komitmen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test frontend/src/__tests__/VaultModal.test.tsx` (inside `frontend/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/VaultModal.tsx frontend/src/__tests__/VaultModal.test.tsx
git commit -m "feat(frontend): implement fixed commitments vault modal"
```

---

### Task 7: Frontend What-If Purchase Simulator Modal (`frontend/src/components/SimulatePurchaseModal.tsx`)

**Files:**
- Create: `frontend/src/components/SimulatePurchaseModal.tsx`
- Create: `frontend/src/__tests__/SimulatePurchaseModal.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` from `../services/apiClient`
- Produces:
  ```typescript
  export interface SimulatePurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
  }
  export const SimulatePurchaseModal: React.FC<SimulatePurchaseModalProps> = ...
  ```

- [ ] **Step 1: Write the failing test for `SimulatePurchaseModal`**

Create `frontend/src/__tests__/SimulatePurchaseModal.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SimulatePurchaseModal } from '../components/SimulatePurchaseModal';
import * as apiClient from '../services/apiClient';

describe('SimulatePurchaseModal Component', () => {
  it('calls POST /dashboard/simulate-purchase and displays advice', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValueOnce({
      current_daily_runway: 120000,
      projected_daily_runway: 85000,
      daily_drop_amount: 35000,
      is_safe: true,
      advice: 'Pembelian sebesar Rp 350,000 aman dilakukan.',
    } as any);

    render(<SimulatePurchaseModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/Masukkan rencana nominal belanja/i), {
      target: { value: '350000' },
    });

    const simBtn = screen.getByRole('button', { name: /Hitung Dampak/i });
    fireEvent.click(simBtn);

    expect(await screen.findByText(/Pembelian sebesar Rp 350,000 aman dilakukan/i)).toBeDefined();
    expect(screen.getByText(/Rp 85.000/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test frontend/src/__tests__/SimulatePurchaseModal.test.tsx` (inside `frontend/`)
Expected: FAIL with "Cannot find module '../components/SimulatePurchaseModal'".

- [ ] **Step 3: Implement `frontend/src/components/SimulatePurchaseModal.tsx`**

Create `frontend/src/components/SimulatePurchaseModal.tsx`:
```tsx
import React, { useState } from 'react';
import { X, Calculator, ArrowDownRight, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { apiFetch } from '../services/apiClient';

interface SimResult {
  current_daily_runway: number;
  projected_daily_runway: number;
  daily_drop_amount: number;
  is_safe: boolean;
  advice: string;
}

export interface SimulatePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SimulatePurchaseModal: React.FC<SimulatePurchaseModalProps> = ({ isOpen, onClose }) => {
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<SimResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<SimResult>('/dashboard/simulate-purchase', {
        method: 'POST',
        body: JSON.stringify({ planned_amount: parsed }),
      });
      setResult(res);
    } catch (err: any) {
      setError(err?.message || 'Gagal menghitung simulasi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Kalkulator Simulasi Belanja</h3>
              <p className="text-xs text-slate-400">Uji dampak finansial sebelum membeli barang diskresioner</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSimulate} className="space-y-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Rencana Nominal Belanja (Rp)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1000"
                step="1000"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Masukkan rencana nominal belanja (misal: 350000)"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={isLoading || !amount}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-5 py-2.5 text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hitung Dampak'}
              </button>
            </div>
          </div>
        </form>

        {error && <p className="text-xs text-rose-400 mb-4">{error}</p>}

        {result && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4 animate-in fade-in">
            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-800/80">
              <div>
                <span className="text-[11px] text-slate-400 block">Jatah Saat Ini</span>
                <span className="text-base font-bold text-slate-200 tabular-nums">
                  Rp {result.current_daily_runway.toLocaleString('id-ID')}/hari
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Proyeksi Setelah Belanja</span>
                <span className="text-base font-bold text-emerald-400 tabular-nums">
                  Rp {result.projected_daily_runway.toLocaleString('id-ID')}/hari
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/30 border border-amber-500/20 px-3 py-2 rounded-xl">
              <ArrowDownRight className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Memangkas jatah harian sebesar <strong>Rp {result.daily_drop_amount.toLocaleString('id-ID')}/hari</strong>.</span>
            </div>

            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              result.is_safe
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
            }`}>
              {result.is_safe ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <p className="leading-relaxed">{result.advice}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test frontend/src/__tests__/SimulatePurchaseModal.test.tsx` (inside `frontend/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SimulatePurchaseModal.tsx frontend/src/__tests__/SimulatePurchaseModal.test.tsx
git commit -m "feat(frontend): implement what-if purchase simulator modal"
```

---

### Task 8: Refactor `OmniInputHero` to Real Multipart FormData & File Removal

**Files:**
- Modify: `frontend/src/components/OmniInputHero.tsx`
- Modify: `frontend/src/__tests__/OmniInputHero.test.tsx`

**Interfaces:**
- Produces: `onSubmit: (text: string, file: File | null) => void`
- Allows client-side receipt file clearing via removal button.

- [ ] **Step 1: Write test asserting file removal and submit arguments**

In `frontend/src/__tests__/OmniInputHero.test.tsx`, assert that when a file is selected and submit is clicked, `onSubmit` is invoked with the `File` object.

- [ ] **Step 2: Run test to verify current state**

Run: `npm test frontend/src/__tests__/OmniInputHero.test.tsx` (inside `frontend/`)

- [ ] **Step 3: Add file removal button to `OmniInputHero.tsx`**

In `frontend/src/components/OmniInputHero.tsx`, add an `X` icon button in the preview pill to allow users to cancel or remove an attached receipt before submitting:
```tsx
{file && (
  <div className="mt-3 text-xs text-indigo-300 flex items-center justify-between bg-indigo-950/60 border border-indigo-500/30 px-3 py-1.5 rounded-lg w-fit gap-3">
    <div className="flex items-center gap-2">
      <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
      <span className="truncate max-w-[200px]">{file.name}</span>
    </div>
    <button
      type="button"
      onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
      className="text-indigo-400 hover:text-white p-0.5 rounded"
      title="Hapus file"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test frontend/src/__tests__/OmniInputHero.test.tsx` (inside `frontend/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/OmniInputHero.tsx frontend/src/__tests__/OmniInputHero.test.tsx
git commit -m "feat(frontend): enhance omni input hero with receipt removal control"
```

---

### Task 9: Dashboard Page Integration, Header Quick Actions, Empty-State Onboarding Banner & App Gating

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/__tests__/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth` from `../context/AuthContext`, `AccountModal`, `VaultModal`, `SimulatePurchaseModal`, `ManualTransactionModal`.
- Produces: Complete responsive dashboard with User Profile bar, Quick Action buttons, and empty-state banner.

- [ ] **Step 1: Write test verifying modal toggles and empty-state onboarding banner**

In `frontend/src/__tests__/DashboardPage.test.tsx`, add test cases:
1. Renders onboarding banner when `accounts.length === 0`.
2. Toggles `AccountModal` on "+ Rekening" click.
3. Toggles `VaultModal` on "+ Tagihan" click.
4. Dispatches `FormData` to `/dashboard/ai-receipt` when submitting with a file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test frontend/src/__tests__/DashboardPage.test.tsx` (inside `frontend/`)
Expected: FAIL

- [ ] **Step 3: Update `DashboardPage.tsx` and `App.tsx`**

1. In `DashboardPage.tsx`:
   - Import `useAuth`, `AccountModal`, `VaultModal`, `SimulatePurchaseModal`.
   - Add state: `isAccountModalOpen`, `isVaultModalOpen`, `isSimulateModalOpen`.
   - Update `handleAiSubmit`: If `file` is provided, create `FormData` and call `apiFetch('/dashboard/ai-receipt', { method: 'POST', body: formData })`.
   - Render Header with User Profile badge, "+ Rekening", "+ Tagihan", "Simulasi Belanja", and "Logout" buttons.
   - Render Onboarding Alert Banner when `accounts.length === 0`.
2. In `App.tsx`:
   - Wrap tree in `AuthProvider`.
   - Conditionally render `isLoading ? <LoadingSpinner /> : (isAuthenticated ? <DashboardPage /> : <AuthPage />)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` (inside `frontend/`)
Expected: All tests pass.

- [ ] **Step 5: Run frontend production build check**

Run: `npm run build` (inside `frontend/`)
Expected: Vite build succeeds with zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/App.tsx frontend/src/__tests__/DashboardPage.test.tsx
git commit -m "feat(frontend): integrate auth gating, quick actions, and receipt upload dispatch"
```

---

### Task 10: Full-Stack Verification & Live Docker Smoke Test

**Files:**
- Create: `tests/test_live_docker_integration.py`

**Interfaces:**
- Verifies live endpoints via test assertions against local container stack.

- [ ] **Step 1: Write verification test script**

Create `tests/test_live_docker_integration.py` covering:
1. `POST /api/v1/auth/register` and `POST /api/v1/auth/login`
2. `POST /api/v1/accounts` (Bank & e-Wallet)
3. `POST /api/v1/vaults` (Fixed Commitment H-7)
4. `POST /api/v1/dashboard/simulate-purchase`
5. `POST /api/v1/dashboard/ai-receipt` (multipart test)
6. `GET /api/v1/dashboard/summary`

- [ ] **Step 2: Run verification test suite**

Run: `pytest tests/test_live_docker_integration.py -v`
Expected: PASS

- [ ] **Step 3: Run full backend and frontend test suites**

Run: `pytest` (backend)
Run: `npm test` (frontend)
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/test_live_docker_integration.py
git commit -m "test(e2e): add live full-stack integration verification suite"
```
