# PENGEMBANGAN PLATFORM REZEKIFY
**Dokumen Usulan Gagasan dan Pemilihan Topik**  
**Nomor Dokumen: SIS1-CD1**

**VIGRIS LABS**  
**UNIVERSITAS NEGERI SURABAYA**  
**TAHUN 2026**

---

## LEMBAR PENGESAHAN

**Nomor Dokumen:** SIS1-CD1  
**Data Pemeriksaan dan Persetujuan:**

| Peran | Nama | Tanggal | Tanda Tangan |
| :--- | :--- | :--- | :--- |
| Project Manager | Imroatus Shaliha | | |
| System Analyst | Shinta Olivia Kumalasari | | |
| UI/UX Designer | Oktaviana Ramadhani Faadhillah | | |
| Frontend Developer | Rafi Dwi Saputra | | |
| Backend Developer | Grant Samuel Manurung | | |
| Penguji 1 | | | |
| Penguji 2 | | | |
| Pembimbing 1 | Dwi Fatrianto Suyatno, S. Kom., M. Kom. | | |
| Pembimbing 2 | I Kadek Dwi Nuryana, S.T., M. Kom. | | |

---

## TIMELINE REVISI DOKUMEN

| Versi | Tanggal | Perbaikan | Halaman Revisi |
| :--- | :--- | :--- | :--- |
| 1.0 | | Penyusunan draft awal SIS1-CD1 | |
| 1.1 | | Revisi berdasarkan hasil pemeriksaan dan bimbingan | |
| 1.2 | | Revisi lanjutan | |

---

## DAFTAR ISI

- **LEMBAR PENGESAHAN** — i
- **TIMELINE REVISI DOKUMEN** — ii
- **DAFTAR ISI** — iii
- **DAFTAR GAMBAR** — iv
- **DAFTAR TABEL** — v
- **BAB I PENGANTAR** — 1
  - 1.1 Ringkasan Dokumen — 1
  - 1.2 Tujuan Penulisan Dokumen — 2
  - 1.3 Daftar Singkatan — 3
- **BAB II MASALAH** — 5
  - 2.1 Latar Belakang Masalah — 5
  - 2.2 Informasi Pendukung (Data & Fakta) — 7
- **BAB III ANALISIS UMUM** — 15
  - 3.1 Aspek Ekonomi — 15
  - 3.2 Aspek Operasional / Manufakturabilitas — 16
  - 3.3 Aspek Keberlanjutan (Sustainability) — 18
    - 3.3.1 Keberlanjutan Penggunaan — 19
    - 3.3.2 Keberlanjutan Pengembangan Sistem — 19
    - 3.3.3 Keberlanjutan Ekonomi — 20
    - 3.3.4 Keberlanjutan Sosial dan Perilaku Keuangan — 20
    - 3.3.5 Keterkaitan dengan Sustainable Development Goals — 20
- **BAB IV KEBUTUHAN YANG HARUS DIPENUHI** — 22
  - 4.1 Kebutuhan Fungsional — 23
    - 4.1.1 Autentikasi dan Pengelolaan Sesi Pengguna — 23
    - 4.1.2 Pengelolaan Akun Sumber Dana — 23
    - 4.1.3 Pencatatan Transaksi dan Pembukuan Berpasangan — 24
    - 4.1.4 Pencatatan Bantuan AI — 24
    - 4.1.5 Dashboard Keuangan dan Deterministic Runway — 25
    - 4.1.6 Pengelolaan Commitment Vault dan Tagihan — 26
    - 4.1.7 Integrasi Telegram Bot API — 26
    - 4.1.8 Pengaturan Bring Your Own Key (BYOK) AI — 27
    - 4.1.9 Laporan dan Analisis Keuangan — 27
  - 4.2 Kebutuhan Non Fungsional — 28
    - 4.2.1 Usability, Kebutuhan Software, dan Hardware — 28
    - 4.2.2 Kebutuhan Server, Jaringan, dan Deployment Environment — 28
    - 4.2.3 Performance dan Integritas Data — 29
    - 4.2.4 Security dan Privacy — 29
    - 4.2.5 Reliability dan Fault Tolerance — 29
    - 4.2.6 Maintainability dan Compatibility — 30
- **BAB V TUJUAN PROYEK** — 31
  - 5.1 Tujuan Jangka Pendek — 31
  - 5.2 Tujuan Jangka Panjang — 32
- **BAB VI SOLUSI SISTEM YANG DIUSULKAN** — 34
  - 6.1 Rezekify Basic — 34
    - 6.1.1 Desain Alur Kerja — 34
    - 6.1.2 Kelebihan — 36
    - 6.1.3 Kekurangan — 36
  - 6.2 Rezekify Intelligent — 37
    - 6.2.1 Desain Alur Kerja — 37
    - 6.2.2 Kelebihan — 39
    - 6.2.3 Kekurangan — 39
- **BAB VII KARAKTERISTIK PRODUK** — 41
  - 7.1 Fitur Utama — 41
  - 7.2 Fitur Dasar — 43
  - 7.3 Fitur Tambahan — 45
  - 7.4 Prioritas Karakteristik Produk — 46
- **BAB VIII SKENARIO PENGGUNAAN DAN STAKEHOLDERS** — 48
  - 8.1 Identifikasi Stakeholders — 48
    - 8.1.1 Pengguna/Individu — 49
    - 8.1.2 AI Service Provider — 50
    - 8.1.3 Tim Pengembang — 50
  - 8.2 Skenario Penggunaan Sistem — 51
    - 8.2.1 UC-01: Registrasi dan Login Pengguna — 51
    - 8.2.2 UC-02: Catat Transaksi Teks (AI Chat) — 53
    - 8.2.3 UC-03: Catat Transaksi Struk (Vision OCR) — 55
    - 8.2.4 UC-04: Catat Transaksi Suara (Voice Note) — 56
    - 8.2.5 UC-05: Cek Status & Simulasi Runway — 58
    - 8.2.6 UC-06: Kelola Akun & Kategori Keuangan — 59
    - 8.2.7 UC-07: Kelola Commitment Vault — 60
    - 8.2.8 UC-08: Penautan Akun Telegram (Pairing) — 61
    - 8.2.9 UC-09: Konfigurasi AI & Key (BYOK) — 63
    - 8.2.10 UC-10: Kelola dan Edit Riwayat Transaksi — 64
  - 8.3 Skenario Penggunaan Terintegrasi — 65
  - 8.4 Hubungan Stakeholder dengan Sistem — 67
  - 8.5 Batasan Interaksi Stakeholder — 67
- **BAB IX KESIMPULAN DAN RINGKASAN** — 69
- **DAFTAR PUSTAKA** — 71
- **LAMPIRAN** — 73

---

## DAFTAR GAMBAR

- **Gambar 2.1** Grafik Pertumbuhan Transaksi Pembayaran Digital Indonesia Pada Bulan Agustus 2026 (Sumber: Bank Indonesia Siaran Pers No. 28/193/Dkom, 23 September 2026) — 8
- **Gambar 2.2** Grafik Literasi dan Inklusi Keuangan Menurut Kelompok Umur Oleh SNLIK 2026 (Sumber: OJK, LPS, dan BPS, Hasil SNLIK 2026, diumumkan 11 Agustus 2026) — 9
- **Gambar 2.3** Grafik Kebiasaan Pengelolaan Keuangan Gen Z Berdasarkan Survei KIC & Zigi 2021 (Sumber: Survei KIC & Zigi 2021) — 11
- **Gambar 3.1** Diagram Proses Operasional Rezekify — 16
- **Gambar 3.2** Diagram Proses Rezekify yang Melibatkan AI — 17
- **Gambar 3.3** Diagram Siklus Penggunaan Sistem — 19
- **Gambar 6.1** Diagram Alur Kerja Rezekify Basic — 35
- **Gambar 6.2** Diagram Alur Kerja Rezekify Intelligent — 38
- **Gambar 8.1** Diagram Skenario Penggunaan Terintegrasi — 66

---

## DAFTAR TABEL

- **Tabel 1.1** Daftar Singkatan — 4
- **Tabel 7.2** Fitur Utama Rezekify — 41
- **Tabel 7.3** Fitur Dasar Rezekify — 44
- **Tabel 7.4** Fitur Tambahan Rezekify — 45
- **Tabel 7.5** Prioritas Karakteristik Produk — 46
- **Tabel 8.1** Identifikasi Stakeholder — 48
- **Tabel 8.2** Hubungan Stakeholder dengan Sistem — 67

---

# BAB I: PENGANTAR

### 1.1 Ringkasan Dokumen
Rezekify merupakan sistem informasi manajemen keuangan personal berbasis website yang memanfaatkan kecerdasan buatan. Platform ini dirancang sebagai produk digital *Business-to-Consumer* (B2C) untuk membantu individu dalam melakukan pencatatan, pengelolaan, pemantauan, dan pemahaman terhadap kondisi keuangannya secara lebih praktis dan terstruktur. Gagasan ini berdasarkan pada perkembangan penggunaan layanan keuangan digital yang menyebabkan aktivitas transaksi individu semakin beragam dan tersebar pada berbagai rekening maupun dompet digital, sehingga diperlukan pendekatan yang dapat membantu pengguna mengelola informasi keuangannya secara terpusat.

Rezekify dirancang dengan pendekatan *AI-powered personal financial assistant* yang tidak hanya berfungsi sebagai media pencatatan pemasukan dan pengeluaran, tetapi juga membantu pengguna memahami pola keuangan, mengatur anggaran, menetapkan target finansial, serta memperoleh insight dan edukasi untuk perencanaan keuangan. Pengguna dapat mencatat transaksi melalui bahasa alami, suara, gambar struk, maupun input manual, sementara sistem memanfaatkan AI untuk membantu mengenali dan mengolah informasi transaksi tersebut. Sasaran utama sistem adalah individu, khususnya mahasiswa dan pekerja muda yang aktif menggunakan layanan keuangan digital dan memiliki kebutuhan untuk mengelola keuangan personal secara lebih terstruktur.

Pemilihan topik dilakukan dengan mempertimbangkan adanya kebutuhan terhadap solusi yang dapat menjembatani aktivitas transaksi digital dengan pengelolaan keuangan personal. Rezekify kemudian dikembangkan dengan mempertimbangkan aspek ekonomi, operasional atau manufakturabilitas, dan keberlanjutan, serta dibandingkan dengan alternatif solusi sistem untuk menentukan konsep yang paling sesuai dengan kebutuhan pengguna dan kemampuan pengembangan proyek. Hasil analisis tersebut menjadi dasar dalam menentukan kebutuhan sistem, tujuan proyek, karakteristik produk, serta skenario penggunaan dan stakeholders yang terlibat.

### 1.2 Tujuan Penulisan Dokumen
Dokumen ini bertujuan untuk merumuskan gagasan dan arah awal pengembangan Rezekify berdasarkan fenomena, permasalahan, serta kebutuhan yang telah diidentifikasi pada mahasiswa dan pekerja muda sebagai target pengguna. Perumusan tersebut dilakukan agar konsep sistem dapat memenuhi kebutuhan nyata dalam proses pencatatan, pengelolaan, pemantauan, dan pemahaman keuangan pribadi. Dengan pendekatan tersebut, setiap fungsi dan karakteristik yang diusulkan dalam Rezekify dapat memiliki keterkaitan yang jelas dengan permasalahan yang hendak diselesaikan. Secara khusus, tujuan penulisan dokumen ini adalah:
1. Mengidentifikasi dan merumuskan permasalahan yang berkaitan dengan pencatatan, pengelolaan, pemantauan, dan pemahaman keuangan pribadi pada mahasiswa dan pekerja muda pengguna transaksi digital.
2. Mengumpulkan dan menyajikan data, fakta, serta hasil penelitian yang relevan sebagai dasar untuk menjelaskan fenomena dan urgensi permasalahan yang menjadi landasan pengembangan Rezekify.
3. Menganalisis kebutuhan pengguna dan kebutuhan sistem berdasarkan permasalahan yang telah diidentifikasi sehingga solusi yang dirancang memiliki keterkaitan yang jelas dengan kebutuhan tersebut.
4. Merumuskan dan membandingkan alternatif solusi sebagai dasar dalam menentukan konsep Rezekify yang paling sesuai dengan permasalahan dan kebutuhan yang telah dirumuskan.
5. Mendefinisikan karakteristik awal Rezekify, meliputi fitur utama, fitur dasar, fitur tambahan, serta pemanfaatan AI sebagai teknologi pendukung dalam proses pengelolaan informasi keuangan pribadi.
6. Mengidentifikasi stakeholder, aktor eksternal, dan skenario penggunaan untuk menggambarkan hubungan pengguna dengan sistem serta proses utama yang terjadi dalam penggunaan Rezekify.
7. Menghasilkan landasan awal pengembangan sistem yang dapat digunakan untuk menurunkan kebutuhan, menyusun desain, mengembangkan implementasi, dan merancang pengujian Rezekify pada tahapan Capstone Design berikutnya.

### 1.3 Daftar Singkatan
Daftar singkatan digunakan untuk memberikan konsistensi istilah yang digunakan dalam dokumen dan membantu pembaca memahami istilah teknis, bisnis, serta konsep digital yang digunakan pada pembahasan Rezekify. Singkatan yang digunakan terutama berkaitan dengan kecerdasan buatan, kanal pembayaran digital, pengolahan data, serta konsep pengembangan sistem.

#### Tabel 1.1: Daftar Singkatan
| No | Singkatan/Istilah | Kepanjangan/Arti |
| :-: | :--- | :--- |
| 1 | AI | *Artificial Intelligence* |
| 2 | API | *Application Programming Interface* |
| 3 | B2C | *Business-to-Consumer* |
| 4 | BI | Bank Indonesia |
| 5 | BPS | Badan Pusat Statistik |
| 6 | BNPL | *Buy Now Pay Later* |
| 7 | Gen Z | *Generation Z* |
| 8 | HKI | Hak Kekayaan Intelektual |
| 9 | LPS | Lembaga Penjamin Simpanan |
| 10 | OCR | *Optical Character Recognition* |
| 11 | OJK | Otoritas Jasa Keuangan |
| 12 | SDGs | *Sustainable Development Goals* |
| 13 | SNLIK | Survei Nasional Literasi dan Inklusi Keuangan |
| 14 | MVP | *Minimum Viable Product* |
| 15 | KIC | Katadata Insight Center |
| 16 | NLP | *Natural Language Processing* |
| 17 | QRIS | *Quick Response Code Indonesian Standard* |

---

# BAB II: MASALAH

### 2.1 Latar Belakang Masalah
Perkembangan teknologi digital telah mengubah cara individu melakukan aktivitas keuangan sehari-hari. Transaksi yang sebelumnya banyak dilakukan secara tunai kini semakin sering dilakukan melalui berbagai kanal digital, seperti *mobile banking*, QRIS, dan dompet digital. Perubahan tersebut memberikan kemudahan dan kecepatan dalam melakukan transaksi, tetapi pada saat yang sama membuat aktivitas keuangan individu semakin tersebar pada berbagai rekening, aplikasi, dan instrumen pembayaran. Kondisi ini meningkatkan kompleksitas pengelolaan informasi keuangan pribadi karena pengguna perlu mengelola informasi yang berasal dari berbagai sumber untuk memperoleh gambaran kondisi keuangan secara menyeluruh. Pertumbuhan aktivitas pembayaran digital di Indonesia yang terus meningkat memperkuat masalah tersebut [1].

Bagi individu, pengelolaan keuangan pribadi tidak hanya berkaitan dengan kemampuan melakukan transaksi, tetapi juga dengan kemampuan mengetahui dan memahami kondisi keuangan setelah transaksi dilakukan. Pengguna perlu mengetahui jumlah pemasukan, pengeluaran, saldo yang tersedia, alokasi pengeluaran, kondisi anggaran, serta perkembangan tujuan finansial yang dimiliki. Ketika informasi tersebut tersebar pada berbagai sumber dan tidak dikelola secara terintegrasi, pengguna perlu melakukan proses pengumpulan dan pemeriksaan informasi secara manual. Hal tersebut dapat menyulitkan pengguna untuk memperoleh gambaran keuangan yang utuh dan terkini.

