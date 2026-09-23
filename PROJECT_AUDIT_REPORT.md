# LAPORAN AUDIT & ANALISIS SISTEM REZEKIFY
**Autonomous Multi-Modal Personal Finance Manager & Deterministic Runway Engine**  
Tanggal Audit: 2026-09-23  
Auditor: Lead Software Architect & Security Engineer  

---

## 1. Executive Summary & Status Arsitektur Proyek Saat Ini

### 1.1 Ringkasan Kondisi Sistem Menyeluruh
Proyek **Rezekify** adalah platform asisten manajemen keuangan personal otonom (*Autonomous Personal Financial Manager*) yang mengintegrasikan penginputan multimodal berbasis kecerdasan buatan (*AI-First Ambient Ingestion*) dengan mesin akuntansi pembukuan berpasangan deterministik (*Deterministic Double-Entry Ledger Core*) serta metrik daya tahan likuiditas kas harian (*Dynamic Safe Runway Engine*).

Secara menyeluruh, kondisi ekosistem sistem saat ini:
1. **Backend Core (FastAPI & Python 3.12)**: Terstruktur dengan baik memisahkan Layer 1 (Services & DB Models), Layer 2 (Agentic Orchestrator & Multi-Model Rotary Runtime), dan Layer 3 (FastAPI Routers). Menggunakan SQLAlchemy 2.0 (synchronous engine dengan session lifecycle per request), Alembic untuk migrasi skema database, Pydantic v2 untuk validasi data, serta `cryptography.fernet` untuk enkripsi data at-rest.
2. **Frontend Client (React 18, Vite, HeroUI & Tailwind CSS)**: Antarmuka decoupled modern berorientasi *mobile-responsive dashboard*. Menggunakan HeroUI v2, Tailwind CSS, Recharts untuk visualisasi analitik tren pengeluaran, Lucide React untuk iconography, serta `AuthContext` untuk manajemen sesi otentikasi JWT stateless di `localStorage`.
3. **Agentic Multi-Modal Gateway (Groq, Gemini & Whisper)**: Mengimplementasikan ReAct pattern dengan *Tool Calling* deterministik. Mampu menerima teks natural (*Indonesian slang*), foto struk fisik/digital (Gemini 2.5 Flash & Groq Llama 4 Scout Vision), serta rekaman pesan suara/audio voice notes (Groq Whisper Large v3).
4. **Telegram Bot Gateway**: Berjalan melalui edge webhook proxy (`/api/v1/gateway/telegram/webhook`) yang meneruskan update teks, foto resolusi tertinggi, dan file audio suara ke dispatcher `TelegramGateway`.
5. **DevOps, CI/CD, dan Kontainerisasi**: Dilengkapi konfigurasi multi-stage `Dockerfile.backend` (non-root execution `UID 10001`), `docker-compose.yml` untuk orkestrasi Postgres 16 dan FastAPI runner, serta skrip otomatisasi inisialisasi skema hybrid (`rezekify/db/init_db.py`).

### 1.2 Kelebihan Arsitektur (Architectural Strengths)
1. **Asymmetric Dual-Tier Architecture ("LLM Zero-Calc Principle")**:
   Pemisahan tegas dan mutlak antara Layer 1 dan Layer 2. LLM dan Vision Model sama sekali tidak dipercaya melakukan kalkulasi uang, penambahan saldo, atau pembagian runway. LLM hanya bertindak sebagai *parser semantik* dan *intent extractor* yang menghasilkan JSON terstruktur (fungsi dan argumen). Seluruh mutasi saldo dan operasi matematika uang dieksekusi oleh Python `Decimal` dengan pembulatan presisi di PostgreSQL. Prinsip ini secara fundamental mengeliminasi risiko halusinasi matematis AI pada uang riil pengguna.
2. **Deterministic Double-Entry Ledger Invariant**:
   Setiap mutasi finansial (pengeluaran, pemasukan, atau transfer) wajib mematuhi persamaan akuntansi berpasangan:
   $$\sum \text{Debit} = \sum \text{Credit}$$
   Didukung mekanisme rollback atomik dan pembalikan jurnal (*ledger reversal*) pada fungsi pembatalan (`delete_transaction`) dan pembaruan (`update_transaction`) dengan *row-level locking* (`with_for_update()`) untuk mencegah race condition.
3. **Zero-Cost Sustainability via RotaryKeyPool**:
   Implementasi pool kunci API mandiri di `rezekify/agent/key_pool.py` untuk Google Gemini dan Groq Cloud. Sistem memantau status kunci, memutar kunci (*round-robin*), dan secara cerdas menerapkan *cooldown penalty* saat mendeteksi status HTTP 429 (Rate Limit). Biaya token inferensi server tetap Rp 0.
4. **Semi-SaaS BYOK (Bring Your Own Key) & Enkripsi Fernet**:
   Memungkinkan pengguna menambahkan kunci API mandiri (Gemini atau Groq) dengan model kustom. Kunci disimpan terenkripsi di database menggunakan Fernet symmetric cipher, memastikan proteksi kerahasiaan kredensial tenant.
5. **In-Memory Sliding-Window Rate Limiting**:
   Mekanisme proteksi throttling mandiri berbasis `collections.deque` dan `time.monotonic()` untuk membatasi frekuensi konsumsi token LLM pada endpoint publik.

### 1.3 Kelemahan Utama dan Technical Debt (Weaknesses & Technical Debt)
1. **Auxiliary Manual CRUD Fallback Tidak Lengkap (FR-6.4 Violation)**:
   Backend sama sekali tidak memiliki router `/api/v1/categories`, menyebabkan frontend memanggil endpoint yang 404 (gagal diam-diam). Komponen modal input manual tidak menyediakan pemilihan kategori, pemilih tanggal, dan upload struk. Tabel mutasi tidak memiliki fitur pencarian teks dan filter tanggal.
2. **Celah Keamanan Webhook & OTP**:
   Validasi secret token webhook Telegram dilewati secara total jika variabel lingkungan tidak disetel. Kode pairing Telegram hanya 4-digit angka acak tanpa mekanisme rate limiting atau lockout, rentan eksploitasi brute-force.
3. **Synchronous LLM Dispatch Bottleneck**:
   Panggilan pemrosesan LLM di webhook Telegram dieksekusi secara sinkronus di threadpool, berisiko tinggi melampaui timeout 5 detik webhook Telegram saat traffic padat atau saat AI mengalami latensi tinggi.
4. **Multi-Worker Rate Limiter Ineffectiveness**:
   Rate limiter in-memory tidak membagikan state antar worker Uvicorn (`WEB_CONCURRENCY > 1`), sehingga batasan request terfragmentasi dan berlipat ganda.
