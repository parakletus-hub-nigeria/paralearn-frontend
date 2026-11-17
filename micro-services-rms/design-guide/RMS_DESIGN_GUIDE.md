# ParaLearn Results: Design Guide

**Product:** ParaLearn Results, the offline-first report-card app at **rms.pln.ng**.
**Code:** `micro-services-rms/frontend/src`. It runs inside the main ParaLearn Next.js app; see `micro-services-rms/README.md`.
**Parent design system:** `DESIGN.md` and `PRODUCT.md` at the repository root ("The Clear Register").
**Sister guide:** `micro-services-cbt/design-guide/CBT_DESIGN_GUIDE.md`. ParaLearn Results and ParaLearn CBT are two microservices of one family. They share the same tokens, the same components and the same wording rules. **Shared tokens are repeated here so this guide stands alone, but if a value changes, change it in both guides.**
**Last updated:** November 2026, written from a full read of the current code.

This guide has three chapters:

1. **Every screen we have today**: what is on it, what each feature does, and every state the redesign must keep. This includes the **printed report card**, which is the product's real output.
2. **The design elements**: colours, type, spacing and components, plus what the code does today and what it should use.
3. **The landing page**: the sections a public landing page needs, starting with the problem we solve.

> **Before you redesign anything:** keep every feature and state in Chapter 1. Most of the logic has been built and tested to work with no internet:
> - the results engine;
> - offline loading;
> - class-by-class generation that can stop and resume;
> - automatic score sync.
>
> Change how it looks and where things sit, not what it does, unless a change of behaviour is agreed first.

> **Fixed in code since this guide was written (18 Nov 2026):**
> - **School colour rule (2.2):** cards and the profile preview now darken light colours for text and use dark heading text on light fills. The profile has the ten preset swatches and a note when a colour was adjusted.
> - **Card preview on phones (1.5):** browsers that can't show a PDF in the page now get a summary of the card and a download button.
> - **Columns ParaLearn doesn't store (1.5, 1.7):** the batch view and the CSV template now say that a 3rd CA prints on cards but isn't stored in ParaLearn.
> - **Shared tokens and Geist Mono (1.10, 2.12):** `rms-workspace.css` now points at the shared ParaLearn colours, and Geist Mono is loaded.
>
> - **Yoruba and Igbo names (1.8):** text with ọ, ẹ, ṣ, ń and similar letters is now drawn in Noto Sans, embedded only where needed and saved for offline use. A tone mark stacked on a dotted letter is dropped (Ẹ̀mí prints as Ẹmí), because pdf-lib can't position it. Everything else stays in Helvetica, which now keeps the accents it can draw (é, á, ò).
>
> Still open: everything else in this guide. A redesign that wants stacked tone marks, or one font for the whole card, needs a different PDF approach.

---

## Contents

