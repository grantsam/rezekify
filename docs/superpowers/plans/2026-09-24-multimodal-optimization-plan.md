# Multimodal Image & Audio Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate network upload latency for receipts via client-side canvas compression (~250 KB) and reduce voice note latency by ~60% (down to ~1.2s-1.8s) via 1-Hop direct native multimodal audio processing in Gemini 2.5 Flash with automated fallback to Groq Whisper.

**Architecture:**
- Frontend: `compressImage` utility in `frontend/src/utils/imageCompression.ts` downscales images >1600px to WebP/JPEG 0.85; `OmniInputHero.tsx` integrates compression and enforces a strict 60-second auto-stop recording cap.
- Backend Layer 2: `ReActAgent.process_audio` directly streams audio bytes to Gemini 2.5 Flash via `types.Part.from_bytes` returning single-call transcription and structured transaction entities with seamless fallback to Groq Whisper + Groq LLM; `AgentOrchestrator.handle_voice` coordinates financial ledger mutations.
- Backend Layer 3: `dashboard_router.py` standardizes `MAX_VOICE_BYTES = 10MB` and passes `file.content_type` into `handle_voice`.

**Tech Stack:** React 18, TypeScript, HTML5 Canvas/ImageBitmap, Python 3.12, FastAPI, Google GenAI SDK (`google.genai`), Groq SDK (`groq`), SQLAlchemy 2.0.

**Spec:** `docs/superpowers/specs/2026-09-24-multimodal-optimization-design.md`

## Global Constraints
- Deterministic Math Invariant: Extracted amounts must be converted strictly to `decimal.Decimal` in Python ledger services. Zero floating-point math for money.
- Double-Entry Balance Invariant: Every mutation must balance debit and credit.
- Tenant Row-Level Isolation Invariant: All queries and mutations must filter by `user_id = current_user.id`.
- Zero New Dependencies: Rely entirely on native browser HTML5 Canvas and currently installed SDKs (`google-genai`, `groq`, `fastapi`).
- Payload Bounds: `MAX_RECEIPT_BYTES = 10MB`, `MAX_VOICE_BYTES = 10MB`, client-side canvas target 1600px, voice recording max 60 seconds.

## Review Focus
1. Corrupted/unsupported image files: `compressImage` must gracefully fall back to the original `File` without throwing or blocking form submission.
2. Large audio files (>10MB): Backend `process_audio` and `handle_voice` must reject with clear validation errors rather than consuming AI quota or crashing.
3. Silent or empty audio: 1-Hop Gemini response with empty transcription must be handled safely, returning friendly prompt to re-record.
4. Groq Whisper fallback integrity: When Gemini fails (429 or network exception), Groq Whisper + Groq LLM must seamlessly return the same `{transcription, action, amount, ...}` structure.
5. Voice recording auto-stop at exactly 60 seconds: `OmniInputHero` timer must cleanly stop `MediaRecorder` and prevent unbounded buffer growth.

---

### Task 1: Client-Side Canvas Image Compression Utility

**Files:**
- Create: `frontend/src/utils/imageCompression.ts`
- Create: `frontend/src/__tests__/imageCompression.test.ts`

**Interfaces:**
- Consumes: Native HTML5 Canvas DOM APIs (`Image`, `HTMLCanvasElement`, `canvas.toBlob`, `canvas.getContext`, `URL.createObjectURL`, `URL.revokeObjectURL`)
- Produces: `compressImage(file: File, maxDimension?: number, quality?: number): Promise<File>`

- [ ] **Step 1: Write failing test `frontend/src/__tests__/imageCompression.test.ts`**

