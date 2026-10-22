# LAPORAN AUDIT CHECK & BALANCE AGNOSTIK: DOKUMEN PROPOSAL SIS1-CD1 VS EXISTING PROJECT REZEKIFY

---

## 1. INFORMASI & METADATA AUDIT

- **Dokumen Objek Audit:** Dokumen Usulan Gagasan dan Pemilihan Topik (Nomor Dokumen: SIS1-CD1)
- **Institusi & Laboratorium:** Vigris Labs — Universitas Negeri Surabaya (UNESA) Tahun 2026
- **Dosen Pembimbing:**
  - Pembimbing 1: Dwi Fatrianto Suyatno, S. Kom., M. Kom.
  - Pembimbing 2: I Kadek Dwi Nuryana, S.T., M. Kom.
- **Tim Pengembang CD-1:**
  1. Project Manager: Imroatus Shaliha
  2. System Analyst: Shinta Olivia Kumalasari
  3. UI/UX Designer: Oktaviana Ramadhani Faadhillah
  4. Frontend Developer: Rafi Dwi Saputra
  5. Backend Developer: Grant Samuel Manurung
- **Auditor:** Lead Systems Architect / Agnostic Quality Assessor
- **Tanggal Pelaksanaan Audit:** 13 Oktober 2026
- **Lingkup Audit:** *Bidirectional Agnostic Audit* (Audit Dua Arah Objektif):
  1. Audit Dokumen Proposal CD-1 terhadap Realisasi Codebase Rezekify (Verifikasi pemenuhan janji spesifikasi).
  2. Audit Codebase Rezekify terhadap Dokumen Proposal CD-1 (Identifikasi ekstensi fitur, deviasi desain, dan pemangkasan *scope*).
- **Status Operasional Codebase:**
  - Backend Suite: Python 3.12, FastAPI, SQLAlchemy 2.0, PostgreSQL 16 — **336 Passed, 0 Failed, 6 Skipped** (Exit Code 0).
  - Frontend Suite: React 18, TypeScript, Tailwind CSS, HeroUI, Vitest 3.2.7 — **33 Test Files Passed, 286 Tests Passed** (Exit Code 0).
  - Target Infrastruktur: Single VPS Ubuntu 24.04 LTS (Resource Budget: 1 vCPU, 2 GB RAM, SSD 10 GB, Docker Compose).

---

## 2. METODOLOGI & PARADIGMA AUDIT

### 2.1 Pendekatan Agnostik dan Check & Balance
Audit ini dilakukan secara *agnostik*, artinya auditor memposisikan dokumen proposal teknis (SIS1-CD1) dan *codebase* aktual pada level evaluasi yang setara tanpa asumsi apriori bahwa salah satu pihak mutlak benar.
- Dokumen proposal CD-1 dievaluasi dari sisi realisme rekayasa perangkat lunak, konsistensi internal bab per bab, serta kerentanan terhadap asumsi konvensional yang kerap gagal dalam aplikasi finansial.
- *Codebase* Rezekify dievaluasi dari sisi kesesuaian terhadap *core problem* yang didefinisikan pada Bab II proposal, kepatuhan kontrak data, ketahanan keamanan, dan efisiensi alokasi sumber daya komputasi.
- Prinsip *Check & Balance* memastikan bahwa setiap deviasi (baik penambahan fitur baru maupun pemangkasan fitur) diuji melalui kriteria nilai guna pengguna (*user value*), integritas matematika finansial, beban kognitif pengguna (*cognitive load*), serta kelayakan operasional pada infrastruktur hemat biaya (*zero-cost sustainability*).

### 2.2 Core Invariants Rezekify
Setiap penilaian dalam laporan ini didasarkan pada kepatuhan terhadap lima invariant fundamental platform:
1. **Deterministic Financial Math:** Seluruh mutasi uang, saldo berjalan, kalkulasi sisa kas bebas, dan jatah harian wajib dihitung secara deterministik menggunakan tipe data `decimal.Decimal` (presisi 2 angka desimal). Penggunaan tipe data *floating-point* dan kalkulasi matematika berbasis probabilitas LLM dilarang secara mutlak.
2. **Balanced Double-Entry Ledger:** Setiap perubahan posisi keuangan menghasilkan jurnal berpasangan seimbang ($\sum \text{Debit} = \sum \text{Credit}$). Perubahan data historis tidak diperkenankan menggunakan manipulasi saldo *in-place* serampangan, melainkan wajib melalui mekanisme *Reversal-and-Repost* atomik guna mengeliminasi risiko *balance drift*.
3. **Multi-Tenant Row-Level Isolation:** Seluruh akses kueri basis data wajib diisolasi secara ketat berdasarkan `user_id = current_user.id`. Kredensial kata sandi dienkripsi dengan *Bcrypt*, sedangkan API Key eksternal (BYOK) dienkripsi simetris menggunakan Fernet berstandar PBKDF2 HMAC-SHA256 (600.000 iterasi).
4. **Rotary Key Pool & Multi-Hop Resilience:** Sistem memanfaatkan orkestrasi *free-tier key pool* (Gemini 2.5 Flash) dengan rotasi otomatis dan mitigasi HTTP 429, serta mekanisme *fallback multi-hop* ke Groq (Whisper Large V3 + Llama) tanpa membebankan biaya API ke pengembang maupun pengguna ($0 token server cost).
5. **Zero-Bloat Scope & Single-Box Efficiency:** Sistem diprioritaskan berjalan pada lingkungan tunggal VPS 2 GB RAM tanpa dependensi SaaS berbayar atau infrastruktur terdistribusi yang tidak relevan (anti *premature scaling*).

---

## 3. AUDIT DOKUMEN CD-1 TERHADAP CODEBASE (VERIFIKASI REALISASI PROPOSAL)

### 3.1 Audit Kebutuhan Fungsional (Bab IV, Subbab 4.1)

