"use client";

import React from "react";
import {
  ArrowRight,
  FileSpreadsheet,
  LogIn,
  Plus,
  WifiOff,
} from "lucide-react";
import { Brand } from "./Brand";
import "./rms-workspace.css";
import "./rms-landing.css";

/**
 * Public landing page for rms.pln.ng, shown to signed-out visitors.
 * Design: design-guide/stitch/landing-7-visual-first-hero (see design-guide/stitch/SELECTION.md).
 * Every claim here is checked against the code: grading.ts (A to F bands, shared positions),
 * parseWorkbook.ts (one tab per class, Teacher Data tab), reportCardPdf.ts (one A4 page per
 * student, one booklet per class, Noto for Yoruba and Igbo letters), k12.ts (scores sent when online).
 */

/* Sample data: a made-up school. Totals, grades and positions follow the app's own rules. */
const SHEET = [
  { name: "Chiamaka Okafor", ca1: 19, ca2: 18, exam: 54 },
  { name: "Ọlá Adébáyọ", ca1: 18, ca2: 17, exam: 52, you: true },
  { name: "Ngozi Eze", ca1: 16, ca2: 15, exam: 47 },
  { name: "Musa Ibrahim", ca1: 12, ca2: 14, exam: 40 },
];

const CARD_ROWS = [
  { subject: "Mathematics", ca1: 18, ca2: 17, exam: 52, total: 87, grade: "A", pos: "2nd" },
  { subject: "English Language", ca1: 15, ca2: 16, exam: 44, total: 75, grade: "A", pos: "5th" },
  { subject: "Civic Education", ca1: 16, ca2: 15, exam: 47, total: 78, grade: "A", pos: "3rd" },
  { subject: "Basic Science", ca1: 14, ca2: 12, exam: 38, total: 64, grade: "B", pos: "9th" },
];

const FAQ = [
  {
    q: "Do we need internet?",
    a: "Only once, to sign in or create your school account. After that you can open result sheets and print report cards with no internet. Scores are sent to ParaLearn the next time the laptop is online.",
  },
  {
    q: "What kind of result sheet can we use?",
    a: "An Excel file (.xlsx or .xls) or a CSV, with one tab per class and 1st CA, 2nd CA and Exam columns under each subject. Inside the app there is a template you can download and fill in.",
  },
  {
    q: "How are grades and positions worked out?",
    a: "Each subject is out of 100: A is 70 to 100, B 60 to 69, C 50 to 59, D 45 to 49, E 40 to 44 and F below 40. Students with the same score share a position, so two second places are followed by fourth.",
  },
  {
    q: "Can the card show comments, behaviour and attendance?",
    a: "Yes. Add a Teacher Data tab to the sheet with ratings, attendance and the class teacher's comment. Where a comment is left blank, one is written from the student's average.",
  },
  {
    q: "Will names with Yoruba or Igbo letters print correctly?",
    a: "Yes. Letters such as ọ, ẹ, ṣ and á print as they are typed in the sheet.",
  },
  {
    q: "Can we use our own colour and logo?",
    a: "Yes. Set your school name, motto, logo and colour once. If the colour is too light to read, the text on the card is printed in a darker shade of it.",
  },
];