Create `frontend/src/__tests__/imageCompression.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImage } from '../utils/imageCompression';

describe('imageCompression utility', () => {
  let originalCreateObjectURL: any;
  let originalRevokeObjectURL: any;

  beforeEach(() => {
    originalCreateObjectURL = window.URL.createObjectURL;
    originalRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('returns original file unmodified for non-image MIME types', async () => {
    const pdfFile = new File(['%PDF-1.4 dummy'], 'document.pdf', { type: 'application/pdf' });
    const result = await compressImage(pdfFile);
    expect(result).toBe(pdfFile);
  });

  it('returns original file unmodified for 0-byte image files', async () => {
    const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
    const result = await compressImage(emptyFile);
    expect(result).toBe(emptyFile);
  });

  it('returns original file if canvas 2D context is unsupported or unavailable', async () => {
    const file = new File(['dummy_image_data'], 'test.png', { type: 'image/png' });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    const result = await compressImage(file);
    expect(result).toBe(file);
  });

  it('downscales landscape images larger than 1600px maintaining aspect ratio', async () => {
    const originalFile = new File([new ArrayBuffer(100000)], 'huge_landscape.jpg', { type: 'image/jpeg' });

    let drawnWidth = 0;
    let drawnHeight = 0;

    const mockCtx = {
      drawImage: vi.fn((_img, _dx, _dy, dWidth, dHeight) => {
        drawnWidth = dWidth;
        drawnHeight = dHeight;
      }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      const smallerBlob = new Blob([new ArrayBuffer(20000)], { type: type || 'image/webp' });
      callback(smallerBlob);
    });

    class MockImage {
      width = 3200;
      height = 1800;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal('Image', MockImage);

    const compressed = await compressImage(originalFile, 1600, 0.85);

    expect(drawnWidth).toBe(1600);
    expect(drawnHeight).toBe(900);
    expect(compressed.name).toBe('huge_landscape.webp');
    expect(compressed.type).toBe('image/webp');
    expect(compressed.size).toBe(20000);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview-url');
  });

  it('downscales portrait images larger than 1600px maintaining aspect ratio', async () => {
    const originalFile = new File([new ArrayBuffer(120000)], 'tall_receipt.png', { type: 'image/png' });

    let drawnWidth = 0;
    let drawnHeight = 0;

    const mockCtx = {
      drawImage: vi.fn((_img, _dx, _dy, dWidth, dHeight) => {
        drawnWidth = dWidth;
        drawnHeight = dHeight;
      }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      const smallerBlob = new Blob([new ArrayBuffer(30000)], { type: type || 'image/webp' });
      callback(smallerBlob);
    });

    class MockImage {
      width = 1800;
      height = 3600;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal('Image', MockImage);

    const compressed = await compressImage(originalFile, 1600, 0.85);

    expect(drawnWidth).toBe(800);
    expect(drawnHeight).toBe(1600);
    expect(compressed.name).toBe('tall_receipt.webp');
    expect(compressed.type).toBe('image/webp');
  });

  it('returns original file if compression does not produce size savings', async () => {
    const smallFile = new File([new ArrayBuffer(1000)], 'already_compressed.jpg', { type: 'image/jpeg' });

    const mockCtx = {
      drawImage: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      // Blobs larger than original
      const largerBlob = new Blob([new ArrayBuffer(2500)], { type: type || 'image/webp' });
      callback(largerBlob);
    });

    class MockImage {
      width = 400;
      height = 300;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal('Image', MockImage);

    const result = await compressImage(smallFile);
    expect(result).toBe(smallFile);
  });

  it('falls back to original file gracefully when Image fails to load', async () => {
    const brokenFile = new File(['not an image content'], 'corrupted.jpg', { type: 'image/jpeg' });

    class MockBrokenImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onerror) this.onerror();
        }, 0);
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal('Image', MockBrokenImage);

    const result = await compressImage(brokenFile);
    expect(result).toBe(brokenFile);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview-url');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
cd frontend; npx vitest run src/__tests__/imageCompression.test.ts
```
Expected: FAIL with `Failed to resolve import "../utils/imageCompression"`.

- [ ] **Step 3: Implement `frontend/src/utils/imageCompression.ts`**

