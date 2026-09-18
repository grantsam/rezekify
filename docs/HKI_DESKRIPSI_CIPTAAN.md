# DOKUMEN DESKRIPSI CIPTAAN PROGRAM KOMPUTER
**Kementerian Hukum dan Hak Asasi Manusia Republik Indonesia**
**Direktorat Jenderal Kekayaan Intelektual (DJKI)**

---

## 1. Identitas Ciptaan
* **Judul Ciptaan:**
  **Rezekify: Sistem Manajemen Keuangan Personal Otonom Berbasis Pembukuan Berpasangan Deterministik dan Orkestrasi Agen Multimodal**
* **Jenis Ciptaan:** Program Komputer (Perangkat Lunak / *Software*)
* **Tanggal Selesai Pembuatan:** 18 September 2026
* **Tempat Pertama Kali Diumumkan:** Jakarta, Indonesia
* **Bahasa Pemrograman & Lingkungan Pengembangan:** Python 3.12+, TypeScript 5.0+, React 18, PostgreSQL 15+, FastAPI, Tailwind CSS, Vite.
* **Arsitektur Inti:** Three-Tier Decoupled Architecture (Deterministic Core, Multimodal Agent Runtime, Dual Channel Interface).

---

## 2. Ringkasan Eksekutif & Karakteristik Inovasi
**Rezekify** adalah perangkat lunak tata kelola keuangan personal cerdas yang mengatasi kegagalan aplikasi pelacak keuangan konvensional. Sistem mengintegrasikan kecerdasan buatan multimodal (pemrosesan bahasa alami kasual berbahasa Indonesia dan pengenalan optik struk belanja kasir) dengan mesin pembukuan berpasangan (*double-entry bookkeeping*) yang berjalan secara 100% deterministik.

### Permasalahan Nyata yang Diselesaikan:
1. **Tracking Fatigue (Kelelahan Form Manual):** Pengguna konvensional meninggalkan pencatatan karena kerumitan pengisian form bertingkat (pilihan dropdown akun, kategori bertingkat, input nominal desimal). Rezekify menyediakan pencatatan otomatis nir-friksi (*zero-friction ambient ingestion*) melalui Bot Telegram resmi dan *Omni-Input Bar* web.
2. **Runway Blindness (Ketidaktahuan Jatah Belanja Aman):** Pengguna muda dan mahasiswa kerap mengalami kepanikan likuiditas (*mid-month liquidity collapse*) karena hanya melihat saldo nominal tanpa mengetahui jatah belanja aman harian setelah dikurangi cadangan komitmen wajib. Rezekify menghitung dan memproyeksikan *Daily Safe Runway* secara real-time.
3. **Halusinasi Aritmatika LLM (LLM Probabilistic Inaccuracy):** Banyak chatbot finansial melakukan halusinasi hitungan matematika uang riil pengguna. Rezekify menerapkan pemisahan arsitektur mutlak: LLM hanya bertindak sebagai parser entitas terstruktur (JSON), sedangkan seluruh mutasi saldo, kalkulasi pembagian, dan validasi debit-kredit dikerjakan oleh pustaka `decimal.Decimal` Python berstandar perbankan.

---

## 3. Arsitektur Sistem Tiga Lapis (Three-Tier Decoupled Architecture)

Perangkat lunak dibangun di atas pemisahan tanggung jawab yang ketat antar lapisan:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  LAPIS 3: KANAL ANTARMUKA PENGGUNA                      │
├────────────────────────────────────┬────────────────────────────────────┤
│         MOBILE CLIENT              │            WEB CLIENT              │
│       Telegram Messenger           │     React 18 + Vite + TS + TW      │
│   • Natural Language Texting       │  • AI Input Bar (Primary Hero)     │
│   • Direct Camera/Receipt Upload   │  • Receipt Drag-and-Drop           │
│   • Voice Note Audio Ingestion     │  • Interactive Visual Dashboard    │
│   • On-the-go Alert Notifications  │  • Auxiliary Manual CRUD Fallback  │
└─────────────────┬──────────────────┴─────────────────┬──────────────────┘
                  │                                    │
                  ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               LAPIS 2: RUNTIME ORKESTRASI AGEN & GATEWAY                │