5. **Docker Packaging Defect**:
   `alembic.ini` tidak disalin ke image produksi `Dockerfile.backend`, memicu eksekusi fallback `Base.metadata.create_all()` secara permanen dan menonaktifkan rantai migrasi revisi Alembic di kontainer.

---

## 2. Perbandingan Komprehensif: Progress Saat Ini vs PRD Awal

Evaluasi pemenuhan spesifikasi teknis berdasarkan dokumen `docs/PRD_REZEKIFY.md`:

### Module 1: Deterministic Accounting Core (Layer 1)
- **FR-1.1 (Double-Entry Balancing)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/services/ledger.py` (`record_expense`, `record_income`, `record_transfer`, `update_transaction`).
  - *Analisis*: Setiap mutasi menghasilkan minimal dua `LedgerEntry` (DEBIT dan CREDIT) dengan nominal yang identik. Penggunaan tipe data `Decimal` menjamin presisi hingga level sen tanpa *floating-point rounding error*.
- **FR-1.2 (Multi-Account Support)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/db/models.py` L48-53 (`AccountType` enum: `CASH`, `BANK`, `EWALLET`, `LIABILITY`).
  - *Analisis*: Endpoint `/api/v1/accounts` mendukung pembuatan dan pengelolaan akun multi-tipe dalam mata uang IDR.
- **FR-1.3 (Atomic Transaction Reversal)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/services/ledger.py` L211-255 (`delete_transaction`) dan L257-380 (`update_transaction`).
  - *Analisis*: Pembalikan jurnal dilakukan di dalam transaksi database yang sama dengan membalik debit/kredit ke saldo akun terkait sebelum entri lama dihapus. Proteksi `with_for_update()` mencegah anomali konkurensi.
- **FR-1.4 (Inter-Account Transfers)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/services/ledger.py` L130-186 (`record_transfer`).
  - *Analisis*: Mutasi antar akun mencatat `DEBIT` pada akun penerima dan `CREDIT` pada akun pengirim tanpa melibatkan kategori pengeluaran/beban, menjaga kalkulasi cashflow tetap bersih.

### Module 2: Dynamic Runway Engine (Layer 1)
- **FR-2.1 (Monthly Cycle Calculation)**: **PARSIAL (85%)**
  - *Implementasi*: `rezekify/services/runway.py` L126-134.
  - *Analisis Edge Case Bug*:
    ```python
    # rezekify/services/runway.py L128-133
    if today.day < cycle_day:
        days_remaining = cycle_day - today.day
    else:
        _, days_in_current_month = monthrange(today.year, today.month)
        days_remaining = (days_in_current_month - today.day) + cycle_day
    ```
    Jika pengguna memilih `monthly_cycle_day = 31`:
    - Pada bulan Februari (misal: 28 hari) di tanggal 20 Februari: kondisi `today.day < cycle_day` (20 < 31) bernilai `True`. Maka `days_remaining = 31 - 20 = 11`. Padahal sisa hari di bulan Februari hanya tersisa 8 hari. Nilai pembagi menjadi lebih besar dari realitas kalender, menyebabkan `daily_safe_runway` terhitung lebih kecil secara artifisial (*underestimated budget*).
    - Pada bulan berumur 30 hari (April, Juni, September, November) di tanggal 5: `31 - 5 = 26`, padahal siklus riil seharusnya bergeser ke hari terakhir bulan tersebut (hari ke-30).
- **FR-2.2 (Operational Free Cash Isolation)**: **PARSIAL (80%)**
  - *Implementasi*: `rezekify/services/runway.py` L118-124.
  - *Analisis Deviasi*:
    PRD Section 1.3 dan FR-3.2 mendefinisikan formula:
    $$\text{Daily Safe Runway} = \frac{\text{Total Liquid Assets} - \text{Locked Vault Commitments}}{\text{Days Remaining until Inflow Cycle}}$$
    Namun kode implementasi riil:
    ```python
    vault_sum = (
        self.db.query(func.coalesce(func.sum(Vault.allocated_amount), Decimal("0.00")))
        .filter(Vault.user_id == user_id)
        .scalar()
    )
    operational_free = max(Decimal("0.00"), liquid_sum - vault_sum)
    ```
    Query di atas **tidak memfilter `Vault.is_locked == True`**. Seluruh brankas virtual (termasuk yang tidak terkunci / flexible savings) ikut memotong kas operasional bebas, bertentangan dengan klausul FR-3.2.
- **FR-2.3 (Daily Budget Telemetry)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/services/runway.py` L137-144.
  - *Analisis*: Menghasilkan telemetry jatah harian dan status kesehatan `HEALTHY`, `WARNING`, dan `CRITICAL` secara deterministik.
- **FR-2.4 (Pre-Purchase Simulation)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/services/runway.py` L191-216 (`simulate_purchase`) dan `/api/v1/dashboard/simulate-purchase`.
  - *Analisis*: Mengkalkulasi proyeksi penurunan jatah belanja harian secara instan sebelum pengguna mengeksekusi pembelian impulsif.

### Module 3: Virtual Vaults & Sinking Funds (Layer 1)
- **FR-3.1 (Vault Allocation)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/services/vault.py` dan `rezekify/api/v1/vaults_router.py`.
  - *Analisis*: Pengguna dapat menyisihkan dana ke tipe `SAVINGS` dan `FIXED_BILL` dengan target dana dan target tanggal.
- **FR-3.2 (Locking Mechanism)**: **PARSIAL (80%)**
  - *Implementasi*: `rezekify/services/vault.py` L104-123 (`toggle_vault_lock`, validasi di `update_vault` & `delete_vault`).
  - *Analisis*: Brankas yang terkunci dilindungi dari pengubahan alokasi atau penghapusan. Namun, dana di brankas tidak dipisahkan di rekening bank terpisah, dan rumus runway di `runway.py` memotong semua vault alih-alih brankas yang terkunci saja.

### Module 4: Agentic Multi-Modal Ingestion (Layer 2)
- **FR-4.1 (Rotary Key Pool)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/agent/key_pool.py` (`RotaryKeyPool`).
  - *Analisis*: Mengorkestrasi pool multi-kunci untuk Gemini dan Groq dengan pelacakan cooldown 60 detik saat mendeteksi HTTP 429.
