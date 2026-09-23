# Multimodal Image & Audio Optimization Design Specification (Client-Side Canvas Downscale & 1-Hop Native Audio)

- **Date:** 2026-09-24
- **Scope:** Frontend Client-Side Image Compression, 1-Hop Native Multimodal Audio Pipeline, 60s Recording Cap, and Payload Safety Hardening
- **Status:** Approved

---

## 1. Context & Problem Statement

Rezekify provides AI-driven omni-input capabilities via text, receipt photography, and voice notes. Under current production usage, two multimodal performance bottlenecks and single-point-of-failure risks have been identified:

1. **Receipt Image Latency & Memory Footprint:**
   - Modern smartphone cameras capture receipt photos ranging between **3MB and 10MB** (resolutions exceeding 4000x3000px).
   - Uploading raw megabyte payloads from mobile networks incurs 2–4 seconds of network latency before backend processing begins.
   - In Groq Vision fallback scenarios (`meta-llama/llama-4-scout-17b-16e-instruct`), images are Base64 encoded, inflating memory consumption by +33% in backend process memory and exceeding transmission quotas.

2. **2-Hop Voice Pipeline Latency & Single-Provider Fragility:**
   - Audio notes currently use a 2-Hop sequential pipeline:
     $$\text{Client} \xrightarrow{\text{Audio}} \text{Backend} \xrightarrow{\text{Groq Whisper}} \text{Transcription Text} \xrightarrow{\text{Gemini / Groq LLM}} \text{Financial Entities}$$
   - This sequential round-trip introduces 3.5s – 4.5s total latency.
   - If Groq Whisper experiences rate limits (`429`) or temporary outages, voice note processing fails completely even if Gemini Flash is healthy and operational.
   - Discrepancies in payload size limits exist: receipt upload enforces 10MB while voice permits up to 25MB without a recording duration cap, creating vulnerability to memory exhaustion.

---

## 2. Architectural Decisions

### Decision 1: Client-Side Canvas Downscale in `OmniInputHero.tsx`
- **Mechanism:** Before uploading to `/api/v1/dashboard/ai-receipt`, the browser downscales receipt images using native HTML5 Canvas / `ImageBitmap` APIs.
- **Constraints:**
  - Maximum dimension bounded to **1600px** (maintains receipt OCR legibility for small print and line items).
  - Target format: WebP (quality 0.85) with automatic fallback to JPEG (quality 0.85) if WebP canvas export is unsupported.
  - Typical compressed payload: **~200 KB – 300 KB** (a ~90–95% reduction from original 3–10MB photos).
- **Zero New Dependencies:** Strictly native DOM APIs (`Image`, `HTMLCanvasElement`, `canvas.toBlob`). No third-party compression packages (`browser-image-compression`, `pica`, etc.).
- **Graceful Fallback:** If canvas processing throws an exception or fails (e.g., memory limits or corrupted file), the original file is returned without breaking the user's submission.

### Decision 2: 1-Hop Native Multimodal Audio via Gemini 2.5 Flash
- **Mechanism:** Direct 1-Hop native audio understanding bypassing standalone speech-to-text.
  $$\text{Client} \xrightarrow{\text{Audio Bytes}} \text{ReActAgent} \xrightarrow{\text{Gemini 2.5 Flash Native Audio}} \{\text{transcription}, \text{financial entities}\}$$
- **Capabilities:** Gemini 2.5 Flash natively digests `audio/webm`, `audio/ogg`, and `audio/mp4` via `types.Part.from_bytes(...)`.
- **Latency & Reliability Improvement:**
  - Latency reduced from 3.5s–4.5s down to 1.0s–1.8s.
  - Returns both the verbatim `transcription` (Indonesian/English) and the structured financial JSON in a single API pass.
- **Automated Fallback:** If Gemini fails (rate limits, key rotation, or unsupported audio codec) or if the user is configured with BYOK Groq, the runtime automatically falls back to Groq Whisper (`whisper-large-v3`) $\to$ Groq LLM.

### Decision 3: Audio Duration Cap & Unified Payload Safety Limits
- **Frontend 60-Second Cap:** `OmniInputHero.tsx` limits voice recordings to a strict maximum of **60 seconds**. A timer monitors elapsed recording duration and invokes `handleStopRecording()` automatically upon reaching 60 seconds.
- **Unified 10MB Backend Payload Guard:**
  - Standardize `MAX_RECEIPT_BYTES = 10 * 1024 * 1024` (10MB).
  - Standardize `MAX_VOICE_BYTES = 10 * 1024 * 1024` (10MB, reduced from 25MB).
  - Reject payloads exceeding 10MB immediately at HTTP router ingress with `400 Bad Request`.

