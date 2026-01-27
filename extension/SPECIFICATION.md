# Browser Extension Development Plan
## AutoApply.AI - Job Application Autofill Extension

---

## 📋 **OVERVIEW**

Build a Chrome/Edge browser extension that:
1. Stores user data (resume, cover letter, Q&A answers)
2. Detects job application forms on websites (Workday, etc.)
3. Autofills form fields with stored data
4. Provides UI to manage stored data

---

## 🎯 **DEVELOPMENT PHASES**

### **PHASE 1: Foundation & Setup** ✅ START HERE
**Goal**: Create a basic extension that loads and runs

**Spec 1.1: Extension Structure**
- Create manifest.json (v3) with basic permissions
- Create popup.html (UI when clicking extension icon)
- Create background.js (service worker)
- Create content.js (runs on web pages)
- Test: Extension loads in Chrome without errors

**Deliverable**: Empty extension that shows "Hello World" in popup

---

### **PHASE 2: Data Storage**
**Goal**: Store and retrieve user data from uploaded documents

**Spec 2.1: Enhanced Storage System with File Upload & Status Display**

#### **2.1.1: Backend API Integration**
- Create new backend endpoint: `POST /api/parse-user-documents`
- Accepts multipart form data:
  - `resume_file`: PDF (required)
  - `cover_letter_file`: PDF/text (optional)
  - `qa_sheet_file`: PDF/text (optional)
- Backend processing:
  1. Extract text from PDFs using `PyPDFProcessor`
  2. Use Langchain LLM to parse documents into structured JSON:
     - Resume → structured JSON (similar to `ATSFriendlyResume` schema)
     - Cover letter → text string
     - QA sheet → structured JSON (questions → answers mapping)
  3. Return combined JSON response with parsed data
- Register endpoint in `app/main.py`

#### **2.1.2: Storage Data Structure**
- Enhanced storage structure with file metadata:
  ```javascript
  {
    resume: {
      // Parsed JSON data from LLM
      data: {
        full_name: "",
        contact_info: { phone: "", email: "" },
        experience: [...],
        education: [...],
        skills: [...],
        // ... other fields from ATSFriendlyResume schema
      },
      // Original file metadata
      originalFile: {
        name: "resume.pdf",
        uploadedAt: "2024-01-15T10:30:00Z",
        fileData: "base64..." // or blob reference for download
      }
    },
    coverLetter: {
      text: "Dear Hiring Manager...",
      originalFile: {
        name: "cover_letter.pdf",
        uploadedAt: "2024-01-16T14:20:00Z",
        fileData: "base64..."
      }
    },
    qa: {
      answers: {
        whyWorkHere: "",
        whyYou: "",
        salary: "",
        // ... other common questions
      },
      originalFile: {
        name: "qa_sheet.pdf",
        uploadedAt: "2024-01-17T09:15:00Z",
        fileData: "base64..."
      }
    }
  }
  ```

#### **2.1.3: Storage Module (storage.js)**
- Create `storage.js` with functions:
  - **Status Functions:**
    - `getStorageStatus()` → Returns `{ resume: true/false, coverLetter: true/false, qa: true/false }`
  - **Save Functions:**
    - `saveResume(data, originalFile)` → Save parsed resume data + original file
    - `saveCoverLetter(text, originalFile)` → Save cover letter text + original file
    - `saveQA(answers, originalFile)` → Save Q&A answers + original file
  - **Retrieve Functions:**
    - `getResume()` → Returns `{ data, originalFile }`
    - `getCoverLetter()` → Returns `{ text, originalFile }`
    - `getQA()` → Returns `{ answers, originalFile }`
  - **Download Functions:**
    - `downloadResume()` → Triggers browser download of original PDF
    - `downloadCoverLetter()` → Triggers download of cover letter
    - `downloadQASheet()` → Triggers download of QA sheet
- Uses `chrome.storage.local` API

