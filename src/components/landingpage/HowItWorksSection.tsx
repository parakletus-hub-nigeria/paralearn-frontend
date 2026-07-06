"use client";

import { ScrollReveal } from "./ScrollReveal";

const steps: {
  number: string;
  title: string;
  description: string;
  chip?: string;
}[] = [
  {
    number: "01",
    title: "Create your workspace",
    description:
      "Register your institution and define your structure: classes, subjects, and grading systems.",
  },
  {
    number: "02",
    title: "Claim your identity",
    description: "Get a dedicated, secure subdomain for your school:",
    chip: "yourschool.pln.ng",
  },
  {
    number: "03",
    title: "Onboard your team",
    description:
      "Bulk-upload student and teacher lists from a spreadsheet. Accounts are created and credentials delivered automatically.",
  },
];

const HowItWorksSection = () => {
  return (
    <section className="w-full px-6 md:px-8 lg:px-12 py-16 md:py-24">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal animation="reveal">
          <div className="mb-10 md:mb-14 max-w-2xl">
            <h2 className="font-headline font-extrabold tracking-tight text-3xl md:text-4xl text-[#0f172a]">
              Up and running in three steps
            </h2>
            <p className="mt-3 text-base md:text-lg text-slate-600">
              From registration to your first published result.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-10 md:gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <ScrollReveal
              key={step.number}
              animation="reveal"
              delay={`${0.1 + index * 0.1}s`}
            >
              <div className="group border-t-2 border-[#e2e8f0] pt-6 transition-colors duration-300 hover:border-[#641bc4]">
                <span className="block text-sm font-semibold text-[#641bc4] [font-family:var(--font-geist-mono),monospace]">
                  {step.number}
                </span>
                <h3 className="mt-3 font-headline font-bold text-xl text-[#0f172a]">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-sm md:text-[15px] text-slate-600 leading-relaxed">
                  {step.description}
                </p>
                {step.chip && (
                  <div className="mt-3">
                    <span className="inline-flex items-center rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1 text-[13px] font-medium text-[#641bc4] [font-family:var(--font-geist-mono),monospace]">
                      {step.chip}
                    </span>
                  </div>
                )}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
