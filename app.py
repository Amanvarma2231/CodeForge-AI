"""
CodeForge AI Studio — Production Flask Backend
Supports: Google Gemini 2.0 Flash, Sarvam AI, NVIDIA Nemotron, Bonsai AI
Features: General Q&A + Code Generation, Multimodal image/file attachments,
          API key management, Download (.py, .zip, .tar.gz), python-dotenv support
"""

import os
import json
import uuid
import base64
import tarfile
import zipfile
import requests
from pathlib import Path
from datetime import datetime
from flask import (
    Flask, render_template, request, jsonify,
    send_file, session
)
from werkzeug.utils import secure_filename

# ─── Load .env file automatically ─────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed; env vars must be set manually

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "codeforge-ai-secret-2025")

# ─── CONFIG ───────────────────────────────────────────────────────────────────
UPLOAD_FOLDER   = Path("uploads")
DOWNLOAD_FOLDER = Path("downloads")
ALLOWED_CODE_EXT    = {".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css",
                       ".json", ".md", ".txt", ".csv", ".sql", ".sh", ".c",
                       ".cpp", ".rs", ".go", ".java", ".php", ".rb", ".kt"}
ALLOWED_ARCHIVE_EXT = {".gz", ".tar", ".zip"}
ALLOWED_IMAGE_EXT   = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
ALLOWED_EXT = ALLOWED_CODE_EXT | ALLOWED_ARCHIVE_EXT | ALLOWED_IMAGE_EXT

MAX_FILE_MB = 50

UPLOAD_FOLDER.mkdir(exist_ok=True)
DOWNLOAD_FOLDER.mkdir(exist_ok=True)

app.config["UPLOAD_FOLDER"]      = str(UPLOAD_FOLDER)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_MB * 1024 * 1024

# ─── AI PROVIDER REGISTRY ─────────────────────────────────────────────────────
AI_PROVIDERS = {
    "sarvam": {
        "name":        "Sarvam AI",
        "description": "India's custom LLM — localized multilingual AI assistant",
        "api_url":     "https://api.sarvam.ai/v1/chat/completions",
        "model":       "sarvam-105b",
        "env_key":     "SARVAM_API_KEY",
        "color":       "#FF6B2B",
        "icon":        "🇮🇳",
        "vision":      False,
        "type":        "openai",
    },
    "nemotron": {
        "name":        "NVIDIA Nemotron",
        "description": "NVIDIA enterprise Llama 3.1 70B — powerful general AI",
        "api_url":     "https://integrate.api.nvidia.com/v1/chat/completions",
        "model":       "nvidia/llama-3.1-nemotron-70b-instruct",
        "env_key":     "NVIDIA_API_KEY",
        "color":       "#76B900",
        "icon":        "⚡",
        "vision":      True,
        "type":        "openai",
    },
    "bonsai": {
        "name":        "Bonsai AI",
        "description": "Lightweight, rapid-response AI assistant",
        "api_url":     "https://api.bonsai.ai/v1/chat/completions",
        "model":       "bonsai-coder-v1",
        "env_key":     "BONSAI_API_KEY",
        "color":       "#00C9A7",
        "icon":        "🌿",
        "vision":      True,
        "type":        "openai",
    },
}

