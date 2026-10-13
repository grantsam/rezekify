# Spesifikasi Desain Arsitektur: Autonomous Cognitive Financial Copilot & Universal Faceted Ledger Engine

- **Fitur**: Autonomous Financial AI Agent, Universal Faceted Ledger Query, Multi-Turn ReAct Reasoning, Dynamic Telemetry & What-If Simulation
- **Dokumen Referensi**: Dokumen Proposal SIS1-CD1, Laporan Audit Check & Balance (13 Oktober 2026), Dokumen Desain AI Copilot Hub (29 September 2026)
- **Penulis**: Lead Systems & AI Architect, Rezekify Core Team
- **Tanggal**: 13 Oktober 2026
- **Status**: Disetujui untuk Implementasi (*Approved for Implementation*)

---

## 1. Executive Summary & Problem Context

### 1.1 Evolusi Rezekify AI: Dari Passive Entity Extractor ke Autonomous Cognitive Financial Copilot

Pada implementasi tahap awal platform Rezekify, modul kecerdasan buatan (`rezekify/agent/`) beroperasi di bawah paradigma *passive entity extractor* satu arah (*single-turn passive parser*). Modul `ReActAgent` yang ada saat ini sekadar menerima teks perintah bebas atau berkas gambar struk belanja (*receipt OCR*), lalu menggunakan prompt generatif tunggal untuk mengekstrak entitas statis berformat JSON dengan skema primitif:
```json
{
  "action": "expense" | "income" | "transfer" | "query_runway" | "unknown",
  "amount": 50000,
  "account_name": "BCA",
  "category_name": "Makanan",
  "note": "Nasi Padang"
}
```

Meskipun arsitektur tersebut memenuhi kebutuhan pencatatan dasar, pendekatan *passive single-shot extraction* memiliki keterbatasan arsitektural yang fundamental:
1. **Ketiadaan Kemampuan Investigasi Historis (*Blind Retrospective Analytics*):** Ketika pengguna mengajukan pertanyaan analitis retrospektif seperti *"Berapa total pengeluaran kopi saya bulan ini dibanding bulan lalu?"* atau *"Kategori apa yang paling boros minggu ini?"*, agen tidak memiliki mekanisme untuk memeriksa, mengagregasi, atau menyaring basis data buku besar (*ledger database*). Agen hanya merespons secara generatif tanpa landasan fakta angka aktual (*factual hallucination risk*).
2. **Ketiadaan Kesadaran Kontekstual & Proyeksi Risiko (*Lack of Situational Awareness*):** Saat pengguna bertanya *"Boleh tidak saya beli sepatu Rp 1.500.000 hari ini?"*, agen parser pasif tidak mampu memproyeksikan sisa jatah belanja harian (*daily safe runway*), mengidentifikasi tagihan mendesak dalam 7 hari ke depan (*upcoming fixed bills*), atau memperingatkan potensi defisit kas operasional.
3. **Ketiadaan Penalaran Multi-Langkah (*Absence of Multi-Turn Reasoning*):** Agen tidak dapat menjalankan rantai tindakan (*chain of actions*), seperti memverifikasi saldo akun sumber terlebih dahulu, memeriksa anggaran kategori, lalu memutuskan apakah sebuah transaksi aman dilakukan sebelum mengeksekusi mutasi.

Spesifikasi desain ini mendefinisikan transformasi arsitektur Rezekify AI dari sekadar parser transaksi pasif menjadi **Autonomous Cognitive Financial Copilot**. Agen baru ini dibekali otonomi untuk:
- Memilih dan mengeksekusi alat komputasi deterministik (*tool calling*) secara mandiri.
- Menggali data historis multi-dimensi secara aman melalui *Universal Faceted Ledger Query*.
- Melakukan diagnosis ketahanan kas dan simulasi keputusan pengeluaran (*what-if purchase simulation*).
- Menyajikan bimbingan finansial perilaku (*behavioral nudge*) yang didasarkan pada data faktual buku besar tanpa pernah mengorbankan integritas matematika keuangan.

---

### 1.2 Landasan Teoretis & Akademis (Theoretical & Academic Foundations)

Arsitektur kognitif agen ini dirancang secara ketat di atas lima pilar teoretis dan literatur akademis terkemuka:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   LANDASAN TEORETIS AUTONOMOUS COGNITIVE FINANCIAL COPILOT                      │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   ┌───────────────────────────┐     ┌───────────────────────────┐     ┌──────────────────────┐   │
│   │   NEURO-SYMBOLIC AI       │     │     REACT PARADIGM        │     │    FINMEM LAYERED    │   │
│   │     (Marcus, 2020)        │     │    (Yao et al., 2023)     │     │        MEMORY        │   │
│   │                           │     │                           │     │  (Yu et al., 2024)   │   │
│   │  Persepsi Semantik LLM    │     │  Thought -> Action ->     │     │ Working / Short-Term │   │
│   │             +             │     │ Observation -> Thought    │     │ / Long-Term Episodic │   │
│   │  Deterministik DB/Decimal │     │ Reasoning Loop Terstruktur│     │ Financial Memory     │   │
│   └─────────────┬─────────────┘     └─────────────┬─────────────┘     └──────────┬───────────┘   │
│                 │                                 │                              │               │
│                 └─────────────────────────┬───────┴──────────────────────────────┘               │
│                                           │                                                      │
│                                           ▼                                                      │
│                 ┌───────────────────────────────────────────────────────┐                        │
│                 │               BEHAVIORAL INTERVENTIONS                │                        │
│                 ├───────────────────────────┬───────────────────────────┤                        │
│                 │ MENTAL ACCOUNTING & NUDGE │ GOALCOIN OPTIMIZATION     │                        │
│                 │   (Thaler, 1985; 2008)    │       (IEEE, 2025)        │                        │
│                 │ Partisi Dompet Kognitif   │ Constraint-Based Planning │                        │
│                 │ & Friksi Belanja Impulsif │ & Perlindungan Likuiditas │                        │
│                 └───────────────────────────┴───────────────────────────┘                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### A. Neuro-symbolic AI (Marcus, 2020)
Gary Marcus (2020) dalam karyanya *"The Next Decades in AI: Four Steps Towards Robust Artificial Intelligence"* menegaskan bahwa jaringan saraf tiruan murni (*deep neural networks / LLMs*) rentan terhadap halusinasi, kerapuhan representasi logika, dan kegagalan total dalam manipulasi simbolik presisi tinggi (seperti aritmatika eksak). Sebaliknya, sistem berbasis aturan simbolik murni (*symbolic engines*) bersifat kaku dan tidak mampu memahami nuansa bahasa manusia yang berantakan.

Rezekify mengadopsi **Arsitektur Neuro-simbolik Hibrida**:
- **Subsistem Neural (LLM):** Menangani *natural language understanding*, ekstraksi intensi, pemetaan sinonim, perencanaan urutan eksekusi (*query planning*), dan sintesis narasi empati.
- **Subsistem Simbolik (PostgreSQL & Python `decimal.Decimal`):** Bertindak sebagai *ground truth* absolut yang memegang seluruh logika pembukuan berpasangan (*double-entry balancing*), kalkulasi agregasi data, perbandingan delta periodik, dan evaluasi ketahanan kas harian.
- LLM **dilarang keras** melakukan komputasi aritmatika di dalam memorinya; LLM bertindak sebagai orkestrator yang mendelegasikan seluruh perhitungan ke subsistem simbolik.