├─────────────────────────────────────────────────────────────────────────┤
│  FastAPI Application Server                                             │
│  • Authentication (JWT Bearer Token + Bcrypt / Argon2 Password Hash)    │
│  • Telegram Gateway & Webhook (Resolves telegram_chat_id -> user_id)    │
│  • RESTful Endpoints for Accounts, Vaults, Transactions, and Analytics  │
│                                                                         │
│  Agentic Orchestration Module                                           │
│  • Rotary LLM Key Pool (Gemini 2.5 Flash Multimodal + Groq/Llama)       │
│    - Multi-key rotation with automatic HTTP 429 failover and recovery   │
│    - Operating cost: $0                                                 │
│  • ReAct Agent Loop (Reasoning + Validated Tool Invocation)             │
│  • Vision OCR & Receipt Extraction Pipeline                             │
│  • Guardrails & Clarification Engine (Infers defaults, checks limits)   │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ Validated Function Calls
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             LAPIS 1: MESIN FINANSIAL DETERMINISTIK & BASIS DATA         │
├─────────────────────────────────────────────────────────────────────────┤
│  Python Core Services (Pure Deterministic Logic)                        │
│  • Double-Entry Accounting Ledger (Strict Debit/Credit Balancing)       │
│  • Multi-Account Balance Reconciliation (Cash, Bank, E-Wallets)         │
│  • Virtual Vault Allocation (Sinking Funds, Emergency Reserves)         │
│  • Dynamic Runway & Spending Impact Simulator                           │
│                                                                         │
│  PostgreSQL Database (Row-Level Multi-Tenant Isolation)                 │
│  • users, accounts, vaults, categories, transactions, ledger_entries    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Skema Basis Data Relasional (PostgreSQL DDL)

Isolasi multi-penyewa ditegakkan secara ketat pada setiap relasi melalui foreign key `user_id` terindeks dengan `ON DELETE CASCADE`.

```sql
-- 1. Master Tabel Pengguna (Multi-Tenant Master Identity)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    telegram_chat_id BIGINT UNIQUE NULL,
    telegram_pairing_code VARCHAR(32) UNIQUE NULL,
    pairing_code_expires_at TIMESTAMP WITH TIME ZONE NULL,
    monthly_cycle_day INT NOT NULL DEFAULT 1 CHECK (monthly_cycle_day BETWEEN 1 AND 31),
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Akun Keuangan (Liquid Holding Buckets: Cash, Bank, E-Wallet)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) NOT NULL, -- CASH, BANK, EWALLET, LIABILITY
    current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Brankas Virtual (Sinking Funds & Fixed Financial Commitments)
CREATE TABLE vaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    vault_type VARCHAR(20) NOT NULL DEFAULT 'SAVINGS', -- SAVINGS, FIXED_BILL
    target_amount NUMERIC(15, 2) NOT NULL,
    allocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    target_date DATE NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Kategori Transaksi
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category_type VARCHAR(20) NOT NULL, -- EXPENSE, INCOME
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Header Transaksi Finansial (Auditable Event Log)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    raw_input_text TEXT NULL,
    receipt_image_url VARCHAR(512) NULL,
    source_channel VARCHAR(20) NOT NULL DEFAULT 'WEB_AI',
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Jurnal Garis Buku Besar Berpasangan (Balanced Ledger Entries)
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id UUID NULL REFERENCES categories(id) ON DELETE SET NULL,
    vault_id UUID NULL REFERENCES vaults(id) ON DELETE SET NULL,
    entry_type VARCHAR(6) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0)
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_vaults_user_id ON vaults(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_ledger_entries_tx_user ON ledger_entries(transaction_id, user_id);
```

---

## 5. Kutipan Kode Algoritma Kunci (Core Algorithmic Excerpts)

Berikut merupakan kutipan implementasi algoritma kunci yang membedakan Rezekify dengan sistem pencatatan konvensional:

