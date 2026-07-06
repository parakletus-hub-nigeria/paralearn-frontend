"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const CTASection = () => {
  return (
    <section className="w-full px-6 md:px-8 lg:px-12 py-16 md:py-24">
      <ScrollReveal animation="reveal">
        <div className="max-w-6xl mx-auto relative overflow-hidden rounded-2xl bg-[#641bc4] px-6 py-16 md:px-16 md:py-20 text-center">
          {/* Ambient corner glows, landing page only */}
          <div
            className="absolute -top-1/3 -left-1/4 w-2/3 h-2/3 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(151,71,255,0.5), transparent 70%)",
            }}
          />
          <div
            className="absolute -bottom-1/3 -right-1/4 w-2/3 h-2/3 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(151,71,255,0.35), transparent 70%)",
            }}
          />

          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="font-headline font-extrabold tracking-tight text-3xl md:text-4xl lg:text-[2.75rem] text-white leading-tight">
              Ready to modernize your school&apos;s result management?
            </h2>
            <p className="mt-5 text-base md:text-lg text-[#e6d8ff] leading-relaxed">
              Whether you are starting fresh or migrating from a manual system:
              result management, CBT assessments, attendance tracking, AI
              lesson notes, and student progress reporting, we support your
              school&apos;s growth.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup" className="w-full sm:w-auto group/btn">
                <Button className="w-full sm:w-auto h-12 px-8 rounded-lg text-[15px] font-bold bg-white text-[#641bc4] hover:bg-[#f0e5ff] border-0 shadow-none transition-all duration-150 ease-out hover:-translate-y-px active:scale-[0.97]">
                  Start Registration
                  <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-150 group-hover/btn:translate-x-0.5" />
                </Button>
              </Link>
              <Link href="/about" className="w-full sm:w-auto">
                <Button
                  variant="ghost"
                  className="w-full sm:w-auto h-12 px-8 rounded-lg text-[15px] font-bold text-white border border-white/40 bg-transparent hover:bg-white/10 hover:text-white transition-all duration-150 ease-out hover:-translate-y-px active:scale-[0.97]"
                >
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
};

export default CTASection;
