"use client";

import { ScrollReveal } from "../ScrollReveal";
import { LandingLayout } from "../LandingLayout";
import {
  FileSpreadsheet,
  Wand2,
  Shield,
  ClipboardList,
  WifiOff,
  MessageSquare,
  Lock,
  Clock,
  ArrowRight,
  Upload,
  Users,
  CalendarCheck,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const ProductPage = () => {
  const commandCenterFeatures = [
    {
      icon: FileSpreadsheet,
      title: "The Magic Broadsheet",
      description: "Forget Excel formulas. As scores are uploaded by teachers, your Master Broadsheet populates in real-time. View class performance at a glance, identify struggling students instantly, and approve an entire class results with one click."
    },
    {
      icon: Wand2,
      title: "School Onboarding Wizard",
      description: "Setting up a digital infrastructure should not take weeks. Our 4-step wizard helps you configure your Academic Year, Classes, Subjects, and unique Grading Systems in under 30 minutes."
    },
    {
      icon: Shield,
      title: "Audit-Ready Security",
      description: "Every score change, every approval, and every login is logged. Protect your institution reputation with a system that ensures the grades on the report card match the grades in the exam hall."
    },
    {
      icon: Upload,
      title: "Bulk Onboarding",
      description: "Upload your entire student and teacher lists from a spreadsheet. Records are validated, processed in the background, and you receive an email the moment accounts are ready."
    },
    {
      icon: Users,
      title: "Enrollment Management",
      description: "Assign students to classes for each academic session and see exactly who belongs where. Class lists stay accurate from the first day of term to the last."
    },
    {
      icon: CalendarCheck,
      title: "Attendance Oversight",
      description: "Teachers mark attendance from their devices; you see the daily record for any class instantly and can correct entries in bulk when the register needs a fix."
    }
  ];

  const teacherFeatures = [
    {
      icon: ClipboardList,
      title: "CBT & Assessment",
      description: "Set objective questions that grade themselves."
    },
    {
      icon: WifiOff,
      title: "Offline Capability",
      description: "Input scores even when the internet is down; the app syncs automatically when you reconnect."
    },
    {
      icon: MessageSquare,
      title: "Focus on Feedback",
      description: "Spend less time calculating averages and more time writing meaningful behavioral comments."
    },
    {
      icon: Sparkles,
      title: "AI Lesson Notes",
      description: "Generate structured, NERDC curriculum-aligned lesson notes in seconds with SabiNote AI."
    }
  ];

  const studentFeatures = [
    {
      icon: Lock,
      title: "Secure Exams",
      description: "Take Computer-Based Tests (CBT) with anti-malpractice safeguards that flag tab-switching."
    },
    {
      icon: Clock,
      title: "Instant Results",
      description: "No more anxiety. Access approved report cards directly on the phone as soon as they are published."
    }
  ];

  return (
    <LandingLayout className="min-h-screen">
      {/* Hero Section */}
      <section className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-24 py-16 md:py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-200 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 pt-8 md:pt-12 lg:pt-16">
          <ScrollReveal animation="reveal" delay="0s">
            <div className="text-center mb-12 md:mb-16 lg:mb-20">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-3xl xl:text-4xl font-black text-slate-900 mb-4 md:mb-5 tracking-tight">
                Goal
              </h2>
            </div>
          </ScrollReveal>

          <div className="max-w-4xl mx-auto space-y-12 md:space-y-16">
            <ScrollReveal animation="reveal" delay="0.1s">
              <div className="space-y-6">
                <p className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed font-medium">
                  Clearly distinguish between the Admin Web Portal (Control) and the Mobile App (Action), highlighting the benefits of each.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="reveal" delay="0.2s">
              <div className="space-y-6">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-3xl xl:text-4xl font-black text-slate-900 mb-4">
                  One Ecosystem, two Specialized Experiences.
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed font-medium">
                  ParaLearn splits the workload intelligently. Administrators command from the web; teachers and students engage from their devices.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Command Center Section */}
      <section className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-24 py-16 md:py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-200 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <ScrollReveal animation="reveal" delay="0.1s">
            <div className="text-center mb-12 md:mb-16 lg:mb-20">
              <p className="text-lg sm:text-xl md:text-2xl uppercase tracking-widest text-primary font-semibold mb-2 md:mb-3">
                Part 1
              </p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-3xl xl:text-4xl font-black text-slate-900 mb-4 md:mb-5 tracking-tight">
                The Command Center (For Admins)
              </h2>
            </div>
          </ScrollReveal>

          <div className="max-w-4xl mx-auto space-y-12 md:space-y-16 mb-12 md:mb-16">
            <ScrollReveal animation="reveal" delay="0.2s">
              <div className="space-y-6">
                <p className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed font-medium text-center">
                  Accessed via the Web Portal
                </p>
              </div>
            </ScrollReveal>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8 lg:gap-12">
            {commandCenterFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <ScrollReveal key={index} animation="reveal" delay={`${0.3 + index * 0.1}s`}>
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-500/10 to-indigo-600/10 rounded-3xl blur-xl transform rotate-3" />
                    <div className="relative bg-white backdrop-blur-sm border border-slate-200 rounded-3xl p-6 md:p-8 shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="w-12 h-12 md:w-14 md:h-14 mb-4 md:mb-6 rounded-full bg-gradient-to-br from-primary via-purple-600 to-indigo-600 flex items-center justify-center">
                        <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                      </div>
                      <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-3 md:mb-4">
                        {feature.title}
                      </h3>
                      <p className="text-base md:text-lg text-slate-600 leading-relaxed font-medium">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Classroom Companion Section */}
      <section className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-24 py-16 md:py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-200 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <ScrollReveal animation="reveal" delay="0.1s">
            <div className="text-center mb-12 md:mb-16 lg:mb-20">
              <p className="text-lg sm:text-xl md:text-2xl uppercase tracking-widest text-primary font-semibold mb-2 md:mb-3">
                Part 2
              </p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-3xl xl:text-4xl font-black text-slate-900 mb-4 md:mb-5 tracking-tight">
                The Classroom Companion (For Teachers & Students)
              </h2>
            </div>
          </ScrollReveal>

          <div className="max-w-4xl mx-auto space-y-12 md:space-y-16 mb-12 md:mb-16">
            <ScrollReveal animation="reveal" delay="0.2s">
              <div className="space-y-6">
                <p className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed font-medium text-center">
                  Accessed via the Mobile App
                </p>
              </div>
            </ScrollReveal>
          </div>

          <div className="max-w-6xl mx-auto space-y-16 md:space-y-20">
            {/* For Teachers Section */}
            <ScrollReveal animation="reveal" delay="0.3s">
              <div className="space-y-8 md:space-y-10">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 text-center">
                  For Teachers: Grading on the Go
                </h3>
                <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
                  {teacherFeatures.map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                      <ScrollReveal key={index} animation="reveal" delay={`${0.4 + index * 0.1}s`}>
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-500/10 to-indigo-600/10 rounded-3xl blur-xl transform rotate-3" />
                          <div className="relative bg-white backdrop-blur-sm border border-slate-200 rounded-3xl p-6 md:p-8 shadow-lg hover:shadow-xl transition-all duration-300">
                            <div className="w-12 h-12 md:w-14 md:h-14 mb-4 md:mb-6 rounded-full bg-gradient-to-br from-primary via-purple-600 to-indigo-600 flex items-center justify-center">
                              <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                            </div>
                            <h4 className="text-lg md:text-xl font-black text-slate-900 mb-3">
                              {feature.title}
                            </h4>
                            <p className="text-base text-slate-600 leading-relaxed font-medium">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      </ScrollReveal>
                    );
                  })}
                </div>
              </div>
            </ScrollReveal>

            {/* For Students Section */}
            <ScrollReveal animation="reveal" delay="0.6s">
              <div className="space-y-8 md:space-y-10">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 text-center">
                  For Students: Integrity & Insight
                </h3>
                <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
                  {studentFeatures.map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                      <ScrollReveal key={index} animation="reveal" delay={`${0.7 + index * 0.1}s`}>
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-500/10 to-indigo-600/10 rounded-3xl blur-xl transform rotate-3" />
                          <div className="relative bg-white backdrop-blur-sm border border-slate-200 rounded-3xl p-6 md:p-8 shadow-lg hover:shadow-xl transition-all duration-300">
                            <div className="w-12 h-12 md:w-14 md:h-14 mb-4 md:mb-6 rounded-full bg-gradient-to-br from-primary via-purple-600 to-indigo-600 flex items-center justify-center">
                              <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                            </div>
                            <h4 className="text-lg md:text-xl font-black text-slate-900 mb-3">
                              {feature.title}
                            </h4>
                            <p className="text-base text-slate-600 leading-relaxed font-medium">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      </ScrollReveal>
                    );
                  })}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-24 py-20 md:py-32 lg:py-40 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] sm:w-[500px] sm:h-[500px] bg-gradient-to-r from-primary/5 via-purple-500/5 to-indigo-500/5 blur-3xl rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <ScrollReveal animation="reveal" delay="0s">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-3xl xl:text-4xl font-black leading-[1.1] tracking-tight text-slate-900 mb-8 md:mb-12">
              See how ParaLearn fits your school.
            </h2>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6">
              <Link href="/auth/signup">
                <Button
                  size="lg"
                  className="h-12 sm:h-14 md:h-14 px-6 sm:px-8 md:px-10 rounded-2xl text-sm sm:text-base md:text-base font-black shadow-2xl shadow-primary/50 transition-all duration-300 bg-gradient-to-r from-primary via-purple-600 to-indigo-600 relative overflow-hidden group w-full sm:w-auto touch-manipulation active:scale-95"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Register for a Demo Account
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 group-active:translate-x-1 transition-transform duration-300" />
                  </span>
                </Button>
              </Link>
              <Link href="/">
                <Button
                  variant="ghost"
                  size="lg"
                  className="h-12 sm:h-14 md:h-14 px-5 sm:px-6 md:px-8 text-sm sm:text-base md:text-base font-bold border border-slate-200 transition-all duration-300 w-full sm:w-auto"
                >
                  Return to Home
                </Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </LandingLayout>
  );
};

export default ProductPage;
