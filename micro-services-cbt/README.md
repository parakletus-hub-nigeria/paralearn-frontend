# ParaLearn Standalone CBT (`micro-services-cbt`)

Frontend for the standalone CBT product served at **cbt.pln.ng**. It is separate from the internal
school CBT (`/RMS/cbt`, `src/components/RMS/CBT`), which runs on the ParaLearn core backend and must not
import anything from here.

The backend lives in its own repository, `paralearn-cbt-backend` (NestJS + Prisma + Redis), and is reached
through `NEXT_PUBLIC_CBT_API_URL`. Its API reference is `API_DOCUMENTATION.md` in that repository.

## Flow

1. An examiner workspace (`/cbt`) creates an exam, adds questions, publishes it and shares the room code.
2. A participant opens `cbt.pln.ng/take`, enters the room code, and lands in the lobby.
3. In the lobby they enter their name (plus optional email/phone). They are not a ParaLearn user: the
   backend records them as a walk-in participant on that exam and issues a participant ID for rejoining.
   Exams with `accessType: ROSTER_ONLY` instead require the PIN the examiner issued.
4. The participant sits the exam (`/take/:code/live`) and gets a result slip (`/take/:code/results`).

## How it is served

The code lives here but runs inside the main ParaLearn Next.js server, so cbt.pln.ng behaves like its own
deployment while sharing the host's build, UI kit (`@/components/ui`) and Redux store.

- `@cbt/*` (tsconfig path) resolves to `micro-services-cbt/frontend/src/*`.
- Host route files under `src/app/cbt`, `src/app/take` and `src/app/api/cbt` are one-line re-exports of
  the pages here. Route segment config (e.g. `maxDuration`) stays in the host file, since Next.js reads it
  statically.
- `src/proxy.ts` in the host mounts `cbtProxy` from `frontend/src/proxy.ts`, which rewrites
  `cbt.pln.ng/*` to `/cbt/*` and lets `/take/*` and `/api/*` pass through.
- The host store registers `cbtMicroserviceApi` from `frontend/src/store`.
- AI question generation and essay grading (`app/api/cbt/ai/*`) use their own Gemini key,
  `CBT_GEMINI_API_KEY` (plus optional `CBT_GEMINI_MODEL`), separate from the main app's key. Both are
  server-side only; never prefix them with `NEXT_PUBLIC_`.

```
frontend/src/
├── app/            # Page and route implementations (cbt/, take/, api/cbt/ai/)
├── components/CBT/ # Standalone CBT screens and modals
├── lib/            # cbtSessionManager: local session persistence for participants and examiners
├── store/          # cbtMicroserviceApi: RTK Query client for the CBT backend
└── proxy.ts        # cbt.pln.ng subdomain routing
```

To add a page: create it under `frontend/src/app/...`, then add a host route file at the matching path in
`src/app/...` containing `export { default } from "@cbt/app/...";`.
