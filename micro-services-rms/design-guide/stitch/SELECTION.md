# Which Stitch screen to build from (ParaLearn Results)

Reviewed 18 Nov 2026 against `../RMS_DESIGN_GUIDE.md`. Source: Stitch project "ParaLearn Results" (14 screens). Every screen was rendered at 1440px and checked by eye.

## Landing page: seven versions, one pick

The seven landing files are one chain of revisions, oldest first. Each prompt is in `screens.json`.

| File | State | Verdict |
|---|---|---|
| `landing-7-visual-first-hero` | Latest. Made after the feedback "there's still a lot of texts": a short page, one big product visual (spreadsheet in, A4 card out), three-step rows, one pricing block, a violet closing band. | **Build from this.** |
| `landing-6-elevated-hero-showcase` | The same family, but with long paragraphs, testimonials and a full footer. | Not this: the text it was revised to remove. |
| `landing-5-6e1801` | Broken in Stitch: renders as unstyled text. | Not usable. |
| `landing-4-d90b88` | A long, text-heavy page with invented testimonials. | Not this. |
| `landing-3-2f93a6` | A dark "obsidian" theme whose fonts fail (it shows in Times). Off-brand for ParaLearn's light workspace. | Not this. |
| `landing-2-ef301f` | It mixes dark, cream and violet sections, and is the longest (8,800px). | Not this. |
| `landing-1-1646c8` | The first draft: long, with a wall of text. | Not this. |

## App screens (one version each)

Every app screen has the same font fault: the headings fall back to Times. Use their layouts, not their type.

| Screen | File | Use |
|---|---|---|
| Sign in | `sign-in` | A centred card with Sign in / Create school account tabs. Drop "Simulate offline", "one-time authentication guarantee", "Forgot password" (no reset flow exists) and the engine ID footer. |
| Result batches | `result-batches` | The drop zone with batch name / term / session and "Work out results", a sheet-format hint, then the batch table (scope, students, cards status, sync status, actions). Drop the four stat tiles and the three feature cards at the bottom. |
| Batch view | `batch-view` | Header with the file name, term and actions; class tabs; the student ledger beside a live card preview, with Print / PDF per student and per class. Drop the four stat tiles, or keep at most one line of facts. |
| School profile | `school-profile` | Grouped sections (identity, logo and colour, next term), with a live header preview beside the form. Drop "SEC-01" codes, "LASUBEB compliant", "Local database active", print margin and luminance tiles, and the signature upload (not built). |
| Result sheet template | `result-sheet-template` | Grouped settings (classes, subjects, score columns, extras) beside a live preview of the sheet. Only offer the options the template generator really supports. |
| A4 report card | `a4-report-card-class-broadsheet` | Visual direction for the PDF: a clearer header, the student strip, the score table, behaviour and the grading key side by side, comments with a stamp space and a "Next term begins" line. The "Class broadsheet" tab doesn't exist; leave it out. |
| Modals and drawers | `modals-drawers` | Pattern for confirmations: a clear title, what will happen, what stays safe, then Cancel and a red action. Apply it to "Delete batch" and "Sign out", which use `window.confirm` today. |

## Fixes for every screen

1. **Fonts and icons.** Use Manrope, Geist Mono for numbers and codes, and lucide icons. Material Symbols are not used in the app.
2. **Claims we can't back up.** Remove these, or replace them with real numbers before launch:
   - performance and engine: "WASM" (the engine is JavaScript in a web worker), "0.08s", "8 seconds", "300 DPI", "40% less toner", "4.2 MB RAM";
   - adoption and accreditation: "240+ schools", "WAEC & NECO compliant", "Ministry certified", "LASUBEB compliant", "NERDC compliant", "Official seal";
   - the status chips: "Connected & Synced", "Zero server latency", "Encrypted device storage".

   Things that are true and worth saying:
   - it works without internet after one sign-in;
   - work happens on the laptop;
   - scores go to ParaLearn when online;
   - it uses the school's own colour and logo;
   - one A4 card per student, with one booklet PDF per class;
   - names in Yoruba and Igbo print with their accents.
3. **Pricing and testimonials.** The guide says pricing must be confirmed with the team before it's published, and testimonials must be real. Both stay off the landing page until then.
4. **Stat-tile rows** are a stock pattern; prefer one line of facts.
