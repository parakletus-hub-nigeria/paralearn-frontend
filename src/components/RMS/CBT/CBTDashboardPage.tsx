"use client";

import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { fetchAssessments, fetchClasses, fetchSubjects } from "@/reduxToolKit/admin/adminThunks";
import { getTenantInfo } from "@/reduxToolKit/user/userThunks";
import { Header } from "@/components/RMS/header";
import { Button } from "@/components/ui/button";
import {
  MonitorCheck,
  BookOpen,
  BarChart3,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileQuestion,
  ChevronRight,
} from "lucide-react";
import { routespath } from "@/lib/routepath";
import { format } from "date-fns";

const getStatusStyle = (status?: string) => {
  if (status === "started" || status === "active")
    return { background: "var(--emerald-tint)", color: "var(--emerald-signal)", label: "Active" };
  if (status === "ended")
    return { background: "var(--surface-muted)", color: "var(--foreground-muted)", label: "Ended" };
  return { background: "var(--amber-tint)", color: "var(--amber-signal)", label: "Pending" };
};

const statCards = [
  { label: "Total Exams", key: "total", icon: MonitorCheck, bg: "var(--violet-tint)", color: "var(--violet-ink)" },
  { label: "Active Now", key: "active", icon: Clock, bg: "var(--emerald-tint)", color: "var(--emerald-signal)" },
  { label: "Completed", key: "completed", icon: CheckCircle2, bg: "var(--surface-muted)", color: "var(--foreground-muted)" },
  { label: "Total Questions", key: "questions", icon: FileQuestion, bg: "var(--cobalt-tint)", color: "var(--cobalt-signal)" },
];

const quickLinks = [
  { href: routespath.CBT_EXAMS, icon: MonitorCheck, title: "Manage Exams", desc: "Create, publish, and configure CBT exams for your classes.", bg: "var(--violet-tint)", border: "color-mix(in oklch, var(--violet-ink) 20%, transparent)", iconColor: "var(--violet-ink)" },
  { href: routespath.CBT_QUESTION_BANK, icon: BookOpen, title: "Question Bank", desc: "Build your question library. Add individually or bulk upload.", bg: "var(--cobalt-tint)", border: "color-mix(in oklch, var(--cobalt-signal) 20%, transparent)", iconColor: "var(--cobalt-signal)" },
  { href: routespath.CBT_RESULTS, icon: BarChart3, title: "View Results", desc: "Review scores, rankings, and per-student breakdowns.", bg: "var(--emerald-tint)", border: "color-mix(in oklch, var(--emerald-signal) 20%, transparent)", iconColor: "var(--emerald-signal)" },
];

