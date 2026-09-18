# Product Brief / One-Pager: Rezekify
**Autonomous Personal Finance Assistant & Deterministic Runway Engine**  
**Dokumen Non-Teknikal untuk Tim Produk, Desain, dan Stakeholder**  
**Tanggal:** 2026-09-18  

---

## 1. Ringkasan Eksekutif (Executive Summary)

**Rezekify** adalah asisten manajemen keuangan personal otonom generasi baru yang menggabungkan kemudahan interaksi berbasis kecerdasan buatan (*conversational AI*) dengan keandalan pembukuan matematis mutlak (*deterministic accounting*). 

Misi utama Rezekify adalah membebaskan individu dari kecemasan finansial bulanan dengan menghilangkan friksi pencatatan manual dan memberikan navigasi belanja harian yang proaktif. Alih-alih hanya merekap pengeluaran masa lalu yang sudah terlanjur terjadi, Rezekify bertindak sebagai kompas finansial masa depan: menghitung **Jatah Belanja Aman Harian (*Daily Safe Runway*)** secara dinamis agar pengguna tidak pernah kehabisan uang sebelum tanggal siklus gajian berikutnya tiba.

Dengan value proposition utama:
* **Zero-Friction Ingestion:** Mencatat pengeluaran semudah mengirim pesan teks santai atau memotret struk belanjaan di aplikasi pesan yang sudah dipakai sehari-hari.
* **Proactive Daily Guidance:** Mengetahui secara pasti berapa nominal rupiah yang aman dibelanjakan hari ini tanpa mengorbankan kewajiban sewa kos, uang kuliah, maupun tabungan.
* **100% Mathematical Certainty:** Pengalaman interaksi didukung AI multimodal, namun seluruh hitungan uang dijalankan oleh mesin buku besar berstandar akuntansi resmi tanpa risiko halusinasi.

---

## 2. Masalah Nyata Pengguna (The Problem)

Mengapa lebih dari 90% orang gagal dan berhenti mencatat pengeluaran keuangan pribadi setelah beberapa minggu? Riset mendalam kami menemukan tiga akar persoalan struktural:

1. **Expense Tracking Fatigue (Kelelahan Form Manual):**
   Aplikasi keuangan konvensional menuntut disiplin tinggi yang melelahkan. Pengguna diwajibkan membuka aplikasi berat, menekan banyak tombol, memasukkan angka desimal, memilih akun sumber, dan memilah puluhan kategori hanya untuk mencatat secangkir kopi seharga Rp 18.000. Beban administratif harian ini memicu kejenuhan psikologis (*tracking fatigue*), sehingga 9 dari 10 pengguna akhirnya menyerah.

2. **Runway Blindness (Kebutaan Sisa Hari & Ilusi Saldo Gemuk):**
   Saat menerima transfer gaji atau kiriman bulanan, saldo rekening tampak melimpah. Ilusi ini menciptakan rasa aman semu yang memicu pengeluaran impulsif di minggu-minggu awal. Pengguna tidak menyadari adanya kebocoran halus (*micro-spending*) dan melupakan komitmen tagihan tetap di akhir bulan. Akibatnya timbul kepanikan di minggu ketiga ketika saldo tiba-tiba menipis sebelum siklus berikutnya tiba.

3. **Bahaya Halusinasi AI pada Aplikasi Keuangan:**
   Banyak inovasi fintech mencoba menyematkan chatbot AI generatif biasa untuk mengelola keuangan. Namun, model bahasa besar (*Large Language Models*) secara mendasar adalah mesin probabilistik teks, bukan kalkulator. Chatbot biasa rawan mengalami halusinasi aritmatika—salah menjumlahkan saldo, salah mengingat komitmen utang, atau memberikan saran belanja yang menyesatkan saat mengelola uang riil pengguna.

---

## 3. Solusi Rezekify (The Solution)

Rezekify merombak total paradigma pengelolaan keuangan personal melalui tiga pilar inovasi:

1. **Zero-Friction Ambient Ingestion (Pencatatan Otomatis Tanpa Beban):**
   Pengguna tidak perlu lagi mengisi formulir manual yang kaku. Cukup kirimkan foto struk kasir toko fisik/screenshot QRIS atau ketik pesan obrolan santai berbahasa sehari-hari di Telegram (misal: *"ngopi 25rb gopay"*, *"makan siang bakso 30k pake bca"*). Asisten AI Rezekify secara cerdas mengekstrak nama merchant, rincian pos belanja, nominal biaya, dan metode pembayaran otomatis dalam hitungan detik.

2. **Dynamic Daily Safe Runway (Kompas Belanja Aman Harian):**
   Rezekify menjawab pertanyaan paling penting pengguna setiap pagi: *"Berapa jatah maksimal belanja amanku hari ini agar uang cukup sampai siklus berikutnya?"*. Sistem menghitung dana kas likuid bebas (setelah dikurangi seluruh komitmen wajib), lalu membaginya secara presisi dengan sisa hari menuju siklus gajian berikutnya. Jika hari ini pengguna berhemat, jatah esok hari bertambah; jika berlebih, sistem langsung memberikan penyesuaian yang realistis.