Permasalahan juga muncul pada proses pencatatan transaksi. Informasi transaksi merupakan dasar penting untuk melakukan pemantauan dan analisis keuangan, tetapi pencatatan secara manual dapat menjadi aktivitas yang berulang dan membutuhkan waktu. Setiap transaksi perlu dimasukkan, dilengkapi dengan informasi yang sesuai, kemudian dikategorikan agar dapat digunakan dalam proses analisis. Apabila proses tersebut dirasakan terlalu membebani pengguna, terdapat kemungkinan transaksi tidak dicatat, dicatat setelah beberapa waktu, atau dicatat secara tidak konsisten. Akibatnya, informasi yang tersedia dalam sistem tidak selalu mencerminkan kondisi keuangan pengguna secara lengkap.

Selain permasalahan pencatatan, terdapat permasalahan dalam mengubah data transaksi menjadi informasi yang dapat membantu pengguna memahami kondisi keuangannya. Riwayat transaksi pada dasarnya hanya menunjukkan kejadian finansial yang telah berlangsung. Pengguna masih perlu mengetahui pola pengeluarannya, kategori pengeluaran yang paling dominan, kesesuaian pengeluaran dengan anggaran, perubahan kondisi keuangan dari waktu ke waktu, serta faktor yang dapat memengaruhi pencapaian tujuan keuangan. Dengan demikian, sistem pengelolaan keuangan pribadi yang hanya menyediakan fungsi pencatatan belum sepenuhnya menjawab kebutuhan pengguna untuk memahami kondisi finansialnya.

Perkembangan kecerdasan buatan memberikan peluang untuk mengatasi sebagian permasalahan tersebut. Teknologi seperti *Natural Language Processing* (NLP), pengenalan suara, *Optical Character Recognition* (OCR), klasifikasi data, analisis pola, dan model bahasa dapat digunakan untuk mengurangi beban input manual serta membantu sistem memahami informasi transaksi. Dengan memanfaatkan teknologi tersebut, sistem dapat menerima informasi melalui bentuk input yang lebih fleksibel, mengubahnya menjadi data transaksi terstruktur, mengelompokkan transaksi, dan menghasilkan informasi yang lebih relevan bagi pengguna.

Berdasarkan kondisi tersebut, diperlukan sistem informasi pengelolaan keuangan personal yang tidak hanya berfungsi sebagai tempat pencatatan transaksi, tetapi juga mampu mengintegrasikan proses pencatatan, pengelolaan, pemantauan, analisis, dan perencanaan keuangan dalam satu sistem. Sistem tersebut perlu mengurangi friksi dalam proses pencatatan, menyediakan informasi keuangan yang terorganisasi, serta membantu pengguna memperoleh pemahaman yang lebih baik mengenai kondisi finansialnya. Berdasarkan kebutuhan tersebut, Rezekify diusulkan sebagai sistem informasi manajemen keuangan personal berbasis website dengan pendekatan *AI-Powered Personal Financial Assistant*. Rezekify dirancang untuk membantu pengguna mencatat transaksi melalui berbagai bentuk input, mengorganisasikan informasi keuangan, memantau pemasukan dan pengeluaran, mengelola anggaran dan tujuan keuangan, serta memperoleh *financial insight* dan informasi pendukung perencanaan keuangan dalam satu platform.

Dengan demikian, masalah yang melatarbelakangi pengembangan Rezekify bukan hanya keterbatasan media untuk mencatat pengeluaran. Selain itu, adanya kesenjangan antara semakin kompleksnya aktivitas keuangan digital individu dengan kemampuan pengguna untuk mencatat, mengintegrasikan, memahami, dan memanfaatkan informasi keuangannya secara efektif. Rezekify diarahkan untuk menjembatani kesenjangan tersebut melalui integrasi pengelolaan data keuangan dan teknologi AI sehingga data transaksi tidak berhenti sebagai catatan, tetapi dapat diolah menjadi informasi yang membantu pengguna memahami dan merencanakan kondisi keuangannya.

### 2.2 Informasi Pendukung (Data & Fakta)
Perkembangan aktivitas keuangan digital menjadi salah satu fakta yang mendasari meningkatnya kebutuhan terhadap pengelolaan informasi transaksi secara lebih terstruktur. Bank Indonesia melaporkan bahwa volume transaksi pembayaran digital pada Agustus 2026 mencapai 6,11 miliar transaksi atau tumbuh sebesar 40,36% secara tahunan (*year-on-year*). Pada periode yang sama, volume transaksi melalui *mobile banking* tumbuh 47,08%, transaksi melalui *internet banking* tumbuh 15,12%, sedangkan transaksi QRIS tumbuh 67,22%. Pertumbuhan tersebut menunjukkan bahwa kanal pembayaran digital semakin banyak digunakan dalam aktivitas ekonomi dan menghasilkan aktivitas transaksi yang perlu dikelola oleh individu. Dari perspektif sistem informasi, semakin beragam kanal transaksi juga berarti semakin beragam sumber informasi yang perlu dicatat, dikategorikan, dan dipantau apabila pengguna ingin memperoleh gambaran keuangan yang terintegrasi [1].

```
Pertumbuhan Transaksi Pembayaran Digital Indonesia — Agustus 2026:
- Pembayaran Digital : 40.36% (yoy)
- Mobile Banking     : 47.08% (yoy)
- QRIS               : 67.22% (yoy)
- Internet Banking   : 15.12% (yoy)
(Sumber: Bank Indonesia Siaran Pers No. 28/193/DKom, 23 September 2026)
```
*(Gambar 2.1 Grafik Pertumbuhan Transaksi Pembayaran Digital Indonesia Pada Bulan Agustus 2026)*

Selain pertumbuhan aktivitas transaksi, terdapat kesenjangan antara tingkat penggunaan layanan keuangan dan kemampuan literasi keuangan masyarakat. Hasil Survei Nasional Literasi dan Inklusi Keuangan (SNLIK) 2026 yang dilakukan oleh Otoritas Jasa Keuangan (OJK), Lembaga Penjamin Simpanan (LPS), dan Badan Pusat Statistik (BPS) menunjukkan bahwa indeks literasi keuangan nasional mencapai 69,57%, sedangkan indeks inklusi keuangan mencapai 93,61%. Pada kelompok usia 18–25 tahun, indeks literasi keuangan tercatat sebesar 73,32% dan indeks inklusi keuangan sebesar 95,69%. Sementara itu, kelompok usia 26–35 tahun memiliki indeks literasi sebesar 78,70% dan indeks inklusi sebesar 96,27%. Dalam SNLIK 2026, literasi keuangan diukur berdasarkan pengetahuan, keterampilan, keyakinan, sikap, dan perilaku, sedangkan inklusi keuangan mengukur penggunaan produk dan layanan jasa keuangan. Perbedaan kedua indeks tersebut menunjukkan bahwa tingkat penggunaan layanan keuangan masih lebih tinggi dibandingkan tingkat literasi, sehingga akses terhadap layanan keuangan perlu didukung dengan kemampuan memahami dan mengelola informasi keuangan [2].

```
Literasi dan Inklusi Keuangan Menurut Kelompok Umur — SNLIK 2026:
- Kelompok 15–17 tahun : Literasi 56.04% | Inklusi 89.13%
- Kelompok 18–25 tahun : Literasi 73.32% | Inklusi 95.69%
- Kelompok 26–35 tahun : Literasi 78.70% | Inklusi 96.27%
- Kelompok 36–50 tahun : Literasi 73.81% | Inklusi 94.76%
- Kelompok 51–79 tahun : Literasi 60.01% | Inklusi 90.51%
(Sumber: OJK, LPS, dan BPS, Hasil SNLIK 2026, diumumkan 11 Agustus 2026)
```
*(Gambar 2.2 Grafik Literasi dan Inklusi Keuangan Menurut Kelompok Umur Oleh SNLIK 2026)*

Permasalahan pemantauan dan dokumentasi keuangan juga didukung oleh penelitian pada mahasiswa. Fitria et al. melakukan penelitian terhadap 60 mahasiswa STMIK Mardira Indonesia mengenai pengembangan aplikasi *personal finance management*. Hasil penelitian menunjukkan bahwa 61,4% responden mengalami kesulitan untuk memantau akun keuangan secara terus-menerus, sedangkan 21,4% responden menyatakan memiliki keterbatasan waktu untuk melakukan dokumentasi keuangan. Penelitian tersebut juga menunjukkan bahwa aplikasi pengelolaan keuangan dapat membantu proses dokumentasi transaksi, pengawasan anggaran, dan peningkatan literasi keuangan. Temuan ini memberikan *evidence* bahwa aktivitas *monitoring* dan dokumentasi dapat menjadi hambatan dalam pengelolaan keuangan personal, sekaligus menunjukkan kebutuhan terhadap mekanisme pengelolaan yang dapat mengurangi beban pengguna. Karena penelitian dilakukan pada 60 mahasiswa dalam konteks satu institusi, hasil tersebut digunakan sebagai *evidence* empiris pada konteks mahasiswa dan tidak digeneralisasikan sebagai representasi seluruh mahasiswa Indonesia [3].

Kebiasaan pencatatan dan pengelolaan keuangan pada kelompok usia muda juga dapat dilihat dari survei Katadata Insight Center (KIC) dan Zigi mengenai perilaku keuangan Generasi Z dan Y. Survei tersebut dilakukan secara nasional pada 6–12 September 2021 terhadap 5.204 responden berusia di atas 15 tahun. Pada kelompok Generasi Z berusia 15–22 tahun dengan 1.692 responden, hanya 21,0% yang menyatakan selalu mengalokasikan dana untuk menabung sejak awal dan 22,4% menyatakan sering melakukannya. Sebaliknya, 40,4% menyatakan jarang dan 16,2% tidak pernah mengalokasikan dana menabung sejak awal. Dengan demikian, 56,6% responden Gen Z dalam survei tersebut berada pada kategori jarang atau tidak pernah melakukan alokasi dana tabungan sejak awal [4].

Survei yang sama menunjukkan bahwa kebiasaan pencatatan pengeluaran secara rinci juga belum dilakukan secara konsisten. Pada kelompok Generasi Z tersebut, 16,5% responden menyatakan selalu membuat catatan pengeluaran secara rinci dan 18,8% menyatakan sering melakukannya. Sementara itu, 33,1% menyatakan jarang dan 31,6% menyatakan tidak pernah. Dengan demikian, 64,7% responden berada pada kategori jarang atau tidak pernah melakukan pencatatan pengeluaran secara rinci. Temuan tersebut memberikan dasar empiris bahwa mekanisme pencatatan yang terlalu bergantung pada input manual dapat menjadi salah satu aspek yang perlu diperhatikan dalam perancangan sistem pengelolaan keuangan untuk pengguna muda. Namun, karena survei dilakukan pada tahun 2021, data tersebut digunakan sebagai konteks empiris historis dan tidak digunakan untuk menyatakan kondisi Generasi Z pada tahun 2026 [4].

```
Kebiasaan Pengelolaan Keuangan Gen Z — Survei KIC & Zigi (2021):
1. Mengalokasikan dana menabung di awal:
   - Selalu: 21.0%
   - Sering: 22.4%
   - Jarang: 40.4%
   - Tidak pernah: 16.2%
   (Total Jarang + Tidak Pernah = 56.6%)
2. Membuat catatan pengeluaran secara rinci:
   - Selalu: 16.5%
   - Sering: 18.8%
   - Jarang: 33.1%
   - Tidak pernah: 31.6%
   (Total Jarang + Tidak Pernah = 64.7%)
(Sumber: Survei KIC & Zigi 2021, n=5.204)
```
*(Gambar 2.3 Grafik Kebiasaan Pengelolaan Keuangan Gen Z Berdasarkan Survei KIC & Zigi 2021)*

Hubungan antara teknologi finansial dan perilaku keuangan juga telah diteliti pada kelompok Generasi Z. Marselien dan Valenty melakukan penelitian terhadap 166 responden Generasi Z di Jakarta dan menemukan bahwa *financial literacy*, *financial technology*, *financial attitude*, dan *financial self-efficacy* memiliki pengaruh positif dan signifikan terhadap perilaku keuangan. Hasil tersebut menunjukkan bahwa faktor teknologi dapat menjadi salah satu bagian dari ekosistem yang berhubungan dengan pengelolaan keuangan generasi muda. Temuan ini tidak berarti bahwa penggunaan suatu aplikasi secara otomatis memperbaiki perilaku keuangan pengguna, tetapi memberikan dasar bahwa teknologi dapat dimanfaatkan sebagai salah satu mekanisme pendukung dalam pengelolaan keuangan [5].

Temuan tersebut juga diperkuat oleh penelitian Sulistijono dan Khusnah terhadap 400 Generasi Z di Surabaya. Penelitian tersebut menemukan bahwa literasi keuangan memiliki pengaruh positif dan signifikan terhadap perilaku keuangan dan penggunaan teknologi finansial juga memiliki pengaruh positif dan signifikan terhadap perilaku keuangan. Selain itu, penggunaan teknologi finansial ditemukan memediasi hubungan antara literasi keuangan dan perilaku keuangan. Temuan ini relevan dengan Rezekify karena menunjukkan bahwa teknologi finansial dapat diposisikan tidak hanya sebagai media transaksi, tetapi juga sebagai bagian dari mekanisme yang mendukung pengelolaan keuangan [6].

Penelitian Nurhaliza dan Tasman terhadap 150 Generasi Z di Sumatera Barat juga menunjukkan bahwa adopsi teknologi finansial dan literasi keuangan memiliki pengaruh positif dan signifikan terhadap perilaku keuangan. Penelitian tersebut juga menemukan bahwa *financial attitude* berpengaruh positif dan signifikan terhadap perilaku keuangan serta berperan sebagai mediator dalam hubungan antara literasi keuangan dan perilaku keuangan. Hasil tersebut memperkuat kebutuhan untuk mempertimbangkan aspek teknologi sekaligus aspek pemahaman dan sikap pengguna dalam merancang sistem pengelolaan keuangan personal [7].

Selanjutnya, Setiawati dan Primadineska melakukan penelitian terhadap 110 responden Generasi Z di Indonesia dan menemukan bahwa literasi keuangan, teknologi finansial, dan gaya hidup hedonis memiliki pengaruh positif dan signifikan terhadap perilaku keuangan. Penelitian tersebut menunjukkan bahwa teknologi finansial merupakan salah satu variabel yang berkaitan dengan perilaku keuangan pada kelompok Generasi Z. Bagi Rezekify, temuan ini menjadi dasar bahwa sistem perlu memberikan informasi yang dapat membantu pengguna mengevaluasi aktivitas keuangannya, bukan hanya menyediakan fasilitas untuk mencatat transaksi [8].

Dari sisi pengembangan sistem, penelitian mengenai aplikasi *personal finance management* menunjukkan bahwa beberapa fungsi pengelolaan keuangan dapat diintegrasikan dalam satu aplikasi. Imawan et al. mengembangkan aplikasi Android untuk *young adults* di lingkungan pendidikan tinggi yang menyediakan fungsi pencatatan pemasukan, pemantauan pengeluaran, *budgeting*, penetapan tujuan finansial, proyeksi anggaran, dan notifikasi otomatis. Aplikasi tersebut dikembangkan menggunakan model Waterfall dan dievaluasi melalui pengujian *usability* terhadap 50 pengguna dengan tingkat kepuasan keseluruhan sebesar 4,6 dari 5. Hasil penelitian tersebut menunjukkan bahwa aplikasi pengelolaan keuangan dapat digunakan sebagai media terintegrasi untuk membantu pengguna tidak hanya mencatat transaksi, tetapi juga memantau dan merencanakan kondisi keuangannya [9].

Perkembangan AI kemudian membuka kemungkinan untuk meningkatkan kemampuan sistem pengelolaan keuangan personal dari sekadar pencatatan menjadi sistem yang lebih asistif. Penelitian mengenai GoalCoin menunjukkan implementasi sistem yang mengintegrasikan input manual, pemindaian struk menggunakan OCR, perintah suara melalui *automatic speech recognition*, kategorisasi pengeluaran menggunakan model bahasa, *predictive forecasting*, *user clustering*, serta *conversational financial assistant*. Pendekatan tersebut menunjukkan bahwa AI dapat digunakan pada beberapa tahap pengelolaan informasi keuangan, mulai dari proses memperoleh data transaksi hingga mengolah dan menyajikan informasi yang lebih personal kepada pengguna [10].

