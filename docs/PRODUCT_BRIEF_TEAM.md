# Product Brief / One-Pager: rezekify

**Subjudul**: Asisten Manajemen Keuangan Personal Otonom & Dynamic Runway Engine  
**Audiens**: Dokumen non-teknikal untuk seluruh anggota tim (Produk, Desain, Stakeholder, Rekan Tim)  
**Status**: Aktif / Panduan Visi Produk  

---

## 1. Executive Summary

Rezekify adalah asisten keuangan otonom yang mengeliminasi kebiasaan melelahkan mencatat pengeluaran manual serta menghentikan sindrom krisis finansial di akhir bulan bagi mahasiswa dan pekerja muda. Melalui integrasi percakapan instan Telegram dan dasbor visual yang ramping, Rezekify mengubah data transaksi harian menjadi kompas batas belanja aman (*Dynamic Daily Safe Runway*) secara deterministik dan presisi.

---

## 2. The Problem (Masalah Nyata Pengguna)

Mayoritas aplikasi pengatur keuangan yang beredar di pasar gagal mempertahankan retensi pengguna karena tiga kendala fundamental:

1. **Logging Fatigue (Kelelahan Input Data)**:
   Lebih dari 90% pengguna berhenti mencatat pengeluaran dalam waktu kurang dari dua minggu. Mengisi formulir bertingkat, memilih dropdown kategori yang berbelit-belit, dan mengetik angka nominal berulang kali adalah beban friksi yang sangat melelahkan.

2. **Runway Blindness (Ilusi Saldo Awal Bulan)**:
   Melihat saldo rekening sebesar Rp3.000.000 di awal bulan sering memicu rasa aman semu. Tanpa memperhitungkan komitmen sewa kos, cicilan, dan sisa hari hingga gajian berikutnya, pengeluaran mikro yang tidak terkontrol mengikis dana hingga pengguna panik dan kehabisan uang di minggu ketiga.

3. **Bahaya Halusinasi AI Konvensional**:
   Banyak eksperimen bot percakapan kecerdasan buatan mencoba menghitung saldo langsung di dalam model bahasa (*LLM*). Hasilnya adalah halusinasi angka, inkonsistensi saldo aritmatika, dan runtuhnya kepercayaan pengguna terhadap keakuratan data finansial mereka.

---

## 3. The Solution (Solusi Rezekify)

Rezekify hadir sebagai jembatan antara kenyamanan obrolan sehari-hari dan keandalan sistem perbankan:

- **Zero-Friction Logging**:
  Pengguna cukup mengirimkan foto struk belanjaan, tangkapan layar pembayaran QRIS, atau mengetik pesan natural singkat (contoh: *"makan siang padang 25rb"*) melalui Telegram Bot maupun Quick Bar di Web Dashboard. Sistem secara otomatis membaca, mengkategorikan, dan mencatat transaksi dalam hitungan detik.
- **Dynamic Daily Safe Runway**:
  Sebuah metrik tunggal yang menjawab pertanyaan paling krusial: *"Berapa rupiah maksimal yang aman saya habiskan hari ini?"*. Angka ini dihitung ulang secara real-time dari sisa saldo riil dikurangi komitmen masa depan, lalu dibagi dengan jumlah hari yang tersisa hingga siklus pendapatan berikutnya.
- **Virtual Vaults & Pengingat Tagihan**:
  Brankas komitmen virtual yang secara otomatis memisahkan dan mengunci dana kewajiban (seperti sewa kamar kos, tagihan listrik, UKT kuliah, atau langganan rutin). Dana ini langsung diproteksi dari perhitungan uang belanja harian agar tidak terpakai tanpa sadar, dilengkapi sistem peringatan dini sebelum jatuh tempo.

---

## 4. Prinsip Inti Produk

Setiap keputusan desain dan pengembangan Rezekify berpegang teguh pada tiga pilar utama:

