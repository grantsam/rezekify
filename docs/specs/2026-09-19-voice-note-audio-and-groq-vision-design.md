# REZEKIFY: Voice Note Audio Ingestion & Groq Vision Multimodal Fallback Design

**Document Type:** Architectural & Technical Design Specification (Spec)  
**Document ID:** `SPEC-2026-09-19-VOICE-NOTE-GROQ-VISION`  
**Target File:** `docs/specs/2026-09-19-voice-note-audio-and-groq-vision-design.md`  
**Author:** Principal System Architect  
**Status:** Approved for Implementation  
**Project Classification:** Program Komputer / Rekayasa Perangkat Lunak Berbasis Kecerdasan Buatan (HKI)  

---

## 1. Executive Summary & Context

### 1.1 Context & Problem Statement
Rezekify empowers users to maintain financial discipline through autonomous multimodal expense capture and a deterministic runway calculation engine. Currently, the system supports:
1. Natural language text input via web dashboard and Telegram bot.
2. Receipt image OCR via the web dashboard (`POST /api/v1/dashboard/ai-receipt`) and Telegram photo messages (`photo` array).
3. Rotary API key management (`RotaryKeyPool`) providing round-robin failover for Gemini 2.5 Flash and text-only Groq fallback (`llama-3.3-70b-versatile`).

However, two operational gaps limit user frictionlessness and system resilience:
1. **Audio Ingestion Gap (Telegram Voice Notes):**
   Users on the move frequently record spontaneous voice notes (e.g., "barusan beli bensin 35 ribu pake bca", "makan siang soto ayam dua puluh lima ribu gopay") rather than typing or taking photos. Telegram conveys these as native OGG Opus audio payloads (`voice`). The current `TelegramGateway` ignores voice updates, returning `"Unsupported message format."`
2. **Multimodal Vision Fallback Gap (Gemini Pool Exhaustion):**
   When processing receipt images, `ReActAgent.process_input()` relies exclusively on Gemini 2.5 Flash. If all Gemini keys in `RotaryKeyPool` trigger rate limits (HTTP 429 / `RESOURCE_EXHAUSTED`), the agent aborts vision extraction entirely. Even though a `groq_pool` may be configured, `_fallback_groq()` only accepts plain text strings. Receipt images submitted during peak hours or quota exhaustion fail completely without attempting a secondary vision model.

### 1.2 Core Capabilities Delivered
This specification designs two tightly coupled enhancements:
1. **Zero-Bloat Audio Ingestion Pipeline:**
   - Extend `TelegramGateway` to intercept Telegram `voice` payloads, fetch raw binary audio via an injected `voice_downloader`, and pass `.ogg` audio to `AgentOrchestrator.handle_voice()`.
   - Implement `ReActAgent.transcribe_audio()` using Groq Whisper (`whisper-large-v3`) with Indonesian language optimization (`language="id"`).
   - Feed the transcribed text directly into `AgentOrchestrator.handle_message()`, returning an acknowledgment of the transcribed utterance alongside deterministic ledger mutation and runway telemetry.
2. **Groq Vision Fallback Pipeline (`meta-llama/llama-4-scout-17b-16e-instruct`):**
   - Implement `ReActAgent._fallback_groq_vision()` using standard library Base64 data URL formatting (`data:{mime_type};base64,{encoded_bytes}`).
   - Update `ReActAgent.process_input()` to catch Gemini pool exhaustion on multimodal requests and fail over to Groq Vision.
   - Retain identical structured entity schema (`action`, `amount`, `account_name`, `category_name`, `note`, `from_account`, `to_account`) to ensure deterministic downstream execution.

---

## 2. Architectural Invariants

All components and workflows specified in this document strictly adhere to Rezekify's core architectural invariants:

```
+-----------------------------------------------------------------------------+
|                       REZEKIFY ARCHITECTURAL INVARIANTS                     |
+-----------------------------------------------------------------------------+
| 1. Deterministic Math      | Python decimal.Decimal & SQL NUMERIC(15,2).    |
|                            | Zero LLM calculation of balances or runway.    |
+----------------------------+------------------------------------------------+
| 2. Balanced Ledger         | Strict Double-Entry: Sum(Debit) = Sum(Credit). |
|                            | Unbalanced transactions atomically rolled back.|
+----------------------------+------------------------------------------------+
| 3. Tenant Isolation        | Strict Row-Level Scoping: WHERE user_id = :uid |
|                            | on every query, aggregation, and mutation.     |
+----------------------------+------------------------------------------------+
| 4. Rotary Key Resilience   | RotaryKeyPool round-robin rotation with 60s    |
|                            | cooldown on HTTP 429 for Gemini and Groq.      |
+----------------------------+------------------------------------------------+
| 5. Zero-Bloat Scope        | Zero external heavy audio libraries (ffmpeg,   |
|                            | pydub, torch). Native OGG pass-through & Groq. |
+----------------------------+------------------------------------------------+
```

### 2.1 Invariant 1: Deterministic Math via `decimal.Decimal`
Neither Whisper nor Groq Vision performs financial math or balance adjustments.
* Whisper transcribes raw acoustic waves into natural language text.
* Vision/LLM extract entity strings and raw numeric amounts into JSON.
* Amounts are coerced to `decimal.Decimal` via `Decimal(str(entities["amount"]))`.
* All balance decrements, increments, and daily safe runway recalculations are computed exclusively by `LedgerService` and `RunwayService`.

### 2.2 Invariant 2: Balanced Ledger Execution
Transactions originating from voice notes or fallback vision OCR produce double-entry ledger entries:
$$\sum \text{Debit} - \sum \text{Credit} = 0$$
* **Expense Transaction:**
  - DEBIT: Expense Category Account (+Amount)
  - CREDIT: Operational Asset Account (-Amount)
* **Income Transaction:**
  - DEBIT: Operational Asset Account (+Amount)
  - CREDIT: Income Category Account (+Amount)
* **Transfer Transaction:**
  - DEBIT: Destination Asset Account (+Amount)
  - CREDIT: Source Asset Account (-Amount)
Atomicity is strictly enforced; any database flush or constraint failure triggers an immediate rollback.

### 2.3 Invariant 3: Row-Level Tenant Isolation
All lookups and writes are bound to the authenticated `user_id`:
* Telegram chat mapping: `SELECT * FROM users WHERE telegram_chat_id = :chat_id`
* Account resolution: `SELECT * FROM accounts WHERE user_id = :user_id AND ...`
* Category resolution: `SELECT * FROM categories WHERE user_id = :user_id AND ...`
* Ledger mutations: `LedgerService.record_expense(user_id=user_id, ...)`

### 2.4 Invariant 4: Rotary Key Pool Resilience
Both Gemini and Groq pools use `RotaryKeyPool`:
* Round-robin traversal across configured API keys.
* Automatic 60-second cooldown registration upon encountering HTTP 429 (`RESOURCE_EXHAUSTED` or `rate_limit_exceeded`).
* When Whisper or Groq Vision hits HTTP 429, the active key is placed on cooldown and the next key is tried immediately.

### 2.5 Invariant 5: Zero-Bloat Scope & Native Audio Pass-Through
Standard Telegram voice messages are delivered in OGG container format encoded with the Opus codec (`audio/ogg; codecs=opus`).
* Groq Whisper API accepts binary `.ogg` files directly as a multipart file tuple `("voice.ogg", audio_bytes, "audio/ogg")`.
* No external media processing tools (`ffmpeg`, `libav`, `pydub`, `soundfile`, `scipy`) are required on the host system or container.
* Vision fallback utilizes standard library `base64.b64encode` without requiring Pillow or OpenCV.

---

## 3. Component Architecture & Detailed Workflows

### 3.1 End-to-End System Sequence Diagram