Dengan demikian, data dan fakta tersebut mendukung arah pengembangan Rezekify sebagai sistem yang mengintegrasikan beberapa fungsi pengelolaan keuangan dalam satu platform. Permasalahan pencatatan dan dokumentasi mendukung kebutuhan terhadap mekanisme input yang lebih praktis, termasuk input teks, suara, gambar, dan manual. Permasalahan ketersebaran informasi mendukung kebutuhan terhadap pengelolaan transaksi dan kondisi keuangan secara terpusat. Kesenjangan antara data transaksi dan pemahaman keuangan mendukung kebutuhan terhadap dashboard, kategorisasi, analisis, dan *financial insight*. Sementara itu, kebutuhan perencanaan mendukung pengembangan fungsi *budgeting*, *savings tracking*, dan *financial goals*. Pemanfaatan AI kemudian ditempatkan sebagai teknologi pendukung untuk mengurangi friksi input dan membantu proses pengolahan serta interpretasi informasi keuangan. Dengan posisi tersebut, Rezekify tidak diarahkan hanya sebagai aplikasi pencatat pengeluaran, tetapi sebagai sistem informasi yang menghubungkan proses pencatatan, pengorganisasian, pemahaman, analisis, dan perencanaan keuangan pribadi. Hubungan antara data dan fakta dengan karakteristik sistem tersebut akan menjadi dasar untuk menentukan kebutuhan sistem, tujuan proyek, alternatif solusi, dan karakteristik produk pada bagian selanjutnya.

---

# BAB III: ANALISIS UMUM

### 3.1 Aspek Ekonomi
Dari aspek ekonomi, Rezekify merupakan produk perangkat lunak *Business-to-Consumer* (B2C) yang dapat dikembangkan dan didistribusikan kepada pengguna secara langsung tanpa memerlukan produksi fisik maupun infrastruktur fisik khusus. Karakteristik tersebut memberikan fleksibilitas dalam pengembangan karena produk dapat dibangun secara bertahap sesuai prioritas kebutuhan pengguna dan kapasitas sumber daya pengembangan. Selain itu, produk digital memiliki potensi untuk melayani pengguna dalam jumlah yang lebih besar tanpa peningkatan biaya produksi fisik yang sebanding.

Kebutuhan terhadap sistem pengelolaan keuangan digital juga didukung oleh semakin tingginya aktivitas transaksi melalui kanal pembayaran digital di Indonesia. Bank Indonesia mencatat pertumbuhan yang tinggi pada transaksi pembayaran digital, termasuk *mobile banking* dan QRIS [1]. Peningkatan aktivitas tersebut menunjukkan bahwa semakin banyak aktivitas keuangan pengguna menghasilkan data digital yang perlu dikelola, dipantau, dan dipahami. Kondisi tersebut memberikan lingkungan yang relevan bagi pengembangan sistem manajemen keuangan pribadi berbasis digital seperti Rezekify.

Dari sisi biaya, komponen utama pengembangan Rezekify meliputi pengembangan perangkat lunak, hosting atau server, basis data, domain, keamanan, pemeliharaan sistem, serta penggunaan layanan eksternal apabila sistem memanfaatkan API AI, OCR, atau layanan pendukung lainnya. Pada tahap Capstone, pengendalian biaya dilakukan dengan menentukan prioritas fitur dan membatasi penggunaan layanan eksternal pada fungsi yang memberikan manfaat langsung terhadap permasalahan utama. Dengan demikian, penggunaan AI tidak dilakukan hanya untuk menambah kompleksitas produk, tetapi diarahkan terutama untuk mengurangi friksi pencatatan dan membantu pengolahan informasi transaksi.

Nilai ekonomi Rezekify bagi pengguna tidak hanya berasal dari kemampuan menyimpan transaksi, tetapi dari kemampuannya mengubah data transaksi menjadi informasi yang dapat digunakan untuk *monitoring* dan evaluasi. Integrasi antara pencatatan transaksi, pengelolaan sumber dana, *budgeting*, laporan, dan *financial insight* memberikan nilai tambah dibandingkan sistem yang hanya berfungsi sebagai buku catatan digital. Dengan adanya integrasi tersebut, pengguna dapat memperoleh gambaran kondisi keuangan dari satu sistem tanpa harus melakukan pengolahan data secara manual pada berbagai media.

### 3.2 Aspek Operasional / Manufakturabilitas
Sebagai produk perangkat lunak, manufakturabilitas Rezekify tidak dipahami sebagai kemampuan memproduksi barang secara massal, tetapi sebagai kemampuan sistem untuk dikembangkan, dioperasikan, dipelihara, diuji, dan diperluas secara terstruktur. Karakteristik tersebut memungkinkan Rezekify dibangun menggunakan pendekatan modular sehingga komponen sistem dapat dikembangkan secara bertahap sesuai prioritas dan kapasitas tim. Secara umum, arsitektur Rezekify dapat terdiri atas lapisan antarmuka pengguna, backend atau *application service*, basis data, serta layanan AI atau layanan eksternal apabila diperlukan. Pemisahan tersebut memungkinkan perubahan pada satu komponen dilakukan tanpa harus mengubah keseluruhan sistem. Sebagai contoh, fitur pencatatan transaksi dapat dikembangkan dan diuji terlebih dahulu sebelum diintegrasikan dengan OCR atau layanan AI. Proses operasional utama Rezekify dapat dirancang melalui alur:

```
[ Capture ] -> [ Understand ] -> [ Analyze ] -> [ Organize ] -> [ Explain ] -> [ Plan ] -> [ Evaluate ]
```
*(Gambar 3.1 Diagram Proses Operasional Rezekify)*

Pada tahap **Capture**, pengguna memasukkan transaksi melalui metode yang tersedia, seperti input manual atau bantuan AI melalui gambar struk maupun bahasa alami. Pada tahap **Understand**, sistem memproses informasi yang diterima dan mengekstraksi elemen transaksi yang relevan. Tahap **Organize** digunakan untuk mengategorikan dan menyimpan transaksi secara terstruktur. Selanjutnya, tahap **Analyze** mengolah data transaksi untuk menghasilkan informasi mengenai pola pemasukan, pengeluaran, anggaran, dan target keuangan. Hasil analisis kemudian dijelaskan kepada pengguna melalui tahap **Explain**, sedangkan informasi tersebut dapat digunakan untuk mendukung tahap **Plan** dan **Evaluate** dalam bentuk *budgeting*, *tracking* tujuan, serta evaluasi kondisi keuangan. Untuk proses yang melibatkan AI, Rezekify menerapkan prinsip berikut:

```
[ AI Processing ] -> [ User Review ] -> [ Correction ] -> [ Confirmation ] -> [ View ]
```
*(Gambar 3.2 Diagram Proses Rezekify yang Melibatkan AI)*

Hasil yang diberikan oleh OCR, *natural language processing*, maupun model AI tidak langsung dianggap sebagai data yang benar. Pengguna tetap memiliki kesempatan untuk memeriksa dan mengoreksi informasi sebelum data disimpan. Pendekatan ini penting karena hasil pemrosesan AI dapat mengalami kesalahan akibat kualitas gambar, struktur struk yang berbeda, bahasa transaksi, atau keterbatasan model.

Penggunaan layanan AI pihak ketiga memberikan keuntungan berupa percepatan pengembangan karena tim tidak perlu membangun seluruh model AI dari awal. Namun, pendekatan tersebut juga menimbulkan risiko berupa ketergantungan terhadap API eksternal, perubahan layanan, keterbatasan kuota, biaya pemrosesan, dan kebutuhan perlindungan data. Oleh karena itu, integrasi AI perlu dibuat melalui antarmuka yang terdefinisi dengan baik sehingga komponen AI dapat diganti atau diperbarui tanpa memengaruhi fungsi inti sistem.

Dari sisi pengembangan, fungsi inti seperti autentikasi, sumber dana, transaksi, kategori, dashboard, *budgeting*, dan laporan dapat diprioritaskan sebagai fondasi sistem. Fitur AI seperti OCR, input bahasa alami, dan *financial insight*, dapat dikembangkan sebagai lapisan tambahan setelah fungsi inti berjalan dengan baik. Pendekatan tersebut memungkinkan tim memiliki produk yang tetap dapat digunakan meskipun salah satu layanan AI mengalami gangguan.

Aspek keamanan dan privasi juga menjadi bagian penting dalam operasional Rezekify karena sistem memproses data pribadi berupa transaksi, pemasukan, pengeluaran, saldo, anggaran, target tabungan, dan informasi keuangan lainnya. Oleh karena itu, sistem perlu menerapkan autentikasi, otorisasi, validasi input, pembatasan akses, perlindungan data, serta mekanisme penanganan kesalahan. Prinsip perlindungan data perlu diperhatikan sejak tahap perancangan, bukan hanya setelah sistem selesai dikembangkan.

Berdasarkan karakteristik tersebut, Rezekify memiliki manufakturabilitas yang realistis untuk dikembangkan sebagai proyek Capstone. Sistem dapat dibangun secara modular menggunakan teknologi web dan layanan AI yang tersedia. Namun, ruang lingkup fitur perlu dikendalikan agar kemampuan AI, *forecasting*, keamanan, dan integrasi eksternal tetap dapat dikembangkan dan diuji secara memadai dalam waktu dan sumber daya proyek.

### 3.3 Aspek Keberlanjutan (Sustainability)
Keberlanjutan Rezekify tidak hanya berkaitan dengan keberlangsungan teknis sistem, tetapi juga dengan kemampuan sistem untuk memberikan manfaat secara berulang kepada pengguna, dikembangkan mengikuti kebutuhan, dan memiliki potensi untuk terus digunakan setelah periode pengembangan awal. Oleh karena itu, aspek keberlanjutan Rezekify ditinjau melalui keberlanjutan penggunaan, pengembangan teknologi, ekonomi, serta dampak sosial dan perilaku.

#### 3.3.1 Keberlanjutan Penggunaan
Rezekify dirancang sebagai sistem yang digunakan secara berulang, bukan sebagai aplikasi yang hanya digunakan untuk mencatat satu transaksi. Pengguna dapat mencatat transaksi secara rutin, memantau kondisi keuangan, mengevaluasi anggaran, memantau target tabungan, dan melihat perkembangan kondisi keuangan dari waktu ke waktu. Siklus penggunaan sistem dapat digambarkan sebagai berikut:

```
[ Mencatat ] -> [ Memantau ] -> [ Menganalisis ] -> [ Mengevaluasi ] -> [ Merencanakan ] -> [ Mencatat Kembali ]
```
*(Gambar 3.3 Diagram Siklus Penggunaan Sistem)*

Siklus tersebut memungkinkan data historis terus bertambah sehingga informasi yang diberikan sistem dapat menjadi semakin relevan dengan aktivitas keuangan pengguna. Dengan demikian, nilai guna Rezekify tidak hanya berasal dari fungsi pencatatan, tetapi juga dari penggunaan data historis sebagai dasar *monitoring* dan evaluasi.

#### 3.3.2 Keberlanjutan Pengembangan Sistem
Rezekify dirancang menggunakan pendekatan modular agar sistem dapat dikembangkan secara bertahap. Pengembangan berikutnya dapat mencakup peningkatan akurasi OCR, peningkatan kemampuan *natural language processing*, pengembangan metode *forecasting*, personalisasi *financial insight*, integrasi sumber data keuangan yang lebih luas, pengembangan aplikasi mobile, serta peningkatan mekanisme notifikasi. Meskipun demikian, pengembangan fitur baru harus tetap mempertimbangkan keamanan, privasi, transparansi, akurasi, dan kendali pengguna. Penambahan teknologi AI tidak semata-mata menjadi tujuan pengembangan, tetapi harus didasarkan pada kebutuhan yang memberikan nilai nyata bagi pengguna.

#### 3.3.3 Keberlanjutan Ekonomi
Sebagai produk perangkat lunak, Rezekify memiliki peluang untuk dikembangkan menjadi layanan digital yang berkelanjutan secara ekonomi. Model *freemium*, *subscription*, atau fitur premium dapat dipertimbangkan apabila produk dikembangkan menuju tahap komersialisasi. Pendekatan tersebut memungkinkan fungsi dasar tetap dapat digunakan oleh pengguna, sementara fungsi dengan kebutuhan komputasi atau nilai tambah yang lebih tinggi dapat dikembangkan sebagai layanan premium. Namun, model bisnis tersebut masih merupakan kemungkinan pengembangan dan bukan bagian dari asumsi bahwa Rezekify harus menghasilkan pendapatan pada tahap Capstone.

#### 3.3.4 Keberlanjutan Sosial dan Perilaku Keuangan
Rezekify memiliki keterkaitan dengan kebutuhan untuk meningkatkan kemampuan individu dalam memahami kondisi keuangannya. Data SNLIK 2026 menunjukkan bahwa tingkat inklusi keuangan masyarakat Indonesia lebih tinggi dibandingkan tingkat literasi keuangan [2]. Kondisi tersebut menunjukkan bahwa kemudahan akses terhadap layanan keuangan perlu diikuti dengan kemampuan untuk memahami dan mengelola informasi keuangan secara tepat. Rezekify dapat berperan sebagai alat bantu pada tingkat individu dengan menyediakan informasi mengenai pemasukan, pengeluaran, anggaran, tabungan, dan pola keuangan. Sistem tidak dirancang untuk mengambil alih keputusan finansial pengguna. Sebaliknya, Rezekify menyediakan informasi dan analisis yang dapat membantu pengguna melakukan evaluasi sebelum menentukan keputusan keuangannya sendiri.

#### 3.3.5 Keterkaitan dengan Sustainable Development Goals
Pengembangan Rezekify memiliki keterkaitan terutama dengan Sustainable Development Goal (SDG) 8, yakni *Decent Work and Economic Growth*, khususnya dalam konteks peningkatan kemampuan individu dalam mengelola sumber daya ekonomi dan mendukung kesejahteraan finansial. Hubungan tersebut bersifat tidak langsung karena Rezekify bukan lembaga keuangan dan tidak menyediakan layanan keuangan. Kontribusi sistem berada pada penyediaan informasi dan alat bantu yang dapat mendukung pengelolaan keuangan individu.

Rezekify juga memiliki keterkaitan pendukung dengan SDG 12, yakni *Responsible Consumption and Production*. Melalui pencatatan dan pengelompokan pengeluaran, pengguna dapat memperoleh gambaran mengenai pola konsumsi pribadinya. Informasi tersebut dapat digunakan sebagai dasar untuk mengevaluasi kebiasaan pengeluaran. Namun, Rezekify tidak mengklaim bahwa penggunaan sistem secara otomatis menghasilkan perilaku konsumsi berkelanjutan karena keputusan perubahan perilaku tetap berada pada pengguna.

---

# BAB IV: KEBUTUHAN YANG HARUS DIPENUHI

Rezekify perlu memenuhi kebutuhan utama yang berhubungan dengan pencatatan multi-modal, konsolidasi sumber dana, pemantauan batas belanja harian, penguncian dana komitmen, hingga keamanan dan keandalan infrastruktur. Pencatatan transaksi didesain praktis dan fleksibel, di mana pengguna dapat memasukkan data secara manual maupun memanfaatkan bantuan AI seperti pemindaian foto struk belanja (OCR), pesan suara (*voice note*), dan pemrosesan bahasa alami berbasis chat. Seluruh hasil ekstraksi otomatis tetap dapat diperiksa dan dikoreksi oleh pengguna sebelum disimpan.

Untuk konsolidasi informasi keuangan, sistem mengelompokkan transaksi berdasarkan sumber dana seperti rekening bank, dompet digital, dan uang tunai secara terintegrasi menggunakan prinsip pembukuan berpasangan (*double-entry*). Sistem tidak sekadar menyimpan riwayat, melainkan mengolahnya menjadi indikator *Daily Safe Runway* (sisa batas aman belanja harian) dan grafik alokasi tanpa risiko ilusi kalkulasi matematika dari LLM. Selain itu, pengelolaan dana komitmen seperti tagihan tetap dan tabungan dikendalikan melalui fitur *Vault* terkunci agar dana tersebut diisolasi dari kas bebas yang boleh dibelanjakan. Berdasarkan analisis arsitektur dan spesifikasi teknis platform, kebutuhan sistem Rezekify dibagi menjadi kebutuhan fungsional dan kebutuhan nonfungsional.

### 4.1 Kebutuhan Fungsional

#### 4.1.1 Autentikasi dan Pengelolaan Sesi Pengguna
1. Sistem dapat melakukan registrasi pengguna baru dengan menyimpan data nama lengkap, alamat email, dan kata sandi yang telah dienkripsi.
2. Sistem dapat mengautentikasi pengguna melalui proses login berbasis JSON Web Token (JWT) yang menghasilkan Access Token jangka pendek dan HttpOnly Refresh Cookie jangka panjang.
3. Sistem menyediakan fungsi logout untuk mengakhiri sesi dan menghapus token secara aman.
4. Sistem dapat menyimpan, menampilkan, dan memperbarui informasi profil pengguna seperti nama, tanggal siklus gajian, serta ambang batas runway aman.