- **FR-4.2 (Natural Language Parsing)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/agent/runtime.py` dan `rezekify/agent/prompt.py`.
  - *Analisis*: Berhasil mengekstrak teks gaul Indonesia ("beli batagor 15rb gopay", "dapet transferan 500rb dari ayah ke bca") menjadi payload entitas terstruktur.
- **FR-4.3 (Receipt & Invoice OCR Vision)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/agent/runtime.py` L104-154.
  - *Analisis*: Memproses gambar struk via Gemini 2.5 Flash dengan fallback ke Groq Vision (`meta-llama/llama-4-scout-17b-16e-instruct`).
- **FR-4.4 (Deterministic Tool Invocation)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/agent/orchestrator.py` L160-269 (`handle_message`).
  - *Analisis*: Ekstraksi entitas dipetakan langsung ke fungsi ledger (`record_expense`, `record_income`, `record_transfer`). AI tidak melakukan aritmatika.
- **Fitur Evolusioner (Melebihi PRD)**:
  - *Groq Whisper Voice Notes*: `rezekify/agent/runtime.py` L190-218 mentranskripsi pesan suara ogg/opus ke teks bahasa Indonesia secara otomatis.
  - *AI BYOK (Bring Your Own Key)*: Pengguna dapat mengonfigurasi API Key mandiri dan memilih model kustom di menu Settings.

### Module 5: Telegram Gateway Client (Layer 3)
- **FR-5.1 (Account Pairing OTP)**: **SELESAI (90%)**
  - *Implementasi*: `rezekify/gateway/telegram_bot.py` L33-64 dan `rezekify/services/auth.py` L47-78.
  - *Analisis*: Mendukung `/link DK-XXXX` dan deep-linking `t.me/RezekifyBot?start=DK-XXXX`. Terdapat celah brute-force yang harus diperbaiki.
- **FR-5.2 (Text & Photo Processing)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/gateway/telegram_bot.py` L80-169.
  - *Analisis*: Menerima pesan teks, foto resolusi tinggi struk belanja, dan audio voice note.
