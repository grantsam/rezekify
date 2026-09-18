# REZEKIFY (UNAPPROVED): Autonomous Multi-Modal Personal Finance Manager & Deterministic Runway Engine

**Document Type:** Architectural Design Specification (Spec)  
**Date:** 2026-09-18  
**Project Classification:** Program Komputer / Rekayasa Perangkat Lunak Berbasis Kecerdasan Buatan (HKI)  
**Target Repository:** Standalone Clean Repository (`rezekify`)  

---

## 1. System Overview & Intellectual Property (HKI) Identity

### 1.1 Formal Identity & Naming
* **Product Name:** **rezekify (UNAPPROVED)** (*Rezeki* = Rezeki / Keberkahan Finansial; *-fy* = Modern Digital Action & Transformation; Status: UNAPPROVED).
* **Formal Title for HKI (Kemenkumham Hak Cipta Program Komputer):**  
  > *"Rezekify: Sistem Manajemen Keuangan Personal Otonom Berbasis Pembukuan Berpasangan Deterministik dan Orkestrasi Agen Multimodal"*
* **Target Audience:** Mahasiswa, pekerja lepas, dan individu muda yang membutuhkan sistem pengawalan kesehatan finansial harian tanpa beban friksi pencatatan manual (*zero-friction*).

### 1.2 Core Thesis & Value Proposition
Conventional expense trackers fail because they are **passive** (requiring tedious manual dropdown and form inputs) and **reactive** (recording financial demise only after money is spent). Conversely, relying purely on raw Large Language Models (LLMs) to manage finances is dangerous due to **probabilistic hallucinations and mathematical inaccuracy**.

**Rezekify solves this through an asymmetric dual-system architecture:**
1. **AI-First Ambient Ingestion (Primary):** Users log expenses effortlessly by texting casual natural language (*"beli sate 25rb pake gopay"*) or uploading receipts/screenshots. An autonomous agent extracts structured transaction entities in the background.
2. **Deterministic Financial Core (Zero AI Calculation):** All account balances, ledger balancing, and runway calculations are executed by strict, deterministic Python accounting services backed by PostgreSQL. The AI never calculates money in its context window; it strictly issues verified tool calls.
3. **Dynamic Daily Runway:** Instantly updates the user's maximum safe spending limit per day to prevent mid-month liquidity collapse:
   $$\text{Daily Safe Runway} = \frac{\text{Operational Free Cash}}{\text{Days Remaining until Monthly Inflow Cycle}}$$
4. **Auxiliary Manual CRUD:** Full manual Create-Read-Update-Delete interface is available on Web as a secondary fallback for editing, edge-case adjustments, and reconciliation.

---

## 2. System Architecture

rezekify (UNAPPROVED) employs a strictly decoupled three-tier architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      TIER 3: INTERFACE CHANNELS                         │
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
│              TIER 2: BACKEND GATEWAY & AGENTIC RUNTIME                  │
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
                                  │ (Strict Function Calls)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             TIER 1: DETERMINISTIC FINANCIAL CORE & STORAGE              │
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

## 3. Database Schema Specification (PostgreSQL)

Every entity enforces strict multi-tenant isolation via indexed `user_id` foreign keys with `ON DELETE CASCADE`.

### 3.1 `users`
Represents an individual account owner.
* `id`: UUID (Primary Key, default `gen_random_uuid()`)
* `email`: VARCHAR(255) (Unique, Not Null, Indexed)
* `password_hash`: VARCHAR(255) (Not Null)
* `full_name`: VARCHAR(100) (Not Null)
* `telegram_chat_id`: BIGINT (Unique, Nullable, Indexed)
* `telegram_pairing_code`: VARCHAR(32) (Nullable, Unique, Indexed)
* `pairing_code_expires_at`: TIMESTAMP WITH TIME ZONE (Nullable)
* `monthly_cycle_day`: INT (Not Null, Default 1, Check between 1 and 31)
* `currency`: VARCHAR(3) (Default 'IDR')
* `created_at`: TIMESTAMP WITH TIME ZONE (Default `NOW()`)
* `updated_at`: TIMESTAMP WITH TIME ZONE (Default `NOW()`)