#### 4.1.2 Pengelolaan Akun Sumber Dana
1. Sistem dapat memungkinkan pengguna menambahkan akun keuangan berdasarkan tipe tertentu, seperti rekening bank, dompet digital, uang tunai, maupun liabilitas/pinjaman.
2. Sistem menyimpan informasi nama akun, status keaktifan, dan saldo berjalan secara akurat.
3. Sistem mengaitkan setiap transaksi dengan akun keuangan tertentu dan memungkinkan pengguna mengubah data atau menonaktifkan akun.
4. Sistem dapat menampilkan riwayat serta penyaringan transaksi berdasarkan akun keuangan yang dipilih.

#### 4.1.3 Pencatatan Transaksi dan Pembukuan Berpasangan
1. Sistem dapat mencatat transaksi pemasukan, pengeluaran, dan transfer antarakun.
2. Sistem menyimpan detail transaksi meliputi tanggal, nominal, kategori, akun sumber/tujuan, keterangan, dan bukti pendukung. Setiap transaksi yang berhasil dicatat akan dimasukkan secara seimbang ke dalam jurnal pembukuan berpasangan (debit dan kredit).
3. Sistem menyediakan dan mengelola kategori transaksi pengeluaran maupun pemasukan.
4. Sistem memungkinkan pengguna mengubah atau menghapus transaksi historis menggunakan mekanisme pembalikan saldo (*reversal-and-repost*), serta menyediakan fitur pencarian dan penyaringan transaksi secara terstruktur.

#### 4.1.4 Pencatatan Bantuan AI
1. Sistem dapat menerima masukan transaksi melalui pesan teks bahasa alami dalam konteks Bahasa Indonesia informal.
2. Sistem dapat menerima berkas foto/gambar struk belanja dan melakukan ekstraksi data transaksi (vendor, total nominal, dan kategori) menggunakan Vision AI (OCR).
3. Sistem dapat menerima berkas rekaman suara (*voice note*) untuk ditranskripsi menjadi teks dan diekstrak entitas keuangannya.
4. Sebelum data disimpan ke basis data, sistem menampilkan hasil ekstraksi AI kepada pengguna untuk diperiksa, memberikan opsi koreksi manual, dan hanya menyimpan transaksi setelah pengguna memberikan konfirmasi.

#### 4.1.5 Dashboard Keuangan dan Deterministic Runway
1. Sistem dapat menampilkan ringkasan kondisi keuangan pengguna pada dashboard utama secara visual. Sistem menghitung total kas likuid, total dana terkunci, dan sisa kas bebas (*operational free cash*).
2. Sistem menghitung proyeksi batas aman belanja harian (*Daily Safe Runway*) hingga tanggal gajian berikutnya dan menampilkan status indikator kesehatan keuangan (*Healthy*, *Warning*, *Critical*).
3. Sistem menyediakan fitur simulasi pembelian untuk memproyeksikan penurunan runway sebelum pengguna melakukan keputusan pengeluaran.

#### 4.1.6 Pengelolaan Commitment Vault dan Tagihan
1. Sistem dapat memungkinkan pengguna membuat pos alokasi dana khusus (*Vault*) berupa tabungan atau tagihan tetap.
2. Sistem dapat mengunci dana Vault sehingga alokasi tersebut secara otomatis mengurangi sisa kas bebas dalam kalkulasi runway.
3. Sistem dapat menampilkan daftar peringatan tagihan mendatang (*Upcoming Bills*) dalam rentang waktu H-7 sebelum tanggal jatuh tempo, serta memungkinkan pengguna membuka atau memperbarui alokasi dana Vault.

#### 4.1.7 Integrasi Telegram Bot API
1. Sistem dapat menghasilkan kode pairing unik bersifat sementara (berlaku 15 menit) untuk menautkan akun web pengguna dengan Telegram Bot.
2. Sistem dapat menerima masukan perintah, pesan teks, foto struk, dan rekaman suara secara langsung melalui antarmuka Telegram Bot. Setelah diproses, sistem mengirimkan pesan balasan konfirmasi transaksi beserta ringkasan status runway terbaru ke obrolan Telegram pengguna.

#### 4.1.8 Pengaturan Bring Your Own Key (BYOK) AI
1. Sistem dapat memungkinkan pengguna mengonfigurasi API Key AI pribadi dari penyedia pihak ketiga seperti OpenAI, Anthropic, atau Custom Endpoint.
2. Sistem dapat melakukan pengujian koneksi (*ping test*) untuk memverifikasi keabsahan API Key sebelum digunakan.
3. Sistem menyimpan API Key pengguna dalam bentuk enkripsi terproteksi dan menggunakannya sebagai jalur pemrosesan AI utama bagi pengguna tersebut.

#### 4.1.9 Laporan dan Analisis Keuangan
1. Sistem dapat menghasilkan laporan dan grafik statistik distribusi pengeluaran berdasarkan kategori.
2. Sistem menyajikan laporan perkembangan tren keuangan berdasarkan periode.
3. Sistem menyimpan seluruh histori transaksi, catatan percakapan AI, serta log metadata secara rapi dan terstruktur untuk kebutuhan audit pengguna.

---

### 4.2 Kebutuhan Non Fungsional

#### 4.2.1 Usability, Kebutuhan Software, dan Hardware
1. Sistem dirancang agar memiliki antarmuka yang responsif, konsisten, dan mudah dipahami oleh target pengguna seperti mahasiswa dan pekerja muda. Informasi runway harian dapat diakses langsung pada halaman utama tanpa melalui alur navigasi yang kompleks.
2. Dari sisi perangkat lunak (*software*) di tingkat pengguna, sistem dapat diakses melalui browser modern (Google Chrome, Mozilla Firefox, Apple Safari, Microsoft Edge) yang mendukung HTML5 dan JavaScript, atau melalui aplikasi Telegram Messenger pada perangkat mobile maupun desktop.
3. Dari sisi perangkat keras (*hardware*) pengguna, sistem tidak memerlukan spesifikasi komputasi berat, di mana sistem dapat berjalan lancar pada perangkat smartphone atau komputer yang memiliki prosesor *dual-core*, RAM minimal 2 GB, serta layar dengan resolusi yang mendukung antarmuka responsif.

#### 4.2.2 Kebutuhan Server, Jaringan, dan Deployment Environment
1. Untuk kebutuhan lingkungan server (*server & deployment*), sistem backend dibangun berbasis Python 3.12 (FastAPI), frontend berbasis React 18 (SPA) yang disajikan via Nginx, dan basis data PostgreSQL 16.
2. Seluruh komponen server terisolasi dalam kontainer Docker Compose di atas jaringan *bridge* privat (`rezekify_net`).
3. Sistem dirancang efisien (*zero-bloat*) sehingga dapat berjalan pada server dengan spesifikasi perangkat keras minimal berupa 1 vCPU, RAM 1 GB hingga 2 GB, dan media penyimpanan SSD minimal 10 GB.
4. Dari kebutuhan jaringan (*networking*), server harus memiliki koneksi internet secara daring (minimal kecepatan 10 Mbps) serta membuka port HTTP/HTTPS (Port 80/443) untuk melayani traffic REST API dan Webhook POST dari Telegram Bot API.

#### 4.2.3 Performance dan Integritas Data
1. Sistem mampu memberikan respons pemuatan dashboard dan riwayat transaksi secara cepat dan efisien.
2. Untuk mempertahankan integritas data keuangan, kalkulasi matematika uang dilarang menggunakan tipe data *floating-point*, melainkan harus menggunakan tipe data `Decimal` dengan presisi 2 digit desimal (0.01).
3. Sistem menggunakan indeks basis data B-Tree untuk memastikan kueri agregasi transaksi dan runway beroperasi di bawah 10 ms.
4. Sistem menerapkan mekanisme *in-memory caching* (TTL 15 detik) untuk hasil perhitungan runway guna mempercepat performa dashboard serta menggunakan penguncian baris basis data (*Pessimistic Locking SELECT FOR UPDATE*) untuk mencegah masalah pengubahan saldo secara bersamaan (*race condition*).

#### 4.2.4 Security dan Privacy
1. Sistem mewajibkan autentikasi pengguna sebelum mengizinkan akses ke data keuangan pribadi, di mana pengguna hanya dapat mengakses dan mengelola data miliknya sendiri melalui isolasi kueri tingkat baris (*multi-tenant row-level isolation* `WHERE user_id = :uid`).
2. Kredensial kata sandi disimpan menggunakan enkripsi `bcrypt`.
3. Kunci API pribadi milik pengguna (BYOK) dienkripsi secara aman saat disimpan di basis data menggunakan enkripsi simetris Fernet berstandar PBKDF2 HMAC-SHA256 (600.000 iterasi).
4. Sistem memvalidasi seluruh input pengguna, menerapkan perlindungan *Server-Side Request Forgery* (SSRF) pada URL endpoint BYOK untuk mencegah akses ke IP privat/loopback, menerapkan pembatasan percobaan pairing Telegram (maksimal 5 kali gagal dalam 15 menit) untuk mencegah *brute-force*, serta memberlakukan pembatasan lalu lintas (*Rate Limiting*) berbasis Sliding Window pada endpoint sensitif.

#### 4.2.5 Reliability dan Fault Tolerance
1. Sistem dapat mempertahankan keandalan dan integritas data transaksi dalam berbagai kondisi.
2. Kegagalan atau keterlambatan respons pada layanan AI/OCR pihak ketiga tidak boleh menyebabkan hilangnya data transaksi yang telah tersimpan di basis data.
3. Sistem dilengkapi dengan mekanisme *Rotary Key Pool* untuk merotasi kunci API AI secara otomatis ketika terjadi batas penggunaan (HTTP 429), serta memiliki jalur *fallback multi-tingkat* dari Gemini 2.5 Flash ke Groq (Llama / Whisper Large V3).
4. Jika seluruh pemrosesan AI mengalami kegagalan, sistem memberikan pesan kesalahan yang jelas dan tetap mengizinkan pengguna melakukan pencatatan transaksi secara manual.

#### 4.2.6 Maintainability dan Compatibility
1. Sistem memiliki arsitektur berorientasi objek yang modular sehingga komponen *Ingestion Gateway*, *Agentic AI Engine*, dan *Deterministic Ledger Service* terpisah secara jelas dan dapat dikembangkan secara independen.
2. Sistem memiliki dokumentasi teknis yang memadai dan menggunakan skema migrasi basis data berbasis Alembic untuk mempermudah pemeliharaan.
3. Dari sisi kompatibilitas (*compatibility*), antarmuka web aplikasi dapat menyesuaikan ukuran layar berbagai perangkat (*responsive layout*) dan dapat berjalan secara konsisten di berbagai browser modern tanpa memerlukan instalasi plugin tambahan.

---

# BAB V: TUJUAN PROYEK

Tujuan utama proyek Rezekify adalah menghasilkan sistem informasi manajemen keuangan pribadi berbasis web yang memanfaatkan kecerdasan buatan secara terukur untuk membantu mahasiswa dan pekerja muda dalam mencatat, mengintegrasikan, memantau, memahami, dan mengevaluasi kondisi keuangan pribadi secara lebih praktis dan terstruktur. Rezekify tidak hanya ditujukan untuk menjadi media pencatatan transaksi, tetapi dirancang sebagai *AI-Powered Personal Financial Assistant* yang menghubungkan proses pencatatan dengan pengolahan informasi, analisis, dan perencanaan keuangan. AI ditempatkan sebagai teknologi pendukung yang membantu mengurangi usaha pengguna, terutama dalam proses input dan pengolahan transaksi, sementara pengguna tetap memiliki kendali terhadap data dan keputusan finansial yang diambil.

### 5.1 Tujuan Jangka Pendek
Tujuan jangka pendek merupakan tujuan yang diharapkan dapat dicapai selama periode pengembangan Capstone. Fokus utama pada tahap ini adalah menghasilkan *Minimum Viable Product* (MVP) yang fungsional, dapat diuji, dan mampu menyelesaikan permasalahan utama yang telah diidentifikasi. Secara khusus, tujuan jangka pendek Rezekify adalah:
1. Menghasilkan sistem manajemen keuangan pribadi berbasis web yang mengintegrasikan pencatatan transaksi, pengelolaan sumber dana, monitoring, budgeting, target keuangan, dan laporan dalam satu platform.
2. Mengurangi friksi dalam pencatatan transaksi dengan menyediakan input manual serta mekanisme pencatatan berbantuan AI, seperti pemindaian struk menggunakan OCR dan/atau pemrosesan transaksi menggunakan bahasa alami sesuai dengan ruang lingkup implementasi.
3. Menyediakan pengelolaan berbagai sumber dana sehingga pengguna dapat mencatat transaksi yang berasal dari rekening bank, dompet digital, uang tunai, atau sumber dana lainnya secara terstruktur.
4. Mengubah data transaksi menjadi informasi keuangan yang terstruktur melalui kategorisasi, perhitungan pemasukan dan pengeluaran, monitoring saldo, serta visualisasi kondisi keuangan.
5. Menyediakan fungsi pengelolaan anggaran dan target keuangan sehingga pengguna dapat menetapkan budget, memantau penggunaannya, serta mengikuti perkembangan target tabungan atau tujuan finansial.
6. Menyediakan dashboard keuangan terintegrasi yang menyajikan informasi utama mengenai pemasukan, pengeluaran, anggaran, tabungan, tagihan, dan kondisi keuangan berdasarkan periode tertentu.
7. Menghasilkan financial insight berbasis data transaksi yang membantu pengguna mengenali pola pengeluaran, kategori pengeluaran dominan, perubahan kondisi keuangan, dan informasi lain yang relevan untuk evaluasi.

### 5.2 Tujuan Jangka Panjang
Tujuan jangka panjang Rezekify merupakan arah pengembangan sistem setelah periode Capstone. Fokusnya adalah mengembangkan Rezekify dari sebuah MVP menjadi sistem manajemen keuangan pribadi yang semakin adaptif, personal, dan mampu memberikan dukungan pengambilan keputusan berdasarkan data pengguna. Secara khusus, tujuan jangka panjang Rezekify adalah:
1. Mengembangkan Rezekify menjadi personal financial assistant yang lebih adaptif, dengan kemampuan memahami pola keuangan pengguna berdasarkan histori transaksi dan preferensi yang tersedia.
2. Meningkatkan kemampuan AI dalam memahami transaksi secara multimodal, termasuk pengembangan lebih lanjut pada OCR, *natural language processing*, *voice input*, dan metode input lainnya sehingga pencatatan dapat dilakukan dengan usaha yang semakin rendah.
3. Mengembangkan financial insight yang lebih personal dan kontekstual, sehingga informasi yang diberikan sistem dapat disesuaikan dengan kondisi keuangan, pola pengeluaran, tujuan, dan kebutuhan masing-masing pengguna.
4. Mengembangkan kemampuan *forecasting* dan *financial planning* sehingga sistem dapat membantu pengguna melakukan simulasi terhadap kondisi keuangan berdasarkan data historis, target, anggaran, dan skenario tertentu.
5. Mengembangkan personalisasi rekomendasi secara bertahap dengan tetap mempertahankan prinsip transparansi, kontrol pengguna, dan pembedaan yang jelas antara informasi sistem dengan keputusan finansial pengguna.
6. Membangun ekosistem pengelolaan keuangan pribadi yang lebih terintegrasi, di mana pencatatan, monitoring, analisis, edukasi, perencanaan, dan evaluasi keuangan dapat dilakukan dalam satu sistem.

Secara keseluruhan, tujuan proyek Rezekify dapat dirangkum dalam dua tahap. Dalam jangka pendek, Rezekify berfokus pada penyelesaian masalah pencatatan dan pengelolaan informasi keuangan melalui MVP yang fungsional dan dapat diuji. Dalam jangka panjang, Rezekify diarahkan untuk berkembang menjadi personal financial assistant yang lebih adaptif, dengan kemampuan analisis serta perencanaan keuangan yang semakin kuat tanpa menghilangkan kendali pengguna terhadap keputusan finansialnya.

---

# BAB VI: SOLUSI SISTEM YANG DIUSULKAN