#### **2.1.4: Popup UI (popup.html)**
- File upload interface with status display:
  ```
  ┌─────────────────────────────────┐
  │  AutoApply.AI                   │
  ├─────────────────────────────────┤
  │                                 │
  │  📄 Resume                      │
  │  ✓ Stored on Jan 15, 2024      │
  │  [Download] [Update]            │
  │                                 │
  │  📝 Cover Letter                │
  │  ✗ Not uploaded                │
  │  [Upload]                       │
  │                                 │
  │  ❓ QA Sheet                    │
  │  ✗ Not uploaded                │
  │  [Upload]                       │
  │                                 │
  │  [View All Stored Data]         │
  └─────────────────────────────────┘
  ```
- Features:
  - Status indicators (✓ stored / ✗ not uploaded)
  - Upload date display for stored documents
  - Download buttons for stored documents
  - Update buttons to replace existing documents
  - File input elements (hidden, triggered by buttons)
  - Loading indicators during upload/processing
  - Success/error message display
  - "View All Stored Data" button (shows formatted preview)

#### **2.1.5: Popup Logic (popup.js)**
- On popup open:
  - Call `getStorageStatus()` to check what's stored
  - Update UI to show status for each document type
  - Enable/disable buttons based on storage status
  - Display upload dates for stored documents
- File upload flow:
  - User clicks "Upload" button → trigger file input
  - User selects file → show loading indicator
  - Send file to backend API (`/api/parse-user-documents`)
  - Receive parsed JSON response
  - Save parsed data + original file to Chrome storage
  - Refresh UI status display
  - Show success message
- Download flow:
  - User clicks "Download" button
  - Retrieve original file from storage
  - Trigger browser download using Blob API
- Update flow:
  - Same as upload, but replaces existing data
- View data flow:
  - User clicks "View All Stored Data"
  - Retrieve all stored data
  - Display formatted preview (or open modal/page)
  - Show: Name, Email, Phone, Experience summary, etc.

#### **2.1.6: Incremental Upload Support**
- Users can:
  - Upload resume first (required)
  - Add cover letter later (optional)
  - Add QA sheet later (optional)
  - Update any document independently without affecting others
- Each document stored separately
- UI shows clear status for each document type

#### **2.1.7: Manifest Updates**
- Ensure `manifest.json` has:
  - `"storage"` permission (already present)
  - Backend API URL in `host_permissions` (if not localhost)
  - Or use `"http://localhost:8000/*"` for local development

**Deliverable**: 
- Users can upload resume/cover letter/QA sheet files
- Files are parsed by backend LLM into structured JSON
- Parsed data + original files stored in Chrome storage
- UI shows storage status and allows downloads
- Users can add/update documents incrementally

---

### **PHASE 3: Backend API Implementation**
**Goal**: Create backend endpoint to parse uploaded documents using LLM

**Spec 3.1: Parse User Documents Endpoint**
- Create new endpoint: `POST /api/parse-user-documents`
- Location: `app/api/user_data.py` (new file)
- Accepts multipart form data (ALL OPTIONAL - supports incremental uploads):
  - `resume_file`: PDF (optional)
  - `cover_letter_file`: PDF or Word (.pdf, .doc, .docx) (optional)
  - `qa_sheet_file`: PDF or Word (.pdf, .doc, .docx) (optional)
- **Important**: At least ONE file must be provided (validate this)
- **Incremental upload support**:
  - User can upload resume only → returns `{ resume: {...} }`
  - User can upload cover letter only → returns `{ coverLetter: "..." }`
  - User can upload QA sheet only → returns `{ qa: {...} }`
  - User can upload any combination → returns only the parsed files that were sent
