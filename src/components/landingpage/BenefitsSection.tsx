"use client";

import {
  BookOpenCheck,
  CalendarCheck,
  NotebookPen,
  ShieldCheck,
  Smartphone,
  Zap,
} from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const benefits = [
  {
    icon: Zap,
    title: "Eliminate the end-of-term bottleneck",
    description:
      "Broadsheets compile themselves as scores come in. Approval and publishing happen in clicks, whether you manage 50 students or 5,000.",
  },
  {
    icon: ShieldCheck,
    title: "Assessments you can trust",
    description:
      "Exams are monitored for malpractice. Interruptions and tab-switching are flagged, so the grades students get are the grades they earned.",
  },
  {
    icon: BookOpenCheck,
    title: "Give teachers their weekends back",
    description:
      "Objective questions grade themselves and theory scores enter in seconds. Teachers spend less time calculating and more time teaching.",
  },
  {
    icon: Smartphone,
    title: "Instant transparency",
    description:
      "Once you approve a report card, students see it immediately on their secure portal. No lost papers, no confusion.",
  },
  {
    icon: CalendarCheck,
    title: "A register that never goes missing",
    description:
      "Attendance is marked in seconds, with one tap for a full class. Every record is stored by class and date, visible to administrators instantly.",
  },
  {
    icon: NotebookPen,
    title: "Lesson notes drafted in seconds",
    description:
      "SabiNote AI generates structured, NERDC curriculum-aligned lesson notes on demand. Teachers walk into class prepared.",
  },
];

const BenefitsSection = () => {
  return (
    <section className="w-full px-6 md:px-8 lg:px-12 py-16 md:py-24">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal animation="reveal">
          <div className="mb-10 md:mb-14 max-w-2xl">
            <h2 className="font-headline font-extrabold tracking-tight text-3xl md:text-4xl text-[#0f172a]">
              Why schools <span className="text-[#641bc4]">switch</span>
            </h2>
            <p className="mt-3 text-base md:text-lg text-slate-600">
              Outcomes, not feature lists.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#e2e8f0] border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          {benefits.map(({ icon: Icon, title, description }, index) => (
            <div
              key={title}
              className="group h-full bg-white p-7 md:p-8 transition-colors duration-200 hover:bg-[#f8fafc]"
            >
              <ScrollReveal animation="reveal" delay={`${0.05 + index * 0.06}s`}>
                <div className="w-11 h-11 rounded-lg bg-[#f0e5ff] text-[#641bc4] flex items-center justify-center mb-5 transition-colors duration-200 group-hover:bg-[#641bc4] group-hover:text-white">
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <h3 className="font-headline font-bold text-lg text-[#0f172a] leading-snug">
                  {title}
                </h3>
                <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                  {description}
                </p>
              </ScrollReveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