Berdasarkan permasalahan, kebutuhan, dan tujuan proyek yang telah dirumuskan, diperlukan alternatif solusi yang dapat dibandingkan sebelum menentukan rancangan sistem yang digunakan dalam pengembangan Rezekify. Alternatif solusi dibedakan berdasarkan tingkat otomatisasi dan pemanfaatan teknologi AI. Dua alternatif yang dipertimbangkan sebagai berikut:
1. **Rezekify Basic**, yaitu sistem manajemen keuangan berbasis *rule-based* dan dashboard analitik tanpa ketergantungan terhadap AI untuk fungsi utama.
2. **Rezekify Intelligent**, yaitu sistem manajemen keuangan yang menambahkan AI sebagai lapisan pendukung untuk mengurangi friksi pencatatan dan menghasilkan informasi yang lebih adaptif.

### 6.1 Rezekify Basic
Rezekify Basic merupakan alternatif sistem manajemen keuangan pribadi berbasis web yang berfokus pada fungsi inti pengelolaan transaksi dan analisis berbasis aturan. Pengguna melakukan pencatatan transaksi secara manual, kemudian sistem mengelompokkan, menghitung, dan menyajikan informasi keuangan berdasarkan data yang telah dimasukkan. Sistem dapat menyediakan pengelolaan sumber dana, transaksi, kategori, dashboard, budgeting, target tabungan, reminder tagihan, laporan, dan rule-based analysis. Analisis dilakukan berdasarkan aturan yang telah ditentukan sebelumnya sehingga perilaku sistem relatif mudah diprediksi dan dijelaskan kepada pengguna.

#### 6.1.1 Desain Alur Kerja
Secara operasional, pengguna memasukkan informasi transaksi seperti jenis transaksi, nominal, tanggal, kategori, dan sumber dana. Sistem melakukan validasi terhadap data tersebut sebelum menyimpannya ke database. Data yang telah tersimpan kemudian digunakan untuk menghitung pemasukan, pengeluaran, saldo, penggunaan anggaran, dan perkembangan target keuangan. Selanjutnya, sistem menerapkan aturan yang telah ditentukan untuk menghasilkan status atau peringatan. Contohnya, sistem dapat memberikan peringatan apabila penggunaan anggaran telah mencapai batas tertentu atau menampilkan informasi ketika pengeluaran pada suatu kategori meningkat dibandingkan periode sebelumnya.

```
Pengguna
   ↓
Input transaksi manual
   ↓
Validasi data
   ↓
Kategorisasi transaksi
   ↓
Penyimpanan database
   ↓
Perhitungan keuangan
   ↓
Rule-based analysis
   ↓
Dashboard dan laporan
   ↓
Monitoring dan evaluasi pengguna
```
*(Gambar 6.1 Diagram Alur Kerja Rezekify Basic)*

#### 6.1.2 Kelebihan
- Arsitektur lebih sederhana, karena fungsi utama tidak bergantung pada layanan AI eksternal.
- Lebih mudah dikembangkan dan diuji dalam periode Capstone.
- Hasil *rule-based* lebih mudah dijelaskan, karena setiap output dapat ditelusuri kembali ke aturan yang digunakan.
- Biaya operasional lebih terkontrol, karena penggunaan API AI dapat diminimalkan.
- Risiko privasi akibat pengiriman data ke layanan AI eksternal lebih rendah.
- Dapat menjadi fondasi sistem sebelum fitur AI dikembangkan pada tahap selanjutnya.

#### 6.1.3 Kekurangan
- Beban input pengguna masih tinggi, karena sebagian besar transaksi harus dimasukkan secara manual.
- Alternatif ini belum secara optimal mengatasi masalah friksi pencatatan yang menjadi salah satu masalah utama pada Bab II.
- Insight yang dihasilkan bergantung pada aturan yang telah ditentukan oleh pengembang.
- Kemampuan sistem dalam memahami pola keuangan pengguna relatif terbatas.
- Sistem tidak dapat melakukan ekstraksi otomatis dari struk tanpa penambahan modul OCR.
- Pengembangan aturan yang semakin kompleks dapat meningkatkan beban pemeliharaan sistem.

---

### 6.2 Rezekify Intelligent
Rezekify Intelligent merupakan pengembangan dari konsep Rezekify Basic dengan menambahkan AI sebagai *assistive technology* pada proses yang memberikan manfaat langsung terhadap pengguna. AI tidak menggantikan fungsi inti sistem, tetapi membantu mengurangi usaha pencatatan dan mengolah data menjadi informasi yang lebih bermakna. Pada alternatif ini, pengguna tetap dapat melakukan input manual, tetapi dapat memperoleh bantuan melalui pemindaian struk, pemrosesan bahasa alami, atau metode input berbantuan AI sesuai ruang lingkup implementasi. AI juga dapat digunakan secara terbatas untuk kategorisasi, financial insight, dan forecasting apabila data yang tersedia memenuhi kebutuhan fungsi tersebut. Prinsip utama alternatif ini adalah bahwa AI membantu pengguna, tetapi pengguna tetap menjadi pihak yang mengonfirmasi data dan mengambil keputusan finansial.

#### 6.2.1 Desain Alur Kerja
Transaksi yang dimasukkan secara manual dapat langsung melewati tahap AI apabila tidak diperlukan pemrosesan tambahan. Untuk input berupa gambar struk, sistem mengirimkan gambar ke proses OCR/AI untuk memperoleh informasi seperti merchant, tanggal, dan nominal. Hasil tersebut kemudian dikembalikan kepada pengguna untuk diperiksa. Untuk input berbasis bahasa alami, sistem dapat mengubah informasi seperti "tadi makan siang Rp35.000 menggunakan GoPay" menjadi struktur transaksi yang terdiri atas nominal, kategori, keterangan, dan sumber dana apabila informasi tersebut tersedia. Hasil ekstraksi tetap harus melalui proses review dan konfirmasi sebelum disimpan. Setelah transaksi tersimpan, data digunakan untuk memperbarui dashboard, anggaran, target tabungan, dan laporan. Data historis juga dapat digunakan oleh komponen analitik untuk menghasilkan *financial insight* atau *forecasting*. Hasil analisis tersebut disajikan sebagai informasi pendukung, bukan sebagai keputusan finansial otomatis.

```
Pengguna
   ↓
Input transaksi manual / scan struk / natural language
   ↓
AI processing
   ↓
Ekstraksi dan kategorisasi
   ↓
User review
   ↓
Correction
   ↓
Confirmation
   ↓
Database
   ↓
Monitoring dan analytics
   ↓
Financial insight / forecasting
   ↓
Dashboard dan recommendation
   ↓
Evaluasi pengguna
```
*(Gambar 6.2 Diagram Alur Kerja Rezekify Intelligent)*

#### 6.2.2 Kelebihan
- Lebih sesuai dengan masalah utama, terutama kebutuhan untuk mengurangi friksi pencatatan.
- Menyediakan otomatisasi pencatatan melalui OCR dan pemrosesan bahasa alami.
- Dapat mengubah data transaksi menjadi *financial insight* yang lebih kontekstual.
- Memanfaatkan data historis untuk mendukung analisis dan *forecasting*.
- Tetap memberikan kontrol kepada pengguna melalui mekanisme `AI Processing -> Review -> Correction -> Confirmation`.
- Memiliki ruang pengembangan lebih luas untuk personalisasi dan fitur AI berikutnya.
- Lebih mencerminkan *positioning* Rezekify sebagai *AI-Powered Personal Financial Assistant*.

#### 6.2.3 Kekurangan
- Kompleksitas pengembangan lebih tinggi dibandingkan alternatif *rule-based*.
- Hasil OCR atau AI dapat mengalami kesalahan sehingga membutuhkan mekanisme validasi pengguna.
- Kualitas *forecasting* bergantung pada jumlah, kelengkapan, dan kualitas data historis.
- Penggunaan layanan AI eksternal dapat menimbulkan biaya operasional dan ketergantungan terhadap pihak ketiga.
- Data yang diproses melalui layanan eksternal memerlukan perhatian lebih besar terhadap keamanan dan privasi.
- Integrasi beberapa komponen AI dapat meningkatkan kebutuhan pengujian dan pemeliharaan.
- Fitur AI yang terlalu luas dapat meningkatkan risiko *scope creep* apabila tidak dibatasi pada kebutuhan utama.

---

# BAB VII: KARAKTERISTIK PRODUK

Rezekify merupakan sistem informasi manajemen keuangan pribadi berbasis web dan AI yang ditujukan terutama bagi mahasiswa dan pekerja muda. Sistem mengintegrasikan proses mencatat, mengelola, memantau, memahami, dan mengevaluasi kondisi keuangan pribadi dalam satu platform. AI digunakan sebagai teknologi pendukung pada proses yang memberikan nilai tambah bagi pengguna, seperti ekstraksi informasi transaksi dari struk, analisis pola keuangan, dan prediksi berdasarkan data historis yang tersedia. Pengguna tetap memiliki kendali terhadap data dan keputusan keuangannya. Pembagian karakteristik produk ke dalam fitur utama, fitur dasar, dan fitur tambahan digunakan untuk menentukan prioritas pengembangan serta menjaga agar ruang lingkup sistem tetap sesuai dengan kapasitas pengerjaan Capstone selama maksimal 16 minggu. Pembagian tersebut juga membantu membedakan fungsi yang secara langsung menyelesaikan permasalahan utama dengan fungsi yang mendukung operasional sistem maupun fungsi yang dapat dikembangkan lebih lanjut.

### 7.1 Fitur Utama
Fitur utama merupakan fitur yang secara langsung merepresentasikan solusi terhadap permasalahan utama Rezekify, yaitu kebutuhan untuk melakukan pencatatan keuangan secara praktis serta mengubah data transaksi menjadi informasi yang dapat digunakan untuk memahami dan mengevaluasi kondisi keuangan. Fitur-fitur ini menjadi prioritas utama dalam pengembangan karena keberadaannya berkaitan langsung dengan nilai utama produk dan tujuan yang telah ditetapkan sebagaimana dijelaskan pada Tabel 7.2.

#### Tabel 7.2: Fitur Utama Rezekify
| No. | Fitur Utama | Deskripsi |
| :-: | :--- | :--- |
| 1 | Pencatatan Transaksi | Memungkinkan pengguna mencatat pemasukan dan pengeluaran secara manual dengan informasi seperti nominal, tanggal, kategori, sumber dana, dan catatan. |
| 2 | Scan Struk Berbasis OCR/AI | Memungkinkan pengguna mengunggah atau mengambil gambar struk. Sistem menggunakan OCR/AI untuk mengekstraksi informasi seperti nama merchant, tanggal, nominal, dan informasi transaksi yang tersedia, kemudian mengubahnya menjadi rancangan data transaksi terstruktur. |
| 3 | Dashboard Keuangan Terintegrasi | Menampilkan ringkasan pemasukan, pengeluaran, saldo, penggunaan anggaran, tagihan, perkembangan tabungan, serta indikator kondisi keuangan dalam satu tampilan. |
| 4 | Monitoring Pemasukan dan Pengeluaran | Menampilkan perkembangan pemasukan dan pengeluaran berdasarkan periode tertentu serta membantu pengguna melihat distribusi dan perubahan pola pengeluaran. |
| 5 | Manajemen Anggaran | Memungkinkan pengguna menetapkan anggaran berdasarkan kategori dan periode tertentu serta memantau penggunaan dan sisa anggaran. |
| 6 | Monitoring Tabungan | Memungkinkan pengguna membuat target tabungan, menentukan nominal target dan target waktu, serta memantau perkembangan pencapaian target. |
| 7 | Analisis Keuangan Berbasis AI | Menganalisis data keuangan historis untuk menemukan pola pemasukan dan pengeluaran serta memberikan prediksi mengenai kondisi keuangan pada periode mendatang. |
| 8 | Financial Insight | Menghasilkan informasi atau insight berdasarkan hubungan antara pemasukan, pengeluaran, anggaran, tabungan, dan pola transaksi sehingga pengguna dapat melakukan evaluasi. |
| 9 | Kustomisasi AI | Memungkinkan pengguna mengkustomisasi model AI pada layanan yang digunakan. |

Pada fitur scan struk berbasis OCR/AI, hasil ekstraksi tidak langsung disimpan sebagai transaksi final. Sistem terlebih dahulu menampilkan hasil pembacaan kepada pengguna untuk diperiksa dan dikoreksi apabila terdapat kesalahan, kemudian transaksi baru disimpan setelah pengguna memberikan konfirmasi. Pendekatan ini digunakan karena hasil OCR atau AI dapat mengandung kesalahan dalam membaca informasi pada gambar.

Pada fitur analisis dan prediksi, Rezekify membedakan antara data aktual dan hasil estimasi atau prediksi. Data aktual berasal dari transaksi dan informasi yang dimasukkan atau dikonfirmasi pengguna, sedangkan prediksi merupakan hasil pengolahan data historis yang memiliki tingkat ketidakpastian. Oleh karena itu, hasil analisis dan prediksi diposisikan sebagai informasi pendukung dan bukan sebagai keputusan otomatis mengenai kondisi finansial pengguna.

### 7.2 Fitur Dasar
Fitur dasar merupakan fitur pendukung yang diperlukan agar fitur utama dapat digunakan secara utuh. Fitur ini membentuk fondasi operasional Rezekify, terutama dalam pengelolaan akun, data keuangan, sumber dana, kategori, dan akses terhadap informasi sebagaimana dijelaskan pada Tabel 7.3. Meskipun tidak seluruh fitur dasar secara langsung menjadi pembeda utama Rezekify, fitur tersebut tetap diperlukan agar sistem dapat berjalan sebagai sistem informasi manajemen keuangan yang terintegrasi.

#### Tabel 7.3: Fitur Dasar Rezekify
| No. | Fitur Dasar | Deskripsi |
| :-: | :--- | :--- |
| 1 | Registrasi dan Login | Memungkinkan pengguna membuat akun dan mengakses sistem secara personal. |
| 2 | Manajemen Profil | Memungkinkan pengguna melihat dan memperbarui informasi profil yang diperlukan oleh sistem. |
| 3 | Manajemen Sumber Dana | Memungkinkan pengguna mencatat sumber dana seperti rekening bank, e-wallet, maupun uang tunai. |
| 4 | Manajemen Data Transaksi | Memungkinkan pengguna melihat riwayat transaksi serta melakukan perubahan atau penghapusan data transaksi. |
| 5 | Kategori Transaksi | Menyediakan kategori pemasukan dan pengeluaran serta memungkinkan pengelompokan transaksi berdasarkan kategori. |
| 6 | Pencarian dan Filter Transaksi | Memudahkan pengguna menemukan transaksi tertentu berdasarkan periode, kategori, atau informasi terkait. |
| 7 | Riwayat Anggaran | Menyimpan informasi mengenai perkembangan anggaran. |
| 8 | Status Tagihan | Menunjukkan tagihan yang akan datang, telah dibayar, atau belum diselesaikan. |
| 9 | Laporan Keuangan | Menyajikan rangkuman pemasukan dan pengeluaran berdasarkan periode tertentu dalam bentuk tabel maupun visualisasi. |
| 10 | Keamanan dan Privasi Akun | Menyediakan mekanisme perlindungan terhadap akun dan data keuangan pribadi pengguna. |

Fitur dasar tersebut menjadi fondasi yang menghubungkan berbagai fitur utama Rezekify. Sebagai contoh, fitur dashboard membutuhkan data transaksi, sumber dana, anggaran, tabungan, dan tagihan yang dikelola melalui fitur dasar. Demikian pula, proses analisis dan *financial insight* membutuhkan data transaksi yang telah tersimpan dan dikategorikan secara terstruktur. Dengan demikian, fitur dasar tidak dipandang sebagai fitur yang berdiri sendiri, tetapi sebagai komponen yang memungkinkan proses pengelolaan informasi keuangan berlangsung secara konsisten dan dapat digunakan oleh fitur utama.

### 7.3 Fitur Tambahan
Fitur tambahan merupakan fitur yang dapat meningkatkan nilai guna dan fleksibilitas Rezekify tetapi tidak menjadi ketergantungan utama terhadap fungsi inti sistem. Fitur dalam kelompok ini dapat dikembangkan setelah fitur utama dan fitur dasar selesai atau ditempatkan sebagai pengembangan lanjutan apabila waktu, sumber daya, dan hasil evaluasi pengguna memungkinkan. Fitur-fitur tersebut dijelaskan pada Tabel 7.4.

