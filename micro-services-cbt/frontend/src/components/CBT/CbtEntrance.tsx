"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, KeyRound, Loader2 } from "lucide-react";
import CbtBrand from "./CbtBrand";
import "./cbt-workspace.css";
import "./cbt-entrance.css";

export default function CbtEntrance() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  return (
    <div className="cbt-surface cbt-entrance">
      <header className="cbt-entrance-header">
        <CbtBrand />
        <Link href="/cbt/auth" className="cbt-button">
          Examiner sign in
          <ArrowUpRight size={15} />
        </Link>
      </header>
      <main>
        <section className="cbt-gate">
          <div className="cbt-gate-heading">
            <span className="cbt-eyebrow">Computer-based examinations</span>
            <h1>ParaLearn CBT</h1>
            <p>Your next examination starts here.</p>
          </div>
          <form
            className="cbt-code-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!code.trim() || joining) return;
              setJoining(true);
              router.push(
                `/take/${encodeURIComponent(code.trim().toUpperCase())}`,
              );
            }}
          >
            <label htmlFor="candidate-exam-code">Exam access code</label>
            <div className="cbt-code-input">
              <KeyRound size={20} aria-hidden="true" />
              <input
                id="candidate-exam-code"
                required
                maxLength={80}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Enter your exam code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </div>
            <button
              className="cbt-button primary"
              disabled={!code.trim() || joining}
              type="submit"
            >
              {joining ? "Opening lobby..." : "Continue to examination"}
              {joining ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <ArrowRight size={17} />
              )}
            </button>
            <p>
              No student account required. Have your exam code and candidate
              details ready.
            </p>
          </form>
          <ol className="cbt-candidate-steps" aria-label="Candidate journey">
            <li aria-current="step">
              <span>1</span>Exam code
            </li>
            <li>
              <span>2</span>Your details
            </li>
            <li>
              <span>3</span>Examination
            </li>
          </ol>
        </section>
        <section className="cbt-examiner-entry">
          <div>
            <span className="cbt-eyebrow">
              For educators and examination centres
            </span>
            <h2>A dedicated space for your examinations.</h2>
            <p>
              Prepare questions, publish an exam, and follow candidate progress
              from your examiner workspace.
            </p>
            <Link href="/cbt/auth" className="cbt-button">
              Open examiner workspace
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="cbt-entry-links">
            <Link href="/cbt/auth">
              <span>
                <strong>Independent examiners</strong>
                <small>Manage your examination workspace</small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
            <Link href="/cbt/api-docs">
              <span>
                <strong>Developers</strong>
                <small>Connect your application to ParaLearn CBT</small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="cbt-entrance-footer">
        <span>&copy; {new Date().getFullYear()} ParaLearn</span>
        <Link href="/cbt/api-docs">Developer API</Link>
      </footer>
    </div>
  );
}