3. **Brankas Virtual & Pengingat Tagihan (Vaults & Impending Bills):**
   Dana komitmen penting (sewa kos, cicilan, UKT kuliah, tabungan darurat) dikunci di brankas virtual (*Vaults*) agar terisolasi dari saldo operasional harian dan tidak terpakai untuk jajan impulsif. Sistem dilengkapi fitur peringatan dini **H-7**: jika terdapat tagihan tetap (*Fixed Bill*) yang jatuh tempo dalam kurun waktu 7 hari ke depan dan alokasi dananya belum terpenuhi, Rezekify secara proaktif memunculkan banner peringatan prioritas tinggi di dashboard dan notifikasi Telegram.

---

## 4. Prinsip Inti Produk (Product Principles)

Pengembangan dan evolusi produk Rezekify dipandu oleh tiga prinsip yang tidak dapat ditawar:

1. **100% Deterministik & Anti-Salah Hitung:**
   Kecerdasan buatan (AI) hanya digunakan di lapisan terluar untuk menangkap niat pengguna dan mengekstrak teks/struk belanjaan. Seluruh proses pembukuan, perubahan saldo, penyeimbangan debit-kredit (*double-entry ledger*), serta kalkulasi runway dihitung murni menggunakan logika matematika presisi di database PostgreSQL dan pustaka standar Python. AI tidak pernah dibiarkan melakukan operasi hitung aritmatika di dalam konteks percakapannya.

2. **Zero-Bloat (Fokus, Cepat, & Tajam):**
   Kami menolak membebani pengguna dengan fitur-fitur yang tidak berdampak pada keputusan hidup harian. Rezekify tidak memiliki skor kredit perbankan fiktif, tidak menjual produk pinjaman online/kredit konsumtif, tidak menyediakan simulasi investasi spekulatif yang rumit, dan tidak menampilkan grafik tahunan yang membingungkan. Semua antarmuka didesain agar pengguna memahami kondisi keuangan mereka dalam waktu kurang dari 3 detik.

3. **Sustainable & Rp 0 Biaya AI:**
   Arsitektur backend Rezekify mengimplementasikan rotasi kumpulan kunci cerdas (*rotary key pool*) memanfaatkan kuota gratis model AI berkecepatan tinggi (seperti Google AI Studio Gemini 2.5 Flash Vision dan Groq). Hal ini menjaga biaya marjinal operasional server tetap Rp 0 tanpa bergantung pada langganan API berbayar, menjamin keberlanjutan produk untuk jangka panjang.

---

## 5. Target Pengguna & Persona

Rezekify dirancang khusus untuk dua segmen pengguna yang paling rentan terhadap ketidakpastian arus kas:

### Persona 1: Mahasiswa Rantau
* **Profil:** Mahasiswa yang tinggal jauh dari orang tua, mengandalkan kiriman uang saku bulanan dalam jumlah terbatas.
* **Titik Sakit (Pain Points):** 
  * Sering kehabisan uang di akhir bulan karena tidak menyadari akumulasi jajan kecil dan nongkrong di kafe.
  * Uang sewa kos atau semesteran (UKT) sering terpakai untuk kebutuhan lain karena tersimpan di rekening yang sama.
* **Bagaimana Rezekify Membantu:** 
  * Cukup foto struk makan warteg/minimarket di Telegram tanpa repot membuka aplikasi khusus.
  * Uang sewa kos dan UKT langsung dikunci di Brankas Virtual dengan alarm pengingat H-7.
  * Setiap pagi mengetahui jatah belanja harian (misal: *"Jatah makan amanmu hari ini Rp 35.000"*).

### Persona 2: Pekerja Lepas / Freelancer
* **Profil:** Profesional independen, gig-economy worker, atau kreator konten dengan ritme pendapatan tidak menentu (*irregular income*) dan banyak dompet digital.
* **Titik Sakit (Pain Points):**
  * Saldo tersebar di berbagai rekening bank dan e-wallet (BCA, GoPay, OVO, ShopeePay), menyulitkan pemahaman total dana riil.
  * Sulit menentukan anggaran bulanan yang tetap karena penghasilan masuk dalam termin yang bervariasi.
* **Bagaimana Rezekify Membantu:**
  * Konsolidasi saldo multi-akun secara otomatis setiap kali mencatat mutasi.
  * Pre-purchase simulator: mengecek apakah pembelian barang kerja baru (seperti perangkat atau software) aman dilakukan sebelum uang dibelanjakan.
  * Memberikan angka *Daily Safe Runway* yang fleksibel dan menyesuaikan diri secara langsung saat pembayaran proyek baru masuk.

---

## 6. Arsitektur Antarmuka (User Journey)

Rezekify mengadopsi pendekatan antarmuka terpadu dua saluran (*two-channel complementary architecture*):