### 5.1 Algoritma Pembukuan Berpasangan Deterministik (`rezekify/services/ledger.py`)
Algoritma ini menjamin setiap transaksi memiliki entri debit dan kredit yang seimbang secara matematis (Total Debit = Total Credit), serta mendukung pembalikan saldo otomatis (*deterministic reversal*) saat transaksi dibatalkan.

```python
    def record_expense(
        self,
        user_id: UUID,
        account_id: UUID,
        category_id: Optional[UUID],
        amount: Decimal,
        description: str,
        source_channel: str = "WEB_AI",
        raw_input_text: Optional[str] = None,
        receipt_image_url: Optional[str] = None,
    ) -> Transaction:
        """Records an expense transaction with balanced debit/credit entries."""
        if amount <= 0:
            raise ValueError("Amount must be positive.")

        account = (
            self.db.query(Account)
            .filter_by(id=account_id, user_id=user_id)
            .one()
        )
        account.current_balance -= amount

        tx = Transaction(
            user_id=user_id,
            description=description,
            raw_input_text=raw_input_text,
            receipt_image_url=receipt_image_url,
            source_channel=source_channel,
        )
        self.db.add(tx)
        self.db.flush()

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
        self.db.commit()
        self.db.refresh(tx)
        return tx

```

Implementasi Pembalikan Saldo Otomatis (*Balance Reversal*):
```python
    def delete_transaction(self, user_id: UUID, transaction_id: UUID) -> bool:
        """Reverses account balances and removes transaction with cascading ledger entries."""
        tx = (
            self.db.query(Transaction)
            .filter_by(id=transaction_id, user_id=user_id)
            .one()
        )

        for entry in tx.ledger_entries:
            if entry.account_id:
                acc = (
                    self.db.query(Account)
                    .filter_by(id=entry.account_id, user_id=user_id)
                    .one()
                )
                if entry.entry_type == EntryType.CREDIT:
                    acc.current_balance += entry.amount
                elif entry.entry_type == EntryType.DEBIT:
                    acc.current_balance -= entry.amount

        self.db.delete(tx)
        self.db.commit()
        return True
```

### 5.2 Algoritma Dynamic Runway & Telemetri Likuiditas (`rezekify/services/runway.py`)
Algoritma ini mengisolasi dana brankas (*vault commitment*) dari kas likuid, menentukan sisa hari menuju siklus pendapatan baru, serta menghitung batas pengeluaran aman harian:

* Operational Free Cash = max(0, sum(Liquid Balances) - sum(Locked Vaults))
* Daily Safe Runway = Operational Free Cash / Days Remaining

```python
    def calculate_runway(self, user_id: UUID, today: Optional[date] = None) -> RunwayReport:
        """Calculates liquid cash, locked reserves, operational free cash, days remaining,
        and safe daily spending threshold for a user."""
        if today is None:
            today = date.today()

        user = self.db.query(User).filter_by(id=user_id).one()

        # Total liquid cash from CASH, BANK, EWALLET
        liquid_sum = (
            self.db.query(func.coalesce(func.sum(Account.current_balance), Decimal("0.00")))
            .filter(
                Account.user_id == user_id,
                Account.account_type.in_([AccountType.CASH, AccountType.BANK, AccountType.EWALLET]),
            )
            .scalar()
        )

        # Total locked vault reserves
        vault_sum = (
            self.db.query(func.coalesce(func.sum(Vault.allocated_amount), Decimal("0.00")))
            .filter(Vault.user_id == user_id)
            .scalar()
        )

        operational_free = max(Decimal("0.00"), liquid_sum - vault_sum)

        # Calculate days remaining until monthly cycle day
        cycle_day = user.monthly_cycle_day
        if today.day < cycle_day:
            days_remaining = cycle_day - today.day
        else:
            _, days_in_current_month = monthrange(today.year, today.month)
            days_remaining = (days_in_current_month - today.day) + cycle_day

        days_remaining = max(1, days_remaining)
        daily_safe = (operational_free / Decimal(str(days_remaining))).quantize(Decimal("0.01"))

        # Health status evaluation
        if operational_free <= Decimal("0.00"):
            status = "CRITICAL"
        elif daily_safe < Decimal("30000.00"):
            status = "WARNING"
        else:
            status = "HEALTHY"

        upcoming_bills = self.get_upcoming_bills(user_id=user_id, today=today)

        return RunwayReport(
            total_liquid_cash=liquid_sum,
            vault_locked_cash=vault_sum,
            operational_free_cash=operational_free,
            days_remaining=days_remaining,
            daily_safe_runway=daily_safe,
            health_status=status,
            upcoming_bills=upcoming_bills,
        )
```