- Processing flow:
  1. Validate at least one file is provided
  2. For each file provided:
     - **Resume (PDF)**: Extract text using `PyPDFProcessor`, then parse with LLM
     - **Cover letter (PDF/Word)**: 
       - If PDF → Extract text using `PyPDFProcessor`
       - If Word (.doc/.docx) → Extract text using appropriate library (python-docx or similar)
       - Return as text string (minimal processing)
     - **QA sheet (PDF/Word)**: 
       - If PDF → Extract text using `PyPDFProcessor`
       - If Word (.doc/.docx) → Extract text using appropriate library
       - Parse extracted text with LLM to extract Q&A pairs
     - Use Langchain LLM to parse documents:
       - Resume → structured JSON (using `ATSFriendlyResume` schema, but without job description)
       - Cover letter → text string (return as-is or with minimal processing)
       - QA sheet → structured JSON (questions → answers mapping)
  3. Return JSON response with ONLY the parsed data for files that were sent:
     - If resume sent → `{ resume: {...} }` or `{ data: {...} }`
     - If cover letter sent → `{ coverLetter: "..." }` or `{ text: "..." }`
     - If QA sheet sent → `{ qa: {...} }` or `{ answers: {...} }`
     - If multiple sent → `{ resume: {...}, coverLetter: "...", qa: {...} }`
- Error handling:
  - Validate at least one file is provided (400 if none)
  - Validate file types:
    - Resume must be PDF (400 if not)
    - Cover letter must be PDF or Word (.pdf, .doc, .docx) (400 if not)
    - QA sheet must be PDF or Word (.pdf, .doc, .docx) (400 if not)
  - Handle PDF extraction errors (500 with message)
  - Handle Word document extraction errors (500 with message)
  - Handle LLM parsing errors (500 with message)
  - Return appropriate HTTP status codes

**Spec 3.2: Resume Parser (without job description)**
- Create new method in `LangChainResumeOptimizer` or new parser class
- Parse resume PDF into `ATSFriendlyResume` schema
- No job description needed (unlike existing `optimize_resume` method)
- Extract: name, contact info, experience, education, skills, etc.

**Spec 3.3: Cover Letter Parser**
- Extract text from cover letter file (PDF or Word)
- If PDF → Use `PyPDFProcessor` to extract text
- If Word (.doc/.docx) → Use python-docx or similar library to extract text
- Return as plain text string
- Minimal processing (may clean up whitespace/formatting if needed)

**Spec 3.4: QA Sheet Parser**
- Extract text from QA sheet file (PDF or Word)
- If PDF → Use `PyPDFProcessor` to extract text
- If Word (.doc/.docx) → Use python-docx or similar library to extract text
- Parse extracted text into structured JSON using LLM
- Extract questions and answers from unstructured text
- Return as dictionary: `{ question1: answer1, question2: answer2, ... }`
- Use LLM to identify Q&A pairs from text (handles various formats)

**Spec 3.5: Register Endpoint**
- Add router to `app/main.py`
- Import and include new `user_data` router
- Test endpoint with sample files

**Deliverable**: 
- Backend endpoint accepts file uploads
- Parses documents using Langchain LLM
- Returns structured JSON data
- Extension can successfully upload and parse files

---

### **PHASE 4: Form Detection**
**Goal**: Detect job application forms on websites and identify form fields

**Spec 4.1: Job Application Form Detection**

#### **4.1.1: Platform Detection**
- Detect common job application platforms:
  - **Workday** (workday.com, *.myworkdayjobs.com)
  - **Greenhouse** (greenhouse.io, boards.greenhouse.io)
  - **Lever** (lever.co, jobs.lever.co)
  - **LinkedIn** (linkedin.com/jobs)
  - **Indeed** (indeed.com)
  - **Generic forms** (fallback for unknown platforms)
- Detection methods:
  - URL pattern matching (domain-based)
  - DOM structure analysis (platform-specific selectors)
  - Form field analysis (common job application field names)
- Store detected platform in content script state

#### **4.1.2: Form Field Identification**
- Identify common job application form fields:
  - **Personal Information:**
    - First Name / Given Name
    - Last Name / Surname / Family Name
    - Email / Email Address
    - Phone / Phone Number / Mobile
    - Address / Street Address
    - City
    - State / Province
    - ZIP / Postal Code
    - Country
  - **Professional Information:**
    - Resume / CV upload
    - Cover Letter upload
    - LinkedIn Profile URL
    - Portfolio / Website URL
    - Years of Experience
    - Current/Previous Job Title
    - Current/Previous Company
  - **Education:**
    - School / University
    - Degree / Major
    - Graduation Date
    - GPA (if requested)
  - **Questions:**
    - "Why do you want to work here?"
    - "What interests you about this role?"
    - "Salary expectations"
    - "Are you authorized to work in [country]?"
    - Custom questions (text areas, text inputs)