Create `frontend/src/utils/imageCompression.ts`:
```typescript
/**
 * Downscales an image using native HTML5 Canvas to max dimension 1600px.
 * Encodes as image/webp at 0.85 quality.
 * Falls back gracefully to original file if processing fails or produces no size reduction.
 */
export async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<File> {
  // Pass non-image or zero-byte files through unmodified
  if (!file.type.startsWith('image/') || file.size === 0) {
    return file;
  }

  // Graceful fallback for non-DOM / test environments without 2D canvas context support
  if (typeof window === 'undefined' || typeof document === 'undefined' || !window.HTMLCanvasElement) {
    return file;
  }

  // ponytail: HTML5 2D Canvas with bicubic interpolation. Ceiling: main-thread synchronous compression. Upgrade to OffscreenCanvas / Web Worker only if UI thread frame drop (>16ms) is measured on low-end mobile devices.
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
            const extension = 'webp';
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

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
cd frontend; npx vitest run src/__tests__/imageCompression.test.ts
```
Expected: PASS with 7/7 tests passing.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/utils/imageCompression.ts frontend/src/__tests__/imageCompression.test.ts
git commit -m "feat(frontend): add client-side HTML5 canvas image compression utility

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: OmniInputHero Image Compression & 60-Second Audio Auto-Stop Integration

**Files:**
- Modify: `frontend/src/components/OmniInputHero.tsx`
- Modify: `frontend/src/__tests__/OmniInputHero.test.tsx`

**Interfaces:**
- Consumes: `compressImage` from `frontend/src/utils/imageCompression.ts`
- Produces:
  1. Downscales selected receipt images via `compressImage` before setting file state and generating thumbnail preview.
  2. Caps audio recording strictly at 60 seconds with auto-stop and `00:45 / 01:00` progress counter.

- [ ] **Step 1: Write failing tests in `frontend/src/__tests__/OmniInputHero.test.tsx`**

Add tests for image compression integration and 60-second auto-stop to `frontend/src/__tests__/OmniInputHero.test.tsx`:
```typescript
  it('compresses selected image files using compressImage before staging and submission', async () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const originalFile = new File(['original-large-bytes'], 'receipt.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [originalFile] } });

    await waitFor(() => {
      expect(screen.getByText(/receipt/i)).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Kirim/i });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('automatically stops recording when timer reaches 60 seconds', async () => {
    vi.useFakeTimers();
    const handleVoiceSubmit = vi.fn();
    render(<OmniInputHero onSubmit={vi.fn()} onVoiceSubmit={handleVoiceSubmit} isLoading={false} />);

    const micBtn = screen.getByRole('button', { name: /Rekam pesan suara/i });
    fireEvent.click(micBtn);

    // Fast-forward initial microtasks to allow getUserMedia promise to resolve
    await vi.runOnlyPendingTimersAsync();

    expect(screen.getByRole('region', { name: /Perekaman suara aktif/i })).toBeInTheDocument();
    expect(screen.getByText(/00:00 \/ 01:00/i)).toBeInTheDocument();

    // Advance by 60 seconds
    vi.advanceTimersByTime(60000);
    await vi.runOnlyPendingTimersAsync();

    // The recorder should automatically stop and invoke onVoiceSubmit
    expect(handleVoiceSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: /Perekaman suara aktif/i })).not.toBeInTheDocument();

    vi.useRealTimers();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
cd frontend; npx vitest run src/__tests__/OmniInputHero.test.tsx
```
Expected: FAIL on `00:00 / 01:00` indicator check and auto-stop behavior.

- [ ] **Step 3: Implement updates in `frontend/src/components/OmniInputHero.tsx`**

In `frontend/src/components/OmniInputHero.tsx`:
1. Import `compressImage`:
```typescript
import { compressImage } from '../utils/imageCompression';
```

2. Update `handleFileSelection` to compress images asynchronously:
```typescript
  const handleFileSelection = async (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
      setErrorMessage('Format file tidak didukung. Harap pilih gambar JPEG, PNG, atau WebP.');
      return;
    }
    setErrorMessage(null);
    try {
      const processed = await compressImage(selectedFile);
      setFile(processed);
    } catch {
      setFile(selectedFile);
    }
  };
```

3. Update `handleStartRecording` timer interval to auto-stop at 60 seconds:
```typescript
      // ponytail: 60-second client-side audio auto-stop timer. Ceiling: single 60s hard stop. Upgrade to configurable duration or multi-part chunking only if long-form voice transcription (>1 minute) is required.
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          if (next >= 60) {
            handleStopRecording();
          }
          return next;
        });
      }, 1000);
```

