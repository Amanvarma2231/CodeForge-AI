# 🚀 CodeForge AI Pro Studio — Multi-Model AI Code Generator & Assistant

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0+-000000?style=for-the-badge&logo=flask&logoColor=white)
![Sarvam AI](https://img.shields.io/badge/Sarvam_AI-105B-FF6B2B?style=for-the-badge)
![NVIDIA Nemotron](https://img.shields.io/badge/NVIDIA-Nemotron_70B-76B900?style=for-the-badge&logo=nvidia&logoColor=white)
![Bonsai AI](https://img.shields.io/badge/Bonsai_AI-v1-00C9A7?style=for-the-badge)
![Render](https://img.shields.io/badge/Render-Deployment_Ready-46E3B7?style=for-the-badge&logo=render&logoColor=white)

An enterprise-grade, full-stack AI Assistant & Code Generation Studio built with **Flask**, **Python**, and a modern, high-performance **Glassmorphism Dark UI**. Powered by **Sarvam AI**, **NVIDIA Nemotron 70B**, and **Bonsai AI**, supporting universal general-knowledge Q&A, multi-file code analysis (`.py`, `.tar.gz`, `.zip`), image OCR/vision, and multi-format exports (`.py`, `.tar.gz`, `.zip`).

---

## 🌟 Key Features

### 🤖 Multi-Model AI Support
* 🇮🇳 **Sarvam AI (`sarvam-105b`)**: India's custom LLM for localized multilingual intelligence, reasoning, and code generation.
* ⚡ **NVIDIA Nemotron (`nvidia/llama-3.1-nemotron-70b-instruct`)**: High-capacity enterprise AI for complex logic, algorithms, and deep reasoning.
* 🌿 **Bonsai AI (`bonsai-coder-v1`)**: Rapid-response assistant for swift coding solutions.

### 📂 Full File & Archive Upload Support
* **Python Files (`.py`)**: Direct syntax parsing, line-by-line inspection, and contextual code generation.
* **Compressed Archives (`.tar.gz`, `.zip`, `.tar`)**: Auto-extracts Python code files from compressed project archives and feeds code structure directly into AI context.
* **Multimodal Images (`.png`, `.jpg`, `.jpeg`, `.webp`)**: Attach diagrams, UI mockups, or error tracebacks for visual analysis.

### 📥 Flexible Export & Download
* Download AI-generated code directly as **Python files (`.py`)**, **Gzip Archives (`.tar.gz`)**, or **Zip Archives (`.zip`)**.
* One-click Markdown chat session export (`.md`).

### 💬 Universal ChatGPT-Style Assistant
* Answers any question across general knowledge, science, mathematics, writing, essay creation, and code debugging.
* Persistent conversation history saved per session in `localStorage` with real-time search.
* Code block copy buttons, syntax highlighting (Highlight.js), and LaTeX rendering.

---

## 🏗️ Project Architecture

```
ai-codegen-app/
├── app.py                  # Flask REST API backend & AI Provider Handler
├── requirements.txt        # Production Python dependencies
├── Procfile                # Gunicorn entrypoint for Render / Heroku
├── render.yaml             # Render 1-click infrastructure config
├── runtime.txt             # Python runtime specification (3.11.9)
├── .env                    # Local environment variables (API Keys)
├── static/
│   ├── css/
│   │   └── style.css       # Production Glassmorphism UI stylesheet
│   └── js/
│       └── app.js          # Interactive frontend script (State, History, API)
├── templates/
│   └── index.html          # Main Web Application Interface
├── uploads/                # Temporary uploaded user files
└── downloads/              # Generated downloadable code & archives
```

---

## ⚙️ Local Installation & Setup Guide

### 1. Prerequisites
* Python 3.10+ installed on your system.

### 2. Clone Repository & Setup Virtual Environment
```bash
git clone https://github.com/Amanvarma2231/ai-codegen-app.git
cd ai-codegen-app

# Create & activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure API Keys (`.env`)
Copy `.env.example` to `.env` or edit `.env` directly:
```env
SARVAM_API_KEY=sk_tr5rvo97_Nc4sJWfV9lKRYBhBTnQwLC2L
NVIDIA_API_KEY=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
BONSAI_API_KEY=bonsai_at_0mqN3fYvkqDaN4wpiL5l-sFR_3qIQX5oqdpPkXKgi8Y

FLASK_SECRET_KEY=production-secret-key-change-me
FLASK_DEBUG=true
PORT=5000
```

### 5. Launch Local Application Server
```bash
python app.py
```
Open **[http://localhost:5000](http://localhost:5000)** in your web browser.

---

## 🌐 Deploying to Render (1-Click Deployment)

This repository includes pre-configured `render.yaml` and `Procfile` for seamless deployment on **Render.com**:

1. Push your repository to **GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit for production"
   git push origin main
   ```
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** → **Blueprint**.
4. Connect your GitHub repository (`ai-codegen-app`).
5. Render will automatically detect `render.yaml` and prompt you to enter Environment Variables (`SARVAM_API_KEY`, `NVIDIA_API_KEY`, `BONSAI_API_KEY`).
6. Click **Apply** — your production web application will be live in 2 minutes!

---

## 👨‍💻 Developer & Contact Details

**Developed & Built by:** **Aman Varma**

* 💼 **LinkedIn Profile:** [https://www.linkedin.com/in/aman-v-697771345](https://www.linkedin.com/in/aman-v-697771345)
* 🐙 **GitHub Profile:** [https://github.com/Amanvarma2231](https://github.com/Amanvarma2231)
* 🌐 **Portfolio Website:** [https://aman-portfolio-chi.vercel.app](https://aman-portfolio-chi.vercel.app)
* 📧 **Email:** [amangurauli@gmail.com](mailto:amangurauli@gmail.com)
* 📞 **Phone:** [+91 6306572504](tel:+916306572504)

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
