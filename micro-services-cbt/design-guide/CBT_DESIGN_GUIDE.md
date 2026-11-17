# ParaLearn CBT: Design Guide

**Product:** ParaLearn CBT, the computer-based testing service at **cbt.pln.ng**.
**Code:** `micro-services-cbt/frontend/src` (it runs inside the main ParaLearn Next.js app; see `micro-services-cbt/README.md`).
**Parent design system:** `DESIGN.md` and `PRODUCT.md` at the repository root ("The Clear Register"). This guide extends that system for CBT; it does not replace it. Where the two disagree, this guide says so and explains why.
**Last updated:** November 2026, written from a full read of the current code.

This guide has three chapters:

1. **Every page we have today**: what is on it, what each feature does, and every state the redesign must keep.
2. **The design elements**: colours, type, spacing, components and copy rules, including what the code does today and what it should use.
3. **The landing page**: the sections a public CBT landing page needs, starting with the problem we solve.

> **Before you redesign anything:** the redesign must keep every feature and every state listed in Chapter 1. Much of the logic (offline answer saving, the timer's anti-tamper clock, PIN lookups, report-card release) has been tested end to end on production. Change how things look and where they sit, not what they do, unless a change of behaviour is agreed first.

> **Fixed in code since this guide was written (18 Nov 2026):** `cbt-workspace.css` and `cbt-entrance.css` now point at the shared ParaLearn colours (2.2): the private `--cbt-*` values are aliases, the status colours use the shared tints and ink, and violet buttons get lighter on hover and darker when pressed. Geist Mono is now loaded for the CBT pages (2.3). Green and amber text now use the darker shades that pass contrast (Tailwind `emerald-700`, 5.4:1, and `amber-700`, 5.0:1, instead of the shared vivid signals), and the white-text green buttons (Confirm Final Submission, Review & Submit, Approve & Finalize Grade, Publish, Import) are `emerald-700` with `emerald-800` on hover. Everything else in this guide is still open.

---

## Contents

- [Chapter 0: The product in one page](#chapter-0-the-product-in-one-page)
- [Chapter 1: Every page and feature](#chapter-1-every-page-and-feature)
  - [1.1 Site map](#11-site-map)
  - [1.2 Public pages](#12-public-pages)
  - [1.3 Candidate pages](#13-candidate-pages-the-exam-journey)
  - [1.4 Examiner workspace](#14-examiner-workspace)
  - [1.5 Problems that cut across pages](#15-problems-that-cut-across-pages)
- [Chapter 2: Design elements](#chapter-2-design-elements)
  - [2.1 Principles for CBT](#21-principles-for-cbt)
  - [2.2 Colour](#22-colour)
  - [2.3 Typography](#23-typography)
  - [2.4 Spacing, layout and breakpoints](#24-spacing-layout-and-breakpoints)
  - [2.5 Radius, borders and elevation](#25-radius-borders-and-elevation)
  - [2.6 Motion](#26-motion)
  - [2.7 Icons](#27-icons)
  - [2.8 Components](#28-components)
  - [2.9 Exam-room components](#29-exam-room-components)
  - [2.10 Print](#210-print)
  - [2.11 Words and voice](#211-words-and-voice)
  - [2.12 Accessibility checklist](#212-accessibility-checklist)
  - [2.13 Where the code drifts today](#213-where-the-code-drifts-today)
- [Chapter 3: The landing page](#chapter-3-the-landing-page)
- [Appendix: Suggested order of work](#appendix-suggested-order-of-work)

---

# Chapter 0: The product in one page

**What it is.** ParaLearn CBT lets anyone run a computer-based exam: write or generate questions, give candidates a code or a PIN, watch them sit the exam live, mark essays (with AI help), and publish results. A school using ParaLearn can also send the scores straight onto its ParaLearn report cards.

**Who uses it.** There are three kinds of user and two kinds of workspace.

| User | Workspace type (in code) | Where they are | What they need |
|---|---|---|---|
| **School admin or teacher** | `INSTITUTION`, "school workspace". They sign in with their ParaLearn account. | Staffroom or office, laptop | Set up an exam for existing classes in one go and get scores onto report cards without re-typing them |
| **Independent examiner** (tutorial centre, JAMB/WAEC lesson teacher, testing centre, recruiter) | `STANDALONE_HALL`, "exam hall". Self-sign-up, no ParaLearn school needed. | Anywhere, often a phone | Create a test in minutes, hand out codes or PINs, print slips, export results |
| **Candidate** (student or walk-in) | None. Candidates have no account. | School computer lab, cyber café, own phone; often weak power and network | Get in fast, never lose an answer, know exactly how much time is left, trust the result |

There is also a fourth, smaller audience: **developers** who connect their own apps to CBT through the public API (`/cbt/api-docs`).

**The two ways a candidate gets in.**
- **Open exam:** anyone with the exam code enters their name (email and phone are optional) and sits the exam. They get a participant ID so they can rejoin.
- **Registered candidates only** (`ROSTER_ONLY`): the examiner issues each candidate a 6-digit PIN. School exams always work this way. When a student types their PIN, the lobby recognises them by name ("Welcome, Serah Jenkins · Not you?").

**The exam lifecycle.** An exam goes through these stages:
1. Draft
2. Ready to publish (it has questions)
3. Published, which shows as **Open**, **Scheduled** or **Closed** depending on its time window
4. Candidates sit it (they show as Active or Locked)
5. Submitted
6. Essays pending review
7. Graded
8. For school exams only: scores sent to report cards

---

# Chapter 1: Every page and feature

## 1.1 Site map

| Route | Page | Audience | Shell |
|---|---|---|---|
| `cbt.pln.ng/` (rewritten to `/cbt`) | **Entrance** when signed out; **Examinations dashboard** when signed in | Everyone | None when signed out; sidebar when signed in |
| `/take` | Entrance (exam code box) | Candidates | None |
| `/take/[code]` | **Exam lobby** | Candidates | None |
| `/take/[code]/live` | **Live exam** | Candidates | None (full-screen exam) |
| `/take/[code]/results` | **Result slip** | Candidates | None |
| `/cbt/auth` | **Examiner sign-in / create exam hall** | Examiners | None |
| `/cbt` | **Examinations** (dashboard) | Examiners | Sidebar |
| `/cbt/exams/[id]` | **Question studio** | Examiners | Sidebar |
| `/cbt/exams/[id]/monitor` | **Candidate monitor** (live invigilation, grading, results, report cards) | Examiners | Sidebar |
| `/cbt/candidates` | **Candidates & PINs** | Examiners | Sidebar |
| `/cbt/settings` | **Workspace settings & API keys** | Examiners | Sidebar |
| `/cbt/api-docs` | **Developer API reference** | Developers (public) | None |

How routing works: on any `cbt.*` host, `/take/*`, `/api/*` and static files pass straight through. Every other path is served from `/cbt/*`, so `cbt.pln.ng/` shows the `/cbt` page. That page is the entrance for signed-out visitors and the dashboard for signed-in examiners. **The new landing page (Chapter 3) replaces the signed-out entrance at `/`.** `/take` stays a bare exam-code page for candidates.

Pages that do **not** exist yet but are referenced or implied: Question bank, Results (across exams), Billing/credits, Account/profile, Forgot password. The redesign should leave room for them in the navigation.

---

## 1.2 Public pages

### Entrance: `cbt.pln.ng/` (signed out) and `/take`
*File: `components/CBT/CbtEntrance.tsx` + `cbt-entrance.css`*

**Purpose:** get a candidate from "I have a code" to the lobby, and point examiners and developers to their areas.

**Layout, top to bottom:**
1. **Header:** ParaLearn logo + "CBT", and the **"Examiner sign in ↗"** button (to `/cbt/auth`).
2. **Hero:** eyebrow "Computer-based examinations", the H1 **"ParaLearn CBT"**, and the line "Your next examination starts here."
3. **Exam code form:**

| Feature | What it does |
|---|---|
| "Exam access code" field | Key icon. Forces upper case as you type. Max 80 characters. No autocomplete or spellcheck. |
| **"Continue to examination →"** | Goes to `/take/{CODE}`. Shows "Opening lobby…" with a spinner. Disabled while the field is empty. |
| Helper line | "No student account required. Have your exam code and candidate details ready." |
| Step indicator | 1 Exam code · 2 Your details · 3 Examination (step 1 is current) |

4. **Examiner band:** "For educators and examination centres" / "A dedicated space for your examinations.", the button "Open examiner workspace →", and two link rows: **Independent examiners** (to sign-in) and **Developers** (to the API docs).
5. **Footer:** © year ParaLearn · Developer API.

**States:** a grey two-bar skeleton flashes at `/` while the app checks whether an examiner is signed in. The code is not checked on this page; an invalid code is caught in the lobby.

**Redesign notes:**
- Three of the five calls to action go to the same place (examiner sign-in). Use one.
- Codes look like `BUSI-7642`. Show that format as a hint.
- The skeleton flash at `/` should go away once the landing page is server-rendered.

---

### Examiner sign-in: `/cbt/auth`
*File: `components/CBT/CbtAuthGateway.tsx`*

**Purpose:** one sign-in form for everyone. The server decides which workspace the email and password open.

| View | Content and features |
|---|---|
| **Sign in** (default) | Title "Sign in to ParaLearn CBT", subtitle "Use your ParaLearn school account or your exam hall account." An info banner tells school staff to use their ParaLearn email and password. Fields: Email (mail icon) and Password (lock icon, show/hide eye). Button **"Sign in →"** / "Signing in…". Link "Running your own exams? Create a free exam hall". |
| **Create exam hall** (`?mode=register`) | Title "Create a free exam hall", subtitle "For tutors and exam centres running their own tests." A green banner: "School staff don't need an exam hall…". Fields: **Your full name** (required); **Tutorial centre / brand name** (optional; defaults to "{Name}'s Exam Hall"); **Email**; **Create password** (minimum 8). Button **"Create exam hall"**. |
| **Choose a workspace** | Shown when one email opens both a school and an exam hall. One card each: "School workspace, with your ParaLearn classes and students" and "Your independent exam hall". Plus "Use a different account". |

Below the card: "Taking an examination? **Enter Exam Code →**" (to `/take`).

**Behaviour:**
- `?expired=1` shows "Your session has ended. Please sign in again."
- Success toasts: "Signed in to {school}", "Welcome back, {name}!", or `Exam hall "{name}" is ready.`
- Every error appears as a toast.

**Missing:**
- Forgot password.
- Inline field errors.
- "Back to CBT Portal" sends signed-out users in a circle.

---

### Developer API: `/cbt/api-docs`
*File: `app/cbt/api-docs/page.tsx` (static, public, never inside the sidebar shell)*

**Layout:**
- Sticky header: "← Back to CBT Workspace", "/ ParaLearn CBT API", a "v2" pill, and the CTA **"Get your API key"**.
- Hero, with chips "Base URL: https://cbt.pln.ng/api/cbt" and "Format: JSON over HTTPS".
- A sticky section nav on the left (desktop only), with the content on the right.

**Sections:** 1 Overview, 2 Authentication, 3 Exams, 4 Questions, 5 Candidates, 6 Taking an exam, 7 Results & invigilation, 8 Webhooks (events `exam.attempt.completed` and `exam.attempt.graded`, with a Node.js signature check), 9 Errors.

**Endpoint card:**
- A method badge: GET green, POST blue, PATCH amber, DELETE red.
- A monospace path.
- An access badge: "API key", "Attempt token" or "Public".
- A description.
- Dark request and response code blocks.

**Redesign notes:**
- Add copy buttons on code blocks, a mobile section menu and scroll-spy (highlight the current section).
- Method colours are a code convention, not status. Keep them, but take them from the signal ink colours (2.2) so they stay readable.

---

## 1.3 Candidate pages (the exam journey)

These are the most important screens in the product. Candidates are nervous, often on a shared or weak computer, and need **zero ambiguity**.

### Exam lobby: `/take/[code]`
*File: `components/CBT/CandidateLobby.tsx`*

**Purpose:** confirm the exam is open, identify the candidate, check the device, and start (or resume) the attempt.

**Links can prefill the form:** `?pin=`, `?name=`, `?email=` and `?attemptId=` (the last is for API integrations). Examiners share links like `/take/BUSI-7642?pin=482913`.

**Layout, top to bottom:**
1. Logo.
2. Step indicator ("2. Your details" is current).
3. **Exam header:**
   - A room-code badge, a clock icon with "{N} Minutes", and an "Exam Centre: {workspace}" pill.
   - The **exam title** (H1).
   - When the exam has a time window, a green pill: "Assessment window: {start} – {end}".
4. **Availability alert** (amber), when the exam can't be started:
   - "This exam isn't open yet. Check with your examiner."
   - "This exam opens {date, time}."
   - "This exam has closed."
5. **Identity form.** It has two layouts:

| Exam type | Fields and behaviour |
|---|---|
| **Open exam** | **Candidate Full Name** (required, "e.g. Daniel Olawale"). **Email (optional)** and **Phone (optional)** side by side. **"Rejoining? Enter your participant ID"**, collapsed. If this device has an attempt in progress, the participant ID shows in boxes, marked "Restored from this device", and the contact fields hide. |
| **Registered candidates only** (PIN first) | **"Access PIN / Candidate Number"**, "Issued by examiner": six boxes. Letters and digits only, upper-cased, auto-advance, backspace moves back, paste fills all boxes. When six characters are entered, it **looks the PIN up** ("Checking your PIN…"):<br>• **Found:** a violet card, "👤 Welcome, **{NAME}**" with a "Not you?" link that clears the PIN.<br>• **Not found:** red line, "That PIN isn't on this exam's list. Check the PIN on your exam slip."<br>• **Offline:** no lookup; the candidate starts as "Enrolled candidate".<br>This layout has no name field. |

6. **Examination instructions:** the examiner's text, or the default: "Answer all questions. Your responses are saved continuously and submitted when time expires."
7. **Exam Integrity Notice** (amber): leaving the window or switching tabs is logged. **{N} violations** submit the exam automatically and lock the attempt.
8. **System readiness:** three tiles.
   - Browser OK: always passes.
   - Anti-Cheat: checks that the browser can report tab switches.
   - Connected / Offline: live.
9. **"Start Examination Now →"** (full width, 48px). Reads "Preparing Exam Room…" while starting. Disabled when the exam isn't open.
10. Footer: "Powered by ParaLearn CBT".

**Other states:**
- **Loading:** "Loading exam room {CODE}…".
- **Not found:** red icon, **"Exam room unavailable"**, the reason, and **"Enter a different code"**.

**Behaviour after Start:**
- The whole exam (questions, deadline, clock offset) is saved on the device.
- The exam pages are cached for offline use.
- The candidate goes to `/live`.
- New walk-ins get a toast: "Your participant ID is {ID}. Keep it in case you need to rejoin." It lasts 8 seconds.
- A resumed attempt gets "Session restored…".

**Redesign must-haves:**
- Show the participant ID **on the page** and on the result slip, not only in a toast.
- Move instructions and the integrity notice **above** the Start button on mobile.
- Label each PIN box ("PIN character 1 of 6").
- Re-check availability when a scheduled start time passes, ideally with a live countdown.
- Show the room code and duration once (they currently appear twice).
- Make the readiness checks honest, or drop the fake "Browser OK".

---

### Live exam: `/take/[code]/live`
*File: `components/CBT/CandidateLiveExam.tsx`, plus `lib/cbtSessionManager.ts` and `lib/cbtOfflineSync.ts`*

**Purpose:** the exam itself. It runs entirely from the device, so it keeps working through power cuts and network drops.

**Layout:**
1. **Sticky header:**
   - The exam title and a "Question X of Y" badge.
   - The **timer** (MM:SS, monospace):
     - Neutral at 5 minutes or more.
     - **Amber** under 5 minutes.
     - **Red and pulsing** under 1 minute.
   - The **save status:**
     - Green dot, "All answers saved".
     - Amber dot, "Saving…".
     - Wi-fi-off icon, "Offline, answers saved on this device".
   - **Submit Exam** (dark button).
   - On screens under 1024px, a **question navigator** toggle.
2. **Question area:**
   - The **meta row:**
     - "Question N".
     - A type badge: Multiple choice, True / False, Multiple answers, Short Answer, or Extended Essay.
     - The marks.
     - **"View Scoring Rubric"**, when the question has a rubric. It opens a dialog listing the criteria and level descriptors.
     - **Flag for Review** (key **F**).
   - The **section tag**, e.g. "Section A".
   - The **question text** (plain text only today).
   - The **answer area** (see the table below).
   - **Navigation:** "‹ Previous" (key **P**), and **"Next Question"** (key **N**), which becomes **"Review & Submit"** on the last question.
3. **Question palette:**
   - Desktop: a 320px right column.
   - Under 1024px: a right-hand drawer.
   - A 5-column grid of numbers. Each cell shows its state (answered, unanswered, current, flagged) and a tiny type letter (S, L, M, TF).
   - A legend with live counts: Answered, Unanswered, Flagged.

**Answer area by question type:**

| Type | How it looks | How it is answered |
|---|---|---|
| **Multiple choice (MCQ)** | Full-width option cards (at least 56px tall), each with a round letter badge A–F. The selected card turns violet. | Click, keys **A–F**, or Enter/Space on the focused card. Saves instantly. |
| **True / False** | Same as MCQ | Same |
| **Multiple answers** | "Select all that apply." Square badges with a tick. | Each click or key toggles one option |
| **Short essay** | "Short Answer Response (Guideline: min–max words)". A live word and character count: amber below the minimum, red above the maximum, green otherwise. 5-row textarea. | Auto-saves 0.3s after typing stops |
| **Long essay** | "Comprehensive Essay Canvas (Minimum required: N words)". 12-row textarea. | Same |

**Behaviour the redesign must keep (and show clearly):**
- **Keyboard:** → or N next, ← or P previous, F flag, A–F choose. Shortcuts are ignored while typing or when a dialog is open.
- **Saving:**
  - Every answer is written to the device first.
  - It is then queued and sent to the server: on reconnect, when the tab becomes visible, every 15 seconds, and through background sync even after the tab closes.
  - Flags are stored on the device only.
- **Tamper-proof timer:** time is computed from the server deadline. Moving the device clock back has no effect.
- **The examiner can act during the exam.** The device checks every 20 seconds:
  - **Extra time** shows a toast, "Your examiner gave you N extra minute(s)."
  - **Force-submit** submits the exam immediately.
  - **Disqualify** submits the exam as malpractice.
- **Malpractice:**
  - Each tab switch shows "Malpractice Alert: Tab switch detected! (Violation X of N)".
  - At N violations the exam is submitted and locked.
  - Leaving the window without switching tabs is deliberately not counted.
- **Submit confirmation:**
  - Title "Confirm Exam Submission".
  - Counts: Answered, Unanswered, Flagged.
  - When the exam has essays, a notice: essays will be marked by the examiner.
  - Buttons "Return to Exam" and **"Confirm Final Submission"**.
- **Submitting overlay:**
  - **Sending:** "Submitting your exam…", "Please keep this page open."
  - **Saved here, waiting to send:** "Your exam is submitted on this device…", with a **Send now** button (it reads "Waiting for a connection" while offline).
  - **Rejected:** "Submission not accepted", the reason, "Your answers are still saved on this device", and **Try again**.
- **When time runs out,** the exam is submitted automatically ("Time limit expired…").

**Redesign must-haves:**
- **Warn before time runs out:** a toast or banner at 5 minutes and 1 minute, announced to screen readers. Give the pulse a reduced-motion alternative.
- Show the **candidate's name and PIN** in the header, so an invigilator can confirm identity at a glance.
- **Make the palette sticky on desktop.** Give it labels ("Question 4, answered, flagged"), Escape-to-close, and focus trapping in the drawer.
- **One action colour.** Today Submit is near-black, Next is violet and Review & Submit is green.
- **Fix the inaccurate hints.**
  - "Use keys A–D" is wrong; the keys are A–F.
  - "Press Next to save" is misleading; answers save as you type.
  - "cloud backup" overclaims.
- **One save indicator.** Today the header chip and the per-essay text can disagree.
- **Remove the "Exam session unavailable" flash** that appears on every load.
- **Leave room for images and maths in questions.** Plain text only today, but it is the most requested next feature for JAMB/WAEC prep.

---

### Result slip: `/take/[code]/results`
*File: `components/CBT/CandidateResultSlip.tsx`*

**Purpose:** proof of submission and the score.

**Behaviour:**
- It refreshes every 30 seconds while essays are being marked.
- It falls back to the device's copy when offline.

**Layout:** a single card.
1. **Header band:**
   - An icon: red when disqualified, amber clock when pending, violet award otherwise.
   - The title **"Official Examination Result Slip"**, plus "Exam Room Code: {CODE}".
   - When pending, the pill "Provisional • Essays Awaiting Examiner Grading".
2. **Candidate grid:**
   - Candidate Name.
   - Access PIN.
   - Submission Time.
   - Security Audit: "N tab switch(es) recorded". Green at 0, amber otherwise.
3. **Result box.** It has exactly one of four states:

| State | Content |
|---|---|
| **Disqualified** | "Examination Disqualified": locked for exceeding the tab-switch limit |
| **Results withheld** (examiner turned off instant results) | "Your exam has been submitted": the examiner will release results later; keep this slip |
| **Pending review** | "Objective MCQ Performance (Provisional)", a large score with "objective marks so far", and a note that the examiner is marking written answers and the page will update by itself |
| **Final** | "Final Assessment Score": a large **%** with "(score / total Marks)". When fully graded, "Objective MCQ" and "Theory & Essay" tiles. A **Grade** badge (server grade, or the WAEC scale A1 ≥75 … F9 <40). |

4. **Examiner feedback:** the overall comment, plus "Written answer N:" notes.
5. **Footer:** "Attempt reference" (12 characters, monospace) and a decorative QR icon with "Official Slip".
6. **Actions:** **Print Official Slip**, and **Finish**, which deletes the local copy and returns to `/take`.

**Redesign must-haves:**
- An "official" slip needs the **exam title, the institution or exam-hall name, the date, and the logo**.
- Either make the **QR code real** (a verification link) or remove it.
- **Finish** must warn first: "You won't be able to open this slip again on this device".
- Label the identifier "Participant ID" for walk-ins.
- Don't show "F9" when the total is 0.
- Say "Objective questions", not "MCQ" (True/False and multiple answers count too).
- Add a proper print stylesheet and, later, a PDF download.

---

## 1.4 Examiner workspace

### Shell and navigation (every `/cbt/*` page when signed in)
*File: `components/CBT/CbtWorkspaceShell.tsx` (`CbtWorkspaceHeader.tsx` is unused, old code)*

**Sidebar** (232px; becomes a drawer below 1024px, with the logo and a menu button in a top bar):
- **Logo:** ParaLearn + "CBT".
- **Workspace name**, labelled "Examiner workspace".
- **Primary navigation:**
  - **Examinations** (`/cbt`).
  - **Candidates** (`/cbt/candidates`).
- **Resources:**
  - **Candidate entrance ↗** (`/take`).
  - **Developer API** (`/cbt/api-docs`).
  - **Settings & API keys** (`/cbt/settings`).
- **Account:**
  - "Candidate credits: {n}".
  - An initial avatar, with the name and email.
  - A sign-out icon.
- **Skip to content** link for keyboard users.

School and exam-hall accounts get the same sidebar. The differences are inside the pages.

**Redesign notes:**
- **The active state is wrong.** "Examinations" stays highlighted on Settings, the studio and the monitor, and Settings is never highlighted.
- **Two items share one icon.** Settings and Developer API both use the code icon.
- **Credits have no explanation and no top-up**, and they show for school accounts too.
- **The account area needs work.**
  - Sign-out is a bare icon; replace it with a proper account menu.
  - Add a workspace switcher, since one email can open two workspaces.
- **Pages add their own back bars and headers on top of the sidebar.** Pick one navigation layer.
- **Plan slots for future pages:** Question bank, Results, Billing.

---

### Examinations dashboard: `/cbt`
*File: `app/cbt/page.tsx`*

**Purpose:** list, filter, create and publish exams.

**Data:**
- The list refreshes every 30 seconds.
- The last good copy is cached per workspace and shown when offline.

**Layout, top to bottom:**
1. **Heading:** "{Workspace} / Workspace", the H1 **"Examinations"**, a refresh icon and **"+ Create exam"**.
2. **Notices** (amber):
   - School with no exams: "Create your first exam, then bring in your students from ParaLearn…".
   - School with exams: "Bring in your students from ParaLearn…", with an **Import students** link and a dismiss ×, remembered per workspace.
   - Load error: "Connection interrupted. These results may be out of date." with **Retry**.
3. **Summary strip** (4 figures):

| Label | Value | Caption |
|---|---|---|
| Total exams | count | "{n} drafts" |
| Open for candidates | count | "Published and accepting entry" |
| Scheduled exams | count | "Upcoming opening windows" |
| Exam attempts | total | "Across all examinations" |

4. **Toolbar:**
   - Tabs with counts: All exams, Drafts, Open, Scheduled, Closed.
   - Search ("Search name or code").
   - Sort: Newest first, Oldest first, Name A to Z.
5. **Exam table.** It becomes stacked cards below 1024px.

| Column | Content |
|---|---|
| Examination | Title (links to the studio); code, duration, attempts |
| Status | **Draft** (no questions), **Ready to publish**, **Open**, **Scheduled**, **Closed**. Recomputed every 30s. |
| Questions | Count (links to the studio) |
| Availability | "Not published", "Entry closed", the start date and time, or "No time restriction" |
| Actions | **View/Edit questions**. Published exams: **copy candidate link**, **open entrance ↗**, and **Monitor** (labelled "Results" when closed). Unpublished with questions: **Publish exam**. Always: **Manage candidates**. |

6. **Empty states:**
   - First use: "Your first examination starts here", with **+ Create exam**.
   - No search matches: "No matching examinations", with **Clear filters**.
   - Error: "Exams are unavailable".
7. **Footer:** "{n} of {total} exams" · Candidate entrance ↗.

**Create examination dialog:**

| Group | Fields (defaults) |
|---|---|
| Basics | **Exam title** (required, ≤200, e.g. "Mathematics mock examination"); **Access code** (optional, A–Z 0–9 and hyphen, auto-generated if empty); **Duration** in minutes (5–360, default 60) |
| Availability | "Schedule an opening and closing time" (off). When on: **Opens** and **Closes** (local time; closing must be after opening and in the future). |
| **Students & report card** (schools only) | Three choice cards: **For report cards** (default): "Your class sits it and the scores go on ParaLearn report cards"; **Practice test**: "scores stay off report cards"; **Open exam**: "Anyone with the exam code can sit it". Report and practice modes show the **class picker** (chips with "· N students"). Report mode also shows **Subject** (only subjects every chosen class takes), **Counts as** (category, e.g. "Exam (60%)"), **Session** and **Term**, all pre-filled with the active term and the "Exam" category. Setup problems appear as plain-language amber messages that say where in ParaLearn to fix them. Admins whose school has no categories get a **one-click "Create 'Exam' category"** with an editable weight (default 60). If ParaLearn can't be reached, only "Open exam" is allowed. |
| Exam settings | Shuffle question order (on); Shuffle answer choices (on); Show results after submission (on); **Registered candidates only** (off; hidden for report and practice modes, which force it on); **Tab-switch limit** (1–20, default 3) |

- The footer has **Cancel** and **+ Create and add questions**. On success the app goes to the studio.
- The toasts report what happened, e.g. "Draft created for Mathematics (2026/2027 First Term). 34 students added with PINs."

**Publish dialog:**
- A summary: Questions, Duration, Candidate access code.
- A line saying when candidates can enter.
- Buttons **Keep draft** and **Publish exam**.

**Missing on this page:** delete, duplicate, rename, unpublish and bulk actions.

**Redesign notes:**
- Row actions are crowded and change shape by status. Use one primary action per status plus a "⋯" menu.
- Draft and Closed currently look identical.
- The Create dialog is long for schools. Consider a two-step dialog (Basics → Students & report card) or a full-page "New exam" flow.

---

### Question studio: `/cbt/exams/[id]`
*Files: `CbtQuestionStudio.tsx`, plus the modals below*

**Purpose:** write and edit questions, publish or unpublish, and reach settings, import, AI generation and rubrics.

**Layout:**
1. **Top bar:**
   - Left: back arrow, the exam title, and the code badge.
   - Right on desktop:
     - Copy Link.
     - **Live Monitor**.
     - **Import**.
     - **Settings**.
     - **Rubrics**.
     - **ParaLearn AI**.
     - **Save**.
   - Below 1024px, most of these move into a "⋯" menu.
2. **Status strip:**
   - The sync message: "Synced", "Ready to sync", or "Offline draft mode. Changes will stay local…".
   - "{n} questions · {n} marks · {n} mins".
   - A status badge: **"Published · students can join"** or **"Draft · students can't join yet"**.
   - The **Publish / Unpublish** button.
3. **Question list** (left, 288px, sticky):
   - "Questions (n)", "Total: N Marks".
   - **+ Add**: Multiple Choice, Short Essay (20–100 words), Long Essay / Theory, True / False.
   - Filter pills: All, MCQ, Short, Long.
   - Each row: number, prompt, type badge, "Rubric" badge, section, marks, and delete.
4. **Editor** (right):
   - "Editing Question #n", a **type switcher** (MCQ, Multiple answers, Short Essay, Long Essay, True/False) and **Marks** (step 0.5).
   - **Exam Section**, with Sec A/B/C shortcuts.
   - **Question statement.**
   - **Objective questions:**
     - The answer choices. Click the letter badge to mark the correct one; multiple answers allow several.
     - Add or remove options, between 2 and 6.
   - **Short essay:**
     - Minimum and maximum words.
     - A model answer, used as the AI benchmark.
     - Key terms.
   - **Long essay:**
     - Minimum and maximum words.
     - Expected arguments.
     - A **rubric card**: criteria and marks, with "Attach / Change Rubric".
   - **Explanation & Solution Notes** (all types).
5. **Mobile:**
   - A floating bottom bar: ‹, "Q i/n", ›, + Add.
   - The question list opens as a bottom sheet.

**Empty state:** "No questions in this examination yet", with **+ Add First Question** and **Generate with ParaLearn AI**.

**Saving and offline:**
- Every keystroke is kept on the device and marked unsaved. Unsaved local edits win over the server copy after a reload.
- **Save** checks every question has a prompt and complete options, then syncs.
- If offline: "Your changes are kept on this device; press Save again when you're online."
- Publishing is blocked until everything is saved.

**Modals opened from the studio:**

| Modal | Features |
|---|---|
| **Exam settings** (right sheet) | Title, access code, duration (1–600), "Only open between set times" with Opens and Closes, **Registered candidates only**, **Instructions for candidates** (≤5000; the only place to set them), tab switches allowed (1–20), shuffle questions, shuffle answers ("True/False keeps its order"), "Show the score when a candidate submits". Footer: **Delete exam** (with confirmation) and **Save settings**. |
| **Bulk import** | Upload .xlsx, .xls or .csv, one question per row. Columns: question, type, option_a–f, correct, marks, section, min_words, max_words, explanation, model_answer, key_terms. The result shows "{n} questions ready to add" plus a list of skipped rows with reasons. **Download template**. **Add {n} questions** (they still need Save). |
| **ParaLearn AI** (3 steps) | **Setup:** source is either an uploaded file (PDF, TXT, MD, audio or video, up to 4 MB) or pasted notes; subject or topic; format (**Hybrid** ~70/20/10, MCQ only, Theory only); difficulty (Simple, Intermediate, Hard, **Balanced mix**); count (5–30). **Generating:** progress messages; large sets are requested 10 at a time, with a retry; partial results are kept. **Review:** select or deselect each question; see options with the answer, model answers, rubrics, rationale and source citation; **Import {n} Questions**. |
| **Marking rubric** | Tabs: Upload (.txt or .csv only, despite copy claiming PDF and Word), **Academic templates** (WAEC English essay 50, Case study 20, STEM derivation 10, Short essay 5), Paste a marking scheme (parsed into criteria). Rubric title, "apply to all essays", and a criteria builder with a running total against the question's marks. **Apply Rubric** sets the question's marks to the rubric total. |

**Redesign notes:**
- **The top bar is overloaded.** Up to 7 buttons in amber, violet and green compete with Save.
  - Keep Save and Publish as the main actions.
  - Group the tools: Import, AI, Rubrics.
  - Move Settings to an icon or tab.
- **Status copy uses developer language** ("CBT microservice", "backend exam room").
- **Deleting a question needs a confirmation or Undo.**
- **Missing features:**
  - Reordering (drag and drop).
  - Duplicate question.
  - A preview of the question as candidates see it.
- **Small fixes:**
  - The type filter hides multiple-answer questions.
  - Explanation should be a textarea.
  - Lots of text is 9–11px; the minimum should be 12px.

---

### Candidate monitor: `/cbt/exams/[id]/monitor`
*Files: `CbtLiveMonitor.tsx`, `CbtEssayGradingModal.tsx`, `CbtAnswerSheetDialog.tsx`, `CbtReportCardPanel.tsx`*

**Purpose:** live invigilation, marking and results for one exam. **Data refreshes every 5 seconds.**

**Layout:**
1. **Header:**
   - Back arrow, the exam title and "Room: {code}".
   - A live pill: "Updated every 5s", "Updating" or "Connection interrupted".
2. **Heading:**
   - "Examination / Invigilation", with the H1 **"Candidate monitor"**.
   - **Download results (CSV)** and **Refresh**.
3. **Metrics:**
   - Active Candidates ("{n} not started").
   - Flagged (Tab Switches).
   - Submissions to review.
   - Completed Submissions.
4. **Report cards panel** (schools only, see below).
5. **Search** ("candidate name or PIN") and **filters**: all, active, Submissions (n), flagged, locked.
6. **Candidate table.** It becomes cards on mobile.

| Column | Content |
|---|---|
| Candidate & PIN | Name; "PIN: 123456" |
| Progress | answered/total, %, bar |
| Time left | Not started / Submitted / "{n}m remaining" |
| Violations | "0 Clean" (shield) or "N Tab Switches"; "Synced late" when a device submitted offline after the deadline |
| Grading status | Registered · Active · Locked · Submitted · **Essays Pending Review** · **Graded: X/Ym** |
| Actions | Registered: "Waiting for candidate". Active: **+5 Mins**, **Force Submit**. Locked: **Forgive & Unlock**. Submitted: **Grade Essays** / **Edit Grade** / **View answers**. |

**Actions in detail:**
- **+5 Mins:** the candidate's device picks the extra time up within about 20 seconds.
- **Force Submit:** asks for confirmation, then submits the answers saved so far.
- **Forgive & Unlock:**
  - Resets the tab-switch count and keeps the candidate's answers.
  - A toast tells the examiner which PIN the candidate rejoins with.

**Essay grading modal:**
- **Prompt** with total marks, plus a **View/Hide model answer** toggle.
- **The candidate's response**, with word and character counts.
- **"Score with ParaLearn AI".** It fills in:
  - A score per criterion.
  - An observation per criterion.
  - An overall comment.
  - Strengths and areas for improvement.
- **Rubric criteria:** a score input for each, from 0 to its maximum in 0.5 steps. Without a rubric there are three defaults, split 50/30/20.
- **Examiner comment:** shown to the candidate on their slip.
- **Approve & Finalize Grade.**
- After saving, the **next ungraded essay opens automatically** ("essay 2 of 3 next").

**Answer sheet dialog** (exams with no essays): each question with its marks pill and the chosen option, marked ✓/✗. Read-only.

**Report cards panel** (schools only):
- **Not linked:** "Count this exam on ParaLearn report cards", with the same class, subject, category and term fields as in the Create dialog. Button **Link to report cards**.
- **Linked:** "Counts as **{Category}** in **{Subject}** for {classes}, {session} {term}." With **Edit link** and **Unlink**. Unlink is only possible before scores are sent; afterwards the fields are locked.
- **Status lines:**
  - Students with finished results.
  - Essays still waiting to be graded (this blocks sending).
  - Candidates still sitting the exam.
  - Candidates not linked to a ParaLearn student.
- **Release:**
  - **"Send scores to report cards"** / **"Send updated scores"**.
  - After sending: "Released {time}: N saved, N skipped", the reasons for any skipped students, and a "Results changed since release" badge when that applies.
  - The panel refreshes every 30 seconds.

**Redesign notes:**
- **The metrics need fixing.**
  - "Submissions to review" double-counts graded attempts.
  - Its filter labels mix case.
- **The report-cards panel pushes the table down.** Make it a tab ("Candidates · Report cards") or a side panel.
- **Missing features:**
  - Bulk actions (extend everyone, force-submit all).
  - A per-candidate violation timeline. The empty state promises an "anti-cheat event stream" that doesn't exist.
- **Style:** time has only minute resolution, and the violation badge uses an emoji.
- **Answer access:** for exams with essays there is no way to see the full answer sheet.

---

### Candidates & PINs: `/cbt/candidates`
*Files: `app/cbt/candidates/page.tsx`, `ImportFromParalearnModal.tsx`*

**Purpose:** each exam's candidate list. From here the examiner can:
- issue PINs;
- share links and WhatsApp passes;
- print hall slips;
- remove candidates;
- for schools, import classes from ParaLearn.

The page works on **one exam at a time**, chosen from a selector. It also responds to two URL parameters:
- `?examId=` preselects an exam.
- `?import=1` opens the ParaLearn import.

**Layout:**
1. **Header:**
   - "← Back to CBT Workspace / Candidates & PINs", with a "{n} Registered" pill.
   - A "{credits} Credits Available" badge.
   - The **exam selector**.
   - **Open Student Lobby ↗**.
2. **Title row:**
   - **"Candidate Access & PIN Dissemination"**.
   - Actions:
     - **Import from ParaLearn** (schools only).
     - **Print Hall Slips**.
     - **Enrol Candidate**.
3. **Explainer:** three tiles.
   - Pre-assigned PIN slips.
   - A one-click link with the PIN pre-filled (`/take/CODE?pin=XXXXXX`).
   - Open self-enrolment.
4. **Metrics:**
   - Total Enrolled.
   - Completed Sessions.
   - Live in Hall.
   - Unused Passes.
5. **Filter bar:**
   - Search by name, PIN or registration number.
   - Status: All, Enrolled, Live, Completed.
   - **Clear Roster** removes only those who haven't started.
6. **Roster table.** It becomes cards on mobile.

| Column | Content |
|---|---|
| Candidate & Reg No | Name; reg no • phone |
| Exam Room | Code chip |
| Access PIN | Large monospace PIN + copy |
| Status | Finished · Testing Now · PIN Ready · Locked |
| Score | "{%}" and "{score}/{total}", or "Writing" / "Not taken yet" (the header says "Score & WAEC" but no grade is shown) |
| Actions | **Copy Link** (with the PIN pre-filled); **WhatsApp** (opens WhatsApp with a ready-written pass: code, PIN and link. Nigerian numbers starting with 0 are converted to 234…); **Remove** (with confirmation) |

**Dialogs:**
- **Enrol New Candidate:**
  - Full Name (required).
  - Phone / WhatsApp.
  - Registration number (optional).
  - The exam.
  - A 6-digit PIN is generated automatically.
  - Toast: "Candidate {name} enrolled with PIN: {pin}".
- **Print Hall Slips:**
  - A dashed cut-out slip per candidate: "ParaLearn CBT Pass", name, registration number, room code, PIN, and a line of instructions.
  - **Print All Slips** prints two per row.
- **Import from ParaLearn** (schools):
  - "Verifying as: {email}", with an access badge (full school, or teacher-scoped).
  - **Import All Classes** or **Select Specific Classes**, with search and a checklist ("{n} students" per class).
  - "Auto-Generate 6-Digit PINs".
  - A summary, "Ready to import {n} candidates".
  - **Import {n} Candidates**.
  - Existing students keep their PINs.

**Redesign notes:**
- **This page has the most clutter in the app:** its own back bar, a pill, a credits badge and the exam selector, all on top of the sidebar.
- **Show the explainer only on the empty state**, or let users collapse it.
- **The exam selector should be the page's primary control.**
- **Missing:**
  - CSV enrolment for exam halls.
  - Bulk WhatsApp.
  - Printing only the filtered list.
- **Rename and restyle:**
  - Rename "Score & WAEC" and stop spinning the clock icon.
  - Remove emoji and marketing tone ("Dissemination", "Magic Link").
  - The Enrol dialog shows a disabled code field next to an exam select. Show one control.

---

### Workspace settings: `/cbt/settings`
*File: `app/cbt/settings/page.tsx`*

- **General:**
  - **Workspace name** (≤120).
  - **Webhook URL**: "We POST each submitted and graded attempt here, signed with your webhook secret. Must be a public https:// address."
  - **Save**.
- **API access:** **API key** and **Webhook secret**. Each has:
  - A masked value.
  - Show/hide and copy.
  - **↻ Rotate**, with a confirmation that the old value stops working immediately.
  - A usage hint: the Bearer header, or how to check the HMAC signature.
- **Missing:**
  - Profile and password.
  - Credits and billing history.
  - A webhook test button and delivery log.
  - School-link status.

---

## 1.5 Problems that cut across pages

These are the main reasons the product feels unfinished today. The redesign should fix them everywhere at once, not page by page.

1. **Three visual styles are mixed.**
   - A flat "workspace" style: dashboard, settings, entrance.
   - A "studio" style built from shadcn components and global tokens: studio, monitor, lobby, exam, slip.
   - A "marketing" style with hard-coded hex, `rounded-2xl`, gradients and emoji: candidates, API docs, import modal.
   - Chapter 2 defines one style.
2. **Confirmations:** six destructive actions use the browser's grey `confirm()` box, deleting a question has no confirmation at all, and only Publish has a styled dialog.
3. **Errors appear four different ways:** toasts, amber notices, red boxes and plain red text.
4. **Text is too small.** Many labels are 9–11px uppercase.
5. **Modal headers are inconsistent:**
   - Some have two close buttons.
   - Some use gradient icon tiles.
   - Stone, slate and violet greys are mixed.
6. **One thing has many names.** The code alone is called "access code", "exam code", "room code", "Exam Room Link" and "Room: X". See the glossary in 2.11.
7. **The copy overclaims:**
   - "KaTeX supported" (there is no preview).
   - "Supports PDF, Word…" for rubric upload.
   - A "WAEC" column.
   - An "anti-cheat event stream".
   - "cloud backup".

   Design copy must describe what the product actually does.

---

# Chapter 2: Design elements

## 2.1 Principles for CBT

CBT inherits the five ParaLearn principles in `PRODUCT.md`: data is the hero; speed is respect; earned trust through precision; density without crowding; one product. On top of those, CBT adds four principles of its own:

1. **The exam room is sacred.** The live exam screen shows only:
   - the question;
   - the answer;
   - the time;
   - whether answers are saved;
   - how to move on.

   No brand flourishes, no colour that isn't a state, no motion that isn't feedback.
2. **Never make a candidate wonder.** Every moment of doubt gets a visible answer:
   - "Is my answer saved?"
   - "How long do I have?"
   - "Did my exam submit?"
   - "What happens if the light goes off?"
3. **Built for Nigerian conditions:**
   - Power cuts.
   - Weak 3G.
   - Old school desktops at 1366×768.
   - Cheap Android phones.
   - Shared computers.
   - Bright rooms.

   Design for these first. Offline states are first-class states, not error states.
4. **One microservice, one family.** CBT must be instantly recognisable as ParaLearn: same violet, same type, same components. It differs only where exam conditions demand it.

---

## 2.2 Colour

### How CBT relates to the ParaLearn palette
CBT uses **the ParaLearn palette as-is** (defined in `src/app/globals.css` `:root` and documented in `DESIGN.md`). It adds:
- **Ink shades** for each signal colour, because the bright signals fail contrast as text (proof below).
- **CBT role tokens**, which name what a colour means in an exam (timer, palette cell, exam status).

**Retire the private `--cbt-*` oklch tokens** in `cbt-workspace.css`. Point them at the shared tokens instead (snippet at the end of this section).

### Brand

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--violet-ink` | `#641bc4` | Primary buttons, links, active nav, focus ring, selected answer, current question | 8.4:1 on white ✅ |
| `--violet-hover` | `#7b22e8` | Hover on violet buttons (follow `DESIGN.md`; the workspace CSS currently darkens to `#5214a3` instead. Pick this one.) | White text 6.5:1 ✅ |
| `--violet-pressed` *(new)* | `#5214a3` | `:active` / pressed state only | White text 10.6:1 ✅ |
| `--violet-tint` | `#f0e5ff` | Selected rows, selected answer card, active nav background, "Welcome" card | Violet text on it 7.0:1 ✅ |
| `--violet-wash` *(new)* | `#f7f3ff` | Row hover, subtle violet surfaces | – |
| `--violet-line` *(new)* | `#dfceef` | Border on violet-tinted surfaces | – |
| `--lavender-muted` | `#ad8ed6` | Disabled violet UI only | Not for text |

**Rule:** violet appears on **at most 10% of any screen** (the One Voice Rule). On the live exam screen it is reserved for **the selected answer, the current question, and the one primary action**.

### Neutrals

| Token | Hex | Use | Contrast on white |
|---|---|---|---|
| `--background` (Chalk White) | `#fdfdff` | Page background | – |
| `--card` | `#ffffff` | Cards, dialogs, question area, inputs | – |
| `--surface-subtle` | `#f8fafc` | Table header, sidebar, quiet panels | – |
| `--surface-muted` | `#f1f5f9` | Neutral badge background, disabled inputs, ghost hover | – |
| `--border-fine` | `#e2e8f0` | Every divider and card edge | – |
| `--border-medium` | `#cbd5e1` | Input borders, unanswered palette cells (needs to be visible) | – |
| `--text-strong` *(new)* | `#334155` | Secondary headings, strong captions, "Closed" status | 10.4:1 ✅ |
| `--text-secondary` | `#64748b` | Helper text, captions, meta | 4.76:1 ✅ on white, but **4.34:1 ❌ on `#f1f5f9`**. Use `--text-strong` on muted surfaces. |
| `--text-placeholder` *(new)* | `#94a3b8` | Placeholders and disabled text only | 2.56:1 ❌, never for real content |
| `--foreground` (Midnight Slate) | `#0f172a` | Body text, headings, question text | 17.6:1 ✅ |

### Signals (status colours)
Each signal has four shades. **The vivid shade fails as text** for Emerald and Amber, so text and icons on white use the **ink** shade.

| Signal | Vivid (dots, bars, fills) | Tint (background) | Ink (text and icons) | Line (border) | Meaning |
|---|---|---|---|---|---|
| **Emerald** | `#10b981` (2.5:1 ❌ as text) | `#dff9d8` | `#065f46` on tint (6.8:1) · `#047857` on white (5.5:1) | `#a7f3d0` | Open, saved, answered, correct, graded, passed, online |
| **Amber** | `#f28c1f` (2.5:1 ❌ as text) | `#ffe9cc` | `#92400e` on tint (6.0:1) · `#b45309` on white (5.0:1) | `#fde68a` | Needs attention: pending review, flagged, <5 min left, offline, warnings |
| **Crimson** | `#e60023` (4.8:1 ✅) | `#fddada` | `#991b1b` on tint (6.4:1) · `#b91c1c` on white (6.5:1) | `#fecaca` | Error, locked, disqualified, wrong, <1 min left, destructive |
| **Cobalt** | `#2a64f6` (4.9:1 ✅) | `#dbe9ff` | `#1e40af` on tint (7.1:1) | `#bfdbfe` | Information only: scheduled, "synced late", help callouts |

**Rules:**
- **Signal purity:** a signal colour always means its state. Never use it for decoration or to tell question types apart.
- **Colour is never alone:** every status pairs its colour with an icon and a word.
- **Green buttons:** use `#047857` (white text 5.5:1). **Never `#10b981` with white text** (2.5:1). Today's "Confirm Final Submission" and "Approve & Finalize Grade" buttons need this fix.

### CBT role tokens (what each state looks like)

**Exam status** (dashboard, studio, publish):

| Status | Background | Text/icon | Icon (lucide) | Change from today |
|---|---|---|---|---|
| Draft | `--surface-muted` | `--text-secondary` | `FileText` | – |
| Ready to publish | `--violet-tint` | `--violet-ink` | `CircleCheck` | – |
| **Scheduled** | cobalt tint | cobalt ink | `CalendarClock` | Was amber. Scheduled is information, not a warning. |
| **Open** | emerald tint | emerald ink | `Radio` | – |
| **Closed** | `--surface-muted` | `--text-strong` | `Lock` | Was identical to Draft |

**Attempt and candidate status** (monitor, candidates):

| Status | Colours | Icon |
|---|---|---|
| Registered / PIN ready | neutral | `KeyRound` |
| Active / Testing now | violet tint + ink | `Activity` (static, **not spinning**) |
| Submitted | neutral (strong text) | `Send` |
| Essays pending review | amber | `Clock` |
| Graded / Finished | emerald | `CircleCheck` |
| Locked | crimson | `Lock` |
| Disqualified | crimson | `ShieldX` |
| Synced late | cobalt | `CloudUpload` |

**Question palette cells** (live exam):

| Cell state | Look |
|---|---|
| Not visited / unanswered | White, 1px `--border-medium`, `--foreground` number |
| Answered | Emerald tint, `#065f46` number, `#a7f3d0` border |
| Current | 2px `--violet-ink` ring (outside the border), bold number |
| Flagged | 8px amber dot top-right **plus** a tiny flag icon, so it isn't colour alone. Make the legend match (today the legend shows a filled square). |
| Answered + flagged | Answered style + flag marker |

**Timer:**

| Time left | Look | Extra |
|---|---|---|
| ≥ 5 min | Neutral pill, `--foreground` digits | – |
| < 5 min | Amber tint, `#92400e` digits, amber line border | One-time banner/toast "5 minutes left", announced to screen readers |
| < 1 min | Crimson tint, `#991b1b` digits | Toast "1 minute left. Your exam submits automatically." Pulse only when `prefers-reduced-motion` is off. |

**Save indicator:** saved = emerald dot + "All answers saved"; saving = neutral spinner + "Saving…" (saving isn't a warning, so not amber); offline = amber `WifiOff` + "Offline: answers saved on this device".

**Question types** are identified by **icon + label in neutral chips**, not colours. Today short essays are amber and long essays blue, which breaks signal purity.

| Type | Icon | Label |
|---|---|---|
| Multiple choice | `CircleDot` | Multiple choice |
| True / False | `ToggleLeft` | True / False |
| Multiple answers | `ListChecks` | Multiple answers |
| Short essay | `AlignLeft` | Short answer |
| Long essay | `FileText` | Essay |

**AI features:** violet `Sparkles` icon + the words "ParaLearn AI". **No gradients** on AI buttons or headers inside the product. The gradient tiles in the AI, grading and import modals should go.

**Code/API method badges** (API docs only): GET emerald ink, POST cobalt ink, PATCH amber ink, DELETE crimson ink, each on its tint.

### Charts (future: results analytics)
There are no charts today. When score distributions or item analysis are added, use one sequential violet ramp for magnitude (`#f0e5ff → #ad8ed6 → #641bc4 → #3d0f7a`). Use the signal colours only for pass/fail meaning.

### Dark mode
**Not in scope for v1.** Exam rooms and staffrooms are bright, and `PRODUCT.md` targets light mode. Keep every colour as a token so dark mode can be added later by swapping values. Never hard-code hex in components.

### Token snippet for `cbt-workspace.css`
Replace the private oklch values so CBT reads from the shared palette:

```css
.cbt-surface, .cbt-dialog {
  /* old names kept as aliases so existing classes keep working */
  --cbt-ink: var(--foreground);        /* #0f172a */
  --cbt-muted: var(--text-secondary);  /* #64748b */
  --cbt-line: var(--border-fine);      /* #e2e8f0 */
  --cbt-paper: var(--background);      /* #fdfdff */
  --cbt-wash: var(--surface-subtle);   /* #f8fafc */
  --cbt-accent: var(--violet-ink);     /* #641bc4 */

  /* new CBT tokens */
  --violet-pressed: #5214a3;
  --violet-wash: #f7f3ff;
  --violet-line: #dfceef;
  --text-strong: #334155;
  --text-placeholder: #94a3b8;
  --emerald-ink: #065f46;  --emerald-ink-on-white: #047857; --emerald-line: #a7f3d0;
  --amber-ink: #92400e;    --amber-ink-on-white: #b45309;   --amber-line: #fde68a;
  --crimson-ink: #991b1b;  --crimson-ink-on-white: #b91c1c; --crimson-line: #fecaca;
  --cobalt-ink: #1e40af;   --cobalt-line: #bfdbfe;
}
```

---

## 2.3 Typography

| Role | Font | Size / weight / line-height | Where |
|---|---|---|---|
| Display | Manrope | 28–36px (`clamp`) / 800 / 1.1, −0.03em | One per page: "Examinations", exam title in the lobby |
| Headline | Manrope | 18px / 700 / 1.3 | Section and dialog titles |
| Title | Manrope | 15px / 600 / 1.4 | Card titles, nav items, table headers |
| Body | Manrope | 14px / 400 / 1.6 | Everything else in the workspace |
| Label | Manrope | 12px / 500 / 1.4 | Input labels, badges, captions |
| **Question text** *(CBT)* | Manrope | **18px / 500 / 1.6** (16px on phones) | Live exam question. Readability beats density here. |
| **Answer option** *(CBT)* | Manrope | **16px / 400 / 1.5** | Option cards |
| **Essay input** *(CBT)* | Manrope | 16px / 400 / 1.7 | Textareas (16px also stops iOS zooming in) |
| Mono | Geist Mono | 13px / 400, `tabular-nums` | Exam codes, PINs, participant IDs, scores, timer, counts |
| **Timer** *(CBT)* | Geist Mono | 20px / 600, `tabular-nums` | Live exam header |
| **PIN boxes** *(CBT)* | Geist Mono | 22px / 700 | Lobby PIN input |

**Rules:**
- **The minimum size is 12px, anywhere.** The many 9–11px uppercase labels in the studio, modals and monitor move up to 12px at sentence case.
- **Uppercase sparingly:** only short eyebrows and micro-labels, with +0.04em tracking.
- **Weight jumps of at least 200** between neighbouring levels (Weight Contrast Rule).
- **Numbers in tables, metrics and the timer always use `tabular-nums`.**
- **Outfit** is allowed only in the landing-page hero. Inter is not used.
- **Load Geist Mono properly.** `src/app/layout.tsx` creates `geistMono` but never adds `geistMono.variable` to `<body>`, so `font-mono` currently falls back to the system monospace. Add it to the body, or to the CBT surfaces.

---

## 2.4 Spacing, layout and breakpoints

**Spacing scale (4px base):** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Use 8 and 16 most; 24 and 32 for section gaps; 48 and 64 only on the landing page.

**Page layouts:**

| Surface | Layout |
|---|---|
| Workspace pages | Sidebar 240px (make the current 232px match `DESIGN.md`). Content max-width 1280–1500px with 32–40px side padding (16px on mobile). |
| Settings and forms | Single column, max 760px |
| Lobby | Single column, max 560px, centred |
| Live exam | Header (64px) + question column (max ~760px of text width) + palette (320px) on ≥1024px; palette becomes a drawer below |
| Result slip | Single card, max 600px, centred |
| Landing page | 12-column grid, max 1200px, 24px gutters |

**Breakpoints:** use Tailwind's defaults and nothing custom. The lobby's `xs:` class doesn't exist and silently does nothing.

| Name | Width | What changes |
|---|---|---|
| base | <640 | Phones: one column, full-width buttons, tables become cards |
| `sm` | 640 | Two-column form rows |
| `md` | 768 | Studio question list appears; monitor table replaces cards |
| `lg` | 1024 | Sidebar fixed; exam palette becomes a column |
| `xl` | 1280 | Wider tables, extra columns (availability, schedule) |

**Test sizes:**
- 360×640 (budget Android).
- 768×1024 (tablet).
- **1366×768** (the most common school desktop).
- 1920×1080.

**Touch targets:** at least 44×44px everywhere a candidate taps, including palette cells, option cards, PIN boxes and the flag button.

---

## 2.5 Radius, borders and elevation

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4px | Inline code chips, kbd hints |
| `--radius-md` | 8px | **Buttons, inputs, selects, option cards, palette cells, PIN boxes** |
| `--radius-lg` | 12px | Cards, dialogs, the question area, result slip |
| `--radius-xl` | 16px | Sheets and drawers |
| `--radius-pill` | 9999px | **Status badges only** |

- **Retire 6px.** It is used across `cbt-workspace.css` today; move it to 8px.
- **Retire `rounded-2xl` in product UI.** It is used 14 times today. Pill shapes are for status badges only (the code uses 4px today; move to pill).

**Borders:** 1px `--border-fine` for dividers and cards. 1px `--border-medium` for inputs and anything a user must find, such as unanswered palette cells.

**Elevation** (from `DESIGN.md`):

| Level | Shadow | Use |
|---|---|---|
| 0 | none | Pages, tables, sidebar |
| 1 | `--shadow-card` | Resting cards: question area, result slip, lobby card |
| 2 | `--shadow-hover` | Hover on clickable cards |
| Overlay | `--shadow-dialog` | Dialogs, sheets, drawers, dropdowns |

**No glassmorphism or `backdrop-blur` inside the product.** The exam palette drawer currently blurs its backdrop. Use a plain `rgba(15,23,42,0.4)` overlay.

---

## 2.6 Motion

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 80ms | Button press (`scale(0.97)`) |
| `--dur-quick` | 120ms | Hover colour changes |
| `--dur-smooth` | 150ms | Card lift, tab underline |
| `--dur-enter` | 220ms | Dialogs, drawers, toasts |
| easing | `--ease-out-expo` | Entering; `--ease-standard` for state changes |

**Rules:**
- **Animate only `transform` and `opacity`.**
- **Honour `prefers-reduced-motion`.** That covers the timer pulse, spinners on status badges, and the AI "pulsing sparkles".
- **No spinning icons as status.** The "Testing Now" clock spins today; use a static icon.
- **On the live exam, motion is feedback only:** answer selected, saved tick, warning arrived. Nothing decorative.

---

## 2.7 Icons

- **Library:** `lucide-react` only.
- **Sizes:**
  - 16px inline with text.
  - 18px in navigation and buttons.
  - 20px in headers.
  - 40px for empty states and result icons.
- **Stroke:** default (2).
- **Emoji:** none in product UI (today: ⚠️ in the monitor, 👑 📚 ✨ in the import modal, ✨ on buttons).
- **One concept, one icon,** everywhere:

| Concept | Icon | Concept | Icon |
|---|---|---|---|
| Examinations | `BookOpen` | Candidates | `Users` |
| Exam code / PIN | `KeyRound` | Monitor | `MonitorCheck` |
| Settings | `Settings` (not `Code2`) | Developer API | `Code2` |
| ParaLearn AI | `Sparkles` (AI only) | Rubric | `Award` |
| Report cards | `BookOpenCheck` | Import | `Upload` |
| Export / download | `Download` | Print | `Printer` |
| Flag for review | `Flag` | Time / duration | `Clock` |
| Timer | `Timer` | Offline | `WifiOff` |
| Saved | `CloudCheck` / `CircleCheck` | Locked | `Lock` |
| WhatsApp | text label + `MessageCircle` | External link | `ArrowUpRight` (only when it really opens a new tab) |

---

## 2.8 Components

Build all of these on the shared `@/components/ui` (shadcn) components, styled with the tokens above. **Stop using the browser's native `confirm()`.**

### Buttons

| Variant | Look | Use |
|---|---|---|
| **Primary** | Violet ink fill, white text, 8px radius, 40px tall (48px for candidate CTAs), 600 weight | One per view: Create exam, Save, Start Examination, Next Question |
| **Secondary** | White, 1px `--border-medium`, `--foreground` text | Everything else |
| **Ghost** | No border; hover `--surface-muted` | Toolbars, row actions |
| **Success** | `#047857` fill, white text | **Only** final irreversible "good" actions: Confirm Final Submission, Approve grade, Send scores to report cards |
| **Destructive** | `#b91c1c` fill (or crimson outline for the secondary form) | Delete exam, Force submit, Remove candidate, all inside a confirmation dialog |
| **Icon button** | 36×36 visual, 44×44 hit area, ghost, always with `aria-label` and a tooltip | Copy, refresh, more (⋯) |

States:
- **Hover:** `--violet-hover`.
- **Active:** `scale(0.97)` + `--violet-pressed`.
- **Focus:** 2px violet ring, 2px offset.
- **Disabled:** 40% opacity, `not-allowed` cursor.
- **Loading:** spinner + verb ("Saving…"), with the same width as the idle button.

**Today:** amber "Rubrics", violet-gradient "ParaLearn AI" and green-outline "Live Monitor" in the studio all compete. Make them secondary or ghost buttons.

### Inputs and forms
- **Labels:** always above the field (12px, 500). Never placeholder-only.
- **Field:** white background, 1px `--border-medium`, 8px radius, 40px tall (44px on candidate pages).
- **Focus:** violet border + ring.
- **Errors:** **inline under the field** (crimson ink + icon), not only as a toast. Today almost every validation message is a toast.
- **Checkboxes and radios:**
  - Native controls sized 16–18px, with `accent-color: #641bc4`.
  - Radio cards: 8px radius, border-medium; selected = violet border + violet-wash fill.
  - Set these once in the form CSS. Inline style overrides like those in `CbtSchoolExamSection` should not be needed.
- **Code fields** (exam code, PIN, participant ID): monospace, upper-case as you type, paste-friendly, with the expected format shown ("e.g. BUSI-7642").

### PIN input (lobby)
- Six 48×52px boxes (40×48 on small phones), 8px radius, Geist Mono 22px/700.
- Auto-advance, backspace-back and paste-to-fill.
- Each box has `aria-label="PIN character n of 6"` inside a labelled `role="group"`.
- **States:**
  - **Checking:** neutral spinner line.
  - **Found:** the violet Welcome card with **Not you?**.
  - **Not found:** crimson ink line under the boxes, and the boxes get a crimson border.
- Walk-in participant IDs (7 characters, letters and digits) use one wide monospace field, not boxes.

### Status badge
- Pill, 12px/500, 2px 10px padding.
- Icon (14px) + word.
- Tint background + ink text.
- One component used everywhere, driven by the role tokens in 2.2.

### Tables
- **Header:** `--surface-subtle`, 12px/600, sentence case.
- **Rows:** at least 52px tall, divided by `--border-fine`; hover `--violet-wash`.
- **Numbers:** right-aligned, tabular.
- **Actions column:** **one visible primary action per row** plus a `⋯` menu for the rest.
- **Below 768px:** each row becomes a card. Name and status on top; key numbers in a row; actions full-width at the bottom.

### Metric strip
- A row of figures separated by thin dividers (the current `cbt-summary` style is good; keep it).
- Label 12px secondary, value 26px/700 tabular, caption 12px.
- Each metric must count something distinct (fix the monitor's overlapping "to review").

### Tabs and filters
- Underline tabs (the current `cbt-tabs`) with a count chip.
- Sentence case labels ("Active", not "active").
- Filters that change the list show a "Clear filters" link.

### Dialogs and sheets
- **Sizes:** 480px standard, 640px forms, 880px for the AI and grading workspaces.
- **Header:** title (18/700) + one-line description + **one** close button. No gradient tiles.
- **Footer:** Cancel on the left, the primary action on the right, sticky when the body scrolls.
- **Confirmation dialog:** for Delete exam, Force submit, Remove candidate, Clear roster, Rotate key, Unlink and Finish (result slip). It has:
  - A title that names the action and object ("Remove Serah Jenkins?").
  - One sentence on the consequence.
  - Cancel, plus a destructive or primary button that repeats the verb.
- **Deleting a question uses Undo instead:** a toast with **Undo** for 6 seconds, so the studio stays fast.

### Notices and banners
- **One component in four signal flavours.** It holds an icon, text, an optional action link, and an optional dismiss.
- **Inline notices** describe page state (offline, setup problems, availability).
- **Toasts** confirm an action that just happened.
- **Never put information the user must keep in a toast.** Today the participant ID, the PIN to rejoin, and the extra-time notice all live only in toasts.

### Toasts (sonner)
- **Position:** bottom-centre on candidate pages (top-right covers the timer and Submit on phones); top-right on the workspace.
- **Duration:** 4 seconds. 8 seconds for anything with an action.
- **Tone:** past tense, plain: "Exam published." Not "Successfully published!"

### Empty, loading and error states
- **Every list has all three.**
- **Empty:** 40px icon, title (16/600), one line of help, one action.
- **Loading:**
  - **Skeletons shaped like the content.** Today the lobby, slip and studio show bare text such as "Loading exam room…".
  - Spinners only inside buttons.
- **Error:**
  - Say what happened and what to do.
  - Offer Retry.
  - Keep cached data visible with a "may be out of date" notice (the dashboard already does this well).

### Navigation shell
- **Sidebar:** 240px, `--surface-subtle`.
- **Active item:** violet tint + violet ink + a 3px left bar (the one place a left stripe is allowed).
- **Correct active detection:** Settings highlights Settings. The studio and monitor highlight Examinations.
- **Account menu** (a dropdown on the avatar) with:
  - Profile.
  - Switch workspace.
  - Billing.
  - Sign out.
- **Credits:** shown only for exam halls, with **Buy credits**.
- **Inside the shell, pages use a breadcrumb** ("Examinations / Mathematics mock / Monitor"), not their own back bars.

---

## 2.9 Exam-room components

These are specific to the candidate journey. Each must work at 360px wide and at 1366×768, on a slow device, with no network.

### Step indicator
- **One component for the whole journey:** 1 Exam code → 2 Your details → 3 Examination → 4 Result.
- **The same look on every candidate page.** Today the entrance uses circles, the lobby uses plain text, and the exam and slip have none.

### Exam header (live)
| Left | Centre | Right |
|---|---|---|
| Exam title (truncate) · candidate name + PIN (small) | **Timer** (always visible, never hidden on mobile) | Save indicator · **Submit** (secondary style; the primary violet button is Next) · palette toggle (<1024px) |

### Option card
- At least 56px tall, full width, 8px radius, 1px `--border-medium`.
- A letter badge on the left: round for single-answer, square for multiple answers.
- A keyboard hint on the right (desktop only).
- **Selected:** violet tint fill, 2px violet border, the badge filled violet with white letter, and a check icon. That way selection shows by more than colour.
- **Focus:** violet ring.
- **Hover:** `--violet-wash`.

### Question palette
- **Header:** "Questions", with counts (Answered · Unanswered · Flagged).
- **Grid of 44×44 cells**, styled as in 2.2.
- **Optional filter:** All / Unanswered / Flagged. This helps the final review.
- **Desktop:** sticky.
- **Below 1024px:** a drawer with a focus trap, Escape to close, and an aria-labelled close button.

### Essay editor
- A large textarea (16px).
- **A word count with the guideline:** "84 / 20–100 words". Neutral inside the range, amber under the minimum, crimson over the maximum, and always with text, never colour alone.
- **One save line:** "Saved on this device · sent to server", or "Saved on this device · will send when online".

### Timer warnings
- **At 5 minutes and at 1 minute:** an inline banner under the header plus an `aria-live="polite"` announcement.
- **When time runs out:** a full-screen "Time is up. Submitting your exam…" overlay, then the normal submission flow.

### Malpractice warning
- **Instead of a toast,** a modal the candidate must dismiss: "You left the exam window. This is warning 1 of 3. At 3, your exam submits automatically." It has a single **Return to exam** button.
- **This is deliberately serious.** It is the one place crimson is used prominently.

### Submission overlay
The three states, as in 1.3: **Sending**, **Saved here, waiting to send**, **Not accepted**. Keep them full-screen and blocking. Each state needs:
- An icon.
- A plain title.
- What the candidate should do next.
- One button.

### Result slip
A document-like card, printable on A4. It shows:
- Logo + "ParaLearn CBT".
- The exam title and the institution or exam-hall name.
- Candidate details.
- The result box (four states).
- Feedback.
- Reference + verification QR (or no QR).
- The date issued.

---

## 2.10 Print

Three things get printed. Each needs a real `@media print` stylesheet: A4, 12mm margins, black text, no shadows or tints (use borders instead), no buttons.

| Printout | Layout |
|---|---|
| **Hall slips** (candidates page) | 2 × 4 slips per A4 sheet with dashed cut lines. Each slip shows: "ParaLearn CBT Pass", exam title, exam code, candidate name, registration number, **PIN in large monospace**, and "Go to cbt.pln.ng/take, enter code {CODE} and your PIN." A QR code of the pre-filled link is a strong next step. |
| **Result slip** | One A4 page, as in 2.9 |
| **Answer sheet** (monitor, future) | Question, the candidate's answer, the correct answer, marks. One candidate per page. |

---

## 2.11 Words and voice

**Voice:** direct, calm, precise (from `PRODUCT.md`).
- No exclamation marks, no emoji, no hype.
- Write for a nervous 15-year-old on the candidate side, and a busy teacher on the examiner side.
- Use British/Nigerian spelling: **enrol, enrolment, colour, centre, organise**.

**Glossary: use one word per thing:**

| Use | Not | Meaning |
|---|---|---|
| **exam code** | access code, room code, exam room link, "Room: X" | The code candidates type to find an exam (e.g. `BUSI-7642`) |
| **PIN** | access PIN, candidate number, pass | The 6-digit code an examiner issues to a registered candidate |
| **participant ID** | PIN (for walk-ins) | The ID a walk-in candidate gets for rejoining |
| **candidate** | student (in examiner UI), participant, taker | Anyone sitting an exam |
| **examiner** | invigilator (except for the monitor's actions), teacher | Anyone running exams |
| **exam** | examination room, assessment, test (mixed) | Use "exam" in UI; "examination" only in formal titles like the result slip |
| **exam hall** | standalone hall, tutor hall | A self-serve examiner workspace |
| **school workspace** | institution | A ParaLearn school's workspace |
| **candidate page** / **exam entrance** | student portal, student lobby, candidate portal, candidate entrance | `/take` |
| **lobby** | – | `/take/[code]` |
| **send scores to report cards** | sync, release, push | The school score hand-off |
| **ParaLearn AI** | AI engine, "1-click AI" | The AI features |

**Never show:**
- "microservice", "backend", "sync with CBT service", "API" (outside the developer pages).
- "Magic Link", "Dissemination", "blast".
- "Successfully…!"
- Feature claims the product doesn't support.

**Button labels:** verb + object ("Publish exam", "Send scores to report cards"), sentence case, under 4 words where possible.

**Times and dates:** "Mon 3 Nov, 08:00" (24-hour, day before month). Durations: "60 min". Countdown: "12:04" (and "1:12:04" for an hour or more).

---

## 2.12 Accessibility checklist

Target: **WCAG 2.1 AA** (`PRODUCT.md`). For CBT specifically:

- [ ] All text passes 4.5:1, or 3:1 at ≥18px (or ≥14px bold). Use the ink shades from 2.2.
- [ ] Status never relies on colour alone: icon + word for every badge, palette cell and timer state.
- [ ] Every input has a visible label; the PIN boxes have per-box labels.
- [ ] Every icon-only button has an `aria-label` and a tooltip.
- [ ] Focus is always visible (2px violet ring).
- [ ] Dialogs and drawers trap focus, close on Escape, and return focus to the trigger.
- [ ] The timer's 5-minute and 1-minute warnings are announced (`aria-live`); the countdown itself is not announced every second.
- [ ] Answer options are a proper `radiogroup` / `group` of checkboxes with arrow-key support (already mostly in place; keep it).
- [ ] Palette cells say "Question 4, answered, flagged" and mark the current one with `aria-current`.
- [ ] Keyboard shortcuts are listed in a "Keyboard shortcuts" help popover and never fire while typing.
- [ ] Touch targets are at least 44×44px.
- [ ] `prefers-reduced-motion` turns off pulsing, spinning and slide animations.
- [ ] Pages work at 200% zoom and at 360px wide without horizontal scrolling.
- [ ] Language is plain (aim for a reading age of 12 on candidate pages).

---

## 2.13 Where the code drifts today

A quick reference for whoever implements the redesign. Each line is a concrete thing to change.

| Area | Today | Should be |
|---|---|---|
| Neutral tokens | Private oklch `--cbt-*` values in `cbt-workspace.css` | Aliases to shared tokens (snippet in 2.2) |
| Violet hover | `#5214a3` (darker) in workspace CSS; `#7b22e8` (lighter) in globals | `#7b22e8` hover, `#5214a3` pressed |
| Hard-coded hex | 23 distinct hex values in CBT components (`#92400e`, `#065f46`, `#991b1b`, `#a7f3d0`, `#1e40af`…) | Tokens only |
| Raw Tailwind colours | `slate-*`, `stone-*`, `violet-*`, `amber-*`, `blue-*`, `rose-*`, `indigo-*` mixed | Tokens; slate only where a token maps to it |
| Gradients | `from-violet-600 to-indigo-600` on AI buttons, modal headers, import | None in product UI (landing page only) |
| Radius | 4, 6, 8, 12, 16px, plus `rounded-2xl` (×14) | 8 controls / 12 containers / 16 sheets / pill badges |
| Badge shape | 4px rectangles (`.cbt-status`) | Pill |
| Status colours | Scheduled = amber; Draft = Closed | Scheduled = cobalt; Closed has its own style |
| Question type colours | Short = amber, Long = blue | Neutral chips with icons |
| Green buttons | `#10b981`-family fills with white text (2.5:1) | `#047857` |
| Font sizes | Many 9–11px labels | Minimum 12px |
| Mono font | `geistMono.variable` not applied to `<body>` | Apply it so `font-mono` uses Geist Mono |
| Confirmations | Native `confirm()` ×6; none for question delete | Styled confirmation dialog; Undo for question delete |
| Errors | Mostly toasts | Inline field errors + notices; toasts only for confirmations |
| Emoji | ⚠️ 👑 📚 ✨ in UI | Lucide icons |
| Blur | `backdrop-blur` on the exam drawer overlay | Plain overlay |
| Toast position | Top-right on candidate pages | Bottom-centre on candidate pages |
| Dead code | `CbtWorkspaceHeader.tsx` unused; dead `BUSI-7642` branch in the lobby; unused icon imports | Remove |

---

# Chapter 3: The landing page

### Brief

Build a public landing page for **cbt.pln.ng**, shown at `/` to signed-out visitors. Signed-in examiners still go straight to their dashboard. Its jobs, in order:

1. **Let a candidate start their exam in under 5 seconds.** Most visitors to cbt.pln.ng are candidates holding an exam code. The exam-code box must be in the first screen on every device, above any marketing.
2. **Convince a school or tutorial centre to start using CBT,** and show existing ParaLearn schools that it is already included.
3. **Point developers to the API.**

> ### 🔎 Research first
> Before designing, **search online for the best CBT and online-exam landing pages** and study how they structure the page, explain trust and security, show the product, and handle pricing. Good starting points:
> - **International online-exam and assessment platforms:** e.g. ClassMarker, Testmoz, TestGorilla, Mercer | Mettl, ExamSoft, Quizizz.
> - **Nigerian exam-prep and school platforms:** JAMB/WAEC CBT practice sites, school-management products used locally.
> - Galleries such as Land-book, Lapa Ninja, Godly or SaaS Landing Page, searching "assessment", "exam", "edtech".
>
> Collect 5–10 references and note what each does well: hero clarity, how it shows security, how it explains pricing. Then **adapt the patterns to ParaLearn's own design system** (Chapter 2) and Nigerian context. **Do not copy any page's layout, copy, illustrations or branding.** We want to look like ParaLearn, not like them.

### Design rules for the landing page

The landing page is the **one place** where `DESIGN.md` allows extra expression:
- The `--grad-primary` gradient (`#641bc4 → #9747ff`) as an **ambient background**, e.g. behind the hero or the final CTA. Never on text or buttons.
- **Outfit** for the hero headline only. Manrope everywhere else.
- Larger type (hero 48–64px desktop, 36–40px mobile) and more white space (64–96px between sections).
- **Real product screenshots** (dashboard, live exam, monitor, result slip). Prefer them over abstract illustrations: they build more trust with school owners. Screenshots must show the redesigned UI, with realistic Nigerian names and subjects.

**Everything else still applies:**
- The violet budget.
- Semantic colours only for meaning.
- 8px button radius.
- No emoji.
- AA contrast.
- Fast on 3G: aim for under 1 MB total, WebP/AVIF images with width/height set, no autoplay video, no heavy animation libraries.

**Technical requirements:**
- **Server-render the page**, so there is no skeleton flash.
- The SEO entry already exists in `src/lib/seo/siteConfig.ts` (`cbt` site): "ParaLearn CBT is an offline-resilient, high-concurrency Computer-Based Testing platform for schools, JAMB mock exams, WAEC preparation, and tutorial centres…". Reuse it for the meta description.

### Sections

Each section below lists its purpose and contents. Exact layout is the designer's call, informed by the research.

#### 1. Header (sticky)
- **Left:** logo + "CBT".
- **Centre:** links to For schools · For tutorial centres · Features · Pricing · Developers.
- **Right:** **Examiner sign in** (secondary) and **Create free exam hall** (primary).
- **Mobile:** logo, "Sign in" and a menu.
- A translucent background on scroll is allowed here (navigation only).

#### 2. Hero, with the exam-code box
- **Two jobs side by side.** On mobile they stack, with the code box first.
  - **For candidates:** "Have an exam code?" → the code field + **Start exam** (the same behaviour as `/take`, going to `/take/{CODE}`), plus a hint "e.g. BUSI-7642 · No account needed".
  - **For examiners:** headline, subline, CTAs.
- **Headline direction** (to be refined): make it about the outcome, not technology. For example:
  - "Run computer-based exams that don't break when the light does."
  - "From question paper to report card, without the marking weekend."
- **Subline:** one sentence on who it's for: schools, tutorial centres, JAMB/WAEC prep, recruiters.
- **CTAs:** **Create a free exam hall** (primary) and **I'm a ParaLearn school → Sign in** (secondary).
- **Visual:** a real screenshot of the live exam or the monitor, framed in a laptop or phone mockup.

#### 3. Trust strip
- Short proof points in one line. Use only claims that are true when the page ships:
  - Works offline: answers saved on the device.
  - Built in Nigeria for Nigerian schools.
  - Results sent straight to ParaLearn report cards.
  - No student accounts needed.
- **Add school logos or usage numbers only when they are real and permitted.**

#### 4. The problem we are solving
This section is the heart of the page. Make it **concrete and local**: a teacher or tutorial-centre owner should recognise their own week. Present it as 4–6 short problem statements (a sentence or two each), or a "Before / After" comparison. Pair each with how ParaLearn CBT answers it.

| The problem today | How ParaLearn CBT answers it |
|---|---|
| **Paper exams cost a fortune and a weekend.** Printing, invigilating and hand-marking hundreds of scripts, then copying scores into a register and a spreadsheet, takes days for every test. Mistakes creep in at every copy. | Objective questions are marked the moment a candidate submits. Essays are marked on screen with ParaLearn AI suggesting scores against a rubric. Results export as CSV or go straight to report cards. |
| **Report cards mean re-typing everything.** Even schools that run computer tests end up copying scores by hand into the report-card system, because the two don't talk to each other. | For ParaLearn schools, an exam is linked to the class, subject, category and term **when it is created**. One click on **Send scores to report cards** puts the scores in the right column. |
| **Candidates must be ready for CBT.** JAMB UTME and more and more WAEC/NECO and university exams are computer-based, yet many students first meet a CBT screen on exam day. | A timed, shuffled, monitored exam that feels like the real thing, so mock exams become genuine CBT practice. |
| **Power and network fail mid-exam.** Generators go off, data runs out, and on most online test tools a dropped connection loses answers, so examiners distrust them. | Answers are saved on the candidate's device first and sent when the connection returns. The timer survives reloads, and a submission made offline is delivered automatically. |
| **Malpractice is hard to control.** Question leaks, copying from neighbours and searching answers in another tab undermine results. | Questions and options are shuffled per candidate. Tab switches are detected, and after the examiner's limit the exam submits and locks. Examiners can watch every candidate live, add time, force-submit or unlock. |
| **Tutorial centres can't use school software.** Full school-management systems need sessions, classes and teacher set-up before a single test can run. A JAMB lesson teacher just wants to test 40 walk-in candidates tomorrow. | A free exam hall is created in under a minute. Candidates join with a code or a PIN, with no accounts. PIN slips print ready to cut out, and passes can be sent on WhatsApp. |
| **Writing good questions takes hours.** | ParaLearn AI turns lecture notes, PDFs or even audio and video into a balanced set of questions, with answers, explanations and rubrics, for the examiner to review. |

Add a short closing line under the table that ties it together: *one place to set, sit, mark and record exams*.

#### 5. How it works
Two tracks, three steps each, side by side or as tabs:
- **Examiners:**
  1. Create an exam: write, import from Excel, or generate with ParaLearn AI.
  2. Share the code or print PIN slips.
  3. Watch live, mark essays, publish results.
- **Candidates:**
  1. Enter the exam code.
  2. Enter your name or PIN.
  3. Sit the exam and get your result slip.

#### 6. Feature showcase
Alternate screenshot and text blocks (avoid a grid of identical icon cards, which `DESIGN.md` bans). Suggested order:
1. **Question studio + ParaLearn AI.** Five question types, Excel import, rubrics, AI generation from notes or media.
2. **The live exam.** Clean, keyboard-friendly, shows the timer and save status, works offline.
3. **Live monitor.** Progress, tab-switch flags, +5 min, force-submit, unlock.
4. **Marking and results.** AI-assisted essay grading, result slips, CSV export, WAEC-style grades.
5. **Report cards** (ParaLearn schools). Classes import with PINs; scores land on report cards.

#### 7. Built for Nigerian conditions
A dedicated band. This is our strongest difference. Cover:
- **Offline resilience.** Explain it with a simple diagram: answer saved on the device → sent to the server when online.
- **Works on phones and old lab computers.**
- **WhatsApp passes.**
- **Printed PIN slips.**
- **WAEC grading scale.**
- **Local time and dates.**

#### 8. Who it's for
Three audiences, each with a one-paragraph pitch and its own CTA:
- **Schools on ParaLearn:** "Already included. Sign in with your ParaLearn account."
- **Tutorial centres and independent examiners:** "Create a free exam hall."
- **Developers and organisations:** "Run exams inside your own app: Developer API, webhooks, signed results."

#### 9. Security and integrity
A short, factual list. **Do not overclaim.** No webcam proctoring exists today, so don't imply it.
- Shuffled questions and options.
- Tab-switch limits.
- Per-candidate PINs.
- A tamper-proof server-side timer.
- Attempt references on result slips.
- Signed webhooks.
- Examiner audit of violations.

#### 10. Pricing
Exam halls use **candidate credits** (shown in the workspace today). The original plan was a free tier (first 30 candidates free), then pay-per-candidate top-ups through Paystack. **Confirm the actual current pricing with the team before publishing.** Present it as:
- A simple free tier.
- A pay-as-you-go tier.
- "Schools on ParaLearn: included".

Add a "Talk to us" route for large centres.

#### 11. Testimonials or pilot results
Only real quotes from real users, with name, role, school or centre, and permission. Leave the section out until we have them. Do not use placeholders on the live site.

#### 12. FAQ
Accordion, 6–8 questions. For example:
- Do candidates need an account?
- What happens if the internet or power goes off?
- Can candidates use phones?
- How do I stop cheating?
- Can I import questions from Excel?
- How do scores get to report cards?
- How much does it cost?
- Is my data safe?

#### 13. Final call to action
A full-width band (the gradient is allowed here as background):
- "Run your next exam on ParaLearn CBT."
- **Create a free exam hall** (primary).
- **Enter an exam code** (secondary, for candidates who scrolled).

#### 14. Footer
- ParaLearn logo.
- Links: CBT home, Candidate entrance (`/take`), Examiner sign in, Developer API, ParaLearn (pln.ng), SabiNote, privacy, terms, contact (WhatsApp and email).
- Social links (X, LinkedIn, as in `siteConfig.ts`).
- © year ParaLearn.

### Landing page acceptance checklist
- [ ] The exam-code box is visible without scrolling at 360×640 and at 1366×768.
- [ ] Entering a code goes to `/take/{CODE}` exactly as today.
- [ ] Signed-in examiners visiting `/` still land on their dashboard.
- [ ] Every claim on the page is true of the shipped product.
- [ ] Lighthouse: Performance ≥90 on mobile, Accessibility 100, SEO 100.
- [ ] Page weight under 1 MB, with no layout shift.
- [ ] The page uses the ParaLearn tokens and components from Chapter 2. The only extras are the hero gradient and Outfit.

---

# Appendix: Suggested order of work

1. **Tokens first.**
   - Apply the token snippet (2.2) and the Geist Mono fix (2.3).
   - Replace hard-coded hex and gradients.

   This alone makes the product look like one app.
2. **Shared components:**
   - Status badge.
   - Button variants.
   - Confirmation dialog.
   - Notice.
   - Empty, loading and error states.
   - Step indicator.
3. **The candidate journey:** lobby → live exam → result slip. This is the highest stakes and the most visible to schools and judges.
4. **The examiner core:** dashboard → studio → monitor.
5. **Candidates page and settings.**
6. **Landing page,** after the product screens are redesigned, so its screenshots show the new UI.

Each step should keep every feature and state in Chapter 1 and be checked against the accessibility checklist in 2.12.
