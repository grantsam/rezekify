# PRODUCT REQUIREMENT DOCUMENT (PRD)

## Product Name: rezekify (UNAPPROVED)
**Autonomous Multi-Modal Personal Finance Manager & Deterministic Runway Engine**  
**Formal Title for HKI:** *"Rezekify: Sistem Manajemen Keuangan Personal Otonom Berbasis Pembukuan Berpasangan Deterministik dan Orkestrasi Agen Multimodal"*  
**Author:** Chief Architect / Engineering Team  
**Date:** 2026-09-18  
**Status:** DRAFT / UNDER REVIEW  
**Target Repository:** Standalone Clean Repository (`rezekify/`)  

---

## 1. Executive Summary & Product Vision

### 1.1 Product Vision
**rezekify (UNAPPROVED)** adalah asisten pengelola keuangan personal otonom (*Autonomous Personal Financial Manager*) yang mengeliminasi beban pencatatan manual (*zero-friction expense tracking*) dan mencegah krisis likuiditas harian individu muda/mahasiswa melalui perhitungan daya tahan kas (*Dynamic Daily Safe Runway*).

### 1.2 The Core Problem
1. **Kegagalan Sistemik Aplikasi Konvensional (Passive Tracking Fatigue):** 90% pengguna meninggalkan aplikasi pencatat keuangan (*expense tracker*) dalam 2 minggu pertama karena bosan membuka formulir, memilih kategori dropdown, dan mengetik angka manual.
2. **Ketiadaan Peringatan Dini Likuiditas (Runway Blindness):** Pengguna tidak menyadari kebocoran pengeluaran mikro harian (*stealth micro-bleeding*) hingga uang habis di minggu ketiga, memicu panik likuiditas atau jebakan utang konsumtif (Pinjol / PayLater).
3. **Halusinasi Matematis pada Chatbot AI Biasa:** Menggunakan prompt LLM biasa (ChatGPT/Claude) untuk mengelola saldo rawan salah hitung (*probabilistic hallucination*), menjadikannya tidak layak dipercaya untuk perhitungan uang riil.

### 1.3 The Solution & Key Differentiators
* **AI-First Ambient Ingestion (Primary Input):** Pengguna hanya perlu mengetik bahasa santai (*"beli batagor 15rb gopay"*) atau mengirim foto struk/screenshot mutasi melalui Telegram atau Web Omni-Input Bar.
* **Deterministic Accounting Core (Zero AI Calculation):** LLM hanya bertindak sebagai penerjemah niat manusia ke dalam *Tool Calling*. Seluruh perhitungan saldo, jurnal debit/kredit, dan jatah harian dijalankan 100% oleh kode Python deterministik di PostgreSQL.
* **Dynamic Daily Safe Runway:** Setiap kali ada mutasi keluar/masuk, sistem secara instan mengkalkulasi ulang jatah belanja maksimal hari ini:
  $$\text{Daily Safe Runway} = \frac{\text{Total Liquid Assets} - \text{Locked Vault Commitments}}{\text{Days Remaining until Inflow Cycle}}$$
* **Auxiliary Manual CRUD:** Formulir manual konvensional tetap tersedia di Web Dashboard sebagai opsi cadangan untuk koreksi data presisi.

---

## 2. User Personas & Target Audience

### Persona 1: "Budi, Mahasiswa Rantau" (The Cashflow-Constrained Student)
* **Karakter:** Mendapat uang saku bulanan tetap tiap tanggal 25. Hidup hemat namun sering kehabisan uang di tanggal 18 karena tidak sadar pengeluaran ngopi dan jajan kecil.
* **Pain Point:** Malas mencatat pengeluaran di aplikasi spreadsheet; panik saat harus bayar sewa kos atau UKT karena uangnya sudah terpakai jajan.
* **Goal:** Cukup foto struk belanja atau chat ke bot Telegram, dan langsung tahu berapa jatah aman belanja hari ini agar uangnya cukup sampai akhir bulan.