Simulasi Dampak Pengeluaran Spontan terhadap Runway:
```python
    def simulate_purchase(
        self, user_id: UUID, planned_amount: Decimal, today: Optional[date] = None
    ) -> SimulationReport:
        """Simulates the cognitive and financial impact of a discretionary purchase on daily runway."""
        current = self.calculate_runway(user_id, today)
        projected_free = max(Decimal("0.00"), current.operational_free_cash - planned_amount)
        projected_daily = (projected_free / Decimal(str(current.days_remaining))).quantize(Decimal("0.01"))
        drop = current.daily_safe_runway - projected_daily

        is_safe = projected_daily >= Decimal("30000.00")
        advice = (
            f"Pembelian sebesar Rp {planned_amount:,.0f} aman dilakukan. "
            f"Jatah harian Anda tersisa Rp {projected_daily:,.0f}/hari."
            if is_safe
            else f"Peringatan: Transaksi ini memangkas jatah belanja harian Anda menjadi Rp {projected_daily:,.0f}/hari "
            f"(turun Rp {drop:,.0f}/hari) selama {current.days_remaining} hari ke depan."
        )
```

### 5.3 Algoritma Rotary Key Pool ($0 Marginal Cost LLM Multi-Key Failover) (`rezekify/agent/key_pool.py`)
Algoritma ini mengelola rotasi kunci API publik (Google Gemini 2.5 Flash & Groq LLaMA) secara round-robin dengan deteksi *HTTP 429 Rate-Limit* otomatis dan masa pemulihan (*cooldown*), menjamin ketersediaan layanan 24/7 tanpa biaya langganan API berbayar.

```python
class RotaryKeyPool:
    """Manages a pool of API keys with round-robin rotation and cooldown tracking."""

    def __init__(self, keys: List[str], cooldown_seconds: int = 60):
        # Filter out empty or whitespace keys
        self.keys = [k.strip() for k in keys if k and k.strip()]
        self.cooldown_seconds = cooldown_seconds
        self.current_index = 0
        self.cooldowns: Dict[str, float] = {k: 0.0 for k in self.keys}

    @classmethod
    def from_env(cls, env_var: str, cooldown_seconds: int = 60) -> "RotaryKeyPool":
        """Instantiate key pool from a comma-separated environment variable."""
        raw = os.getenv(env_var, "")
        keys = [k.strip() for k in raw.split(",") if k.strip()]
        return cls(keys=keys, cooldown_seconds=cooldown_seconds)

    def get_current_key(self) -> str:
        """Get the next active key not in cooldown.

        Falls back to the key whose cooldown expires earliest if all are exhausted.
        """
        if not self.keys:
            raise ValueError("No API keys configured in the pool.")

        now = time.time()
        for _ in range(len(self.keys)):
            key = self.keys[self.current_index]
            if now >= self.cooldowns.get(key, 0.0):
                return key
            self.current_index = (self.current_index + 1) % len(self.keys)

        # All keys currently in cooldown: pick the one that expires soonest
        return min(self.keys, key=lambda k: self.cooldowns.get(k, 0.0))

    def report_rate_limit(self, key: str, custom_cooldown: Optional[int] = None) -> None:
        """Mark a key as rate-limited and advance rotation index."""
        cooldown = custom_cooldown if custom_cooldown is not None else self.cooldown_seconds
        self.cooldowns[key] = time.time() + cooldown
        if self.keys:
            self.current_index = (self.current_index + 1) % len(self.keys)

    def get_gemini_client(self, api_key: Optional[str] = None):
```