/** A small A4 report card drawn in HTML, laid out like the PDF the app prints */
function CardMock({ full = false }: { full?: boolean }) {
  return (
    <figure className={`rl-card${full ? " is-full" : ""}`} aria-label="Sample report card">
      <div className="rl-card-bar" />
      <header className="rl-card-head">
        <span className="rl-card-crest" aria-hidden>
          OM
        </span>
        <div>
          <strong>Oakfield Model College</strong>
          <em>Knowledge and Service</em>
          <small>14 Ring Road, Ibadan</small>
        </div>
        <span className="rl-card-title">
          Report card
          <b>First Term</b>
          <small>2026/2027</small>
        </span>
      </header>
      <dl className="rl-card-strip">
        <div>
          <dt>Student</dt>
          <dd>Ọlá Adébáyọ</dd>
        </div>
        <div>
          <dt>Class</dt>
          <dd>JSS 1 Gold</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd className="rl-num">2nd of 41</dd>
        </div>
        <div>
          <dt>Average</dt>
          <dd className="rl-num">76.0%</dd>
        </div>
      </dl>
      <table className="rl-card-table">
        <thead>
          <tr>
            <th scope="col">Subject</th>
            <th scope="col">1st CA</th>
            <th scope="col">2nd CA</th>
            <th scope="col">Exam</th>
            <th scope="col">Total</th>
            <th scope="col">Grade</th>
            <th scope="col">Pos.</th>
          </tr>
        </thead>
        <tbody>
          {CARD_ROWS.map((r) => (
            <tr key={r.subject}>
              <th scope="row">{r.subject}</th>
              <td>{r.ca1}</td>
              <td>{r.ca2}</td>
              <td>{r.exam}</td>
              <td>
                <b>{r.total}</b>
              </td>
              <td>
                <b>{r.grade}</b>
              </td>
              <td>{r.pos}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {full && (
        <div className="rl-card-lower">
          <dl className="rl-card-tiles">
            <div>
              <dt>Total</dt>
              <dd className="rl-num">304 / 400</dd>
            </div>
            <div>
              <dt>Grade</dt>
              <dd>A</dd>
            </div>
            <div>
              <dt>Class average</dt>
              <dd className="rl-num">61.8%</dd>
            </div>
          </dl>
          <div className="rl-card-split">
            <div>
              <h4>Behaviour</h4>
              <p>
                Punctuality <b>5</b>
              </p>
              <p>
                Neatness <b>4</b>
              </p>
              <p>
                Attendance <b className="rl-num">58 / 60 days</b>
              </p>
            </div>
            <div>
              <h4>Grading key</h4>
              <p className="rl-num">A 70–100 · B 60–69 · C 50–59</p>
              <p className="rl-num">D 45–49 · E 40–44 · F 0–39</p>
            </div>
          </div>
          <div className="rl-card-comments">
            <div>
              <h4>Class teacher</h4>
              <p>An excellent result. Keep up the hard work.</p>
            </div>
            <div>
              <h4>Principal</h4>
              <p>Outstanding performance. Well done.</p>
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}

/** The class result sheet as a teacher fills it in Excel */
function SheetMock() {
  return (
    <div className="rl-sheet" aria-label="Sample result sheet">
      <div className="rl-sheet-file">
        <FileSpreadsheet size={16} aria-hidden />
        <span>First term results.xlsx</span>
      </div>
      <table>
        <thead>
          <tr className="rl-sheet-subject">
            <th scope="col" />
            <th scope="colgroup" colSpan={3}>
              Mathematics
            </th>
          </tr>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">1st CA</th>
            <th scope="col">2nd CA</th>
            <th scope="col">Exam</th>
          </tr>
        </thead>
        <tbody>
          {SHEET.map((s) => (
            <tr key={s.name} className={s.you ? "is-you" : undefined}>
              <th scope="row">{s.name}</th>
              <td>{s.ca1}</td>
              <td>{s.ca2}</td>
              <td>{s.exam}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rl-sheet-tabs" aria-hidden>
        <span className="is-on">JSS 1 Gold</span>
        <span>JSS 1 Blue</span>
        <span>JSS 2 Gold</span>
        <span>Teacher Data</span>
      </div>
    </div>
  );
}

export default function Landing({ onSignIn, onCreate }: { onSignIn: () => void; onCreate: () => void }) {
  const year = new Date().getFullYear();
  return (
    <div className="rms-surface rms-landing">
      <a className="rl-skip" href="#rl-main">
        Skip to content
      </a>
      <header className="rl-nav">
        <div className="rl-wrap rl-nav-inner">
          <a href="#rl-top" className="rl-brand-link" aria-label="ParaLearn Results, back to top">
            <Brand />
          </a>
          <nav aria-label="On this page" className="rl-nav-links">
            <a href="#how">How it works</a>
            <a href="#card">The report card</a>
            <a href="#offline">Offline</a>
            <a href="#faq">Questions</a>
          </nav>
          <div className="rl-nav-actions">
            <button type="button" className="rms-button quiet" onClick={onSignIn}>
              Sign in
            </button>
            <button type="button" className="rms-button primary rl-nav-create" onClick={onCreate}>
              Create school account
            </button>
          </div>
        </div>
      </header>

      <main id="rl-main">
        <section className="rl-hero" id="rl-top" aria-labelledby="rl-title">
          <div className="rl-wrap">
            <h1 id="rl-title">
              Turn your Excel marks into report cards, <span>even without internet.</span>
            </h1>
            <p className="rl-lede">Open the class result sheet on your laptop. Print a graded, ranked A4 card for every student.</p>
            <div className="rl-cta">
              <button type="button" className="rms-button primary rl-big" onClick={onCreate}>
                Create school account
                <ArrowRight size={17} aria-hidden />
              </button>
              <button type="button" className="rms-button rl-big" onClick={onSignIn}>
                <LogIn size={17} aria-hidden />
                Sign in
              </button>
            </div>
            <p className="rl-hint">
              <WifiOff size={15} aria-hidden />
              Sign in once. After that, no internet needed.
            </p>

            <div className="rl-stage">
              <SheetMock />
              <span className="rl-arrow" aria-hidden>
                <ArrowRight size={20} />
              </span>
              <CardMock />
            </div>
          </div>
        </section>

        <section className="rl-section rl-problems" aria-labelledby="rl-problems-title">
          <div className="rl-wrap">
            <h2 id="rl-problems-title">Made for the week before report cards go home.</h2>
            <ul className="rl-swaps">
              <li>
                <span className="rl-old">No light, no data</span>
                <ArrowRight size={16} aria-hidden className="rl-swap-arrow" />
                <div>
                  <strong>Works on the laptop, offline</strong>
                  <p>Sign in once. Everything after that runs without internet.</p>
                </div>
              </li>
              <li>
                <span className="rl-old">Broken formulas</span>
                <ArrowRight size={16} aria-hidden className="rl-swap-arrow" />
                <div>
                  <strong>Totals, grades and positions done for you</strong>
                  <p>Problems in the sheet are listed with their row, so teachers can fix them.</p>
                </div>
              </li>
              <li>
                <span className="rl-old">Typing scores twice</span>
                <ArrowRight size={16} aria-hidden className="rl-swap-arrow" />
                <div>
                  <strong>Scores reach ParaLearn on their own</strong>
                  <p>When the laptop is back online, the scores are sent to your school&apos;s account.</p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section className="rl-section" id="how" aria-labelledby="rl-how-title">
          <div className="rl-wrap">
            <h2 id="rl-how-title">Three steps.</h2>
            <ol className="rl-steps">
              <li>
                <span className="rl-step-num">1</span>
                <h3>Open your result sheet</h3>
                <p>Excel or CSV, one tab per class.</p>
              </li>
              <li>
                <span className="rl-step-num">2</span>
                <h3>Work out results</h3>
                <p>Totals, A to F grades, subject and class positions.</p>
              </li>
              <li>
                <span className="rl-step-num">3</span>
                <h3>Print the booklet</h3>
                <p>One PDF per class, one A4 page per student.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="rl-section rl-showcase" id="card" aria-labelledby="rl-card-title">
          <div className="rl-wrap rl-showcase-grid">
            <div>
              <h2 id="rl-card-title">The card parents will keep.</h2>
              <ul className="rl-ticks">
                <li>Your school&apos;s name, logo and colour</li>
                <li>Position in every subject and in the class</li>
                <li>Class average, highest and lowest score</li>
                <li>Behaviour, attendance and comments</li>
                <li>Names spelt right, accents included</li>
              </ul>
            </div>
            <CardMock full />
          </div>
        </section>

        <section className="rl-section" id="offline" aria-labelledby="rl-offline-title">
          <div className="rl-wrap rl-pair">
            <div className="rl-panel">
              <WifiOff size={20} aria-hidden />
              <h2 id="rl-offline-title">No internet? Keep working.</h2>
              <p>After you sign in, the app and your result batches stay on the laptop. Open it with no data, or install it from the browser like any other app.</p>
            </div>
            <div className="rl-panel">
              <LogIn size={20} aria-hidden />
              <h2>Already on ParaLearn?</h2>
              <p>Sign in with your school&apos;s ParaLearn account. Your name, colour and logo are filled in, and scores go to the same account.</p>
              <button type="button" className="rms-button" onClick={onSignIn}>
                Sign in
                <ArrowRight size={15} aria-hidden />
              </button>
            </div>
          </div>
        </section>

        <section className="rl-section" id="faq" aria-labelledby="rl-faq-title">
          <div className="rl-wrap rl-faq">
            <h2 id="rl-faq-title">Questions schools ask.</h2>
            <div>
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="rl-band" aria-labelledby="rl-band-title">
          <div className="rl-wrap rl-band-inner">
            <h2 id="rl-band-title">Get this term&apos;s report cards done.</h2>
            <div className="rl-cta">
              <button type="button" className="rms-button rl-big rl-on-dark" onClick={onCreate}>
                <Plus size={17} aria-hidden />
                Create school account
              </button>
              <button type="button" className="rms-button quiet rl-big rl-on-dark-quiet" onClick={onSignIn}>
                Sign in
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="rl-foot">
        <div className="rl-wrap rl-foot-inner">
          <span>&copy; {year} ParaLearn Results</span>
          <nav aria-label="Footer">
            <button type="button" className="rl-foot-link" onClick={onSignIn}>
              Sign in
            </button>
            <a href="https://cbt.pln.ng" rel="noopener">
              ParaLearn CBT
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
