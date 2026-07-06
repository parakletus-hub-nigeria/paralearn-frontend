"use client";

import { Check, X } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const oldWay = [
  {
    title: "Weeks of compilation",
    description:
      "Teachers rushing to calculate scores manually while you wait for the master broadsheet.",
  },
  {
    title: "Error-prone records",
    description:
      "Missing scripts, calculation errors, and grade disputes that damage parent trust.",
  },
  {
    title: "Compromised exams",
    description:
      "Malpractice and students sharing answers during assessments.",
  },
];

const newWay = [
  {
    title: "Instant compilation",
    description:
      "Scores move from teachers' devices to the master broadsheet in real time.",
  },
  {
    title: "Verified accuracy",
    description:
      "Automated calculations eliminate human error. What is recorded is exactly what is reported.",
  },
  {
    title: "Integrity first",
    description:
      "Secure Computer-Based Testing flags tab-switching, so grades are earned, not shared.",
  },
];

const ComparisonSection = () => {
  return (
    <section className="w-full px-6 md:px-8 lg:px-12 py-16 md:py-24">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal animation="reveal">
          <div className="mb-10 md:mb-14 max-w-2xl">
            <h2 className="font-headline font-extrabold tracking-tight text-3xl md:text-4xl text-[#0f172a]">
              The end of term, before and after
            </h2>
            <p className="mt-3 text-base md:text-lg text-slate-600">
              The same three weeks, run two different ways.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal animation="reveal" delay="0.1s">
          <div className="grid md:grid-cols-2 rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#e2e8f0]">
            {/* The old way */}
            <div>
              <div className="px-7 md:px-9 py-5 bg-[#f8fafc] border-b border-[#e2e8f0]">
                <h3 className="font-headline font-bold text-lg text-slate-500">
                  The old way
                </h3>
              </div>
              <ul className="divide-y divide-[#e2e8f0]">
                {oldWay.map((item) => (
                  <li
                    key={item.title}
                    className="flex items-start gap-4 px-7 md:px-9 py-6 transition-colors duration-150 hover:bg-[#f8fafc]"
                  >
                    <span className="mt-0.5 w-7 h-7 rounded-full bg-[#fddada] flex items-center justify-center shrink-0">
                      <X className="w-4 h-4 text-[#e60023]" strokeWidth={2.5} />
                    </span>
                    <div>
                      <h4 className="font-bold text-[15px] text-[#0f172a]">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* With ParaLearn */}
            <div>
              <div className="px-7 md:px-9 py-5 bg-[#f0e5ff]/50 border-b border-[#e2e8f0]">
                <h3 className="font-headline font-bold text-lg text-[#641bc4]">
                  With ParaLearn
                </h3>
              </div>
              <ul className="divide-y divide-[#e2e8f0]">
                {newWay.map((item) => (
                  <li
                    key={item.title}
                    className="flex items-start gap-4 px-7 md:px-9 py-6 transition-colors duration-150 hover:bg-[#f8fafc]"
                  >
                    <span className="mt-0.5 w-7 h-7 rounded-full bg-[#dff9d8] flex items-center justify-center shrink-0">
                      <Check
                        className="w-4 h-4 text-[#10b981]"
                        strokeWidth={2.5}
                      />
                    </span>
                    <div>
                      <h4 className="font-bold text-[15px] text-[#0f172a]">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default ComparisonSection;
