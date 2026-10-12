# Spesiﬁkasi Desain: Ekspor CSV & Sistem Notifikasi Tagihan (In-App & Telegram)

- **Fitur**: Ekspor CSV Transaksi, Notifikasi Web In-App (Bell & Popover), dan Engine Notifikasi Telegram (On-Demand & Lifespan Scheduler)
- **Dokumen Referensi**: Dokumen Proposal SIS1-CD1 & Laporan Audit Check & Balance (13 Oktober 2026)
- **Penulis**: Thinker & Systems Architect Tier
- **Tanggal**: 13 Oktober 2026
- **Status**: Siap Diimplementasikan (*Approved for Implementation*)

---

## 1. Executive Summary & Problem Context

### 1.1 Latar Belakang & Identifikasi Gap Audit CD-1
Berdasarkan Laporan Audit Check & Balance Agnostik terhadap Dokumen Proposal Capstone SIS1-CD1 (`docs/audit/AUDIT_CD1_VS_PROJECT_2026-10-13.md`), platform Rezekify telah berhasil mengimplementasikan 100% Fitur Utama dan Fitur Dasar. Namun, audit mengidentifikasi dua gap fungsional dari kategori Fitur Tambahan (Tabel 7.4 Dokumen CD-1) yang bernilai tinggi bagi pengguna:
1. **Ekspor Laporan Keuangan (Tabel 7.4 No. 1):** Pengguna belum dapat mengunduh riwayat transaksi ke format file portabel untuk keperluan pelaporan atau analisis mandiri di spreadsheet (Excel/Google Sheets).
2. **Notifikasi Tagihan & Pengingat Proaktif (Tabel 7.4 No. 3 & 4):** Walaupun logika evaluasi tagihan H-7 (`RunwayService.get_upcoming_bills`) telah tersedia di backend, notifikasi bersifat pasif (hanya tampil di kartu ringkasan dashboard). Belum ada indikator bel notifikasi global di antarmuka web, belum ada perintah khusus tagihan di bot Telegram, serta belum ada pengingat berkala terjadwal.

### 1.2 Tujuan & Prinsip Utama
Tujuan dari spesifikasi ini adalah menutup kedua gap tersebut secara terintegrasi melalui tiga subsistem:
1. **Subsistem A (CSV Transaction Export):** Endpoint streaming CSV tabular yang aman dari formula injection, hemat memori, dan terisolasi per tenant.
2. **Subsistem B (Telegram Notification Engine):** Interaksi tagihan on-demand via perintah `/tagihan` dan `/bills`, serta background notifier terjadwal harian pukul 08:00 WIB menggunakan *FastAPI async lifespan task* (tanpa Celery/Redis).
3. **Subsistem C (Web In-App Notification Bell & Badge):** Komponen lonceng notifikasi global dengan lencana jumlah tagihan mendesak dan popover interaktif yang memungkinkan navigasi instan ke tab Vaults.

### 1.3 Batasan Ruang Lingkup & Anti-Bloat (YAGNI & Single-Box VPS)
Sesuai invariant arsitektur Rezekify (budget server VPS 2 GB RAM, zero SaaS cost):
- **Tolak Ekspor PDF:** Pustaka PDF generator (seperti WeasyPrint atau ReportLab) memakan RAM 150–300 MB dan binary dependencies yang berat. Ekspor dibatasi secara ketat pada format CSV berbasis modul bawaan `csv` Python.
- **Tolak Celery & Redis:** Pengingat harian diimplementasikan menggunakan task asinkron bawaan `asyncio` yang terikat pada siklus hidup (*lifespan*) FastAPI. Tidak ada worker daemon terpisah atau message broker yang membebani memori.
- **Tolak Library UI Eksternal Tambahan:** Seluruh elemen interaktif frontend dibangun memanfaatkan dependensi yang telah terpasang (`@heroui/react`, `lucide-react`, `framer-motion`).

---