```
+----------+      +-----------------+      +-------------------+      +------------+      +---------------+      +---------------+
| Telegram |      | TelegramGateway |      | AgentOrchestrator |      | ReActAgent |      | LedgerService |      | RunwayService |
+----+-----+      +--------+--------+      +---------+---------+      +-----+------+      +-------+-------+      +-------+-------+
     |                     |                         |                      |                     |                      |
     | 1. Update (voice)   |                         |                      |                     |                      |
     +-------------------->|                         |                      |                     |                      |
     |                     | 2. voice_downloader()   |                      |                     |                      |
     |                     +-----------------+       |                      |                     |                      |
     |                     |                 |       |                      |                     |                      |
     |                     |<----------------+       |                      |                     |                      |
     |                     | (binary .ogg)           |                      |                     |                      |
     |                     |                         |                      |                     |                      |
     |                     | 3. handle_voice(uid, audio_bytes)              |                     |                      |
     |                     +------------------------>|                      |                     |                      |
     |                     |                         | 4. transcribe_audio()|                     |                      |
     |                     |                         +--------------------->|                     |                      |
     |                     |                         |                      | 5. Groq Whisper     |                      |
     |                     |                         |                      |    (whisper-v3, id) |                      |
     |                     |                         |                      +-----------+         |                      |
     |                     |                         |                      |           |         |                      |
     |                     |                         |                      |<----------+         |                      |
     |                     |                         | 6. text transcript   |                     |                      |
     |                     |                         |<---------------------+                     |                      |
     |                     |                         |                                            |                      |
     |                     |                         | 7. handle_message(uid, text)               |                      |
     |                     |                         |----+                                       |                      |
     |                     |                         |    | extract_entities()                    |                      |
     |                     |                         |<---+                                       |                      |
     |                     |                         |                                            |                      |
     |                     |                         | 8. record_expense(uid, amount, acc, cat)   |                      |
     |                     |                         +------------------------------------------->|                      |
     |                     |                         |                                            |----+                 |
     |                     |                         |                                            |    | Balanced Ledger |
     |                     |                         |                                            |<---+ (Debit=Credit)  |
     |                     |                         |<-------------------------------------------+                      |
     |                     |                         |                                                                   |
     |                     |                         | 9. calculate_runway(uid)                                          |
     |                     |                         +------------------------------------------------------------------>|
     |                     |                         |<------------------------------------------------------------------+
     |                     |                         |                                                                   |
     |                     | 10. {"transcription": ..., "reply": ...}                                                    |
     |                     |<------------------------+                                                                   |
     |                     |                                                                                             |
     | 11. Formatted Reply |                                                                                             |
     |     (Transkripsi +  |                                                                                             |
     |      Runway Status) |                                                                                             |
     |<--------------------+                                                                                             |
```

---

### 3.2 Detailed Component Specifications

#### 3.2.1 `TelegramGateway` (`rezekify/gateway/telegram_bot.py`)

**Responsibilities:**
- Ingest and parse Telegram webhook payloads containing text, photos, or voice notes.
- Verify user pairing and resolve `User` via `telegram_chat_id`.
- Delegate binary retrieval to `voice_downloader` and dispatch execution to `AgentOrchestrator`.

**Interface Changes:**
```python
class TelegramGateway:
    def __init__(
        self,
        db: Session,
        auth: Optional[AuthService] = None,
        orchestrator: Optional[AgentOrchestrator] = None,
        photo_downloader: Optional[Callable[[str], bytes]] = None,
        voice_downloader: Optional[Callable[[str], bytes]] = None,
    ):
        self.db = db
        self.auth = auth or AuthService(db)
        self.orchestrator = orchestrator or AgentOrchestrator(db)
        self.photo_downloader = photo_downloader
        self.voice_downloader = voice_downloader
```

**New Methods:**
* `process_voice_message(chat_id: int, audio_bytes: bytes, caption: Optional[str] = None) -> str`:
  1. Resolves `user = self.db.query(User).filter_by(telegram_chat_id=chat_id).first()`.
  2. If user not found, returns: `"Akun Telegram Anda belum terhubung ke rezekify. Silakan login ke Web Dashboard dan hubungkan akun dengan kode /link KODE."`
  3. If `not audio_bytes` or `len(audio_bytes) == 0`, returns: `"Gagal memproses pesan suara: audio kosong atau tidak dapat diunduh."`
  4. Calls `result = self.orchestrator.handle_voice(user.id, audio_bytes, caption=caption)`.
  5. Formats the final Telegram response:
     ```
     🎙️ Transkripsi: "{result['transcription']}"

     {result['reply']}
     ```
     If the transcription failed or voice note was inaudible, returns `result['reply']` directly.