### Persona 2: "Siti, Pekerja Lepas Muda" (The Variable-Income Freelancer)
* **Karakter:** Memiliki banyak akun (BCA, GoPay, OVO, ShopeePay, Kas Tunai). Pemasukan datang dalam gelombang tidak menentu.
* **Pain Point:** Uang tercampur aduk antara dana operasional harian dengan dana pajak/tabungan darurat.
* **Goal:** Memiliki brankas virtual (*Vaults*) yang mengunci komitmen penting secara otomatis dan memantau daya tahan hidup (*runway*) per hari.

---

## 3. Functional Requirements (FR)

### Module 1: Deterministic Accounting Core (Layer 1)
* **FR-1.1 (Double-Entry Balancing):** Setiap transaksi keuangan wajib menghasilkan minimal 2 entri buku besar (*ledger entries*) di mana $\sum \text{Debit} = \sum \text{Credit}$.
* **FR-1.2 (Multi-Account Support):** Melacak saldo untuk tipe akun `CASH` (tunai), `BANK`, `EWALLET`, dan `LIABILITY` (utang/PayLater) dalam mata uang Rupiah (IDR).
* **FR-1.3 (Atomic Transaction Reversal):** Penghapusan transaksi wajib mengembalikan saldo akun asal secara otomatis (*rollback ledger reversal*) tanpa merusak integritas buku besar.
* **FR-1.4 (Inter-Account Transfers):** Perpindahan dana antar-akun pengguna (misal: BCA ke GoPay) dicatat sebagai mutasi aset murni, bukan sebagai pengeluaran/beban.

### Module 2: Dynamic Runway & Spending Impact Engine (Layer 1)
* **FR-2.1 (Monthly Cycle Calculation):** Menghitung sisa hari secara dinamis menuju tanggal siklus uang masuk pengguna (`monthly_cycle_day`).
* **FR-2.2 (Operational Free Cash Isolation):** Mengurangkan seluruh saldo komitmen brankas virtual dari total aset kas likuid untuk menghasilkan nilai kas operasional bebas.
* **FR-2.3 (Daily Budget Telemetry):** Menghasilkan metrik *Daily Safe Runway* dan status kesehatan:
  * `HEALTHY` (Hijau): Jatah harian $\ge$ Rp 30.000/hari.
  * `WARNING` (Kuning): Jatah harian $<$ Rp 30.000/hari.
  * `CRITICAL` (Merah): Saldo operasional $\le$ 0.
* **FR-2.4 (Pre-Purchase Simulation):** Menyediakan kalkulasi simulasi dampak belanja impulsif terhadap penurunan jatah harian selama sisa hari siklus.

### Module 3: Virtual Vaults & Sinking Funds (Layer 1)
* **FR-3.1 (Vault Allocation):** Mengizinkan pengguna menyisihkan dana dari kas operasional ke pos komitmen tertentu (misal: UKT, Sewa Kos, Dana Darurat).
* **FR-3.2 (Locking Mechanism):** Brankas yang dikunci (*is_locked = True*) tidak dapat ditarik secara otomatis oleh pengeluaran harian biasa.

### Module 4: Agentic Multi-Modal Ingestion (Layer 2)
* **FR-4.1 (Rotary Key Pool):** Mengorkestrasi pool API key gratis (Google Gemini 2.5 Flash & Groq) dengan rotasi otomatis dan *cooldown* saat terkena HTTP 429. Biaya token server: Rp 0.
* **FR-4.2 (Natural Language Parsing):** Mengekstrak entitas transaksi dari kalimat santai: `nominal`, `akun sumber`, `kategori`, dan `catatan`.
* **FR-4.3 (Receipt & Invoice OCR Vision):** Memproses foto struk atau screenshot pembayaran digital, mendeteksi merchant, daftar item, diskon, dan total bayar ke dalam format terstruktur.
* **FR-4.4 (Deterministic Tool Invocation):** AI tidak menghitung saldo, melainkan memanggil fungsi `record_expense`, `record_income`, atau `simulate_purchase`.