## 2. Arsitektur & Spesifikasi Detail

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              ARSITEKTUR KESELURUHAN FITUR                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   [ WEB FRONTEND ]                                      [ BACKEND FASTAPI ]            │
│   ┌──────────────────────────┐                          ┌──────────────────────────┐   │
│   │ LedgerView.tsx           │                          │ transactions_router.py   │   │
│   │ [ Unduh CSV ] ───────────┼── GET /export?dates ────►│ Stream CSV (io.StringIO) │   │
│   └──────────────────────────┘                          │ Anti-CSV Injection       │   │
│                                                         └──────────────────────────┘   │
│   ┌──────────────────────────┐                                                         │
│   │ AppLayout.tsx            │                                                         │
│   │ Bell Icon + Badge (H-7)  │                                                         │
│   │ Popover Impending Bills  │◄── GET /dashboard/summary (upcoming_bills: [...])       │
│   └──────────────────────────┘                                                         │
│                                                                                        │
│   [ TELEGRAM BOT & SCHEDULER ]                                                         │
│   ┌──────────────────────────┐                          ┌──────────────────────────┐   │
│   │ TelegramGateway          │                          │ RunwayService            │   │
│   │ /tagihan, /bills ────────┼── On-Demand Query ──────►│ get_upcoming_bills()     │   │
│   └──────────────────────────┘                          └──────────────────────────┘   │
│                                                                       ▲                │
│   ┌──────────────────────────┐                                        │                │
│   │ FastAPI App Lifespan     │                                        │                │
│   │ scheduled_bills_notifier ┼── Loop 60s @ 08:00 WIB ────────────────┘                │
│   │ (Async HTTP to Telegram) │                                                         │
│   └──────────────────────────┘                                                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.1 Subsistem A: CSV Export Engine

#### A.1 Backend Specification (`rezekify/api/v1/transactions_router.py`)
- **Endpoint**: `GET /api/v1/transactions/export`
- **Autentikasi**: Wajib JWT Bearer Token via `current_user: User = Depends(get_current_user)`.
- **Query Parameters**:
  - `start_date: Optional[datetime] = Query(default=None)`
  - `end_date: Optional[datetime] = Query(default=None)`
  - `account_id: Optional[UUID] = Query(default=None)`
  - `category_id: Optional[UUID] = Query(default=None)`
- **Format Respons**: `StreamingResponse` dengan `media_type="text/csv"`
- **Response Headers**:
  - `Content-Disposition: attachment; filename="rezekify_transaksi_{YYYYMMDD_HHMMSS}.csv"`
  - `Cache-Control: no-cache, no-store, must-revalidate`

#### A.2 Struktur Kolom CSV Tabular
Format CSV menggunakan encoding UTF-8 dengan BOM (`﻿`) di baris pertama agar Microsoft Excel langsung mengenali karakter huruf dan tanda baca dengan benar tanpa kendala *encoding corrupt*:

| No | Nama Kolom Header | Sumber Data / Logika Pemetaan | Contoh Nilai |
|:---|:---|:---|:---|
| 1 | `Tanggal` | `transaction.transaction_date` dikonversi ke format `YYYY-MM-DD HH:mm:ss` (WIB) | `2026-10-13 14:30:00` |
| 2 | `Tipe` | Diambil dari pola debit/kredit `LedgerEntry`: `PENGELUARAN`, `PEMASUKAN`, atau `TRANSFER` | `PENGELUARAN` |
| 3 | `Kategori` | Nama master kategori dari entri debit pengeluaran atau kredit pemasukan. Jika transfer/tidak ada, bernilai `-` | `Makanan & Minuman` |
| 4 | `Akun Sumber` | Nama akun yang dikreditkan pada pengeluaran atau transfer. Jika pemasukan murni, bernilai `-` | `BCA Utama` |
| 5 | `Akun Tujuan` | Nama akun yang didebitkan pada pemasukan atau transfer. Jika pengeluaran murni, bernilai `-` | `GoPay` |
| 6 | `Deskripsi` | `transaction.description` (Wajib disanitasi dari formula injection) | `Nasi Padang + Es Teh` |
| 7 | `Nominal (IDR)` | Nominal transaksi dalam bentuk angka deterministik tanpa simbol mata uang | `28000.00` |
| 8 | `Saldo Akun` | Saldo berjalan akun terkait setelah transaksi dieksekusi (atau saldo akun sumber) | `1450000.00` |

