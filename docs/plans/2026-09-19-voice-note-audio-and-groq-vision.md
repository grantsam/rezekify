# Voice Note Audio Ingestion & Groq Vision Multimodal Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement autonomous Telegram voice note audio ingestion with Groq Whisper (`whisper-large-v3`) transcription and multimodal Groq Vision fallback (`meta-llama/llama-4-scout-17b-16e-instruct`) for receipt processing upon Gemini key pool exhaustion, preserving deterministic `decimal.Decimal` double-entry ledger bookkeeping.

**Architecture:** Asymmetric dual-provider AI pipeline where Telegram voice notes (`audio/ogg`) are captured via an injected `voice_downloader` and transcribed into Indonesian natural language using Groq Whisper, while receipt image uploads automatically fail over to Groq Vision using Base64 data URLs when Gemini rate-limits. Extracted entities feed directly into `AgentOrchestrator`, which enforces deterministic Layer 1 financial mutations (`LedgerService`, `RunwayService`) and returns real-time runway status.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0, Pydantic v2, PostgreSQL / SQLite in-memory, Groq Python SDK (`groq`), google-genai, python-telegram-bot.

**Spec:** `docs/specs/2026-09-19-voice-note-audio-and-groq-vision-design.md`

## Global Constraints
* **Deterministic Accounting:** Zero LLM calculation of balances, ledger mutations, or runway; all money arithmetic runs in Python `decimal.Decimal` and SQL `NUMERIC(15,2)`.
* **Double-Entry Invariant:** Every expense transaction posted from voice notes or fallback vision OCR must maintain $\sum \text{Debit} = \sum \text{Credit}$.
* **Row-Level Tenant Isolation:** Every database query, account resolution, and ledger mutation enforces `WHERE user_id = :user_id`.
* **Zero-Bloat Audio Ingestion:** Zero external heavy audio processing dependencies (`ffmpeg`, `pydub`, `torch`). Pass native OGG Opus binary streams directly to the Groq Whisper multipart tuple.
* **Rotary Key Resilience:** Round-robin key rotation with 60s cooldown for both Gemini and Groq pools upon HTTP 429 (`RESOURCE_EXHAUSTED` / `rate_limit_exceeded`).
* **Audio Payload Ceiling:** Maximum voice note payload size: 25MB ($25 \times 1024 \times 1024 = 26,214,400\text{ bytes}$); empty or silent audio rejected gracefully.
* **Zero Truncation Rule:** All code snippets in this plan must be 100% complete, fully compilable, with zero placeholders or `TODO`s.

---

### Task 1: Groq Vision Multimodal Fallback (`rezekify/agent/runtime.py`)

**Files:**
- Modify: `rezekify/agent/runtime.py`
- Test: `tests/test_agent_runtime.py`

**Interfaces:**
- Consumes: `RotaryKeyPool` from `rezekify.agent.key_pool`, `SYSTEM_PROMPT` and `_clean_json_response` from `rezekify.agent.runtime`.
- Produces:
  ```python
  def _fallback_groq_vision(
      self, text: str, image_bytes: bytes, mime_type: str = "image/jpeg"
  ) -> Dict[str, Any]: ...
  ```
  and updated `process_input` routing multimodal requests to `_fallback_groq_vision` when Gemini key pool fails.

- [ ] **Step 1: Write the failing tests**

Add the following tests to `tests/test_agent_runtime.py` (replacing the previous `test_react_agent_image_fails_without_calling_groq`):

