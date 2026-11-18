# Which Stitch screen to build from

Reviewed 18 Nov 2026 against `../CBT_DESIGN_GUIDE.md`. Every screen was rendered at 1440px and checked by eye, then searched for the patterns the guide bans.

Where Stitch made more than one version of a page, one is picked below. Build from the **picked** file only. The other versions are kept for reference.

## Picks

| Page | Build from | Not this | Why the pick wins |
|---|---|---|---|
| Public landing (`/take`, cbt.pln.ng) | `paralearn-cbt-public-landing-visual-hero-redesign` | the original (`...-entrance`); `...-entrance-redesigned` | Chosen by the product owner. It is the Redesigned page (code box under the headline, then a live exam-room preview) with a stronger hero: a soft violet wash, a faint dot grid and two floating status cards. Build it without the gradient text (use solid violet for "never fail") and with honest copy in the floating cards. |
| Examinations dashboard (`/`) | `examinations-dashboard-refactored` | `examinations-dashboard` | In the original, the filter tabs are cut off ("Close…") and "All exams" breaks onto two lines. The Monitor button's label also can't be read. In the refactored version the tabs get their own row with all five showing, and each row has one clearly labelled action: Monitor (Live), Edit Schedule, Publish Exam, Results & Slips. |
| Question Studio | `question-studio-refactored` | `question-studio` | Bulk Import, Rubrics and AI go into one Tools menu, and Publish Exam is next to Save. It adds a check that the rubric marks add up to the question's marks, a toggle between writing LaTeX and previewing it, and up/down controls to reorder questions. |
| Candidates & PINs | `candidates-and-pins-management-refactored` | `candidates-and-pins-management` | Each row shows one labelled action that fits the candidate's state (Copy Link, Print Slip, Re-Arm PIN), where the original shows three unlabelled icons. A locked candidate shows where they stopped ("Stopped at Q.21 (Saved)"). The large three-card guide panel is folded into one line. |
| Candidate Monitor | `candidate-monitor-and-live-invigilation-refactored` | `candidate-monitor-and-live-invigilation` | The hall and essay marking become two tabs, so marking no longer covers the hall in a side panel. It adds a timed event log and per-row +5 mins and Force Submit buttons. See the fixes below; this one needs the most work. |

## Pages with one version

| Page | File | State |
|---|---|---|
| Examiner sign-in (`/cbt/auth`) | `examiner-auth-gateway-cbt-auth` | Good base: a clear form, plus a separate "Are you a candidate?" box. Cut the security filler: "CBT Gate Node", the TLS cipher line, the IP address, "TRCN & WAEC Identity Compliant". |
| Exam lobby (`/take/[code]`) | `candidate-exam-lobby-take-code` | Good base: a three-step progress bar, PIN boxes, sections and the rule on tab switches. Remove "Biometrics match… pre-cleared", "Generator Inverter: Online", the local server IP and the three status cards. Candidates don't need them, and the app can't measure them. |
| Live exam room | `live-examination-room-take-code-live` | Layout is right (question, navigator, flag, timer) but **the fonts are broken**: the page has no default font, so it shows in Times. It is also branded "Unified Tertiary CBT" instead of ParaLearn. Use the layout only. Remove the SHA-256 line, the "Hall Proctor Telemetry" panel and the scratchpad unless we build them. |
| Result slip | `official-candidate-result-slip-take-code-results` | **Broken in Stitch itself**: its own screenshot shows unstyled text. Regenerate it in Stitch before anyone uses it. |

## Fixes to make while building the picks

These apply to every page.

1. **Fonts and icons.** Use Geist Mono, not JetBrains Mono, and lucide icons, not Material Symbols, which is what the app already uses. Stitch also loads Tailwind from its CDN; rebuild in the app's own components and `cbt-workspace.css` tokens instead.
2. **Remove claims we can't back up**, or replace them with real numbers before launch:
   - "Trusted by 420+ Nigerian schools", "185,000 completed sessions" and the school name strip;
   - "never fail", "Zero lost answers", "0ms answer loss";
   - "SHA-256 cryptographic" slips, "Certified PLN-SECURE", "West Africa Certified", "TRCN Compliance";
   - "Cloud Synced · Offline Cache Active", "LAN Relay Synced", "Sync Lag: 18ms", "Socket: Connected".

   The guide's rule: every claim on the page must be true on the day it ships.
3. **Drop tech labels.** "IndexedDB", "Offline Sync Engine v4.2", "HIGH-FRICTION INFRASTRUCTURE" and the mono labels above each section speak to engineers, not to a vice principal. Say what the user gets ("Answers are saved on the computer, even if the network drops").
4. **Monitor, specifically:**
   - The event log uses coloured left-edge stripes, which are banned; use a tinted background or a small coloured dot instead.
   - The table is too cramped: the timer column wraps to five lines. Give it the full width and put the event log below it or in a narrower column.
   - "Force Submit All" sits in the header next to Download CSV. Move it into a menu and ask for confirmation.
5. **Show the maths properly.** The Monitor's essay text and the landing preview show raw LaTeX (`\(ax^2 + bx\)`, `$x$`). Render it with KaTeX, as the app does.
6. **Dashboard header.**
   - It has both "New Exam" and "+ Create exam"; keep one.
   - The plus icon and a "+" in the label appear together; keep the icon only.
   - Action buttons wrap onto two lines ("Monitor / (Live)"); keep them to one line.
   - The logo image link is broken in every examiner screen; use the real logo.
7. **Stat-card rows** (four big numbers across the top of the dashboard, Candidates and Monitor) are a stock pattern. Keep them on the Monitor, where the numbers change live. On the dashboard and Candidates pages, fold the counts into the filter tabs, which already show them (All 14, Open 4…).