#### A.3 Pencegahan CSV Formula Injection (CWE-1236)
Spreadsheet modern seperti Excel, LibreOffice, dan Google Sheets mengeksekusi rumus jika karakter pertama sebuah sel diawali karakter tertentu. Untuk mencegah eksekusi kode berbahaya atau kebocoran data (*Dynamic Data Exchange / DDE attacks*), seluruh nilai string (khususnya `Deskripsi`, `Kategori`, `Akun Sumber`, `Akun Tujuan`) wajib disanitasi:
```python
def sanitize_csv_cell(value: Optional[str]) -> str:
    """Escapes strings to prevent spreadsheet formula injection."""
    if not value:
        return "-"
    cleaned = str(value).strip()
    if cleaned.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{cleaned}"
    return cleaned
```

#### A.4 Generator Streaming Hemat Memori
Alih-alih mengumpulkan seluruh string CSV di RAM (yang dapat menghabiskan puluhan megabyte jika terdapat ribuan mutasi), backend menggunakan generator iterator dengan `io.StringIO`:
```python
def generate_csv_stream(transactions: List[Transaction]):
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    
    # Write UTF-8 BOM for Excel compatibility
    output.write("﻿")
    writer.writerow([
        "Tanggal", "Tipe", "Kategori", "Akun Sumber",
        "Akun Tujuan", "Deskripsi", "Nominal (IDR)", "Saldo Akun"
    ])
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    for tx in transactions:
        row = map_transaction_to_csv_row(tx)
        writer.writerow(row)
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
```

#### A.5 Integrasi Frontend (`frontend/src/components/LedgerView.tsx`)
- Menambahkan tombol aksi `Unduh CSV` pada toolbar utama di samping tombol `+ Kategori`, `Simulasi Belanja`, dan `+ Catat Manual`.
- Menggunakan ikon `Download` dari `lucide-react`.
- Saat diklik, tombol memanggil fungsi download yang memanfaatkan `useTransactionsLedger` untuk membaca filter aktif (`startDate`, `endDate`, `accountId`, `categoryId`) dan memicu unduhan berkas via `blob` dengan nama berkas dari header `Content-Disposition`.
- Menampilkan status visual `isExporting` (disabled + spinner) saat proses pembuatan stream berlangsung.

---

### 2.2 Subsistem B: Telegram Notification Engine (On-Demand + Lifespan Scheduler)

#### B.1 Perintah On-Demand: `/tagihan` dan `/bills` (`rezekify/gateway/telegram_bot.py`)
- **Perintah Baru**: Ditambahkan pada routing `process_text_message`:
  ```python
  if cmd in ("/tagihan", "/bills"):
      return self.handle_upcoming_bills_inquiry(user.id)
  ```
- **Logika Eksekusi**:
  1. Instansiasi `RunwayService(self.db)`.
  2. Panggil `runway.get_upcoming_bills(user_id=user.id, today=date.today())`.
  3. **Jika tidak ada tagihan (empty array):**
     Kembalikan pesan ramah:
     ```
     ✅ Tidak ada tagihan jatuh tempo dalam 7 hari ke depan. Semua komitmen aman!
     ```
  4. **Jika terdapat tagihan:**
     Format pesan Markdown bersih dengan rincian nama tagihan, sisa hari, dan status pengumpulan:
     ```markdown
     📋 *Daftar Tagihan Mendatang (H-7)*

     1. *Kost Bulanan*
        ⏳ Jatuh tempo: 3 hari lagi (16 Okt 2026)
        💰 Terkumpul: Rp 0 dari target Rp 850.000

     2. *WiFi Indihome*
        ⏳ Jatuh tempo: 5 hari lagi (18 Okt 2026)
        💰 Terkumpul: Rp 150.000 dari target Rp 320.000

     💡 Segera cukupi alokasi dana di brankas komitmen agar runway harian tetap aman!
     ```