### 3.2 `accounts`
Represents real financial holding buckets.
* `id`: UUID (Primary Key)
* `user_id`: UUID (Foreign Key -> `users.id`, Indexed)
* `name`: VARCHAR(100) (e.g., "Dompet Tunai", "BCA", "GoPay", "ShopeePay")
* `account_type`: VARCHAR(20) (Enum: `CASH`, `BANK`, `EWALLET`, `LIABILITY`)
* `current_balance`: NUMERIC(15, 2) (Not Null, Default 0.00)
* `is_active`: BOOLEAN (Default TRUE)
* `created_at`: TIMESTAMP WITH TIME ZONE (Default `NOW()`)

### 3.3 `vaults`
Represents virtual goal and commitment enclosures (Sinking Funds) that partition cash away from daily operational spending.
* `id`: UUID (Primary Key)
* `user_id`: UUID (Foreign Key -> `users.id`, Indexed)
* `name`: VARCHAR(100) (e.g., "Tabungan UKT Semester 6", "Dana Darurat", "Sewa Kos")
* `target_amount`: NUMERIC(15, 2) (Not Null)
* `allocated_amount`: NUMERIC(15, 2) (Not Null, Default 0.00)
* `target_date`: DATE (Nullable)
* `is_locked`: BOOLEAN (Default FALSE)
* `created_at`: TIMESTAMP WITH TIME ZONE (Default `NOW()`)

### 3.4 `categories`
Hierarchical spending/income classification.
* `id`: UUID (Primary Key)
* `user_id`: UUID (Foreign Key -> `users.id`, Indexed)
* `name`: VARCHAR(50) (e.g., "Makanan & Minuman", "Transportasi", "Pendidikan", "Gaji/Uang Saku")
* `category_type`: VARCHAR(10) (Enum: `EXPENSE`, `INCOME`)
* `icon`: VARCHAR(50) (Lucide icon identifier)
* `color`: VARCHAR(20) (Hex or Tailwind color token)

### 3.5 `transactions`
Parent event record for every financial occurrence.
* `id`: UUID (Primary Key)
* `user_id`: UUID (Foreign Key -> `users.id`, Indexed)
* `description`: TEXT (Not Null)
* `raw_input_text`: TEXT (Nullable, the original natural language prompt if logged via AI)
* `receipt_image_url`: VARCHAR(512) (Nullable, path to uploaded receipt image)
* `source_channel`: VARCHAR(20) (Enum: `TELEGRAM`, `WEB_AI`, `WEB_MANUAL`)
* `transaction_date`: TIMESTAMP WITH TIME ZONE (Default `NOW()`, Indexed)
* `created_at`: TIMESTAMP WITH TIME ZONE (Default `NOW()`)

### 3.6 `ledger_entries`
Double-entry balanced accounting ledger lines.
* `id`: UUID (Primary Key)
* `transaction_id`: UUID (Foreign Key -> `transactions.id`, On Delete Cascade, Indexed)
* `user_id`: UUID (Foreign Key -> `users.id`, Indexed)
* `account_id`: UUID (Nullable, Foreign Key -> `accounts.id`)
* `category_id`: UUID (Nullable, Foreign Key -> `categories.id`)
* `vault_id`: UUID (Nullable, Foreign Key -> `vaults.id`)
* `entry_type`: VARCHAR(6) (Enum: `DEBIT`, `CREDIT`, Not Null)
* `amount`: NUMERIC(15, 2) (Not Null, Check `amount > 0`)

**Accounting Integrity Rules:**
1. Every `transaction_id` must have at least two `ledger_entries`.
2. $\sum \text{DEBIT} = \sum \text{CREDIT}$ must evaluate to zero discrepancy per transaction.
3. Expense: `DEBIT category_id`, `CREDIT account_id`.
4. Income: `DEBIT account_id`, `CREDIT category_id`.
5. Transfer: `DEBIT destination_account_id`, `CREDIT source_account_id`.
6. Vault Lock: `DEBIT vault_id`, `CREDIT operational_pool`.

---

## 4. Deterministic Financial Logic & Runway Calculation (Layer 1)