#### Tabel 7.4: Fitur Tambahan Rezekify
| No. | Fitur Tambahan | Deskripsi |
| :-: | :--- | :--- |
| 1 | Ekspor Laporan | Memungkinkan pengguna mengunduh laporan keuangan dalam format tertentu untuk keperluan dokumentasi pribadi. |
| 2 | Insight yang Lebih Personal | Pengembangan insight yang lebih kontekstual berdasarkan kebiasaan dan riwayat transaksi pengguna. |
| 3 | Notifikasi Pengingat yang Lebih Fleksibel | Pengaturan waktu dan jenis notifikasi sesuai preferensi pengguna. |
| 4 | Notifikasi Tagihan | Notifikasi tagihan, nominal, tanggal jatuh tempo, dan status pembayaran serta memberikan pengingat terhadap tagihan yang akan jatuh tempo. |
| 5 | Integrasi Telegram | Integrasi sistem dengan aplikasi Telegram. |

### 7.4 Prioritas Karakteristik Produk
Pembagian fitur menjadi tiga kelompok digunakan sebagai mekanisme pengendalian *scope* pengembangan. Fitur utama menjadi prioritas pertama karena secara langsung menyelesaikan permasalahan inti pengguna, sedangkan fitur dasar diperlukan untuk memastikan fitur utama dapat berjalan dengan baik. Fitur tambahan memiliki prioritas lebih rendah dan hanya dikembangkan apabila kapasitas waktu dan sumber daya memungkinkan setelah kebutuhan inti terpenuhi.

#### Tabel 7.5: Prioritas Karakteristik Produk
| Kelompok | Fokus | Contoh Fitur |
| :--- | :--- | :--- |
| **Fitur Utama** | Menyelesaikan permasalahan inti pengguna | Pencatatan transaksi, scan struk, dashboard, monitoring pemasukan/pengeluaran, anggaran, tabungan, analisis & prediksi, financial insight |
| **Fitur Dasar** | Mendukung operasional sistem | Login, profil, sumber dana, kategori, riwayat transaksi, pencarian/filter, laporan, keamanan |
| **Fitur Tambahan** | Meningkatkan nilai guna dan pengembangan lanjutan | Ekspor laporan, notifikasi fleksibel, visualisasi lanjutan, integrasi bank/e-wallet, sinkronisasi otomatis |

Prioritas pada Tabel 7.5 menunjukkan bahwa keberhasilan MVP Rezekify tidak ditentukan oleh jumlah fitur yang berhasil diimplementasikan, tetapi oleh kemampuan sistem dalam menyelesaikan permasalahan inti yang telah dirumuskan. Oleh karena itu, apabila terjadi keterbatasan waktu selama periode Capstone, pengembangan diprioritaskan pada fondasi sistem dan fitur yang relevan secara langsung. Pendekatan prioritas ini juga memberikan ruang untuk pengembangan bertahap. Setelah fitur utama dan dasar dapat digunakan secara stabil, fitur tambahan dapat dipertimbangkan berdasarkan hasil pengujian, feedback pengguna, kebutuhan teknis, dan sisa kapasitas pengembangan.

---

# BAB VIII: SKENARIO PENGGUNAAN DAN STAKEHOLDERS

Identifikasi stakeholder dilakukan untuk membedakan pihak yang menggunakan sistem secara langsung dengan pihak yang mendukung pengembangan dan operasional sistem, termasuk layanan eksternal yang menjadi dependensi teknologi. Skenario penggunaan kemudian menggambarkan interaksi utama antara pengguna dan sistem, mulai dari pengelolaan akun, pencatatan transaksi, monitoring, penganggaran, hingga analisis dan evaluasi kondisi keuangan. Pembahasan ini juga digunakan untuk memperjelas batas interaksi sistem sehingga ruang lingkup Rezekify tetap realistis untuk dikembangkan dalam periode Capstone.

### 8.1 Identifikasi Stakeholders
Sebagai produk B2C yang ditujukan langsung kepada individu, Rezekify menempatkan pengguna sebagai *primary stakeholder* sekaligus aktor utama sistem. Namun, keberlangsungan sistem tidak hanya melibatkan pengguna, tetapi juga pihak internal yang mengembangkan dan mengelola sistem serta pihak eksternal yang menyediakan infrastruktur dan layanan pendukung. Oleh karena itu, stakeholder Rezekify diklasifikasikan pada Tabel 8.1 berdasarkan tingkat keterlibatan dan hubungan mereka terhadap sistem.

#### Tabel 8.1: Identifikasi Stakeholder
| No. | Stakeholder | Peran | Kepentingan terhadap Sistem |
| :-: | :--- | :--- | :--- |
| 1 | Pengguna / Individu | *Primary stakeholder* dan pengguna utama sistem | Mencatat, mengelola, memantau, menganalisis, dan mengevaluasi kondisi keuangan pribadi |
| 2 | AI Service Provider | *External system / service* | Menyediakan layanan AI yang digunakan untuk OCR/ekstraksi informasi struk serta fungsi analisis dan prediksi sesuai rancangan sistem |
| 3 | Tim Pengembang | Merancang, membangun, menguji, dan mengembangkan sistem | Memastikan sistem memenuhi kebutuhan, requirement, dan tujuan proyek |

#### 8.1.1 Pengguna / Individu
Pengguna merupakan *primary stakeholder* sekaligus aktor utama Rezekify. Target pengguna adalah mahasiswa dan pekerja muda yang melakukan transaksi keuangan secara rutin dan membutuhkan media untuk mengelola informasi keuangan pribadi secara lebih terstruktur. Pengguna dapat melakukan aktivitas sebagai berikut:
- Membuat dan mengelola akun;
- Mencatat pemasukan dan pengeluaran;
- Mengelola sumber dana;
- Melakukan scan struk;
- Memeriksa hasil ekstraksi transaksi;
- Memantau pemasukan dan pengeluaran;
- Membuat dan memantau anggaran;
- Membuat target tabungan;
- Mencatat dan memantau tagihan;
- Melihat dashboard keuangan;
- Melihat laporan dan riwayat transaksi;
- Memperoleh analisis dan prediksi kondisi keuangan;
- Memperoleh financial insight;
- Menggunakan informasi tersebut untuk melakukan evaluasi dan mengambil keputusan keuangan secara mandiri;
- Mengonfigurasi model AI pribadi;
- Mengintegrasikan sistem dengan aplikasi Telegram.

Pengguna tetap menjadi pihak yang memiliki kendali terhadap data dan keputusan keuangannya. Dengan demikian, Rezekify berfungsi sebagai alat bantu pengelolaan dan pemahaman informasi keuangan, bukan sebagai pihak yang mengambil keputusan keuangan atas nama pengguna.

#### 8.1.2 AI Service Provider
AI Service Provider merupakan *external stakeholder* sekaligus *external system* yang mendukung fungsi kecerdasan buatan Rezekify. Layanan ini dapat digunakan untuk OCR atau ekstraksi informasi dari gambar struk serta fungsi AI lain yang ditetapkan dalam rancangan sistem. Keterlibatan AI Service Provider menciptakan dependensi eksternal sehingga sistem perlu mempertimbangkan ketersediaan layanan, biaya penggunaan, batas penggunaan API, perubahan layanan, keamanan data, dan konsistensi hasil pemrosesan. Hasil pemrosesan AI tidak langsung diposisikan sebagai kebenaran final, terutama pada proses ekstraksi transaksi. Hasil tersebut memerlukan validasi oleh sistem dan konfirmasi oleh pengguna sebelum disimpan sebagai data transaksi final.

#### 8.1.3 Tim Pengembang
Tim pengembang merupakan stakeholder internal yang bertanggung jawab terhadap perancangan dan implementasi Rezekify. Tim ini melakukan analisis kebutuhan, perancangan arsitektur, pengembangan antarmuka dan backend, integrasi database serta layanan AI, pengujian, dan evaluasi sistem. Kepentingan utama tim pengembang adalah menghasilkan sistem yang memenuhi kebutuhan pengguna dan requirement yang telah ditentukan dengan tetap mempertahankan kualitas, keamanan, maintainability, dan batasan scope Capstone. Tim pengembang juga bertanggung jawab mengendalikan penggunaan AI agar tidak menimbulkan kompleksitas yang tidak diperlukan dalam pengembangan.

---

### 8.2 Skenario Penggunaan Sistem

#### 8.2.1 UC-01: Registrasi dan Pengaturan Akun
| Atribut | Keterangan |
| :--- | :--- |
| **Kode Use Case** | UC-01 |
| **Nama Use Case** | Registrasi dan Login Pengguna |
| **Aktor** | End user |
| **Deskripsi** | Memungkinkan user mendaftarkan akun baru serta melakukan autentikasi masuk untuk mendapatkan token akses yang aman. |
| **Prasyarat** | User terhubung ke jaringan internet dan mengakses halaman web SPA. |
| **Kondisi Akhir** | User terautentikasi dan menerima JWT Access Token serta HttpOnly Refresh Token Cookie. |

**Alur Kejadian Normal:**
1. Aktor membuka halaman login/register.
2. Sistem menampilkan formulir autentikasi.
3. Aktor memasukkan kredensial (nama, email, password) dan menekan tombol "Masuk" / "Daftar".
4. Sistem memeriksa format data dan kecocokan email/password.
5. Sistem membuat entitas user baru apabila registrasi atau memverifikasi identitas.
6. Sistem menerbitkan JWT Access Token (masa berlaku 30 menit) dan HttpOnly Cookie (7 hari).
7. Sistem menampilkan halaman utama Dashboard.

**Alur Kejadian Alternatif:**
- **[E1] Kredensial salah atau email sudah terdaftar:**
  1. Sistem menghentikan proses autentikasi.
  2. Sistem menampilkan pesan error: *"Email atau password salah"* / *"Email sudah terdaftar"*.

---

#### 8.2.2 UC-02: Catat Transaksi Teks (AI Chat)
| Atribut | Keterangan |
| :--- | :--- |
| **Kode Use Case** | UC-02 |
| **Nama Use Case** | Catat Transaksi Teks (AI Chat) |
| **Aktor** | End User |
| **Deskripsi** | Memungkinkan user mencatat transaksi keuangan baik pengeluaran, pemasukan, atau transfer menggunakan kalimat bahasa Indonesia informal. |
| **Prasyarat** | 1. User telah login ke platform.<br>2. User memiliki minimal 1 akun keuangan aktif (misalnya: BCA, GoPay). |
| **Kondisi Akhir** | 1. Transaksi tercatat di jurnal double-entry.<br>2. Saldo akun dimutasi secara atomik.<br>3. Status runway keuangan diperbarui. |

**Alur Kejadian Normal:**
1. Aktor mengakses antarmuka AI Chat.
2. Sistem menampilkan riwayat percakapan dan status runway.
3. Aktor memasukkan teks transaksi, contoh: *"makan siang 25rb gopay"*.
4. Aktor menekan tombol "Kirim".
5. Sistem memeriksa batas *rate limit* permintaan user.
6. Sistem meneruskan teks ke AI Engine untuk ekstraksi entitas JSON.
7. Sistem menerima JSON entitas (`action: expense, Amount: 25000, Account: GoPay`).
8. Sistem memverifikasi ketersediaan akun dan melakukan penguncian baris (*Pessimistic Lock*).
9. Sistem mengubah saldo akun dan membuat catatan jurnal debit dan kredit.
10. Sistem menghitung ulang analisis runway keuangan harian.
11. Sistem menampilkan pesan respons konfirmasi transaksi beserta statistik runway.

**Alur Kejadian Alternatif:**
- **[A1] Nama akun tidak ditemukan:**
  1. Sistem mengidentifikasi teks tidak menyebutkan nama akun spesifik.
  2. Sistem memilih akun aktif pengguna dengan saldo terbesar sebagai *default*.
  3. Lanjut ke langkah 8 alur normal.
- **[E1] Pesan tidak memuat nominal valid:**
  1. AI Engine mengembalikan `action: unknown`.
  2. Sistem membatalkan pencatatan saldo.
  3. Sistem menampilkan pesan: *"Rincian transaksi tidak dipahami. Silakan ulangi."*

---

#### 8.2.3 UC-03: Catat Transaksi Struk (Vision OCR)
| Atribut | Keterangan |
| :--- | :--- |
| **Kode Use Case** | UC-03 |
| **Nama Use Case** | Catat Transaksi Struk (Vision OCR) |
| **Aktor** | End user |
| **Deskripsi** | Memungkinkan user mengunggah gambar atau foto nota maupun struk belanja untuk dikonversi menjadi data transaksi otomatis. |
| **Prasyarat** | 1. User terautentikasi dalam sistem.<br>2. Berkas berupa gambar (JPEG/PNG/WebP) dengan ukuran $\le 10\text{ MB}$. |
| **Kondisi Akhir** | Total belanjaan dan vendor dari struk terekstrak serta transaksi berhasil dicatat. |

**Alur Kejadian Normal:**
1. Aktor memilih opsi unggah foto/struk pada halaman chat.
2. Aktor memilih berkas gambar struk belanja dan menekan tombol "Unggah".
3. Sistem memeriksa tipe MIME dan *magic bytes header* gambar.
4. Sistem mengirimkan gambar ke Vision AI Engine.
5. AI mengekstrak nama merchant, total nominal, serta kategori pengeluaran.
6. Sistem mengubah saldo akun terkait dan mencatat jurnal pembukuan.
7. Sistem menampilkan respons konfirmasi beserta ringkasan hasil bacaan OCR struk.

**Alur Kejadian Alternatif:**
- **[E1] Ukuran berkas melebihi batas / header corrupt:**
  1. Sistem menghentikan pemrosesan gambar.
  2. Sistem menampilkan pesan error: *"Format file tidak didukung atau ukuran file melebihi 10MB."*

---

#### 8.2.4 UC-04: Catat Transaksi Suara (Voice Note)
| Atribut | Keterangan |
| :--- | :--- |
| **Kode Use Case** | UC-04 |
| **Nama Use Case** | Catat Transaksi Suara (Voice Note) |
| **Aktor** | End user, Telegram Bot API |
| **Deskripsi** | Memungkinkan user mengirim pesan suara (*voice note*) melalui Telegram untuk dicatat secara otomatis. |
| **Prasyarat** | 1. Akun Telegram user terhubung (*paired*) dengan akun Rezekify.<br>2. Berkas audio $\le 10\text{ MB}$. |
| **Kondisi Akhir** | Suara berhasil ditranskripsi, entitas terekstrak, dan pembukuan diperbarui. |

**Alur Kejadian Normal:**
1. Aktor merekam dan mengirim pesan suara ke Telegram Bot.
2. Telegram Bot API meneruskan *payload webhook* ke sistem Rezekify.
3. Sistem memeriksa duplikasi pesan (*deduplication check* via `update_id`).
4. Sistem mengunduh berkas audio (`.ogg`) dari server Telegram.
5. Sistem mengirimkan audio ke Native Audio AI Engine untuk transkripsi dan ekstraksi simultan.
6. Sistem melakukan mutasi saldo akun dan mencatat transaksi *double-entry*.
7. Sistem mengirimkan pesan balasan ke Telegram berisi hasil transkripsi dan status transaksi.

**Alur Kejadian Alternatif:**
- **[A1] Gemini error / rate limit (Fallback 2-Hop):**
  1. Sistem mengalihkan berkas ke Groq Whisper Large V3 untuk transkripsi teks.
  2. Teks transkripsi dikirim ke Groq Llama 4 Scout untuk ekstraksi entitas JSON.
  3. Sistem melanjutkan proses ke langkah 6 Alur Normal.
- **[E1] Suara tidak terdengar jelas:**
  1. AI mengembalikan hasil transkripsi kosong.
  2. Sistem membatalkan pencatatan.
  3. Sistem menampilkan balasan: *"Suara tidak terdengar jelas. Silakan ulangi rekaman suara Anda."*

---

#### 8.2.5 UC-05: Cek Status dan Simulasi Runway
| Atribut | Keterangan |
| :--- | :--- |
| **Kode Use Case** | UC-05 |
| **Nama Use Case** | Cek Status & Simulasi Runway |
| **Aktor** | End user |
| **Deskripsi** | Menghitung sisa kas bebas (*operational free cash*), proyeksi batas belanja harian aman, serta simulasi dampak belanja. |
| **Prasyarat** | User terautentikasi dan memiliki profil keuangan terkonfigurasi. |
| **Kondisi Akhir** | Laporan analisis runway dan indikator kesehatan keuangan ditampilkan. |