#### B.2 Notifier Terjadwal Berkala: `scheduled_bills_notifier` (`rezekify/api/main.py`)
- **Mekanisme Scheduler**: Task latar belakang berbasis `asyncio.create_task` yang diinisialisasi pada siklus `lifespan` FastAPI.
- **Interval Pengecekan**: Loop `while True: await asyncio.sleep(60)` yang memeriksa waktu lokal sistem setiap 60 detik.
- **Zona Waktu**: WIB (Waktu Indonesia Barat: `UTC+7` / `Asia/Jakarta`).
- **Waktu Eksekusi**: Pukul `08:00 WIB`.
- **Idempotensi & Anti-Duplicate**: Menyimpan variabel tanggal eksekusi terakhir (`last_dispatched_date: Optional[date] = None`). Jika pada menit 08:00 tugas sudah dijalankan hari ini, maka lewati hingga pergantian hari berikutnya.
- **Alur Notifikasi Massal**:
  ```python
  async def scheduled_bills_notifier():
      last_dispatched_date = None
      while True:
          try:
              await asyncio.sleep(60)
              now_wib = datetime.now(timezone(timedelta(hours=7)))
              today_wib = now_wib.date()

              if now_wib.hour == 8 and now_wib.minute == 0 and last_dispatched_date != today_wib:
                  last_dispatched_date = today_wib
                  await dispatch_daily_bill_reminders(today_wib)
          except asyncio.CancelledError:
              break
          except Exception as exc:
              logger.error("Error in scheduled_bills_notifier: %s", exc)
  ```
- **Kueri Data Tenant**:
  - Buka sesi DB baru (`SessionLocal()`).
  - Kueri semua pengguna yang memiliki `telegram_chat_id IS NOT NULL`.
  - Untuk setiap pengguna, evaluasi `RunwayService(db).get_upcoming_bills(user.id, today=today_wib)`.
  - Jika `upcoming_bills` tidak kosong, susun pesan notifikasi pengingat pagi:
    ```markdown
    ⏰ *Pengingat Pagi Rezekify (08:00 WIB)*

    Halo {nama}, Anda memiliki {n} tagihan jatuh tempo dalam 7 hari ke depan:
    • {nama_tagihan}: Rp {nominal} (sisa {hari} hari)

    Cek status lengkap dengan ketik /tagihan atau buka web dashboard.
    ```
- **Rate-Limiting Pengiriman Pesan ke Telegram API**:
  - Kebijakan Telegram Bot API: Maksimal 30 pesan/detik secara global.
  - Rezekify menerapkan batas aman maksimal **20 pesan per detik** (`await asyncio.sleep(0.05)` di antara pengiriman pesan) untuk mencegah HTTP 429 Too Many Requests.
  - Pengiriman dilakukan melalui HTTP client asinkron (`httpx.AsyncClient` dengan timeout 10 detik).
  - Jika bot token belum dikonfigurasi di environment, fungsi scheduler mencatat log debug dan melewati eksekusi tanpa eror.

---

### 2.3 Subsistem C: Web In-App Notification (Notification Bell & Badge)

#### C.1 Penempatan Komponen di Navigasi Shell (`frontend/src/components/AppLayout.tsx`)
- Komponen Lonceng Notifikasi (`NotificationBell`) ditempatkan pada bar navigasi atas / header desktop dan header mobile.
- Lonceng menggunakan ikon `Bell` dari `lucide-react`.
- **Lencana Notifikasi (Notification Badge)**:
  - Jumlah tagihan dihitung reaktif dari `summary?.upcoming_bills?.length || 0`.
  - Jika jumlah > 0, lencana bulat kecil tampil di sudut kanan atas ikon lonceng dengan warna aksen Amber (`bg-amber-500 text-zinc-950 font-bold text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full ring-2 ring-[#0c0c0e]`).
  - Jika jumlah == 0, lencana tidak ditampilkan dan warna ikon lonceng adalah netral (`text-zinc-400 hover:text-white`).

#### C.2 Popover Dropdown Tagihan Mendesak
Saat ikon lonceng diklik, popover dropdown interaktif terbuka menampilkan:
1. **Header**:
   - Judul: `Tagihan Mendatang (H-7)`.
   - Chip status: `{count} Perlu Perhatian` (jika > 0) atau `Semua Aman` (jika 0).