#### B. ReAct Paradigm: Synergizing Reasoning and Acting in Language Models (Yao et al., 2023)
Berdasarkan riset Yao et al. (ICLR 2023), model bahasa yang menggabungkan jejak penalaran verbal (*reasoning traces*) dengan eksekusi tindakan diskret (*domain-specific actions*) mampu menyelesaikan masalah multi-langkah dengan akurasi dan interpretabilitas yang jauh melampaui pendekatan *Chain-of-Thought (CoT)* murni maupun *Act-only*.

Agen mengimplementasikan siklus diskret terstruktur:
$$\text{Input} \longrightarrow [\text{Thought} \longrightarrow \text{Action} \longrightarrow \text{Observation}]^N \longrightarrow \text{Final Response}$$
Di mana:
- **Thought:** Agen mendeskripsikan secara eksplisit hipotesis atau rencana data yang dibutuhkan (misal: *"Pengguna menanyakan tren makanan bulan ini, saya perlu memeriksa pengeluaran kategori Makanan pada rentang 1 s.d. 31 Oktober dan membandingkannya dengan September"*).
- **Action:** Pemanggilan tool deterministik berparameter valid (`query_financial_ledger`, `get_runway_telemetry`, atau `simulate_purchase`).
- **Observation:** Output data terstruktur (JSON) yang dikembalikan oleh subsistem simbolik.
- **Final Response:** Sintesis data observasi menjadi bahasa manusia yang ringkas, faktual, dan dapat ditindaklanjuti.

#### C. FinMem Layered Memory Architecture (Yu et al., 2024)
Mengadaptasi kerangka kerja *FinMem* (Yu et al., 2024) untuk agen finansial kognitif, Rezekify menerapkan arsitektur memori berlapis tiga tingkat (*three-tiered memory hierarchy*):
1. **Working Memory (Sensory/Execution Context):** Menyimpan percakapan turn aktif, parameter tool yang sedang dieksekusi, dan konteks pesan pengguna saat ini dalam siklus ReAct yang sedang berjalan.
2. **Short-Term Memory (Operational Financial Context):** Menyimpan snapshot status telemetri kas terkini (`RunwayReport`: saldo bebas operasional, jatah aman belanja hari ini, status kesehatan dompet, serta daftar tagihan mendesak H-7) yang otomatis diinjeksi ke dalam sesi agar agen memiliki kesadaran situasional instan.
3. **Long-Term Episodic & Semantic Memory (Relational Ledger & User Profile):** Seluruh rekaman historis transaksi (`transactions`), entitas jurnal (`ledger_entries`), komitmen tabungan (`vaults`), dan preferensi profil anggaran pengguna (`monthly_cycle_day`, `safe_runway_threshold`). Agen mengakses memori jangka panjang ini secara terarah melalui alat bantu kueri faceted berindeks.

#### D. Behavioral Mental Accounting & Nudge Architecture (Thaler, 1985; 2008)
Berdasarkan teori *Mental Accounting* dari peraih Nobel Richard Thaler (1985), manusia secara kognitif memisahkan uang ke dalam rekening mental non-fungibel. Kegagalan perencanaan keuangan sering terjadi akibat ilusi kas bebas (*illusion of liquidity*), di mana pengguna melihat total saldo rekening bank utuh tanpa memperhitungkan tagihan sewa, cicilan, dan tabungan darurat yang harus dipenuhi dalam waktu dekat.

Melalui *Nudge Theory* (Thaler & Sunstein, 2008), agen Rezekify dirancang sebagai instrumen *libertarian paternalism*:
- Agen tidak membatasi kebebasan bertransaksi pengguna, namun memberikan **friksi kognitif terarah (*targeted cognitive friction*)**.
- Saat pengguna ingin melakukan pembelian bernominal besar, agen secara proaktif menghitung depresiasi jatah harian (*daily safe runway drop*) dan mengingatkan sisa hari siklus menuju gajian, mendorong pertimbangan sadar (*mindful spending*) sebelum keputusan dieksekusi.

#### E. GoalCoin & Goal-Driven Autonomous Financial Planning (IEEE, 2025)
Mengadopsi prinsip riset *GoalCoin: Autonomous Goal-Driven Financial Agents* (IEEE, 2025), agen memandang seluruh kas pengguna bukan sebagai tumpukan statis, melainkan sebagai aliran yang dioptimalkan terhadap target finansial (*goal-driven constraint optimization*).
- Dana yang telah dialokasikan ke dalam brankas tabungan (*vaults*) atau pos komitmen tagihan (*fixed bills*) dikunci secara virtual dari definisi kas bebas operasional (*vault-locked reservation*).
- Agen bertindak sebagai pelindung otonom (*autonomous guardian*) yang mempertahankan integritas target tabungan pengguna dari erosi belanja diskresioner harian.

---

## 2. Architectural Invariants

Setiap baris kode, kueri data, dan logika pemanggilan alat (*tool calling*) pada Autonomous Financial Agent Rezekify tunduk mutlak pada aturan arsitektur yang tidak dapat dinegosiasikan (*non-negotiable core invariants*):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CORE ARCHITECTURAL INVARIANTS REZEKIFY                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   ┌───────────────────────────────────┐    ┌───────────────────────────────────────┐   │
│   │        CORE INVARIANT 1           │    │           CORE INVARIANT 3            │   │
│   │   Deterministic Financial Math    │    │      Tenant Isolation by Design       │   │
│   ├───────────────────────────────────┤    ├───────────────────────────────────────┤   │
│   │ • LLM dilarang menghitung angka.  │    │ • Wajib WHERE user_id=:current_user_id│   │
│   │ • PostgreSQL: SUM, COUNT, AVG     │    │ • user_id diinjeksi via JWT Auth.     │   │
│   │ • Python: decimal.Decimal murni.  │    │ • Nol kebocoran data lintas penyewa.  │   │
│   │ • Nol floating-point (No IEEE754).│    │ • Kredensial & BYOK terenkripsi Fernet│   │
│   └───────────────────────────────────┘    └───────────────────────────────────────┘   │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                            DUAL-MODE OPERATION                                 │   │
│   ├────────────────────────────────────────┬───────────────────────────────────────┤   │
│   │           OPERATOR MODE                │      STRATEGIC ANALYST MODE           │   │
│   │             (MUTATION)                 │             (ADVISORY)                │   │
│   ├────────────────────────────────────────┼───────────────────────────────────────┤   │
│   │ • Mutasi Buku Besar (Expense/Income/Tr)│ • Eksplorasi Ledger & Analitik Faceted│   │
│   │ • Jurnal Berpasangan (Debit = Credit)  │ • Simulasi Pembelian (What-If Engine) │   │
│   │ • ACID Transaction with Row Locking    │ • Idempotent & Read-Only Sandboxed    │   │
│   │ • Dukungan Rollback & Audit Trail      │ • Nol Efek Samping pada Basis Data    │   │
│   └────────────────────────────────────────┴───────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Core Invariant 1: Deterministic Financial Math
1. **Zero LLM Arithmetic Computation:** Model bahasa besar dilarang melakukan operasi penjumlahan, pengurangan, pembagian, perhitungan persentase delta, maupun kalkulasi sisa saldo di dalam memori generatifnya. LLM hanya diperbolehkan merefleksikan, merangkum, dan menarasikan angka yang telah dihitung oleh subsistem simbolik.
2. **PostgreSQL & Python `Decimal` Authority:**
   - Seluruh agregasi multi-baris (total pengeluaran, rata-rata harian, pengelompokan kategori) wajib dihitung di dalam PostgreSQL menggunakan fungsi agregasi SQL deterministik (`func.sum`, `func.count`, `func.avg`).
   - Seluruh manipulasi aritmatika tingkat aplikasi wajib menggunakan tipe data `decimal.Decimal` bawaan Python dengan pembulatan terdefinisi secara presisi (`Decimal("0.01")` dengan aturan `ROUND_HALF_UP`).
   - Tipe data floating-point primitif (`float`) dilarang keras digunakan untuk entitas moneter.

