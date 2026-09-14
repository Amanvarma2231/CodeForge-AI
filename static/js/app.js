/* ── CodeForge AI Studio — Production Frontend Script ──────────────────────
   Features:
   - Universal AI assistant (answers any question + code generation)
   - Sidebar history with localStorage persistence & search
   - In-prompt model selector + language switcher
   - File & image attachments (drag/drop + clipboard paste)
   - API Key modal with live validation
   - Multi-turn conversational history sent to backend
   - Markdown + syntax highlighting output renderer
   - Code block copy/download controls
   ─────────────────────────────────────────────────────────────────────── */

"use strict";

// ── App State ─────────────────────────────────────────────────────────────────
const state = {
  sessions:        [],
  activeSessionId: null,
  attachedFiles:   [],
  apiKeys:         {},
  currentProvider: "sarvam",
  currentLanguage: "python",
  isGenerating:    false,
};

// ── DOM Shortcuts ─────────────────────────────────────────────────────────────
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── localStorage Keys ─────────────────────────────────────────────────────────
const STORAGE = {
  SESSIONS: "codeforge_sessions_v3",
  KEYS:     "codeforge_api_keys_v3",
  ACTIVE:   "codeforge_active_id_v3",
};

// ── Provider Registry ─────────────────────────────────────────────────────────
const PROVIDERS = {
  sarvam:   { name: "Sarvam AI",        icon: "🇮🇳", color: "#FF6B2B" },
  nemotron: { name: "NVIDIA Nemotron",  icon: "⚡", color: "#76B900" },
  bonsai:   { name: "Bonsai AI",        icon: "🌿", color: "#00C9A7" },
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadSavedApiKeys();
  loadSavedSessions();
  setupEventListeners();
  setupDragAndDrop();
  setupClipboardPaste();
  updateApiKeyStatusUI();

  if (!state.activeSessionId || !getSession(state.activeSessionId)) {
    createNewSession(false);
  } else {
    switchSession(state.activeSessionId);
  }

  console.log("✨ CodeForge AI Studio ready");
});


// ─────────────────────────────────────────────────────────────────────────────
// API KEY MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
function loadSavedApiKeys() {
  try {
    const raw = localStorage.getItem(STORAGE.KEYS);
    if (raw) state.apiKeys = JSON.parse(raw);
  } catch {
    state.apiKeys = {};
  }
}

function saveApiKeys(keys) {
  state.apiKeys = keys;
  localStorage.setItem(STORAGE.KEYS, JSON.stringify(keys));
  updateApiKeyStatusUI();
  showToast("✅ API Keys saved securely in your browser", "success");
}

function updateApiKeyStatusUI() {
  const count = Object.values(state.apiKeys).filter(k => k && k.trim()).length;
  const sub   = $("apiKeyStatusSub");
  if (sub) {
    sub.textContent = count > 0 ? `${count} Key(s) Connected` : "No Keys — Demo Mode";
    sub.style.color = count > 0 ? "var(--emerald-green)" : "var(--text-sub)";
  }
}

function populateApiKeyInputs() {
  if ($("keySarvam"))  $("keySarvam").value  = state.apiKeys.sarvam   || "";
  if ($("keyNvidia"))  $("keyNvidia").value  = state.apiKeys.nemotron || "";
  if ($("keyBonsai"))  $("keyBonsai").value  = state.apiKeys.bonsai   || "";
}