### 4.1 Liquid Operational Free Cash Calculation
Uang tunai bebas yang aman digunakan sehari-hari dihitung dengan mengurangkan seluruh komitmen brankas dari total aset likuid:
$$\text{Total Liquid Assets} = \sum_{\text{type} \in \{\text{CASH, BANK, EWALLET}\}} \text{account.current\_balance}$$
$$\text{Locked Vault Reserve} = \sum \text{vault.allocated\_amount}$$
$$\text{Operational Free Cash} = \text{Total Liquid Assets} - \text{Locked Vault Reserve}$$

### 4.2 Dynamic Calendar Cycle Calculation
Berdasarkan parameter `monthly_cycle_day` pengguna:
* Jika hari ini adalah tanggal 18 September dan siklus tanggal 25: $\text{Days Remaining} = 25 - 18 = 7 \text{ hari}$.
* Jika hari ini tanggal 28 September dan siklus tanggal 25: $\text{Days Remaining} = (\text{Akhir Bulan} - 28) + 25 = 2 + 25 = 27 \text{ hari}$.
* Nilai minimum dibatasi ($\text{Days Remaining} \ge 1$).

### 4.3 Safe Daily Spending Limit
$$\text{Daily Safe Runway (IDR)} = \frac{\text{Operational Free Cash}}{\text{Days Remaining}}$$

### 4.4 Financial Health Status Thresholds
* **Green (Healthy):** $\text{Daily Safe Runway} \ge \text{Baseline Target}$ (User can comfortably cover daily necessities).
* **Yellow (Warning):** $\text{Baseline Target} > \text{Daily Safe Runway} \ge 50\% \text{ of Baseline}$.
* **Red (Critical / Insolvent):** $\text{Daily Safe Runway} < 50\% \text{ of Baseline}$ or $\text{Operational Free Cash} \le 0$.

### 4.5 Pre-Purchase Simulation Engine
Fungsi `simulate_purchase_impact(user_id, planned_amount, item_name)`:
* Menghitung $\Delta \text{Runway} = \text{Current Daily Runway} - \frac{\text{Operational Free Cash} - \text{planned\_amount}}{\text{Days Remaining}}$.
* Menghasilkan laporan dampak kognitif langsung sebelum pengguna melakukan transaksi impulsif.

---

## 5. Agentic Runtime & AI-First Multimodal Ingestion (Layer 2)

### 5.1 Rotary LLM Key Pool (Zero-Cost Operation)
* Mengadaptasi arsitektur rotary pool dari `core/key_pool.py`:
  * Mendukung multiple API keys gratis (Google AI Studio Gemini 2.5 Flash untuk multimodal OCR + Groq Llama-3.3-70B untuk text fallback).
  * Auto-cooldown dan round-robin failover jika terjadi HTTP 429.
  * Menjamin ketersediaan 24/7 tanpa biaya token server.

### 5.2 Deterministic Tool Definitions
Agen AI dibekali 5 alat kerja deterministik terisolasi (semua alat otomatis menerima konteks `user_id` dari autentikasi pengguna):

1. `record_expense(amount: float, account_name: str, category_name: str, note: str)`
   Mencatat mutasi pengeluaran dan memperbarui saldo akun.
2. `record_income(amount: float, account_name: str, category_name: str, note: str)`
   Mencatat pemasukan dana baru.
3. `transfer_balance(amount: float, from_account: str, to_account: str, note: str)`
   Mencatat perpindahan dana antar rekening tanpa mengubah status beban/pendapatan.
4. `allocate_to_vault(vault_name: str, amount: float, action: "DEPOSIT" | "WITHDRAW")`
   Mengunci atau mencairkan dana komitmen brankas virtual.
5. `get_runway_status()`
   Mengambil data saldo real-time, sisa hari, dan jatah harian aman untuk dilaporkan ke pengguna.

### 5.3 Vision Receipt Extraction Pipeline
Ketika pengguna mengunggah foto struk (kamera Telegram atau drag-and-drop di Web):
1. Sistem mengirim gambar ke Gemini 2.5 Flash Vision dengan prompt schema terstruktur.
2. Model mengekstrak data JSON: Merchant, Tanggal, Item breakdown, Pajak/Diskon, Total Bayar, dan Metode Bayar yang tertera di struk.
3. Agen secara otomatis mencocokkan metode bayar ke nama akun pengguna yang paling mirip (misal: "BCA Debit" -> akun "BCA").
4. Agen memanggil `record_expense()` ke core database.
5. Agen merespons dengan ringkasan item yang dibeli dan sisa runway harian pengguna.