| ID CD-1 | Deskripsi Kebutuhan CD-1 | Realisasi pada Codebase Rezekify | Status | Verifikasi Teknis & Lokasi File |
| :--- | :--- | :--- | :---: | :--- |
| **4.1.1.1** | Registrasi pengguna baru (nama, email, kata sandi terenkripsi). | Model `User` menyimpan email unik, nama lengkap, dan hash kata sandi Bcrypt. Validasi Pydantic EmailStr dan panjang karakter 8–72. | **SUDAH** | `rezekify/services/auth.py`; `rezekify/api/v1/auth_router.py:94` |
| **4.1.1.2** | Login JWT dengan Access Token jangka pendek dan HttpOnly Refresh Cookie jangka panjang. | Login menghasilkan JWT Access Token (30 menit) dan mengatur cookie `refresh_token` (HttpOnly, SameSite, Secure, 7 hari). Rotasi token tersedia via `/refresh`. | **SUDAH** | `rezekify/api/v1/auth_router.py:116`; `rezekify/core/security.py` |
| **4.1.1.3** | Fungsi logout untuk mengakhiri sesi dan menghapus cookie secara aman. | Endpoint `/logout` menghapus HttpOnly cookie `refresh_token` dan menginstruksikan pembersihan *state* klien. | **SUDAH** | `rezekify/api/v1/auth_router.py:175` |
| **4.1.1.4** | Pengelolaan profil pengguna (nama, siklus gajian, ambang runway aman). | Kolom `monthly_cycle_day`, `safe_runway_threshold` tersimpan di tabel `users`. Endpoint `GET/PUT /api/v1/settings/profile` mengelola pembacaan dan pembaruan profil. | **SUDAH** | `rezekify/db/models.py:84`; `rezekify/api/v1/settings_router.py:27` |
| **4.1.2.1** | Penambahan akun sumber dana (BANK, EWALLET, CASH, LIABILITY). | Enum `AccountType` mencakup 4 tipe tersebut. Form penambahan akun mendukung tipe tersebut dengan saldo awal deterministik. | **SUDAH** | `rezekify/db/models.py:48`; `rezekify/api/v1/accounts_router.py:38` |
| **4.1.2.2** | Penyimpanan nama akun, status keaktifan, dan saldo berjalan akurat. | Kolom `name`, `is_active`, `current_balance` (Numeric 15,2) diperbarui secara atomik melalui jurnal pembukuan. | **SUDAH** | `rezekify/db/models.py:114`; `rezekify/services/ledger.py` |
| **4.1.2.3** | Pengaitan transaksi dengan akun, pengubahan nama/status akun. | Setiap transaksi terikat ke minimal 1 akun via `LedgerEntry`. Endpoint update akun dan soft-delete/deaktivasi tersedia. | **SUDAH** | `rezekify/api/v1/accounts_router.py:72` |
| **4.1.2.4** | Tampilan riwayat serta penyaringan transaksi berdasarkan akun keuangan. | Parameter kueri `account_id` pada `/api/v1/transactions` memfilter transaksi melalui entri buku besar akun terkait. | **SUDAH** | `rezekify/api/v1/transactions_router.py:99` |
| **4.1.3.1** | Pencatatan transaksi pemasukan, pengeluaran, dan transfer antarakun. | Fungsi `record_expense`, `record_income`, dan `record_transfer` diimplementasikan dengan validasi kepemilikan tenant. | **SUDAH** | `rezekify/services/ledger.py:26,93,156` |
| **4.1.3.2** | Pembukuan berpasangan seimbang (Debit dan Kredit) untuk setiap mutasi. | Setiap transaksi membuat minimal dua objek `LedgerEntry` di mana $\sum \text{Debit} = \sum \text{Credit}$. Transfer mencatat kredit pada akun asal dan debit pada akun tujuan. | **SUDAH** | `rezekify/services/ledger.py:71,134,204` |
| **4.1.3.3** | Pengelolaan master kategori pengeluaran dan pemasukan. | Model `Category` dengan enum `CategoryType` (EXPENSE/INCOME), warna hex, dan ikon. CRUD kategori tersedia di API dan UI. | **SUDAH** | `rezekify/api/v1/categories_router.py`; `frontend/src/components/CategoryManagerModal.tsx` |
| **4.1.3.4** | Mekanisme *reversal-and-repost* untuk koreksi dan penghapusan transaksi. | Fungsi `delete_transaction` dan `update_transaction` membalik mutasi saldo lama sebelum memposting jurnal baru, mencegah *balance drift*. | **SUDAH** | `rezekify/services/ledger.py:226,253`; `rezekify/api/v1/transactions_router.py:157,185` |
| **4.1.4.1** | Input transaksi teks bahasa alami Indonesia informal. | `ReActAgent` dan `AgentOrchestrator` mengekstrak entitas nominal, akun, kategori dari frasa bahasa santai via Gemini/Groq. | **SUDAH** | `rezekify/agent/runtime.py`; `rezekify/api/v1/dashboard_router.py:263` |
| **4.1.4.2** | Ekstraksi foto struk belanja menggunakan Vision AI (OCR). | Endpoint `/api/v1/dashboard/ai-receipt` memproses gambar JPEG/PNG/WebP secara in-memory melalui Gemini 2.5 Flash Vision. | **SUDAH** | `rezekify/api/v1/dashboard_router.py:327` |
| **4.1.4.3** | Ekstraksi berkas rekaman suara (*voice note*). | Endpoint `/api/v1/dashboard/ai-voice` dan handler webhook Telegram memproses audio via 1-Hop Gemini Audio atau 2-Hop Groq Whisper. | **SUDAH** | `rezekify/api/v1/dashboard_router.py:416`; `rezekify/gateway/telegram_bot.py:141` |
| **4.1.4.4** | Review, koreksi, dan konfirmasi pengguna sebelum transaksi disimpan. | **Terdapat deviasi/kontradiksi internal dalam CD-1.** Codebase menerapkan *Direct Conversational Execution* dengan *instant retroactive undo/reversal* alih-alih konfirmasi bertahap modal form. | **DIUBAH** | Lihat pembahasan lengkap pada **Temuan Kritis 1**. |
| **4.1.5.1** | Visualisasi kas likuid, dana terkunci, dan kas operasional bebas di dashboard. | `RunwayService.calculate_runway` menghitung `total_liquid_cash`, `vault_locked_cash`, dan `operational_free_cash` secara deterministik. | **SUDAH** | `rezekify/services/runway.py:120`; `frontend/src/components/OverviewView.tsx` |
| **4.1.5.2** | Perhitungan *Daily Safe Runway* dan status (*Healthy*, *Warning*, *Critical*). | Formula $\text{Daily Safe} = \frac{\text{Free Cash}}{\text{Sisa Hari}}$ dihitung dengan pemangkasan siklus gajian dinamis dan evaluasi threshold. | **SUDAH** | `rezekify/services/runway.py:193` |
| **4.1.5.3** | Fitur simulasi pembelian impulsif (*Pre-Purchase What-If Simulation*). | Endpoint `/api/v1/dashboard/simulate-purchase` memproyeksikan penurunan runway harian sebelum belanja dieksekusi. | **SUDAH** | `rezekify/services/runway.py:273`; `frontend/src/components/SimulatePurchaseModal.tsx` |
| **4.1.6.1** | Pembuatan pos alokasi dana khusus (*Vault*) berupa tabungan/tagihan. | Model `Vault` mendukung `SAVINGS` dan `FIXED_BILL` dengan target nominal dan target tanggal jatuh tempo. | **SUDAH** | `rezekify/db/models.py:127`; `rezekify/api/v1/vaults_router.py` |
| **4.1.6.2** | Penguncian dana Vault (`is_locked`) yang memotong sisa kas bebas. | Properti `is_locked = True` mengisolasi `allocated_amount` dari kas operasional bebas pada kalkulasi runway. | **SUDAH** | `rezekify/services/runway.py:168` |
| **4.1.6.3** | Peringatan tagihan mendatang (*Upcoming Bills*) H-7. | Fungsi `get_upcoming_bills` memfilter `FIXED_BILL` yang belum terpenuhi dengan tanggal jatuh tempo antara $0 \le \text{hari} \le 7$. | **SUDAH** | `rezekify/services/runway.py:237`; `frontend/src/components/UpcomingBillsCard.tsx` |
| **4.1.7.1** | Kode pairing unik sementara (15 menit) untuk integrasi Telegram Bot. | Endpoint `/api/v1/auth/telegram/pairing-code` menghasilkan kode alfanumerik 6 karakter dengan masa aktif 15 menit. | **SUDAH** | `rezekify/services/auth.py:84`; `rezekify/api/v1/auth_router.py:186` |
| **4.1.7.2** | Penerimaan perintah teks, struk, suara via Telegram Bot dan balasan status runway. | Dispatcher `TelegramGateway` memproses teks, foto, voice note via webhook Telegram, memutasi ledger, dan membalas status runway. | **SUDAH** | `rezekify/gateway/telegram_bot.py`; `rezekify/api/v1/gateway_router.py` |
| **4.1.8.1** | Konfigurasi API Key AI pihak ketiga pengguna (BYOK: OpenAI, Anthropic, Gemini). | Model `UserSettings` mendukung protokol `OPENAI` dan `ANTHROPIC` serta Custom Base URL dan nama model kustom. | **SUDAH** | `rezekify/db/models.py:190`; `rezekify/schemas/settings.py` |
| **4.1.8.2** | Pengujian koneksi (*ping test*) untuk memverifikasi API Key BYOK. | Endpoint `/api/v1/settings/byok/ping` memvalidasi koneksi ke server penyedia pihak ketiga sebelum kunci disimpan. | **SUDAH** | `rezekify/api/v1/settings_router.py:121` |
| **4.1.8.3** | Enkripsi simetris Fernet PBKDF2 untuk penyimpanan API Key pengguna. | Modul `crypto.py` mengenkripsi API Key menggunakan Fernet dengan salt PBKDF2 SHA256 (600.000 iterasi). Jalur inferensi beralih ke kunci kustom. | **SUDAH** | `rezekify/core/crypto.py`; `rezekify/agent/orchestrator.py:38` |
| **4.1.9.1** | Laporan statistik distribusi pengeluaran berdasarkan kategori. | Endpoint `/api/v1/analytics/spending-breakdown?period=monthly` menyajikan persentase dan total belanja per kategori siklus aktif. | **SUDAH** | `rezekify/services/runway.py:348`; `frontend/src/components/ExpenseCharts.tsx` |
| **4.1.9.2** | Laporan perkembangan tren keuangan harian. | Endpoint `/api/v1/analytics/spending-breakdown?period=daily` menyajikan tren pengeluaran 7 hari terakhir vs threshold runway. | **SUDAH** | `rezekify/services/runway.py:302` |
| **4.1.9.3** | Histori transaksi rapi, catatan obrolan AI, dan metadata terstruktur. | Tabel `transactions`, `ledger_entries`, dan `chat_messages` (dengan kolom `metadata_json` dan FK `transaction_id`) menyimpan riwayat lengkap. | **SUDAH** | `rezekify/db/models.py:221`; `rezekify/api/v1/dashboard_router.py:212` |

