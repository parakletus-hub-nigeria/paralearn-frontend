"use client";

import { ScrollReveal } from "./ScrollReveal";

const BenefitsSection = () => {
  const benefits = [
    {
      title: "Eliminate the End-of-Term Bottleneck",
      category: "Administrative Efficiency",
      description: "You should not have to pause school operations just to generate report cards. ParaLearn automates the compilation of broadsheets. Whether you are managing 50 students or 5,000, approval and publishing happen in clicks, not weeks.",
      icon: "⚡",
      gradient: "from-yellow-500 via-orange-600 to-red-600",
    },
    {
      title: "Assessments You Can Trust",
      category: "Assessment Integrity",
      description: "Preserve the sanctity of your exams with audit-ready security. Our system actively monitors for malpractice, flagging interruptions and tab-switching during assessments, so the grades students get are the grades they actually earned.",
      icon: "🛡️",
      gradient: "from-blue-500 via-indigo-600 to-purple-700",
    },
    {
      title: "Give Teachers Their Weekends Back",
      category: "Teacher Empowerment",
      description: "Reduce the burnout associated with grading hundreds of scripts. With automated grading for objective questions and easy score entry for theory, your teachers spend less time calculating and more time teaching.",
      icon: "👨‍🏫",
      gradient: "from-green-500 via-emerald-600 to-teal-700",
    },
    {
      title: "Build Trust with Instant Transparency",
      category: "Parent/Student Access",
      description: "End the anxiety of missing results. Once you approve a report, it is immediately available to parents and students via their secure mobile portal. No lost papers, no confusion—just clear, accessible progress tracking.",
      icon: "📱",
      gradient: "from-pink-500 via-purple-600 to-indigo-700",
    },
    {
      title: "A Register That Never Goes Missing",
      category: "Attendance Tracking",
      description: "Teachers mark attendance in seconds, with one tap to mark a whole class present. Every record is stored by class and date, visible to administrators the moment it is taken.",
      icon: "📋",
      gradient: "from-cyan-500 via-sky-600 to-blue-700",
    },
    {
      title: "Lesson Notes Drafted in Seconds",
      category: "AI Lesson Planning",
      description: "SabiNote AI generates structured, NERDC curriculum-aligned lesson notes on demand. Teachers reclaim the hours spent planning and walk into class prepared.",
      icon: "📝",
      gradient: "from-violet-500 via-purple-600 to-fuchsia-700",
    },
  ];

  return (
    <section className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-24 py-16 md:py-24 lg:py-12 relative overflow-hidden" style={{ transform: 'translateZ(0)' }}>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <ScrollReveal animation="reveal" delay="0s">
          <div className="text-center mb-12 md:mb-16 lg:mb-20">
            <div className="inline-block px-4 py-1.5 mb-4 rounded-full bg-gradient-to-r from-primary/20 via-purple-600/20 to-indigo-700/20 border-2 border-primary/40">
              <span className="text-xs sm:text-sm font-bold bg-gradient-to-r from-primary via-purple-600 to-indigo-700 bg-clip-text text-transparent uppercase tracking-widest">
                Real Benefits
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-4xl xl:text-4xl font-black text-slate-900 mb-4 md:mb-5 tracking-tight">
              Why Schools Switch
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-3xl mx-auto font-medium">
              Focused on outcomes, not technical specs
            </p>
          </div>
        </ScrollReveal>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-6 lg:gap-8">
          {benefits.map((benefit, index) => (
            <ScrollReveal key={index} animation="reveal" delay={`${0.1 + index * 0.08}s`}>
            <div
              className="bg-white/90 rounded-3xl p-6 sm:p-8 md:p-7 lg:p-10 shadow-md border border-slate-200/80 group relative overflow-hidden"
            >
              {/* Gradient border on hover */}
              <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${benefit.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300`} />
              
              {/* Content */}
              <div className="relative z-10">
                {/* Icon and Header */}
                <div className="flex items-start gap-4 md:gap-5 mb-6 md:mb-8">
                  {/* Icon Container */}
                  <div className="relative flex-shrink-0">
                    {/* Icon */}
                    <div className={`relative w-16 h-16 sm:w-20 sm:h-20 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-2xl bg-gradient-to-br ${benefit.gradient} flex items-center justify-center text-3xl sm:text-4xl md:text-4xl lg:text-5xl shadow-lg shadow-current/30 relative z-10`}>
                      {benefit.icon}
                    </div>
                  </div>
                  
                  {/* Title Section */}
                  <div className="flex-1 pt-1">
                    <span className={`text-xs sm:text-xs md:text-xs font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r ${benefit.gradient} mb-2 block`}>
                      {benefit.category}
                    </span>
                    <h3 className="text-xl sm:text-2xl md:text-2xl lg:text-3xl font-black text-slate-900 leading-tight group-hover:text-primary transition-colors duration-500">
                      {benefit.title}
                    </h3>
                  </div>
                </div>
                
                {/* Description */}
                <p className="text-sm sm:text-base md:text-sm lg:text-base text-slate-600 leading-relaxed font-medium">
                  {benefit.description}
                </p>

                {/* Bottom accent line */}
                <div className={`mt-6 pt-6 border-t border-slate-300/60 group-hover:border-transparent transition-colors duration-300 relative`}>
                  <div className={`absolute top-0 left-0 h-1 w-0 bg-gradient-to-r ${benefit.gradient} group-hover:w-full transition-all duration-300 rounded-full`} />
                </div>
              </div>
            </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
