"""Generates official HKI Software Description Dossier for Kemenkumham RI Hak Cipta submission."""

from pathlib import Path


def generate_hki_dossier(output_path: Path) -> None:
    """Compiles software description dossier markdown."""
    content = """# DOKUMEN DESKRIPSI CIPTAAN PROGRAM KOMPUTER
**Kementerian Hukum dan Hak Asasi Manusia Republik Indonesia**
**Direktorat Jenderal Kekayaan Intelektual (DJKI)**

---

## 1. Identitas Ciptaan
* **Judul Ciptaan:**
  **Rezekify: Sistem Manajemen Keuangan Personal Otonom Berbasis Pembukuan Berpasangan Deterministik dan Orkestrasi Agen Multimodal**
* **Jenis Ciptaan:** Program Komputer (Perangkat Lunak / *Software*)
* **Tanggal Selesai Pembuatan:** 18 September 2026
* **Tempat Pertama Kali Diumumkan:** Jakarta, Indonesia
* **Bahasa Pemrograman & Lingkungan Pengembangan:** Python 3.12, TypeScript, React 18, PostgreSQL, FastAPI, Tailwind CSS.

---

## 2. Ringkasan Eksekutif & Karakteristik Inovasi
**Rezekify** adalah perangkat lunak tata kelola keuangan personal yang mengintegrasikan kecerdasan buatan multimodal (pemrosesan bahasa alami kasual dan pengenalan optik struk belanja) dengan mesin pembukuan berpasangan (*double-entry bookkeeping*) yang berjalan secara 100% deterministik.

### Masalah yang Diselesaikan:
1. **Tracking Fatigue (Kelelahan Form Manual):** Pengguna konvensional meninggalkan pencatatan karena kerumitan pengisian form bertingkat (akun, kategori, nominal desimal). Rezekify menggantikannya dengan *ambient ingestion* melalui bot Telegram dan *Omni-Input Bar* web.
2. **Runway Blindness:** Pengguna sering mengalami kepanikan likuiditas di akhir bulan karena tidak mengetahui jatah belanja aman harian. Rezekify menyediakan kalkulator dinamis *Daily Safe Runway*.
3. **Halusinasi Aritmatika LLM:** Banyak chatbot finansial salah menjumlahkan uang riil pengguna. Rezekify menerapkan pemisahan arsitektur mutlak: LLM hanya mengekstrak entitas teks menjadi JSON terstruktur, sedangkan seluruh mutasi saldo, kalkulasi pembagian, dan validasi debit-kredit dikerjakan oleh pustaka `decimal.Decimal` Python berstandar perbankan.

---

## 3. Arsitektur Tiga Lapis (Three-Tier Decoupled Architecture)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  LAPIS 3: KANAL ANTARMUKA PENGGUNA                      │
│  • Web Dashboard (React 18 + TypeScript + Tailwind CSS + Vitest)        │
│    - Hero Omni-Input Action Bar (Teks Bebas & Struk Kasir)              │
│    - Indikator Status & Telemetri Daily Safe Runway                     │
│    - Banner Pengingat Komitmen Tagihan Mendesak (H-7)                   │
│  • Bot Telegram Gateway (python-telegram-bot / Webhook)                 │
│    - Otentikasi OTP Pairing Code (DK-XXXX)                              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ RESTful API (JSON)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               LAPIS 2: RUNTIME ORKESTRASI AGEN & GATEWAY                │
│  • FastAPI Application Server & JWT Security Layer                      │
│  • Rotary Key Pool ($0 Marginal Cost LLM Multi-Key Failover)            │
│  • ReAct Agent Runtime (Gemini 2.5 Flash Vision & Groq Fallback)        │
│  • Agent Orchestrator (Penerjemah Bahasa Alami ke Aksi Deterministik)   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Validated Function Calls
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             LAPIS 1: MESIN FINANSIAL DETERMINISTIK & BASIS DATA         │
│  • LedgerService (Pembukuan Berpasangan Mutlak: Debit = Credit)         │
│  • RunwayService (Kalkulator Likuiditas & Simulator Belanja Dinamis)    │
│  • PostgreSQL Database dengan Isolasi Multi-Penyewa (user_id Scoping)   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Basis Data & Skema Relasional (PostgreSQL DDL)

```sql
-- Tabel Pengguna (Multi-Tenant Master)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    telegram_chat_id BIGINT UNIQUE NULL,
    telegram_pairing_code VARCHAR(32) UNIQUE NULL,
    pairing_code_expires_at TIMESTAMP WITH TIME ZONE NULL,
    monthly_cycle_day INT NOT NULL DEFAULT 1,
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Akun Keuangan (Holding Buckets)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) NOT NULL, -- CASH, BANK, EWALLET, LIABILITY
    current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Brankas Virtual / Sinking Funds
CREATE TABLE vaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    vault_type VARCHAR(20) NOT NULL DEFAULT 'SAVINGS', -- SAVINGS, FIXED_BILL
    target_amount NUMERIC(15, 2) NOT NULL,
    allocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    target_date DATE NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Transaksi Utama (Event Header)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    raw_input_text TEXT NULL,
    receipt_image_url VARCHAR(512) NULL,
    source_channel VARCHAR(20) NOT NULL DEFAULT 'WEB_AI',
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Jurnal Buku Besar Berpasangan (Double-Entry Ledger Lines)
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) NULL,
    category_id UUID REFERENCES categories(id) NULL,
    vault_id UUID REFERENCES vaults(id) NULL,
    entry_type VARCHAR(6) NOT NULL, -- DEBIT, CREDIT
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0)
);
```

---

## 5. Pernyataan Keaslian & Hak Cipta
Seluruh arsitektur, basis kode, dan formulasi deterministik dalam program komputer **Rezekify** adalah karya asli dan tidak melanggar hak cipta pihak ketiga mana pun.
"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    print(f"HKI Dossier exported to {output_path}")


if __name__ == "__main__":
    out_file = Path(__file__).resolve().parent.parent / "docs" / "HKI_DESKRIPSI_CIPTAAN.md"
    generate_hki_dossier(out_file)