- **FR-5.3 (Instant Commands)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/gateway/telegram_bot.py` L74-76.
  - *Analisis*: Perintah `/runway`, `/saldo`, dan `/status` merespons ringkasan kas dan daya tahan harian.

### Module 6: Decoupled React Web Dashboard (Layer 3)
- **FR-6.1 (Hero Omni-Input Action Bar)**: **SELESAI (100%)**
  - *Implementasi*: `frontend/src/components/OmniInputHero.tsx`.
- **FR-6.2 (Runway Telemetry Widget)**: **SELESAI (100%)**
  - *Implementasi*: `frontend/src/components/RunwayMetricCard.tsx` dan `UpcomingBillsCard.tsx`.
- **FR-6.3 (Interactive Analytics Charts)**: **SELESAI (100%)**
  - *Implementasi*: `frontend/src/components/ExpenseCharts.tsx` (Bar Chart tren pengeluaran harian dan Donut Chart komposisi kategori bulanan).
- **FR-6.4 (Auxiliary Manual CRUD Fallback)**: **DEVIASI BESAR / BELUM SELESAI (50%)**
  - *Kesenjangan Kritis*:
    1. **Tidak Ada Router `/api/v1/categories` di Backend**: Di `frontend/src/pages/DashboardPage.tsx` L63, kode memanggil `apiFetch<Category[]>('/categories')`. Namun di FastAPI backend (`rezekify/api/main.py`), tidak ada router categories yang terdaftar. Panggilan ini selalu menghasilkan HTTP 404 silent failure.
    2. **`ManualTransactionModal.tsx` Tidak Lengkap**: Modal input manual transaksi saat ini hanya menerima field `type`, `amount`, `description`, dan `account_id`. Sama sekali tidak ada:
       - Dropdown pemilihan Kategori.
       - Pemilih tanggal transaksi (`transaction_date`).
       - Dropzone / input file upload struk manual.
    3. **`TransactionsTable.tsx` Tidak Lengkap**: Tabel riwayat mutasi hanya menampilkan daftar pasif transaksi. Tidak ada filter rentang tanggal (*date range picker*) dan tidak ada baris pencarian kata kunci (*search input*).

### Module 7: Security & Multi-Tenancy (Cross-Cutting)
- **FR-7.1 (Tenant Row-Level Isolation)**: **PARSIAL (85%)**
  - *Implementasi*: Dependency `get_current_user` di FastAPI. Sebagian besar query mengisolasi `WHERE user_id = current_user.id`.
  - *Celah Ditemukan*: `category_id` pada method `record_expense` dan `record_income` di `rezekify/services/ledger.py` tidak memvalidasi apakah kategori tersebut milik tenant yang bersangkutan.
- **FR-7.2 (JWT Bearer Auth)**: **SELESAI (100%)**
  - *Implementasi*: `rezekify/core/security.py` L29-35 dan `rezekify/api/deps.py` L20-43.
- **FR-7.3 (Password Hashing)**: **SELESAI (100%)**
  - *Implementasi*: Bcrypt hashing dengan random salt dan pemotongan aman 72 byte.

---

### Matriks Ringkasan Kepatuhan PRD

| Modul PRD | Persyaratan Fungsional | Status Kepatuhan | Keterangan & Deviasi |
| :--- | :--- | :--- | :--- |
| **Module 1: Accounting Core** | FR-1.1 (Double-Entry Balance) | **Selesai** | Ledger debit/credit seimbang secara matematis. |
| | FR-1.2 (Multi-Account Support) | **Selesai** | `CASH`, `BANK`, `EWALLET`, `LIABILITY`. |
| | FR-1.3 (Atomic Reversal) | **Selesai** | Rollback mutasi saldo berjalan atomik dengan locking. |
| | FR-1.4 (Inter-Account Transfers) | **Selesai** | Mutasi aset murni tanpa beban pengeluaran. |
| **Module 2: Runway Engine** | FR-2.1 (Monthly Cycle Day) | **Parsial** | Bug kalkulasi sisa hari pada siklus tgl 31 di bulan pendek. |
| | FR-2.2 (Operational Free Cash) | **Parsial** | Memotong semua brankas alih-alih brankas yang terkunci saja. |
| | FR-2.3 (Daily Budget Telemetry) | **Selesai** | Threshold status masih hardcoded Rp 30.000. |
| | FR-2.4 (Pre-Purchase Simulation) | **Selesai** | Simulasi kalkulasi penurunan runway berjalan akurat. |
| **Module 3: Virtual Vaults** | FR-3.1 (Vault Allocation) | **Selesai** | Alokasi dana untuk `SAVINGS` dan `FIXED_BILL`. |
| | FR-3.2 (Locking Mechanism) | **Parsial** | Proteksi edit/delete brankas ada; formula runway belum sinkron. |
| **Module 4: Agentic Ingestion** | FR-4.1 (Rotary Key Pool) | **Selesai** | Failover round-robin dan cooldown 429 berjalan sempurna. |
| | FR-4.2 (Natural Language Parsing) | **Selesai** | Ekstraksi entitas bahasa percakapan santai via LLM. |
| | FR-4.3 (Receipt OCR Vision) | **Selesai** | Gemini 2.5 Flash + Groq Vision failover. |
| | FR-4.4 (Deterministic Tool Calls) | **Selesai** | AI zero-calculation invariant dipatuhi 100%. |
| | *Evolutionary Features* | **Selesai (Bonus)** | Groq Whisper Large v3 Voice Notes & AI BYOK. |
| **Module 5: Telegram Gateway** | FR-5.1 (Account Pairing OTP) | **Parsial** | Kode pairing 4-digit rentan brute-force. |
| | FR-5.2 (Text & Photo Processing) | **Selesai** | Parsing teks, struk kamera, dan audio voice note. |
| | FR-5.3 (Instant Commands) | **Selesai** | Perintah `/runway`, `/saldo`, dan `/status`. |
| **Module 6: React Dashboard** | FR-6.1 (Omni-Input Action Bar) | **Selesai** | Input teks kasual dan drag-drop foto struk. |
| | FR-6.2 (Runway Gauge Widget) | **Selesai** | Kartu visual runway dengan traffic light indicator. |
| | FR-6.3 (Interactive Analytics) | **Selesai** | Grafik pengeluaran harian vs limit dan donut chart kategori. |
| | FR-6.4 (Auxiliary Manual CRUD) | **Deviasi / Belum Selesai** | Ketiadaan router `/categories`, modal transaksi tanpa kategori/tanggal/struk, tabel tanpa filter/search. |
| **Module 7: Security & Multi-Tenancy** | FR-7.1 (Tenant Row Isolation) | **Parsial** | Celah pada validasi kepemilikan `category_id` di ledger. |
| | FR-7.2 (JWT Bearer Auth) | **Selesai** | Token stateless dengan expirasi aman. |
| | FR-7.3 (Password Hashing) | **Selesai** | Bcrypt dengan salt acak dan batas 72 bytes. |

---

## 3. Audit Celah Kerentanan Keamanan (Security Vulnerabilities)

### VULN-01: Telegram Webhook Secret Bypass & Non-Constant-Time Comparison
- **Kategori**: Broken Authentication / Timing Attack
- **Tingkat Keparahan**: **HIGH** (CVSS 8.2)
- **File & Baris Kode**: `rezekify/api/v1/gateway_router.py` (Baris 21–26)
- **Cuplikan Kode**:
  ```python
  if settings.TELEGRAM_WEBHOOK_SECRET:
      if x_telegram_bot_api_secret_token != settings.TELEGRAM_WEBHOOK_SECRET:
          raise HTTPException(
              status_code=status.HTTP_403_FORBIDDEN,
              detail="Invalid Telegram webhook secret token",
          )
  ```
- **Analisis Eksploitasi**:
  1. Jika variabel lingkungan `TELEGRAM_WEBHOOK_SECRET` bernilai `None` atau string kosong `""` (kondisi default di `rezekify/core/config.py` L72), blok `if settings.TELEGRAM_WEBHOOK_SECRET:` bernilai `False`. Akibatnya, siapapun di internet dapat mengirim HTTP POST ke `/api/v1/gateway/telegram/webhook` tanpa header rahasia sama sekali.
  2. Penyerang dapat memalsukan pesan Telegram dengan mengirim JSON update buatan yang mencantumkan `chat_id` milik korban dan teks mutasi palsu (misal: "beli mobil 500jt bca"), merusak data buku besar keuangan korban.
  3. Ketika secret token diisi, pengecekan menggunakan operator `!=` (non-constant-time string comparison) yang membuka celah *side-channel timing attack* untuk merekonstruksi karakter token rahasia per milidetik latensi respon.
- **Rekomendasi Perbaikan**:
  Wajibkan token rahasia webhook di lingkungan non-pengembangan melalui validator konfigurasi Pydantic. Gunakan fungsi konstan waktu `secrets.compare_digest`:
  ```python
  import secrets

  if not settings.TELEGRAM_WEBHOOK_SECRET:
      raise HTTPException(
          status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
          detail="Telegram webhook secret is not configured on the server",
      )

  if not x_telegram_bot_api_secret_token or not secrets.compare_digest(
      x_telegram_bot_api_secret_token, settings.TELEGRAM_WEBHOOK_SECRET
  ):
      raise HTTPException(
          status_code=status.HTTP_403_FORBIDDEN,
          detail="Invalid Telegram webhook secret token",
      )
  ```

---

### VULN-02: Kerentanan Brute-Force pada Telegram OTP Pairing Code
- **Kategori**: Identification and Authentication Failures
- **Tingkat Keparahan**: **HIGH** (CVSS 7.5)
- **File & Baris Kode**: `rezekify/core/security.py` (Baris 37–39) & `rezekify/gateway/telegram_bot.py` (Baris 38)
- **Cuplikan Kode**:
  ```python
  # rezekify/core/security.py
  def generate_pairing_code() -> str:
      """Generates a secure 4-digit numeric code with DK- prefix for Telegram OTP linking."""
      return f"DK-{secrets.randbelow(9000) + 1000}"
  ```
- **Analisis Eksploitasi**:
  1. Entropi kode hanya 4 digit numerik ($1000$ sampai $9999$), yang berarti hanya ada **9.000 kemungkinan kombinasi**.
  2. Masa aktif kode adalah 15 menit (`rezekify/services/auth.py` L52).
  3. Pada `rezekify/gateway/telegram_bot.py` L38, perintah `/link DK-XXXX` atau `/start DK-XXXX` tidak menerapkan pembatasan frekuensi percobaan gagal (*failed attempt rate limiting*) atau penguncian akun (*lockout*).
  4. Penyerang dapat menggunakan script bot Telegram untuk mengirim ratusan perintah `/link DK-XXXX` dalam hitungan detik. Dengan hanya 9.000 kombinasi dalam jendela waktu 15 menit, penyerang memiliki probabilitas keberhasilan tinggi untuk menebak kode yang sedang aktif milik pengguna lain dan menautkan akun finansial korban ke akun Telegram penyerang.
- **Rekomendasi Perbaikan**:
  1. Tingkatkan entropi kode menjadi minimal 6 digit alphanumeric atau base32 (misal: `DK-7X9K2M`), menghasilkan $32^6 = 1.073.741.824$ kombinasi.
  2. Terapkan batasan maksimal 5 kali percobaan gagal per chat ID atau pembatalan kode secara otomatis setelah 3 kali salah tebak.

---

### VULN-03: Tabrakan Unique Constraint DoS saat Generate Telegram Pairing Code
- **Kategori**: Denial of Service (Application Logic Flaw)
- **Tingkat Keparahan**: **MEDIUM** (CVSS 5.3)
- **File & Baris Kode**: `rezekify/services/auth.py` (Baris 47–54) & `rezekify/db/models.py` (Baris 87)
- **Cuplikan Kode**:
  ```python
  # rezekify/db/models.py L87
  telegram_pairing_code = Column(String(32), unique=True, nullable=True, index=True)

  # rezekify/services/auth.py L47-54
  def generate_telegram_pairing_code(self, user_id: UUID) -> str:
      user = self.db.query(User).filter_by(id=user_id).one()
      code = generate_pairing_code()
      user.telegram_pairing_code = code
      user.pairing_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
      self.db.commit()
      return code
  ```
- **Analisis Eksploitasi**:
  Kolom database `telegram_pairing_code` memiliki konstrain `unique=True`. Ketika fungsi `generate_telegram_pairing_code` dijalankan, ia tidak memeriksa apakah kode acak yang dihasilkan saat itu sedang dipakai oleh user lain di database. Karena ruang sampel kode hanya 9.000 kombinasi, jika ada tabrakan (*collision*), eksekusi `self.db.commit()` melempar unhandled `sqlalchemy.exc.IntegrityError` (`UniqueViolation`), mengakibatkan HTTP 500 Internal Server Error yang menggagalkan fitur penautan akun bagi pengguna.
- **Rekomendasi Perbaikan**:
  Tambahkan mekanisme retry loop dengan pengecekan tabrakan kode aktif sebelum melakukan commit:
  ```python
  max_attempts = 5
  for _ in range(max_attempts):
      code = generate_pairing_code()
      existing = self.db.query(User).filter(
          User.telegram_pairing_code == code,
          User.pairing_code_expires_at > datetime.now(timezone.utc)
      ).first()
      if not existing:
          user.telegram_pairing_code = code
          user.pairing_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
          self.db.commit()
          return code
  raise RuntimeError("Failed to generate a unique pairing code. Please try again.")
  ```

---

### VULN-04: Cross-Tenant Category Attachment pada Mutasi Ledger
- **Kategori**: Broken Object Level Authorization (BOLA / IDOR)
- **Tingkat Keparahan**: **MEDIUM** (CVSS 6.5)
- **File & Baris Kode**: `rezekify/services/ledger.py` (Baris 25–78 & 79–128) vs (Baris 307–314)
- **Cuplikan Kode**:
  ```python
  # rezekify/services/ledger.py L25-65 (record_expense)
  account = self.db.query(Account).filter_by(id=account_id, user_id=user_id).with_for_update().one()
  # ...
  debit_entry = LedgerEntry(
      transaction_id=tx.id,
      user_id=user_id,
      category_id=category_id,  # <-- TIDAK DIVALIDASI KEPEMILIKANNYA!
      entry_type=EntryType.DEBIT,
      amount=amount,
  )
  ```
- **Analisis Eksploitasi**:
  Pada method `update_transaction` (Baris 307–314), developer sudah menerapkan validasi kepemilikan kategori:
  ```python
  if category_id:
      cat = self.db.query(Category).filter_by(id=category_id, user_id=user_id).one_or_none()
      if not cat:
          raise ValueError("Category not found or access denied.")
  ```
  Namun pada method `record_expense` (L25-78) dan `record_income` (L79-128), validasi ini terlupakan. Pengguna A dapat mengirimkan payload transaksi dengan `category_id` milik Pengguna B. Akibatnya, entri buku besar Pengguna A merujuk pada kategori privat milik tenant lain.
- **Rekomendasi Perbaikan**:
  Tambahkan blok validasi tenant pada `category_id` di awal method `record_expense` dan `record_income`:
  ```python
  if category_id:
      category = self.db.query(Category).filter_by(id=category_id, user_id=user_id).one_or_none()
      if not category:
          raise ValueError("Category not found or access denied.")
  ```

---

### VULN-05: Ketiadaan Rate Limiting pada Endpoint Autentikasi dan Validasi AI
- **Kategori**: Security Misconfiguration / Lack of Resources & Rate Limiting
- **Tingkat Keparahan**: **MEDIUM** (CVSS 6.5)
- **File & Baris Kode**: `rezekify/api/v1/auth_router.py` (L53–82) & `rezekify/api/v1/settings_router.py` (L67–84)
- **Analisis Eksploitasi**:
  1. `POST /api/v1/auth/login`: Tidak memiliki proteksi `RateLimiter`. Penyerang dapat melakukan *credential stuffing* atau *dictionary attack* terhadap akun pengguna tanpa hambatan throttling.
  2. `POST /api/v1/auth/register`: Bebas dipanggil tanpa batasan frekuensi, memungkinkan bot spam membuat ribuan akun dummy yang membebani kapasitas database.
  3. `POST /api/v1/settings/ai/validate`: Endpoint ini memicu panggilan jaringan keluar (*outbound live API call*) ke Google Gemini atau Groq Cloud untuk memverifikasi kunci. Tanpa rate limiting, seorang penyerang dapat membanjiri endpoint ini untuk membakar kuota rate-limit IP server atau mengeksploitasi server sebagai HTTP reflector/proxy DoS.
- **Rekomendasi Perbaikan**:
  Pasang instance `RateLimiter` berbasis IP/User pada router autentikasi dan validasi kunci:
  ```python
  auth_limiter = RateLimiter(max_requests=5, window_seconds=60)
  ai_validate_limiter = RateLimiter(max_requests=10, window_seconds=60)

  @auth_router.post("/login", dependencies=[Depends(auth_limiter)])
  @auth_router.post("/register", dependencies=[Depends(auth_limiter)])
  @settings_router.post("/ai/validate", dependencies=[Depends(ai_validate_limiter)])
  ```

---

### VULN-06: Weak Key Derivation Fallback dan Kredensial Default Staging/Dev
- **Kategori**: Cryptographic Failures
- **Tingkat Keparahan**: **MEDIUM** (CVSS 5.9)
- **File & Baris Kode**: `rezekify/core/config.py` (Baris 8, 81–86), `rezekify/core/crypto.py` (Baris 16–19), dan `docker-compose.yml` (Baris 11, 40)
- **Cuplikan Kode**:
  ```python
  # rezekify/core/crypto.py L16-19
  # Deterministic fallback derivation from SECRET_KEY
  digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
  derived_key = base64.urlsafe_b64encode(digest)
  return Fernet(derived_key)
  ```
- **Analisis Eksploitasi**:
  1. Jika variabel lingkungan `ENCRYPTION_KEY` tidak diatur, modul kriptografi melakukan derivasi Fernet key langsung dari `SECRET_KEY`.
  2. Di lingkungan pengembangan dan pengujian, `SECRET_KEY` bernilai default publik: `DEFAULT_DEV_SECRET = "rezekify-secure-random-jwt-key-development"`.
  3. Jika suatu deployment staging/cloud lupa mendefinisikan `ENCRYPTION_KEY` dan `ENVIRONMENT` belum disetel ke `production`, seluruh API key AI kustom milik pengguna dienkripsi dengan kunci publik yang mudah didekripsi oleh pihak ketiga.
  4. Penggabungan fungsi kunci enkripsi database dengan JWT secret key melanggar prinsip *separation of concerns* dalam kriptografi (rotasi `SECRET_KEY` akan merusak data cipherteks API key yang tersimpan di database).
- **Rekomendasi Perbaikan**:
  Pisahkan `ENCRYPTION_KEY` secara independen, wajibkan diisi di tingkat konfigurasi Pydantic, dan gunakan algoritma Key Derivation Function (KDF) standar industri seperti PBKDF2/Argon2 dengan salt independen jika perlu melakukan derivasi kunci.

---

## 4. Audit Nilai Hard-Coded (Hard-Coded Values & Configurations)

Daftar nilai konstanta statis yang tertanam langsung di dalam kode (*hard-coded*) dan analisis dampaknya:

| Kode ID | File & Nomor Baris | Nilai yang Di-Hardcode | Alasan & Rekomendasi Perbaikan |
| :--- | :--- | :--- | :--- |
| **HC-01** | `rezekify/services/runway.py`: L140, L200 | `Decimal("30000.00")` | **Financial Health Threshold Rp 30.000/hari**: Standar biaya hidup harian bersifat subjektif. Bagi mahasiswa rantau di kota kecil, Rp 30.000 mungkin sangat cukup, tetapi di kota metropolitan angka tersebut mungkin sudah masuk kategori darurat. Nilai ini harus dijadikan kolom preferensi di tabel `users` (misal: `user.custom_safe_threshold`) dengan nilai default Rp 30.000. |
| **HC-02** | `rezekify/agent/runtime.py`: L133, L205<br>`rezekify/schemas/settings.py`: L90<br>`rezekify/db/models.py`: L190 | `meta-llama/llama-4-scout-17b-16e-instruct`<br>`whisper-large-v3`<br>`llama-3.3-70b-versatile`<br>`gemini-2.5-flash` | **Model AI Hardcoded di Runtime & Validasi**: String identifier model tertanam di berbagai file. Saat provider Groq atau Google memperbarui atau memensiunkan versi model (misal transisi ke Llama 4.1 atau Whisper Turbo), kode akan rusak. Seluruh identifier model wajib dipusatkan di `rezekify/core/config.py` atau enum konfigurasi terpusat. |
| **HC-03** | `rezekify/agent/orchestrator.py`: L96 | `UUID("00000000-0000-0000-0000-000000000000")` | **Hardcoded Nil UUID**: Nil UUID digunakan sebagai fallback jika `user_id` bernilai None saat pemanggilan agent runtime. Ini memicu potensi anomali foreign key atau cache state. Harus melempar `ValueError("Valid user_id is required")` alih-alih menggunakan dummy UUID. |
| **HC-04** | `rezekify/core/config.py`: L8, L17<br>`docker-compose.yml`: L11, L40 | `rezekify-secure-random-jwt-key-development`<br>`postgres:postgres@localhost:5432/rezekify`<br>`postgres_secure_production_password` | **Dev Secrets & DB Passwords**: Kredensial default database dan JWT secret tertulis terbuka di kode sumber. Di production, konfigurasi harus menolak menyala jika variabel lingkungan tidak disuntikkan secara eksplisit dari secrets manager. |
| **HC-05** | `rezekify/core/config.py`: L24–27<br>`frontend/src/services/apiClient.ts`: L21 | `http://localhost:5173`, `http://127.0.0.1:5173`<br>`http://localhost:8000/api/v1` | **Localhost Ports & URLs**: URL client dan server di-hardcode ke port Vite/Uvicorn lokal. Harus sepenuhnya dikendalikan via variabel lingkungan `ALLOWED_ORIGINS` dan `VITE_API_URL`. |

