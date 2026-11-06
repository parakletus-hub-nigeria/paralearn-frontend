# ParaLearn Results, offline-first (`micro-services-rms`)

**rms.pln.ng** turns a term's result sheet into printable report cards **on the school's own
laptop, with or without internet**. The only online steps are the first sign-in, or creating an
account, and sending the scores to ParaLearn once a connection is back.

Two kinds of school use it:

- **Schools on ParaLearn K12** sign in with their existing account and open their usual Excel sheet.
- **Schools not on ParaLearn** create a school account here (`POST auth/register-school` on the K12
  backend), download a CSV template built for their classes and subjects, fill it in, and open it.
  Their scores are backed up to their new ParaLearn school the same way.

```
Excel sheet ─► Results worker (SheetJS + results engine) ─► IndexedDB (Dexie)
                                                              │
School profile (logo, colour) ─► PDF worker (pdf-lib) ◄───────┘
                                     │
                           class booklets saved ─► preview / download
                                                              │
                      when online ─► K12 backend: result_up/process-result-sheets
```

## How a batch runs

1. **Sign in once, or create an account** (online). `POST /auth/login` on the K12 backend with the
   school's subdomain; new schools first `POST /auth/register-school`, then sign in. K12 adds a
   number to the address if the one asked for is taken.
   The school name, colour and logo are prefilled from `GET /tenant/by-subdomain/:subdomain`, and
   the school confirms them once.
2. **Open the result sheet** (works offline). The results worker reads the workbook and computes
   every class completely before any card is drawn, because subject and class positions depend on
   the whole class. Blocking problems (no subjects, no score columns) stop the batch; the rest are
   listed as warnings with tab and row.
3. **First card at once, then the rest.** The first student's card is drawn on the main thread in a
   few milliseconds. The PDF worker then generates one booklet per class and saves each to IndexedDB
   as it finishes, so Stop keeps finished classes and Resume carries on.
4. **Sync** (when online). Scores go to `POST result_up/process-result-sheets` as a workbook rebuilt
   from the validated data in the exact layout the K12 parser expects (title rows and admission
   columns removed). K12 files them under the school's current term. Sync runs on load, on
   reconnect, and every minute while scores are waiting. An expired one-hour access token is renewed
   with K12's 7-day refresh cookie.

Measured on a development laptop: reading and computing 80 students takes about 14 ms. 1,000 cards
(20 classes of 50) draw in about 8 s, about 5 MB of PDFs in total. In the browser, the first card
appears about 0.35 s after choosing the sheet.

## The CSV template

Built in the browser from the school's classes, subjects and chosen score columns
(`offline/engine/csvTemplate.ts`). It's one table for the whole school, one row per student:

```
Class,S/N,Student Name,Admission No,Mathematics 1st CA,Mathematics 2nd CA,Mathematics Exam,...,Teacher's Comment,Days Present,Days Opened
JSS 1A,1,Ada Obi,007,15,18,55,...,"Neat, careful work.",60,62
```

`offline/engine/flatSheet.ts` splits it by the Class column into class sheets that go through the same
parser as an Excel result sheet. Problems point at the line in the CSV. The file starts with a UTF-8
BOM so Excel on Windows keeps accents. Cells are read as text, so admission numbers keep their
leading zeros. CSVs saved as Windows-1252 are detected. The same table saved as `.xlsx` is
recognised too.

## The Excel layout

One tab per class (tab name = class name). This is the same layout the K12 backend reads.

| Row | Content |
| --- | --- |
| 1 (or 2, under a title row) | `S/N`, `Name`, optional `Admission No`, then subject names from the next column, merged across their columns |
| next | the score labels under each subject: `1st CA`, `2nd CA`, `Exam` (a `3rd CA` or other columns also count; `Total` is ignored and recalculated) |
| then | one student per row |

An optional **Teacher Data** tab with `Name` (plus optional `Class`), behaviour columns rated 1–5
(a blank rating counts as 5), `Comment`, `Days Present` and `Days Opened` fills those parts of the card.

Rules, all in `offline/engine/grading.ts`: each subject is out of 100. Grades are A 70+, B 60–69,
C 50–59, D 45–49, E 40–44, F below 40. Ties share a position (1, 2, 2, 4). The average counts only the
subjects a student sat; a subject counts as sat if any of its scores is filled. Blank, `-`, `ABS`
and `N/A` mean not sat.

## Code

```
frontend/src/
├── app/result-studio/page.tsx   # the single page served at rms.pln.ng/
├── proxy.ts                     # rms.* hosts -> /result-studio
└── offline/
    ├── engine/     # pure TypeScript: parseWorkbook, computeResults, grading, k12Workbook
    ├── pdf/        # reportCardPdf: the card layout, drawn with pdf-lib and standard fonts
    ├── workers/    # results.worker (Excel), pdf.worker (cards), client (promise wrappers, cancel)
    ├── storage/    # db (Dexie tables), k12 (sign-in, refresh, sync)
    └── ui/         # React screens, generation controller, service worker setup
```

- **Offline loading:** `public/rms-offline-sw.js`, registered only on `rms.*` hosts so it can never
  affect the main ParaLearn app. Pages are network-first with a cached fallback; build files are
  cache-first; `/api/*` is never cached. On the first online visit the page tells the worker every
  file it loaded and starts both Web Workers once, so their files are cached too. Cached files are
  served as fresh `Response`s: Turbopack's workers share one bootstrap file and read their config
  from the URL fragment, which a stored response would overwrite.
- **Fonts:** the PDF uses the built-in Helvetica family, so no font files are needed offline.
  Accents are folded for the PDF (Ọlá prints as Ola), because those fonts cannot draw them.
- **Storage:** IndexedDB database `paralearn-results-offline`. The app asks the browser for
  persistent storage so batches aren't evicted when the disk is low.
- **K12 calls** go through the host's `/api/proxy/*` rewrite (`K12_BACKEND_URL`), so they are
  same-origin and the refresh cookie stays on rms.pln.ng.

## How it is served

Like `micro-services-cbt`, the code lives here but runs inside the main ParaLearn Next.js app.
`@rms/*` resolves to `micro-services-rms/frontend/src/*`. `src/app/result-studio/page.tsx` re-exports
the page, and `src/app/result-studio/layout.tsx` holds its metadata and the install manifest
(`public/rms.webmanifest`). The internal route is `/result-studio`, not `/rms`, because the host
already has `src/app/RMS`, and on Windows the two would be the same folder.

Locally, run `npm run build && npm start` and open `http://rms.localhost:3000`. The service worker is
only registered in production builds, so `npm run dev` doesn't test offline loading.

## Going live

1. Add `rms.pln.ng` to the Vercel project and point a `CNAME` for `rms` at Vercel.
2. No new environment variables: K12 calls use the existing `K12_BACKEND_URL`.

## Not yet

- K12 records only 1st CA, 2nd CA and Exam. Extra score columns print on the cards, and the app says
  they weren't sent to ParaLearn.
- K12 files synced scores under the school's **current** term, not the term picked in the app.
- One laptop's batches aren't shared with another laptop; each keeps its own copy.