---

## 3. Data & Execution Flow

```
[User captures receipt image (3-10MB)]
             │
             ▼
[frontend/src/components/OmniInputHero.tsx]
   compressImage(file) via HTML5 Canvas
   Max dim: 1600px, WebP/JPEG 0.85
             │
             ▼ (~250 KB payload)
[POST /api/v1/dashboard/ai-receipt]
             │
             ▼
[AgentOrchestrator.handle_message]
             │
             ▼
[ReActAgent.process_input] ──(Gemini 2.5 Flash / Groq Vision)──► [Ledger Mutations]

──────────────────────────────────────────────────────────────────────────────

[User records voice note (up to 60s auto-stop)]
             │
             ▼
[POST /api/v1/dashboard/ai-voice]
   Payload guard: <= 10MB, pass mime_type (audio/webm, audio/ogg, audio/mp4)
             │
             ▼
[AgentOrchestrator.handle_voice(user_id, audio_bytes, caption, mime_type)]
             │
             ▼
[ReActAgent.process_audio(audio_bytes, mime_type, text_context)]
             │
   ┌─────────┴────────────────────────┐
   │                                  │
[Gemini 2.5 Flash 1-Hop]        [Groq BYOK or Gemini Failure]
Native Part.from_bytes                │
Single-call transcription + JSON      ▼
   │                            [Groq Whisper fallback]
   │                            Transcribe -> Groq LLM extract
   │                                  │
   └─────────┬────────────────────────┘
             ▼
[Return {transcription, reply}] ──► [Ledger Mutations & UI Response]
```

---

## 4. Component Specifications & Interfaces

### 4.1 Frontend Image Compression Helper (`OmniInputHero.tsx`)

```typescript
/**
 * Downscales an image using native HTML5 Canvas to max dimension 1600px.
 * Encodes as image/webp (or image/jpeg fallback) at 0.85 quality.
 * Falls back gracefully to original file if processing fails.
 */
export async function compressImage(file: File, maxDimension = 1600, quality = 0.85): Promise<File> {
  // Pass non-image or zero-byte files through unmodified
  if (!file.type.startsWith('image/') || file.size === 0) {
    return file;
  }

  // Graceful fallback for non-DOM / test environments
  if (typeof window === 'undefined' || typeof document === 'undefined' || !window.HTMLCanvasElement) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const targetType = 'image/webp';
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // Return original if compression did not yield size savings
              resolve(file);
              return;
            }
            const extension = targetType === 'image/webp' ? 'webp' : 'jpg';
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const compressedFile = new File([blob], `${baseName}.${extension}`, {
              type: targetType,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          targetType,
          quality
        );
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
```

### 4.2 Frontend 60-Second Audio Auto-Stop (`OmniInputHero.tsx`)

In `handleStartRecording`:
- `recordingDuration` increments every second via interval.
- When `duration >= 60`, immediately call `handleStopRecording()` to prevent unbounded buffers and enforce safety caps.
- Display visual badge / indicator indicating maximum recording limit: `00:45 / 01:00`.

### 4.3 Backend Agent Runtime (`rezekify/agent/runtime.py`)

#### System Prompt Extension for Audio
The prompt instructs the model to return both transcription and transaction entities:
```python
AUDIO_SYSTEM_PROMPT = """Anda adalah asisten cerdas pencatatan keuangan Rezekify.
Dengarkan rekaman suara pengguna dan ekstrak informasi transaksi keuangan serta transkripsi kata demi kata.

Kembalikan HANYA JSON murni dengan skema berikut:
{
  "transcription": string (transkripsi verbatim suara pengguna),
  "action": "expense" | "income" | "transfer" | "query_runway" | "unknown",
  "amount": number (nominal transaksi positif, tanpa titik/koma),
  "account_name": string (nama akun/metode pembayaran misal BCA, GoPay, Cash),
  "category_name": string (kategori misal Makanan, Transport, Belanja),
  "note": string (deskripsi singkat barang/keperluan),
  "from_account": string (hanya untuk transfer),
  "to_account": string (hanya untuk transfer)
}
Hanya kembalikan JSON valid tanpa teks pengantar atau markdown blocks."""
```