### 2.2 Core Invariant 3: Multi-Tenant Row-Level Isolation
1. **Mandatory Tenant Scoping:** Setiap kueri pembacaan, agregasi, pencarian faceted, maupun mutasi buku besar **wajib** menyertakan klausul isolasi penyewa:
   ```sql
   WHERE user_id = :current_user_id
   ```
2. **Context-Injected User Identity:** Parameter `user_id` tidak pernah diambil dari teks prompt LLM atau parameter yang dapat dimanipulasi oleh model. Identitas `user_id` selalu diinjeksi secara tepercaya dari token sesi terverifikasi (*authenticated JWT context*) pada gateway request.
3. **No Cross-Tenant Information Leakage:** Kegagalan isolasi penyewa pada level tool query builder dikategorikan sebagai pelanggaran keamanan fatal (*Critical Vulnerability*).

### 2.3 Dual-Mode Operation Paradigm

Agen kognitif beroperasi di bawah pemisahan tanggung jawab (*separation of concerns*) yang terbagi menjadi dua mode operasional:

1. **Operator Mode (Mutation & Execution):**
   - **Tanggung Jawab:** Mengeksekusi mutasi buku besar berpasangan (*double-entry balancing*) yang mengubah state basis data secara persisten: pencatatan pengeluaran (*expense*), pemasukan (*income*), pemindahan dana (*transfer*), alokasi brankas (*vault allocation*), dan pembatalan transaksi (*rollback/void*).
   - **Integritas:** Beroperasi di dalam transaksi atomik database (`BEGIN ... COMMIT / ROLLBACK`) dengan penguncian baris akun (`with_for_update()`) untuk mencegah *race condition* atau *balance drift*.
   - **Verifikasi:** Menghasilkan ringkasan mutasi berstruktur (*structured transaction summary*) dengan kartu aksi interaktif yang dapat dibatalkan dalam 1 klik oleh pengguna.

2. **Strategic Financial Analyst Mode (Read-Only Advisory & Intelligence):**
   - **Tanggung Jawab:** Melakukan penjelajahan analitik mendalam (*deep retrospective query*), perbandingan tren antar periode waktu, evaluasi distribusi kategori, pemeriksaan kepatuhan terhadap jatah harian (*runway telemetry*), dan simulasi dampak belanja diskresioner (*what-if simulation*).
   - **Karakteristik:** Bersifat murni *read-only*, idempoten, dan bebas efek samping (*zero side effects*). Mode ini tidak pernah memodifikasi baris transaksi, saldo akun, maupun konfigurasi sistem.

---

## 3. The Universal Faceted Query Tool Specification (`query_financial_ledger`)

### 3.1 Rasional Desain & Eliminasi Tool Sprawl
Pada perancangan agen konvensional, pengembang kerap membuat puluhan tool granular yang terfragmentasi (misalnya `get_monthly_expense`, `get_coffee_expense`, `get_transactions_between_dates`, `get_category_breakdown`). Pola ini melanggar prinsip desain *High Cohesion & Low Coupling*, menghabiskan batas konteks token LLM (*context window exhaustion*), serta memicu kebingungan model (*tool selection ambiguity*).

Rezekify mengadopsi satu alat analitik universal berkinerja tinggi: **`query_financial_ledger`**. Alat ini menyediakan antarmuka terpadu untuk menyaring, mengelompokkan, dan mengagregasi data transaksi buku besar dalam berbagai dimensi analitis.

---

### 3.2 Skema Definisi Tool (JSON Schema Specification)

Definisi skema fungsi standar (kompatibel dengan OpenAI Function Calling, Anthropic Tool Use, dan Google Gemini Function Declaration):

```json
{
  "name": "query_financial_ledger",
  "description": "Alat analitik universal untuk menanyakan, menyaring, mengelompokkan, dan membandingkan data transaksi buku besar pengguna. Menghitung total, rata-rata, dan delta periode sebelumnya secara deterministik di database.",
  "parameters": {
    "type": "object",
    "properties": {
      "flow_type": {
        "type": "string",
        "enum": ["EXPENSE", "INCOME", "TRANSFER", "ALL"],
        "description": "Jenis aliran transaksi yang ingin dianalisis. Default: EXPENSE."
      },
      "start_date": {
        "type": "string",
        "format": "date",
        "description": "Batas awal rentang tanggal analisis (format ISO: YYYY-MM-DD)."
      },
      "end_date": {
        "type": "string",
        "format": "date",
        "description": "Batas akhir rentang tanggal analisis (format ISO: YYYY-MM-DD)."
      },
      "categories": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Daftar nama kategori yang ingin disaring (misal: ['Makanan', 'Kopi', 'Transportasi'])."
      },
      "accounts": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Daftar nama akun sumber/tujuan yang ingin disaring (misal: ['BCA', 'GoPay', 'Cash'])."
      },
      "keyword": {
        "type": "string",
        "description": "Kata kunci pencarian spesifik pada catatan atau deskripsi transaksi (case-insensitive)."
      },
      "min_amount": {
        "type": "number",
        "description": "Nominal transaksi minimum yang ingin disertakan."
      },
      "max_amount": {
        "type": "number",
        "description": "Nominal transaksi maksimum yang ingin disertakan."
      },
      "group_by": {
        "type": "string",
        "enum": ["category", "account", "month", "week", "day", "flow_type", "none"],
        "description": "Dimensi pengelompokan data agregasi. Gunakan 'none' jika ingin melihat daftar transaksi individual."
      },
      "metrics": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["TOTAL", "COUNT", "AVERAGE"]
        },
        "description": "Metrik statistik yang ingin dihitung. Default: ['TOTAL', 'COUNT']."
      },
      "order_by": {
        "type": "string",
        "enum": ["date_desc", "date_asc", "amount_desc", "amount_asc"],
        "description": "Urutan pengembalian data. Default: 'amount_desc' jika dikelompokkan, 'date_desc' jika tanpa grup."
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 200,
        "description": "Batas maksimal jumlah baris data yang dikembalikan. Default: 50. Batas maksimum keras: 200."
      },
      "compare_with_previous_period": {
        "type": "boolean",
        "description": "Jika bernilai true, sistem secara otomatis menghitung metrik untuk jendela waktu sebelumnya dengan durasi yang sama dan menghasilkan delta nominal serta persentase perubahan."
      }
    },
    "required": []
  }
}
```