async function validateApiKey(provider, key) {
  const msgEl = $("keyValidationMsg");
  if (msgEl) {
    msgEl.style.display = "block";
    msgEl.textContent   = "⏳ Validating key...";
    msgEl.className     = "key-status-msg validating";
  }
  try {
    const res  = await fetch("/api/validate-key", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ provider, key }),
    });
    const data = await res.json();
    if (msgEl) {
      msgEl.textContent = data.message || (data.valid ? "✅ Key valid!" : "❌ Invalid key");
      msgEl.className   = "key-status-msg " + (data.valid ? "valid" : "invalid");
    }
    return data.valid;
  } catch (e) {
    if (msgEl) {
      msgEl.textContent = "⚠️ Validation error: " + e.message;
      msgEl.className   = "key-status-msg invalid";
    }
    return false;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// SESSION & HISTORY
// ─────────────────────────────────────────────────────────────────────────────
function loadSavedSessions() {
  try {
    const raw = localStorage.getItem(STORAGE.SESSIONS);
    state.sessions        = raw ? JSON.parse(raw) : [];
    state.activeSessionId = localStorage.getItem(STORAGE.ACTIVE);
  } catch {
    state.sessions = [];
  }
  renderSidebarHistory();
}

function saveSessions() {
  localStorage.setItem(STORAGE.SESSIONS, JSON.stringify(state.sessions));
  if (state.activeSessionId) {
    localStorage.setItem(STORAGE.ACTIVE, state.activeSessionId);
  }
}

function getSession(id) {
  return state.sessions.find(s => s.id === id);
}

function createNewSession(switchNow = true) {
  const id  = "session_" + Date.now();
  const ses = {
    id,
    title:     "New Conversation",
    provider:  state.currentProvider,
    language:  state.currentLanguage,
    messages:  [],
    createdAt: new Date().toISOString(),
  };
  state.sessions.unshift(ses);
  saveSessions();
  renderSidebarHistory();
  if (switchNow) switchSession(id);
  return ses;
}

function switchSession(id) {
  const ses = getSession(id);
  if (!ses) return;

  state.activeSessionId = id;
  saveSessions();
  renderSidebarHistory();

  $("sessionTitle").textContent = ses.title || "New Conversation";

  const modelSel = $("promptModelSelect");
  if (modelSel && ses.provider) {
    modelSel.value        = ses.provider;
    state.currentProvider = ses.provider;
    updateHeaderModelBadge(ses.provider);
  }

  renderChatMessages(ses.messages);
}

function deleteSession(id, event) {
  if (event) event.stopPropagation();
  state.sessions = state.sessions.filter(s => s.id !== id);
  saveSessions();

  if (state.activeSessionId === id) {
    if (state.sessions.length > 0) switchSession(state.sessions[0].id);
    else createNewSession(true);
  } else {
    renderSidebarHistory();
  }
  showToast("Conversation deleted", "info");
}

function clearAllHistory() {
  if (confirm("Clear all conversation history?")) {
    state.sessions = [];
    localStorage.removeItem(STORAGE.SESSIONS);
    createNewSession(true);
    showToast("History cleared", "info");
  }
}

function renderSidebarHistory(filterQuery = "") {
  const container = $("sidebarHistoryList");
  if (!container) return;

  container.innerHTML = "";
  const q = filterQuery.toLowerCase().trim();

  const filtered = state.sessions.filter(s =>
    !q ||
    (s.title && s.title.toLowerCase().includes(q)) ||
    s.messages.some(m => m.content && m.content.toLowerCase().includes(q))
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div class="history-empty">${q ? "No matching conversations" : "No previous conversations"}</div>`;
    return;
  }

  filtered.forEach(ses => {
    const item       = document.createElement("div");
    item.className   = `history-item ${ses.id === state.activeSessionId ? "active" : ""}`;
    item.onclick     = () => switchSession(ses.id);

    const timeAgo    = getRelativeTime(ses.createdAt);
    const prov       = PROVIDERS[ses.provider] || PROVIDERS.gemini;

    item.innerHTML = `
      <div class="history-item-content">
        <span class="history-item-title">${escapeHtml(ses.title || "Conversation")}</span>
        <span class="history-item-meta">
          <span>${prov.icon} ${prov.name}</span>
          <span>•</span>
          <span>${timeAgo}</span>
        </span>
      </div>
      <button class="history-delete-btn" title="Delete">✕</button>
    `;

    item.querySelector(".history-delete-btn").onclick = e => deleteSession(ses.id, e);
    container.appendChild(item);
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// CHAT RENDER
// ─────────────────────────────────────────────────────────────────────────────
function renderChatMessages(messages) {
  const container  = $("messagesContainer");
  const welcomeView = $("welcomeView");
  if (!container) return;

  container.innerHTML = "";

  if (!messages || messages.length === 0) {
    if (welcomeView) welcomeView.style.display = "flex";
    return;
  }

  if (welcomeView) welcomeView.style.display = "none";
  messages.forEach(msg => appendMessageToUI(msg));
  scrollChatToBottom();
}

function appendMessageToUI(msg) {
  const container  = $("messagesContainer");
  const welcomeView = $("welcomeView");
  if (!container) return;
  if (welcomeView) welcomeView.style.display = "none";

  const row       = document.createElement("div");
  row.className   = `message-row ${msg.role}`;

  if (msg.role === "user") {
    let attachHtml = "";
    if (msg.attachments && msg.attachments.length > 0) {
      attachHtml = '<div class="user-attachments-grid">';
      msg.attachments.forEach(att => {
        if (att.base64) {
          attachHtml += `<img src="${att.base64}" class="user-img-thumb" title="${escapeHtml(att.filename)}" />`;
        } else {
          attachHtml += `<div class="user-attachment-pill">📄 <span>${escapeHtml(att.filename)}</span></div>`;
        }
      });
      attachHtml += "</div>";
    }
    row.innerHTML = `
      <div class="message-bubble user">
        ${attachHtml}
        <div>${escapeHtml(msg.content)}</div>
      </div>
    `;
  } else {
    // Assistant
    const prov         = PROVIDERS[msg.provider] || PROVIDERS.sarvam;
    const formattedContent = formatAiResponse(msg.content, msg.language || state.currentLanguage);

    let statsHtml = "";
    if (msg.tokens || msg.time) {
      statsHtml = `
        <div class="generation-stats-footer">
          <span>⚡ <strong>${msg.providerName || prov.name}</strong></span>
          <span>🤖 <strong>${msg.model || ""}</strong></span>
          <span>📊 <strong>${msg.tokens || "—"} tokens</strong></span>
          <span>⏱️ <strong>${msg.time ? msg.time + "s" : "—"}</strong></span>
          <span>🔑 <strong>${msg.mock ? "Demo Mode" : "Live API"}</strong></span>
        </div>
      `;
    }

    if (msg.mock && msg.message) {
      statsHtml = `<div class="demo-warning-banner">⚠️ ${escapeHtml(msg.message)}</div>` + statsHtml;
    }

    row.innerHTML = `
      <div class="message-header-ai">
        <span class="ai-avatar">${prov.icon}</span>
        <span class="ai-name-label">${msg.providerName || prov.name}</span>
      </div>
      <div class="message-bubble assistant">
        ${formattedContent}
        ${statsHtml}
      </div>
    `;
  }

  container.appendChild(row);
  bindCodeBlockButtons(row);
  scrollChatToBottom();
}

// Render AI markdown response — handles code blocks + rich markdown
function formatAiResponse(content, language) {
  if (!content) return "";

  const codeBlockRe = /```([a-zA-Z0-9_+#.\-]*)[\n]?([\s\S]*?)```/g;
  const blocks = [];

  // Extract code blocks before escaping
  let processed = content.replace(codeBlockRe, (match, lang, code) => {
    const id = blocks.length;
    blocks.push({ lang: (lang || language || "text").trim(), code: code.trim() });
    return `___BLOCK_${id}___`;
  });

  // Process markdown text
  processed = escapeHtml(processed)
    .replace(/^### (.*$)/gim,        '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.*$)/gim,         '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.*$)/gim,          '<h1 class="md-h1">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g,        '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,            '<em>$1</em>')
    .replace(/`([^`]+)`/g,            '<code class="md-inline-code">$1</code>')
    .replace(/^\&gt;\s?(.*$)/gim,    '<blockquote class="md-quote">$1</blockquote>')
    .replace(/^\s*[-*]\s+(.*$)/gim,  '<li class="md-list-item">$1</li>')
    .replace(/\n\n/g,                 '<br/><br/>')
    .replace(/\n/g,                   '<br/>');

  // Wrap list items
  processed = processed.replace(/(<li class="md-list-item">.*?<\/li>)+/gs,
    m => `<ul class="md-list">${m}</ul>`);

  // Restore code blocks with controls
  blocks.forEach((block, i) => {
    const codeHtml = `
      <div class="code-wrapper">
        <div class="code-header">
          <span>${block.lang.toUpperCase() || "CODE"}</span>
          <div class="code-actions">
            <button class="btn-code-action btn-copy-code" data-code="${encodeURIComponent(block.code)}">📋 Copy</button>
            <button class="btn-code-action btn-dl-code"   data-code="${encodeURIComponent(block.code)}" data-fmt="py">📄 .py</button>
            <button class="btn-code-action btn-dl-code"   data-code="${encodeURIComponent(block.code)}" data-fmt="zip">📦 .zip</button>
          </div>
        </div>
        <pre><code class="language-${block.lang}">${escapeHtml(block.code)}</code></pre>
      </div>
    `;
    processed = processed.replace(`___BLOCK_${i}___`, codeHtml);
  });

  return processed;
}

function bindCodeBlockButtons(container) {
  container.querySelectorAll("pre code").forEach(el => {
    if (typeof hljs !== "undefined") hljs.highlightElement(el);
  });

  container.querySelectorAll(".btn-copy-code").forEach(btn => {
    btn.onclick = async () => {
      const code = decodeURIComponent(btn.dataset.code);
      await navigator.clipboard.writeText(code);
      showToast("Code copied to clipboard!", "success");
    };
  });

  container.querySelectorAll(".btn-dl-code").forEach(btn => {
    btn.onclick = () => downloadGeneratedCode(decodeURIComponent(btn.dataset.code), btn.dataset.fmt);
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// FILE ATTACHMENTS
// ─────────────────────────────────────────────────────────────────────────────
function handleFileAttachments(files) {
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = e => {
        state.attachedFiles.push({
          filename:  file.name,
          file_type: "image",
          base64:    e.target.result,
          preview:   `[Image: ${file.name}]`,
        });
        renderAttachmentsStrip();
        showToast(`📎 Attached image: ${file.name}`, "success");
      };
      reader.readAsDataURL(file);
    } else {
      const fd = new FormData();
      fd.append("file", file);
      fetch("/api/upload", { method: "POST", body: fd })
        .then(r  => r.json())
        .then(data => {
          if (data.success) {
            state.attachedFiles.push({
              filename:  data.original,
              file_type: data.file_type,
              base64:    data.base64 || "",
              content:   data.content || data.py_files?.[0]?.content || "",
              preview:   data.preview || "",
            });
            renderAttachmentsStrip();
            showToast(`📎 Attached: ${data.original}`, "success");
          } else {
            showToast(`Upload failed: ${data.error}`, "error");
          }
        })
        .catch(e => showToast("Attachment error: " + e.message, "error"));
    }
  });
}

function renderAttachmentsStrip() {
  const strip = $("attachmentsStrip");
  if (!strip) return;

  if (state.attachedFiles.length === 0) {
    strip.style.display = "none";
    strip.innerHTML     = "";
    return;
  }

  strip.style.display = "flex";
  strip.innerHTML     = "";

  state.attachedFiles.forEach((att, idx) => {
    const chip       = document.createElement("div");
    chip.className   = "attachment-chip";

    if (att.base64) {
      chip.innerHTML = `
        <img src="${att.base64}" class="chip-img-preview" />
        <span>${escapeHtml(att.filename)}</span>
        <button class="chip-remove-btn">✕</button>
      `;
    } else {
      chip.innerHTML = `
        <span>📄 ${escapeHtml(att.filename)}</span>
        <button class="chip-remove-btn">✕</button>
      `;
    }

    chip.querySelector(".chip-remove-btn").onclick = () => {
      state.attachedFiles.splice(idx, 1);
      renderAttachmentsStrip();
    };
    strip.appendChild(chip);
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// SEND PROMPT — CORE AI ACTION
// ─────────────────────────────────────────────────────────────────────────────
async function sendPrompt() {
  const promptInput = $("promptInput");
  const promptText  = promptInput.value.trim();

  if (!promptText && state.attachedFiles.length === 0) {
    showToast("Please enter a prompt or attach a file/image", "error");
    return;
  }
  if (state.isGenerating) return;

  const currentSession = getSession(state.activeSessionId);
  if (!currentSession) return;

  // Auto-generate session title on first message
  if (currentSession.messages.length === 0) {
    currentSession.title = promptText
      ? promptText.slice(0, 45) + (promptText.length > 45 ? "…" : "")
      : "Image / File Analysis";
    $("sessionTitle").textContent = currentSession.title;
  }

  // Build user message
  const userMsg = {
    role:        "user",
    content:     promptText,
    attachments: [...state.attachedFiles],
    timestamp:   new Date().toISOString(),
  };

  currentSession.messages.push(userMsg);
  appendMessageToUI(userMsg);

  // Collect context from attached files
  const attachedContext = state.attachedFiles
    .map(f => f.content || "")
    .filter(Boolean)
    .join("\n\n");
  const attachedImages = state.attachedFiles.filter(f => f.file_type === "image");

  // Clear input
  promptInput.value        = "";
  promptInput.style.height = "auto";
  $("charCounter").textContent = "0 / 8000";
  state.attachedFiles      = [];
  renderAttachmentsStrip();

  // Set generating state
  state.isGenerating = true;
  const sendBtn      = $("sendBtn");
  sendBtn.disabled   = true;
  $("globalLoading").style.display = "flex";
  $("loadingMessage").textContent  = "AI is thinking…";
  $("liveStatusText").textContent  = "Generating…";

  const t0 = Date.now();

  // Build conversational history (last 8 messages = 4 pairs)
  const historyForAPI = currentSession.messages
    .slice(-8)
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role, content: m.content || "" }));

  const body = {
    prompt:   promptText,
    provider: state.currentProvider,
    language: state.currentLanguage,
    context:  attachedContext,
    images:   attachedImages,
    api_keys: state.apiKeys,
    history:  historyForAPI,
  };

  try {
    const res  = await fetch("/api/generate", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key":    state.apiKeys[state.currentProvider] || "",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || "AI request failed");

    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

    const prov = PROVIDERS[state.currentProvider] || PROVIDERS.gemini;

    const assistantMsg = {
      role:         "assistant",
      content:      data.code,
      provider:     state.currentProvider,
      providerName: data.provider || prov.name,
      model:        data.model,
      tokens:       data.tokens,
      time:         elapsed,
      mock:         data.mock,
      message:      data.message || "",
      language:     state.currentLanguage,
      timestamp:    new Date().toISOString(),
    };

    currentSession.messages.push(assistantMsg);
    currentSession.provider = state.currentProvider;
    currentSession.language = state.currentLanguage;
    saveSessions();

    appendMessageToUI(assistantMsg);
    renderSidebarHistory();

    if (data.mock) {
      showToast("⚠️ Demo mode — add your API key in ⚙️ Settings for live responses", "info");
    } else {
      showToast("✅ Response received!", "success");
    }

  } catch (err) {
    showToast("❌ Error: " + err.message, "error");
    // Add error message to chat
    appendMessageToUI({
      role:         "assistant",
      content:      `**Error:** ${err.message}\n\nPlease check:\n- Your API key is set in ⚙️ Settings\n- You have internet connection\n- The API key is valid for ${PROVIDERS[state.currentProvider]?.name || state.currentProvider}`,
      provider:     state.currentProvider,
      providerName: PROVIDERS[state.currentProvider]?.name,
      mock:         false,
      tokens:       0,
      language:     state.currentLanguage,
      timestamp:    new Date().toISOString(),
    });
  } finally {
    state.isGenerating              = false;
    sendBtn.disabled                = false;
    $("globalLoading").style.display = "none";
    $("liveStatusText").textContent  = "Ready";
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// DOWNLOAD GENERATED CODE
// ─────────────────────────────────────────────────────────────────────────────
async function downloadGeneratedCode(code, fmt = "py") {
  try {
    const base = `codeforge_${state.currentLanguage}_${Date.now()}`;
    const res  = await fetch("/api/download", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ code, filename: `${base}.py`, format: fmt }),
    });
    if (!res.ok) throw new Error("Download failed");

    const blob = await res.blob();
    const ext  = fmt === "tar.gz" ? ".tar.gz" : fmt === "zip" ? ".zip" : ".py";
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${base}${ext}`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`📥 Downloaded as ${ext}`, "success");
  } catch (e) {
    showToast("Download error: " + e.message, "error");
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// EXPORT CHAT AS MARKDOWN
// ─────────────────────────────────────────────────────────────────────────────
function exportChatAsMarkdown() {
  const ses = getSession(state.activeSessionId);
  if (!ses || !ses.messages.length) {
    showToast("No conversation to export", "error");
    return;
  }

  let md = `# ${ses.title || "CodeForge AI Conversation"}\n\n`;
  md    += `*Exported from CodeForge AI Studio • ${new Date().toLocaleString()}*\n\n---\n\n`;

  ses.messages.forEach(msg => {
    if (msg.role === "user") {
      md += `### 👤 You:\n${msg.content}\n\n`;
    } else {
      md += `### 🤖 ${msg.providerName || "AI"}:\n${msg.content}\n\n`;
      if (msg.tokens || msg.time) {
        md += `> *${msg.tokens || 0} tokens • ${msg.time || "?"}s*\n\n`;
      }
    }
  });

  const blob = new Blob([md], { type: "text/markdown" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${(ses.title || "chat").replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("📥 Exported as Markdown!", "success");
}


// ─────────────────────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────────────────────────────
function setupEventListeners() {
  const sidebar = $("appSidebar");

  // Sidebar toggles
  $("toggleSidebar").onclick      = () => sidebar.classList.toggle("collapsed");
  $("mobileSidebarToggle").onclick = () => sidebar.classList.toggle("collapsed");

  // New chat
  $("newChatBtn").onclick      = () => createNewSession(true);
  $("clearHistoryBtn").onclick = clearAllHistory;
  $("exportChatBtn").onclick   = exportChatAsMarkdown;

  // Search history
  $("historySearch").oninput = e => renderSidebarHistory(e.target.value);

  // Model selector
  const modelSel = $("promptModelSelect");
  if (modelSel) {
    modelSel.onchange = e => {
      state.currentProvider = e.target.value;
      updateHeaderModelBadge(state.currentProvider);
      showToast(`Switched to ${PROVIDERS[state.currentProvider]?.name || state.currentProvider}`, "info");
    };
  }

  // Language selector
  const langSel = $("promptLangSelect");
  if (langSel) langSel.onchange = e => { state.currentLanguage = e.target.value; };

  // Send button
  $("sendBtn").onclick = sendPrompt;

  // Prompt textarea auto-resize & char counter
  const ta = $("promptInput");
  ta.oninput = () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    $("charCounter").textContent = `${ta.value.length} / 8000`;
  };

  // Keyboard shortcuts
  window.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "b") {
      e.preventDefault();
      sidebar.classList.toggle("collapsed");
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "N") {
      e.preventDefault();
      createNewSession(true);
    }
  });

  ta.onkeydown = e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      sendPrompt();
    }
  };

  // File attach
  $("promptFileInput").onchange = e => handleFileAttachments(e.target.files);

  // Suggestion cards
  $$(".suggestion-card").forEach(card => {
    card.onclick = () => {
      const text = card.dataset.prompt;
      if (text) {
        ta.value = text;
        ta.dispatchEvent(new Event("input"));
        ta.focus();
      }
    };
  });

  // Settings modal
  const modal      = $("settingsModal");
  const openModal  = () => { populateApiKeyInputs(); modal.style.display = "flex"; };
  const closeModal = () => { modal.style.display = "none"; };

  $("openSettingsBtn").onclick  = openModal;
  $("headerKeyBtn").onclick     = openModal;
  $("closeSettingsBtn").onclick = closeModal;

  // Close on backdrop click
  modal.onclick = e => { if (e.target === modal) closeModal(); };

  // Save API keys
  $("saveKeysBtn").onclick = () => {
    const keys = {
      gemini:   ($("keyGemini")  ? $("keyGemini").value.trim()  : ""),
      sarvam:   ($("keySarvam")  ? $("keySarvam").value.trim()  : ""),
      nemotron: ($("keyNvidia")  ? $("keyNvidia").value.trim()  : ""),
      bonsai:   ($("keyBonsai")  ? $("keyBonsai").value.trim()  : ""),
    };
    saveApiKeys(keys);
    closeModal();
  };

  // Clear keys
  $("clearKeysBtn").onclick = () => {
    if (confirm("Clear all stored API keys?")) {
      saveApiKeys({});
      populateApiKeyInputs();
      const msgEl = $("keyValidationMsg");
      if (msgEl) msgEl.style.display = "none";
    }
  };

  // Validate key buttons
  $$(".btn-validate-key").forEach(btn => {
    btn.onclick = async () => {
      const provider = btn.dataset.provider;
      const inputMap = { gemini: "keyGemini", sarvam: "keySarvam", nemotron: "keyNvidia", bonsai: "keyBonsai" };
      const inputEl  = $(inputMap[provider]);
      const key      = inputEl ? inputEl.value.trim() : "";
      if (!key) {
        showToast("Enter an API key first", "error");
        return;
      }
      await validateApiKey(provider, key);
    };
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// DRAG & DROP and PASTE
// ─────────────────────────────────────────────────────────────────────────────
function setupDragAndDrop() {
  const dock = document.querySelector(".prompt-card-container");
  if (!dock) return;

  dock.ondragover  = e => { e.preventDefault(); dock.classList.add("drag-active"); };
  dock.ondragleave = () => dock.classList.remove("drag-active");
  dock.ondrop      = e => {
    e.preventDefault();
    dock.classList.remove("drag-active");
    if (e.dataTransfer.files.length) handleFileAttachments(e.dataTransfer.files);
  };
}

function setupClipboardPaste() {
  window.addEventListener("paste", e => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items || [];
    const files = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      handleFileAttachments(files);
      showToast("📎 Image pasted from clipboard", "success");
    }
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// UI UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function updateHeaderModelBadge(providerId) {
  const badge = $("headerModelBadge");
  if (!badge) return;
  const prov = PROVIDERS[providerId] || PROVIDERS.gemini;
  badge.textContent = `${prov.icon} ${prov.name}`;
}

function scrollChatToBottom() {
  const vp = $("chatViewport");
  if (vp) vp.scrollTop = vp.scrollHeight;
}

function showToast(msg, type = "info") {
  const container = $("toastContainer");
  if (!container) return;

  const toast       = document.createElement("div");
  toast.className   = `toast ${type}`;
  const icon = type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️";
  toast.innerHTML   = `<span>${icon}</span> <span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 400);
  }, 3800);
}

function getRelativeTime(isoStr) {
  if (!isoStr) return "recently";
  const sec = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (sec < 60)    return "just now";
  if (sec < 3600)  return Math.floor(sec / 60) + "m ago";
  if (sec < 86400) return Math.floor(sec / 3600) + "h ago";
  return Math.floor(sec / 86400) + "d ago";
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[m]));
}