---

## 6. Frontend & Telegram Gateway Interface (Layer 3)

### 6.1 Primary AI-Driven Input Paradigm
Baik di Web maupun Telegram, **AI-Driven Input adalah Hero Feature**:
* **Telegram:** Pengguna hanya perlu mengetik kasual atau mengirim foto.
* **Web Dashboard:** Terdapat **"Omni-Input Action Bar"** di posisi atas paling mencolok:
  * Pengguna bisa mengetik teks kasual: *"beli kopi kenangan 28rb gopay"*.
  * Tombol mikrofon untuk *speech-to-text* instan.
  * Tombol kamera/unggah struk dengan *drag-and-drop dropzone*.
  * Hasil parsing AI langsung muncul seketika sebagai *optimistic preview* yang dikonfirmasi otomatis dalam 3 detik (atau pengguna bisa mengoreksi jika ada salah tafsir).

### 6.2 Auxiliary Manual CRUD (Fallback Mode)
Untuk kebutuhan audit presisi dan kustomisasi:
* **Tabel Mutasi:** Tombol "Tambah Transaksi Manual" membuka modal form konvensional (dropdown akun, input nominal angka, datepicker, pilihan kategori, field catatan).
* **Fitur Edit & Hapus:** Setiap baris transaksi di web dapat diedit atau dihapus. Penghapusan transaksi secara otomatis memicu pembalikan jurnal (*ledger reversal*) sehingga saldo kas kembali utuh.
* **Manajemen Akun & Vault:** Modal visual untuk menambah akun baru, mengubah saldo awal, dan menyetel target tabungan brankas.

### 6.3 Account Linking Flow (Telegram Pairing)
1. User masuk ke Web Dashboard -> Halaman Pengaturan -> Klik **"Hubungkan Telegram"**.
2. Web memanggil endpoint `POST /api/v1/auth/telegram-pairing-code`.
3. Backend mengembalikan kode OTP (misal `RZ-7482`) dengan masa berlaku 15 menit.
4. User membuka Telegram Bot -> Mengetik `/link RZ-7482`.
5. Bot memverifikasi kode, memperbarui `users.telegram_chat_id = message.chat_id`, dan mengirimkan pesan konfirmasi:  
   *"Selamat datang di rezekify (UNAPPROVED)! Akun Anda berhasil terhubung. Anda sekarang dapat mencatat pengeluaran langsung dari sini."*

---

## 7. Verification, Testing, & Quality Gates

### 7.1 Automated Testing Strategy (Backend)
* **Unit Tests (Core Engine):** Menguji formula matematika saldo, konsistensi debit/kredit, dan formula kalkulator runway dengan cakupan 100%.
* **Integration Tests (FastAPI Endpoints):** Menguji alur registrasi, login JWT, isolasi data multi-tenant (memastikan User A tidak dapat mengakses data User B), dan endpoint mutasi.
* **Mocked Agent Tests:** Menguji alur ReAct loop dan ekstraksi entitas teks kasual menggunakan respons mock untuk memastikan pemanggilan tool berlangsung akurat.

### 7.2 Frontend Testing & Linting
* TypeScript strict checking (`tsc --noEmit`).
* ESLint & Tailwind style integrity.
* Component render verification untuk Widget Runway, Grafik Keuangan, dan Omni-Input Action Bar.

---

## 8. HKI Dossier & Capstone Deliverables Checklist

1. **Source Code Cleanliness:** Repositori baru bebas dari modul gray-area (miner/harvester).
2. **Buku Manual Penggunaan (User Manual):** Panduan operasional Web dan Telegram Bot.
3. **Dokumen Deskripsi Ciptaan (HKI):**
   * Uraian ringkas tentang arsitektur sistem.
   * Diagram alir data (*Data Flow Diagram*) dan skema database.
   * Potongan kode sumber inti (*core source code excerpts*) yang menonjolkan kebaruan algoritma runway deterministik dan orkestrasi agen.