### Module 5: Telegram Gateway Client (Layer 3)
* **FR-5.1 (Account Pairing OTP):** Pengguna menghubungkan akun Telegram dengan mengirimkan perintah `/link KODE-PAIRING` yang digenerate dari Web Dashboard.
* **FR-5.2 (Text & Photo Processing):** Menerima pesan teks atau unggahan foto struk langsung dari kamera ponsel, memprosesnya via agen AI, dan membalas status mutasi serta sisa runway hari ini dalam waktu $< 2$ detik.
* **FR-5.3 (Instant Commands):** Menyediakan perintah cepat `/runway` dan `/saldo`.

### Module 6: Decoupled React Web Dashboard (Layer 3)
* **FR-6.1 (Hero Omni-Input Action Bar):** Komponen input teks kasual & dropzone foto struk di posisi paling mencolok di halaman utama web.
* **FR-6.2 (Runway Telemetry Widget):** Kartu indikator visual jatah belanja aman hari ini dengan indikator status warna dinamis.
* **FR-6.3 (Interactive Analytics Charts):** Grafik tren pengeluaran harian vs batas jatah aman, serta diagram komposisi kategori belanja.
* **FR-6.4 (Auxiliary Manual CRUD):**
  * Modal form input manual (Akun, Tanggal, Nominal, Kategori, Catatan, Struk).
  * Tabel transaksi dengan filter tanggal, pencarian kata kunci, serta tombol Edit dan Hapus transaksi.
  * Manajemen Akun dan Brankas Virtual (Tambah, Ubah Saldo, Hapus).

### Module 7: Security & Multi-Tenancy (Cross-Cutting)
* **FR-7.1 (Tenant Row-Level Isolation):** Seluruh query database wajib memfilter `WHERE user_id = current_user_id`. Tidak ada kebocoran data antar-pengguna.
* **FR-7.2 (JWT Bearer Auth):** Autentikasi stateless menggunakan token JWT dengan masa berlaku yang aman.
* **FR-7.3 (Password Hashing):** Kata sandi disimpan menggunakan algoritma Bcrypt/Argon2 dengan salt acak.

---

## 4. Non-Functional Requirements (NFR)

* **NFR-1 (Performance & Latency):**
  * Waktu eksekusi mutasi buku besar PostgreSQL deterministik: $< 50$ ms.
  * Waktu ekstraksi struk via Vision Multimodal AI: $< 2.5$ detik.
  * Waktu render awal Web Dashboard: $< 800$ ms.
* **NFR-2 (Zero-Cost Sustainability):** Seluruh inferensi AI berjalan di atas *free-tier rotary key pool* tanpa membebani biaya kartu kredit pengembang atau pengguna.
* **NFR-3 (Data Integrity & Precision):** Seluruh kalkulasi finansial wajib menggunakan tipe data `Decimal` (bukan *floating-point*) untuk mencegah kesalahan pembulatan sepersekian rupiah.
* **NFR-4 (Device Responsiveness):** Tampilan Web Dashboard wajib responsif dari layar smartphone (360px), tablet (768px), hingga desktop monitor (1080p+).
* **NFR-5 (HKI Code Cleanliness):** Repositori mandiri terisolasi 100% dari modul scraping atau gray-area, siap untuk proses verifikasi audit pendaftaran Hak Cipta Kemenkumham.

---

## 5. User Journey & Core Workflows