- Field identification methods (prioritized by reliability):
  - **Label-based matching** (PRIMARY): Match `<label>` text to field names - most reliable as labels are user-visible
  - **Placeholder matching** (PRIMARY): Match `placeholder` attributes - reliable as placeholders are user-visible
  - **Visual proximity** (SECONDARY): Match fields near known labels - useful when label/field relationship is clear
  - **ARIA label matching** (SECONDARY): Match `aria-label` attributes - may work if sites use meaningful aria-labels
  - **Name/ID matching** (NOT RECOMMENDED): Most job sites use auto-generated IDs/names (e.g., `input_12345`, `field_abc123`) that don't contain meaningful information. Only use as last resort if pattern is consistent.
- Create field mapping: `{ fieldType: HTMLElement }` for each detected field
- **Note**: Focus on user-visible text (labels, placeholders) rather than technical attributes (IDs, names) since these are often auto-generated by the application platforms

#### **4.1.3: Content Script Enhancement (content.js)**
- Add form detection function:
  - `detectJobApplicationForm()` → Returns `{ platform: string, fields: Object, isJobForm: boolean }`
  - Runs automatically when page loads
  - Re-runs when DOM changes (MutationObserver for dynamic forms)
- Add field identification function:
  - `identifyFormFields()` → Returns `{ firstName: Element, email: Element, ... }`
  - Uses multiple strategies (label, placeholder, name/id, aria-label)
  - Handles various input types: `input`, `textarea`, `select`
- Add platform-specific detection:
  - `detectWorkdayForm()` → Workday-specific selectors
  - `detectGreenhouseForm()` → Greenhouse-specific selectors
  - `detectLeverForm()` → Lever-specific selectors
  - `detectLinkedInForm()` → LinkedIn-specific selectors
  - `detectGenericForm()` → Fallback for unknown platforms
- Store detection results in content script state
- Send detection results to background script for logging/analytics

#### **4.1.4: Visual Indicators**
- Add visual indicator when job application form is detected:
  - Floating badge/button: "AutoApply.AI: Form Detected ✓"
  - Position: Top-right corner of page
  - Styling: Distinctive but non-intrusive
  - Click to show detected fields summary
- Show field mapping status:
  - Green checkmark for successfully identified fields
  - Yellow warning for partially matched fields
  - Red X for unmapped fields
- Add toggle to show/hide field highlights:
  - Highlight detected fields with colored border
  - Show tooltip with mapped field name on hover

#### **4.1.5: Background Script Enhancement (background.js)**
- Log form detection events:
  - Platform detected
  - Number of fields identified
  - Detection timestamp
  - Page URL
- Store detection statistics (optional):
  - Track which platforms are most common
  - Track field identification success rates

#### **4.1.6: Field Mapping Configuration**
- Create field mapping configuration:
  - Common field name variations → standardized field types
  - Example: `["first name", "firstname", "given name", "fname"]` → `firstName`
  - Example: `["email", "email address", "e-mail", "email_addr"]` → `email`
- Support custom field mappings (user-configurable)
- Handle international variations (e.g., "surname" vs "last name")

**Deliverable**: 
- Extension detects job application forms on major platforms
- Identifies and maps form fields to standardized field types
- Visual indicators show when forms are detected
- Field mapping works across different form structures

---

### **PHASE 5: Autofill Functionality**
**Goal**: Autofill detected form fields with stored user data

**Spec 5.1: Autofill Engine**