2. **Konten Tagihan (List)**:
   - Setiap tagihan menampilkan:
     - Nama tagihan (`bill.name`).
     - Sisa hari hingga jatuh tempo dengan lencana waktu:
       - H-0 s/d H-1: `text-rose-400 bg-rose-500/10` (Kritis).
       - H-2 s/d H-7: `text-amber-400 bg-amber-500/10` (Peringatan).
     - Target nominal terformat Rupiah deterministik (`formatRupiah(bill.target_amount)`).
     - Alokasi saat ini vs target (`formatRupiah(bill.allocated_amount)`).
3. **Empty State**:
   - Tampilan jika tidak ada tagihan: Pesan tenang dengan ikon centang perisai (`ShieldCheck`), menyatakan seluruh komitmen keuangan terkendali.
4. **Footer Shortcut**:
   - Tombol pintas: `Buka Komitmen & Vaults` (`Button` dengan ikon `ArrowRight`).
   - Ketika ditekan, otomatis menutup popover dan memicu navigasi tab ke `vaults` (`onViewChange('vaults')`).

#### C.3 Ergonomi Sentuh & Aksesibilitas
- Tombol lonceng memenuhi ukuran target sentuh minimal 38px (`min-w-[38px] min-h-[38px]`).
- Atribut aksesibilitas lengkap: `aria-label="Notifikasi Tagihan: {n} belum dibayar"`, `role="region"`, `aria-expanded`.
- Transisi mulus <= 200ms ease-out tanpa pergeseran tata letak kumulatif (*Zero Cumulative Layout Shift*).

---

## 3. Kepatuhan Keamanan & Invariant Arsitektur

### 3.1 Core Invariant 1: Deterministic Financial Math
- Nominal pada berkas CSV dan teks notifikasi Telegram wajib dihasilkan langsung dari nilai `Decimal` basis data tanpa konversi perantara ke tipe data floating-point.
- Frontend menggunakan fungsi terpusat `formatRupiah` (`frontend/src/utils/formatters.ts`) untuk menjamin konsistensi visual nilai mata uang IDR.

### 3.2 Core Invariant 3: Multi-Tenant Row-Level Isolation
- Kueri transaksi untuk ekspor CSV memfilter secara ketat `Transaction.user_id == current_user.id`. Percobaan mengekspor transaksi milik tenant lain dicegah di tingkat SQL ORM.
- Scheduler Telegram hanya membaca tagihan dari pengguna yang terverifikasi memiliki ID Telegram yang valid dan mengeksekusi `get_upcoming_bills` berdasarkan `user.id` yang sesuai secara terpisah.

### 3.3 OWASP Anti-CSV Injection Protocol
- Karakter sensitif (`=`, `+`, `-`, `@`, tab, carriage return) pada bidang teks bebas dinetralkan dengan menyisipkan karakter petik tunggal (`'`).
- Mencegah eksekusi makro arbitrer pada perangkat klien saat berkas CSV dibuka dengan aplikasi spreadsheet pihak ketiga.

### 3.4 Zero-Bloat & Single-Box Architecture
- **Ekspor CSV**: Menggunakan pustaka standar Python `csv` dan `io.StringIO`. Nol penambahan paket npm atau dependensi pip.
- **Telegram Scheduler**: Menggunakan loop task asinkron `asyncio` bawaan Python dalam proses FastAPI yang ada. Nol kebutuhan Redis, Celery, RabbitMQ, atau cron daemon sistem terpisah.
- Konsumsi memori tambahan sistem diestimasi < 5 MB RAM, sepenuhnya mematuhi profil VPS 2 GB.

---

## 4. Rencana Pengujian & Verifikasi

### 4.1 Matriks Uji Backend (`pytest`)

#### A. File Uji: `tests/test_csv_export.py`
| Test Case | Deskripsi Pengujian | Ekspektasi Hasil |
|:---|:---|:---|
| `test_export_csv_unauthorized` | Memanggil `GET /api/v1/transactions/export` tanpa JWT header | HTTP 401 Unauthorized |
| `test_export_csv_success` | Memanggil ekspor dengan transaksi yang ada | HTTP 200, Content-Type `text/csv`, header kolom lengkap |
| `test_export_csv_tenant_isolation` | User A mengekspor CSV saat terdapat transaksi User B | Transaksi User B tidak muncul pada file hasil ekspor |
| `test_export_csv_date_filters` | Memfilter dengan `start_date` dan `end_date` | Hanya transaksi di dalam rentang tanggal yang diekspor |
| `test_export_csv_formula_injection_defense` | Transaksi dengan deskripsi `=SUM(A1:A10)` dan `@malicious` | Nilai di CSV diawali karakter `'` (`'=SUM(A1:A10)`) |