---

## 5. Audit Dead Code & Redundant Code

Analisis kode mati, fungsi yatim (*orphaned code*), dan pemborosan komputasi di dalam repositori:

### DEAD-01: Method `handle_receipt` di `rezekify/agent/orchestrator.py`
- **File & Baris**: `rezekify/agent/orchestrator.py` (Baris 273–389, ~116 baris kode)
- **Kondisi**: Method `handle_receipt` menerima `image_bytes`, memanggil OCR LLM, dan mengeksekusi mutasi ledger. Namun di seluruh router API FastAPI maupun Telegram Gateway:
  - Di `rezekify/api/v1/dashboard_router.py` L174–180: pemrosesan struk gambar memanggil `orchestrator.handle_message(text=prompt_text, image_bytes=content)`.
  - Di `rezekify/gateway/telegram_bot.py` L86: pemrosesan foto telegram memanggil `self.orchestrator.handle_message(caption or "struk belanja", image_bytes=image_bytes)`.
- **Dampak**: 116 baris logika kompleks di `handle_receipt` adalah kode mati yang hanya dipanggil di satu unit test (`tests/test_agent_orchestrator.py`). Logika ini menduplikasi fungsionalitas `handle_message`.
- **Rekomendasi**: Hapus method `handle_receipt` dan alihkan unit test terkait untuk langsung menguji `handle_message`.