* Update to `handle_update(update_dict: Dict[str, Any]) -> str`:
  Adds detection for voice and audio payloads:
  ```python
  voice = message.get("voice") or message.get("audio")
  if voice and isinstance(voice, dict):
      audio_bytes = (
          voice.get("audio_bytes")
          or voice.get("bytes")
          or message.get("audio_bytes")
      )
      if not audio_bytes and self.voice_downloader:
          file_id = voice.get("file_id")
          if file_id:
              audio_bytes = self.voice_downloader(file_id)

      if not audio_bytes:
          return "Gagal memproses pesan suara: data audio tidak ditemukan."

      caption = message.get("caption")
      return self.process_voice_message(
          chat_id=chat_id, audio_bytes=audio_bytes, caption=caption
      )
  ```

---

#### 3.2.2 `ReActAgent` (`rezekify/agent/runtime.py`)

**Responsibilities:**
- Transcribe audio files using Groq Whisper with rotary key failover.
- Perform fallback receipt extraction using Groq Vision when Gemini pool is exhausted.
- Route multimodal requests between Gemini and Groq transparently.

**New & Updated Methods:**

* `transcribe_audio(audio_bytes: bytes, filename: str = "voice.ogg") -> str`:
  Transcribes incoming binary audio using Groq's `whisper-large-v3` model.
  ```python
  def transcribe_audio(self, audio_bytes: bytes, filename: str = "voice.ogg") -> str:
      """Transcribes audio bytes to text using Groq Whisper with rotary key failover."""
      if not audio_bytes:
          return ""
      if not self.groq_pool or not self.groq_pool.keys:
          raise ValueError("Groq pool is required for audio transcription.")

      for _ in range(len(self.groq_pool.keys)):
          key = self.groq_pool.get_current_key()
          try:
              client = self.groq_pool.get_groq_client(api_key=key)
              # Standard Groq SDK accepts tuple: (filename, bytes_content, content_type)
              transcription = client.audio.transcriptions.create(
                  file=(filename, audio_bytes, "audio/ogg"),
                  model="whisper-large-v3",
                  language="id",
                  temperature=0.0,
              )
              return (transcription.text or "").strip()
          except Exception as e:
              err_str = str(e).lower()
              if "429" in err_str or "rate limit" in err_str:
                  self.groq_pool.report_rate_limit(key)
                  continue
              # Non-429 error encountered; abort retry loop
              break

      return ""
  ```

* `_fallback_groq_vision(text: str, image_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]`:
  Encodes image to a Base64 data URL and calls `meta-llama/llama-4-scout-17b-16e-instruct` via Groq chat completions.
  ```python
  def _fallback_groq_vision(
      self, text: str, image_bytes: bytes, mime_type: str = "image/jpeg"
  ) -> Dict[str, Any]:
      """Executes fallback entity extraction from receipt image using Groq Vision."""
      import base64

      base64_img = base64.b64encode(image_bytes).decode("utf-8")
      data_url = f"data:{mime_type};base64,{base64_img}"
      user_prompt = text or "Ekstrak informasi transaksi dari struk belanja ini."

      for _ in range(len(self.groq_pool.keys)):
          key = self.groq_pool.get_current_key()
          try:
              client = self.groq_pool.get_groq_client(api_key=key)
              messages = [
                  {"role": "system", "content": SYSTEM_PROMPT},
                  {
                      "role": "user",
                      "content": [
                          {"type": "text", "text": user_prompt},
                          {"type": "image_url", "image_url": {"url": data_url}},
                      ],
                  },
              ]
              completion = client.chat.completions.create(
                  model="meta-llama/llama-4-scout-17b-16e-instruct",
                  messages=messages,
                  temperature=0.1,
              )
              content = completion.choices[0].message.content or ""
              return self._clean_json_response(content)
          except Exception as e:
              err_str = str(e).lower()
              if "429" in err_str or "rate limit" in err_str:
                  self.groq_pool.report_rate_limit(key)
                  continue
              break

      return {"action": "unknown", "text": text}
  ```