```python
def test_react_agent_fallback_groq_vision_success():
    groq_pool = RotaryKeyPool(keys=["GROQ_VISION_KEY"])
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_client = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"action": "expense", "amount": 45000, "account_name": "Cash", "category_name": "Makanan", "note": "Kopi Susu"}'
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_completion

    with patch.object(groq_pool, "get_groq_client", return_value=mock_client):
        res = agent._fallback_groq_vision(text="struk", image_bytes=b"sample_image_bytes", mime_type="image/png")
        assert res["action"] == "expense"
        assert res["amount"] == 45000
        assert res["note"] == "Kopi Susu"

        mock_client.chat.completions.create.assert_called_once()
        kwargs = mock_client.chat.completions.create.call_args[1]
        assert kwargs["model"] == "meta-llama/llama-4-scout-17b-16e-instruct"
        messages = kwargs["messages"]
        assert len(messages) == 2
        assert messages[1]["role"] == "user"
        content_parts = messages[1]["content"]
        assert content_parts[0]["type"] == "text"
        assert content_parts[1]["type"] == "image_url"
        assert content_parts[1]["image_url"]["url"].startswith("data:image/png;base64,")


def test_react_agent_fallback_groq_vision_rate_limit_rotation():
    groq_pool = RotaryKeyPool(keys=["GROQ_1", "GROQ_2"])
    gemini_pool = RotaryKeyPool(keys=["GEMINI_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_client_1 = MagicMock()
    mock_client_1.chat.completions.create.side_effect = Exception("429 rate limit exceeded")

    mock_client_2 = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"action": "expense", "amount": 12000, "note": "Roti"}'
    mock_completion.choices = [mock_choice]
    mock_client_2.chat.completions.create.return_value = mock_completion

    def mock_get_groq_client(api_key=None):
        return mock_client_1 if api_key == "GROQ_1" else mock_client_2

    with patch.object(groq_pool, "get_groq_client", side_effect=mock_get_groq_client):
        res = agent._fallback_groq_vision(text="struk", image_bytes=b"sample_bytes", mime_type="image/jpeg")
        assert res["action"] == "expense"
        assert res["amount"] == 12000
        assert groq_pool.cooldowns["GROQ_1"] > 0


def test_react_agent_process_input_falls_back_to_groq_vision_when_gemini_fails():
    gemini_pool = RotaryKeyPool(keys=["KEY_GEMINI"])
    groq_pool = RotaryKeyPool(keys=["KEY_GROQ"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_gemini = MagicMock()
    mock_gemini.models.generate_content.side_effect = Exception("429 Resource has been exhausted")

    mock_groq = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"action": "expense", "amount": 85000, "account_name": "Cash", "note": "Struk Supermarket"}'
    mock_completion.choices = [mock_choice]
    mock_groq.chat.completions.create.return_value = mock_completion

    fake_image_bytes = b"fake_jpeg_bytes"

    with patch("google.genai.types.Part.from_bytes"):
        with patch.object(gemini_pool, "get_gemini_client", return_value=mock_gemini):
            with patch.object(groq_pool, "get_groq_client", return_value=mock_groq):
                res = agent.process_input(
                    user_id=uuid4(), text="struk belanja", image_bytes=fake_image_bytes, mime_type="image/jpeg"
                )
                assert res["action"] == "expense"
                assert res["amount"] == 85000
                assert res["note"] == "Struk Supermarket"


def test_react_agent_process_input_image_fails_when_no_groq_pool():
    gemini_pool = RotaryKeyPool(keys=["KEY_GEMINI"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=None)

    mock_gemini = MagicMock()
    mock_gemini.models.generate_content.side_effect = Exception("429 Resource has been exhausted")

    fake_image_bytes = b"fake_jpeg_bytes"

    with patch("google.genai.types.Part.from_bytes"):
        with patch.object(gemini_pool, "get_gemini_client", return_value=mock_gemini):
            res = agent.process_input(
                user_id=uuid4(), text="struk", image_bytes=fake_image_bytes, mime_type="image/jpeg"
            )
            assert res["action"] == "unknown"
            assert res["text"] == "struk"
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pytest tests/test_agent_runtime.py -k "groq_vision" -v`
Expected: FAIL (`AttributeError: 'ReActAgent' object has no attribute '_fallback_groq_vision'`)

- [ ] **Step 3: Write minimal implementation**

In `rezekify/agent/runtime.py`, add `_fallback_groq_vision` and update `process_input`:

```python
    def _fallback_groq_vision(
        self, text: str, image_bytes: bytes, mime_type: str = "image/jpeg"
    ) -> Dict[str, Any]:
        """Executes fallback entity extraction from receipt image using Groq Vision."""
        import base64

        if not self.groq_pool or not self.groq_pool.keys:
            return {"action": "unknown", "text": text}

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

Update `process_input` in `rezekify/agent/runtime.py`:
```python
        # Fallback to Groq if configured
        if self.groq_pool and self.groq_pool.keys:
            if image_bytes:
                return self._fallback_groq_vision(
                    text=text, image_bytes=image_bytes, mime_type=mime_type
                )
            return self._fallback_groq(text)

        # Final graceful fallback if all attempts fail
        return {"action": "unknown", "text": text}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_agent_runtime.py -v`
Expected: PASS (all tests pass, including the 4 new vision fallback tests)

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/runtime.py tests/test_agent_runtime.py
git commit -m "feat(agent): implement groq vision fallback for multimodal receipt processing"
```