### DEAD-02: Fungsi `bootstrap_database` di `rezekify/db/init_db.py`
- **File & Baris**: `rezekify/db/init_db.py` (Baris 110–116)
- **Kondisi**:
  ```python
  def bootstrap_database(
      target_engine: Optional[Engine] = None,
      max_retries: int = 30,
      retry_interval: float = 2.0,
  ) -> bool:
      """Alias for init_db."""
      return init_db(target_engine=target_engine, max_retries=max_retries, retry_interval=retry_interval)
  ```
- **Dampak**: Fungsi ini hanya alias wrapper untuk `init_db`. Pencarian global di seluruh codebase membuktikan tidak ada satu pun modul atau skrip yang mengimpor atau memanggil `bootstrap_database`.
- **Rekomendasi**: Hapus fungsi alias `bootstrap_database` untuk menjaga kode tetap ringkas dan bersih.

### DEAD-03: Komponen Yatim `AuthModal.tsx` di Frontend
- **File & Baris**: `frontend/src/components/AuthModal.tsx` & `frontend/src/__tests__/AuthModal.test.tsx`
- **Kondisi**: Komponen ini adalah modal login/register warisan awal pengembangan. Saat ini arsitektur autentikasi frontend sudah beralih total ke halaman terpisah `frontend/src/pages/AuthPage.tsx` dan `frontend/src/context/AuthContext.tsx`. Di `App.tsx`, aplikasi me-render `<AuthPage />` jika pengguna belum login.
- **Dampak**: `AuthModal.tsx` tidak pernah di-mount atau di-render di aplikasi manapun, tetapi tetap membebani suite unit test dan memelihara state token lokal yang inkonsisten dengan `AuthContext`.
- **Rekomendasi**: Hapus file `AuthModal.tsx` dan `AuthModal.test.tsx`.