**Alur Kejadian Normal:**
1. Aktor mengakses Dashboard Summary atau mengetik *"cek runway"*.
2. Sistem memeriksa ketersediaan cache runway lokal ($< 15\text{ detik}$).
3. Sistem menghitung total kas likuid (CASH, BANK, EWALLET).
4. Sistem menghitung total dana terkunci di seluruh Commitment Vault.
5. Sistem menghitung kas bebas:
   $$\text{Free Cash} = \max(0, \text{Likuid} - \text{Vault Locked})$$
6. Sistem menghitung sisa hari menuju tanggal siklus gajian berikutnya.
7. Sistem menghitung batas harian:
   $$\text{Daily Safe} = \frac{\text{Free Cash}}{\text{Sisa Hari}}$$
8. Sistem menentukan status kesehatan (HEALTHY, WARNING, CRITICAL).
9. Sistem menampilkan statistik runway lengkap kepada user.

---

#### 8.2.6 UC-06: Kelola Akun dan Kategori Keuangan
| Atribut | Keterangan |
| :--- | :--- |
| **Kode Use Case** | UC-06 |
| **Nama Use Case** | Kelola Akun & Kategori Keuangan |
| **Aktor** | End user |
| **Deskripsi** | Memungkinkan user menambah, mengubah nama/saldo awal, atau menonaktifkan akun bank/wallet dan kategori transaksi. |
| **Prasyarat** | User terautentikasi di dalam sistem. |
| **Kondisi Akhir** | Data master akun/kategori terbarui di basis data. |

**Alur Kejadian Normal:**
1. Aktor membuka halaman pengaturan Akun dan Kategori.
2. Sistem menampilkan daftar akun dan kategori aktif milik user.
3. Aktor memilih opsi "Tambah Akun" atau "Edit Akun".
4. Aktor mengisi parameter data (nama akun, tipe: BANK/EWALLET/CASH, saldo).
5. Aktor menekan tombol "Simpan".
6. Sistem memvalidasi input dan menyimpan perubahan ke basis data.
7. Sistem menampilkan *pop-up* konfirmasi: *"Berhasil diperbarui"*.

---

#### 8.2.7 UC-07: Kelola Commitment Vault
| Atribut | Keterangan |
| :--- | :--- |
| **Kode Use Case** | UC-07 |
| **Nama Use Case** | Kelola Commitment Vault |
| **Aktor** | End user |
| **Deskripsi** | Memungkinkan user mengalokasikan dan mengunci dana khusus (*fixed bills* / tabungan) agar diisolasi dari saldo kas bebas. |
| **Prasyarat** | User terautentikasi dan memiliki kas likuid yang mencukupi. |
| **Kondisi Akhir** | Dana teralokasikan ke Vault dan memotong proyeksi kas bebas runway. |

**Alur Kejadian Normal:**
1. Aktor membuka menu "Commitment Vault".
2. Sistem menampilkan daftar vault beserta status penguncian (`is_locked`).
3. Aktor memilih tombol "Buat Vault Baru".
4. Aktor mengisi nama pos (misal: "Listrik & Air"), target nominal, dan tanggal jatuh tempo.
5. Aktor menekan tombol "Kunci Dana".
6. Sistem memperbarui status vault menjadi terkunci (`is_locked = TRUE`).
7. Sistem mengosongkan cache runway dan menghitung ulang kas bebas.
8. Sistem menampilkan konfirmasi keberhasilan pemisahan dana.

---

#### 8.2.8 UC-08: Penautan Akun Telegram (Pairing)
| Atribut | Keterangan |
| :--- | :--- |
| **Kode Use Case** | UC-08 |
| **Nama Use Case** | Penautan Akun Telegram (Pairing) |
| **Aktor** | End user, Telegram Bot API |
| **Deskripsi** | Menghubungkan identitas akun Web user dengan ID percakapan Telegram secara aman menggunakan kode pairing 6-karakter. |
| **Prasyarat** | User memiliki sesi web aktif dan akun aplikasi Telegram. |
| **Kondisi Akhir** | `telegram_chat_id` terasosiasi pada tabel profil user. |

**Alur Kejadian Normal:**
1. Aktor memilih opsi "Hubungkan Telegram" pada Pengaturan Web.
2. Sistem menghasilkan kode acak unik (contoh: `DK-W7K9M2`) yang berlaku 15 menit.
3. Sistem menampilkan kode dan tombol pintasan *deep-link* Telegram.
4. Aktor membuka Telegram Bot dan mengirimkan perintah `/link DK-W7K9M2`.
5. Telegram Bot meneruskan pesan via webhook.
6. Sistem memeriksa batas percakapan gagal (*brute-force check* $< 5\text{ kali}$).
7. Sistem memverifikasi kecocokan kode dan mengasosiasikan `telegram_chat_id`.
8. Sistem menghapus kode pairing (bersifat sekali pakai).
9. Sistem mengirimkan pesan selamat datang dan konfirmasi di Telegram.

**Alur Kejadian Alternatif:**
- **[E1] Kode kedaluwarsa / salah:**
  1. Sistem menolak proses penautan.
  2. Sistem menampilkan balasan Telegram: *"Kode pairing tidak valid atau telah kedaluwarsa."*

---

#### 8.2.9 UC-09: Konfigurasi AI dan Key (BYOK)
| Atribut | Keterangan |
| :--- | :--- |
| **Kode Use Case** | UC-09 |
| **Nama Use Case** | Konfigurasi AI & Key (BYOK) |
| **Aktor** | End user, AI Service Provider |
| **Deskripsi** | Memungkinkan user memasukkan kunci API (*API Key*) pribadi untuk pengolahan AI tanpa bergantung pada kuota bawaan sistem. |
| **Prasyarat** | User terautentikasi dan memiliki API Key dari penyedia terintegrasi. |
| **Kondisi Akhir** | API Key terenkripsi aman secara simetris (Fernet PBKDF2) di database. |

**Alur Kejadian Normal:**
1. Aktor membuka menu Pengaturan "AI dan Integrasi Key".
2. Aktor memilih penyedia AI (OpenAI / Anthropic / Gemini Custom).
3. Aktor memasukkan API Key pribadi dan menekan tombol "Uji dan Simpan".
4. Sistem melakukan *ping test* verifikasi ke endpoint API penyedia.
5. Sistem mengenkripsi string API Key menggunakan algoritma Fernet.
6. Sistem menyimpan ciphertext ke tabel `user_settings`.
7. Sistem menampilkan indikator status *Key Active*.

---

#### 8.2.10 UC-10: Kelola dan Edit Riwayat Transaksi
| Atribut | Keterangan |
| :--- | :--- |
| **Kode Use Case** | UC-10 |
| **Nama Use Case** | Kelola dan Edit Riwayat Transaksi |
| **Aktor** | End user |
| **Deskripsi** | Memungkinkan user mengubah nominal/kategori atau menghapus transaksi historis dengan mekanisme *reversal-and-repost* atomik. |
| **Prasyarat** | Transaksi yang dipilih dimiliki oleh user yang terautentikasi. |
| **Kondisi Akhir** | Transaksi terbarui, jurnal lama terhapus, dan saldo akun kembali presisi tanpa *balance drift*. |

**Alur Kejadian Normal:**
1. Aktor membuka halaman "Riwayat Transaksi".
2. Sistem menampilkan daftar transaksi historis berurutan (*chronological*).
3. Aktor memilih salah satu transaksi dan menekan tombol "Edit".
4. Aktor mengubah nominal atau akun pembayaran, lalu menekan "Simpan".
5. **Fase Reversal:** Sistem membalikkan mutasi saldo akun awal berdasarkan catatan jurnal lama.
6. **Fase Repost:** Sistem menghitung mutasi saldo akun baru dan menambahkan jurnal *double-entry* baru.
7. Sistem menghapus entitas *ledger entry* lama dan memperbarui data transaksi.
8. Sistem memperbarui perhitungan runway dan menampilkan status *"Berhasil Diperbarui"*.

---

### 8.3 Skenario Penggunaan Terintegrasi
Seluruh skenario penggunaan saling berhubungan dan membentuk alur utama Rezekify sebagaimana alur berikut:

```
Pengguna
   ↓
Mencatat transaksi
   ↓
Data tersimpan
   ↓
Monitoring
   ↓
Pengelolaan anggaran
   ↓
Analisis
   ↓
Financial insight
   ↓
Evaluasi
```
*(Gambar 8.1 Diagram Skenario Penggunaan Terintegrasi)*

Sebagai contoh, ketika pengguna melakukan transaksi pembelian, transaksi dapat dimasukkan secara manual atau melalui scan struk. Data tersebut kemudian tersimpan dalam riwayat transaksi dan memengaruhi informasi pada dashboard. Data yang sama dapat digunakan untuk menghitung penggunaan anggaran, memperbarui laporan, mengidentifikasi pola pengeluaran, serta menjadi bagian dari data historis untuk proses analisis dan prediksi. Dengan demikian, fitur Rezekify tidak berdiri secara terpisah, tetapi membentuk satu rangkaian pengelolaan informasi keuangan.

### 8.4 Hubungan Stakeholder dengan Sistem
Hubungan stakeholder dengan Rezekify menggambarkan bentuk keterlibatan masing-masing pihak terhadap fungsi, pengembangan, dan operasional sistem. Pemetaan ini digunakan untuk memperjelas perbedaan antara stakeholder yang berinteraksi langsung dengan sistem, seperti pengguna, dan stakeholder yang mendukung sistem dari sisi pengembangan, operasional, maupun layanan eksternal. Hubungan tersebut dirangkum pada Tabel 8.2.

#### Tabel 8.2: Hubungan Stakeholder dengan Sistem
| Stakeholder | Interaksi Utama | Output yang Diperoleh |
| :--- | :--- | :--- |
| **Pengguna / Individu** | Input, pengelolaan, monitoring, analisis, evaluasi | Data transaksi terstruktur, dashboard, laporan, insight, prediksi |
| **AI Service Provider** | Pemrosesan OCR/AI sesuai kebutuhan sistem | Hasil ekstraksi, analisis, atau prediksi yang dikembalikan kepada sistem |
| **Tim Pengembang** | Perancangan, implementasi, pengujian, dan pemeliharaan | Sistem yang memenuhi kebutuhan dan requirement proyek |

### 8.5 Batasan Interaksi Stakeholder
Dalam rancangan Rezekify, pengguna tetap menjadi pihak yang memiliki kendali terhadap data dan keputusan keuangannya sendiri. Sistem berperan menyediakan data, informasi, analisis, dan prediksi sebagai alat bantu, sedangkan AI tidak diposisikan sebagai pengambil keputusan keuangan pengguna. AI Service Provider dan Infrastructure Provider merupakan pihak eksternal yang mendukung fungsi teknis sistem dan tidak memiliki peran dalam menentukan keputusan keuangan pengguna. Tim pengembang dan System Administrator juga tidak memiliki akses atau kewenangan untuk mengambil keputusan atas data keuangan pengguna, melainkan bertanggung jawab terhadap aspek pengembangan dan operasional sistem sesuai batas kewenangannya. 

Dalam konteks Capstone, beberapa stakeholder eksternal seperti bank, e-wallet, atau penyedia layanan pembayaran tidak diposisikan sebagai stakeholder langsung selama Rezekify belum melakukan integrasi data secara langsung dengan layanan tersebut. Apabila pada pengembangan lanjutan dilakukan integrasi API dengan bank atau e-wallet, pihak tersebut dapat ditambahkan sebagai *external stakeholder* dan *external system*.

---

# BAB IX: KESIMPULAN DAN RINGKASAN

Rezekify merupakan sistem informasi manajemen keuangan pribadi berbasis web dan AI yang dirancang sebagai produk B2C untuk membantu mahasiswa dan pekerja muda mengelola informasi keuangan secara lebih terintegrasi. Permasalahan yang mendasari pengembangan sistem adalah kebutuhan untuk melakukan pencatatan transaksi secara praktis sekaligus mengubah data transaksi menjadi informasi yang dapat digunakan untuk memahami, memantau, dan mengevaluasi kondisi keuangan pribadi. Berdasarkan analisis permasalahan, data pendukung, serta aspek ekonomi, operasional, dan keberlanjutan, Rezekify diarahkan bukan sekadar sebagai aplikasi pencatatan transaksi, tetapi sebagai sistem yang menghubungkan proses pencatatan, pengelolaan, monitoring, analisis, dan evaluasi keuangan dalam satu platform.

Solusi yang dipilih adalah **Rezekify Intelligent**, yaitu sistem informasi keuangan personal yang mempertahankan fungsi dasar pengelolaan data keuangan dan menambahkan AI sebagai teknologi pendukung pada proses yang memberikan nilai langsung bagi pengguna. Pendekatan tersebut diwujudkan melalui pencatatan manual dan scan struk berbasis OCR/AI, dashboard terintegrasi, pengelolaan anggaran dan target tabungan, monitoring tagihan, laporan, financial insight, serta analisis dan prediksi berdasarkan data yang tersedia. Penggunaan AI tetap menerapkan validasi dan kontrol pengguna, terutama pada hasil ekstraksi transaksi, sehingga AI tidak diposisikan sebagai sumber keputusan final mengenai kondisi keuangan pengguna.

Karakteristik produk dan skenario penggunaan menunjukkan bahwa Rezekify memiliki pengguna individu sebagai primary stakeholder, dengan tim pengembang, administrator, penyedia layanan AI, penyedia infrastruktur, dan evaluator sebagai stakeholder pendukung sesuai konteks keterlibatannya. Ruang lingkup produk juga dibatasi melalui pembagian fitur utama, fitur dasar, dan fitur tambahan agar pengembangan tetap realistis dalam periode Capstone maksimal 16 minggu. Dengan batasan tersebut, Rezekify memiliki arah pengembangan yang cukup jelas: menyelesaikan permasalahan inti pengguna terlebih dahulu, kemudian memperluas kemampuan AI, integrasi, dan personalisasi apabila sumber daya dan kebutuhan pengembangan memungkinkan.

Secara keseluruhan, nilai utama Rezekify terletak pada kemampuannya menjembatani data transaksi dengan pemahaman keuangan, bukan semata-mata meningkatkan jumlah fitur pengelolaan keuangan. Sistem dirancang untuk membantu pengguna memperoleh informasi yang lebih terstruktur dan relevan, tetapi tetap menempatkan pengguna sebagai pihak yang mengevaluasi informasi dan mengambil keputusan keuangannya sendiri. Dengan pendekatan tersebut, Rezekify memiliki dasar yang cukup untuk dilanjutkan ke tahap perancangan dan implementasi dengan tetap mempertahankan prinsip keterbatasan scope, keamanan dan privasi data, transparansi hasil AI, serta keberlanjutan pengembangan sistem.

---

# DAFTAR PUSTAKA

[1] Bank Indonesia, “Tinjauan Kebijakan Moneter September 2026,” Bank Indonesia, Sep. 2026. Data transaksi pembayaran digital Agustus 2026: 6,11 miliar transaksi, pertumbuhan 40,36% yoy, mobile banking 47,08%, internet banking 15,12%, dan QRIS 67,22%.  
[2] Otoritas Jasa Keuangan, Lembaga Penjamin Simpanan, and Badan Pusat Statistik, “Siaran Pers Bersama: Indeks Literasi dan Inklusi Keuangan Masyarakat Meningkat, OJK, LPS, dan BPS Umumkan Hasil Survei Nasional Literasi dan Inklusi Keuangan (SNLIK) Tahun 2026,” Aug. 11, 2026.  
[3] D. Fitria, F. F. Mustari, A. T. Retnowaty, and R. I. Subagja, “Design of Personal Finance Management Application Based on Mobile App: Case Study of Students of STMIK Mardira Indonesia,” *Informatics Management, Engineering and Information System Journal*, vol. 3, no. 1, 2025.  
[4] Katadata Insight Center and Zigi, “Perilaku Keuangan Generasi Z dan Y,” Jan. 10, 2022. Survei dilakukan pada 6–12 September 2021 terhadap 5.204 responden di Indonesia.  
[5] L. A. Marselien and Y. A. Valenty, “The Influence of Financial Literacy, Financial Technology, Financial Attitudes, and Financial Self-Efficacy on the Financial Behavior of Generation Z,” *E-Jurnal Akuntansi*, vol. 35, no. 9, 2025. doi: `10.24843/EJA.2025.v35.i09.p12`.  
[6] N. A. Sulistijono and H. Khusnah, “The Mediating Effect of Financial Technology Usage on the Influence of Financial Literacy on the Financial Behavior of Gen Z in Surabaya,” *Business and Finance Journal*, vol. 10, no. 2, pp. 154–163, 2025. doi: `10.33086/bfj.v10i2.8107`.  
[7] S. Nurhaliza and A. Tasman, “Financial Technology Adoption, Financial Literacy, and Financial Behavior among Generation Z: The Mediation Role of Financial Attitude,” *Indonesian Journal of Digital Business*, vol. 5, no. 4, 2025.  
[8] N. T. Setiawati and R. W. Primadineska, “Financial Behavior of Generation Z in Indonesia: Impact of Literacy, Technology and Lifestyle,” *Telaah Bisnis*, vol. 26, no. 1, pp. 55–68, 2025. doi: `10.35917/tb.v26i1.596`.  
[9] R. Imawan, W. P. Putra, R. Alqahtani, E. D. Milakis, and M. Dumchykov, “Enhancing Financial Literacy in Young Adults: An Android-Based Personal Finance Management Tool,” *Journal of Hypermedia & Technology-Enhanced Learning*, vol. 3, no. 1, pp. 64–89, 2025. doi: `10.58536/j-hytel.166`.  
[10] “GoalCoin: AI-Driven Personal Budget Manager,” *2025 9th SLAAI International Conference on Artificial Intelligence (SLAAI-ICAI)*, IEEE, 2025. doi: `10.1109/SLAAI-ICAI68534.2025.11318459`.