1. **Zero-Bloat**:
   Tidak ada fitur rumit yang tidak dibutuhkan pengguna harian. Kami menolak menambahkan skor kredit fiktif, kalkulator investasi rumit, pinjaman online, ataupun grafik tahunan berbobot berat yang mengaburkan fokus utama: bertahan hidup secara nyaman hingga akhir bulan.
2. **Akurasi 100% Deterministik**:
   Kecerdasan buatan (*AI*) hanya bertindak sebagai parser dokumen dan ekstraktor teks (NLP/Vision). Seluruh kalkulasi saldo, pengurangan brankas, alokasi anggaran, dan rumus runway dikerjakan secara eksklusif oleh logika matematika deterministik berbasis basis data relasional.
3. **Efisiensi Infrastruktur Maksimal**:
   Arsitektur sistem dirancang sangat ramping dengan memanfaatkan kuota model AI gratis secara bergilir (otomatis berpindah ke cadangan saat kuota harian habis) dan arsitektur database teruji, memastikan produk dapat dioperasikan secara berkesinambungan tanpa beban biaya server yang tinggi.

---

## 5. Fitur Utama & Pengalaman Pengguna

### A. Telegram Bot (Kanal Utama Interaksi Harian)
- **Input Cepat Teks**: Input transaksi secepat chatting dengan teman (`kopi kenangan 22rb`, `bensin 50k`).
- **Ekstraksi Struk Visual**: Kirim foto struk fisik atau screenshot e-wallet; AI mengekstrak nama merchant, nominal, tanggal, dan kategori.
- **Feedback Langsung**: Setiap entri transaksi langsung mengembalikan ringkasan saldo terkini dan sisa jatah belanja harian hari ini.
- **Notifikasi Peringatan Dini**: Pengingat otomatis saat Daily Safe Runway menipis atau saat tagihan brankas mendekati jatuh tempo (H-7).

### B. Web Dashboard (Pusat Kendali & Evaluasi)
- **Daily Safe Runway Radar**: Indikator visual batas aman belanja harian dengan kode warna status (Aman, Waspada, Kritis).
- **Upcoming Bills & Fixed Commitments Card**: Daftar brankas tagihan tetap yang menampilkan progres pengumpulan dana dan tenggat waktu pembayaran.
- **Analytics Spending Breakdown**:
  - *Mode Harian*: Tren pengeluaran 7 hingga 14 hari terakhir dibandingkan dengan garis Daily Safe Runway.
  - *Mode Bulanan*: Komposisi kategori pengeluaran siklus berjalan untuk melihat pos belanja terbesar.
- **Manajemen Brankas (Virtual Vaults)**: Antarmuka sederhana untuk menambah target tabungan atau kewajiban tagihan berkala.

---

## 6. Milestone & Roadmap Peluncuran

1. **Fase 1 - Fondasi Core Engine & Telegram Logger**:
   - Penyelesaian arsitektur database relasional (Users, Accounts, Transactions, Vaults, Daily Runway Logs).
   - Integrasi Gemini 2.5 Flash Free Tier dengan fallback Groq Llama 3.3 untuk parser teks dan OCR struk.
   - Bot Telegram fungsional untuk pencatatan dan respons instan Daily Runway.
2. **Fase 2 - Web Dashboard & Manajemen Komitmen**:
   - Peluncuran REST API FastAPI dengan autentikasi aman JWT / Telegram Login.
   - Pembangunan antarmuka React + Vite + TailwindCSS yang responsif untuk mobile dan desktop.
   - Implementasi peringatan dini tagihan jatuh tempo (Upcoming Bills reminder).
3. **Fase 3 - Analitik Terarah & Evaluasi Komunitas**:
   - Penyempurnaan grafik pengeluaran harian dan bulanan tanpa beban kueri tahunan.
   - Uji coba terbatas (closed beta) kepada kelompok mahasiswa dan pekerja muda.
   - Pengumpulan umpan balik untuk penyempurnaan akurasi ekstraksi struk belanja lokal.