---

### 3.3 Safe SQL Query Builder Implementation

Query builder diimplementasikan di dalam `LedgerService` (`rezekify/services/ledger.py`) memanfaatkan pustaka ekspresi SQLAlchemy 2.0 yang sepenuhnya menggunakan *parameterized binding*.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             ARSITEKTUR SAFE SQL QUERY BUILDER (query_financial_ledger)                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   Input Parameter Valid Dari LLM                                                       │
│   [ flow_type, dates, categories, group_by, compare_with_previous_period ]             │
│                                      │                                                 │
│                                      ▼                                                 │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                 LedgerService._build_faceted_query()                           │   │
│   │                                                                                │   │
│   │   1. Base Query Filter:                                                        │   │
│   │      WHERE transactions.user_id = :user_id (Core Invariant 3)                  │   │
│   │      AND transaction_date BETWEEN :start_date AND :end_date                    │   │
│   │                                                                                │   │
│   │   2. Dynamic Join Scoping:                                                     │   │
│   │      JOIN ledger_entries ON ledger_entries.transaction_id = transactions.id    │   │
│   │      LEFT JOIN categories ON categories.id = ledger_entries.category_id        │   │
│   │      LEFT JOIN accounts ON accounts.id = ledger_entries.account_id             │   │
│   │                                                                                │   │
│   │   3. Dynamic Grouping & Deterministic Aggregation (Core Invariant 1):          │   │
│   │      SELECT group_key, SUM(amount), COUNT(id), AVG(amount)                     │   │
│   │      GROUP BY group_key                                                        │   │
│   │      ORDER BY metric DESC LIMIT :capped_limit (Anti-OOM Cap)                   │   │
│   └──────────────────────────────────┬─────────────────────────────────────────────┘   │
│                                      │                                                 │
│               ┌──────────────────────┴──────────────────────┐                          │
│               ▼                                             ▼                          │
│   [ Periode Utama (Current) ]                  [ Periode Pembanding (Previous) ]       │
│   Eksekusi Kueri SQL Terparameter               Kalkulasi Jendela Waktu Geser           │
│   Ambil Result Set 1                            Eksekusi Kueri SQL Periode [t - Δ, t)  │
│               │                                             │                          │
│               └──────────────────────┬──────────────────────┘                          │
│                                      │                                                 │
│                                      ▼                                                 │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │              Symbolic Delta Engine (Python decimal.Decimal)                    │   │
│   │   • delta_amount = current_total - previous_total                              │   │
│   │   • delta_percentage = (delta_amount / previous_total) * 100                   │   │
│   │   • trend = INCREASE | DECREASE | STABLE                                       │   │
│   └──────────────────────────────────┬─────────────────────────────────────────────┘   │
│                                      │                                                 │
│                                      ▼                                                 │
│   Output Observasi Terstruktur (FacetedLedgerResponse) dikembalikan ke LLM             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Struktur Logika Query Builder (Metode Teknis):
1. **Sanitasi Parameter & Date Range Normalization:**
   - Jika `start_date` dan `end_date` tidak diberikan oleh pengguna, sistem default ke bulan kalender berjalan (`1` s.d. hari ini).
   - Sanitasi string wildcard SQL: karakter `%` dan `_` pada `keyword` di-escape secara ketat untuk mencegah serangan *SQL pattern denial of service*.
2. **Klausul Filter Terparameter:**
   ```python
   filters = [Transaction.user_id == user_id]
   if start_date:
       filters.append(Transaction.transaction_date >= start_date)
   if end_date:
       filters.append(Transaction.transaction_date <= end_date)
   if flow_type == "EXPENSE":
       filters.append(LedgerEntry.entry_type == EntryType.DEBIT)
       filters.append(LedgerEntry.category_id.isnot(None))
   elif flow_type == "INCOME":
       filters.append(LedgerEntry.entry_type == EntryType.CREDIT)
       filters.append(LedgerEntry.category_id.isnot(None))
   ```
3. **Agregasi Simbolik di Basis Data:**
   - Pengelompokan kategori:
     ```python
     query = (
         db.query(
             Category.name.label("group_key"),
             func.sum(LedgerEntry.amount).label("total_amount"),
             func.count(Transaction.id.distinct()).label("transaction_count"),
             func.avg(LedgerEntry.amount).label("average_amount"),
         )
         .select_from(Transaction)
         .join(LedgerEntry, LedgerEntry.transaction_id == Transaction.id)
         .join(Category, Category.id == LedgerEntry.category_id)
         .filter(*filters)
         .group_by(Category.name)
         .order_by(func.sum(LedgerEntry.amount).desc())
         .limit(limit)
     )
     ```
4. **Automated Period Comparison Engine:**
   - Jika `compare_with_previous_period = True`:
     - Hitung durasi hari: $\Delta_{\text{days}} = (\text{end\_date} - \text{start\_date}).\text{days} + 1$.
     - Tentukan jendela pembanding: $\text{prev\_end} = \text{start\_date} - 1\text{ hari}$, $\text{prev\_start} = \text{prev\_end} - (\Delta_{\text{days}} - 1)\text{ hari}$.
     - Eksekusi kueri agregasi identik pada jendela pembanding.
     - Hitung selisih nominal dan rasio persentase secara deterministik menggunakan `Decimal`:
       $$\Delta_{\text{amount}} = \text{total}_{\text{current}} - \text{total}_{\text{previous}}$$
       $$\Delta_{\text{percentage}} = \begin{cases} \left(\frac{\Delta_{\text{amount}}}{\text{total}_{\text{previous}}}\right) \times 100, & \text{jika } \text{total}_{\text{previous}} > 0 \\ 0.00, & \text{jika } \text{total}_{\text{previous}} = 0 \end{cases}$$

---

### 3.4 Format Respons Struktural Tool (`FacetedLedgerResponse`)

Payload terstruktur yang dikembalikan ke LLM sebagai observasi ReAct:

```json
{
  "status": "success",
  "query_metadata": {
    "flow_type": "EXPENSE",
    "period_current": { "start": "2026-10-01", "end": "2026-10-13" },
    "period_previous": { "start": "2026-09-18", "end": "2026-09-30" },
    "group_by": "category"
  },
  "summary": {
    "total_amount": 1450000.00,
    "transaction_count": 28,
    "average_per_transaction": 51785.71
  },
  "comparison": {
    "previous_total_amount": 1820000.00,
    "delta_amount": -370000.00,
    "delta_percentage": -20.33,
    "trend": "DECREASE"
  },
  "groups": [
    {
      "key": "Makanan & Minuman",
      "total_amount": 850000.00,
      "count": 19,
      "percentage_of_total": 58.62
    },
    {
      "key": "Transportasi",
      "total_amount": 320000.00,
      "count": 6,
      "percentage_of_total": 22.07
    },
    {
      "key": "Langganan Digital",
      "total_amount": 280000.00,
      "count": 3,
      "percentage_of_total": 19.31
    }
  ]
}
```