---

# LAMPIRAN

### CV Anggota Tim
*(Daftar riwayat hidup masing-masing anggota tim pengembang Rezekify)*

---

### Diagram Use Case dan BPMN Swimlane

#### 1. UC-01: Daftar dan Login Pengguna
- **Use Case Diagram:**
  - **Aktor:** End User
  - **Use Case Utama:** Daftar dan Login Pengguna
  - **Includes:**
    - Periksa Format dan Kredensial
    - Terbitkan JWT Access Token dan Refresh Cookie
    - Tampilkan Halaman Dashboard
  - **Extends:**
    - Tampilkan Pesan Error Kredensial
- **BPMN Swimlane:**
  - **End User:** Buka halaman login/register $\rightarrow$ Masukkan nama, email, password, lalu tekan "Masuk" / "Daftar".
  - **Sistem:** Tampilkan formulir autentikasi $\rightarrow$ Periksa format data dan kecocokan email/password $\rightarrow$ **Gateway [Kredensial valid?]:**
    - *Tidak:* Hentikan proses dan tampilkan error "Email atau password salah" / "Email sudah terdaftar" $\rightarrow$ [End Event].
    - *Ya:* Buat entitas user baru (registrasi) atau verifikasi identitas (login) $\rightarrow$ Terbitkan JWT Access Token (30 menit) dan HttpOnly Cookie (7 hari) $\rightarrow$ Tampilkan halaman utama Dashboard $\rightarrow$ [End Event].

---

#### 2. UC-02: Catat Transaksi Teks (AI Chat)
- **Use Case Diagram:**
  - **Aktor:** End User, AI Engine
  - **Use Case Utama:** Catat Transaksi Teks (AI Chat)
  - **Includes:**
    - Periksa Rate Limit Permintaan
    - Ekstrak Entitas Transaksi (JSON) *(terhubung ke AI Engine)*
    - Catat Jurnal dan Ubah Saldo Akun
    - Hitung Ulang Runway Harian
  - **Extends:**
    - Gunakan Akun Default Saldo Terbesar
    - Tolak Transaksi Tidak Dipahami
- **BPMN Swimlane:**
  - **End User:** Akses antarmuka AI Chat $\rightarrow$ Masukkan teks transaksi (contoh: "makan siang 25rb gopay"), lalu tekan "Kirim".
  - **Sistem:** Tampilkan riwayat percakapan dan status runway $\rightarrow$ Periksa batas rate limit permintaan user $\rightarrow$ Teruskan teks ke AI Engine untuk ekstraksi entitas JSON.
  - **AI Engine:** Ekstrak entitas transaksi menjadi JSON `{action, amount, account}` $\rightarrow$ Kirim ke Sistem.
  - **Sistem:** Terima JSON entitas $\rightarrow$ **Gateway [Nominal dan aksi valid?]:**
    - *Tidak:* Batalkan pencatatan dan tampilkan pesan "Rincian transaksi tidak dipahami. Silakan ulangi." $\rightarrow$ [End Event].
    - *Ya:* **Gateway [Nama akun disebutkan?]:**
      - *Tidak:* Pilih akun aktif dengan saldo terbesar sebagai default $\rightarrow$ Lanjut ke verifikasi ketersediaan akun.
      - *Ya:* Lanjut ke verifikasi ketersediaan akun.
    - Verifikasi ketersediaan akun dan kunci baris (*Pessimistic Lock*) $\rightarrow$ Ubah saldo akun dan buat catatan jurnal debit dan kredit $\rightarrow$ Hitung ulang analisis runway keuangan harian $\rightarrow$ Tampilkan pesan konfirmasi transaksi beserta statistik runway $\rightarrow$ [End Event].

---

#### 3. UC-03: Catat Transaksi Struk (Vision OCR)
- **Use Case Diagram:**
  - **Aktor:** End User, Vision AI Engine
  - **Use Case Utama:** Catat Transaksi Struk (Vision OCR)
  - **Includes:**
    - Periksa Berkas Gambar (MIME dan Magic Bytes)
    - Ekstrak Merchant, Total, dan Kategori *(terhubung ke Vision AI Engine)*
    - Catat Jurnal dan Ubah Saldo Akun
  - **Extends:**
    - Tampilkan Error Format atau Ukuran Berkas
- **BPMN Swimlane:**
  - **End User:** Buka opsi unggah foto/struk pada halaman chat $\rightarrow$ Pilih berkas gambar struk belanja dan tekan tombol "Unggah".
  - **Sistem:** Periksa tipe MIME dan magic bytes header gambar $\rightarrow$ **Gateway [Format valid dan ukuran $\le 10\text{ MB}$?]:**
    - *Tidak:* Hentikan pemrosesan dan tampilkan error "Format file tidak didukung atau ukuran file melebihi 10MB." $\rightarrow$ [End Event].
    - *Ya:* Kirim gambar ke Vision AI Engine.
  - **Vision AI Engine:** Ekstrak nama merchant, total nominal, dan kategori pengeluaran $\rightarrow$ Kirim hasil ke Sistem.
  - **Sistem:** Ubah saldo akun terkait dan catat jurnal pembukuan $\rightarrow$ Tampilkan respons konfirmasi beserta ringkasan hasil bacaan OCR struk $\rightarrow$ [End Event].

---

#### 4. UC-04: Catat Transaksi Suara (Voice Note)
- **Use Case Diagram:**
  - **Aktor:** End User, Telegram Bot API, AI Engine (Gemini / Groq)
  - **Use Case Utama:** Catat Transaksi Suara (Voice Note)
  - **Includes:**
    - Cek Duplikasi Pesan (`update_id`)
    - Unduh Berkas Audio (`.ogg`)
    - Transkripsikan dan Ekstrak Entitas *(terhubung ke AI Engine)*
    - Catat Jurnal dan Ubah Saldo
    - Kirim Balasan ke Telegram *(terhubung ke Telegram Bot API)*
  - **Extends:**
    - Alihkan ke Groq Whisper dan Llama 4 Scout
    - Batalkan Pencatatan Suara Tidak Jelas
- **BPMN Swimlane:**
  - **End User:** Rekam dan kirim pesan suara ke Telegram Bot.
  - **Telegram Bot API:** Teruskan payload webhook ke sistem Rezekify.
  - **Sistem:** Periksa duplikasi pesan (`update_id`) $\rightarrow$ Unduh berkas audio (`.ogg`) dari server Telegram $\rightarrow$ Kirim ke AI Engine (Gemini).
  - **AI Engine (Gemini):** Lakukan transkripsi dan ekstraksi entitas simultan (Gemini).
  - **Sistem:** **Gateway [Gemini berhasil tanpa error / rate limit?]:**
    - *Tidak:* Alihkan berkas ke Groq Whisper Large V3 (fallback) $\rightarrow$ [AI Engine: Transkripsi audio menjadi teks (Groq Whisper Large V3) $\rightarrow$ Ekstrak entitas JSON dari teks (Groq Llama 4 Scout)] $\rightarrow$ Kembali ke Sistem.
    - *Ya:* Lanjut evaluasi hasil.
    - **Gateway [Hasil transkripsi tidak kosong?]:**
      - *Tidak:* Batalkan pencatatan dan balas "Suara tidak terdengar jelas. Silakan ulangi." $\rightarrow$ [End Event].
      - *Ya:* Lakukan mutasi saldo akun dan catat transaksi double-entry $\rightarrow$ Kirim balasan ke Telegram berisi hasil transkripsi dan status transaksi $\rightarrow$ [End Event].

---

#### 5. UC-05: Cek Status dan Simulasikan Runway
- **Use Case Diagram:**
  - **Aktor:** End User
  - **Use Case Utama:** Cek Status dan Simulasikan Runway
  - **Includes:**
    - Periksa Cache Runway
    - Hitung Total Kas Likuid
    - Hitung Dana Terkunci Commitment Vault
    - Hitung Batas Harian Aman (Daily Safe)
    - Tentukan Status Kesehatan Keuangan
- **BPMN Swimlane:**
  - **End User:** Akses Dashboard Summary atau ketik "cek runway".
  - **Sistem:** Periksa ketersediaan cache runway lokal ($< 15\text{ detik}$) $\rightarrow$ Hitung total kas likuid (CASH, BANK, EWALLET) $\rightarrow$ Hitung total dana terkunci di seluruh Commitment Vault $\rightarrow$ Hitung kas bebas: $\text{Free Cash} = \max(0, \text{Likuid} - \text{Vault Locked})$ $\rightarrow$ Hitung sisa hari menuju tanggal siklus gajian berikutnya $\rightarrow$ Hitung batas harian: $\text{Daily Safe} = \frac{\text{Free Cash}}{\text{Sisa Hari}}$ $\rightarrow$ Tentukan status kesehatan (HEALTHY, WARNING, CRITICAL) $\rightarrow$ Tampilkan statistik runway lengkap kepada user $\rightarrow$ [End Event].

---

#### 6. UC-06: Kelola Akun dan Kategori Keuangan
- **Use Case Diagram:**
  - **Aktor:** End User
  - **Use Case Utama:** Kelola Akun dan Kategori Keuangan
  - **Includes:**
    - Periksa Input Data
    - Simpan Perubahan ke Basis Data
  - **Extends:**
    - Tambah Akun / Kategori
    - Ubah Nama / Saldo Awal
    - Nonaktifkan Akun / Kategori
- **BPMN Swimlane:**
  - **End User:** Buka halaman pengaturan Akun dan Kategori $\rightarrow$ Pilih opsi "Tambah Akun" atau "Edit Akun" $\rightarrow$ Isi nama akun, tipe (BANK/EWALLET/CASH), dan saldo $\rightarrow$ Tekan tombol "Simpan".
  - **Sistem:** Tampilkan daftar akun dan kategori aktif milik user $\rightarrow$ Periksa input dan simpan perubahan ke basis data $\rightarrow$ Tampilkan pop-up konfirmasi "Berhasil diperbarui" $\rightarrow$ [End Event].

---

#### 7. UC-07: Kelola Commitment Vault
- **Use Case Diagram:**
  - **Aktor:** End User
  - **Use Case Utama:** Kelola Commitment Vault
  - **Includes:**
    - Lihat Daftar Vault dan Status Kunci
    - Buat Vault Baru
    - Kunci Dana Vault
    - Hitung Ulang Kas Bebas Runway
- **BPMN Swimlane:**
  - **End User:** Buka menu "Commitment Vault" $\rightarrow$ Pilih tombol "Buat Vault Baru" $\rightarrow$ Isi nama pos (misal: "Listrik & Air"), target nominal, dan tanggal jatuh tempo $\rightarrow$ Tekan tombol "Kunci Dana".
  - **Sistem:** Tampilkan daftar vault beserta status penguncian (`is_locked`) $\rightarrow$ Perbarui status vault menjadi terkunci (`is_locked = TRUE`) $\rightarrow$ Kosongkan cache runway dan hitung ulang kas bebas $\rightarrow$ Tampilkan konfirmasi keberhasilan pemisahan dana $\rightarrow$ [End Event].

---

#### 8. UC-08: Tautkan Akun Telegram (Pairing)
- **Use Case Diagram:**
  - **Aktor:** End User, Telegram Bot API
  - **Use Case Utama:** Tautkan Akun Telegram (Pairing)
  - **Includes:**
    - Buat Kode Pairing (Berlaku 15 Menit)
    - Periksa Kode dan Batas Brute-force
    - Kirim Konfirmasi ke Telegram *(terhubung ke Telegram Bot API)*
    - Asosiasikan `telegram_chat_id`
  - **Extends:**
    - Tolak Kode Tidak Valid / Kedaluwarsa
- **BPMN Swimlane:**
  - **End User:** Pilih opsi "Hubungkan Telegram" pada Pengaturan Web $\rightarrow$ Buka Telegram Bot dan kirim perintah `/link DK-W7K9M2`.
  - **Sistem:** Hasilkan kode acak unik (contoh: `DK-W7K9M2`) berlaku 15 menit $\rightarrow$ Tampilkan kode dan tombol pintasan deep-link Telegram.
  - **Telegram Bot API:** Teruskan pesan ke sistem via webhook.
  - **Sistem:** Periksa batas percakapan gagal (*brute-force check* $< 5\text{ kali}$) $\rightarrow$ **Gateway [Kode cocok dan belum kedaluwarsa?]:**
    - *Tidak:* Tolak penautan dan balas "Kode pairing tidak valid atau telah kedaluwarsa." $\rightarrow$ [End Event].
    - *Ya:* Asosiasikan `telegram_chat_id` dengan akun user $\rightarrow$ Hapus kode pairing (sekali pakai) $\rightarrow$ Kirim pesan selamat datang dan konfirmasi di Telegram $\rightarrow$ [End Event].

---

#### 9. UC-09: Atur AI dan Key (BYOK)
- **Use Case Diagram:**
  - **Aktor:** End User, AI Service Provider
  - **Use Case Utama:** Atur AI dan Key (BYOK)
  - **Includes:**
    - Pilih Penyedia AI
    - Uji Koneksi API Key (Ping Test) *(terhubung ke AI Service Provider)*
    - Enkripsikan API Key (Fernet)
    - Simpan Ciphertext ke `user_settings`
- **BPMN Swimlane:**
  - **End User:** Buka menu Pengaturan "AI dan Integrasi Key" $\rightarrow$ Pilih penyedia AI (OpenAI / Anthropic / Gemini Custom) $\rightarrow$ Masukkan API Key pribadi dan tekan tombol "Uji dan Simpan".
  - **Sistem:** Kirim ping test verifikasi ke endpoint API penyedia.
  - **AI Service Provider:** Terima dan respons ping test.
  - **Sistem:** Enkripsi string API Key menggunakan algoritma Fernet $\rightarrow$ Simpan ciphertext ke tabel `user_settings` $\rightarrow$ Tampilkan indikator status Key Active $\rightarrow$ [End Event].

---

#### 10. UC-10: Kelola dan Edit Riwayat Transaksi
- **Use Case Diagram:**
  - **Aktor:** End User
  - **Use Case Utama:** Kelola dan Edit Riwayat Transaksi
  - **Includes:**
    - Lihat Riwayat Transaksi
    - Edit Transaksi
    - Balikkan Mutasi Saldo Lama
    - Catat Ulang Jurnal Double-Entry Baru
    - Perbarui Perhitungan Runway
  - **Extends:**
    - Hapus Transaksi
- **BPMN Swimlane:**
  - **End User:** Buka halaman "Riwayat Transaksi" $\rightarrow$ Pilih salah satu transaksi dan tekan tombol "Edit" $\rightarrow$ Ubah nominal atau akun pembayaran, lalu tekan "Simpan".
  - **Sistem:** Tampilkan daftar transaksi historis secara kronologis $\rightarrow$ **Fase Reversal:** balikkan mutasi saldo akun awal berdasarkan jurnal lama $\rightarrow$ **Fase Repost:** hitung mutasi saldo akun baru dan tambahkan jurnal double-entry baru $\rightarrow$ Hapus ledger entry lama dan perbarui transaksi $\rightarrow$ Perbarui perhitungan runway dan tampilkan status "Berhasil Diperbarui" $\rightarrow$ [End Event].