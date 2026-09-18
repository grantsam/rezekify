"""Generates official HKI Software Description Dossier for Kemenkumham RI Hak Cipta submission."""

from pathlib import Path


def extract_code_snippet(file_path: Path, start_line: int, end_line: int) -> str:
    """Extracts a line range from a source code file for inclusion in the dossier."""
    if not file_path.exists():
        return f"# File {file_path.name} not found"
    lines = file_path.read_text(encoding="utf-8").splitlines()
    return "\n".join(lines[start_line - 1 : end_line])


def generate_hki_dossier(output_path: Path, repo_root: Path) -> None:
    """Compiles complete software description dossier markdown formatted according to

    Kemenkumham RI Hak Cipta Program Komputer standards.
    """
    ledger_path = repo_root / "rezekify" / "services" / "ledger.py"
    runway_path = repo_root / "rezekify" / "services" / "runway.py"
    key_pool_path = repo_root / "rezekify" / "agent" / "key_pool.py"

    # Extract verbatim algorithm excerpts from repository files
    ledger_code = extract_code_snippet(ledger_path, 21, 71)
    ledger_reversal_code = extract_code_snippet(ledger_path, 174, 196)
    runway_code = extract_code_snippet(runway_path, 47, 103)
    runway_sim_code = extract_code_snippet(runway_path, 139, 155)
    key_pool_code = extract_code_snippet(key_pool_path, 8, 50)

    content = f"""# DOKUMEN DESKRIPSI CIPTAAN PROGRAM KOMPUTER
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
{ledger_code}
```

Implementasi Pembalikan Saldo Otomatis (*Balance Reversal*):
```python
{ledger_reversal_code}
```

### 5.2 Algoritma Dynamic Runway & Telemetri Likuiditas (`rezekify/services/runway.py`)
Algoritma ini mengisolasi dana brankas (*vault commitment*) dari kas likuid, menentukan sisa hari menuju siklus pendapatan baru, serta menghitung batas pengeluaran aman harian:

* Operational Free Cash = max(0, sum(Liquid Balances) - sum(Locked Vaults))
* Daily Safe Runway = Operational Free Cash / Days Remaining

```python
{runway_code}
```

Simulasi Dampak Pengeluaran Spontan terhadap Runway:
```python
{runway_sim_code}
```

### 5.3 Algoritma Rotary Key Pool ($0 Marginal Cost LLM Multi-Key Failover) (`rezekify/agent/key_pool.py`)
Algoritma ini mengelola rotasi kunci API publik (Google Gemini 2.5 Flash & Groq LLaMA) secara round-robin dengan deteksi *HTTP 429 Rate-Limit* otomatis dan masa pemulihan (*cooldown*), menjamin ketersediaan layanan 24/7 tanpa biaya langganan API berbayar.

```python
{key_pool_code}
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
"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    print(f"HKI Dossier successfully exported to {output_path}")


if __name__ == "__main__":
    current_dir = Path(__file__).resolve().parent
    repo = current_dir.parent
    out_file = repo / "docs" / "HKI_DESKRIPSI_CIPTAAN.md"
    generate_hki_dossier(out_file, repo)