* Updates to `process_input()`:
  Seamlessly chain to Groq Vision when Gemini pool rate limits or fails:
  ```python
  def process_input(
      self,
      user_id: UUID,
      text: str,
      image_bytes: Optional[bytes] = None,
      mime_type: str = "image/jpeg",
  ) -> Dict[str, Any]:
      # 1. Attempt Gemini first
      for _ in range(len(self.gemini_pool.keys)):
          key = self.gemini_pool.get_current_key()
          try:
              client = self.gemini_pool.get_gemini_client(api_key=key)
              contents = [SYSTEM_PROMPT, f"Input pengguna: {text}"]
              if image_bytes:
                  from google.genai import types
                  contents.append(
                      types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
                  )

              response = client.models.generate_content(
                  model="gemini-2.5-flash",
                  contents=contents,
              )
              return self._clean_json_response(response.text)
          except Exception as e:
              err_str = str(e).lower()
              if "429" in err_str or "resource_exhausted" in err_str or "rate limit" in err_str:
                  self.gemini_pool.report_rate_limit(key)
                  continue
              break

      # 2. Gemini exhausted: evaluate Groq fallbacks
      if self.groq_pool and self.groq_pool.keys:
          if image_bytes:
              return self._fallback_groq_vision(
                  text=text, image_bytes=image_bytes, mime_type=mime_type
              )
          return self._fallback_groq(text)

      return {"action": "unknown", "text": text}
  ```

---

#### 3.2.3 `AgentOrchestrator` (`rezekify/agent/orchestrator.py`)

**Responsibilities:**
- Coordinate between audio transcription, entity extraction, and deterministic Layer 1 financial mutations (`LedgerService`, `RunwayService`).

**New Method:**
* `handle_voice(user_id: UUID, audio_bytes: bytes, caption: Optional[str] = None) -> Dict[str, Any]`:
  ```python
  def handle_voice(
      self,
      user_id: UUID,
      audio_bytes: bytes,
      caption: Optional[str] = None,
  ) -> Dict[str, Any]:
      """Transcribes voice note audio and processes transaction via handle_message."""
      if not self.agent:
          return {
              "transcription": "",
              "reply": "❌ Layanan AI belum terkonfigurasi.",
              "success": False,
          }

      try:
          transcription = self.agent.transcribe_audio(audio_bytes)
      except Exception as e:
          return {
              "transcription": "",
              "reply": f"❌ Gagal memproses audio: {str(e)}",
              "success": False,
          }

      if not transcription or not transcription.strip():
          return {
              "transcription": "",
              "reply": "⚠️ Suara tidak terdengar jelas atau audio kosong. Silakan ulangi rekaman suara Anda.",
              "success": False,
          }

      # Combine transcription with optional caption
      effective_text = transcription
      if caption and caption.strip():
          effective_text = f"{transcription} ({caption.strip()})"

      # Dispatch to deterministic handler
      reply = self.handle_message(user_id=user_id, text=effective_text)
      return {
          "transcription": transcription,
          "reply": reply,
          "success": True,
      }
  ```

---

## 4. Error Handling & Edge Cases

| Scenario / Edge Case | Root Cause / Trigger | System Reaction & Mitigation | Return Message / Status |
| :--- | :--- | :--- | :--- |
| **Silent or Inaudible Voice Note** | User sends blank audio or background noise; Whisper produces `""` or whitespace. | `handle_voice()` detects empty string, halts pipeline without invoking LLM or Ledger. | `"⚠️ Suara tidak terdengar jelas atau audio kosong. Silakan ulangi rekaman suara Anda."` |
| **Empty or Truncated Audio Payload** | Network abort or corrupted upload yields `0` bytes. | `TelegramGateway.process_voice_message()` checks `not audio_bytes` before dispatching. | `"Gagal memproses pesan suara: audio kosong atau tidak dapat diunduh."` |
| **Oversized Audio Payload** | User uploads prolonged audio file (>25MB Telegram/Groq limit). | Pre-flight size guard validates `len(audio_bytes) <= 25 * 1024 * 1024`. Fast rejection. | `"❌ Ukuran pesan suara melebihi batas maksimal 25MB."` |
| **Missing Groq API Keys** | `groq_pool` is `None` or contains zero valid keys in environment. | `transcribe_audio()` checks pool presence; raises clear error caught by orchestrator. | `"❌ Layanan transkripsi suara belum terkonfigurasi pada sistem."` |
| **Whisper HTTP 429 Rate Limit** | Active Groq key exhausts minute request quota. | `transcribe_audio()` catches 429, calls `groq_pool.report_rate_limit(key)`, advances index, retries next key. | Automatic recovery; returns success if any key succeeds. |
| **Gemini Exhaustion on Receipt** | High traffic saturates all Gemini 2.5 Flash keys. | `process_input()` exhausts Gemini loop, switches to `_fallback_groq_vision()` using `llama-4-scout`. | Transparent fallback; user receives normal receipt confirmation. |
| **Groq Vision HTTP 429 Rate Limit** | Fallback vision model hits rate limit on key. | `_fallback_groq_vision()` catches 429, reports cooldown, rotates to next Groq key. | Transparent rotation across Groq keys. |
| **Both Gemini and Groq Pools Exhausted** | Total external provider rate limit blackout. | Graceful fail-soft. Both pools exhausted; returns `{"action": "unknown"}`. | `"⚠️ Struk tidak terbaca jelas. Pastikan foto terang dan menampilkan total belanja."` |
| **Unlinked Telegram Account** | Telegram user hasn't executed `/link KODE`. | Gateway verifies `telegram_chat_id` before processing voice bytes. | `"Akun Telegram Anda belum terhubung ke rezekify..."` |

