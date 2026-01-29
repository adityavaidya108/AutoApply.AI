# AutoApply.AI

<div align="center">

**An AI agent that rewrites your resume, finds matching jobs, and applies for them autonomously.**

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green.svg)](https://fastapi.tiangolo.com/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension%20v3-yellow.svg)](https://developer.chrome.com/docs/extensions/)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

</div>

---

## What It Does

| Feature | Description |
|--------|-------------|
| **Resume optimization** | Upload a PDF resume + job description → get an ATS-friendly tailored resume (PDF) or improvement suggestions (JSON). |
| **Document parsing** | Upload resume, cover letter, and Q&A sheet (PDF/Word) → parsed into structured data and stored in the extension. |
| **Personalized answers** | Backend generates tailored answers to application questions using your resume and cover letter. |
| **Job search** | Search jobs by keywords via Playwright (e.g. LinkedIn); requires credentials and can hit timeouts. |
| **Browser extension** | Detects job application forms, maps fields, and autofills from your stored data with human-like typing. |

---

## Project Structure

```
AutoApply.AI/
├── app/                    # FastAPI backend
│   ├── api/
│   │   ├── resume.py       # /optimize-resume, /get-resume-suggestions
│   │   ├── user_data.py   # /parse-user-documents, /generate-personalized-answers
│   │   └── jobs.py        # /search-jobs
│   ├── main.py
│   └── schemas.py
├── extension/              # Chrome/Edge extension (Manifest v3)
│   ├── content.js         # Form detection, field mapping, autofill
│   ├── popup.js / popup.html / popup.css
│   ├── background.js
│   ├── storage.js         # Chrome storage for resume/cover/QA
│   ├── fieldMapping.js    # Field name → type mappings
│   └── manifest.json
├── modules/                # Core logic (interfaces + implementations)
│   ├── implementations/
│   │   ├── langchain_resume_optimizer.py
│   │   ├── pypdf_processor.py
│   │   ├── html_pdf_generator.py
│   │   └── playwright_job_scraper.py
│   └── interfaces/
├── tests/
│   ├── integration/       # test_resume_api.py
│   └── unit/              # test_pdf_processor, test_resume_optimizer
├── templates/             # Resume HTML template
├── static/
├── run_server.py          # Start backend (uvicorn)
└── pyproject.toml         # Poetry dependencies
```

---

## Quick Start

### Backend

1. **Install dependencies** (Poetry):

   ```bash
   poetry install
   ```

2. **Environment** (optional):

   - Create a `.env` with `OPENAI_API_KEY` for resume/LLM features.
   - For job search: `LINKEDIN_EMAIL`, `LINKEDIN_PASSWORD`.

3. **Run the API**:

   ```bash
   poetry run python run_server.py
   ```

   API: `http://127.0.0.1:8000` — docs at `http://127.0.0.1:8000/docs`.

### Extension

1. Open `chrome://extensions/` (or `edge://extensions/`).
2. Enable **Developer mode** → **Load unpacked** → select the `extension` folder.
3. Pin the extension; ensure the backend is running at `http://localhost:8000` for upload/parse and personalized answers.

Detailed setup and debugging: see `extension/QUICK_START_GUIDE.md` and `extension/LOCAL_RUN_AND_DEBUG.md`.

---

## What’s Working

- **Backend**
  - FastAPI app with CORS for the extension and local dev.
  - **Resume**: `POST /api/optimize-resume` (PDF in → tailored PDF out), `POST /api/get-resume-suggestions` (PDF + job desc → JSON suggestions).
  - **User data**: `POST /api/parse-user-documents` (resume/cover/QA PDF or Word → structured JSON); `POST /api/generate-personalized-answers` (resume + cover + questions → tailored answers).
  - **Jobs**: `POST /api/search-jobs` (Playwright-based search; depends on env and target site).
- **Extension**
  - Popup: upload/download/update for resume, cover letter, and Q&A sheet; status and dates; demographics and work-auth preferences in storage.
  - Storage: `storage.js` with get/save/download for resume, cover letter, QA; demographics and work-auth.
  - Form detection: platform detection (Workday, Greenhouse, Lever, LinkedIn, Indeed, generic); field identification via labels, placeholders, proximity; visual indicator and field highlights.
  - Autofill: data mapping from resume/cover/QA, typing simulation, delays, event dispatch; text/select/radio/checkbox; date/phone formatting; preview and fill-status UI; undo; optional personalized answers via backend; budget protection and manual-upload fallback for file inputs.
- **Core modules**
  - PDF text extraction (PyPDF), resume optimization and personalized answers (LangChain/OpenAI), HTML→PDF resume generation, Playwright job scraper interface and implementation.
- **Tests**
  - Unit tests for PDF processor and resume optimizer; integration tests for resume API (see note below in “Needs work”).

---

## What Needs Work

- **Job search**
  - Requires LinkedIn (or other) credentials and is sensitive to login/UI changes; timeouts and general errors can occur. Robustness and error handling need improvement.
- **Extension / autofill**
  - **File uploads**: Programmatic file input is restricted by the browser; extension uses fallbacks (e.g. manual upload notification + download link). File upload handling could be refined per platform.
  - **Forms**: Multi-step and conditional fields, rich text editors, and complex dropdowns may not be fully handled. More platforms and field mappings can be added.
  - **Validation**: Some sites enforce formats (e.g. phone `(XXX) XXX-XXXX`); format detection and retry logic could be improved.
- **Tests**
  - `tests/integration/test_resume_api.py`: `test_optimize_resume_success` expects a JSON response, but `POST /api/optimize-resume` returns a PDF. Tests should target the correct endpoint (e.g. `/get-resume-suggestions` for JSON) or assert on PDF response.
- **Docs and ops**
  - README and extension guides are in place; API docs are in OpenAPI at `/docs`. Need to add a short “Troubleshooting” section (e.g. CORS, extension host permissions, `.env`).

---

## API Summary

| Method | Endpoint | Purpose |
|--------|----------|--------|
| `POST` | `/api/optimize-resume` | Resume PDF + job description → tailored resume PDF. |
| `POST` | `/api/get-resume-suggestions` | Resume PDF + job description → JSON suggestions. |
| `POST` | `/api/parse-user-documents` | Resume / cover letter / QA (PDF or Word) → structured JSON. |
| `POST` | `/api/generate-personalized-answers` | Resume + cover + questions (+ optional job context) → personalized answers JSON. |
| `POST` | `/api/search-jobs` | Job search criteria → list of job listings (e.g. via Playwright). |

---

## Extension architecture

The extension is a Chrome/Edge Manifest v3 add-on with three main parts. **Popup** (`popup.html` + `popup.js`) lets users upload resume, cover letter, and Q&A documents; it talks to the backend to parse files and stores the result in **Chrome local storage** via `storage.js`. **Content script** (`content.js` + `fieldMapping.js`) runs on every page: it detects job-application platforms (Workday, Greenhouse, Lever, LinkedIn, Indeed, or generic), finds form fields using labels and placeholders, and shows a floating “Fill form” control. When the user triggers autofill, the content script maps stored data to fields using `fieldMapping.js`, optionally calls the backend for personalized answers to open-ended questions, then fills inputs with human-like typing and events. **Background** (`background.js`) is a service worker that relays messages and logs form-detection events. The extension expects the backend at `http://localhost:8000` for parsing and personalized-answer APIs.

---

## License

MIT.
