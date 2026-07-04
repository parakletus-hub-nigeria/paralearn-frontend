"use client";

import { ScrollReveal } from "./ScrollReveal";

const HowItWorksSection = () => {
  const fullText = "How It Works";
  const steps = [
    {
      number: "1",
      title: "Create Your Workspace",
      description: "Register your institution and define your structure (Classes, Subjects, and Grading Systems).",
    },
    {
      number: "2",
      title: "Claim Your Identity",
      description: "Get a dedicated, secure subdomain for your school (e.g., yourschool.pln.ng).",
    },
    {
      number: "3",
      title: "Onboard Your Team",
      description: "Bulk-upload your student and teacher lists from a spreadsheet. Accounts are created and credentials delivered automatically.",
    },
  ];

  return (
    <section className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-24 py-16 md:py-24 lg:py-12 relative overflow-hidden" style={{ transform: 'translateZ(0)' }}>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <ScrollReveal animation="reveal" delay="0s">
          <div className="text-center mb-12 md:mb-16 lg:mb-20">
            <div className="inline-block px-4 py-1.5 mb-4 rounded-full bg-gradient-to-r from-primary/10 via-purple-500/10 to-indigo-600/10 border border-primary/20">
              <span className="text-xs sm:text-sm font-bold text-primary uppercase tracking-widest">
                Simple Process
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-4xl xl:text-4xl font-black text-slate-900 mb-4 md:mb-5 tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
              {fullText}
            </h2>
          </div>
        </ScrollReveal>

        {/* Steps: grid on desktop, stacked on mobile */}
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 md:gap-6 lg:gap-8 xl:gap-12 relative z-10">
            {steps.map((step, index) => (
              <ScrollReveal key={index} animation="reveal" delay={`${0.1 + index * 0.1}s`}>
              <div
                className="bg-white/90 rounded-3xl p-6 sm:p-8 md:p-7 lg:p-10 shadow-md border border-slate-200/80 group relative overflow-hidden min-h-[280px] sm:min-h-[320px] md:min-h-[300px] lg:min-h-[340px]"
              >
                {/* Glowing border on hover */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/0 via-purple-600/0 to-indigo-600/0 group-hover:from-primary/10 group-hover:via-purple-600/10 group-hover:to-indigo-600/10 transition-all duration-300 border-2 border-transparent group-hover:border-primary/30" />
                
                {/* Content */}
                <div className="relative z-10">
                  {/* Step Number Badge */}
                  <div className="flex flex-col items-center mb-6 md:mb-8">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-24 md:h-24 lg:w-28 lg:h-28 mx-auto rounded-full bg-gradient-to-br from-primary via-purple-700 to-indigo-700 flex items-center justify-center text-3xl sm:text-4xl md:text-3xl lg:text-5xl font-black text-white shadow-lg shadow-primary/40">
                      <span>{step.number}</span>
                    </div>
                  </div>
                  
                  {/* Content Text */}
                  <div className="text-center space-y-3 md:space-y-4">
                    <h3 className="text-xl sm:text-2xl md:text-xl lg:text-2xl xl:text-3xl font-black text-slate-900 leading-tight group-hover:text-primary transition-colors duration-300">
                      {step.title}
                    </h3>
                    
                    <p className="text-sm sm:text-base md:text-sm lg:text-base xl:text-lg text-slate-600 leading-relaxed font-medium max-w-sm mx-auto">
                      {step.description}
                    </p>
                  </div>

                  {/* Arrow - Mobile only */}
                  {index < steps.length - 1 && (
                    <div className="md:hidden flex justify-center my-8">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/30">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