#### **5.1.1: Data Mapping**
- Map stored resume data to form fields:
  - `resume.data.full_name` → Split into `firstName` and `lastName`
  - `resume.data.contact_info.email` → `email`
  - `resume.data.contact_info.phone` → `phone` (format according to form requirements)
  - `resume.data.contact_info.address` → `address`, `city`, `state`, `zipCode`, `country`
  - `resume.data.experience[0]` → Most recent job title (`currentJobTitle`), company (`currentCompany`)
  - `resume.data.experience` → **Multiple entries**: Fill all experience entries if form has "Add experience" sections
  - `resume.data.education[0]` → Most recent school (`school`), degree (`degree`), graduation date (`graduationDate`)
  - `resume.data.education` → **Multiple entries**: Fill all education entries if form has "Add education" sections
  - `resume.data.skills` → Skills (if form has skills field - may be comma-separated, tags, or textarea)
  - Calculate `yearsOfExperience` from experience array (sum of all experience durations)
  - `resume.data.references` → References section (if available and form requests references)
- Map stored cover letter to text areas:
  - `coverLetter.text` → Cover letter text area (if detected)
  - `coverLetter.text` → Cover letter file upload (if file input detected)
- Map stored QA answers to non-personalized fields:
  - `qa.answers.salary` → Salary expectation field
  - Other non-personalized answers (e.g., work authorization, visa status)
- **Note**: Personalized questions (e.g., "Why do you want to work here?") are handled via LLM generation (see 5.1.5)

#### **5.1.2: Anti-Bot Detection Avoidance**
- **Human-like typing simulation**:
  - Add delays between field fills (random 50-200ms per field)
  - Simulate typing speed (character-by-character for longer text, with variable delays)
  - Add random pauses (100-500ms) to mimic human reading/thinking
  - Vary delay patterns (not uniform timing)
- **Mouse movement simulation**:
  - Simulate mouse movement to field before filling (if possible)
  - Trigger `focus` event before `input` event
  - Add small random mouse movements to appear human
- **Event sequence**:
  - Follow natural event order: `focus` → `click` → `input` → `change` → `blur`
  - Add small delays between events (10-50ms)
  - Use native browser events (not synthetic events that might be flagged)
- **Timing patterns**:
  - Avoid filling all fields instantly
  - Fill fields in logical order (top to bottom, left to right)
  - Add longer delays for textarea fields (simulate reading/thinking)
- **Interaction patterns**:
  - Scroll to field if not visible before filling
  - Click on field before filling (if safe to do so)
  - Avoid filling hidden or off-screen fields
- **Rate limiting**:
  - Limit fill speed to appear human (max 3-5 fields per second)
  - Add occasional longer pauses (1-3 seconds) to mimic breaks
- **Browser fingerprinting avoidance**:
  - Use standard DOM APIs (avoid non-standard methods)
  - Don't set values too quickly (detectable pattern)
  - Vary timing patterns between sessions

#### **5.1.3: Autofill Logic (content.js)**
- Create autofill function:
  - `autofillForm(fieldMapping, userData, personalizedAnswers)` → Fills form fields with user data
  - Handles different input types:
    - **Text inputs**: Set `value` property, then dispatch events with human-like timing
    - **Textareas**: Set `value` property with typing simulation for longer text
    - **Select dropdowns**: Find matching option (by text or value) and set `selected`, trigger `change` event
    - **Radio buttons**: Find matching option and set `checked`, trigger `change` event
    - **Checkboxes**: Set `checked` based on data (e.g., work authorization), trigger `change` event
    - **File inputs**: Handle resume/cover letter file uploads (see 5.1.5)
    - **Custom date pickers**: Handle calendar widgets (click date, use date input if available)
    - **Rich text editors**: Handle WYSIWYG editors (TinyMCE, CKEditor) - set content via editor API or innerHTML
    - **Autocomplete/typeahead fields**: Fill value, wait for suggestions, select matching option if needed
  - Trigger input events after filling (with anti-bot measures):
    - Dispatch `focus`, `click`, `input`, `change`, `blur` events in sequence
    - Add human-like delays between events
    - Use native browser events
    - Simulate typing for text fields (character-by-character with delays)