# ─── HELPERS ──────────────────────────────────────────────────────────────────
def allowed_file(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return ext in ALLOWED_EXT or filename.endswith(".tar.gz")


def get_mime_type(ext: str) -> str:
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(ext.lower(), "image/png")


def build_system_prompt(mode: str = "general", language: str = "python") -> str:
    """
    Build an intelligent system prompt.
    mode='code'    → strict code generation instructions
    mode='general' → general AI assistant (answers anything)
    """
    base = (
        "You are CodeForge AI — an intelligent, professional AI assistant. "
        "You can answer any question clearly, help with coding, explain concepts, "
        "debug errors, generate code, discuss ideas, write essays, summarize topics, "
        "solve math problems, and assist with any task the user needs. "
        "Always respond in a clear, helpful, and professional manner. "
        "Use markdown formatting with headings, bullet points, and code blocks where appropriate. "
        "When generating code, always use properly formatted markdown code blocks "
        "with the language identifier (e.g. ```python). "
        "Include comments, docstrings, error handling, and example usage in any code you write."
    )
    if mode == "code":
        base += (
            f" For this request, generate production-grade {language} code. "
            "Include type annotations, modular classes/functions, and comprehensive docstrings."
        )
    return base


def call_ai_provider(provider_id: str, prompt: str, language: str = "python",
                     images: list = None, context: str = "",
                     user_key: str = None, history: list = None) -> dict:
    """
    Unified multi-model API call. Supports Gemini, Sarvam, Nemotron, Bonsai.
    Accepts user API key or falls back to server env var.
    Falls back to demo/mock if no key available.
    """
    images  = images  or []
    history = history or []
    cfg     = AI_PROVIDERS.get(provider_id, AI_PROVIDERS["sarvam"])

    # Resolve API key: user-provided > .env > empty (demo)
    api_key = (user_key or "").strip() or os.environ.get(cfg["env_key"], "").strip()

    # Detect if the request is a general question vs. code generation
    code_keywords = ["write", "create", "generate", "code", "script", "function",
                     "class", "implement", "build", "program", "develop", "fix",
                     "debug", "refactor", "algorithm", "api", "backend", "frontend"]
    lower_prompt = prompt.lower()
    is_code_request = any(kw in lower_prompt for kw in code_keywords) or bool(images)
    mode = "code" if is_code_request else "general"
    system_msg = build_system_prompt(mode=mode, language=language)

    # ── No API key → Demo mode ────────────────────────────────────────────────
    if not api_key:
        mock = generate_mock_response(prompt, language, cfg["name"], images, context, mode)
        return {
            "success":   True,
            "code":      mock,
            "provider":  cfg["name"],
            "model":     cfg["model"],
            "tokens":    len(prompt.split()) * 3 + 120,
            "mock":      True,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "message":   (
                f"⚠️ Demo mode — No API key for {cfg['name']}. "
                "Open ⚙️ Settings and add your API key for live AI responses."
            ),
        }

    # ── OPENAI-COMPATIBLE (Sarvam / Nemotron / Bonsai) ────────────────────────
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
    }

    full_text = prompt
    if context:
        full_text = f"Context files:\n```\n{context[:3000]}\n```\n\nRequest: {prompt}"

    if cfg.get("vision") and images:
        user_content = [{"type": "text", "text": full_text}]
        for img in images:
            b64 = img.get("base64", "")
            if b64:
                user_content.append({"type": "image_url", "image_url": {"url": b64}})
    else:
        user_content = full_text

    messages = [{"role": "system", "content": system_msg}]
    for turn in history[-6:]:
        messages.append({"role": turn["role"], "content": turn.get("content", "")})
    messages.append({"role": "user", "content": user_content})

    payload = {
        "model":       cfg["model"],
        "messages":    messages,
        "temperature": 0.7,
        "max_tokens":  4096,
    }

    try:
        r = requests.post(cfg["api_url"], headers=headers, json=payload, timeout=90)
        r.raise_for_status()
        msg_obj  = res_data["choices"][0]["message"]
        text     = (msg_obj.get("content") or msg_obj.get("reasoning_content") or "").strip()
        tokens   = res_data.get("usage", {}).get("total_tokens", 0)
        return {
            "success":   True,
            "code":      text,
            "provider":  cfg["name"],
            "model":     cfg["model"],
            "tokens":    tokens,
            "mock":      False,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
    except requests.HTTPError as e:
        status = e.response.status_code if e.response else "?"
        detail = ""
        try:
            detail = e.response.json().get("error", {}).get("message", "")
        except Exception:
            pass
        return {"success": False, "error": f"{cfg['name']} API Error {status}: {detail or str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"{cfg['name']} request failed: {str(e)}"}


# ─── DEMO / MOCK RESPONSE (No API Key) ────────────────────────────────────────
def generate_mock_response(prompt: str, language: str, provider_name: str,
                           images: list = None, context: str = "",
                           mode: str = "general") -> str:
    """Return a realistic demo response when no API key is set."""
    ts       = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    img_note = f"\n> 📎 Attached Images: {len(images)} image(s) processed" if images else ""
    ctx_note = f"\n> 📂 Context: {len(context)} characters of project context" if context else ""

    if mode == "general":
        return f"""## AI Response — Demo Mode

> **Provider:** {provider_name}  
> **Timestamp:** {ts}  
> **Status:** ⚠️ Demo Mode — No live API key configured{img_note}{ctx_note}

---

### Your Question
> {prompt[:200]}{"..." if len(prompt) > 200 else ""}

### Answer

I'm currently running in **demo mode** because no API key has been configured for **{provider_name}**.

To get real AI responses:

1. **Click ⚙️ Settings** in the bottom-left sidebar
2. **Enter your API key** for {provider_name}
3. **Save** and try again — your key is stored securely in your browser

**Get your API key:**
- **Google Gemini** → [Google AI Studio](https://aistudio.google.com/app/apikey) (Free tier available)
- **Sarvam AI** → [dashboard.sarvam.ai](https://dashboard.sarvam.ai)
- **NVIDIA Nemotron** → [build.nvidia.com](https://build.nvidia.com)

Once configured, you can ask me **anything** — coding questions, explanations, general knowledge, math, writing, analysis, and more!
"""
    else:
        lang_clean = language.lower()
        if lang_clean in ("python", "py"):
            return f'''## Code Generated — Demo Mode

> **Provider:** {provider_name} | **Language:** {language} | **Time:** {ts}  
> ⚠️ Demo mode — Add your API key in ⚙️ Settings for real AI-generated code.{img_note}{ctx_note}

```python
"""
Production Code — Demo Template
Generated by: {provider_name}
Timestamp   : {ts}
Task        : {prompt[:80]}{"..." if len(prompt) > 80 else ""}
"""

import logging
from typing import Any, Dict, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


class AIAssistant:
    """Intelligent assistant powered by {provider_name}."""

    def __init__(self, model: str = "{provider_name}") -> None:
        self.model = model
        logger.info("Initialized %s assistant", self.model)

    def process(self, query: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Process user query and return structured response.

        Args:
            query    : The user's input or prompt.
            metadata : Optional configuration dictionary.

        Returns:
            Dictionary containing status, result, and metadata.
        """
        logger.info("Processing: %s", query[:60])
        return {{
            "status"   : "success",
            "query"    : query,
            "result"   : f"Processed by {{self.model}}",
            "timestamp": "{ts}",
            "metadata" : metadata or {{}},
        }}


def main() -> None:
    assistant = AIAssistant()
    result    = assistant.process("{prompt[:60]}")
    print(f"Result: {{result}}")


if __name__ == "__main__":
    main()
```

> 💡 **Tip**: Add your Gemini API key (free at [aistudio.google.com](https://aistudio.google.com/app/apikey)) to get real AI-generated code!
'''
        else:
            return f"""## Code Generated — Demo Mode

> **Provider:** {provider_name} | **Language:** {language.upper()} | **Time:** {ts}  
> ⚠️ Demo mode — Add your API key in ⚙️ Settings for real responses.{img_note}{ctx_note}

```{language}
// Production Code — Demo Template
// Provider  : {provider_name}
// Timestamp : {ts}
// Task      : {prompt[:80]}

/**
 * @description Generated by CodeForge AI Studio — {provider_name}
 * @param {{string}} query - The user query or task description
 * @returns {{Object}} Structured response object
 */
async function processAIRequest(query) {{
  console.log(`[CodeForge] Processing: ${{query.slice(0, 50)}}...`);
  
  await new Promise(resolve => setTimeout(resolve, 100));

  return {{
    status   : "success",
    provider : "{provider_name}",
    timestamp: "{ts}",
    result   : `AI response for: ${{query}}`,
  }};
}}

// Example usage
processAIRequest("{prompt[:50]}")
  .then(result => console.log("Result:", result))
  .catch(err   => console.error("Error:", err));
```

> 💡 **Tip**: Add your API key in ⚙️ **Settings** for real AI responses!
"""


# ─── ARCHIVE HELPERS ──────────────────────────────────────────────────────────
def extract_code_files(archive_path: Path) -> list[dict]:
    """Extract code files from .tar.gz or .zip archives."""
    py_files = []
    extract_dir = UPLOAD_FOLDER / archive_path.stem.replace(".tar", "")
    extract_dir.mkdir(exist_ok=True)

    try:
        if tarfile.is_tarfile(archive_path):
            with tarfile.open(archive_path, "r:gz") as tf:
                tf.extractall(extract_dir)
        elif zipfile.is_zipfile(archive_path):
            with zipfile.ZipFile(archive_path, "r") as zf:
                zf.extractall(extract_dir)
    except Exception as e:
        return [{"error": str(e)}]

    for f in extract_dir.rglob("*"):
        if f.is_file() and f.suffix.lower() in ALLOWED_CODE_EXT:
            try:
                content = f.read_text(errors="replace")
                py_files.append({
                    "name":    f.name,
                    "path":    str(f.relative_to(extract_dir)),
                    "content": content,
                    "size":    f.stat().st_size,
                    "lines":   content.count("\n") + 1,
                })
            except Exception:
                pass

    return py_files


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    providers = {k: {**v, "key_set": bool(os.environ.get(v["env_key"]))}
                 for k, v in AI_PROVIDERS.items()}
    return render_template("index.html", providers=providers)


@app.route("/api/generate", methods=["POST"])
def generate_code():
    data      = request.get_json(silent=True) or {}
    prompt    = data.get("prompt", "").strip()
    provider  = data.get("provider", "gemini")
    language  = data.get("language", "python")
    context   = data.get("context", "")
    images    = data.get("images", [])
    user_keys = data.get("api_keys", {})
    history   = data.get("history", [])

    user_key  = (user_keys.get(provider) or "").strip() or \
                request.headers.get("X-API-Key", "").strip()

    if not prompt and not images:
        return jsonify({"success": False, "error": "Please enter a prompt or attach an image."}), 400
    if provider not in AI_PROVIDERS:
        return jsonify({"success": False, "error": f"Unknown provider: {provider}"}), 400

    result = call_ai_provider(
        provider_id=provider,
        prompt=prompt,
        language=language,
        images=images,
        context=context,
        user_key=user_key,
        history=history,
    )
    return jsonify(result)


@app.route("/api/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file in request"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"success": False, "error": "No file selected"}), 400
    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": "File type not supported"}), 400

    filename  = secure_filename(file.filename)
    uid       = uuid.uuid4().hex[:8]
    save_name = f"{uid}_{filename}"
    save_path = UPLOAD_FOLDER / save_name
    file.save(str(save_path))

    ext    = Path(filename).suffix.lower()
    result = {
        "success":  True,
        "filename": save_name,
        "original": filename,
        "size":     save_path.stat().st_size,
        "ext":      ext,
    }

    if ext in ALLOWED_IMAGE_EXT:
        with open(save_path, "rb") as img_f:
            b64_data = base64.b64encode(img_f.read()).decode("utf-8")
        mime = get_mime_type(ext)
        result.update({
            "file_type": "image",
            "base64":    f"data:{mime};base64,{b64_data}",
            "preview":   f"[Image: {filename}]",
        })
        return jsonify(result)

    if ext in ALLOWED_ARCHIVE_EXT or filename.endswith(".tar.gz"):
        files = extract_code_files(save_path)
        result.update({
            "py_files":  files,
            "file_type": "archive",
            "preview":   files[0]["content"][:2000] if files and "content" in files[0] else "",
        })
        return jsonify(result)

    content = save_path.read_text(errors="replace")
    result.update({
        "content":   content,
        "file_type": "code",
        "preview":   content[:2000],
        "lines":     content.count("\n") + 1,
    })
    return jsonify(result)


@app.route("/api/download", methods=["POST"])
def download_code():
    data     = request.get_json(silent=True) or {}
    code     = data.get("code", "")
    filename = data.get("filename", "codeforge_output.py")
    fmt      = data.get("format", "py")

    if not code:
        return jsonify({"success": False, "error": "No content to download"}), 400

    filename  = secure_filename(filename)
    uid       = uuid.uuid4().hex[:8]
    base_name = Path(filename).stem
    py_name   = f"{uid}_{base_name}.py"
    py_path   = DOWNLOAD_FOLDER / py_name
    py_path.write_text(code, encoding="utf-8")

    if fmt == "tar.gz":
        arch_name = f"{uid}_{base_name}.tar.gz"
        arch_path = DOWNLOAD_FOLDER / arch_name
        with tarfile.open(arch_path, "w:gz") as tf:
            tf.add(py_path, arcname=f"{base_name}.py")
        return send_file(str(arch_path), as_attachment=True,
                         download_name=f"{base_name}.tar.gz", mimetype="application/gzip")
    elif fmt == "zip":
        arch_name = f"{uid}_{base_name}.zip"
        arch_path = DOWNLOAD_FOLDER / arch_name
        with zipfile.ZipFile(arch_path, "w") as zf:
            zf.write(py_path, f"{base_name}.py")
        return send_file(str(arch_path), as_attachment=True,
                         download_name=f"{base_name}.zip", mimetype="application/zip")
    else:
        return send_file(str(py_path), as_attachment=True,
                         download_name=f"{base_name}.py", mimetype="text/plain")


@app.route("/api/providers")
def list_providers():
    out = {}
    for pid, cfg in AI_PROVIDERS.items():
        out[pid] = {
            "name":        cfg["name"],
            "description": cfg["description"],
            "model":       cfg["model"],
            "color":       cfg["color"],
            "icon":        cfg["icon"],
            "vision":      cfg.get("vision", False),
            "key_set":     bool(os.environ.get(cfg["env_key"])),
        }
    return jsonify(out)


@app.route("/api/validate-key", methods=["POST"])
def validate_key():
    data     = request.get_json(silent=True) or {}
    provider = data.get("provider")
    key      = data.get("key", "").strip()

    if not key:
        return jsonify({"valid": False, "message": "Key cannot be empty"}), 400
    if provider not in AI_PROVIDERS:
        return jsonify({"valid": False, "message": "Unknown provider"}), 400

    cfg = AI_PROVIDERS[provider]

    # Live validation for NVIDIA
    if provider == "nemotron":
        try:
            r = requests.get("https://integrate.api.nvidia.com/v1/models", headers={"Authorization": f"Bearer {key}"}, timeout=8)
            if r.status_code == 200:
                return jsonify({"valid": True, "message": f"✅ NVIDIA API key is valid & active!"})
            else:
                return jsonify({"valid": False, "message": f"❌ Invalid NVIDIA key (HTTP {r.status_code})"})
        except Exception as e:
            return jsonify({"valid": False, "message": f"Validation error: {str(e)}"})

    return jsonify({"valid": True, "message": f"✅ Key format accepted for {cfg['name']}."})


@app.route("/api/history")
def file_history():
    uploads = []
    for f in UPLOAD_FOLDER.iterdir():
        if f.is_file():
            uploads.append({
                "name":     f.name,
                "size":     f.stat().st_size,
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            })
    uploads.sort(key=lambda x: x["modified"], reverse=True)
    return jsonify({"uploads": uploads[:25]})


# ─── ERROR HANDLERS ───────────────────────────────────────────────────────────
@app.errorhandler(413)
def too_large(_):
    return jsonify({"success": False, "error": f"File exceeds {MAX_FILE_MB} MB limit"}), 413


@app.errorhandler(404)
def not_found(_):
    return jsonify({"success": False, "error": "Endpoint not found"}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


# ─── ENTRY POINT ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    print(f"\n[CodeForge AI Studio] Running at http://localhost:{port}")
    print(f"   Providers: {', '.join(AI_PROVIDERS.keys())}")
    sarvam_key = os.environ.get("SARVAM_API_KEY", "")
    nvidia_key = os.environ.get("NVIDIA_API_KEY", "")
    bonsai_key = os.environ.get("BONSAI_API_KEY", "")
    print(f"   Sarvam AI Key : {'[Connected]' if sarvam_key else '[Not set]'}")
    print(f"   NVIDIA Key    : {'[Connected]' if nvidia_key else '[Not set]'}")
    print(f"   Bonsai AI Key : {'[Connected]' if bonsai_key else '[Not set]'}\n")

    app.run(host="0.0.0.0", port=port, debug=debug)