---

## 5. Testing & Quality Strategy

Testing follows the Red-Green-Refactor discipline and uses isolated SQLite in-memory test databases with mock API clients.

### 5.1 Unit Tests for `ReActAgent` (`tests/test_agent_runtime.py`)

1. **`test_react_agent_transcribe_audio_success`:**
   - Arrange: Mock Groq client with `audio.transcriptions.create` returning an object with `text="beli soto 20rb"`.
   - Act: Call `agent.transcribe_audio(b"fake_ogg_bytes")`.
   - Assert: Returns `"beli soto 20rb"`, verifies Groq client called with `model="whisper-large-v3"` and `language="id"`.
2. **`test_react_agent_transcribe_audio_empty_bytes`:**
   - Act: Call `agent.transcribe_audio(b"")`.
   - Assert: Returns `""` immediately without invoking Groq client.
3. **`test_react_agent_transcribe_audio_rate_limit_rotation`:**
   - Arrange: Two Groq keys in `groq_pool`. First client raises `Exception("429 rate limit exceeded")`. Second client returns valid transcript.
   - Act: Call `agent.transcribe_audio(b"fake_ogg_bytes")`.
   - Assert: Returns valid transcript; verifies `groq_pool.cooldowns[key1] > 0`.
4. **`test_react_agent_fallback_groq_vision_success`:**
   - Arrange: Mock Groq client with `chat.completions.create` returning JSON string `{"action": "expense", "amount": 45000, "note": "Kopi"}`.
   - Act: Call `agent._fallback_groq_vision("struk", b"fake_png", "image/png")`.
   - Assert: Returns structured dict, verifies Base64 data URL formatted correctly in user message payload (`data:image/png;base64,...`).
5. **`test_react_agent_process_input_falls_back_to_groq_vision_when_gemini_fails`:**
   - Arrange: Gemini client raises 429; Groq client succeeds with vision model `meta-llama/llama-4-scout-17b-16e-instruct`.
   - Act: Call `agent.process_input(uid, "struk", image_bytes=b"sample_img", mime_type="image/jpeg")`.
   - Assert: Returns valid expense entities extracted via Groq Vision fallback.

### 5.2 Unit Tests for `AgentOrchestrator` (`tests/test_agent_orchestrator.py`)

1. **`test_orchestrator_handle_voice_success`:**
   - Arrange: Mock `agent.transcribe_audio` returning `"makan bakso 25rb pake gopay"`.
   - Act: Call `orchestrator.handle_voice(user.id, b"voice_ogg_bytes")`.
   - Assert:
     * Returns `{"transcription": "makan bakso 25rb pake gopay", "success": True, "reply": ...}`.
     * Ledger records an expense of Rp 25,000 against GoPay account.
2. **`test_orchestrator_handle_voice_silent_audio`:**
   - Arrange: Mock `agent.transcribe_audio` returning `""`.
   - Act: Call `orchestrator.handle_voice(user.id, b"silent_audio")`.
   - Assert: Returns `success=False` with `"⚠️ Suara tidak terdengar jelas..."`. No ledger mutation performed.