- [Chapter 0: The product in one page](#chapter-0-the-product-in-one-page)
- [Chapter 1: Every screen and feature](#chapter-1-every-screen-and-feature)
  - [1.1 Screen map](#11-screen-map)
  - [1.2 Sign in and create a school account](#12-sign-in-and-create-a-school-account)
  - [1.3 Workspace shell](#13-workspace-shell)
  - [1.4 Result batches (home)](#14-result-batches-home)
  - [1.5 Batch view](#15-batch-view)
  - [1.6 School profile](#16-school-profile)
  - [1.7 CSV template](#17-csv-template)
  - [1.8 The printed report card (PDF)](#18-the-printed-report-card-pdf)
  - [1.9 Things that happen in the background](#19-things-that-happen-in-the-background)
  - [1.10 Problems that cut across screens](#110-problems-that-cut-across-screens)
- [Chapter 2: Design elements](#chapter-2-design-elements)
- [Chapter 3: The landing page](#chapter-3-the-landing-page)
- [Appendix: Suggested order of work](#appendix-suggested-order-of-work)

---

# Chapter 0: The product in one page

**What it is.** A school opens its term's result sheet (Excel, or our CSV template) on its own laptop. ParaLearn Results:
- works out every student's totals, grades and positions;
- draws a printable A4 report card for every student, one PDF booklet per class;
- sends the scores to the school's ParaLearn account once there is internet.

**Everything except signing in and sending scores works with no internet at all.** The app can be installed like a phone or desktop app ("ParaLearn Results").

**Who uses it:**

| User | Where they are | What they need |
|---|---|---|
| **School admin, exam officer or principal's secretary** at a school **on ParaLearn** | Office laptop, often during end-of-term rush, often during a power cut or with no data | Turn the sheet they already keep into clean report cards tonight, then have the scores in ParaLearn without re-typing |
| **The same person at a school not on ParaLearn** | Same | Make professional report cards without buying a full school system. Creating an account takes a minute. |
| **Parents** (indirectly) | They receive the printed card | A card that looks official, is easy to read, and shows the school's identity |

**The flow:**
1. Sign in once, or create a school account (online).
2. Confirm the school profile once: name, motto, address, logo and colour, which print at the top of every card.
3. Open a result sheet, pick the term and session, then **Work out results**.
4. Report cards generate class by class. The first card shows at once.
5. Download a whole class booklet, or a single card, and print.
6. The scores are sent to ParaLearn automatically when online.

**The rules it applies** (all in `offline/engine/grading.ts`):
- Each subject is out of 100.
- **Grades:** A 70–100 Excellent, B 60–69 Very Good, C 50–59 Good, D 45–49 Fair, E 40–44 Pass, F 0–39 Fail.
- **Ties share a position:** 1, 2, 2, 4.
- **Averages** count only the subjects a student sat.
- **Not sat:** blank, "-", "ABS" and "N/A" all mean the student did not sit the subject.
- **Default comments:** teacher's and principal's comments are filled in from the average when the sheet doesn't give them.

---

# Chapter 1: Every screen and feature

## 1.1 Screen map

rms.pln.ng is **one page**. Screens are switched with the URL hash, so they work offline with no server round trip.

| Address | Screen | Shown when |
|---|---|---|
| `rms.pln.ng/` (any hash) | **Loading skeleton** | While the local database opens |
| `rms.pln.ng/` | **Sign in** / **Create a school account** | No saved session, or the session needs renewing to send scores |
| `#/profile` (forced on first run) | **School profile** | First sign-in (before anything else), or chosen from the sidebar |
| `#/` | **Result batches** (home) | Default |
| `#/batch/{id}` (`?new` after creating one) | **Batch view** | A batch is opened |
| `#/template` | **CSV template** | From the sidebar, the home page button, or the empty state |
| (output) | **Report card PDF** | Downloaded from the batch view |

How it is served:
- `rms.*` hosts are rewritten to the internal route `/result-studio`.
- The page is marked `noindex`.
- `public/rms.webmanifest` makes it installable, with theme colour `#641bc4`.
- A service worker (`public/rms-offline-sw.js`) caches the app so it opens offline.

**There is no public landing page today.** A signed-out visitor sees the sign-in form. Chapter 3 adds the landing page.

---

## 1.2 Sign in and create a school account
*File: `offline/ui/SignIn.tsx`*

**Purpose:** a one-time sign-in with a ParaLearn school account, or a new school account for schools not on ParaLearn.

**Layout:** a centred column.
1. Brand: ParaLearn logo, a divider, then "Results".
2. H1 and subtitle. These change with the mode.
3. The form panel.
4. A mode switch link.
5. A three-item "How it works" strip:
   - Open your result sheet (spreadsheet icon).
   - Print report cards offline (printer icon).
   - Scores sync when online (cloud icon).

| Mode | Title / subtitle | Fields | Button |
|---|---|---|---|
| **Sign in** | "Sign in to ParaLearn Results" / "Use your school's ParaLearn account. After this, the app works without internet." | **School address** (`[kings].pln.ng`, as an input with a fixed `.pln.ng` suffix); **Email address**; **Password** | **Sign in →** ("Signing in") |
| **Create a school account** | "Create a school account" / "For schools not on ParaLearn yet. It takes a minute." | **School name** (e.g. "Kings College Lagos"); **Your first name** and **Last name** side by side; **School address**, suggested from the school name until edited, with the help text "Your school's ParaLearn address. You'll use it to sign in."; **Email**; **Password** (at least 8, with help text); **Phone** (optional) | **Create account →** ("Creating account") |

**Mode switch links:**
- "School not on ParaLearn? **Create a school account**".
- "Already on ParaLearn? **Sign in**".

**States:**
- **Offline:** an amber notice, "You're offline. Connect once to sign in; after that this app works without internet." The submit button is disabled.
- **Error:** inline red text above the button (`role="alert"`), with the server's message, or "Couldn't sign in. Please try again." / "Couldn't create the account."
- **Account created:** a toast, "School account created: {address}.pln.ng." If the address was taken, it says so and gives the new address.

**After signing in:**
- The app looks up the school's ParaLearn name, colour and logo, waiting at most 5 seconds.
- It prefills the School profile and opens that screen for confirmation.

**Redesign notes:**
- No "forgot password" (it should link to the ParaLearn reset page).
- No show/hide password toggle.
- On mobile, the "How it works" strip is the only explanation of what the product is. A first-time visitor gets no other context (Chapter 3 fixes this).

---

## 1.3 Workspace shell
*File: `offline/ui/WorkspaceShell.tsx`. It is deliberately built like the CBT examiner shell.*

**Sidebar** (232px, wash background; becomes a drawer below 1024px with a top bar holding the logo and a menu button):
- **Brand:** ParaLearn | Results. Clicking it goes home.
- **"School workspace"** label with the school name ("Your school" if not set).
- **Primary nav:**
  - **Result batches** (spreadsheet icon).
  - **School profile** (school icon).
- **Resources:**
  - **CSV template** (document icon).
  - **ParaLearn portal ↗**. It opens `{school}.pln.ng` in a new tab.
- **Connection block:**
  - "Connection": a green or amber dot with **Online** or **Offline**.
  - "Without internet": **Ready**, **Preparing** or **Not available**. This is whether the app is cached to open offline.
- **Account:**
  - An initial avatar, the person's name and `{school}.pln.ng`.
  - A sign-out icon. It opens a browser `confirm()`: "Sign out? Result batches stay on this laptop. You'll need internet to sign in again."
- **Skip to content** link; Escape or the overlay closes the mobile drawer.

**Redesign notes:**
- "Without internet: Not available" gives no reason and no fix. Add a one-line explanation: "Open this page once while online to make it available offline". Mention installing the app.
- Sign-out uses the browser's grey `confirm()`. Use the shared confirmation dialog.
- **The connection status is the most important reassurance in this product.** Make it more visible than a sidebar footer, for example a chip in the page header as well.
- Make "Install app" a visible action when the browser supports it. Today installation is only possible through the browser menu.

---

## 1.4 Result batches (home)
*Files: `OfflineResultsApp.tsx` (`Home`), `NewBatch.tsx`, `IssueList.tsx`*

**Layout, top to bottom:**
1. **Heading:** eyebrow "Report cards, with or without internet", the H1 **"Result batches"**, and the **CSV template** button.
2. **Summary strip** (4 figures). Each shows "–" while loading.

| Label | Value | Caption |
|---|---|---|
| Batches on this laptop | count | – |
| Students worked out | total students | – |
| Batches with cards ready | count | – |
| Waiting to send to ParaLearn | count | "Sends when online" / "All sent" |

3. **"Open a result sheet"**, with the line "Your Excel sheet (one tab per class) or our filled-in CSV template. It's worked out on this laptop; no internet needed."

| Control | Behaviour |
|---|---|
| **Drop zone** ("Drop the file here, or click to choose", ".xlsx, .xls or .csv") | Click, Enter or Space opens the file picker; drag and drop works. When chosen, it shows the file name, size in KB, "click to choose another" and a remove ×. Rejected files: "Choose an Excel file (.xlsx or .xls) or a CSV file." Over 25 MB: "That file is over 25 MB. Remove pictures or unused tabs and try again." |
| **Term** | Select: First Term, Second Term, Third Term |
| **Session** | Text, pre-filled with the current session (Nigerian sessions start in September, e.g. 2026/2027). Must be `YYYY/YYYY`, otherwise: "Write the session as YYYY/YYYY, for example 2026/2027." |
| **Work out results** (primary) | Disabled until a file is chosen. Reads "Working out results" with a spinner while busy. The sheet is read and computed in a background worker. |
| **Blocking problems** | A red notice, "Fix these in the sheet, then choose it again", with the issue list. For example: no subjects, no score columns, or "Class "JSS 1A" appears in more than one tab." |
| **On success** | The batch is saved on the laptop and the batch view opens, where generation starts automatically. |

4. **"On this laptop"**, the list of batches.
   - **Loading:** three skeleton rows.
   - **Empty:** "No result sheets yet", "Open your school's Excel result sheet above. No sheet? **Download our CSV template**, fill it in and open it."
   - **Table.** Each row opens the batch.

| Column | Content |
|---|---|
| Result sheet | File name (link); meta: "{term} · {session}", "{n} classes", time ago ("just now", "5 min ago", "3 h ago", "12 Nov") |
| Students | number |
| Report cards | **Cards ready** (green) or "{done}/{total} classes" (amber) |
| ParaLearn (hidden on small screens) | **Sent** · **Sending** · **Not sent** · **To send** |
| › | chevron |

**The issue list** (shared component):
- Problems are sorted errors first. Each item has:
  - a **Fix** (red) or **Check** (amber) badge;
  - the tab and row in monospace (e.g. `JSS 1A · row 14`);
  - the message.
- It shows 6 items, then "Show all N".
- **Typical warnings:**
  - "{subject} appears twice; its columns were combined."
  - "Scores without a student name; row skipped."
  - "{name} also appears in row 12. Both were kept; check this isn't a duplicate."
  - "{name}: "abc" in Mathematics isn't a number; treated as blank."
  - "negative score … treated as 0".
  - "No students found on this tab; it was skipped."

**Redesign notes:**
- **The upload is the main job of this screen but sits under the summary strip.** For a first-time user with no batches, the summary of four zeros is noise. Lead with the upload; show the summary once there are batches.
- **The excel layout rule ("one tab per class, subjects across the top, 1st CA / 2nd CA / Exam under each") is explained nowhere in the UI.** Add a "What should my sheet look like?" help with a small diagram and a sample file.
- **There is no way to delete or rename a batch from the list.** Delete is inside the batch only.
- **Batches are named after the file** (e.g. "JSS results final (2).xlsx"). Offer an editable batch name defaulting to "{Term} {Session}".
- **Row layout:** the whole row is clickable, which is good. Keep a real link inside it for keyboards (today's code does).

---

## 1.5 Batch view
*Files: `BatchView.tsx`, `generation.ts`*

**Purpose:** generate, check, preview and download the report cards for one batch, and see whether the scores reached ParaLearn.

**Layout, top to bottom:**
1. **Back link:** "← Result batches".
2. **Heading:**
   - Eyebrow "{term} · {session}", with the **file name** as the H1.
   - Actions on the right:
     - **Delete** (quiet, red on hover; uses a browser `confirm()`: "Delete this batch and its report cards from this laptop? Scores already sent to ParaLearn stay there.").
     - One state-dependent action:

| State | Action |
|---|---|
| Not started | **Generate report cards** (primary, play icon) |
| Some classes done | **Resume** (primary) |
| Generating | **Stop** (square icon). Finished classes are kept. |
| All done | **Redo cards** (refresh icon, tooltip "Redraw every card, e.g. after changing the school profile") |

   The action is disabled while another batch is generating.

3. **Summary strip:**

| Label | Value | Caption |
|---|---|---|
| Students | total | "in {n} classes" |
| Report cards | done / total | "All report cards are ready" / "Generating JSS 2B" / "3 of 8 classes ready" |
| School average | e.g. 61.4% | "across every student" |
| ParaLearn sync | status chip (below) | details + action link |

**The sync states:**

| Chip | Detail text | Link (online only) |
|---|---|---|
| Not sent yet | "Sends automatically" / "Sends when back online" | **Send now** |
| Sending (spinner) | "Sending scores to ParaLearn" | – |
| **Sent** (green) | "Scores sent to ParaLearn 5 min ago, 240 students" | **Send again** |
| **Not sent** (red) | "Will retry automatically" | **Send now** |
| **Sign in needed** (amber) | "Sign in again to send" | **Sign in** |

4. **Progress** (while generating, `aria-live`): "Generating **JSS 2B**: 23 of 41", a percentage, and a bar.
5. **Sign-in notice** (when the session has expired): the error text plus a **Sign in** button.
6. **Warnings** (collapsible, amber): "{n} things to check in the sheet", with **Show**, which expands the issue list.
7. **Class tabs:**
   - One tab per class, with a green tick when its cards are ready and the student count.
   - On the right, the **booklet download**: "{Class} booklet ({n} pages)", or "Booklet not generated yet" (disabled).
8. **Split view:**
   - **Left: class results table.** It is sorted by position; selecting a row previews that student.

| Column | Content |
|---|---|
| Pos. | 1st, 2nd, 2nd, 4th (ties share) |
| Student | name |
| Admission no. (hidden on small screens) | monospace, or "–" |
| Average | one decimal |
| Grade | badge: A green, F red, others neutral |
| Subjects (hidden on small screens) | count |

   Under the table: "Class average **58.3%**. Select a student to preview their card."

   - **Right: card preview.** The selected student's card is drawn instantly in the browser and shown in an embedded PDF viewer, with **This card** to download just that student. A skeleton shows while it draws.

**Other states:**
- **Loading:** skeleton rows.
- **Batch not on this laptop:** "This batch isn't on this laptop", with "Back to result batches".

**Toasts:**
- "All report cards are ready."
- "Stopped. Finished classes are saved; resume any time."
- "Scores sent to ParaLearn."
- "Batch deleted."
- Errors.

**Redesign notes:**
- **Check the preview on phones and tablets before anything else.** Many mobile browsers (Chrome on Android, for one) do not show a PDF inside an embedded frame. Users there will see a blank box. Either render the preview as an image or HTML, or show a "Open card" button on those devices.
- **Rows in the results table are selected by click only.** There is no button or link in the row, so keyboard users can't choose a student. Make each row's name a button.
- **Many classes overflow the tab bar.** A school with 20+ classes (JSS 1A–SS 3D) scrolls sideways with no hint. Use a scroll fade, or switch to a class picker above about 8 classes.
- **There is no "Download all classes" option.** Add one (one PDF, or a zip of booklets).
- **The app doesn't explain which scores ParaLearn kept.** The sync step records which columns ParaLearn did not store: it keeps only 1st CA, 2nd CA and Exam, so a 3rd CA is dropped. The README says the app tells the school, but **nothing shows it**. The sync detail should say "3rd CA printed on cards but not stored in ParaLearn".
- **There is no print button.** Schools download, then print. A **Print** action that opens the booklet in the print dialog saves a step.
- **The "Redo cards" reason is a tooltip only.** When the school profile changed after cards were made, show a notice: "Your school profile changed. Redo cards to update them."

---

## 1.6 School profile
*File: `SchoolProfileForm.tsx`*

**Purpose:** the school details printed at the top of every card. They are stored on this laptop.

- The screen **opens automatically after the first sign-in**, with a blue notice: "Check how your school appears on report cards. You can change this any time." The button then reads **Save and continue**.
- Heading: eyebrow "Printed at the top of every report card", H1 **"School profile"**.

| Field | Notes |
|---|---|
| **School name** | Required ("Enter the school's name.") |
| **Motto** (optional) | e.g. "Knowledge and Integrity" |
| **Address** (optional) | – |
| **Phone** and **School email** (optional), side by side | – |
| **Logo and colour** fieldset | A logo box (shows the logo, or the school's initials in its colour). **Add logo / Change logo** (any image; converted to PNG; "Choose an image file (PNG, JPG or SVG)." / "That image couldn't be read. Try a PNG or JPG."). **Remove**. **Card colour**: a colour picker plus a hex text field; must be `#rrggbb` ("Use a colour like #641bc4."). |
| **Save profile** | Toast: "School profile saved on this laptop." |

**Right column: "Top of each report card"**, a live preview of the card header:
- A colour bar.
- The logo, or the initials in a coloured circle.
- The school name in upper case, in the school colour.
- The motto in italics.
- "Address | phone | email".

A note under it: "Cards already generated keep the old details. Open a batch and choose Redo cards to update them."

**Redesign notes:**
- **Some school colours make the card unreadable.** The colour picker accepts any colour, but the card puts **white text on the school colour** (the subject table header) and the **school name in that colour on white**. Gold, yellow, sky blue and bright green fail:

| School colour | Contrast with white |
|---|---|
| `#facc15` yellow | 1.5:1 |
| `#f59e0b` gold | 2.2:1 |
| `#38bdf8` sky blue | 2.1:1 |
| `#22c55e` bright green | 2.3:1 |

  Many Nigerian schools use gold or yellow, so this will happen. See the rule in 2.2.
- **The preview shows only the header.** Show the full card (a scaled first page with sample data), so the school sees how the colour works on the table.
- **Colour presets help.** Offer 8–10 tested school colours (navy, maroon, bottle green, royal blue, purple, and so on) as swatches above the custom picker.
- **The colour input uses inline styles** with its own radius and border. It should use the shared input style.

---

## 1.7 CSV template
*File: `TemplatePage.tsx`*

**Purpose:** for schools without their own result sheet. It builds a one-table CSV for the whole school (one row per student) to fill in and open.

- Back link "← Result batches".
- Heading: eyebrow "For schools without their own result sheet", H1 **"CSV template"**, and the primary **Download template** button.
- **Settings are remembered** on this browser.

| Group | Fields (defaults) |
|---|---|
| Classes / Subjects (side by side) | **Classes** textarea ("JSS 1A / JSS 1B / JSS 2A", one per line or comma-separated). **Subjects** textarea (pre-filled with common subjects: Mathematics, English Language, Basic Science…), with "Each subject is marked out of 100." |
| **Score columns for each subject** | Checkboxes: **1st CA** (out of 20), **2nd CA** (out of 20), **3rd CA** (if your school has one), **Exam** (out of 60). Default: 1st CA, 2nd CA, Exam. |
| **Rows and extra columns** | **Rows per class** (1–200, default 40). **Teacher's comment and attendance** (on): "Printed on each card when filled in." |

**Right column: "What you'll download":**
- Counts for Classes, Subjects and Columns.
- A preview of the header row and two sample rows: Class, S/N, Student Name, Admission No, "Mathematics 1st CA" …
- The line "Opens in Excel or Google Sheets. Fill one row per student, save as CSV or Excel, then open it from Result batches."

**Validation toasts:**
- "Add at least one class, e.g. JSS 1A."
- "Add at least one subject."
- "Pick at least one score column."

**Success toast:** "Template downloaded. Fill it in, save it, then open it from Result batches."

The file is named "{School} result sheet template.csv".

**Redesign notes:**
- **The preview table is set at 11px.** Raise it to 12px minimum, and let it scroll sideways with a fade.
- **No Excel version.** Offer an "Excel (.xlsx)" download as well. Teachers often find CSV confusing when Excel reformats admission numbers.
- **3rd CA isn't sent to ParaLearn.** Next to the 3rd CA checkbox, say: "Printed on cards; not stored in ParaLearn".

---

## 1.8 The printed report card (PDF)
*File: `offline/pdf/reportCardPdf.ts`*

**This is the product.** Parents never see the app; they see this page. It is one A4 portrait page per student, with 32pt margins. Fonts are Helvetica only (built into every PDF reader, so no downloads and it works offline). One booklet per class.

**Layout, top to bottom:**

| Block | Content |
|---|---|
| **Accent bar** | 7pt full-width bar in the school colour |
| **Header** | Logo (58pt), or the school initials in a circle of the school colour. **School name** in upper case, bold 15pt, **in the school colour**, up to 2 lines. Motto in italics. "Address \| phone \| email". On the right, a **title box** (tinted school colour): "STUDENT REPORT CARD", the term (13pt bold) and "{session} Session". |
| **Student strip** | Five cells with small grey labels: STUDENT NAME · ADMISSION NO. · CLASS · POSITION ("2nd of 41") · AVERAGE ("67.4%") |
| **Academic performance** (section title with a small colour mark) | Table header **filled with the school colour, white 6.5pt bold labels**: SUBJECT · score columns (1ST CA, 2ND CA, EXAM, …) · TOTAL · GRADE · POS. · CLASS AVG · HIGH · LOW · REMARK. Zebra rows; subject, total and grade in bold; **an F grade printed in red**. Row height shrinks for long subject lists. "No scores were entered for this student." when empty. |
| **Summary tiles** | TOTAL SCORE ("812 / 1200") · AVERAGE · OVERALL GRADE · CLASS POSITION · CLASS AVERAGE · SUBJECTS TAKEN |
| **Behaviour & skills** | Ratings from the Teacher Data tab, "Rated 1 (poor) to 5 (excellent)", or "Not recorded" |
| **Attendance** | Days school opened · Days present · Days absent · Attendance %, or "Not recorded" |
| **Grading key** | A 70–100 Excellent … F 0–39 Fail |
| **Comments** | Two boxes: **CLASS TEACHER'S COMMENT** and **PRINCIPAL'S COMMENT** (italic, 2 lines max), each with a **signature & date** line |
| **Footer** | "Generated with ParaLearn Results on 17 Nov 2026" · "{Class} \| Row {n}" (so a wrong card can be traced to its sheet row) |

**Technical constraints the design must respect:**
- **Fonts.** The standard PDF fonts can't draw Yoruba or Igbo accents, so names are folded: **Ọlá prints as Ola**. A redesign that wants Manrope or proper diacritics must embed a font subset and cache it for offline use. This is worth doing: a child's name spelt wrong on an official document matters. Agree it first, because it increases the PDF size.
- **Speed.** Speed is a feature: about 8 seconds for 1,000 cards on a laptop. Avoid designs that need images per page, gradients, or transparency.
- **Black-and-white printing.** Many schools print on black-and-white laser printers or photocopy the cards. **The card must read correctly in greyscale.** Tints, the coloured table header and the red F all need to survive that. Never use colour as the only signal: an F is already marked by the letter itself, which is right.
- **Text fitting.** Long names and subjects are shortened with "…" to fit. Keep enough room for long Nigerian names (e.g. "Oluwatobiloba Chukwuemeka Adebayo-Williams").

**Redesign notes for the card:**
- **Unreadable school colours.** Apply the school-colour rule in 2.2 to both the table header and the school name.
- **Wasted signature space.** Each comment box gives about 55% of its width to a signature line. Add a space for the school stamp and the next term's resumption date. Schools ask for both, and both are standard on Nigerian report cards.
- **Optional details.** Consider a passport photo slot and a "Next term begins" line. Make both optional in the School profile.
- **Tiny labels.** The 6.5pt labels are at the limit for print. Don't go smaller; 7pt is better.

---

## 1.9 Things that happen in the background

The redesign must keep these behaviours, and make them visible where they matter.

| Behaviour | Detail | Where the user sees it |
|---|---|---|
| **Offline loading** | The service worker caches the app and both background workers on the first online visit | Sidebar "Without internet: Ready / Preparing / Not available" |
| **Persistent storage** | The app asks the browser not to delete its data when the disk is low | Nowhere (should be mentioned in help) |
| **Automatic sync** | Waiting scores are sent on load, when the connection returns, and every 60 seconds | Summary "Waiting to send", the sync chip, toast "{n} batches of scores sent to ParaLearn." |
| **Token renewal** | The 1-hour access token renews with ParaLearn's 7-day refresh cookie; after that, sign-in is needed | "Sign in needed" chip and notice |
| **Generation** | One class at a time in a background worker. Each class booklet is saved as soon as it finishes. Stop keeps finished classes; Resume continues. Only one batch generates at a time. | Progress bar, class ticks |
| **Instant preview** | One card is drawn on the main thread in milliseconds, so the first card shows straight away | Preview panel |
| **Data stays on this laptop** | Batches aren't shared between laptops; each keeps its own copy | Should be said clearly (see 1.10) |

**Known product limits, from the README.** The design must not hide these:
- ParaLearn stores only 1st CA, 2nd CA and Exam.
- ParaLearn files synced scores under the school's **current** term, whatever term was picked in the app.
- Batches don't move between laptops.

---

## 1.10 Problems that cut across screens

1. **Private tokens.**
   - `rms-workspace.css` defines its own `--rms-*` oklch neutrals and **its own status colours**, which differ from the shared palette:

| Status | `--rms-*` (text / background) | Global ink |
|---|---|---|
| Good | `#116149` / `#e8f5ee` | `#065f46` |
| Warning | `#85531b` / `#faf1df` | `#92400e` |
| Error | `#9f1d2b` / `#fbe9ea` | `#991b1b` |

   - The dot colours (`#1f9d6c`, `#d98a20`) and the tick colour (`#1f9d6c`) are hard-coded too.
   - The CBT app has the same problem with its own copy. Both should read from the shared tokens (2.2).
2. **Browser confirmations:** sign out and delete batch use the browser's grey `confirm()` box.
3. **Inline styles** in many places: negative margins on notices, the unit text in the summary, the colour input, the preview table's font size, and the card-header preview.
4. **Corner radius:** 6px everywhere (as in CBT). The ParaLearn system uses 8px for controls and 12px for containers.
5. **Status badge shape:** 4px rectangles, where the system uses pills.
6. **"Only on this laptop" isn't said where it matters.** A school that clears its browser, changes laptop or uses a shared computer loses its batches. The sent scores are safe in ParaLearn, but the generated cards are not. Say this on the home page and in the delete confirmation, and offer "Download all cards" as a backup.
7. **First-run guidance is thin.** Nothing explains the Excel layout, and there is no sample sheet to try the product with.

---

# Chapter 2: Design elements

## 2.1 Principles for ParaLearn Results

The five ParaLearn principles in `PRODUCT.md` apply:
- Data is the hero.
- Speed is respect.
- Earned trust through precision.
- Density without crowding.
- One product.

Results adds four principles of its own:

1. **The report card is the product.** Every design decision on screen serves one goal: a correct, official-looking card in a parent's hand. When in doubt, spend effort on the PDF, not the app chrome.
2. **Offline is normal, not an error.** Power cuts and no data are the expected working conditions for a school office in exam season. "Offline" is shown calmly in amber, never red, and every screen says what still works.
3. **Always show where the data is.** The user must always know three things:
   - What is on this laptop.
   - What has been sent to ParaLearn.
   - What hasn't been sent yet.

   These are the three states of trust in this product.
4. **One family with CBT.** Results and CBT share the same shell, colours, type and components. A school admin who uses both should feel they are in one product. The only intentional difference is the product name next to the logo.

---

## 2.2 Colour

### Shared ParaLearn palette (identical to the CBT guide)

**Brand:**

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--violet-ink` | `#641bc4` | Primary button, active nav, focus ring, links, selected row marker | 8.4:1 on white |
| `--violet-hover` | `#7b22e8` | Hover on violet buttons | White text 6.5:1 |
| `--violet-pressed` | `#5214a3` | Pressed only | White text 10.6:1 |
| `--violet-tint` | `#f0e5ff` | Active nav background, selected row | Violet text 7.0:1 |
| `--violet-wash` | `#f7f3ff` | Row hover, drop-zone hover | – |
| `--violet-line` | `#dfceef` | Borders on violet surfaces | – |

**Neutrals:**

| Token | Hex | Use | Contrast on white |
|---|---|---|---|
| `--background` | `#fdfdff` | Page | – |
| `--card` | `#ffffff` | Panels, inputs, preview frame | – |
| `--surface-subtle` | `#f8fafc` | Sidebar, table header | – |
| `--surface-muted` | `#f1f5f9` | Neutral badges, disabled fields | – |
| `--border-fine` | `#e2e8f0` | Dividers, card edges | – |
| `--border-medium` | `#cbd5e1` | Inputs, drop-zone outline | – |
| `--foreground` | `#0f172a` | Text | 17.6:1 |
| `--text-strong` | `#334155` | Strong captions, text on muted surfaces | 10.4:1 |
| `--text-secondary` | `#64748b` | Helper text on white only | 4.76:1 (4.34:1 on `#f1f5f9`, which fails) |
| `--text-placeholder` | `#94a3b8` | Placeholders only | 2.56:1 (fails; never for content) |

**Signals.** Text and icons use the **ink** shade; the vivid emerald and amber fail as text (2.5:1):

| Signal | Vivid (dots, bars) | Tint (background) | Ink (text) | Line | Meaning in Results |
|---|---|---|---|---|---|
| Emerald | `#10b981` | `#dff9d8` | `#065f46` (on tint) · `#047857` (on white) | `#a7f3d0` | Online, sent, cards ready, grade A |
| Amber | `#f28c1f` | `#ffe9cc` | `#92400e` · `#b45309` | `#fde68a` | Offline, waiting to send, "Check" warnings, sign-in needed, partly generated |
| Crimson | `#e60023` | `#fddada` | `#991b1b` · `#b91c1c` | `#fecaca` | "Fix" errors, not sent after failure, delete, grade F |
| Cobalt | `#2a64f6` | `#dbe9ff` | `#1e40af` | `#bfdbfe` | Information: first-run notice, help, "Preparing" offline set-up |

**Rules (from `DESIGN.md`):**
- Violet stays under 10% of any screen.
- Signal colours only ever mean their state.
- Every status has an icon and a word as well as a colour.

### Results role tokens

**Sync status** (the most important status in the product):

| State | Look | Icon | Words |
|---|---|---|---|
| Waiting (online) | neutral | `CloudUpload` | "To send" / "Sends automatically" |
| Waiting (offline) | amber | `CloudOff` | "Waiting for internet" |
| Sending | violet tint | `Loader2` (static if reduced motion) | "Sending" |
| Sent | emerald | `CloudCheck` | "Sent" + when + how many students |
| Failed, will retry | crimson | `CloudAlert` | "Not sent" + reason + "Retrying" |
| Sign in needed | amber | `LogIn` | "Sign in to send" |

**Generation status:** not started = neutral; generating = violet with a progress bar; partly ready = amber ("3 of 8 classes"); all ready = emerald ("Cards ready").

**Connection:** online = emerald dot + "Online"; offline = amber dot + "Offline: everything except sending still works". Never red. Offline is normal here.

**Grades in the app table:**
- A = emerald.
- F = crimson.
- B to E = neutral.
- The grade letter is always printed, so colour is never the only signal.

### The school colour rule (report card)

Schools choose any colour. Before drawing, the PDF code (and the profile preview) must check it:
1. **Contrast check.** Measure the colour's contrast against white.
2. **4.5:1 or more** (navy, maroon, purple, bottle green, royal blue, red): use it as is, for the table header fill with white text and for the school name.
3. **Below 4.5:1** (yellow, gold, sky blue, bright green, orange):
   - Keep the colour for **fills and bars** (accent bar, title box tint).
   - Use **near-black text** `#0f172a` on the table header fill instead of white.
   - Print the **school name** in a darkened version of the colour, lowered in lightness until it reaches 4.5:1 (for example gold `#f59e0b` becomes about `#92400e`).
4. **Show it in the profile.** Show the result in the profile preview, with a quiet note: "Light colours are darkened for text so cards stay readable."

**Preset swatches** for the profile (all pass 4.5:1 with white):

| Colour | Hex |
|---|---|
| ParaLearn violet | `#641bc4` |
| Navy | `#1e3a8a` |
| Royal blue | `#1d4ed8` |
| Bottle green | `#166534` |
| Green | `#15803d` |
| Maroon | `#800000` |
| Wine | `#7f1d1d` |
| Red | `#b91c1c` |
| Brown | `#78350f` |
| Charcoal | `#1f2937` |

**Card neutrals** (keep the current values; they are close to the shared palette):

| Role | Value |
|---|---|
| Ink | `rgb(0.09, 0.11, 0.16)` ≈ `#171c29` |
| Muted | ≈ `#64738c` |
| Line | ≈ `#d1d9e3` |
| Zebra | ≈ `#f6f8fa` |

**The F grade on the card** stays red (`#cc1a1a`). Its meaning is still clear in greyscale because the letter is there.

### Token snippet for `rms-workspace.css`

Point the private tokens at the shared ones, so existing classes keep working:

```css
.rms-surface {
  --rms-ink: var(--foreground);
  --rms-muted: var(--text-secondary);
  --rms-line: var(--border-fine);
  --rms-paper: var(--background);
  --rms-wash: var(--surface-subtle);
  --rms-hover: var(--surface-muted);
  --rms-accent: var(--violet-ink);
  --rms-accent-press: #5214a3;
  --rms-accent-tint: var(--violet-tint);
  --rms-ok: #065f46;   --rms-ok-bg: var(--emerald-tint);
  --rms-warn: #92400e; --rms-warn-bg: var(--amber-tint);
  --rms-bad: #991b1b;  --rms-bad-bg: var(--crimson-tint);
  --rms-dot-ok: var(--emerald-signal);
  --rms-dot-warn: var(--amber-signal);
}
```

Replace the hard-coded `#1f9d6c` and `#d98a20` (dots and the class-ready tick) with `--rms-dot-ok` and `--rms-dot-warn`, and the `#dce0e7` input border with `--border-medium`.

### Dark mode

Not in scope. Offices are bright and the cards are printed. Keep every colour a token so it can be added later.

---

## 2.3 Typography

**On screen** (same scale as CBT and `DESIGN.md`):

| Role | Font | Size / weight / line-height | Where |
|---|---|---|---|
| Display | Manrope | 28–36px / 800 / 1.1 | One per screen: "Result batches", the batch name |
| Headline | Manrope | 18px / 700 / 1.3 | Section titles: "Open a result sheet", "On this laptop" |
| Title | Manrope | 15px / 600 / 1.4 | Table names, nav items |
| Body | Manrope | 14px / 400 / 1.6 | Everything else |
| Label | Manrope | 12px / 500 / 1.4 | Field labels, badges, captions |
| Mono | Geist Mono | 13px, `tabular-nums` | Admission numbers, tab and row references (`JSS 1A · row 14`), hex colours, school address |
| Figures | Manrope | 26px / 700, `tabular-nums` | Summary strip values |

**Rules:**
- **Minimum 12px on screen.** The preview table is 11px today, and the sidebar labels are 10–11px.
- **`tabular-nums` on every number:** averages, positions, counts, percentages.
- **Load Geist Mono properly.** `rms-workspace.css` uses `var(--font-geist-mono)`, but `src/app/layout.tsx` never adds `geistMono.variable` to `<body>`, so it falls back to the system monospace. This is the same fix as for CBT.

**On the printed card** (pt, Helvetica family):

| Element | Size and weight |
|---|---|
| School name | 15 / bold, in the school colour (after the school colour rule) |
| Term in the title box | 13 / bold |
| Student details values | 10 / bold |
| Table cells | 8.5 (7.5 for long lists) |
| Comments | 8.5 italic |
| Labels | 6.5–7 bold, upper case, muted |
| Footer | 6.5 |

**Minimum 6.5pt on paper.** Don't go smaller; prefer 7pt for new labels. If a custom font is embedded later (see 1.8), use **Manrope** for headings and labels, and keep a highly legible font for the table digits.

---

## 2.4 Spacing, layout and breakpoints

- **Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- **Page:** max width about 1280px, padding 32–40px (16px on phones).
- **Sidebar:** 240px (the code uses 232px; match `DESIGN.md` and CBT together).
- **Batch view split:** results table on the left, card preview on the right (about 420px wide, A4 ratio 1 : 1.414). Below 1100px the preview goes under the table, or opens in a sheet when a student is selected.
- **Forms** (profile, template, sign-in): single column, max 640px. Two-column rows from 640px wide.

**Breakpoints:** Tailwind defaults only.

| Width | What changes |
|---|---|
| <640 | Phones: one column, tables become stacked rows, preview opens full-screen |
| 640 (`sm`) | Two-column form rows |
| 768 (`md`) | Extra table columns (admission no., subjects, sync) |
| 1024 (`lg`) | Sidebar fixed instead of a drawer |
| 1100 | Split view side by side |

**Test sizes:**
- 1366×768 (the most common school office laptop).
- 1280×800.
- 768×1024 (tablet).
- 360×640 (phone; a proprietor checking cards).

---

## 2.5 Radius, borders and elevation

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4px | Inline code (tab and row references) |
| `--radius-md` | 8px | Buttons, inputs, selects, the drop zone, the colour input |
| `--radius-lg` | 12px | Panels, sign-in panel, preview frame, dialogs |
| `--radius-xl` | 16px | Sheets and drawers |
| `--radius-pill` | 9999px | Status badges only |

**Changes from today:**
- Retire the 6px radius (used across `rms-workspace.css`).
- Status badges move from 4px rectangles to pills.

**Borders and elevation:**
- **Borders:** 1px `--border-fine` for dividers; 1px `--border-medium` for inputs.
- **The drop zone:** a 1.5px dashed `--border-medium` at rest. When a file is dragged over it, the border turns violet and the fill turns `--violet-wash`.
- **Elevation** (from `DESIGN.md`):
  - Flat by default.
  - `--shadow-card` for the preview frame and the sign-in panel.
  - `--shadow-dialog` for dialogs, the mobile drawer and the mobile preview sheet.
  - No blur.

---

## 2.6 Motion

- **Durations:** 80ms (press), 120ms (hover), 150ms (lift), 220ms (dialogs, drawers, toasts).
- **What animates:** only `transform` and `opacity`.
  - The progress bar already animates with `scaleX`; keep that.
- **Reduced motion:** `prefers-reduced-motion` stops the spinners and slides. `rms-workspace.css` already has a reduced-motion block; keep it and extend it.
- **Generation progress is the one place motion helps.** Show a smooth bar, the class name, and "23 of 41". Don't add celebratory animation when finished; a calm "All report cards are ready" with a tick is right for the tone.

---

## 2.7 Icons

- **Library:** `lucide-react` only.
- **Sizes:** 16px inline, 18px in navigation and buttons, 26–40px in the drop zone and empty states.
- **Emoji:** none.
- **One concept, one icon:**

| Concept | Icon | Concept | Icon |
|---|---|---|---|
| Result batches / sheet | `FileSpreadsheet` | School profile | `School` |
| CSV template | `FileText` | ParaLearn portal | `School` + `ArrowUpRight` → use `ExternalLink` |
| Open a sheet / upload | `UploadCloud` | Download | `Download` |
| Print | `Printer` | Generate | `Play` |
| Stop | `Square` | Redo cards | `RefreshCw` |
| Delete | `Trash2` | Back | `ArrowLeft` |
| Online / sent | `CloudCheck` | Offline / not sent | `CloudOff` |
| Waiting to send | `CloudUpload` | Sign in needed | `LogIn` |
| Cards ready | `CircleCheck` | Problem to fix | `CircleAlert` |
| Something to check | `TriangleAlert` | Logo | `ImagePlus` |
| Install app | `MonitorDown` | Laptop-only data | `Laptop` |

**Fix:** "School profile" and "ParaLearn portal" both use `School` today.

---

## 2.8 Components

These are the same components as CBT, built on `@/components/ui` with the tokens above. The specs here are short; the CBT guide (section 2.8) has the full versions. **Stop using the browser's `confirm()`.**

**Buttons:**
- **Primary** (violet, one per screen): Work out results, Generate report cards, Save profile, Download template, Sign in.
- **Secondary:** CSV template, This card, booklet download.
- **Quiet:** Remove logo.
- **Destructive:** Delete batch, inside a confirmation dialog.
- **Specs:** 8px radius, 40px tall (44px on sign-in), loading state = spinner + verb at the same width.

**Inputs:**
- **Labels** above every field. "Optional" is a quiet suffix (as today; keep it).
- **Errors** are inline under the field, not toasts. The profile and template pages use toasts for validation today.
- **Affix input** for the school address: `[kings]` with a fixed `.pln.ng` suffix (keep it; it's a good pattern).
- **Session field:** monospace, with the format shown ("2026/2027").

**Drop zone:**
- The main control of the product. Large (at least 120px tall on desktop), keyboard-operable, accepts drag and drop.
- Shows the chosen file as a chip with name, size and remove.
- Problems appear directly underneath. Today a negative-margin hack places them.

**Summary strip:**
- Ruled row of 4 figures (keep the current pattern; it matches CBT).
- Label 12px, value 26px/700 tabular, caption 12px.
- Hide it on the home page until there is at least one batch.

**Status badge:**
- Pill, icon + word, tint background + ink text.
- One component for sync, generation, grade and issue level.

**Issue list:**
- Each row has:
  - a **Fix** (crimson) or **Check** (amber) badge;
  - the tab and row reference in mono;
  - the message.
- Show 6, then "Show all N".
- On the batch view, a collapsible amber panel.
- **Add a "Copy list" action**, so the exam officer can send the problems to the class teacher on WhatsApp.

**Tables:**
- **Header:** `--surface-subtle`, 12px/600, sentence case.
- **Rows:** at least 48px tall; hover `--violet-wash`; the selected row has `--violet-tint` and a 3px violet left marker.
- **Numbers:** right-aligned and tabular.
- **Keyboards:** every row has a focusable link or button for its main action.

**Class tabs:**
- Underline tabs with a ready tick and a count chip.
- Overflow scrolls with a fade on the edges.
- Above about 8 classes, add a "Jump to class" select.

**Progress:**
- Class name, "n of N", a percentage, and a 6px bar in violet. The bar turns emerald when done.
- `aria-live="polite"`.

**Card preview:**
- A frame with the A4 ratio, a skeleton while drawing, and a header with the student name and **This card**.
- **On devices that can't show PDFs inline**, render an image of the page, or show "Open card".

**Notices:**
- One component in four flavours: info (cobalt), warning (amber), error (crimson), success (emerald).
- Each has an icon, text, an optional action and an optional dismiss.

**Confirmation dialog:**
- Used for delete batch, sign out and redo cards (when cards were already downloaded).
- Title with the object ("Delete JSS results 2026/2027?").
- One sentence on the consequence: "Its report cards are removed from this laptop. Scores already sent to ParaLearn stay there."
- Cancel, then the destructive verb.

**Toasts:**
- **Position:** top-right.
- **Duration:** 4 seconds, 8 with an action.
- **Tone:** past tense, plain ("Scores sent to ParaLearn.").

**Empty, loading and error states:**
- **Every list has all three.**
- **Skeletons** shaped like the content (as today).
- **Empty states** offer the next step and the CSV template.

---

## 2.9 Print

The report card is covered in 1.8. Rules for anything printed:
- **Page:** A4 portrait, 32pt margins.
- **Greyscale:** every element must read in black and white.
- **Colour budget:** colour is limited to the school colour (accent bar, title box, table header, section marks) and the red F.
- **Every page carries** the school name, the student name, the term, the session and the date generated.
- **Booklets:** one student per page, no blank pages, in position order or sheet order. Today the order follows the sheet; the redesign could offer a choice.
- **Optional:** class broadsheets (all students × all subjects on one landscape page) are the most-requested next printout for Nigerian schools. If added, they follow the same rules.

---

## 2.10 Words and voice

**Voice:** direct, calm and precise, as in `PRODUCT.md`.
- No exclamation marks, no emoji.
- Use British/Nigerian spelling: colour, programme, enrol.
- Write for a busy exam officer at 9pm with a generator running.

**Glossary (one word per thing):**

| Use | Not | Meaning |
|---|---|---|
| **result sheet** | spreadsheet, workbook, file (in headings) | The Excel or CSV file of scores |
| **batch** / **result batch** | job, upload, import | One opened result sheet with its cards |
| **work out results** | process, compute, parse | Reading the sheet and calculating |
| **report card** | result slip, card (alone in headings) | One student's printed page |
| **booklet** | bundle, PDF | One class's report cards in one PDF |
| **send to ParaLearn** | sync, upload, push | Sending scores to the school's ParaLearn account |
| **on this laptop** | local, offline storage, IndexedDB | Data kept only in this browser |
| **school address** | subdomain | `kings.pln.ng` |
| **School profile** | branding, settings | Name, motto, logo and colour on cards |
| **term**, **session** | semester, academic year | First Term, 2026/2027 |

**Never show:** "IndexedDB", "service worker", "Web Worker", "sync failed: 500", "token", "K12". The current copy is already good at this; keep it.

**Formats:**
- Session "2026/2027".
- Dates "17 Nov 2026".
- Positions "2nd of 41".
- Averages to one decimal ("67.4%").
- Times "5 min ago", then "3 h ago", then the date.

---

## 2.11 Accessibility checklist

Target: WCAG 2.1 AA.

- [ ] All text passes 4.5:1. Use the ink shades and the school colour rule.
- [ ] Status never relies on colour alone: icon + word for sync, generation, issues and grades.
- [ ] The drop zone works by keyboard (Enter/Space) and announces the chosen file.
- [ ] Every table row's main action is reachable by keyboard (the batch results table is not today).
- [ ] Class tabs follow the tabs pattern (arrow keys move between tabs).
- [ ] Progress and sync changes are announced (`aria-live="polite"`).
- [ ] The card preview has a text alternative or an "Open card" button.
- [ ] The colour picker has a visible label and a hex field.
- [ ] Dialogs and the mobile drawer trap focus and close on Escape.
- [ ] Touch targets are at least 44×44px.
- [ ] `prefers-reduced-motion` respected.
- [ ] Works at 200% zoom and 360px wide.
- [ ] Printed cards read correctly in greyscale.

---

## 2.12 Where the code drifts today

| Area | Today | Should be |
|---|---|---|
| Neutral tokens | Private oklch `--rms-*` values | Aliases to the shared tokens (snippet in 2.2) |
| Status colours | `#116149`, `#85531b`, `#9f1d2b` and their backgrounds, different from the shared ink and tints | Shared signal ink and tints |
| Hard-coded colours | `#1f9d6c` (dot, tick), `#d98a20`, `#dce0e7`, `#fdfdff`, `#f7f3ff`, `#f2ecfa`, `#fff5e5`, `#795017`, `#17132055` | Tokens |
| Radius | 6px; badges 4px | 8px controls, 12px containers, pill badges |
| Inline styles | Negative margins, unit text, colour input, preview table size, header preview | Classes and components |
| Confirmations | Browser `confirm()` for sign out and delete | Shared confirmation dialog |
| Validation | Toasts on the profile and template pages | Inline field errors |
| Mono font | `geistMono.variable` not applied to `<body>` | Apply it (same fix as CBT) |
| Icons | `School` used for two concepts | One icon per concept (2.7) |
| Report card colour | Any school colour used for white-on-colour text | The school colour rule (2.2) |
| Dropped columns | Recorded at sync, never shown | Shown in the sync detail |
| PDF preview | `<iframe>` of a PDF | Fallback for browsers that can't show it |
| Sidebar width | 232px | 240px (with CBT) |

---

# Chapter 3: The landing page

### Brief

Build a public landing page for **rms.pln.ng**, shown at `/` to signed-out visitors. Today they see only the sign-in form. Signed-in schools still go straight to Result batches, and the installed app opens straight to the workspace.

Its jobs, in order:
1. **Make a school owner or exam officer understand in 5 seconds:** "Open my result sheet, get printed report cards tonight, even with no light or data."
2. **Get schools not on ParaLearn to create an account** and try it with their real sheet or our template.
3. **Let existing ParaLearn schools sign in** without reading any marketing.

> ### 🔎 Research first
> Before designing, **search online for the best landing pages for report-card, result-processing and school-management products**, and for offline-first or "works without internet" apps. Study:
> - how they show the output (the report card itself);
> - how they explain offline use;
> - how they handle "upload your file" products.
>
> Good starting points:
> - **School result and report-card software:** Nigerian and African school-management products, and international ones (search terms like "report card generator", "school result software Nigeria", "school management system Nigeria").
> - **File-to-document tools:** products that turn a spreadsheet into documents (mail-merge, certificate and invoice generators). They are good at "drop your file, get output".
> - **Offline-first products:** apps that market working without internet, to see how they make that believable.
> - **Galleries:** Land-book, Lapa Ninja, Godly, SaaS Landing Page, searching "education", "school", "documents".
>
> Collect 5–10 references and note what each does well. Then **adapt the patterns to ParaLearn's design system** (Chapter 2) and Nigerian school realities. **Do not copy any page's layout, copy, illustrations or branding.**

### Design rules for the landing page

As in `DESIGN.md`, the landing page may use:
- The `--grad-primary` gradient (`#641bc4 → #9747ff`) as an ambient background only.
- **Outfit** for the hero headline only.
- Larger type and more white space.

Everything else in Chapter 2 still applies.

**The hero visual must be a real report card.** A sample card generated by the app itself, with a sample school and realistic Nigerian names, is the most persuasive thing we can show.

**Performance and visibility:**
- **Light and fast:** under 1 MB, no video autoplay, images with sizes set.
- **It must work offline too:** once installed, the landing page should not block the app.
- **It must be indexable:** today the whole rms.pln.ng host is `noindex`. The landing page needs its own metadata. Add a `rms` entry to `src/lib/seo/siteConfig.ts`, as CBT has, and keep the signed-in workspace `noindex`.

### Sections

#### 1. Header
- **Left:** logo + "Results".
- **Links:** How it works · Features · For schools on ParaLearn · Pricing · FAQ.
- **Right:** **Sign in** (secondary) and **Create a school account** (primary).
- **Mobile:** logo, Sign in, menu.

#### 2. Hero
- **Headline direction** (to refine; outcome first):
  - "Your result sheet in. Printed report cards out. No internet needed."
  - "Report cards tonight, even when NEPA takes the light."
- **Subline:** one sentence. Open the Excel sheet you already use; every total, grade and position is worked out; print a booklet per class; the scores reach ParaLearn when you're back online.
- **CTAs:** **Create a free school account** (or the real pricing wording) and **Already on ParaLearn? Sign in**.
- **Visual:** a real report card (front page) beside the app's batch view.
- **A small trust line:** "Works offline · Your own logo and colours · Grades and positions worked out for you".

#### 3. The problem we are solving
This is the heart of the page. Make it concrete and local: a principal, proprietor or exam officer should recognise their own end of term. Use 5–6 short problem statements, or a Before / After comparison, each paired with how ParaLearn Results answers it.

| The problem today | How ParaLearn Results answers it |
|---|---|
| **End of term means late nights of calculation.** Teachers and exam officers add up CA and exam scores, work out averages and rank every class by hand or with fragile spreadsheet formulas. One wrong cell changes a child's position. | Open the sheet you already keep. Every total, grade, average, subject position and class position is worked out in seconds, with ties handled properly (1st, 2nd, 2nd, 4th). |
| **Report cards are typed one by one.** Copying each student's scores into a Word template, then printing, takes days for a few hundred students, and every copy is a chance for error. | One click draws a professional A4 card for every student, one booklet per class. About 1,000 cards in under ten seconds on a normal laptop. |
| **Power and internet fail exactly when results are due.** Online result systems stop working in a power cut or when data runs out, and that is often when the deadline is. | Everything happens on the school's own laptop. After the first sign-in, it works with no internet at all. Scores are sent to ParaLearn automatically when the connection returns. |
| **Mistakes in the sheet are found by parents.** Duplicated names, a letter typed into a score, a missing column: they only surface when a parent complains. | Problems are found before any card is drawn, each with its tab and row ("JSS 1A · row 14: "abc" in Mathematics isn't a number"). Serious problems stop the batch until they're fixed. |
| **Cards don't look official.** Home-made templates vary from term to term and from class to class, and they don't carry the school's identity well. | Every card carries the school's name, motto, logo and colour, the same grading key, attendance, behaviour ratings and signature spaces, every term. |
| **Results are trapped in spreadsheets.** Scores never reach a proper record, so the next term starts from scratch and nothing can be looked up later. | Scores are backed up to the school's ParaLearn account, where they can feed full report cards, transcripts and analysis later. |
| **School software is a big commitment.** Full school-management systems need weeks of set-up, training and money before a single report card comes out. | Create an account in a minute and use the sheet you already have. If you don't have one, download our template built for your classes and subjects. |

Add a closing line under the table: *keep your sheet, keep your process; just get the cards out faster and right.*

#### 4. How it works
Three steps with small screenshots:
1. **Open your result sheet:** Excel with one tab per class, or our CSV template.
2. **Check and generate:** problems listed by tab and row; report cards drawn class by class.
3. **Print and send:** download each class booklet; scores go to ParaLearn when online.

Below the steps: "What should my sheet look like?", a simple diagram of the Excel layout, and a link to download a sample sheet.

#### 5. See the report card
- **A large, zoomable sample card,** with call-outs on its parts: school header, student details, subject table with positions, class average, highest and lowest; summary; behaviour; attendance; grading key; comments with signature lines.
- **A row of the card in 3–4 school colours** to show the branding. Use colours that pass the school colour rule.

#### 6. Built for Nigerian schools
A band covering:
- **Works offline.** Installed like an app; no data needed after sign-in.
- **The terms and sessions Nigerian schools use:** First, Second, Third Term; 2026/2027.
- **Grading bands** (A–F with remarks).
- **Ties handled the way schools expect.**
- **Default teacher's and principal's comments** when the sheet has none.
- **Admission numbers keep their leading zeros.**
- **CSV templates** that open in Excel or Google Sheets.

#### 7. Your data, your school
A short, factual list. **Do not overclaim.**
- Results are worked out **on your own laptop**; the sheet itself is never uploaded.
- Only scores are sent, and only to your school's own ParaLearn account.
- Cards stay on the laptop that made them. Download booklets to keep copies.

#### 8. For schools already on ParaLearn
- One paragraph: sign in with your existing ParaLearn account; your school's name, logo and colour are filled in for you; scores go to your ParaLearn records.
- One button: **Sign in**.
- Link to ParaLearn CBT for computer-based exams. Results and CBT are sister products.

#### 9. Pricing
State the real current pricing. **Confirm with the team before publishing.** If it's free during a pilot, say so plainly, with what happens after.

#### 10. Testimonials or pilot results
Only real quotes from real schools, with name, role, school and permission. Leave the section out until we have them.

#### 11. FAQ
Accordion, 6–8 questions. For example:
- Does it really work without internet?
- What should my result sheet look like?
- Can I use my own school logo and colours?
- How are positions and grades worked out?
- What if my school uses a 3rd CA?
- Where are my report cards stored?
- Can two laptops share the same batches?
- How much does it cost?

Answer the hard ones honestly. For example: batches stay on the laptop that made them, and ParaLearn stores 1st CA, 2nd CA and Exam.

#### 12. Final call to action
A full-width band (the gradient is allowed here as a background):
- "Get this term's report cards out tonight."
- **Create a school account** and **Sign in**.

#### 13. Footer
- ParaLearn logo.
- Links: Results home, Sign in, Create a school account, CSV template help, ParaLearn (pln.ng), ParaLearn CBT (cbt.pln.ng), SabiNote, privacy, terms, contact (WhatsApp and email).
- Social links.
- © year ParaLearn.

### Landing page acceptance checklist
- [ ] Signed-in schools and the installed app go straight to Result batches, never through the landing page.
- [ ] Sign in and Create a school account are visible without scrolling at 360×640 and 1366×768.
- [ ] The sample report card is a real output of the app (not a mock-up).
- [ ] Every claim is true of the shipped product, including the offline and storage limits.
- [ ] The landing page is indexable; the workspace stays `noindex`.
- [ ] Lighthouse: Performance ≥90 on mobile, Accessibility 100, SEO 100. Page weight under 1 MB.
- [ ] Uses the shared ParaLearn tokens and components. The only extras are the hero gradient and Outfit.

---

# Appendix: Suggested order of work

1. **Report card first.**
   - Apply the school colour rule.
   - Check the card in greyscale.
   - Decide on embedding a font for Yoruba and Igbo names.
   - Add the stamp and "next term begins" spaces.

   It's what parents see.
2. **Shared tokens.**
   - Apply the token snippet (2.2) and the Geist Mono fix. Do this together with the CBT guide's token step, so both products change at once.
   - Remove hard-coded colours and inline styles.
3. **Shared components:**
   - Status badge.
   - Confirmation dialog.
   - Notice.
   - Inline field errors.
   - Drop zone.
   - Tabs with overflow.
4. **Screens:**
   1. Home: lead with the upload, add sheet-layout help and a sample sheet.
   2. Batch view: preview fallback, keyboard rows, download all, print, dropped-column message.
   3. School profile: full-card preview, colour presets.
   4. CSV template.
   5. Sign in.
5. **Landing page,** last, so it can show the redesigned card and screens.

Each step must keep every feature and state in Chapter 1 and pass the accessibility checklist in 2.11.
