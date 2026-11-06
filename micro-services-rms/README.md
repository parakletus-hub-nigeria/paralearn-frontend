# ParaLearn Result Management (`micro-services-rms`)

Frontend for the standalone result-processing product at **rms.pln.ng**. A school uploads a term's
Excel result sheet; the RMS backend totals, grades and ranks every student, then renders each one into
the school's report-card template. The school downloads cards per student or as a class booklet.

It is separate from the ParaLearn core app's school pages (`/RMS`, `src/components/RMS`) and must not
import anything from them.

The backend is its own repository, `paralearn-rms-backend` (NestJS + Prisma + BullMQ workers). It owns
parsing, grading, rendering and the multi-instance scaling of the render workers.

## Pages

| rms.pln.ng URL      | Page                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `/auth`             | Sign in, or create a school workspace                                |
| `/`                 | Upload a result sheet; list of past uploads ("batches") with status  |
| `/batches/:id`      | Live progress, problems found in the sheet, per-class results, PDFs  |
| `/settings`         | School profile printed on every card (name, logo, motto, colour)     |

A batch goes `UPLOADED` → `PARSING` → `PARSED` (held for review) or straight to `RENDERING` →
`COMPLETED` / `COMPLETED_WITH_ERRORS`. A sheet with an error-level problem goes to `FAILED`. The batch page polls every 2 seconds while a batch is active.

## How it is served

The code lives here but runs inside the main ParaLearn Next.js server, like `micro-services-cbt`.

- `@rms/*` (tsconfig path) resolves to `micro-services-rms/frontend/src/*`.
- Pages live under the internal prefix `/result-studio`, not `/rms`: the host already has `src/app/RMS`,
  and on Windows `rms` and `RMS` are the same folder.
- `src/proxy.ts` in the host sends `rms.*` hosts to `rmsProxy` (`frontend/src/proxy.ts`), which rewrites
  `rms.pln.ng/x` to `/result-studio/x` and lets `/api/*` and static files through.
  `useRmsHref()` (`lib/rmsPaths.ts`) builds links that are short on rms.pln.ng and prefixed elsewhere.
- Host route files under `src/app/result-studio` and `src/app/api/rms` are one-line re-exports of the
  files here. Route segment config (`dynamic`, `maxDuration`) stays in the host file.
- The host store registers `rmsApi` from `frontend/src/store`.

## Talking to the backend

The browser never calls the backend directly and never sees the token:

- `/api/rms/session/login|signup` forward to the backend's `/auth/*`, keep `accessToken` in the
  httpOnly cookie `rms_session` (path `/api/rms`), and return the rest of the body. `/logout` clears it.
- `/api/rms/<anything>` forwards to `RMS_API_URL/<anything>` with `Authorization: Bearer <cookie>`. It
  streams uploads and downloads and passes redirects through, so the backend can answer PDF requests
  with a redirect to a short-lived blob-storage URL. That is preferred for class booklets, which can be
  larger than Vercel's 4.5 MB response limit.
- PDF and sample-sheet downloads are plain links, so the cookie rides along on navigation.

Uploads pass through the web server, so the page rejects files over 4 MB (Vercel's request limit is
4.5 MB). Result sheets without embedded images are far smaller.

## Environment

| Variable      | Where             | Example                         |
| ------------- | ----------------- | ------------------------------- |
| `RMS_API_URL` | server-side only  | `https://<rms-backend-host>`    |

Local development defaults to `http://localhost:8080` (the backend's docker compose port). Open `http://rms.localhost:3000`; browsers resolve
`*.localhost` to your machine without any hosts-file change.

## Going live on rms.pln.ng

1. Add `rms.pln.ng` as a domain on the Vercel project and point a `CNAME` for `rms` at Vercel.
2. Set `RMS_API_URL` in the Vercel project's environment variables.