3. **`test_orchestrator_handle_voice_with_caption`:**
   - Arrange: Audio transcribed as `"beli bensin 50rb"`, caption provided as `"bensin motor"`.
   - Act: Call `orchestrator.handle_voice(user.id, b"voice_bytes", caption="bensin motor")`.
   - Assert: Combined text passed to `handle_message`, expense registered with proper description.

### 5.3 Unit Tests for `TelegramGateway` (`tests/test_telegram_bot.py`)

1. **`test_telegram_voice_message_unlinked_user`:**
   - Act: `gateway.process_voice_message(chat_id=999999, audio_bytes=b"sample_ogg")`.
   - Assert: Returns message warning user to link their account via `/link KODE`.
2. **`test_telegram_voice_message_empty_audio`:**
   - Act: `gateway.process_voice_message(chat_id=sample_user.telegram_chat_id, audio_bytes=b"")`.
   - Assert: Returns `"Gagal memproses pesan suara: audio kosong..."`.
3. **`test_telegram_voice_message_success`:**
   - Arrange: Mock `orchestrator.handle_voice` returning `{"transcription": "kopi 20rb", "reply": "✅ Tercatat: Rp 20,000", "success": True}`.
   - Act: `gateway.process_voice_message(chat_id=sample_user.telegram_chat_id, audio_bytes=b"valid_ogg")`.
   - Assert: Returns formatted reply containing `🎙️ Transkripsi: "kopi 20rb"` and `✅ Tercatat: Rp 20,000`.
4. **`test_telegram_handle_update_voice_dispatcher`:**
   - Arrange: Mock `voice_downloader` returning `b"downloaded_ogg"`.
   - Act: Call `gateway.handle_update(update_payload)` with `{"message": {"chat": {"id": 123}, "voice": {"file_id": "voice_file_99"}}}`.
   - Assert: `voice_downloader` invoked with `"voice_file_99"`, orchestrator voice handler triggered.

### 5.4 End-to-End Test (`tests/test_e2e_full_cycle.py`)

* **`test_e2e_voice_note_ingestion_and_runway_update`:**
  - Create test user, starting bank account balance Rp 1,000,000.
  - Ingest binary voice note payload through `TelegramGateway.handle_update()`.
  - Verify Whisper transcription output `"makan malam 50000 cash"`.
  - Assert balanced ledger entries in database:
    * DEBIT: Expense Category (Rp 50,000)
    * CREDIT: Cash Account (Rp 50,000)
    * $\sum \text{Debit} - \sum \text{Credit} = 0$
  - Assert daily safe runway recalculated dynamically and reflected in the Telegram response.

---

## 6. Implementation Checklist & Verification Gates

```
[ ] Phase 1: ReActAgent Runtime Extensions
    [ ] Implement `transcribe_audio(audio_bytes, filename)` with Groq Whisper & 429 rotation.
    [ ] Implement `_fallback_groq_vision(text, image_bytes, mime_type)` with Base64 encoding.
    [ ] Update `process_input()` to trigger Groq Vision fallback on Gemini pool exhaustion.
    [ ] Run pytest on `tests/test_agent_runtime.py`.

[ ] Phase 2: AgentOrchestrator Voice Integration
    [ ] Implement `handle_voice(user_id, audio_bytes, caption)` coordinating transcription and ledger execution.
    [ ] Write unit tests in `tests/test_agent_orchestrator.py`.
    [ ] Confirm zero calculation of money in agent layer (`decimal.Decimal` preserved).

[ ] Phase 3: Telegram Gateway Bot Updates
    [ ] Add `voice_downloader` parameter to `TelegramGateway.__init__`.
    [ ] Implement `process_voice_message(chat_id, audio_bytes, caption)`.
    [ ] Update `handle_update()` to intercept `voice` and `audio` payloads.
    [ ] Write unit tests in `tests/test_telegram_bot.py`.

[ ] Phase 4: Full-Stack Verification Gate
    [ ] Add end-to-end integration test in `tests/test_e2e_full_cycle.py`.
    [ ] Execute `pytest` across entire suite: 100% pass rate required.
    [ ] Execute `ruff check .` and `mypy rezekify`.
```