---

## 4. Supporting Toolset Specification

Selain kueri analitik universal, agen autonomous Rezekify dilengkapi dengan tiga alat penunjang utama yang mengikat langsung ke layanan deterministik Layer 1 (`RunwayService` dan `LedgerService`):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           SUPPORTING TOOLSET SPECIFICATION                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   1. get_runway_telemetry                                                              │
│      • Input: user_id (Injeksi Internal Sesi)                                          │
│      • Output: Telemetri Lengkap Real-Time                                             │
│        (operational_free_cash, daily_safe_runway, days_remaining, health_status, bills)│
│      • Karakteristik: Read-Only, Cache-Aware (TTL 30 detik)                            │
│                                                                                        │
│   2. simulate_purchase                                                                 │
│      • Input: planned_amount (Decimal), category_name?, account_name?                  │
│      • Output: Laporan Simulasi Dampak Kas (SimulationReport)                          │
│        (current_runway, projected_runway, daily_drop, is_safe, thaler_nudge)           │
│      • Karakteristik: Pure Math Calculation, Nol Mutasi Database                       │
│                                                                                        │
│   3. record_transaction                                                                │
│      • Input: action, amount, account_name, category_name, description                 │
│      • Output: Ringkasan Mutasi Jurnal Berpasangan & Telemetri Terkini Pasca Mutasi    │
│      • Karakteristik: Mutasi Atomik ACID, Row Locking with_for_update()                │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.1 Tool 1: `get_runway_telemetry`

#### A. Deskripsi & Skema
Alat pembacaan telemetri status keuangan saat ini secara instan. Mengambil metrik likuiditas nyata, dana terkunci brankas, sisa hari menuju gajian, serta tagihan mendesak.