- **Multi-step/Multi-page forms**:
  - Detect if form is split across multiple pages/tabs
  - Fill current page/tab only
  - Provide navigation: "Next Page" or "Continue" button detection
  - Track which step/page has been filled
  - Allow user to navigate and fill subsequent pages
- **Dynamic sections** (e.g., "Add another experience"):
  - Detect "Add" buttons for repeating sections (experience, education, references)
  - Fill first section, then click "Add" button if more entries exist
  - Fill multiple entries from resume data (not just first entry)
  - Handle removal of sections if needed
- **Conditional fields**:
  - Detect fields that appear based on previous answers (e.g., visa questions after work authorization)
  - Wait for conditional fields to appear after triggering their parent field
  - Fill conditional fields after parent field is set
- **Field dependencies**:
  - Handle dependent fields (e.g., state dropdown depends on country selection)
  - Fill parent field first, wait for child field to populate, then fill child field
  - Handle cascading dropdowns (country → state → city)
- **Format requirements**:
  - Respect character limits (truncate if necessary, show warning)
  - Format phone numbers to match expected format (e.g., (555) 123-4567 vs 555-123-4567)
  - Format dates according to form's expected format
  - Handle format validation errors and retry with correct format
- **Iframe forms**:
  - Detect if form is in an iframe
  - Access iframe content (if same-origin) or provide instructions for cross-origin
- Add validation:
  - Check if field is visible and enabled before filling
  - Skip read-only or disabled fields
  - Handle required field indicators (asterisks, "required" labels)
  - Verify value was actually set (some forms may reject programmatic fills)
  - Wait for form validation to complete after filling
  - Handle validation errors and retry if needed
- Add error handling:
  - Log fields that couldn't be filled
  - Show user feedback for failed fills
  - Return fill status: `{ success: boolean, filled: number, failed: number, errors: [] }`

#### **5.1.4: User Control & UI**
- Add autofill button/control:
  - "Fill Form" button in floating badge (when form detected)
  - User must explicitly trigger autofill (no automatic filling)
  - Show confirmation dialog: "Fill all detected fields with your stored data?"
- Add selective autofill:
  - Show list of detected fields with checkboxes
  - User can select which fields to fill
  - Example: Fill name/email but not cover letter
  - Display preview: "Will fill: First Name, Last Name, Email, Phone..."
- Add preview before filling:
  - Show what data will be filled in each field
  - Format: "First Name: John", "Email: john@example.com", etc.
  - User can review and confirm before filling
- Add fill status feedback:
  - Show progress: "Filling 5 of 10 fields..."
  - Show success/error for each field
  - Summary: "Successfully filled 8 fields, 2 failed"
  - Display in floating badge or temporary notification

#### **5.1.5: File Upload Handling**
- Handle resume file upload:
  - Retrieve original resume file from storage (`resume.originalFile.fileData`)
  - Convert base64 to Blob
  - Create File object from Blob
  - **Note**: Browsers restrict programmatic file uploads for security
  - **Approach 1**: Try to set file input's files property using DataTransfer API (may not work)
  - **Approach 2**: Try drag-and-drop simulation (if form supports drag-and-drop)
  - **Approach 3**: Show user notification with download link to manually upload
  - **Approach 4**: Use File System Access API if available (limited browser support)
- Handle cover letter file upload:
  - Same process as resume
  - If form has text area for cover letter, fill with text instead of file
  - If form has rich text editor, use editor API to set content
- **Drag-and-drop file uploads**:
  - Detect drag-and-drop zones
  - Simulate drag-and-drop events (if possible)
  - Fallback to manual upload notification
- Fallback strategy:
  - If programmatic upload fails, show notification:
    - "Please manually upload your resume. Click here to download it."
    - Provide download link to stored file
    - Highlight the file input field or drag-and-drop zone
    - Auto-open file picker if possible (limited browser support)