4. Update recording timer UI counter to display `/ 01:00` cap indicator:
```tsx
              <span className="font-mono text-sm md:text-base font-semibold text-rose-400 tabular-nums">
                {formatDuration(recordingDuration)} / 01:00
              </span>
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
cd frontend; npx vitest run src/__tests__/OmniInputHero.test.tsx
```
Expected: PASS with all tests passing.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/components/OmniInputHero.tsx frontend/src/__tests__/OmniInputHero.test.tsx
git commit -m "feat(frontend): integrate image compression and 60-second voice recording cap in OmniInputHero

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 1-Hop Native Multimodal Audio in `ReActAgent`

**Files:**
- Modify: `rezekify/agent/runtime.py`
- Modify: `tests/test_agent_runtime.py`

**Interfaces:**
- Consumes: `google.genai.types.Part.from_bytes`, `RotaryKeyPool`, Groq Whisper API (`whisper-large-v3`)
- Produces: `ReActAgent.process_audio(audio_bytes: bytes, mime_type: str = "audio/webm", text_context: Optional[str] = None) -> Dict[str, Any]`

- [ ] **Step 1: Write failing tests in `tests/test_agent_runtime.py`**

Add tests for `ReActAgent.process_audio` to `tests/test_agent_runtime.py`:
```python
def test_react_agent_process_audio_empty_bytes():
    agent = ReActAgent()
    res = agent.process_audio(b"")
    assert res == {"action": "unknown", "transcription": ""}


def test_react_agent_process_audio_oversized():
    agent = ReActAgent()
    oversized = b"x" * (10 * 1024 * 1024 + 1)
    with pytest.raises(ValueError, match="10MB"):
        agent.process_audio(oversized)


def test_react_agent_process_audio_gemini_1hop_success():
    gemini_pool = RotaryKeyPool(keys=["KEY_AUDIO"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.text = '{"transcription": "beli soto ayam 25000", "action": "expense", "amount": 25000, "account_name": "GoPay", "category_name": "Makanan", "note": "Soto Ayam"}'
    mock_client.models.generate_content.return_value = mock_resp

    fake_audio_bytes = b"fake_audio_bytes_123"

    with patch("google.genai.types.Part.from_bytes") as mock_part:
        mock_part.return_value = "mock_audio_part"
        with patch.object(gemini_pool, "get_gemini_client", return_value=mock_client):
            res = agent.process_audio(
                audio_bytes=fake_audio_bytes,
                mime_type="audio/webm",
                text_context="catatan tambahan",
            )
            assert res["action"] == "expense"
            assert res["amount"] == 25000
            assert res["transcription"] == "beli soto ayam 25000"
            mock_part.assert_called_once_with(data=fake_audio_bytes, mime_type="audio/webm")
            mock_client.models.generate_content.assert_called_once()
            contents = mock_client.models.generate_content.call_args.kwargs["contents"]
            assert "Catatan teks tambahan: catatan tambahan" in contents[2]


def test_react_agent_process_audio_falls_back_to_groq_whisper_on_gemini_failure():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_FAIL"])
    groq_pool = RotaryKeyPool(keys=["GROQ_FALLBACK"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_gemini = MagicMock()
    mock_gemini.models.generate_content.side_effect = Exception("429 Resource exhausted")

    mock_groq = MagicMock()
    mock_transcription = MagicMock()
    mock_transcription.text = "makan siang 35000 bca"
    mock_groq.audio.transcriptions.create.return_value = mock_transcription

    mock_chat = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"action": "expense", "amount": 35000, "account_name": "BCA", "category_name": "Makanan", "note": "Makan Siang"}'
    mock_chat.choices = [mock_choice]
    mock_groq.chat.completions.create.return_value = mock_chat

    with patch("google.genai.types.Part.from_bytes"):
        with patch.object(gemini_pool, "get_gemini_client", return_value=mock_gemini):
            with patch.object(groq_pool, "get_groq_client", return_value=mock_groq):
                res = agent.process_audio(b"audio_bytes_content", mime_type="audio/ogg")
                assert res["action"] == "expense"
                assert res["amount"] == 35000
                assert res["transcription"] == "makan siang 35000 bca"


def test_react_agent_process_audio_byok_401():
    gemini_pool = RotaryKeyPool(keys=["BYOK_KEY"])
    byok_agent = ReActAgent(gemini_pool=gemini_pool, is_byok=True)

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("401 API_KEY_INVALID")

    with patch("google.genai.types.Part.from_bytes"):
        with patch.object(gemini_pool, "get_gemini_client", return_value=mock_client):
            res = byok_agent.process_audio(b"fake_bytes")
            assert res["action"] == "byok_error"
            assert res["status_code"] == 401
```