---

### 3.2 Audit Kebutuhan Non-Fungsional (Bab IV, Subbab 4.2)

| ID CD-1 | Bidang NFR | Spesifikasi CD-1 | Realisasi Codebase & Hasil Uji | Kepatuhan |
| :--- | :--- | :--- | :--- | :---: |
| **4.2.1** | Usability & Kebutuhan Perangkat | Antarmuka responsif (smartphone & desktop), browser modern tanpa plugin tambahan, Telegram Bot. Informasi runway diakses langsung di halaman utama. RAM klien minimal 2 GB. | Halaman web berbasis React 18 SPA + Vite, desain ergonomis (HeroUI + Tailwind CSS), navigasi Sidebar desktop dan Bottom Dock mobile. Informasi runway tampil instan pada Hero Cockpit. | **100% PASS** |
| **4.2.2** | Server & Deployment Environment | Python 3.12 (FastAPI), React 18 (Nginx), PostgreSQL 16, Docker Compose dalam bridge network `rezekify_net`. Spek server VPS: 1 vCPU, RAM 1–2 GB, SSD 10 GB. Port 80/443 terbuka untuk API dan Webhook Telegram. | Konfigurasi `docker-compose.yml` terverifikasi. Multi-stage build Dockerfile untuk backend dan frontend Nginx. Bridge network privat aktif. Profil konsumsi RAM dioptimalkan untuk VPS 2 GB. | **100% PASS** |
| **4.2.3** | Performance & Integritas Data | Dilarang menggunakan *floating-point* untuk uang (wajib `Decimal(15,2)`). Indeks B-Tree pada kueri runway $< 10\text{ ms}$. In-memory TTL cache (15 detik) untuk runway. *Pessimistic Locking* (`SELECT FOR UPDATE`) pada mutasi saldo. | `Numeric(15,2)` di PostgreSQL dan `decimal.Decimal` di Python. Indeks komposit B-Tree pada `transactions`, `ledger_entries`, `vaults`. In-memory cache 15 detik dengan limit 5000 entri dan FIFO eviction. `with_for_update()` aktif pada `record_expense`, `record_income`, `record_transfer`, dan `update_transaction`. | **100% PASS** |
| **4.2.4** | Security & Privacy | Multi-tenant row-level isolation (`WHERE user_id = :uid`), hash password Bcrypt, enkripsi Fernet PBKDF2 (600.000 iterasi) untuk BYOK API Key, proteksi SSRF pada URL kustom, rate limiting sliding window, brute-force protection pairing Telegram ($< 5\text{ kali}$). | Isolasi `user_id` di setiap router. Verifikasi password via `pwd_context.verify`. Enkripsi Fernet SHA256 600k iterasi teruji di `test_crypto.py`. Validasi SSRF menolak IP privat (RFC 1918) dan loopback. Sliding-window `RateLimiter` O(1) pada rute sensitif. Brute-force pairing tracker membatasi 5 kegagalan per 15 menit. | **100% PASS** |
| **4.2.5** | Reliability & Fault Tolerance | AI failure tidak menghilangkan transaksi DB. Rotary Key Pool untuk rotasi API Key saat HTTP 429. Fallback multi-tingkat dari Gemini 2.5 Flash ke Groq (Whisper Large V3 / Llama). Form manual fallback jika seluruh AI mati. | Implementasi `RotaryKeyPool` dengan pelacakan cooldown per kunci. Multi-hop audio fallback (Gemini Native Audio -> Groq Whisper -> Groq Llama). Form transaksi manual konvensional (`ManualTransactionModal.tsx`) dapat digunakan kapan saja tanpa AI. | **100% PASS** |
| **4.2.6** | Maintainability & Compatibility | Arsitektur modular terpisah (Gateway, AI Engine, Ledger Core), dokumentasi teknis lengkap, migrasi basis data Alembic, antarmuka responsif tanpa plugin browser. | Struktur direktori bersih (`rezekify/gateway`, `rezekify/agent`, `rezekify/services`, `rezekify/api`). Migrasi Alembic versi 001 hingga 007 berjalan mulus. Pengujian otomatis 622 tes (Backend + Frontend) lulus 100%. | **100% PASS** |

---

### 3.3 Audit Karakteristik Produk (Bab VII: Tabel 7.2 s/d 7.5)

#### Tabel 7.2: Fitur Utama Rezekify
1. **Pencatatan Transaksi (Manual):** `SUDAH`. Modal input manual lengkap dengan pemilihan tipe transaksi (Pengeluaran, Pemasukan, Transfer Antarakun), nominal, akun, kategori, tanggal, dan catatan.
2. **Scan Struk Berbasis OCR/AI:** `SUDAH`. Ekstraksi gambar nota kasir otomatis via Gemini Vision OCR menghasilkan vendor, total nominal, dan kategori.
3. **Dashboard Keuangan Terintegrasi:** `SUDAH`. Ringkasan total kas likuid, alokasi brankas, kas operasional bebas, sisa hari siklus, jatah harian aman, pengeluaran hari ini, dan peringatan tagihan.
4. **Monitoring Pemasukan dan Pengeluaran:** `SUDAH`. Visualisasi tren belanja 7 hari dan komposisi pengeluaran siklus bulanan berdasarkan kategori.
5. **Manajemen Anggaran:** `DIUBAH / DIPRUNING`. *Traditional category envelope budgeting* dipangkas dan digantikan oleh *Dynamic Daily Safe Runway Threshold* (Rp 30.000/hari atau kustom) untuk mengeliminasi *tracking fatigue*.
6. **Monitoring Tabungan:** `SUDAH`. Diakomodasi melalui fitur *Commitment Vault* bertipe `SAVINGS`, mencatat target nominal, dana teralokasi, target tanggal, dan status kunci.
7. **Analisis Keuangan Berbasis AI:** `DIUBAH / DIPRUNING`. Analisis forecasting probabilistik berbasis LLM ditolak demi menjaga *zero AI hallucination*. Digantikan oleh *Deterministic Spending Telemetry* dan *Pre-Purchase What-If Simulation Engine*.
8. **Financial Insight:** `SUDAH`. Insight finansial disajikan melalui telemetri kesehatan keuangan harian (*Healthy*, *Warning*, *Critical*) dan saran belanja pada simulasi pembelian.
9. **Kustomisasi AI:** `EXCEEDED`. Pengguna tidak hanya dapat memilih model, tetapi dapat mengonfigurasi endpoint kustom multi-protokol (OpenAI-compatible & Anthropic Messages API) dengan enkripsi kunci simetris.

#### Tabel 7.3: Fitur Dasar Rezekify
Seluruh 10 fitur dasar yang tercantum pada Tabel 7.3 (Registrasi & Login, Profil, Sumber Dana, Riwayat Transaksi, Kategori, Filter Transaksi, Riwayat Anggaran, Status Tagihan, Laporan Keuangan, Keamanan Akun) telah **100% DIIMPLEMENTASIKAN**, dengan catatan bahwa riwayat anggaran terintegrasi ke dalam telemetri breakdown belanja harian dan tagihan terintegrasi ke dalam tabel brankas komitmen.