### 5.1 Workflow A: Pencatatan Cepat via Telegram (Alur Utama)
```
[Pengguna di Kafe]
       │
       ▼ (Kirim foto struk / ketik "kopi 28rb gopay")
[Telegram Bot Gateway]
       │
       ▼ (Resolusi chat_id -> user_id)
[Agentic Runtime + Gemini Vision]
       │
       ▼ (Ekstrak: Rp 28.000, GoPay, Makanan/Minuman, "Kopi")
[Deterministic Ledger Core (PostgreSQL)]
       │ (DEBIT Kategori, KREDIT GoPay -> Saldo Terpotong)
       ▼
[Dynamic Runway Engine]
       │ (Hitung sisa hari & jatah harian baru)
       ▼
[Telegram Bot Reply]
  "✅ Tercatat: Rp 28.000 (Kopi) via GoPay.
   📊 Jatah belanja aman hari ini: Rp 45.000 (12 hari menuju siklus baru)."
```

### 5.2 Workflow B: Interaksi Hero Omni-Input di Web Dashboard
```
[Pengguna di Depan Laptop / Web]
       │
       ▼ (Ketik di Omni-Input Bar / Drag-and-Drop Struk)
[FastAPI /api/v1/dashboard/ai-chat]
       │
       ▼ (Verifikasi JWT Token -> Agent Orchestrator)
[PostgreSQL Ledger Services]
       │
       ▼ (Database Transaction Committed)
[React Dashboard UI Live Update]
  • Kartu Saldo Kas terpotong seketika (Optimistic / Refreshed)
  • Indikator Gauge Runway menyesuaikan batas jatah belanja harian
  • Baris baru muncul di Tabel Mutasi
```

### 5.3 Workflow C: Koreksi Manual (Auxiliary CRUD Fallback)
```
[Pengguna menyadari salah ketik nama akun di struk]
       │
       ▼
[Buka Tabel Transaksi di Web -> Klik Tombol "Edit"]
       │
       ▼ (Ubah akun dari "BCA" menjadi "GoPay")
[PUT /api/v1/transactions/{id}]
       │
       ▼
[LedgerService: Revert Debit/Credit lama, Tulis Debit/Credit baru]
       │
       ▼
[Status Saldo & Runway Kedua Akun Otomatis Seimbang Kembali]
```

---

## 6. Success Metrics & Key Performance Indicators (KPI)

1. **Zero-Friction Logging Ratio:** $\ge 80\%$ dari total transaksi pengguna dicatat melalui AI (Telegram chat / foto struk / Web Omni-Input), membuktikan keberhasilan antarmuka minim friksi dibanding form manual.
2. **Insolvency Prevention (Runway Survival):** Pengguna mempertahankan status `HEALTHY` atau `WARNING` tanpa pernah jatuh ke status `CRITICAL` (defisit kas operasional) sebelum tanggal siklus gajian.
3. **Inference Availability:** 99.5% uptime ketersediaan pemrosesan AI berkat mekanisme failover otomatis pada Rotary Key Pool.
4. **HKI Certification Acceptance:** Lolos evaluasi administrasi dan substantif pendaftaran Hak Cipta Program Komputer di Direktorat Jenderal Kekayaan Intelektual (DJKI) Kemenkumham RI.

---

## 7. Delivery Milestones & Phasing

| Phase | Milestone | Deliverables |
| :--- | :--- | :--- |
| **Phase 1** | **Deterministic Core & Storage** | Skema PostgreSQL, `LedgerService`, `RunwayService`, dan 100% unit tests lolos. |
| **Phase 2** | **Agentic Multimodal Engine** | `RotaryKeyPool`, `AgentOrchestrator`, dan Vision receipt OCR parser. |
| **Phase 3** | **Channel Gateways (Telegram & API)** | Bot Telegram dengan alur pairing OTP dan backend RESTful FastAPI lengkap. |
| **Phase 4** | **Decoupled Web Frontend** | Dashboard React 18 + TS + Tailwind dengan Hero Omni-Input dan Modal CRUD. |
| **Phase 5** | **E2E Hardening & HKI Dossier** | Pengujian siklus penuh, manual pengguna, dan naskah deskripsi ciptaan HKI. |