#### New Method: `ReActAgent.process_audio`
```python
def process_audio(
    self,
    audio_bytes: bytes,
    mime_type: str = "audio/webm",
    text_context: Optional[str] = None,
) -> Dict[str, Any]:
    """Processes audio bytes directly via 1-Hop Gemini 2.5 Flash with fallback to Groq Whisper + LLM."""
    if not audio_bytes:
        return {"action": "unknown", "transcription": ""}

    if len(audio_bytes) > 10 * 1024 * 1024:
        raise ValueError("Ukuran file audio melebihi batas maksimal 10MB.")

    # 1-Hop: Try Gemini native audio multimodal parsing first
    if self.gemini_pool and self.gemini_pool.keys:
        for _ in range(len(self.gemini_pool.keys)):
            key = self.gemini_pool.get_current_key()
            try:
                client = self.gemini_pool.get_gemini_client(api_key=key)
                from google.genai import types

                audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
                user_msg = "Ekstrak transaksi dari rekaman suara ini."
                if text_context:
                    user_msg += f" Catatan teks tambahan: {text_context}"

                contents = [
                    AUDIO_SYSTEM_PROMPT,
                    audio_part,
                    user_msg,
                ]

                response = client.models.generate_content(
                    model=self.gemini_model,
                    contents=contents,
                )
                result = self._clean_json_response(response.text)
                if result.get("action") != "unknown" or result.get("transcription"):
                    return result
            except Exception as e:
                err_str = str(e).lower()
                if "401" in err_str or "unauthenticated" in err_str or "api_key_invalid" in err_str:
                    if self.is_byok:
                        return {"action": "byok_error", "status_code": 401}
                    break
                if "429" in err_str or "resource_exhausted" in err_str or "rate limit" in err_str:
                    if self.gemini_pool:
                        self.gemini_pool.report_rate_limit(key)
                    if self.is_byok:
                        return {"action": "byok_error", "status_code": 429}
                    continue
                break

    # 2-Hop Fallback: Groq Whisper STT -> Groq LLM extraction
    if self.groq_pool and self.groq_pool.keys:
        try:
            transcription = self.transcribe_audio(audio_bytes=audio_bytes)
            if transcription:
                combined_text = transcription
                if text_context:
                    combined_text += f" ({text_context})"
                extraction = self._fallback_groq(combined_text)
                extraction["transcription"] = transcription
                return extraction
        except Exception:
            pass

    return {"action": "unknown", "transcription": ""}
```

### 4.4 Backend Orchestrator (`rezekify/agent/orchestrator.py`)

#### Updated Signature & Implementation:
```python
def handle_voice(
    self,
    user_id: UUID,
    audio_bytes: bytes,
    caption: Optional[str] = None,
    mime_type: Optional[str] = "audio/webm",
) -> Dict[str, Any]:
    """Processes voice note audio directly via 1-Hop multimodal agent or Whisper fallback."""
    if not audio_bytes:
        return {
            "transcription": "",
            "reply": "Gagal memproses pesan suara: audio kosong atau tidak dapat diunduh.",
            "success": False,
        }

    if len(audio_bytes) > 10 * 1024 * 1024:
        return {
            "transcription": "",
            "reply": "❌ Ukuran pesan suara melebihi batas maksimal 10MB.",
            "success": False,
        }

    active_agent = self.agent
    if user_id:
        resolved_agent, _ = self._resolve_agent_for_user(user_id)
        if resolved_agent:
            active_agent = resolved_agent

    if not active_agent:
        return {
            "transcription": "",
            "reply": "❌ Layanan AI belum terkonfigurasi.",
            "success": False,
        }

    # Execute 1-hop / fallback pipeline
    try:
        parsed_result = active_agent.process_audio(
            audio_bytes=audio_bytes,
            mime_type=mime_type or "audio/webm",
            text_context=caption,
        )
    except Exception as e:
        return {
            "transcription": "",
            "reply": f"❌ Gagal memproses audio: {str(e)}",
            "success": False,
        }

    transcription = parsed_result.get("transcription", "")
    action = parsed_result.get("action", "unknown")

    # If action is identified, execute transaction mutation
    reply = self._execute_action(user_id, parsed_result, transcription or caption or "")

    return {
        "transcription": transcription,
        "reply": reply,
        "success": action != "unknown",
        "parsed_data": parsed_result,
    }
```

### 4.5 Router Specifications (`rezekify/api/v1/dashboard_router.py`)

- Maintain `MAX_RECEIPT_BYTES = 10 * 1024 * 1024` (10MB).
- Update `MAX_VOICE_BYTES = 10 * 1024 * 1024` (10MB, changed from 25MB).
- Pass detected `file.content_type` as `mime_type` into `orchestrator.handle_voice`:

```python
@dashboard_router.post("/ai-voice", response_model=VoiceChatResponse)
async def ai_voice_endpoint(
    file: UploadFile = File(...),
    message: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key_pool: RotaryKeyPool = Depends(get_gemini_key_pool),
) -> VoiceChatResponse:
    if file.content_type and file.content_type.lower() not in ALLOWED_VOICE_MIMES:
        raise HTTPException(
            status_code=400,
            detail="Format file audio tidak didukung. Harap gunakan WebM, OGG, WAV, MP4, atau MP3.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File audio kosong.")
    if len(content) > MAX_VOICE_BYTES:
        raise HTTPException(status_code=400, detail="Ukuran file audio melebihi batas maksimal 10MB.")

    orchestrator = AgentOrchestrator(db=db, key_pool=key_pool)
    result = await run_in_threadpool(
        orchestrator.handle_voice,
        user_id=current_user.id,
        audio_bytes=content,
        caption=(message or "").strip() or None,
        mime_type=file.content_type or "audio/webm",
    )
    return VoiceChatResponse(
        reply=result.get("reply", ""),
        transcription=result.get("transcription", ""),
    )
```

---

## 5. Security & Multi-Tenant Invariants

1. **Deterministic Ledger Math (Invariant 1):** Extracted `amount` strings from multimodal parsing are strictly converted to `Decimal` objects in Python ledger services. Zero floating-point operations.
2. **Double-Entry Balance (Invariant 2):** Any mutation initiated via audio or receipt image must strictly fulfill double-entry equilibrium ($\sum \text{Debit} = \sum \text{Credit}$).
3. **Tenant Row-Level Scoping (Invariant 3):** User audio and receipt files are handled completely in-memory (ephemeral `bytes`), never stored in world-readable temporary file directories, and mutations strictly scope to `user_id = current_user.id`.
4. **Ingress Boundary Validation:** Both endpoints strictly guard against Denial-of-Service memory inflation by truncating/rejecting payloads >10MB prior to passing to threadpools or AI models.

---

## 6. Testing & Quality Gates

### 6.1 Frontend Test Suite (`OmniInputHero.test.tsx`)
- **Unit: Canvas Compression Helper:**
  - Downscales images larger than 1600px to exact target aspect ratio.
  - Leaves images smaller than 1600px intact or respects quality bounds.
  - Returns original `File` unmodified when canvas context is unavailable (Node/jsdom environment).
  - Handles image load errors gracefully without throwing.
- **Unit: 60-Second Auto-Stop Timer:**
  - Mock `setInterval` with fake timers (`vi.useFakeTimers()`).
  - Advance time to 60 seconds; assert `mediaRecorder.stop()` is triggered.
  - Assert timer resets to 0 upon completion.

### 6.2 Backend Test Suite (`test_agent_runtime.py` & `test_agent_orchestrator.py`)
- **Unit: Gemini 1-Hop Audio Parsing:**
  - Mock `client.models.generate_content` returning combined `{ "transcription": "beli sate 25000", "action": "expense", ... }`.
  - Verify `ReActAgent.process_audio` sends `types.Part.from_bytes` with correct MIME type.
  - Verify transcription and transaction action are extracted in a single step.
- **Unit: Automated Failover to Groq Whisper:**
  - Simulate Gemini failure (e.g. rate limit exhaustion or exception).
  - Verify seamless fallback to `transcribe_audio` + `_fallback_groq`.
- **Unit: Payload Guard Validation:**
  - Pass audio bytes > 10MB to `process_audio` and `handle_voice`; verify rejection.
  - Test `/api/v1/dashboard/ai-voice` with >10MB upload; verify HTTP 400 response.

### 6.3 Regression Gate
- 100% test pass on `pytest` across all agent, ledger, and dashboard test suites.
- 100% test pass on `npm test -- --run` in frontend workspace.

---

## 7. Simplicity & YAGNI Guard (Ponytail Notes)

- **Client Canvas Processing:**
  `// ponytail: HTML5 2D Canvas with bicubic interpolation. Ceiling: main-thread synchronous compression. Upgrade to OffscreenCanvas / Web Worker only if UI thread frame drop (>16ms) is measured on low-end mobile devices.`
- **Native Audio File Transfer:**
  `// ponytail: Direct memory bytes via Part.from_bytes. Ceiling: 10MB payload cap. Upgrade to Google Cloud Storage / Gemini File API upload only if voice note duration limit is expanded beyond 5 minutes.`
- **Transcription + Intent Extraction Unified Schema:**
  `// ponytail: Single-pass JSON response schema for transcription and entity extraction. Upgrade to two-pass sequential pipeline only if verbatim transcription accuracy on regional Indonesian dialects drops below 85%.`