```json
{
  "name": "get_runway_telemetry",
  "description": "Mengambil snapshot kesehatan finansial pengguna terkini secara real-time: sisa kas bebas operasional, jatah belanja harian aman, sisa hari siklus gajian, status kesehatan kas, dan daftar tagihan mendesak dalam 7 hari ke depan.",
  "parameters": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

#### B. Logika Eksekusi Simbolik (`RunwayService.calculate_runway`)
- **Total Saldo Likuid ($L$):**
  $$L = \sum \text{Account.current\_balance} \quad \forall \text{ type} \in \{\text{CASH}, \text{BANK}, \text{EWALLET}\}$$
- **Total Dana Terkunci Brankas ($V$):**
  $$V = \sum \text{Vault.allocated\_amount} \quad \forall \text{ is\_locked} = \text{True}$$
- **Kas Bebas Operasional ($C_{\text{free}}$):**
  $$C_{\text{free}} = \max(0, L - V)$$
- **Sisa Hari Siklus Gajian ($D_{\text{remaining}}$):** Dihitung secara presisi terhadap `User.monthly_cycle_day` dengan memperhitungkan panjang hari bulan kalender berjalan (`monthrange`).
- **Jatah Aman Harian ($R_{\text{daily}}$):**
  $$R_{\text{daily}} = \left\lfloor \frac{C_{\text{free}}}{D_{\text{remaining}}} \right\rfloor_{\text{presisi 0.01}}$$
- **Evaluasi Status Kesehatan Finansial:**
  $$\text{Health Status} = \begin{cases} \text{CRITICAL}, & C_{\text{free}} \le 0 \\ \text{WARNING}, & R_{\text{daily}} < \text{safe\_runway\_threshold} \\ \text{HEALTHY}, & R_{\text{daily}} \ge \text{safe\_runway\_threshold} \end{cases}$$
- **Tagihan Mendatang (H-7):** Menyaring `Vault` berjenis `FIXED_BILL` yang belum terpenuhi dan memiliki tanggal jatuh tempo $0 \le (\text{target\_date} - \text{today}) \le 7\text{ hari}$.

---

### 4.2 Tool 2: `simulate_purchase`

#### A. Deskripsi & Skema
Mesin simulasi skenario "what-if" untuk mengevaluasi dampak finansial dan kognitif dari suatu rencana belanja sebelum uang dikeluarkan.

```json
{
  "name": "simulate_purchase",
  "description": "Mensimulasikan dampak rencana pengeluaran terhadap jatah harian aman dan ketahanan kas tanpa mengubah data basis data. Memberikan penilaian risiko dan panduan perilaku mental accounting.",
  "parameters": {
    "type": "object",
    "properties": {
      "planned_amount": {
        "type": "number",
        "description": "Nominal rencana pengeluaran yang ingin disimulasikan (angka positif)."
      },
      "category_name": {
        "type": "string",
        "description": "Estimasi kategori pengeluaran (misal: Elektronik, Hiburan, Kuliner)."
      },
      "account_name": {
        "type": "string",
        "description": "Nama akun yang direncanakan untuk membayar (opsional)."
      }
    },
    "required": ["planned_amount"]
  }
}
```

#### B. Logika Eksekusi Simbolik (`RunwayService.simulate_purchase`)
1. Mengambil kondisi kas saat ini: $C_{\text{free}}$ dan $R_{\text{daily\_current}}$.
2. Menghitung proyeksi kas bebas:
   $$C_{\text{projected}} = \max(0, C_{\text{free}} - \text{planned\_amount})$$
3. Menghitung proyeksi jatah harian aman baru:
   $$R_{\text{daily\_projected}} = \left\lfloor \frac{C_{\text{projected}}}{D_{\text{remaining}}} \right\rfloor_{\text{presisi 0.01}}$$
4. Menghitung penurunan jatah harian ($\Delta_{\text{drop}}$):
   $$\Delta_{\text{drop}} = R_{\text{daily\_current}} - R_{\text{daily\_projected}}$$
5. Penilaian Ambang Keamanan:
   $$\text{is\_safe} = R_{\text{daily\_projected}} \ge \text{safe\_runway\_threshold}$$
6. Integrasi Mental Accounting & Nudge:
   - Jika $R_{\text{daily\_projected}} < \text{threshold}$, agen merumuskan *nudge* bahwa pembelian ini akan memangkas jatah harian sebesar Rp $\Delta_{\text{drop}}$ per hari selama $D_{\text{remaining}}$ hari ke depan.
   - Jika terdapat tagihan mendesak H-7 dan $C_{\text{projected}} < \sum \text{Bills}_{\text{H-7}}$, agen memberikan peringatan keras bahwa pembelian tersebut berisiko menggagalkan pembayaran tagihan penting.

---

### 4.3 Tool 3: `record_transaction`

#### A. Deskripsi & Skema
Alat eksekusi mutasi buku besar berpasangan (*double-entry balancing*) untuk pencatatan transaksi riil ke basis data.

```json
{
  "name": "record_transaction",
  "description": "Mengeksekusi pencatatan transaksi riil (pengeluaran, pemasukan, atau transfer) ke dalam buku besar dengan integritas pembukuan berpasangan (double-entry). Mengubah saldo akun secara atomik.",
  "parameters": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["expense", "income", "transfer"],
        "description": "Jenis mutasi transaksi yang dieksekusi."
      },
      "amount": {
        "type": "number",
        "description": "Nominal transaksi dalam Rupiah (angka bulat atau desimal positif)."
      },
      "account_name": {
        "type": "string",
        "description": "Nama akun pembayaran/penyimpanan (misal: BCA, Mandiri, Cash, GoPay)."
      },
      "category_name": {
        "type": "string",
        "description": "Kategori transaksi (wajib untuk expense/income, misal: Makanan, Transport)."
      },
      "to_account_name": {
        "type": "string",
        "description": "Nama akun tujuan transfer (hanya wajib jika action bernilai 'transfer')."
      },
      "description": {
        "type": "string",
        "description": "Catatan singkat atau peruntukan transaksi."
      }
    },
    "required": ["action", "amount", "account_name", "description"]
  }
}
```

#### B. Logika Eksekusi Simbolik & Jaminan ACID (`LedgerService`)
1. **Resolusi Entitas Akun & Kategori:**
   - Pencarian akun berdasarkan kemiripan nama (`Account.name.ilike(f"%{safe_name}%")`) yang terisolasi pada `user_id`.
   - Resolusi atau pembuatan otomatis (*resolve or create*) kategori pengguna untuk fleksibilitas entri.
2. **Kepatuhan Pembukuan Berpasangan (*Balanced Double-Entry*):**
   - **Pengeluaran (*Expense*):**
     - DEBIT: Kategori Pengeluaran ($+$ beban)
     - KREDIT: Akun Sumber ($-$ aset kas)
   - **Pemasukan (*Income*):**
     - DEBIT: Akun Tujuan ($+$ aset kas)
     - KREDIT: Kategori Pemasukan ($+$ pendapatan)
   - **Transfer Antar Akun:**
     - DEBIT: Akun Tujuan ($+$ aset kas)
     - KREDIT: Akun Sumber ($-$ aset kas)
3. **Pemberian Kunci Baris (*Row-Level Lock*):**
   - Pemanggilan `.with_for_update()` pada baris akun yang terlibat mencegah *concurrent balance race conditions*.
4. **Invalidasi Cache Telemetri Otomatis:**
   - Setiap mutasi yang berhasil di-commit secara otomatis menghapus cache telemetri pengguna di `RunwayService` untuk memastikan konsistensi instan (*immediate cache invalidation*).

---

## 5. Dual-Mode Provider Integration Strategy

Rezekify mengadopsi prinsip arsitektur *Zero-Cost Sustainability* melalui *Multi-Provider & Bring Your Own Key (BYOK)*. Sistem wajib melayani berbagai provider LLM dengan kapabilitas yang sangat bervariasi:
1. Model *Tier 1* dengan dukungan **Native Function Calling / Tool Use** berstandar industri (OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, Google Gemini 2.5 Flash).
2. Model *Open-Source / Alternative BYOK* yang diakses melalui endpoint OpenAI-compatible (Groq Llama 3 / Scout, DeepSeek V3/R1, vLLM, Ollama) yang kerap memiliki keterbatasan atau instabilitas pada native tool calling.

Untuk menjamin ketersediaan 100% (*high availability*), sistem menerapkan **Dual-Mode Integration Strategy**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DUAL-MODE PROVIDER INTEGRATION STRATEGY                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│                                  User Message Received                                 │
│                                            │                                           │
│                                            ▼                                           │
│                         Evaluasi Model & Konfigurasi Provider                          │
│                                            │                                           │
│                 ┌──────────────────────────┴──────────────────────────┐                │
│                 ▼                                                     ▼                │
│     [ Native Function Calling ]                           [ JSON Schema Fallback ]     │
│   (Gemini, Claude, OpenAI GPT)                         (DeepSeek, Groq, Custom BYOK)   │
│                 │                                                     │                │
│                 ▼                                                     ▼                │
│   Tools Payload Terstruktur (API Level)                 Injeksi Skema JSON ke System   │
│   Model Menghasilkan `tool_calls` Block                 Prompt & Instruksi ReAct Ketat │
│                 │                                                     │                │
│                 ▼                                                     ▼                │
│   Ekstraksi Function Call Standar SDK                   Ekstraksi Aman via             │
│   `call.function.name` & `arguments`                    `extract_json()` & Pydantic    │
│                 │                                                     │                │
│                 └──────────────────────────┬──────────────────────────┘                │
│                                            │                                           │
│                                            ▼                                           │
│                        Dispatcher Tool Execution (Python Backend)                      │
│                        • query_financial_ledger                                        │
│                        • get_runway_telemetry                                          │
│                        • simulate_purchase                                             │
│                        • record_transaction                                            │
│                                            │                                           │
│                                            ▼                                           │
│                     Hasil Observasi Dikembalikan ke ReAct Context                      │
│                     (Maksimal 3 Hop Iterasi / Ceiling Guard)                           │
│                                            │                                           │
│                                            ▼                                           │
│                     Sintesis Respons Final Empatik untuk Pengguna                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.1 Jalur Primer: Native Function Calling Architecture

Jalur ini diaktifkan secara otomatis saat sistem menggunakan model primer (Google Gemini 2.5 Flash dari *Rotary Key Pool*, atau konfigurasi BYOK dengan protokol resmi OpenAI dan Anthropic).

#### Mekanisme Eksekusi:
1. **Penerjemahan Skema Adapter:**
   - Modul adapter (`rezekify/agent/providers/`) mengonversi definisi tool universal ke dalam format spesifik vendor:
     - OpenAI: Objek `{"type": "function", "function": { ... }}`
     - Anthropic: Objek `{"name": "...", "description": "...", "input_schema": { ... }}`
     - Gemini: Objek `types.FunctionDeclaration(name="...", description="...", parameters={...})`
2. **ReAct Dispatch Loop:**
   ```python
   # Pseudocode ReAct Loop Native Function Calling
   messages = [system_message, user_message]
   for hop in range(MAX_REACT_HOPS):  # Hard limit = 3
       response = provider.generate_chat_completion(
           messages=messages,
           tools=REGISTERED_TOOLS
       )
       if not response.tool_calls:
           # Model memutuskan tidak membutuhkan tool lagi, mengembalikan teks akhir
           return response.text
           
       for tool_call in response.tool_calls:
           tool_name = tool_call.name
           tool_args = tool_call.arguments
           observation = tool_dispatcher.execute(user_id=user_id, name=tool_name, args=tool_args)
           
           # Tambahkan pesan pemanggilan tool dan hasil observasi ke riwayat percakapan turn
           messages.append(create_tool_call_message(tool_call))
           messages.append(create_tool_response_message(tool_call_id=tool_call.id, content=observation))
   ```
3. **Ceiling Guard:** Loop dibatasi maksimal 3 hop iterasi (`MAX_REACT_HOPS = 3`) untuk mencegah model terjebak dalam *infinite recursive tool execution loop*.

---

### 5.2 Jalur Sekunder: Schema-Enforced JSON Tool Prompting Fallback

Jalur ini bertindak sebagai jaring pengaman (*fail-safe fallback*) untuk model BYOK sumber terbuka (seperti Groq Scout, DeepSeek, atau endpoint mandiri) yang sering kali gagal memformat blok fungsi native.

#### Mekanisme Prompting:
Sistem menyuntikkan spesifikasi format JSON kaku ke dalam `SYSTEM_PROMPT`:
```text
Anda adalah Asisten Finansial Kognitif Rezekify.
Anda memiliki akses ke alat berikut:
1. query_financial_ledger(flow_type, start_date, end_date, categories, group_by, metrics, compare_with_previous_period)
2. get_runway_telemetry()
3. simulate_purchase(planned_amount, category_name)
4. record_transaction(action, amount, account_name, category_name, description)