### DEAD-04: Deklarasi Interface `ReceiptUploadResponse` di Frontend
- **File & Baris**: `frontend/src/types/api.ts` (Baris 110–114) dan `frontend/src/pages/DashboardPage.tsx` (Baris 23)
- **Kondisi**: Interface `ReceiptUploadResponse` dideklarasikan dan diimpor di `DashboardPage.tsx`, tetapi endpoint backend `/api/v1/dashboard/ai-receipt` mengembalikan skema `ChatResponse` (`{"reply": string}`).
- **Dampak**: Tipe data tidak terpakai (*unused import & orphaned interface*).
- **Rekomendasi**: Hapus deklarasi interface dan bersihkan import di `DashboardPage.tsx`.

### DEAD-05: Panggilan Silent Error `/categories` di DashboardPage
- **File & Baris**: `frontend/src/pages/DashboardPage.tsx` (Baris 63)
- **Kondisi**:
  ```typescript
  const [sumData, txData, accData, catData] = await Promise.all([
    apiFetch<DashboardSummaryResponse>('/dashboard/summary').catch(() => null),
    apiFetch<Transaction[]>('/transactions').catch(() => []),
    apiFetch<Account[]>('/accounts').catch(() => []),
    apiFetch<Category[]>('/categories').catch(() => []),
  ]);
  ```
- **Dampak**: Karena backend tidak memiliki router `/categories`, panggilan ini selalu melempar error 404 pada setiap render awal dashboard. Error tersebut ditelan oleh `.catch(() => [])`, membuang round-trip HTTP request sia-sia.
- **Rekomendasi**: Segera sediakan endpoint `/api/v1/categories` di backend (lihat Bagian 7 - Prioritas 1).

### DEAD-06: Kebocoran Memori Monotonik pada `RateLimiter._history`
- **File & Baris**: `rezekify/core/rate_limit.py` (Baris 18–45)
- **Kondisi**:
  ```python
  self._history: dict[str, deque[float]] = defaultdict(deque)
  # ...
  q = self._history[key]
  boundary = now - self.window_seconds
  while q and q[0] <= boundary:
      q.popleft()
  ```
  Ketika entri timestamp lama di-pop dari deque `q`, jika `len(q) == 0`, key `key` tersebut **tetap tersimpan selamanya** di dalam dictionary `self._history`.
- **Dampak**: Pada server yang melayani ribuan request dari berbagai alamat IP unik atau token JWT, dictionary `_history` akan tumbuh terus menerus tanpa batas (*unbounded memory leak*).
- **Rekomendasi**: Hapus key dari dictionary saat deque kosong atau tambahkan mekanisme sweep/cleanup periodik:
  ```python
  if not q:
      del self._history[key]
  ```

---

## 6. Analisa & Kritik Rekayasa Sistem (Engineering Critique)

### 6.1 Bottleneck Sinkronisasi LLM Dispatch pada Webhook Telegram
- **Masalah Arsitektural**: Pada router `rezekify/api/v1/gateway_router.py` dan `rezekify/gateway/telegram_bot.py`, pesan yang masuk diproses secara langsung (*blocking request-response cycle*). Di dalamnya, `handle_message` memanggil inferensi LLM atau OCR Vision yang membutuhkan waktu antara 1,5 hingga 8 detik (terlebih jika terjadi failover kunci atau retry rate limit).
- **Dampak**: Telegram API menerapkan ambang batas timeout maksimal 5 detik pada koneksi webhook. Jika respon tidak diterima dalam 5 detik, Telegram menganggap paket gagal terkirim dan melakukan pengiriman ulang otomatis (*retry delivery storm*). Hal ini berisiko fatal memicu duplikasi pencatatan transaksi di buku besar keuangan pengguna.
- **Solusi Rekayasa**: Gunakan pola *Asynchronous Task Queue*. Webhook router harus segera membalas `HTTP 200 OK` ke Telegram dalam waktu < 200 ms, lalu mengoper payload ke FastAPI `BackgroundTasks`, Celery worker, atau queue berbasis Redis (ARQ/BullMQ). Setelah pemrosesan AI dan mutasi ledger selesai, bot mengirim balasan teks ke Telegram menggunakan Telegram Bot API method `sendMessage` / `sendPhoto`.

### 6.2 Ketidakefektifan In-Memory Rate Limiting pada Skalabilitas Horizontal
- **Masalah Arsitektural**: Konfigurasi kontainer produksi `docker-compose.yml` menyetel `WEB_CONCURRENCY: 2` (dua proses worker Uvicorn). Modul `RateLimiter` menyimpan antrian request di memori RAM internal proses (`dict[str, deque[float]]`).
- **Dampak**:
  1. Worker 1 dan Worker 2 memiliki alokasi RAM terpisah dan tidak saling berbagi state.
  2. Beban request yang didistribusikan secara round-robin oleh Uvicorn master akan membagi dua hitungan rate limit, sehingga batas request pengguna menjadi 2x lipat lebih longgar dari konfigurasi yang diinginkan.
  3. Jika aplikasi di-scale menjadi multi-kontainer (misal via Kubernetes atau Docker Swarm), proteksi rate limit menjadi tidak berguna. Selain itu, setiap kali container melakukan restart, seluruh riwayat rate limit hilang seketika.
- **Solusi Rekayasa**: Implementasikan rate limiter terdistribusi berbasis Redis menggunakan algoritma *Token Bucket* atau *Sliding Window Counter* dengan eksekusi atomik via script Lua.