Also, update `test_react_agent_transcribe_audio_oversized` in `tests/test_agent_runtime.py` to assert the updated 10MB limit:
```python
def test_react_agent_transcribe_audio_oversized():
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY_1"])
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    oversized = b"x" * (10 * 1024 * 1024 + 1)
    with pytest.raises(ValueError, match="10MB"):
        agent.transcribe_audio(oversized)
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
uv run --no-project pytest tests/test_agent_runtime.py -k "process_audio"
```
Expected: FAIL with `AttributeError: 'ReActAgent' object has no attribute 'process_audio'`.

- [ ] **Step 3: Implement `process_audio` in `rezekify/agent/runtime.py`**

In `rezekify/agent/runtime.py`:
1. Add `AUDIO_SYSTEM_PROMPT` below `SYSTEM_PROMPT`:
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

2. Add `process_audio` method to `ReActAgent`:
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

        # ponytail: Direct memory bytes via Part.from_bytes. Ceiling: 10MB payload cap. Upgrade to Google Cloud Storage / Gemini File API upload only if voice note duration limit is expanded beyond 5 minutes.
        if len(audio_bytes) > 10 * 1024 * 1024:
            raise ValueError("Ukuran file audio melebihi batas maksimal 10MB.")

        # 1-Hop: Try Gemini native audio multimodal parsing first
        # ponytail: Single-pass JSON response schema for transcription and entity extraction. Upgrade to two-pass sequential pipeline only if verbatim transcription accuracy on regional Indonesian dialects drops below 85%.
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

3. Update `transcribe_audio` validation cap from 25MB to 10MB:
```python
        if len(audio_bytes) > 10 * 1024 * 1024:
            raise ValueError("Ukuran file audio melebihi batas maksimal 10MB.")
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
uv run --no-project pytest tests/test_agent_runtime.py
```
Expected: PASS with all tests passing.

- [ ] **Step 5: Commit**

```powershell
git add rezekify/agent/runtime.py tests/test_agent_runtime.py
git commit -m "feat(agent): implement 1-Hop direct native multimodal audio processing with Groq fallback

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Orchestrator `handle_voice` & Router 10MB Payload Hardening

**Files:**
- Modify: `rezekify/agent/orchestrator.py`
- Modify: `rezekify/api/v1/dashboard_router.py`
- Modify: `tests/test_agent_orchestrator.py`
- Modify: `tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: `ReActAgent.process_audio`, `MAX_VOICE_BYTES = 10 * 1024 * 1024`
- Produces:
  1. `AgentOrchestrator.handle_voice(user_id: UUID, audio_bytes: bytes, caption: Optional[str] = None, mime_type: Optional[str] = "audio/webm") -> Dict[str, Any]`
  2. Router `/api/v1/dashboard/ai-voice` accepts `file.content_type` as `mime_type` and strictly rejects payloads >10MB with HTTP 400.

- [ ] **Step 1: Write failing tests in `tests/test_agent_orchestrator.py` and `tests/test_api_endpoints.py`**

In `tests/test_agent_orchestrator.py`, update voice tests to test 1-hop execution, mime type passing, 10MB cap, and silent audio handling:
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
    mock_agent.process_audio.return_value = {
        "transcription": "makan bakso 25rb pake gopay",
        "action": "expense",
        "amount": 25000,
        "account_name": "GoPay",
        "category_name": "Makanan",
        "note": "Bakso",
    }
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)

    result = orchestrator.handle_voice(
        user_id=sample_user.id,
        audio_bytes=b"sample_webm_bytes",
        mime_type="audio/webm",
    )
    assert result["success"] is True
    assert result["transcription"] == "makan bakso 25rb pake gopay"
    assert "Rp 25,000" in result["reply"]
    mock_agent.process_audio.assert_called_once_with(
        audio_bytes=b"sample_webm_bytes",
        mime_type="audio/webm",
        text_context=None,
    )

    db_session.refresh(acc)
    assert acc.current_balance == Decimal("75000.00")