Jika Anda memerlukan data untuk menjawab pertanyaan pengguna, tanggapi HANYA dengan format JSON pemanggilan alat:
{
  "thought": "<alasan penalaran Anda mengapa alat ini dibutuhkan>",
  "tool_call": {
    "name": "<nama_alat>",
    "arguments": { <parameter_sesuai_skema> }
  }
}

Jika Anda telah memiliki data lengkap dari hasil observasi atau tidak memerlukan alat, tanggapi dengan format:
{
  "thought": "<analisis kesimpulan data>",
  "final_response": "<naskah jawaban lengkap, ramah, dan empatik untuk pengguna>"
}
```

#### Mekanisme Parsing & Dispatch:
- Fungsi tangguh `extract_json(response_text)` mengekstrak objek JSON pertama yang valid dari teks respons model (bahkan jika dikelilingi teks pengantar atau markdown blocks).
- Objek divalidasi terhadap model Pydantic `FallbackToolResponse`.
- Jika `tool_call` terdeteksi: backend mengeksekusi fungsi terkait, membungkus output sebagai pesan sistem bertanda `[OBSERVATION dari {tool_name}]: {json_payload}`, lalu mengirimkannya kembali ke LLM untuk turn penutup.

---

## 6. Security & VPS Resource Protection

Sistem Rezekify dioptimalkan secara ketat untuk berjalan pada infrastruktur hemat biaya: **Single VPS Ubuntu 24.04 LTS dengan anggaran sumber daya 1 vCPU dan 2 GB RAM**. Seluruh pemanggilan analitik dan agen harus tunduk pada mitigasi keamanan dan perlindungan sumber daya komputasi berikut:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SECURITY & VPS RESOURCE PROTECTION                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   ┌───────────────────────────────────┐    ┌───────────────────────────────────────┐   │
│   │     SQL INJECTION IMMUNITY        │    │        DATABASE SCAN CAPS             │   │
│   ├───────────────────────────────────┤    ├───────────────────────────────────────┤   │
│   │ • Zero Raw SQL Injection dari LLM │    │ • Agregasi Wajib di PostgreSQL Engine │   │
│   │ • 100% Parameterized Bind Values  │    │ • Hard limit: Max 200 raw rows        │   │
│   │ • Sanitasi Ketat Karakter % dan _ │    │ • Statement Timeout: 2.0 Detik        │   │
│   └───────────────────────────────────┘    └───────────────────────────────────────┘   │
│                                                                                        │
│   ┌───────────────────────────────────┐    ┌───────────────────────────────────────┐   │
│   │     READ-ONLY QUERY SANDBOX       │    │      ZERO DAEMON MEMORY OVERHEAD      │   │
│   ├───────────────────────────────────┤    ├───────────────────────────────────────┤   │
│   │ • Alat Analitik Mutlak Idempoten  │    │ • Nol Celery, Nol Redis Message Broker│   │
│   │ • Tidak Ada UPDATE/DELETE/DROP    │    │ • Async Non-Blocking FastAPI Loop     │   │
│   │ • Isolasi Sesi Database Read-Only │    │ • Memory Footprint < 150 MB           │   │
│   └───────────────────────────────────┘    └───────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Strict Read-Only Query Sandboxing
1. **Tidak Ada Raw SQL dari LLM:** Agen tidak pernah menghasilkan kode string SQL mentah. LLM hanya memilih parameter terstruktur yang divalidasi skema Pydantic.
2. **Imunitas Terhadap SQL Injection:** Seluruh kueri dibangun menggunakan ekspresi relasional SQLAlchemy ORM. Nilai filter disalurkan sebagai *parameterized bind values* (`:param_1`, `:param_2`).
3. **Sanitasi Wildcard String:** Seluruh input teks pencarian (`keyword`, `categories`) melewati prosedur pembersihan karakter wildcard SQL sebelum dilakukan pencocokan `ilike`:
   ```python
   safe_keyword = keyword.replace("%", "\\%").replace("_", "\\_").strip()[:100]
   ```

### 6.2 Batasan Pemindaian Baris & Perlindungan Memori VPS 2GB
1. **Agregasi di Dalam Engine Basis Data (*In-Engine Aggregation*):** Dilarang keras menarik ribuan baris transaksi mentah ke dalam memori Python untuk di-looping atau dijumlahkan secara manual. Seluruh fungsi `SUM`, `COUNT`, `AVG`, dan pengelompokan `DATE_TRUNC` wajib diselesaikan oleh PostgreSQL.
2. **Row Scan Caps (Plafon Pemindaian Keras):**
   - Batas default pengambilan baris individual: `50` baris.
   - Batas maksimum keras (*hard ceiling*): `200` baris. Nilai parameter `limit` di atas 200 secara otomatis dipotong menjadi 200 oleh query builder.
3. **Statement Timeout Execution:** Setiap kueri analitik yang dieksekusi oleh `LedgerService` diproteksi dengan batas waktu kueri basis data maksimal 2.0 detik (`SET LOCAL statement_timeout = '2000'`). Jika terjadi kueri berat yang melebihi batas waktu, transaksi dibatalkan seketika tanpa melumpuhkan VPS.

### 6.3 Perlindungan Kunci Kriptografi & Token
- Kunci API BYOK pengguna disimpan secara terenkripsi menggunakan algoritma simetris *Fernet* berbasis kunci turunan *PBKDF2 HMAC-SHA256* (600.000 iterasi).
- Kunci didekripsi hanya di memori volatil saat panggilan provider berlangsung, dan tidak pernah dicatat pada berkas log sistem (*zero key logging*).

---

## 7. Testing & Verification Strategy

Sesuai protokol rekayasa perangkat lunak ketat (*Superpowers Engineering Protocols & Strict TDD*), implementasi Autonomous Financial Agent wajib melalui rangkaian pengujian komprehensif pada tiga tingkatan:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PIRAMIDA PENGUJIAN & VERIFIKASI FITUR                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│                                 ┌──────────────────┐                                   │
│                                 │   END-TO-END     │                                   │
│                                 │   MULTI-TURN     │                                   │
│                                 │  CONVERSATIONS   │                                   │
│                                 │ (Mock Provider)  │                                   │
│                                 └────────┬─────────┘                                   │
│                                          │                                             │
│                           ┌──────────────┴──────────────┐                              │
│                           │    TOOL DISPATCHER & ReAct  │                              │
│                           │     LOOP UNIT & INT TESTS   │                              │
│                           └──────────────┬──────────────┘                              │
│                                          │                                             │
│                    ┌─────────────────────┴─────────────────────┐                       │
│                    │     UNIVERSAL FACETED QUERY ENGINE        │                       │
│                    │    & DETERMINISTIC MATH UNIT TESTS        │                       │
│                    └───────────────────────────────────────────┘                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.1 Tingkat 1: Unit Tests Faceted Query Aggregator (`test_faceted_ledger_query.py`)
Memverifikasi fungsionalitas murni query builder di `LedgerService`:
1. **Filter Pengujian Tanggal & Tipe:**
   - Verifikasi bahwa penyaringan `flow_type = EXPENSE` hanya mengambil debit dengan kategori.
   - Verifikasi bahwa penyaringan rentang tanggal `start_date` dan `end_date` mematuhi batas inklusif.
2. **Pengujian Pengelompokan (*Group By*):**
   - Agregasi pengeluaran per kategori menghasilkan urutan nominal menurun (*descending*) dengan persentase total yang tepat seimbang 100%.
   - Agregasi bulanan (`group_by = month`) mengelompokkan data berdasarkan awal bulan kalender secara tepat.
3. **Pengujian Komparasi Periode Sebelumnya (*Period Comparison Delta*):**
   - Jendela waktu 30 hari dibandingkan dengan 30 hari sebelumnya menghitung `delta_amount` dan `delta_percentage` secara presisi menggunakan `Decimal`.
   - Kasus tepi (*edge case*): Jendela waktu sebelumnya bernilai 0 pengeluaran menghasilkan `delta_percentage = 0.00` tanpa memicu pengecualian *DivisionByZero*.
4. **Verifikasi Isolasi Penyewa (*Tenant Isolation Guarantee*):**
   - Memastikan kueri pengguna A sama sekali tidak memuat data transaksi milik pengguna B, meskipun memiliki nama kategori dan tanggal yang serupa.

### 7.2 Tingkat 2: Unit Tests Tool Caller Dispatcher (`test_agent_tool_dispatcher.py`)
Memverifikasi modul orkestrasi pemanggilan alat:
1. **Validasi Skema Argumen:**
   - Memastikan argumen yang tidak valid (misal format tanggal bukan ISO atau limit bernilai negatif) ditolak secara elegan dan menghasilkan respons kesalahan terstruktur untuk agen.
2. **Pengujian Dispatcher Dua Arah:**
   - Verifikasi pemanggilan `get_runway_telemetry` mengembalikan payload telemetri lengkap.
   - Verifikasi pemanggilan `simulate_purchase` mengembalikan proyeksi penurunan jatah harian tanpa memicu mutasi basis data.
   - Verifikasi pemanggilan `record_transaction` menghasilkan entri jurnal berpasangan seimbang dan mengubah saldo akun secara tepat.
3. **Pengujian Mekanisme Fallback JSON Prompting:**
   - Memverifikasi parser `extract_json` mampu mengekstrak blok `tool_call` dari teks mentah model alternatif (Groq/DeepSeek) dan mengeksekusinya tanpa kendala.

### 7.3 Tingkat 3: Integration & End-to-End Multi-Turn Financial Conversations (`test_agent_conversational_e2e.py`)
Pengujian skenario percakapan multi-langkah dengan provider LLM yang dimock (*mocked response streaming*):
1. **Skenario A (Retrospective Inquiry):**
   - Pengguna: *"Berapa pengeluaran makan saya bulan ini dibanding bulan lalu?"*
   - Model menghasilkan `tool_call` ke `query_financial_ledger(categories=['Makanan'], compare_with_previous_period=True)`.
   - Tool mengembalikan data: Bulan ini Rp 850.000 vs Bulan lalu Rp 1.100.000 (Turun 22.7%).
   - Model menghasilkan narasi: *"Pengeluaran kategori Makanan Anda bulan ini adalah Rp 850.000, turun 22.7% (hemat Rp 250.000) dibanding periode sebelumnya."*
2. **Skenario B (What-If Discretionary Purchase Simulation):**
   - Pengguna: *"Boleh nggak saya beli headphone baru seharga Rp 1.200.000?"*
   - Model menghasilkan `tool_call` ke `simulate_purchase(planned_amount=1200000)`.
   - Tool mengembalikan: Sisa kas bebas turun menjadi Rp 200.000, jatah harian turun dari Rp 75.000/hari menjadi Rp 12.500/hari (di bawah ambang batas aman Rp 30.000/hari).
   - Model menghasilkan peringatan *nudge*: *"Pembelian tersebut berisiko menurunkan jatah belanja harian Anda menjadi Rp 12.500/hari (di bawah batas aman Rp 30.000/hari) selama 16 hari ke depan. Disarankan menunda hingga gajian berikutnya."*
3. **Skenario C (Operator Mutation with Instant Telemetry Feedback):**
   - Pengguna: *"Catat barusan bayar servis motor 150rb pakai Mandiri."*
   - Model memanggil `record_transaction(action='expense', amount=150000, account_name='Mandiri', category_name='Transportasi', description='Servis motor')`.
   - Backend melakukan mutasi buku besar, memperbarui saldo akun Mandiri, dan mengembalikan telemetri terbaru.
   - Frontend menampilkan kartu konfirmasi transaksi dengan tombol batalkan (*undo action*).

---

## 8. Jadwal & Fase Implementasi

Implementasi spesifikasi ini dibagi ke dalam 4 fase eksekusi terstruktur:

1. **Fase 1: Engine Agregasi Simbolik & Query Builder (`LedgerService` & `RunwayService`)**
   - Implementasi metode `query_financial_ledger` dengan builder SQL terparameter.
   - Implementasi modul komparasi periode sebelumnya (*delta engine*).
   - Suite unit test `test_faceted_ledger_query.py`.
2. **Fase 2: Tool Registry & Dispatcher Runtime (`rezekify/agent/tools/`)**
   - Definisi skema Pydantic untuk seluruh toolset (`query_financial_ledger`, `get_runway_telemetry`, `simulate_purchase`, `record_transaction`).
   - Implementasi dispatcher modular yang mengikat tool ke service backend.
   - Unit test dispatcher `test_agent_tool_dispatcher.py`.
3. **Fase 3: Provider Tool Adapters & ReAct Loop Orchestration (`rezekify/agent/`)**
   - Integrasi native tool calling untuk Gemini, Anthropic, dan OpenAI.
   - Integrasi fail-safe JSON schema prompting fallback untuk model alternatif/BYOK.
   - Integrasi ceiling guard (maksimal 3 hop) dan batas waktu eksekusi.
4. **Fase 4: Verifikasi Menyeluruh & UI Harmonization (`AIChatView`)**
   - Suite end-to-end multi-turn conversation tests.
   - Penyempurnaan respons pada UI Copilot Hub (`AIChatView.tsx`) untuk merender tabel analitik mini dan kartu simulasi pembelian secara elegan.