#### **5.1.6: Personalized Question Answering (LLM Integration)**
- **Backend API Endpoint**:
  - Create new endpoint: `POST /api/generate-personalized-answers`
  - Accepts JSON payload:
    - `resume_data`: Parsed resume data (from storage)
    - `cover_letter_text`: Cover letter text (from storage)
    - `qa_answers`: Stored QA answers (for context, not direct answers)
    - `questions`: Array of detected personalized questions from form
      - Example: `["Why do you want to work here?", "Why are you a good fit for this role?"]`
    - `job_context`: Optional job description or company info (if available from page)
  - Returns: `{ answers: { question1: answer1, question2: answer2, ... } }`
- **LLM Prompt Engineering**:
  - Single LLM call for all personalized questions at once
  - Prompt structure:
    ```
    Based on the following resume, cover letter, and context, 
    generate personalized answers for these job application questions:
    
    Resume: [resume data]
    Cover Letter: [cover letter text]
    Context: [job description/company info if available]
    
    Questions:
    1. "Why do you want to work here?"
    2. "Why are you a good fit for this role?"
    ...
    
    Generate concise, professional answers (2-3 sentences each) that:
    - Reference specific experiences from the resume
    - Align with the cover letter's tone and key points
    - Are tailored to the specific question asked
    - Sound natural and authentic
    ```
  - Use Langchain LLM to generate answers
  - Return structured JSON: `{ "Why do you want to work here?": "answer...", ... }`
- **Question Matching**:
  - Match detected form questions to generated answers
  - Use fuzzy matching to handle question variations:
    - "Why do you want to work here?" matches "Why are you interested in this position?"
    - "Why are you a good fit?" matches "What makes you qualified for this role?"
  - Use string similarity (Levenshtein distance) for matching
  - Match keywords: "why", "work", "here", "interested", "fit", "qualified", "role"
- **Caching Strategy**:
  - Cache generated answers per question set (to avoid regenerating for same questions)
  - Cache key: hash of (resume data + questions)
  - Store in Chrome storage temporarily (session-based)
- **Error Handling**:
  - If LLM call fails, fall back to generic answers or skip personalized questions
  - Show user notification if LLM generation fails
  - Log errors for debugging

#### **5.1.7: Smart Field Matching**
- Handle multi-part fields:
  - Split full name into first/last if form has separate fields
  - Combine address components if form has separate fields
  - Handle name variations: "John Doe" → firstName: "John", lastName: "Doe"
- Handle date formatting:
  - Convert dates to form's expected format (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
  - Handle graduation dates, employment dates
  - Parse dates from resume data and format appropriately
- Handle dropdown/select matching:
  - Match text values (e.g., "United States" vs "USA" vs "US")
  - Match country names, state names, degree types
  - Use fuzzy matching for close matches

#### **5.1.8: Safety & Validation**
- Add safety checks:
  - Never autofill password fields (detect by type="password" or name/id containing "password")
  - Never autofill credit card or SSN fields (detect by name/id patterns)
  - Skip fields that look like security questions
  - Skip hidden fields (type="hidden")
- Add validation after filling:
  - Check if values were actually set (some forms may reject programmatic fills)
  - Verify field values match what was intended
  - Handle form validation errors (if form shows error messages)
- Add undo functionality:
  - Store original field values before filling
  - Provide "Undo Fill" button to restore original values
  - Track which fields were filled vs pre-filled by user

#### **5.1.9: Integration with Detection**
- Use detected fields from Phase 4:
  - Access `detectionState.fields` from form detection
  - Map detected field types to user data
  - Only attempt to fill fields that were successfully detected
- Update visual indicator:
  - Add "Fill Form" button to floating badge
  - Show fill status after autofill attempt
  - Update field highlights to show fill status (green = filled, yellow = failed)

**Deliverable**: 
- Extension can autofill job application forms with stored user data
- Anti-bot measures implemented (human-like typing, delays, event sequences)
- Personalized questions answered via LLM (single call for all questions)
- User has control over which fields to fill
- File uploads handled (with fallbacks for security restrictions)
- Smart matching for multi-part fields, dates, and dropdowns
- Safety checks prevent filling sensitive fields
- Undo functionality allows reverting fills

---