def test_orchestrator_handle_voice_silent_audio(db_session, sample_user):
    mock_agent = MagicMock()
    mock_agent.process_audio.return_value = {"action": "unknown", "transcription": ""}
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)

    result = orchestrator.handle_voice(user_id=sample_user.id, audio_bytes=b"silent_webm")
    assert result["success"] is False
    assert result["transcription"] == ""
    assert "Suara tidak terdengar jelas" in result["reply"]


def test_orchestrator_handle_voice_oversized_audio(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    oversized = b"0" * (10 * 1024 * 1024 + 1)
    result = orchestrator.handle_voice(user_id=sample_user.id, audio_bytes=oversized)
    assert result["success"] is False
    assert "10MB" in result["reply"]


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
    mock_agent.process_audio.return_value = {
        "transcription": "isi bensin 50rb",
        "action": "expense",
        "amount": 50000,
        "account_name": "BCA",
        "category_name": "Transport",
        "note": "Bensin Motor",
    }
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)

    result = orchestrator.handle_voice(
        user_id=sample_user.id,
        audio_bytes=b"voice_bytes",
        caption="bensin motor",
        mime_type="audio/ogg",
    )
    assert result["success"] is True
    assert result["transcription"] == "isi bensin 50rb"
    assert "Rp 50,000" in result["reply"]
    mock_agent.process_audio.assert_called_once_with(
        audio_bytes=b"voice_bytes",
        mime_type="audio/ogg",
        text_context="bensin motor",
    )
```

In `tests/test_api_endpoints.py`, update `test_ai_voice_upload_success` and `test_ai_voice_upload_size_limit_exceeded`:
```python
def test_ai_voice_upload_success(sample_user, db_session):
    """Tests POST /api/v1/dashboard/ai-voice endpoint with valid audio file and message."""
    from rezekify.core.security import create_access_token

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}
        fake_audio = io.BytesIO(b"RIFF....WAVEfmt ....data....")
        with patch("rezekify.agent.orchestrator.AgentOrchestrator.handle_voice", return_value={"transcription": "beli kopi 25rb", "reply": "Tercatat!", "success": True}) as mock_handle:
            res = client.post(
                "/api/v1/dashboard/ai-voice",
                files={"file": ("voice.webm", fake_audio, "audio/webm")},
                data={"message": "Catatan tambahan"},
                headers=headers,
            )
            assert res.status_code == 200
            assert res.json() == {"reply": "Tercatat!", "transcription": "beli kopi 25rb"}
            assert mock_handle.called
            call_kwargs = mock_handle.call_args.kwargs
            assert call_kwargs["user_id"] == sample_user.id
            assert call_kwargs["audio_bytes"] == b"RIFF....WAVEfmt ....data...."
            assert call_kwargs["caption"] == "Catatan tambahan"
            assert call_kwargs["mime_type"] == "audio/webm"


def test_ai_voice_upload_size_limit_exceeded(sample_user, db_session):
    """Tests that audio uploads exceeding 10MB are rejected with HTTP 400."""
    from rezekify.core.security import create_access_token

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        large_bytes = b"0" * (11 * 1024 * 1024)
        files = {"file": ("huge_audio.webm", io.BytesIO(large_bytes), "audio/webm")}
        res = client.post("/api/v1/dashboard/ai-voice", headers=headers, files=files)
        assert res.status_code == 400
        assert res.json()["detail"] == "Ukuran file audio melebihi batas maksimal 10MB."
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```powershell
uv run --no-project pytest tests/test_agent_orchestrator.py tests/test_api_endpoints.py -k "voice"
```
Expected: FAIL due to 25MB assertion, missing `mime_type` propagation, and call signature differences.

- [ ] **Step 3: Implement `handle_voice` and router hardening**

