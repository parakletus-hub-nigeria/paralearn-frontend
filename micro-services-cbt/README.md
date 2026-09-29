# ParaLearn Autonomous CBT Microservice (`micro-services-cbt`)

This repository contains the standalone, autonomous Computer-Based Testing (CBT) microservice for **ParaLearn**. It provides a dual-access architecture serving both institutional schools via SSO and independent exam halls (tutorial centres, private tutors, and academies) with free credits.

---

## Architecture Overview

```
micro-services-cbt/
├── frontend/                                   # Standalone Next.js 16 UI
│   ├── src/
│   │   ├── app/
│   │   │   ├── cbt/                            # CBT Hub Overview & Workspace Gateway
│   │   │   │   ├── auth/page.tsx               # Dual-Auth (ParaLearn SSO vs Standalone Hall)
│   │   │   │   └── exams/[examId]/page.tsx     # 2-Pane Question Studio & Exam Manager
│   │   │   └── take/                           # Candidate Assessment Experience
│   │   │       ├── page.tsx                    # Direct Room Access Code Gate
│   │   │       └── [examCode]/
│   │   │           ├── page.tsx                # Candidate Lobby & 6-cell PIN Input
│   │   │           ├── live/page.tsx           # Live Runner (Keyboard hotkeys, Geist Mono timer)
│   │   │           └── results/page.tsx        # Candidate Result Slip & Performance Breakdown
│   │   ├── components/CBT/                     # Clear Register Design System CBT Components
│   │   └── lib/cbtSessionManager.ts            # Offline persistence & cbtApi HTTP client
│
└── backend/                                    # Autonomous NestJS 11 Microservice
    ├── prisma/
    │   └── schema.prisma                       # Autonomous Multi-Tenant CBT Schema
    ├── src/
    │   ├── main.ts                             # Swagger, ValidationPipe, CORS, Port 4000
    │   ├── app.module.ts                       # Root Module connecting all subsystems
    │   ├── prisma/                             # PrismaService & lifecycle hooks
    │   ├── redis/                              # Sub-ms countdown timers & ephemeral answer buffer
    │   ├── workspaces/                         # Multi-tenant workspace abstraction & credit billing
    │   ├── exams/                              # Exam management, room codes, live invigilation board
    │   ├── questions/                          # Question bank studio, bulk creation & XLSX parser
    │   ├── attempts/                           # Live test sessions, Redis buffering, auto-grading
    │   └── sync/                               # ParaLearn Core RMS term report card sync & CSV export
    ├── dist/                                   # Verified production build output (Exit Code 0)
    ├── package.json
    ├── tsconfig.json
    └── .env / .env.example
```

---

## Quickstart

### 1. Backend Service
```bash
cd backend

# Install dependencies (already installed)
npm install

# Run database migrations / client generation
npm run prisma:generate

# Start in development mode (runs on http://localhost:4000)
npm run start:dev

# Interactive API Swagger docs:
http://localhost:4000/api/docs
```

### 2. Frontend Candidate Runner & Educator Studio
```bash
# Set environment variable pointing to the CBT backend:
NEXT_PUBLIC_CBT_API_URL=http://localhost:4000

# Access Candidate Room Gate:
http://localhost:3000/take

# Access CBT Educator Hub & Dual-Auth:
http://localhost:3000/cbt
http://localhost:3000/cbt/auth
```

---

## Key Features

1. **Dual Workspace Model**:
   - `INSTITUTION`: Linked to ParaLearn School via SSO. Scores auto-export into Term Report Cards.
   - `STANDALONE_HALL`: Self-serve accounts for JAMB/WAEC tutors with 30 free test credits.
2. **Sub-Millisecond Timers & Keystroke Buffering**:
   - Live answers are buffered in Redis hash tables (<5ms latency), avoiding database bottlenecks during high-concurrency exams.
   - Graceful in-memory fallback if Redis is temporarily unreachable.
3. **Deterministic Auto-Grading**:
   - Instant calculation for MCQ, True/False, and Multi-Select questions with standard Nigerian WAEC grades (`A1` through `F9`).
4. **Anti-Cheat Malpractice Proctoring**:
   - Tracks tab switching, browser blur, and window resizing with automatic candidate disqualification if limits are exceeded.
5. **Bulk Question Excel Importer**:
   - Native `.xlsx` spreadsheet upload parsing prompts, options, answers, marks, and explanations directly into exams.