### 6.3 Defek Pengemasan Kontainer Docker (Alembic Missing)
- **Masalah Arsitektural**: Pada file `Dockerfile.backend` Baris 39–41:
  ```dockerfile
  COPY --chown=rezekify:rezekify rezekify/ /app/rezekify/
  COPY --chown=rezekify:rezekify pyproject.toml /app/
  COPY --chown=rezekify:rezekify docker/backend/docker-entrypoint.sh /app/docker-entrypoint.sh
  ```
  File konfigurasi `alembic.ini` yang berada di root repository **tidak disalin** ke dalam image Docker.
- **Dampak**: Saat container backend dijalankan di lingkungan produksi, skrip inisialisasi `rezekify/db/init_db.py` mencoba memuat `alembic.ini`. Karena file tidak ditemukan, inisialisasi selalu terlempar ke blok catch exception dan mengeksekusi fallback `Base.metadata.create_all(bind=db_engine)`. Akibatnya, database tidak memiliki riwayat revisi skema Alembic yang valid, menyulitkan migrasi skema inkremental di masa mendatang.
- **Solusi Rekayasa**: Tambahkan instruksi `COPY --chown=rezekify:rezekify alembic.ini /app/` ke dalam `Dockerfile.backend`.

### 6.4 Fragmentasi State Frontend & Kelemahan Isolasi Komponen
- **Masalah Arsitektural**: Komponen `DashboardPage.tsx` bertindak sebagai *God Component* yang mengelola lebih dari 15 state terpisah (`summary`, `transactions`, `accounts`, `categories`, dan state visibilitas untuk 7 modal berbeda).
- **Dampak**: Setiap kali ada aksi mutasi di salah satu modal, halaman dashboard melakukan re-fetch massal via `loadData()` yang memicu render ulang seluruh hierarki DOM. Tidak ada isolasi query cache (seperti TanStack Query / SWR), meningkatkan latensi render dan risiko *race condition* saat koneksi internet pengguna tidak stabil.

---

## 7. Roadmap & Actionable Recommendations

Rekomendasi langkah perbaikan diurutkan berdasarkan matriks dampak dan tingkat urgensi teknis:

```
[ P0: Keamanan Kritis ] ──> [ P1: Kepatuhan PRD ] ──> [ P2: Refactoring & Clean-up ] ──> [ P3: Skalabilitas ]
```

### Prioritas 0 (P0 - Immediate Security Fixes)
1. **Wajibkan Validasi Webhook Secret Token**:
   - Perbaiki `rezekify/api/v1/gateway_router.py`: Jangan izinkan bypass saat secret kosong, dan bandingkan token dengan `secrets.compare_digest`.
2. **Perkuat Entropi & Proteksi OTP Telegram**:
   - Perbaiki `rezekify/core/security.py`: Ubah `generate_pairing_code()` menjadi 6 digit base32 (`DK-XXXXXX`).
   - Perbaiki `rezekify/gateway/telegram_bot.py`: Tambahkan rate limiter dan pembatasan maksimal 5 kali percobaan gagal penautan OTP.
3. **Tambahkan Validasi Kepemilikan Kategori di Ledger**:
   - Perbaiki `rezekify/services/ledger.py`: Tambahkan query pengecekan `user_id` pada `category_id` di `record_expense` dan `record_income`.
4. **Pasang Rate Limiter pada Auth & AI Validation**:
   - Terapkan rate limiter pada endpoint `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, dan `POST /api/v1/settings/ai/validate`.

### Prioritas 1 (P1 - PRD Compliance & Fitur Hilang)
1. **Implementasi Category CRUD Router**:
   - Buat file `rezekify/api/v1/categories_router.py` yang menyediakan endpoint lengkap (`GET /`, `POST /`, `PUT /{id}`, `DELETE /{id}`). Daftarkan router di `rezekify/api/main.py`.
2. **Lengkapi Form Transaksi Manual (`ManualTransactionModal.tsx`)**:
   - Tambahkan dropdown pemilihan Kategori (mengonsumsi data dari router `/categories`).
   - Tambahkan pemilih tanggal transaksi (`transaction_date`).
   - Tambahkan opsi input/upload struk manual.
3. **Lengkapi Tabel Transaksi (`TransactionsTable.tsx`)**:
   - Tambahkan komponen *Search Input Bar* untuk menyaring deskripsi transaksi secara real-time.
   - Tambahkan komponen *Date Range Picker* untuk memfilter transaksi berdasarkan periode kalender.
4. **Perbaiki Edge-Case Kalender Siklus Bulanan**:
   - Perbaiki logika `calculate_runway` di `rezekify/services/runway.py` agar menangani siklus tanggal 31 di bulan berumur 28/29/30 hari dengan menggunakan `min(cycle_day, days_in_month)`.
5. **Sinkronisasi Formula Runway dengan Locked Vaults**:
   - Perbaiki query alokasi vault di `rezekify/services/runway.py` agar hanya memotong brankas yang berstatus `Vault.is_locked == True` sesuai klausul FR-2.2 & FR-3.2.

### Prioritas 2 (P2 - Refactoring & Dead Code Removal)
1. **Hapus Dead Code**:
   - Hapus method `handle_receipt` di `rezekify/agent/orchestrator.py`.
   - Hapus fungsi `bootstrap_database` di `rezekify/db/init_db.py`.
   - Hapus komponen `frontend/src/components/AuthModal.tsx` dan unit test-nya.
   - Hapus interface `ReceiptUploadResponse` di `frontend/src/types/api.ts`.
2. **Perbaiki Memory Leak Rate Limiter**:
   - Hapus key dari dictionary `RateLimiter._history` ketika antrian timestamp bernilai kosong.
3. **Perbaiki Image Packaging Docker**:
   - Tambahkan instruksi `COPY --chown=rezekify:rezekify alembic.ini /app/` ke dalam `Dockerfile.backend`.

### Prioritas 3 (P3 - Skalabilitas & Arsitektur Lanjutan)
1. **Asynchronous Telegram Webhook Dispatcher**:
   - Ubah pemrosesan webhook Telegram menjadi asynchronous menggunakan FastAPI `BackgroundTasks` untuk menjamin balasan HTTP 200 instan (< 200ms) ke server Telegram.
2. **Distributed Redis Rate Limiting & Caching**:
   - Ganti in-memory rate limiter dengan Redis sliding window counter untuk mendukung horizontal scaling multi-worker.
3. **Konfigurasi Ambang Batas Finansial Dinamis**:
   - Sediakan pengaturan profil ambang batas aman harian (`user.safe_runway_threshold`) yang dapat dikustomisasi oleh pengguna menggantikan nilai statis Rp 30.000.

---
*Dokumen audit ini disusun secara independen dan komprehensif berdasarkan telaah kode statis (*static code analysis*) dan pengujian arsitektur pada repositori Rezekify.*