1. In `rezekify/agent/orchestrator.py`:
Extract `_execute_action(self, user_id: UUID, entities: Dict[str, Any], text: str) -> str` from `handle_message` and implement `handle_voice`:
```python
    def _execute_action(
        self, user_id: UUID, entities: Dict[str, Any], text: str
    ) -> str:
        """Executes double-entry ledger mutations or runway queries based on parsed entities."""
        action = entities.get("action")

        if action == "byok_error":
            status_code = entities.get("status_code", 400)
            if status_code == 401:
                return "❌ Kunci API AI kustom Anda tidak valid atau telah dicabut. Silakan periksa di menu Pengaturan."
            elif status_code == 429:
                return (
                    "⚠️ Kuota kunci API AI kustom Anda telah habis (Rate Limit). "
                    "Silakan periksa kuota Anda di dashboard provider atau nonaktifkan BYOK untuk menggunakan kuota bersama."
                )
            return "❌ Terjadi kendala pada kunci API AI kustom Anda. Silakan periksa di menu Pengaturan."

        if action == "expense":
            amount = Decimal(str(entities.get("amount", 0)))
            account = self._resolve_account(user_id, entities.get("account_name"))
            if not account:
                return "❌ Gagal: Anda belum memiliki akun keuangan. Silakan tambahkan akun terlebih dahulu."

            category = self._resolve_or_create_category(
                user_id, entities.get("category_name"), CategoryType.EXPENSE
            )
            note = entities.get("note") or "Pengeluaran"

            try:
                self.ledger.record_expense(
                    user_id=user_id,
                    account_id=account.id,
                    category_id=category.id,
                    amount=amount,
                    description=note,
                    source_channel="AI_AGENT",
                    raw_input_text=text,
                )

                runway = self.runway.calculate_runway(user_id)
                self.db.commit()
            except Exception as e:
                self.db.rollback()
                return f"❌ Gagal mencatat pengeluaran: {str(e)}"

            return (
                f"✅ **Tercatat:** Rp {amount:,.0f} ({note}) via {account.name}.\n"
                f"📊 **Sisa Jatah Belanja Hari Ini:** Rp {runway.daily_safe_runway:,.0f} "
                f"({runway.days_remaining} hari menuju siklus baru)."
            )

        elif action == "income":
            amount = Decimal(str(entities.get("amount", 0)))
            account = self._resolve_account(user_id, entities.get("account_name"))
            if not account:
                return "❌ Gagal: Tidak ada akun tujuan yang ditemukan."

            category = self._resolve_or_create_category(
                user_id, entities.get("category_name"), CategoryType.INCOME
            )
            note = entities.get("note") or "Pemasukan"

            try:
                self.ledger.record_income(
                    user_id=user_id,
                    account_id=account.id,
                    category_id=category.id,
                    amount=amount,
                    description=note,
                    source_channel="AI_AGENT",
                )

                runway = self.runway.calculate_runway(user_id)
                self.db.commit()
            except Exception as e:
                self.db.rollback()
                return f"❌ Gagal mencatat pemasukan: {str(e)}"

            return (
                f"💰 **Pemasukan Berhasil Dicatat:** Rp {amount:,.0f} ({note}) ke {account.name}.\n"
                f"📈 Jatah aman belanja harian Anda meningkat menjadi Rp {runway.daily_safe_runway:,.0f}/hari."
            )

        elif action == "transfer":
            amount = Decimal(str(entities.get("amount", 0)))
            from_acc = self._resolve_account(user_id, entities.get("from_account"))
            to_acc = self._resolve_account(user_id, entities.get("to_account"))
            if not from_acc or not to_acc or from_acc.id == to_acc.id:
                return "❌ Gagal: Akun sumber dan tujuan transfer harus berbeda dan terdaftar."

            try:
                self.ledger.record_transfer(
                    user_id=user_id,
                    from_account_id=from_acc.id,
                    to_account_id=to_acc.id,
                    amount=amount,
                    description=entities.get("note") or f"Transfer {from_acc.name} ke {to_acc.name}",
                )
                self.db.commit()
            except Exception as e:
                self.db.rollback()
                return f"❌ Gagal memproses transfer: {str(e)}"

            return f"🔁 **Transfer Berhasil:** Rp {amount:,.0f} dari {from_acc.name} ke {to_acc.name}."

        elif action == "query_runway" or text.lower().strip() in ("cek runway", "/runway", "/saldo", "runway", "saldo", "status"):
            runway = self.runway.calculate_runway(user_id)
            reply = (
                f"📈 **Status Keuangan Rezekify:**\n"
                f"• Saldo Bebas Operasional: Rp {runway.operational_free_cash:,.0f}\n"
                f"• Jatah Aman Belanja Hari Ini: Rp {runway.daily_safe_runway:,.0f}/hari\n"
                f"• Sisa Hari Siklus: {runway.days_remaining} hari\n"
                f"• Status: **{runway.health_status}**"
            )
            if runway.upcoming_bills:
                reply += "\n\n⚠️ **Tagihan Mendatang (H-7):**"
                for b in runway.upcoming_bills:
                    reply += f"\n• {b.name}: Rp {b.target_amount:,.0f} (sisa {b.days_until_due} hari)"
            return reply

        return "Saya siap membantu mencatat pengeluaran, pemasukan, transfer, atau memeriksa status jatah belanja harian Anda."

    def handle_message(
        self,
        user_id: UUID,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: Optional[str] = "image/jpeg",
    ) -> str:
        """Processes natural language input or receipts, executes ledger mutations, and returns telemetry response."""
        try:
            entities = self.extract_entities(
                text=text, image_bytes=image_bytes, user_id=user_id, mime_type=mime_type
            )
        except TypeError:
            entities = self.extract_entities(
                text=text, image_bytes=image_bytes, user_id=user_id
            )
        return self._execute_action(user_id, entities, text)

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

        if not transcription and action == "unknown":
            return {
                "transcription": "",
                "reply": "⚠️ Suara tidak terdengar jelas atau audio kosong. Silakan ulangi rekaman suara Anda.",
                "success": False,
            }

        reply = self._execute_action(user_id, parsed_result, transcription or caption or "")

        return {
            "transcription": transcription,
            "reply": reply,
            "success": action != "unknown",
            "parsed_data": parsed_result,
        }
```

