"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

const proofPoints = [
  { icon: FileSpreadsheet, label: "Broadsheets compiled in real time" },
  { icon: ShieldCheck, label: "CBT exams with malpractice flags" },
  { icon: WifiOff, label: "Score entry that works offline" },
];

const HeroSection = () => {
  return (
    <section className="w-full relative overflow-hidden pt-28 md:pt-32 lg:pt-36 pb-12 md:pb-16 lg:pb-20">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
        {/* Left: text */}
        <div className="w-full lg:w-[52%] flex flex-col items-start">
          {/* Eyebrow */}
          <div
            className="animate-load-fade-in-up inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-3.5 py-1.5 mb-7"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
            <span className="text-xs font-semibold tracking-wide text-slate-600">
              Built for Nigerian schools
            </span>
          </div>

          <h1
            className="animate-load-fade-in-up text-hero text-[2.6rem] sm:text-5xl lg:text-6xl xl:text-[4.25rem] max-w-xl"
            style={{ animationDelay: "60ms" }}
          >
            Restore <span className="text-[#641bc4]">calm</span> to your school
            administration
          </h1>

          <p
            className="animate-load-fade-in-up mt-6 text-base md:text-lg text-slate-600 leading-relaxed max-w-lg"
            style={{ animationDelay: "120ms" }}
          >
            Move from chaotic paper trails and compilation bottlenecks to a
            unified, digital system. ParaLearn simplifies result management so
            you can focus on education, not paperwork.
          </p>

          {/* CTAs */}
          <div
            className="animate-load-fade-in-up flex flex-wrap items-center gap-4 mt-9"
            style={{ animationDelay: "180ms" }}
          >
            <Link href="/auth/signup" className="group/btn">
              <Button className="h-12 px-7 rounded-lg text-[15px] font-bold bg-[#641bc4] hover:bg-[#7b22e8] text-white border-0 shadow-none transition-all duration-150 ease-out hover:-translate-y-px active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#641bc4] focus-visible:ring-offset-2">
                Register Your School
                <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-150 group-hover/btn:translate-x-0.5" />
              </Button>
            </Link>
            <Link
              href="/auth/signin"
              className="h-12 px-7 inline-flex items-center rounded-lg text-[15px] font-bold text-[#0f172a] bg-white border border-[#e2e8f0] hover:bg-[#f1f5f9] transition-all duration-150 ease-out hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#641bc4] focus-visible:ring-offset-2"
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent("openLoginModal"));
              }}
            >
              Log In
            </Link>
          </div>

          {/* Proof points */}
          <ul
            className="animate-load-fade-in-up flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-2.5 mt-9 pt-7 border-t border-[#e2e8f0] w-full max-w-lg"
            style={{ animationDelay: "240ms" }}
          >
            {proofPoints.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-[#641bc4] shrink-0" />
                <span className="text-[13px] font-medium text-slate-600">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: framed product image */}
        <div
          className="animate-load-fade-in-up w-full lg:w-[48%] relative"
          style={{ animationDelay: "200ms" }}
        >
          <div className="relative rounded-2xl border border-[#e2e8f0] bg-white p-2 shadow-[0_8px_32px_rgba(15,23,42,0.10)]">
            <Image
              src="/herosection.png"
              alt="ParaLearn dashboard replacing a stressed administrator's paperwork"
              width={800}
              height={600}
              className="w-full h-auto object-contain rounded-xl"
              priority
              sizes="(min-width: 1024px) 48vw, 100vw"
            />
          </div>

          {/* Floating chips */}
          <div
            className="animate-load-fade-in-up absolute -top-4 right-4 sm:right-8 inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
            style={{ animationDelay: "420ms" }}
          >
            <span className="text-xs font-medium text-slate-500">
              yourschool
            </span>
            <span className="text-xs font-semibold text-[#641bc4] [font-family:var(--font-geist-mono),monospace]">
              .pln.ng
            </span>
          </div>
          <div
            className="animate-load-fade-in-up absolute -bottom-4 left-4 sm:left-8 inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
            style={{ animationDelay: "520ms" }}
          >
            <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
            <span className="text-xs font-semibold text-[#0f172a]">
              Broadsheet approved
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