#### Tabel 7.4: Fitur Tambahan Rezekify
1. **Ekspor Laporan (CSV/PDF):** `BELUM` (Backlog). Endpoint analitik menyediakan data agregasi dalam format JSON, tetapi generator file CSV atau PDF belum diimplementasikan.
2. **Insight yang Lebih Personal:** `DIUBAH / DIPRUNING`. Personalisasi dilakukan berbasis aturan deterministik profil pengguna (siklus gajian dan batas threshold aman) tanpa melakukan *profiling behavioral* invasif.
3. **Notifikasi Pengingat yang Lebih Fleksibel:** `BELUM` (Backlog). Pengguna belum dapat mengatur jam pengingat harian personal secara mandiri.
4. **Notifikasi Tagihan (Push Cron):** `PARSIAL / BELUM DI-PUSH`. Logika identifikasi tagihan H-7 telah aktif dan tampil di Web serta respons Telegram, namun background cron/daemon proaktif untuk *push notification broadcast* otomatis belum dipasang.
5. **Integrasi Telegram:** `SUDAH`. Integrasi penuh dua arah via webhook, pairing OTP 15 menit, pesan teks, foto struk, dan rekaman suara.

#### Tabel 7.5: Prioritas Karakteristik Produk
Sesuai arahan prioritas Capstone pada Tabel 7.5 CD-1, tim pengembang Rezekify berhasil menyelesaikan **100% Fitur Utama dan Fitur Dasar** yang esensial bagi MVP, serta mengorbankan fitur tambahan yang bersifat *nice-to-have* (seperti ekspor PDF dan cron push fleksibel) demi menjaga stabilitas arsitektur, keamanan data, dan batas waktu rilis.

---