### Saluran Utama: Bot Telegram (Fast, Mobile-First, Zero-Install)
* **Karakteristik:** Menjadi pintu gerbang harian pengguna tanpa perlu mengunduh atau menginstal aplikasi baru di ponsel.
* **Interaksi Utama:**
  * *Pencatatan Teks:* Ketik kalimat santai (*"bensin 30rb mandiri"*), bot langsung mencatat dan mengonfirmasi sisa runway harian.
  * *Pencatatan Gambar:* Unggah foto struk belanjaan kasir; bot mengekstrak rincian belanjaan dan memperbarui buku kas dalam 2 detik.
  * *Perintah Cepat:* Cukup ketik `/runway` untuk mengecek status keuangan terkini atau `/link` untuk menghubungkan akun web.

### Saluran Pendukung: Web Dashboard (Strategic Control & Deep Insight)
* **Karakteristik:** Dasbor web responsif modern (React 18 + Tailwind CSS) yang bersih, elegan, dan menenangkan, diakses saat pengguna ingin melihat gambaran besar atau melakukan audit data.
* **Komponen Kunci:**
  * **Hero Omni-Input Action Bar:** Kotak aksi utama di posisi teratas dasbor yang menerima teks natural, input suara (*speech-to-text*), dan drag-and-drop struk belanja dengan pratinjau konfirmasi instan.
  * **Gauge Runway & Indikator Status:** Tampilan visual jatah belanja aman harian dengan penanda warna intuitif (Hijau = Sehat, Kuning = Waspada, Merah = Kritis).
  * **Kartu Tagihan Mendatang (`UpcomingBillsCard`):** Banner notifikasi di baris atas yang memuat daftar tagihan jatuh tempo dalam $\le 7$ hari beserta selisih dana yang masih perlu dialokasikan.
  * **Analitik Pengeluaran Terarah (Daily vs Monthly Toggle):** Grafik belanja yang menyajikan tren 7–14 hari vs ambang batas runway harian (*Daily*) atau distribusi kategori siklus berjalan (*Monthly*), tanpa beban kueri tahunan.
  * **Auxiliary Manual CRUD:** Modal tabel mutasi untuk koreksi, edit, atau hapus transaksi (dilengkapi fitur pembatalan jurnal otomatis untuk menjaga integritas saldo).

---

## 7. Roadmap Pengembangan (Phases)

Rencana eksekusi produk Rezekify dibagi ke dalam tahapan terstruktur yang terukur:

```
[ Fase 1: Core Ledger ] ──> [ Fase 2: AI & Telegram ] ──> [ Fase 3: Web Dashboard ] ──> [ Fase 4: Quality & Release ]
```

### Fase 1: Core Ledger & Deterministic Engine (Fondasi Inti)
* Perancangan skema basis data PostgreSQL dengan isolasi data multi-pengguna (*row-level multi-tenant isolation*).
* Implementasi mesin buku besar berpasangan (*double-entry bookkeeping*) dengan verifikasi debit-kredit mutlak.
* Implementasi logika kalkulator *Daily Safe Runway*, Brankas Virtual (*Vaults*), dan algoritma simulasi belanja impulsif.
* Unit test 100% untuk seluruh formula matematika finansial.

### Fase 2: AI Agentic Ingestion & Telegram Gateway (Kanal Otomatis)
* Pembangunan *Rotary Key Pool* multi-kunci (Gemini 2.5 Flash Vision & Groq) dengan failover otomatis saat batas kuota tercapai.
* Implementasi agen ReAct dengan 5 alat deterministik (`record_expense`, `record_income`, `transfer_balance`, `allocate_to_vault`, `get_runway_status`).
* Peluncuran Bot Telegram terintegrasi untuk pengolahan teks kasual dan OCR struk belanjaan.
* Alur penghubung akun web-Telegram yang aman berbasis kode OTP berbatas waktu 15 menit.

### Fase 3: Modern Web Dashboard (Antarmuka Pengguna Utama)
* Pembangunan frontend terpisah menggunakan React 18, Vite, TypeScript, dan Tailwind CSS.
* Implementasi komponen *Omni-Input Hero Action Bar* (teks, suara, unggah struk).
* Implementasi kartu telemetri *RunwayMetricCard*, banner *UpcomingBillsCard* (H-7), serta grafik *ExpenseCharts* dengan toggle *Daily* dan *Monthly*.
* Penyediaan formulir konvensional (*Auxiliary Manual CRUD*) untuk kebutuhan audit manual.

### Fase 4: Integrasi End-to-End, Perlindungan HKI, & Rilis Publik
* Pengujian integrasi menyeluruh (*end-to-end testing*) dari pengiriman pesan di Telegram hingga sinkronisasi data di Web Dashboard.
* Ekspor otomatis berkas dokumentasi ciptaan (*HKI Dossier Export*) untuk pendaftaran Hak Cipta Perangkat Lunak ke Kemenkumham RI.
* Rilis beta tertutup (*closed beta*) ke kelompok mahasiswa dan komunitas pekerja lepas untuk validasi produk.
* Peluncuran publik resmi (*General Availability*) dan kampanye edukasi literasi keuangan bebas stres.