export function CBTDashboardPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { assessments, classes, subjects, loading } = useSelector((s: RootState) => s.admin);
  const { tenantInfo } = useSelector((s: RootState) => s.user);

  useEffect(() => {
    dispatch(fetchAssessments());
    dispatch(fetchClasses(undefined));
    dispatch(fetchSubjects());
    dispatch(getTenantInfo());
  }, []);

  const cbtExams = useMemo(
    () => assessments.filter((a: any) => a.isOnline === true || a.isOnline === "true"),
    [assessments],
  );

  const totalQuestions = useMemo(
    () => cbtExams.reduce((sum: number, a: any) => sum + (a.questionCount ?? a._count?.questions ?? 0), 0),
    [cbtExams],
  );

  const activeCount = cbtExams.filter((a: any) => a.status === "started" || a.status === "active").length;
  const completedCount = cbtExams.filter((a: any) => a.status === "ended").length;

  const subjectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjects) map.set(s.id, s.name);
    return map;
  }, [subjects]);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) map.set(c.id, c.name);
    return map;
  }, [classes]);

  const noSetup = classes.length === 0 && !loading;
  const recentExams = cbtExams.slice(0, 5);
  const statValues: Record<string, number> = { total: cbtExams.length, active: activeCount, completed: completedCount, questions: totalQuestions };

  return (
    <div className="w-full">
      <Header schoolLogo={tenantInfo?.logoUrl} schoolName={tenantInfo?.name || "ParaLearn School"} />

      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>
            <MonitorCheck className="w-6 h-6" style={{ color: "var(--violet-ink)" }} />
            CBT Portal
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
            Manage computer-based exams, question banks, and results for your school.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={routespath.CBT_QUESTION_BANK}>
            <Button variant="outline" className="gap-2 h-10" style={{ borderColor: "var(--border-fine)", borderRadius: "var(--radius-md)" }}>
              <BookOpen className="w-4 h-4" /> Question Bank
            </Button>
          </Link>
          <Link href={routespath.CBT_EXAMS}>
            <Button className="gap-2 text-white h-10" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
              <Plus className="w-4 h-4" /> New Exam
            </Button>
          </Link>
        </div>
      </div>

      {/* Setup banner */}
      {noSetup && (
        <div className="mb-6 flex items-start gap-3 p-5" style={{ borderRadius: "var(--radius-xl)", border: "1px solid color-mix(in oklch, var(--amber-signal) 25%, transparent)", background: "var(--amber-tint)" }}>
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--amber-signal)" }} />
          <div className="flex-1">
            <p className="font-semibold" style={{ color: "var(--amber-signal)" }}>School setup incomplete</p>
            <p className="text-sm mt-0.5" style={{ color: "var(--amber-signal)", opacity: 0.85 }}>
              You need to create classes and subjects in the RMS before setting up CBT exams.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href={routespath.CLASSES}>
              <Button size="sm" variant="outline" style={{ borderColor: "color-mix(in oklch, var(--amber-signal) 40%, transparent)", color: "var(--amber-signal)", borderRadius: "var(--radius-md)" }}>
                Setup Classes
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white p-5" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
            <div className="w-10 h-10 flex items-center justify-center mb-3" style={{ borderRadius: "var(--radius-lg)", background: stat.bg }}>
              <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
              {loading ? "—" : statValues[stat.key]}
            </p>
            <p className="text-xs uppercase tracking-wide font-semibold mt-0.5" style={{ color: "var(--foreground-muted)" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {quickLinks.map((card) => (
          <Link key={card.href} href={card.href}>
            <div
              className="p-5 transition-all cursor-pointer"
              style={{ borderRadius: "var(--radius-xl)", border: `1px solid ${card.border}`, background: card.bg }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-card)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
            >
              <div className="flex items-start justify-between">
                <card.icon className="w-6 h-6" style={{ color: card.iconColor }} />
                <ChevronRight className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
              </div>
              <p className="font-bold mt-3" style={{ color: "var(--foreground)" }}>{card.title}</p>
              <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Exams */}
      <div className="bg-white overflow-hidden" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-fine)" }}>
          <h2 className="font-bold" style={{ color: "var(--foreground)" }}>Recent CBT Exams</h2>
          <Link href={routespath.CBT_EXAMS}>
            <button className="text-sm font-medium flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: "var(--violet-ink)" }}>
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>

        {loading && cbtExams.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full" style={{ border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
          </div>
        ) : recentExams.length === 0 ? (
          <div className="py-12 text-center">
            <MonitorCheck className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--border-medium)" }} />
            <p className="font-medium" style={{ color: "var(--foreground-muted)" }}>No CBT exams yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)", opacity: 0.7 }}>Create your first exam to get started.</p>
            <Link href={routespath.CBT_EXAMS}>
              <Button className="mt-4 gap-2 text-white" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                <Plus className="w-4 h-4" /> Create Exam
              </Button>
            </Link>
          </div>
        ) : (
          <div>
            {recentExams.map((exam: any) => {
              const ss = getStatusStyle(exam.status);
              const subjectName = subjectNameById.get(exam.subjectId || "") || "—";
              const className = classNameById.get(exam.classId || "") || "—";
              return (
                <Link key={exam.id} href={`/RMS/cbt/exams/${exam.id}`}>
                  <div
                    className="px-6 py-4 flex items-center gap-4 transition-colors cursor-pointer"
                    style={{ borderTop: "1px solid var(--border-fine)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: "var(--radius-lg)", background: "var(--violet-tint)" }}>
                      <MonitorCheck className="w-5 h-5" style={{ color: "var(--violet-ink)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate" style={{ color: "var(--foreground)" }}>{exam.title}</p>
                      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{subjectName} • {className}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5" style={{ borderRadius: "var(--radius-sm)", background: ss.background, color: ss.color }}>
                        {ss.label}
                      </span>
                      {exam.startsAt && (
                        <span className="text-xs hidden md:block" style={{ color: "var(--foreground-muted)" }}>
                          {format(new Date(exam.startsAt), "MMM d, yyyy")}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                        {exam.questionCount ?? exam._count?.questions ?? 0} Qs
                      </span>
                      <ChevronRight className="w-4 h-4" style={{ color: "var(--border-medium)" }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