### 3.4 Audit Skenario Use Case (UC-01 s/d UC-10) dan Diagram BPMN Swimlane

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        VERIFIKASI USE CASE & BPMN (CD-1 BAB VIII)                      │
├───────┬───────────────────────────────────┬──────────────┬─────────────────────────────┤
│ UC ID │ Nama Skenario Use Case            │ Status Uji   │ Kesesuaian Alur BPMN        │
├───────┼───────────────────────────────────┼──────────────┼─────────────────────────────┤
│ UC-01 │ Registrasi dan Login Pengguna     │ ✅ TERPENUHI │ Sesuai alur normal & alt E1 │
│ UC-02 │ Catat Transaksi Teks (AI Chat)    │ ✅ TERPENUHI │ Sesuai alur normal & A1, E1 │
│ UC-03 │ Catat Transaksi Struk (Vision)    │ ✅ TERPENUHI │ Sesuai alur normal & alt E1 │
│ UC-04 │ Catat Transaksi Suara (Voice)     │ ✅ TERPENUHI │ Sesuai alur normal & A1, E1 │
│ UC-05 │ Cek Status & Simulasi Runway      │ ✅ TERPENUHI │ Sesuai formula matematika   │
│ UC-06 │ Kelola Akun & Kategori Keuangan   │ ✅ TERPENUHI │ Sesuai alur CRUD master     │
│ UC-07 │ Kelola Commitment Vault           │ ✅ TERPENUHI │ Sesuai penguncian kas bebas │
│ UC-08 │ Penautan Telegram (Pairing OTP)   │ ✅ TERPENUHI │ Sesuai pembatasan brute-5x  │
│ UC-09 │ Konfigurasi AI & Key (BYOK)       │ ✅ TERPENUHI │ Sesuai ping test & Fernet   │
│ UC-10 │ Kelola & Edit Riwayat Transaksi   │ ✅ TERPENUHI │ Sesuai Reversal-and-Repost  │
└───────┴───────────────────────────────────┴──────────────┴─────────────────────────────┘
```

1. **UC-01 (Registrasi & Login):** Implementasi memverifikasi format email, hashing password, penerbitan JWT Access Token, dan pengaturan cookie HttpOnly. Skenario alternatif kredensial salah menghasilkan HTTP 401/400.
2. **UC-02 (Catat Transaksi Teks AI):** Alur ekstraksi JSON `{action, amount, account}`, penentuan akun default bersaldo terbesar jika akun tidak disebutkan (Skenario A1), penguncian baris pessimistik, mutasi jurnal berpasangan, kalkulasi ulang runway, dan balasan konfirmasi berjalan persis sesuai spesifikasi BPMN Swimlane Lampiran CD-1.
3. **UC-03 (Catat Transaksi Struk Vision OCR):** Validasi header magic bytes (JPEG/PNG/WebP) dan limit ukuran 10 MB (Skenario E1) berjalan di tingkat gateway, dilanjutkan ekstraksi merchant/nominal/kategori oleh Gemini Vision dan pencatatan buku besar.
4. **UC-04 (Catat Transaksi Suara Voice Note):** Deduplikasi `update_id`, pengunduhan `.ogg` dari server Telegram, transkripsi simultan Gemini Audio dengan *fallback multi-hop* 2 tingkat ke Groq Whisper Large V3 + Groq Llama (Skenario A1) berfungsi penuh di `rezekify/gateway/telegram_bot.py`.
5. **UC-05 (Cek Status & Simulasi Runway):** Kueri cache runway 15 detik, penjumlahan kas likuid, pengurangan dana brankas terkunci, kalkulasi hari siklus, pembagian kas bebas per hari, dan evaluasi status lampu lalu lintas (*Healthy/Warning/Critical*) berjalan deterministik.
6. **UC-06 (Kelola Akun & Kategori):** Penambahan, pembaruan saldo awal, dan penonaktifan akun/kategori terisolasi per tenant.
7. **UC-07 (Kelola Commitment Vault):** Alokasi dana brankas dan toggle `is_locked` secara instan mengosongkan cache runway dan memotong kas bebas.
8. **UC-08 (Penautan Akun Telegram):** Generator kode pairing 6-karakter (15 menit), proteksi *brute-force* maksimal 5 kali kegagalan, dan penyimpanan chat ID unik berfungsi sesuai alur.
9. **UC-09 (Konfigurasi AI BYOK):** Pengguna dapat memasukkan endpoint kustom, sistem mengeksekusi *ping test*, melakukan enkripsi simetris Fernet, dan menyimpan ciphertext ke tabel `user_settings`.
10. **UC-10 (Kelola & Edit Riwayat Transaksi):** Alur pembatalan mutasi akun lama (Fase Reversal) dan pembuatan mutasi serta jurnal baru (Fase Repost) berjalan dalam satu transaksi basis data atomik.

---

## 4. AUDIT EXISTING CODEBASE TERHADAP DOKUMEN CD-1 (GAP & EXTENSION ANALYSIS)

Audit arah sebaliknya mengevaluasi fungsionalitas yang ada pada *codebase* aktual namun tidak tercantum dalam proposal CD-1, atau fitur di proposal yang sengaja diubah desainnya.

### 4.1 Fitur di Project yang Melampaui Dokumen CD-1 (Exceeded / Bonus Capabilities)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KAPABILITAS EXTENDED PADA CODEBASE                       │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ 1. Password Reset via OTP     │ Kode OTP 6-Digit via Email, SHA-256 Hash,   │
│    (Email OTP Security Flow)  │ Rate Limiter, 15m Expiry, Max 5 Attempts    │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 2. Native In-Browser Voice    │ Perekaman Suara Langsung di Web via         │
│    (MediaRecorder Recording)  │ MediaRecorder API (WebM/WAV) + Visualizer   │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 3. Persistent AI Copilot Hub  │ Tabel chat_messages, Riwayat Percakapan     │
│    (Two-Way Interactive Chat) │ Dua Arah, Kartu Mutasi Interaktif, Clear UI │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 4. Multi-Protocol BYOK Engine │ Dukungan Penuh OpenAI-Compatible Endpoint   │
│    (Advanced Custom AI Hub)   │ dan Anthropic Messages API + SSRF Sandbox   │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 5. Production VPS Hardening   │ DB Pool Tuning, Sliding Window Limiter O(1),│
│    (Ubuntu 24.04 RAM 2GB Opt) │ Eager Loading N+1, Thread-Safe TTL Sweeper  │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

1. **Pemulihan Kata Sandi Mandiri via Email OTP (Self-Service Password Reset):**
   - *Status Proposal CD-1:* Proposal hanya merancang registrasi dan login JWT sederhana pada subbab 4.1.1 dan UC-01 tanpa mekanisme pemulihan jika pengguna lupa kata sandi.
   - *Realisasi Codebase:* Diimplementasikan secara komprehensif pada Migrasi 007 (`rezekify/db/migrations/versions/007_add_password_reset_otp.py`), `rezekify/services/email.py`, dan router `/api/v1/auth/forgot-password` serta `/reset-password`. Menggunakan kode OTP 6-digit berbasis angka acak kriptografis (`secrets`), disimpan dalam bentuk hash SHA-256, masa berlaku 15 menit, pembatasan maksimal 5 kali percobaan salah, *rate limiting* ketat, dan integrasi pengiriman email asinkron (SMTP dengan fallback ke konsol pengembang).
2. **Perekaman Suara Asli di Peramban Web (Native In-Browser Voice Recording):**
   - *Status Proposal CD-1:* Proposal pada subbab 4.1.4 butir 3 dan UC-04 hanya merancang input suara secara eksklusif melalui Telegram Bot API.
   - *Realisasi Codebase:* *Codebase* melampaui batasan ini dengan menambahkan komponen perekam suara langsung pada antarmuka web SPA (`frontend/src/components/ChatOmniInput.tsx`) memanfaatkan HTML5 MediaRecorder API. Pengguna web dapat merekam suara, memantau visualisasi audio secara langsung, dan mengirimkan file WebM/WAV ke endpoint `/api/v1/dashboard/ai-voice` tanpa perlu membuka aplikasi Telegram.
3. **Hub AI Copilot Interaktif Persisten (Persistent AI Copilot Hub):**
   - *Status Proposal CD-1:* Bab 4.1.9 hanya menyebut penyimpanan riwayat obrolan untuk audit pengguna, tanpa desain antarmuka interaktif dua arah.
   - *Realisasi Codebase:* Disediakan model basis data `ChatMessage` lengkap (Migrasi 006) yang menampung relasi percakapan pengguna dan asisten AI, tautan foreign key ke `Transaction`, serta payload `metadata_json`. Frontend menyediakan tampilan Copilot terdedikasi (`AIChatView.tsx`) dengan rendering kartu mutasi interaktif (`ChatTransactionCard.tsx`), ringkasan telemetri dinamis (`ChatTelemetryStrip.tsx`), dan fungsi pembersihan riwayat obrolan (`DELETE /ai-chat/messages`) yang aman tanpa menghapus transaksi buku besar riil.
4. **Mesin BYOK Multi-Protokol dengan Isolasi SSRF:**
   - *Status Proposal CD-1:* Subbab 4.1.8 hanya menyebut konfigurasi API Key penyedia eksternal secara umum.
   - *Realisasi Codebase:* Mengimplementasikan adaptor terpisah untuk protokol `OPENAI` (`OpenAICompatibleAdapter`) dan `ANTHROPIC` (`AnthropicCompatibleAdapter`), parser URL kustom, serta validasi ketat terhadap serangan *Server-Side Request Forgery* (SSRF) yang memblokir akses ke alamat IP privat lokal (RFC 1918) dan loopback.
5. **Pengerasan Performa VPS 2 GB (Production Hardening):**
   - *Status Proposal CD-1:* NFR 4.2.2 dan 4.2.3 mencantumkan kebutuhan server standar.
   - *Realisasi Codebase:* Dilakukan pengerasan ekstrem mencakup *connection pool tuning* SQLAlchemy (`pool_size=3`, `max_overflow=2`, `pool_recycle=1800`), algoritma rate limiter sliding window amortized O(1), eliminasi N+1 kueri melalui `selectinload`/`joinedload`, serta pembersihan cache in-memory yang *thread-safe* menggunakan *dictionary snapshotting*.

---

### 4.2 Fitur di Dokumen CD-1 yang Belum Ada di Codebase (Backlog Analysis)

1. **Ekspor Laporan Keuangan CSV/PDF (Tabel 7.4 No. 1):**
   - *Status:* **BELUM DIIMPLEMENTASIKAN (Backlog).**
   - *Analisis:* API saat ini telah menyediakan endpoint data analitik lengkap (`/api/v1/analytics/spending-breakdown` untuk harian dan bulanan), namun belum ada fungsi backend atau komponen frontend untuk mengonversi data tersebut ke dalam file unduhan `.csv` atau `.pdf`.
   - *Urgensi:* Rendah (Sesuai Tabel 7.5 CD-1, fitur ini diklasifikasikan sebagai Fitur Tambahan / *nice-to-have*).
2. **Notifikasi Pengingat & Tagihan Terjadwal / Cron Daemon (Tabel 7.4 No. 3 & 4):**
   - *Status:* **BELUM DIIMPLEMENTASIKAN (Backlog).**
   - *Analisis:* Sistem telah memiliki logika bisnis untuk mendeteksi tagihan H-7 (`get_upcoming_bills`), namun pengiriman notifikasi proaktif (*push notification*) yang dijadwalkan secara berkala (misalnya pesan broadcast Telegram setiap jam 08:00 pagi) membutuhkan *worker process* latar belakang terpisah (seperti Celery/Arq atau cron runner).
   - *Urgensi:* Rendah hingga Sedang (Dapat ditambahkan pada siklus pengembangan berikutnya tanpa mengganggu stabilitas inti).

---

### 4.3 Fitur di Dokumen CD-1 yang Sengaja Didesain Ulang (Pruning / By Design)

1. **Pemangkasan Anggaran Kategori Tradisional (*Traditional Envelope Budgeting*):**
   - *Status Dokumen CD-1:* Tabel 7.2 No. 5 menyebutkan: *"Manajemen Anggaran: Memungkinkan pengguna menetapkan anggaran berdasarkan kategori dan periode tertentu serta memantau penggunaan dan sisa anggaran."*
   - *Keputusan Rekayasa Codebase:* **DIUBAH SECARA SADAR (By Design).**
   - *Justifikasi Arsitektural:* Pendekatan budgeting amplop per kategori (misal: membatasi makan Rp 500.000, hiburan Rp 200.000) adalah akar utama fenomena *Tracking Fatigue* yang disebutkan pada Bab II Latar Belakang Masalah CD-1. Individu muda enggan dan gagal memelihara batasan kategori yang kaku. Rezekify menggantinya dengan paradigma yang jauh lebih tangguh:
     - Mengisolasi dana komitmen wajib (tagihan, kos, UKT, tabungan) ke dalam *Commitment Vault* yang terkunci (`is_locked = True`).
     - Membiarkan seluruh sisa uang menjadi *Operational Free Cash*.
     - Membagi kas bebas tersebut dengan sisa hari siklus gajian menjadi satu metrik tunggal: **Dynamic Daily Safe Runway**.
     - Evaluasi batas belanja dilakukan secara harian terhadap ambang batas aman (`safe_runway_threshold`, default Rp 30.000/hari). Apabila pengeluaran hari ini melebihi ambang batas, sistem menandainya sebagai `is_over_budget = True` pada laporan analitik.

---

## 5. TEMUAN KRITIS & INKONSISTENSI INTERNAL

Audit ini mengidentifikasi empat temuan kritis yang mencerminkan ketidaksesuaian internal dalam naskah CD-1 maupun antara naskah CD-1 dengan arsitektur teknis yang telah dibangun.

---

### 5.1 Temuan Kritis 1: Kontradiksi Internal Alur AI di Dokumen CD-1
*(Bab III Gambar 3.2 & Bab IV 4.1.4 butir 4 vs Bab VIII UC-02/03/04 & Lampiran BPMN Swimlane)*

- **Deskripsi Masalah:**
  Terdapat pertentangan fundamental di dalam naskah proposal CD-1 mengenai cara AI berinteraksi dengan pengguna:
  - *Versi Bab III (Gambar 3.2) dan Bab IV (Subbab 4.1.4 Butir 4):* Dokumen menyatakan prinsip alur kerja:
    $$\text{[ AI Processing ]} \rightarrow \text{[ User Review ]} \rightarrow \text{[ Correction ]} \rightarrow \text{[ Confirmation ]} \rightarrow \text{[ View / Storage ]}$$
    Alur ini mengimplikasikan interaksi bergaya *form-filling*: setelah pengguna mengirim chat atau foto struk, sistem tidak langsung mencatat transaksi, melainkan menampilkan formulir draf (*draft preview*), meminta pengguna memeriksa, memperbaiki jika salah, dan menekan tombol konfirmasi sebelum data disimpan ke database.
  - *Versi Bab VIII (UC-02, UC-03, UC-04) dan Diagram BPMN Swimlane Lampiran:* Dokumen merancang alur **Direct Execution**:
    $$\text{User Input (Teks / Foto / Suara)} \rightarrow \text{AI Entity Extraction (JSON)} \rightarrow \text{System Validation \& Lock} \rightarrow \text{Direct Ledger Mutation} \rightarrow \text{Instant Confirmation \& Runway Report}$$
    Pada skenario ini, AI langsung mengeksekusi mutasi buku besar jika entitas valid, dan melaporkan hasilnya kepada pengguna. Koreksi kesalahan dilakukan secara retroaktif melalui **UC-10 (Kelola & Edit Riwayat Transaksi)** menggunakan mekanisme *Reversal-and-Repost*.
- **Evaluasi Realisasi Codebase:**
  *Codebase* Rezekify mengadopsi alur **Direct Conversational Execution dengan Reversal-and-Repost** (sebagaimana dirancang pada Bab VIII dan BPMN). Pendekatan ini secara drastis mengeliminasi friksi pencatatan (*zero-friction ingestion*), mencegah *dialog fatigue*, dan memungkinkan pengguna mencatat pengeluaran dalam hitungan 1 detik via chat atau Telegram. Jika terjadi kesalahan ekstraksi (misalnya salah nominal atau salah akun), pengguna dapat mengedit transaksi kapan saja via tabel riwayat transaksi, di mana `LedgerService.update_transaction` secara atomik membalik saldo lama dan mencatat jurnal baru.
- **Rekomendasi Tindakan:** Dokumen CD-2 / Final wajib merevisi Gambar 3.2 pada Bab III dan butir 4.1.4.4 pada Bab IV untuk menyelaraskannya dengan Bab VIII dan BPMN.

---

### 5.2 Temuan Kritis 2: Redefinisi "Manajemen Anggaran" vs "Deterministic Safe Runway"
*(Tabel 7.2 No. 5 vs Subbab 4.1.5 & Codebase)*

- **Deskripsi Masalah:**
  Naskah CD-1 pada Tabel 7.2 butir 5 menggunakan terminologi perbankan konvensional: *"Manajemen Anggaran: Memungkinkan pengguna menetapkan anggaran berdasarkan kategori dan periode tertentu serta memantau penggunaan dan sisa anggaran."* Namun, pada Bab IV subbab 4.1.5, dokumen berargumen bahwa model anggaran konvensional memicu ilusi dan kelelahan mental, lalu memperkenalkan *Deterministic Safe Runway*.
- **Evaluasi Realisasi Codebase:**
  Di dalam *codebase*, tidak ditemukan tabel `category_budgets` dengan kuota nominal kaku. Sebaliknya, anggaran dikelola secara holistik:
  1. Dana komitmen wajib dipagari di tabel `vaults` (`is_locked = True`).
  2. Jatah belanja harian dihitung dinamis:
     $$\text{Daily Safe Runway} = \frac{\text{Total Kas Likuid} - \text{Kas Terkunci Brankas}}{\text{Sisa Hari Menuju Gajian}}$$
  3. Ambang batas runway aman dikonfigurasi per pengguna di kolom `users.safe_runway_threshold` (default Rp 30.000).
  4. Endpoint `/api/v1/analytics/spending-breakdown?period=daily` membandingkan pengeluaran riil harian terhadap threshold ini (`is_over_budget: amount > threshold`).
- **Rekomendasi Tindakan:** Terminologi "Manajemen Anggaran Kategori" pada Bab VII proposal harus direvisi menjadi "Manajemen Batas Belanja Harian & Brankas Komitmen (*Daily Safe Runway & Vault Allocation*)".

---

### 5.3 Temuan Kritis 3: Redefinisi "Analisis Keuangan Berbasis AI & Forecasting" vs "Deterministic What-If Simulation Engine"
*(Tabel 7.2 No. 7 & 8 vs Invariant Anti-Hallucination & Codebase)*

- **Deskripsi Masalah:**
  Tabel 7.2 No. 7 proposal CD-1 menjanjikan: *"Analisis Keuangan Berbasis AI: Menganalisis data keuangan historis untuk menemukan pola pemasukan dan pengeluaran serta memberikan prediksi mengenai kondisi keuangan pada periode mendatang."*
  Dalam konteks rekayasa AI, "prediksi keuangan berbasis model bahasa (LLM)" sangat berbahaya karena LLM memiliki sifat stokastik probabilistik yang rentan memunculkan halusinasi angka (*probabilistic mathematical hallucination*). Mengandalkan LLM untuk meramal saldo masa depan bertentangan langsung dengan Invariant 1 Rezekify.
- **Evaluasi Realisasi Codebase:**
  *Codebase* secara tegas melarang LLM melakukan kalkulasi angka. Analisis dan proyeksi keuangan dipecah menjadi dua pilar deterministik murni:
  1. **Telemetry & Pattern Analytics:** Agregasi riil berbasis SQL (`func.sum`, `joinedload`) yang menyajikan tren pengeluaran 7 hari dan distribusi persentase kategori tanpa keterlibatan LLM.
  2. **Pre-Purchase What-If Simulation Engine:** Mesin simulasi berbasis aturan (`RunwayService.simulate_purchase`) yang menghitung dampak pengeluaran sebelum transaksi dilakukan:
     $$\text{Projected Runway} = \frac{\max(0, \text{Free Cash} - \text{Planned Amount})}{\text{Days Remaining}}$$
     $$\text{Daily Drop} = \text{Current Runway} - \text{Projected Runway}$$
- **Rekomendasi Tindakan:** Dokumen CD-2 / Final harus meluruskan klaim "Prediksi AI" menjadi "Simulasi Dampak Pengeluaran Deterministik (*Deterministic What-If Simulation Engine*) dan Analisis Tren Keuangan".

---

### 5.4 Temuan Kritis 4: Ephemeral In-Memory Receipt vs Kolom DB `receipt_image_url`
*(Skema Basis Data Model vs Alur Pemrosesan Multimodal)*

- **Deskripsi Masalah:**
  Pada model basis data `Transaction` (`rezekify/db/models.py:162`) dan skema Alembic 001, terdapat kolom:
  `receipt_image_url = Column(String(512), nullable=True)`
  Kolom ini mencerminkan asumsi awal bahwa setiap gambar struk yang diunggah akan disimpan secara permanen di media penyimpanan berkas (disk lokal atau cloud storage seperti AWS S3 / MinIO) dan URL-nya ditautkan pada transaksi.
- **Evaluasi Realisasi Codebase:**
  Pada implementasi aktual endpoint `/api/v1/dashboard/ai-receipt` (`rezekify/api/v1/dashboard_router.py:342`), berkas struk dibaca langsung ke dalam memori perantara (`await file.read()`), divalidasi *magic bytes header*, lalu dikirimkan langsung sebagai buffer biner (`image_bytes`) ke API Gemini 2.5 Flash Vision OCR. Berkas gambar tersebut **tidak pernah disimpan ke disk fisik server** dan tidak ada dependensi ke object storage eksternal. Akibatnya, pada transaksi yang dicatat via AI receipt, kolom `receipt_image_url` tetap bernilai `NULL`.
- **Justifikasi Arsitektural:**
  Keputusan ini sepenuhnya logis dan sejalan dengan prinsip *Zero-Bloat Scope* dan anggaran infrastruktur VPS 2 GB (SSD 10 GB). Menyimpan ribuan foto struk pengguna beresolusi tinggi akan menghabiskan ruang disk server dalam hitungan minggu serta memicu risiko kebocoran data privasi struk kasir (*data privacy liability*).
- **Rekomendasi Tindakan:**
  Dokumen teknis harus mendokumentasikan secara eksplisit bahwa Rezekify menerapkan arsitektur *Ephemeral In-Memory OCR Pipeline* demi efisiensi storage dan perlindungan privasi pengguna. Kolom `receipt_image_url` dipertahankan sebagai cadangan jika di masa depan pengguna ingin menautkan URL eksternal secara opsional.

---

## 6. MATRIKS CHECK & BALANCE 360 DERAJAT

Matriks berikut memetakan seluruh modul, kebutuhan, dan fitur secara menyeluruh antara Dokumen Proposal CD-1 dan Realisasi Codebase Rezekify:

```
Status Keterangan:
- SUDAH (Verified)    : Telah diimplementasikan penuh dan terverifikasi oleh rangkaian tes otomatis.
- BELUM (Backlog)     : Tercantum di proposal namun belum diimplementasikan di codebase.
- EXCEEDED (Bonus)    : Diimplementasikan di codebase melampaui cakupan proposal teknis.
- DIUBAH (By Design)  : Didesain ulang atau dipruning secara sadar demi keunggulan arsitektur dan anti-fatigue.
```

| Modul / Komponen | Sumber Dokumen CD-1 | Ekspektasi Proposal CD-1 | Realisasi Codebase Rezekify | Status | File / Endpoint Referensi |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Registrasi Pengguna** | 4.1.1.1, UC-01 | Register email, password, nama | Validasi Pydantic, Bcrypt hash, pembuatan user | **SUDAH** | `rezekify/api/v1/auth_router.py`; `rezekify/services/auth.py` |
| **Login & Sesi JWT** | 4.1.1.2, UC-01 | JWT access token + HttpOnly cookie | Access token (30m) + HttpOnly cookie (7 hari) | **SUDAH** | `rezekify/core/security.py`; `rezekify/api/v1/auth_router.py` |
| **Logout Sesi** | 4.1.1.3 | Menghapus token & sesi aman | Penghapusan HttpOnly cookie via `/logout` | **SUDAH** | `rezekify/api/v1/auth_router.py:175` |
| **Password Reset OTP** | *(Tidak ada di CD-1)* | *(Tidak tercakup di proposal)* | OTP 6-Digit Email, SHA-256 hash, 15m expiry, 5x limit | **EXCEEDED** | `rezekify/services/email.py`; `rezekify/db/migrations/...007` |
| **Profil & Siklus** | 4.1.1.4, UC-05 | Siklus gajian & runway threshold | `monthly_cycle_day`, `safe_runway_threshold` | **SUDAH** | `rezekify/api/v1/settings_router.py`; `rezekify/db/models.py:93` |
| **Akun Multi-Sumber** | 4.1.2.1, UC-06 | BANK, EWALLET, CASH, LIABILITY | Enum `AccountType`, CRUD akun keuangan | **SUDAH** | `rezekify/api/v1/accounts_router.py`; `rezekify/db/models.py:48` |
| **Saldo Akurat & Lock** | 4.1.2.2, 4.2.3 | Presisi desimal, pessimistic lock | Numeric(15,2), `with_for_update()` lock | **SUDAH** | `rezekify/services/ledger.py`; `rezekify/db/models.py:120` |
| **Pencatatan Transaksi** | 4.1.3.1, UC-02 | Pengeluaran, pemasukan, transfer | `record_expense`, `record_income`, `record_transfer` | **SUDAH** | `rezekify/services/ledger.py` |
| **Buku Berpasangan** | 4.1.3.2 | Jurnal seimbang Debit = Kredit | Minimal 2 `LedgerEntry` seimbang per transaksi | **SUDAH** | `rezekify/services/ledger.py` |
| **Master Kategori** | 4.1.3.3, UC-06 | Kategori transaksi & tipe | Model `Category` (EXPENSE/INCOME), warna, ikon | **SUDAH** | `rezekify/api/v1/categories_router.py` |
| **Reversal & Repost** | 4.1.3.4, UC-10 | Edit/hapus transaksi via reversal | Reversal mutasi lama sebelum repost mutasi baru | **SUDAH** | `rezekify/services/ledger.py:226,253` |
| **Input Bahasa Alami** | 4.1.4.1, UC-02 | Chat teks bahasa Indonesia informal | `ReActAgent` ekstraksi entitas JSON via Gemini/Groq | **SUDAH** | `rezekify/agent/runtime.py`; `rezekify/api/v1/dashboard_router.py` |
| **Vision OCR Struk** | 4.1.4.2, UC-03 | Ekstraksi gambar struk kasir | Gemini 2.5 Flash Vision in-memory buffer | **SUDAH** | `rezekify/api/v1/dashboard_router.py:327` |
| **In-Memory Buffer Struk** | *(Implisit S3/URL)* | Menyimpan gambar struk (URL) | Buffer memori volatil tanpa storage disk/S3 ($0 cost) | **DIUBAH** | `rezekify/api/v1/dashboard_router.py:342` |
| **Voice Note Telegram** | 4.1.4.3, UC-04 | Rekaman suara Telegram Bot | Webhook Telegram, Gemini Audio / Groq Whisper | **SUDAH** | `rezekify/gateway/telegram_bot.py:141` |
| **Native Web Voice** | *(Tidak ada di CD-1)* | Rekaman suara via Web browser | MediaRecorder API di browser langsung ke API voice | **EXCEEDED** | `frontend/src/components/ChatOmniInput.tsx` |
| **Alur Konfirmasi AI** | 4.1.4.4, Gbr 3.2 | Modal review -> koreksi -> simpan | Direct conversational execution + instant undo | **DIUBAH** | `rezekify/agent/orchestrator.py:149` |
| **Persistent Copilot Hub** | 4.1.9.3 | Catatan obrolan untuk audit | Tabel `chat_messages`, kartu mutasi interaktif, clear chat | **EXCEEDED** | `rezekify/schemas/chat.py`; `frontend/src/components/AIChatView.tsx` |
| **Dashboard Runway** | 4.1.5.1, UC-05 | Kas likuid, terkunci, kas bebas | `RunwayService.calculate_runway` deterministik | **SUDAH** | `rezekify/services/runway.py`; `frontend/src/components/OverviewView.tsx` |
| **Daily Safe Runway** | 4.1.5.2, UC-05 | Jatah harian & status kesehatan | Free cash / sisa hari, status Healthy/Warning/Critical | **SUDAH** | `rezekify/services/runway.py:193` |
| **Simulasi Belanja** | 4.1.5.3, UC-05 | Simulasi belanja sebelum beli | What-If simulation engine (`simulate_purchase`) | **SUDAH** | `rezekify/services/runway.py:273`; `frontend/src/components/SimulatePurchaseModal.tsx` |
| **Commitment Vault** | 4.1.6.1, UC-07 | Pos tabungan & tagihan tetap | Model `Vault` (SAVINGS / FIXED_BILL) | **SUDAH** | `rezekify/api/v1/vaults_router.py` |
| **Penguncian Kas Bebas** | 4.1.6.2, UC-07 | Brankas terkunci kurangi runway | `is_locked = True` memotong kas bebas otomatis | **SUDAH** | `rezekify/services/runway.py:173` |
| **Peringatan Tagihan H-7**| 4.1.6.3, UC-07 | Upcoming bills H-7 | Filter jatuh tempo $0 \le \text{hari} \le 7$ | **SUDAH** | `rezekify/services/runway.py:237`; `frontend/src/components/UpcomingBillsCard.tsx` |
| **Pairing Telegram OTP** | 4.1.7.1, UC-08 | Kode pairing 6-karakter (15 menit) | Kode acak unik, kedaluwarsa 15m, limit brute-force | **SUDAH** | `rezekify/services/auth.py:84`; `rezekify/gateway/telegram_bot.py:47` |
| **Telegram Bot Ingestion**| 4.1.7.2, UC-08 | Text, struk, voice via Telegram | Webhook dispatcher lengkap dengan balasan runway | **SUDAH** | `rezekify/gateway/telegram_bot.py` |
| **BYOK Multi-Protokol** | 4.1.8.1, UC-09 | API Key pihak ketiga kustom | Dukungan OpenAI-Compatible & Anthropic API | **EXCEEDED** | `rezekify/agent/providers/`; `rezekify/api/v1/settings_router.py` |
| **BYOK Ping Test** | 4.1.8.2, UC-09 | Uji koneksi sebelum disimpan | Endpoint `/api/v1/settings/byok/ping` | **SUDAH** | `rezekify/api/v1/settings_router.py:121` |
| **BYOK Fernet PBKDF2** | 4.1.8.3, 4.2.4 | Enkripsi API Key di basis data | Fernet PBKDF2 HMAC-SHA256 (600.000 iterasi) | **SUDAH** | `rezekify/core/crypto.py` |
| **Proteksi SSRF BYOK** | 4.2.4 | Blokir akses IP lokal/privat | Validasi blokir RFC 1918 dan loopback pada Base URL | **SUDAH** | `rezekify/api/v1/settings_router.py:133` |
| **Rotary Key Pool** | 4.2.5 | Rotasi kunci API otomatis saat 429 | `RotaryKeyPool` dengan pelacakan cooldown aktif | **SUDAH** | `rezekify/agent/key_pool.py` |
| **Fallback 2-Hop Audio** | 4.2.5, UC-04 | Gemini error fallback ke Groq | Gemini Audio -> Groq Whisper -> Groq Llama | **SUDAH** | `rezekify/agent/runtime.py`; `rezekify/gateway/telegram_bot.py` |
| **Grafik Pengeluaran** | 4.1.9.1, 7.2 | Distribusi kategori & tren harian | Agregasi bulanan (kategori) & harian (7 hari) | **SUDAH** | `rezekify/api/v1/dashboard_router.py:530`; `frontend/src/components/ExpenseCharts.tsx` |
| **Traditional Budgeting**| 7.2 No. 5 | Penetapan kuota anggaran per kategori| Digantikan oleh Safe Runway Threshold & Vaults | **DIUBAH** | `rezekify/services/runway.py` |
| **Forecasting AI Prob.** | 7.2 No. 7 | Peramalan kondisi keuangan via LLM | Digantikan oleh What-If Simulation deterministik | **DIUBAH** | `rezekify/services/runway.py:273` |
| **Ekspor Laporan File** | 7.4 No. 1 | Ekspor laporan format CSV / PDF | Belum ada generator berkas unduhan | **BELUM** | *(Backlog)* |
| **Push Notifikasi Cron** | 7.4 No. 3 & 4 | Pengingat & tagihan proaktif berkala| Logika deteksi aktif, daemon background belum ada | **BELUM** | *(Backlog)* |

---

## 7. KESIMPULAN & PANDUAN TINDAKAN (ACTIONABLE DECISION MATRIX)

Berdasarkan hasil audit komprehensif dua arah antara Dokumen Proposal SIS1-CD1 dan *codebase* Rezekify, dirumuskan panduan tindakan strategis sebagai acuan penyusunan dokumen Capstone Design 2 (CD-2) dan finalisasi produk:

### 7.1 MANA YANG SUDAH DIIMPLEMENTASIKAN (Pertahankan)
Seluruh fondasi sistem yang telah terbukti lulus 100% pada pengujian otomatis (622 tes) wajib dipertahankan tanpa perubahan arsitektural mayor:
1. **Deterministic Double-Entry Ledger Core:** Mekanisme pembukuan berpasangan berbasis `decimal.Decimal` dan mutasi atomik saldo.
2. **Dynamic Daily Safe Runway & Commitment Vaults:** Logika isolasi kas komitmen dan formula jatah belanja aman harian.
3. **Multimodal Ingestion Pipeline:** Kemampuan ekstraksi entitas keuangan dari pesan teks informal, foto struk belanja (Vision OCR), dan pesan suara.
4. **Integrasi Telegram Gateway:** Webhook bot yang andal dengan autentikasi kode pairing 15 menit dan mitigasi *brute-force*.
5. **BYOK Multi-Protokol Terenkripsi:** Dukungan fleksibel untuk model OpenAI-compatible dan Anthropic dengan enkripsi simetris Fernet PBKDF2.
6. **Ekstensi Unggulan (Exceeded):** Alur pemulihan kata sandi via Email OTP dan perekam suara langsung pada peramban web (*Native In-Browser Voice Recording*).

### 7.2 MANA YANG BELUM DIIMPLEMENTASIKAN (Pilihan Keputusan)
Terhadap dua fitur proposal CD-1 yang belum ada pada *codebase*, tim pengembang menetapkan keputusan berikut:
1. **Ekspor Laporan Keuangan CSV/PDF (Tabel 7.4 No. 1 CD-1):**
   - *Pilihan Keputusan:* **TERIMA UNTUK CSV, TOLAK UNTUK PDF.**
   - *Rasional:* Membuat endpoint pengunduhan CSV (`/api/v1/analytics/export/csv`) hanya membutuhkan serialisasi data tabular standar Python (`csv` stdlib) tanpa dependensi eksternal tambahan (~20 baris kode). Sebaliknya, generator PDF (seperti ReportLab/WeasyPrint) membutuhkan dependensi berat, konsumsi memori tinggi, dan merusak invariant efisiensi VPS 2 GB.
2. **Push Notification Terjadwal / Cron Daemon (Tabel 7.4 No. 3 & 4 CD-1):**
   - *Pilihan Keputusan:* **TOLAK / TIDAK PERLU DIIMPLEMENTASIKAN DI CAPSTONE (YAGNI).**
   - *Rasional:* Memasang background cron daemon/worker scheduler (Celery/Redis) pada VPS 2 GB hanya untuk mengirim pesan berkala melanggar asas *Zero-Bloat Scope*. Pengguna Rezekify dapat melihat tagihan H-7 secara instan kapan saja melalui dashboard web atau dengan mengetik perintah cepat `/runway` di Telegram.

### 7.3 MANA YANG PERLU DIHAPUS / DITOLAK (YAGNI & Anti-Bloat)
Fitur-fitur berikut yang sempat diwacanakan pada proposal konvensional wajib **ditolak secara permanen**:
1. **Traditional Category Envelope Budgeting:** Ditolak karena terbukti meningkatkan *tracking fatigue* dan menyebabkan kegagalan adopsi pengguna.
2. **Probabilistic LLM Financial Forecasting:** Ditolak secara mutlak untuk mencegah halusinasi matematika uang riil pengguna.
3. **Penyimpanan Berkas Gambar Struk Fisik (Persistent Image Storage):** Ditolak untuk mencegah pemborosan ruang penyimpanan disk server dan mengeliminasi risiko kebocoran privasi struk.
4. **Multi-Currency Complex Engine:** Rezekify difokuskan 100% pada mata uang Rupiah (IDR) untuk mahasiswa dan pekerja muda Indonesia.

### 7.4 MANA YANG PERLU DIREVISI PADA DOKUMEN (Sinkronisasi CD-2 / Final)
Agar naskah akademik (CD-2 dan Laporan Tugas Akhir) selaras secara sempurna dengan realitas rekayasa perangkat lunak yang telah dibangun, bagian-bagian berikut dalam proposal CD-1 wajib direvisi:
1. **Revisi Bab III (Gambar 3.2) dan Bab IV (Butir 4.1.4.4):** Ubah diagram alur AI dari model formulir konvensional (*Review -> Correction -> Confirmation*) menjadi model *Direct Conversational Execution with Retroactive Reversal-and-Repost*, selaras dengan Bab VIII dan BPMN Swimlane.
2. **Revisi Bab VII (Tabel 7.2 No. 5):** Ubah nama fitur "Manajemen Anggaran" menjadi "Manajemen Batas Belanja Harian & Brankas Komitmen (*Dynamic Safe Runway & Commitment Vaults*)".
3. **Revisi Bab VII (Tabel 7.2 No. 7):** Ubah "Analisis Keuangan Berbasis AI dan Prediksi" menjadi "Simulasi Dampak Pengeluaran Deterministik (*What-If Simulation Engine*) dan Analisis Tren Belanja".
4. **Penambahan Fitur Ekstensi pada Bab IV & VII:** Cantumkan secara resmi fitur **Password Reset via Email OTP** dan **Native In-Browser Voice Recording** sebagai kapabilitas unggulan platform.
5. **Dokumentasikan Invariant Arsitektur:** Cantumkan *Five Core Invariants Rezekify* sebagai batasan desain resmi sistem pada Bab IV NFR.

---

**Laporan audit ini disusun secara independen, faktual, dan dapat diverifikasi langsung melalui repositori kode Rezekify.**
*Status Verifikasi Akhir: PASSED (Zero Critical Regression).*