---

## 6. Manual Pengoperasian Sistem (System Operations Manual)

### 6.1 Persyaratan Lingkungan
* **Backend:** Python 3.12 atau lebih baru, pip.
* **Frontend:** Node.js v18.0+ atau v20+, npm.
* **Basis Data:** PostgreSQL 15+ (didukung SQLite untuk pengujian terisolasi).
* **Kanal Komunikasi:** Telegram Bot API Token dari @BotFather.

### 6.2 Langkah Instalasi & Menjalankan Backend
1. **Salin Repository & Masuk ke Direktori:**
   ```bash
   git clone https://github.com/rezekify/rezekify.git
   cd rezekify
   ```
2. **Buat Virtual Environment & Install Dependensi:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # atau venv/Scripts/activate pada Windows
   pip install -r requirements.txt
   ```
3. **Konfigurasi File Lingkungan (.env):**
   ```env
   DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/rezekify
   SECRET_KEY=kunci-rahasia-jwt-produksi-rezekify
   GEMINI_API_KEYS=key1,key2,key3
   GROQ_API_KEYS=groq_key1,groq_key2
   TELEGRAM_BOT_TOKEN=token_bot_telegram
   ```
4. **Jalankan Server Backend FastAPI:**
   ```bash
   uvicorn rezekify.api.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### 6.3 Langkah Instalasi & Menjalankan Frontend
1. **Masuk ke Direktori Frontend & Unduh Dependensi:**
   ```bash
   cd frontend
   npm install
   ```
2. **Jalankan Development Server:**
   ```bash
   npm run dev
   ```
   Aplikasi dapat diakses melalui peramban pada alamat `http://localhost:5173`.

### 6.4 Panduan Alur Operasional Pengguna
1. **Registrasi Akun Baru:**
   Pengguna mendaftar melalui antarmuka web dengan email, kata sandi, dan hari siklus bulanan (misal tanggal 25).
2. **Inisialisasi Akun Finansial:**
   Pengguna menambahkan akun penyimpanan riil (contoh: Kas Tunai, Bank BCA, GoPay) beserta saldo awal.
3. **Alokasi Brankas Komitmen (Vaults):**
   Pengguna mengalokasikan pos pengeluaran tetap (contoh: Sewa Kos, Tagihan Listrik H-7) untuk mengunci kas likuid dari jatah belanja harian.
4. **Pencatatan Melalui AI Omni-Input & Telegram:**
   * Pada Web: Ketik langsung transaksi kasual pada *Omni-Input Bar* (contoh: *"beli buku referensi 100rb gopay"*) atau unggah foto struk belanja.
   * Pada Telegram: Dapatkan kode pairing 6-karakter dari Web (`DK-XXXX`), hubungkan dengan perintah `/link DK-XXXX`, lalu kirimkan transaksi atau foto struk kapan saja.
5. **Pemantauan & Peringatan Otomatis:**
   Sistem secara otomatis memperbarui *Runway Telemetry Gauge* (Hijau: Aman, Kuning: Waspada, Merah: Kritis) dan menampilkan peringatan tagihan H-7 yang jatuh tempo.

### 6.5 Pengujian Otomatis & Penjaminan Mutu
Seluruh komponen telah diverifikasi melalui pengujian otomatis menyeluruh:
* **Pengujian Backend:**
  ```bash
  pytest -v
  ```
  Menjalankan 69+ kasus uji meliputi validasi buku besar berpasangan, kalkulasi runway, isolasi multi-tenant, dan simulasi rotasi kunci API.
* **Pengujian Frontend:**
  ```bash
  cd frontend && npm test
  ```
  Menjalankan rangkaian pengujian komponen antarmuka React dengan Vitest dan React Testing Library.

---

## 7. Pernyataan Keaslian & Hak Cipta
Seluruh kode sumber, formulasi matematis deterministik, diagram alur, dan struktur arsitektur sistem dalam program komputer **Rezekify** adalah karya cipta asli yang dirancang dan diimplementasikan untuk memberikan solusi inklusi finansial otonom bagi masyarakat Indonesia.