#### B. File Uji: `tests/test_telegram_notifications.py`
| Test Case | Deskripsi Pengujian | Ekspektasi Hasil |
|:---|:---|:---|
| `test_telegram_bills_command_no_bills` | Pengguna mengetik `/tagihan` tanpa ada tagihan aktif H-7 | Balasan menyatakan tidak ada tagihan mendesak |
| `test_telegram_bills_command_with_bills` | Pengguna mengetik `/tagihan` dengan tagihan H-3 aktif | Balasan memuat rincian nama tagihan, sisa hari, dan target |
| `test_telegram_bills_unlinked_user` | Chat ID yang belum terhubung mengetik `/tagihan` | Pesan peringatan akun belum terhubung |
| `test_scheduled_bills_notifier_tick` | Simulasi tick scheduler pada pukul 08:00 WIB | Kueri tagihan dieksekusi dan pesan dikirim via async HTTP |
| `test_scheduled_bills_notifier_rate_limit` | Pengiriman notifikasi ke multiple users | Jeda antarpengiriman pesan minimal 50ms (max 20 msgs/sec) |

---

### 4.2 Matriks Uji Frontend (`vitest`)

#### A. File Uji: `frontend/src/__tests__/LedgerView.test.tsx`
| Test Case | Deskripsi Pengujian | Ekspektasi Hasil |
|:---|:---|:---|
| `renders_export_csv_button` | Merender komponen `LedgerView` | Tombol `Unduh CSV` terlihat dan memiliki ikon unduh |
| `triggers_csv_download_on_click` | Pengguna mengklik tombol `Unduh CSV` | Memanggil handler ekspor dengan filter tanggal aktif |
| `disables_button_during_export` | Status ekspor sedang berjalan (`isExporting = true`) | Tombol berstatus disabled dan menampilkan loading state |

#### B. File Uji: `frontend/src/__tests__/AppLayout.test.tsx`
| Test Case | Deskripsi Pengujian | Ekspektasi Hasil |
|:---|:---|:---|
| `renders_notification_bell_without_badge_when_no_bills` | `upcoming_bills` bernilai kosong `[]` | Lonceng notifikasi tampil tanpa lencana angka |
| `renders_badge_with_count_when_bills_exist` | `upcoming_bills` memiliki 2 item tagihan | Lencana menampilkan angka `2` dengan warna aksen Amber |
| `opens_popover_on_bell_click` | Mengklik tombol lonceng | Popover terbuka menampilkan daftar tagihan terformat IDR |
| `navigates_to_vaults_on_shortcut_click` | Mengklik tombol `Buka Komitmen & Vaults` di popover | Popover tertutup dan callback `onViewChange('vaults')` terpanggil |

---

## 5. Ringkasan File yang Terpengaruh

```
├── rezekify/
│   ├── api/
│   │   ├── main.py                     (Menambahkan lifespan scheduler scheduled_bills_notifier)
│   │   └── v1/
│   │       └── transactions_router.py  (Menambahkan endpoint GET /export streaming CSV)
│   └── gateway/
│       └── telegram_bot.py             (Menambahkan penanganan perintah /tagihan & /bills)
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── AppLayout.tsx           (Menambahkan NotificationBell & Impending Bills Popover)
│       │   └── LedgerView.tsx          (Menambahkan tombol aksi Unduh CSV)
│       └── services/
│           └── apiClient.ts            (Menambahkan fungsi helper downloadTransactionsCSV)
└── tests/
    ├── test_csv_export.py              (Pengujian unit backend untuk ekspor CSV & anti-injection)
    └── test_telegram_notifications.py  (Pengujian unit perintah /tagihan & dispatch scheduler)
```

---

*Spesifikasi ini dirancang secara presisi, hemat dependensi, dan siap diimplementasikan mengikuti Superpowers TDD Protocol.*