---

### Task 2: Groq Whisper Audio Transcription (`rezekify/agent/runtime.py`)

**Files:**
- Modify: `rezekify/agent/runtime.py`
- Test: `tests/test_agent_runtime.py`

**Interfaces:**
- Consumes: `RotaryKeyPool` from `rezekify.agent.key_pool`.
- Produces:
  ```python
  def transcribe_audio(self, audio_bytes: bytes, filename: str = "voice.ogg") -> str: ...
  ```

- [ ] **Step 1: Write the failing tests**

Add the following unit tests to `tests/test_agent_runtime.py`:

```python
def test_react_agent_transcribe_audio_success():
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY_1"])
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_groq = MagicMock()
    mock_transcription = MagicMock()
    mock_transcription.text = "beli soto ayam 25rb gopay"
    mock_groq.audio.transcriptions.create.return_value = mock_transcription

    with patch.object(groq_pool, "get_groq_client", return_value=mock_groq):
        text = agent.transcribe_audio(b"fake_ogg_bytes_audio", filename="custom.ogg")
        assert text == "beli soto ayam 25rb gopay"
        mock_groq.audio.transcriptions.create.assert_called_once_with(
            file=("custom.ogg", b"fake_ogg_bytes_audio", "audio/ogg"),
            model="whisper-large-v3",
            language="id",
            temperature=0.0,
        )


def test_react_agent_transcribe_audio_empty_bytes():
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY_1"])
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    assert agent.transcribe_audio(b"") == ""


def test_react_agent_transcribe_audio_oversized():
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY_1"])
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    oversized = b"x" * (25 * 1024 * 1024 + 1)
    with pytest.raises(ValueError, match="25MB"):
        agent.transcribe_audio(oversized)


def test_react_agent_transcribe_audio_no_groq_pool():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=None)

    with pytest.raises(ValueError, match="Groq pool is required"):
        agent.transcribe_audio(b"fake_bytes")


def test_react_agent_transcribe_audio_rotates_on_rate_limit():
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY_1", "GROQ_KEY_2"])
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_client_1 = MagicMock()
    mock_client_1.audio.transcriptions.create.side_effect = Exception("429 rate limit exceeded")

    mock_client_2 = MagicMock()
    mock_transcription = MagicMock()
    mock_transcription.text = "makan bakso 20000 cash"
    mock_client_2.audio.transcriptions.create.return_value = mock_transcription

    def mock_get_groq_client(api_key=None):
        return mock_client_1 if api_key == "GROQ_KEY_1" else mock_client_2

    with patch.object(groq_pool, "get_groq_client", side_effect=mock_get_groq_client):
        text = agent.transcribe_audio(b"audio_bytes")
        assert text == "makan bakso 20000 cash"
        assert groq_pool.cooldowns["GROQ_KEY_1"] > 0
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pytest tests/test_agent_runtime.py -k "transcribe_audio" -v`
Expected: FAIL (`AttributeError: 'ReActAgent' object has no attribute 'transcribe_audio'`)

- [ ] **Step 3: Write minimal implementation**

In `rezekify/agent/runtime.py`, add `transcribe_audio` inside `ReActAgent`:

```python
    def transcribe_audio(self, audio_bytes: bytes, filename: str = "voice.ogg") -> str:
        """Transcribes audio bytes to text using Groq Whisper with rotary key failover."""
        if not audio_bytes:
            return ""
        if len(audio_bytes) > 25 * 1024 * 1024:
            raise ValueError("Ukuran file audio melebihi batas maksimal 25MB.")
        if not self.groq_pool or not self.groq_pool.keys:
            raise ValueError("Groq pool is required for audio transcription.")

        for _ in range(len(self.groq_pool.keys)):
            key = self.groq_pool.get_current_key()
            try:
                client = self.groq_pool.get_groq_client(api_key=key)
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
                break

        return ""
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_agent_runtime.py -k "transcribe_audio" -v`
Expected: PASS (all 5 transcription tests pass)

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/runtime.py tests/test_agent_runtime.py
git commit -m "feat(agent): implement groq whisper audio transcription with key rotation"
```

---

### Task 3: AgentOrchestrator Voice Handling (`rezekify/agent/orchestrator.py`)

**Files:**
- Modify: `rezekify/agent/orchestrator.py`
- Test: `tests/test_agent_orchestrator.py`

**Interfaces:**
- Consumes: `ReActAgent.transcribe_audio` from `rezekify.agent.runtime`, `AgentOrchestrator.handle_message` from `rezekify.agent.orchestrator`.
- Produces:
  ```python
  def handle_voice(
      self,
      user_id: UUID,
      audio_bytes: bytes,
      caption: Optional[str] = None,
  ) -> Dict[str, Any]: ...
  ```

- [ ] **Step 1: Write the failing tests**

Add the following tests to `tests/test_agent_orchestrator.py`:

```python
def test_orchestrator_handle_voice_success(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("100000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    mock_agent = MagicMock()
    mock_agent.transcribe_audio.return_value = "makan bakso 25rb pake gopay"
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    orchestrator.extract_entities = MagicMock(
        return_value={
            "action": "expense",
            "amount": 25000,
            "account_name": "GoPay",
            "category_name": "Makanan",
            "note": "Bakso",
        }
    )

    result = orchestrator.handle_voice(user_id=sample_user.id, audio_bytes=b"sample_ogg_bytes")
    assert result["success"] is True
    assert result["transcription"] == "makan bakso 25rb pake gopay"
    assert "Rp 25,000" in result["reply"]

    db_session.refresh(acc)
    assert acc.current_balance == Decimal("75000.00")


def test_orchestrator_handle_voice_silent_audio(db_session, sample_user):
    mock_agent = MagicMock()
    mock_agent.transcribe_audio.return_value = ""
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)

    result = orchestrator.handle_voice(user_id=sample_user.id, audio_bytes=b"silent_ogg")
    assert result["success"] is False
    assert result["transcription"] == ""
    assert "Suara tidak terdengar jelas" in result["reply"]


def test_orchestrator_handle_voice_oversized_audio(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    oversized = b"0" * (25 * 1024 * 1024 + 1)
    result = orchestrator.handle_voice(user_id=sample_user.id, audio_bytes=oversized)
    assert result["success"] is False
    assert "25MB" in result["reply"]


def test_orchestrator_handle_voice_with_caption(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("200000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    mock_agent = MagicMock()
    mock_agent.transcribe_audio.return_value = "isi bensin 50rb"
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    orchestrator.extract_entities = MagicMock(
        return_value={
            "action": "expense",
            "amount": 50000,
            "account_name": "BCA",
            "category_name": "Transport",
            "note": "Bensin Motor",
        }
    )

    result = orchestrator.handle_voice(
        user_id=sample_user.id, audio_bytes=b"voice_bytes", caption="bensin motor"
    )
    assert result["success"] is True
    assert result["transcription"] == "isi bensin 50rb"
    assert "Rp 50,000" in result["reply"]


def test_orchestrator_handle_voice_without_agent(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session, agent=None)
    result = orchestrator.handle_voice(user_id=sample_user.id, audio_bytes=b"audio_bytes")
    assert result["success"] is False
    assert "Layanan AI belum terkonfigurasi" in result["reply"]
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pytest tests/test_agent_orchestrator.py -k "handle_voice" -v`
Expected: FAIL (`AttributeError: 'AgentOrchestrator' object has no attribute 'handle_voice'`)

- [ ] **Step 3: Write minimal implementation**

In `rezekify/agent/orchestrator.py`, add `handle_voice` to `AgentOrchestrator`:

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

        if not audio_bytes:
            return {
                "transcription": "",
                "reply": "Gagal memproses pesan suara: audio kosong atau tidak dapat diunduh.",
                "success": False,
            }

        if len(audio_bytes) > 25 * 1024 * 1024:
            return {
                "transcription": "",
                "reply": "❌ Ukuran pesan suara melebihi batas maksimal 25MB.",
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_agent_orchestrator.py -k "handle_voice" -v`
Expected: PASS (all 5 voice handling tests pass)

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/orchestrator.py tests/test_agent_orchestrator.py
git commit -m "feat(agent): implement orchestrator voice handling and ledger coordination"
```

---

### Task 4: Telegram Gateway Voice Note Integration (`rezekify/gateway/telegram_bot.py`)

**Files:**
- Modify: `rezekify/gateway/telegram_bot.py`
- Test: `tests/test_telegram_bot.py`

**Interfaces:**
- Consumes: `AgentOrchestrator.handle_voice` from `rezekify.agent.orchestrator`.
- Produces:
  ```python
  class TelegramGateway:
      def __init__(
          self,
          db: Session,
          auth: Optional[AuthService] = None,
          orchestrator: Optional[AgentOrchestrator] = None,
          photo_downloader: Optional[Callable[[str], bytes]] = None,
          voice_downloader: Optional[Callable[[str], Optional[bytes]]] = None,
      ): ...

      def process_voice_message(
          self, chat_id: int, audio_bytes: bytes, caption: Optional[str] = None
      ) -> str: ...
  ```
  and `TelegramBot = TelegramGateway` module alias.

- [ ] **Step 1: Write the failing tests**

Add the following unit tests to `tests/test_telegram_bot.py`:

```python
def test_telegram_voice_message_unlinked_user(db_session):
    gateway = TelegramGateway(db_session)
    reply = gateway.process_voice_message(chat_id=998877, audio_bytes=b"sample_ogg")
    assert "belum terhubung" in reply


def test_telegram_voice_message_empty_audio(db_session, sample_user):
    sample_user.telegram_chat_id = 123456
    db_session.commit()

    gateway = TelegramGateway(db_session)
    reply = gateway.process_voice_message(chat_id=123456, audio_bytes=b"")
    assert "audio kosong atau tidak dapat diunduh" in reply


def test_telegram_voice_message_oversized_audio(db_session, sample_user):
    sample_user.telegram_chat_id = 123456
    db_session.commit()

    gateway = TelegramGateway(db_session)
    reply = gateway.process_voice_message(
        chat_id=123456, audio_bytes=b"x" * (25 * 1024 * 1024 + 1)
    )
    assert "25MB" in reply


def test_telegram_voice_message_success(db_session, sample_user):
    sample_user.telegram_chat_id = 654321
    db_session.commit()

    gateway = TelegramGateway(db_session)
    gateway.orchestrator.handle_voice = MagicMock(
        return_value={
            "transcription": "kopi susu 20rb gopay",
            "reply": "✅ Tercatat: Rp 20,000 via GoPay.",
            "success": True,
        }
    )

    reply = gateway.process_voice_message(chat_id=654321, audio_bytes=b"valid_ogg_bytes")
    assert '🎙️ Transkripsi: "kopi susu 20rb gopay"' in reply
    assert "✅ Tercatat: Rp 20,000" in reply


def test_telegram_handle_update_voice_with_downloader(db_session, sample_user):
    sample_user.telegram_chat_id = 998811
    db_session.commit()

    mock_downloader = MagicMock(return_value=b"downloaded_ogg_audio")
    gateway = TelegramGateway(db_session, voice_downloader=mock_downloader)
    gateway.process_voice_message = MagicMock(return_value="Voice processed OK")

    update_payload = {
        "update_id": 2001,
        "message": {
            "chat": {"id": 998811},
            "caption": "Catatan sore",
            "voice": {"file_id": "telegram_voice_file_001", "duration": 3},
        },
    }
    reply = gateway.handle_update(update_payload)
    assert reply == "Voice processed OK"
    mock_downloader.assert_called_once_with("telegram_voice_file_001")
    gateway.process_voice_message.assert_called_once_with(
        chat_id=998811, audio_bytes=b"downloaded_ogg_audio", caption="Catatan sore"
    )


def test_telegram_handle_update_voice_inline_bytes(db_session, sample_user):
    sample_user.telegram_chat_id = 998822
    db_session.commit()

    gateway = TelegramGateway(db_session)
    gateway.process_voice_message = MagicMock(return_value="Voice processed OK")

    update_payload = {
        "update_id": 2002,
        "message": {
            "chat": {"id": 998822},
            "voice": {"file_id": "file_inline", "audio_bytes": b"inline_ogg_bytes"},
        },
    }
    reply = gateway.handle_update(update_payload)
    assert reply == "Voice processed OK"
    gateway.process_voice_message.assert_called_once_with(
        chat_id=998822, audio_bytes=b"inline_ogg_bytes", caption=None
    )


def test_telegram_handle_update_voice_missing_bytes(db_session):
    gateway = TelegramGateway(db_session)
    update_payload = {
        "update_id": 2003,
        "message": {
            "chat": {"id": 12345},
            "voice": {"file_id": "file_without_downloader"},
        },
    }
    reply = gateway.handle_update(update_payload)
    assert "data audio tidak ditemukan" in reply
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pytest tests/test_telegram_bot.py -k "voice" -v`
Expected: FAIL (`AttributeError: 'TelegramGateway' object has no attribute 'process_voice_message'`)

- [ ] **Step 3: Write minimal implementation**

In `rezekify/gateway/telegram_bot.py`, update `__init__`, add `process_voice_message`, update `handle_update`, and expose `TelegramBot` alias:

```python
class TelegramGateway:
    """Gateway dispatcher translating Telegram webhook updates and commands into rezekify actions."""

    def __init__(
        self,
        db: Session,
        auth: Optional[AuthService] = None,
        orchestrator: Optional[AgentOrchestrator] = None,
        photo_downloader: Optional[Callable[[str], bytes]] = None,
        voice_downloader: Optional[Callable[[str], Optional[bytes]]] = None,
    ):
        self.db = db
        self.auth = auth or AuthService(db)
        self.orchestrator = orchestrator or AgentOrchestrator(db)
        self.photo_downloader = photo_downloader
        self.voice_downloader = voice_downloader

    def process_voice_message(
        self, chat_id: int, audio_bytes: bytes, caption: Optional[str] = None
    ) -> str:
        """Handles incoming voice note messages for audio transcription and expense logging."""
        user = self.db.query(User).filter_by(telegram_chat_id=chat_id).first()
        if not user:
            return (
                "Akun Telegram Anda belum terhubung ke rezekify. "
                "Silakan login ke Web Dashboard dan hubungkan akun dengan kode `/link KODE`."
            )

        if not audio_bytes:
            return "Gagal memproses pesan suara: audio kosong atau tidak dapat diunduh."

        if len(audio_bytes) > 25 * 1024 * 1024:
            return "❌ Ukuran pesan suara melebihi batas maksimal 25MB."

        result = self.orchestrator.handle_voice(
            user_id=user.id, audio_bytes=audio_bytes, caption=caption
        )
        if not result.get("success") or not result.get("transcription"):
            return result.get("reply", "Gagal memproses pesan suara.")

        return f'🎙️ Transkripsi: "{result["transcription"]}"\n\n{result["reply"]}'

    def handle_update(self, update_dict: Dict[str, Any]) -> str:
        """Parses a generic Telegram webhook update JSON dictionary (text, photo, or voice)."""
        message = update_dict.get("message") or update_dict.get("edited_message", {})
        chat = message.get("chat", {})
        chat_id = chat.get("id")
        if not chat_id:
            return "Invalid update payload: missing chat.id"

        text = message.get("text")
        if text:
            return self.process_text_message(chat_id=chat_id, text=text)

        photos = message.get("photo")
        if photos and isinstance(photos, list):
            highest_photo = max(
                photos,
                key=lambda p: p.get("file_size", 0) or (p.get("width", 0) * p.get("height", 0)),
            )
            image_bytes = (
                highest_photo.get("image_bytes")
                or highest_photo.get("bytes")
                or message.get("image_bytes")
            )
            if not image_bytes and self.photo_downloader:
                file_id = highest_photo.get("file_id")
                if file_id:
                    image_bytes = self.photo_downloader(file_id)

            if not image_bytes:
                return "Gagal memproses foto: data gambar tidak ditemukan."

            caption = message.get("caption")
            return self.process_photo_message(
                chat_id=chat_id, image_bytes=image_bytes, caption=caption
            )

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

        return "Unsupported message format."


TelegramBot = TelegramGateway
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_telegram_bot.py -k "voice" -v`
Expected: PASS (all 7 voice tests pass)

- [ ] **Step 5: Commit**

```bash
git add rezekify/gateway/telegram_bot.py tests/test_telegram_bot.py
git commit -m "feat(gateway): integrate voice note ingestion and transcription in telegram bot"
```

---

### Task 5: End-to-End System Verification & Regression Suite (`tests/test_e2e_full_cycle.py`)

**Files:**
- Modify: `tests/test_e2e_full_cycle.py`

**Interfaces:**
- Consumes: Complete stack (`TelegramGateway`, `AgentOrchestrator`, `ReActAgent`, `LedgerService`, `RunwayService`).
- Produces: Integrated test asserting voice note ingestion, Whisper transcription, double-entry ledger mutation, and runway telemetry.

- [ ] **Step 1: Add E2E voice note integration test**

Add `test_e2e_voice_note_ingestion_and_runway_update` to `tests/test_e2e_full_cycle.py`:

```python
def test_e2e_voice_note_ingestion_and_runway_update():
    """Validates Telegram voice note ingestion, Whisper transcription, double-entry ledger mutation, and runway telemetry."""
    db = TestingSessionLocal()
    try:
        from rezekify.services.auth import AuthService
        from rezekify.db.models import Account, AccountType
        auth_service = AuthService(db)
        user = auth_service.register_user(
            email="voice_student@rezekify.id",
            password="SecurePassword123!",
            full_name="Suara Mahasiswa",
        )
        user.telegram_chat_id = 445566
        acc = Account(
            user_id=user.id,
            name="BCA",
            account_type=AccountType.BANK,
            current_balance=Decimal("1000000.00"),
        )
        db.add(acc)
        db.commit()

        mock_downloader = MagicMock(return_value=b"fake_voice_ogg_bytes")
        gateway = TelegramGateway(db=db, voice_downloader=mock_downloader)

        gateway.orchestrator.agent = MagicMock()
        gateway.orchestrator.agent.transcribe_audio.return_value = "makan malam 50000 bca"
        gateway.orchestrator.extract_entities = MagicMock(
            return_value={
                "action": "expense",
                "amount": 50000,
                "account_name": "BCA",
                "category_name": "Makanan",
                "note": "Makan Malam",
            }
        )

        update_payload = {
            "update_id": 9901,
            "message": {
                "chat": {"id": 445566},
                "voice": {"file_id": "voice_record_file_id_42"},
            },
        }

        reply = gateway.handle_update(update_payload)
        assert '🎙️ Transkripsi: "makan malam 50000 bca"' in reply
        assert "Rp 50,000" in reply
        assert "Makan Malam" in reply

        db.refresh(acc)
        assert acc.current_balance == Decimal("950000.00")
    finally:
        db.close()
```

- [ ] **Step 2: Run the full test suite to verify zero regressions**

Run: `pytest`
Expected: PASS with 100% pass rate (117+ tests passed, 0 failures)

- [ ] **Step 3: Run static analysis and linting gates**

Run: `ruff check .`
Expected: All checks passed.

Run: `mypy rezekify`
Expected: Success: no issues found in source files.

- [ ] **Step 4: Commit**

```bash
git add tests/test_e2e_full_cycle.py
git commit -m "test(e2e): add verification suite for telegram voice note ingestion and runway update"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - `_fallback_groq_vision` with Base64 data URL and key failover: Covered in Task 1.
  - `transcribe_audio` with `whisper-large-v3`, `language="id"`, 25MB ceiling, and 429 key failover: Covered in Task 2.
  - `handle_voice` in `AgentOrchestrator` combining transcription with optional caption: Covered in Task 3.
  - `TelegramGateway` voice message processing, `voice_downloader` injection, and `handle_update`: Covered in Task 4.
  - End-to-end integration test & regression checks: Covered in Task 5.
- [x] **Placeholder scan:** Verified zero occurrences of TODO, TBD, "implement later", or vague instructions; all code snippets are complete and compilable.
- [x] **Type consistency:**
  - `transcribe_audio(audio_bytes: bytes, filename: str = "voice.ogg") -> str`
  - `_fallback_groq_vision(text: str, image_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]`
  - `handle_voice(user_id: UUID, audio_bytes: bytes, caption: Optional[str] = None) -> Dict[str, Any]`
  - `process_voice_message(chat_id: int, audio_bytes: bytes, caption: Optional[str] = None) -> str`
  - `voice_downloader: Optional[Callable[[str], Optional[bytes]]] = None`
  - Exact parameter names and types match across all 5 tasks.