2. In `rezekify/api/v1/dashboard_router.py`:
Update `MAX_VOICE_BYTES` and pass `mime_type` into `handle_voice`:
```python
MAX_VOICE_BYTES = 10 * 1024 * 1024  # 10MB
```

And in `ai_voice_endpoint`:
```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```powershell
uv run --no-project pytest tests/test_agent_orchestrator.py tests/test_api_endpoints.py -k "voice"
```
Expected: PASS with 100% pass on all voice tests.

- [ ] **Step 5: Commit**

```powershell
git add rezekify/agent/orchestrator.py rezekify/api/v1/dashboard_router.py tests/test_agent_orchestrator.py tests/test_api_endpoints.py
git commit -m "feat(orchestrator): route voice processing via 1-Hop process_audio and harden router to 10MB

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Full System Verification & Regression Gate

**Files:**
- Run test suites across frontend and backend
- Verify all multi-tenant and financial invariants

- [ ] **Step 1: Run frontend test suite**

Run:
```powershell
cd frontend; npm test -- --run
```
Expected: 23 test files passed, 0 failures.

- [ ] **Step 2: Run frontend production build**

Run:
```powershell
cd frontend; npm run build
```
Expected: Clean build with zero TypeScript or bundling errors.

- [ ] **Step 3: Run backend test suite**

Run:
```powershell
uv run --no-project pytest -x
```
Expected: 250+ passed with exit code 0.

- [ ] **Step 4: Invariant verification check**

Verify:
1. Deterministic Math Invariant: All money calculations remain in `decimal.Decimal` (zero floating-point math).
2. Double-Entry Balance Invariant: Every mutation created via voice/image balances debits and credits.
3. Tenant Row-Level Isolation Invariant: Every query and mutation scopes strictly to `user_id = current_user.id`.
4. Payload Limits: Max receipt = 10MB, max voice = 10MB, max canvas dimension = 1600px, max voice recording = 60s.
5. Zero New Dependencies: No packages added to `frontend/package.json` or `pyproject.toml`.

- [ ] **Step 5: Commit any final plan updates or verifications**

```powershell
git status
```
Confirm working tree is clean or commit changes with conventional commit:
```powershell
git commit -m "chore: complete multimodal optimization full test gate verification

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
