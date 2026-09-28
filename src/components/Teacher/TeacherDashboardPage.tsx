"use client";

import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import {
  fetchAcademicCurrent,
  fetchMyAssessments,
  fetchTeacherClasses,
} from "@/reduxToolKit/teacher/teacherThunks";
import { TeacherHeader } from "./TeacherHeader";
import Link from "next/link";
import { routespath } from "@/lib/routepath";
import {
  ClipboardList,
  MessageSquareText,
  BookOpen,
  CalendarDays,
  Users,
  GraduationCap,
  TrendingUp,
  FileText,
  BarChart3,
  Clock,
  ChevronRight,
  Layers,
} from "lucide-react";
import { ProductTour } from "@/components/common/ProductTour";

const teacherTourSteps = [
  {
    target: ".teacher-status-cards",
    content: "Keep an eye on what needs your attention right now. This pipeline shows you exactly how many exams you've created and which ones still need grading.",
    disableBeacon: true,
  },
  {
    target: ".teacher-quick-actions",
    content: "Your daily toolkit lives here. Jump straight into creating assessments, entering student scores, or writing report card remarks with a single click.",
  },
  {
    target: ".teacher-recent-graded",
    content: "Monitor your class's pulse. This section highlights recent grading progress so you know exactly where your students stand.",
  },
];

const getStatusStyle = (status: string) => {
  if (status === "started") return { background: "var(--emerald-tint)", color: "var(--emerald-signal)", dot: "var(--emerald-signal)", label: "Active" };
  if (status === "ended") return { background: "var(--amber-tint)", color: "var(--amber-signal)", dot: "var(--amber-signal)", label: "Ended" };
  return { background: "var(--surface-muted)", color: "var(--foreground-muted)", dot: "var(--border-medium)", label: "Draft" };
};

const quickActions = [
  { href: routespath.TEACHER_ASSESSMENTS, icon: ClipboardList, title: "Assessments", desc: "Create & grade exams", bg: "var(--violet-tint)", color: "var(--violet-ink)" },
  { href: routespath.TEACHER_SCORES, icon: BarChart3, title: "Enter Scores", desc: "Input student marks", bg: "var(--emerald-tint)", color: "var(--emerald-signal)" },
  { href: routespath.TEACHER_COMMENTS, icon: MessageSquareText, title: "Comments", desc: "Add remarks", bg: "var(--cobalt-tint)", color: "var(--cobalt-signal)" },
  { href: routespath.TEACHER_REPORTS, icon: BookOpen, title: "Reports", desc: "Download cards", bg: "var(--amber-tint)", color: "var(--amber-signal)" },
  { href: routespath.TEACHER_CLASSES, icon: GraduationCap, title: "Classes", desc: "View groups", bg: "var(--violet-tint)", color: "var(--violet-ink)" },
  { href: routespath.TEACHER_ATTENDANCE, icon: Users, title: "Attendance", desc: "Take attendance", bg: "var(--crimson-tint)", color: "var(--crimson-signal)" },
];

const statusCards = [
  { label: "Active Exams", key: "activeAssessments", bg: "var(--emerald-tint)", fg: "var(--emerald-signal)", icon: TrendingUp },
  { label: "Pending Grading", key: "pendingGrading", bg: "var(--amber-tint)", fg: "var(--amber-signal)", icon: Clock },
  { label: "Not Started", key: "notStarted", bg: "var(--violet-tint)", fg: "var(--violet-ink)", icon: FileText },
  { label: "Total", key: "totalAssessments", bg: "var(--cobalt-tint)", fg: "var(--cobalt-signal)", icon: Layers },
];

export function TeacherDashboardPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { academicCurrent, assessments, teacherClasses, loading } = useSelector((s: RootState) => s.teacher);
  const { user } = useSelector((s: RootState) => s.user);

  useEffect(() => {
    const loadData = async () => {
      dispatch(fetchAcademicCurrent());
      const teacherId = (user as any)?.id || (user as any)?.teacherId;
      if (teacherId) {
        try {
          await dispatch(fetchTeacherClasses({ teacherId })).unwrap();
        } catch (err) {
          console.error("[TeacherDashboardPage] Failed to fetch teacher classes:", err);
        }
      }
      dispatch(fetchMyAssessments());
    };
    loadData();
  }, [dispatch, user]);

  const stats = useMemo(() => {
    const totalAssessments = assessments.length;
    const activeAssessments = assessments.filter((a) => a.status === "started").length;
    const pendingGrading = assessments.filter((a) => a.status === "ended").length;
    const notStarted = assessments.filter((a) => a.status === "not_started").length;

    const classSet = new Set<string>();
    const subjectSet = new Set<string>();
    let totalStudents = 0;

    (teacherClasses || []).forEach((item: any) => {
      const classId = item.class?.id || item.classId || item.id;
      const className = item.class?.name || item.className || item.name;
      const subjectName = item.subject?.name || item.subjectName || item.name;
      const studentCount = item.class?.studentCount || item.class?.enrollmentCount || item.class?.currentEnrollment || item.studentCount || item.enrollmentCount || item.currentEnrollment || 0;
      if (classId && className) { if (!classSet.has(classId)) { classSet.add(classId); totalStudents += studentCount; } }
      if (subjectName) subjectSet.add(subjectName);
    });

    return { totalAssessments, activeAssessments, pendingGrading, notStarted, totalClasses: classSet.size, totalSubjects: subjectSet.size, totalStudents };
  }, [assessments, teacherClasses]);

  const recentAssessments = useMemo(() => {
    return [...assessments]
      .sort((a, b) => new Date(b.startsAt || 0).getTime() - new Date(a.startsAt || 0).getTime())
      .slice(0, 5);
  }, [assessments]);

  const statValues: Record<string, number> = {
    activeAssessments: stats.activeAssessments,
    pendingGrading: stats.pendingGrading,
    notStarted: stats.notStarted,
    totalAssessments: stats.totalAssessments,
  };

  return (
    <div className="w-full">
      <ProductTour tourKey="teacher_dashboard" steps={teacherTourSteps} />
      <TeacherHeader />

      <div className="space-y-6">
        {/* Welcome banner */}
        <div className="p-6 md:p-8" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", background: "var(--surface-muted)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-1">
              <p className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Welcome back,</p>
              <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>
                {(user as any)?.firstName || "Teacher"} {(user as any)?.lastName || ""}
              </h1>
              <div className="flex items-center gap-2 mt-2 w-fit px-3 py-1.5" style={{ borderRadius: "var(--radius-md)", background: "white", border: "1px solid var(--border-fine)" }}>
                <CalendarDays className="w-4 h-4" style={{ color: "var(--violet-ink)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  {academicCurrent?.session || "—"} • {academicCurrent?.term || "—"}
                </span>
              </div>
            </div>

            {/* Summary pills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Classes", value: stats.totalClasses, icon: GraduationCap, bg: "var(--violet-tint)", color: "var(--violet-ink)" },
                { label: "Subjects", value: stats.totalSubjects, icon: BookOpen, bg: "var(--cobalt-tint)", color: "var(--cobalt-signal)" },
                { label: "Students", value: stats.totalStudents, icon: Users, bg: "var(--emerald-tint)", color: "var(--emerald-signal)" },
                { label: "Assessments", value: stats.totalAssessments, icon: ClipboardList, bg: "var(--amber-tint)", color: "var(--amber-signal)" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-3 px-4 py-3 bg-white" style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }}>
                  <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ borderRadius: "var(--radius-md)", background: stat.bg }}>
                    <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{stat.value}</p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Assessment Status Cards */}
        <div className="teacher-status-cards grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {statusCards.map((c) => (
            <div
              key={c.label}
              className="p-4 sm:p-5 flex flex-col justify-center"
              style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", background: c.bg, boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: "var(--radius-lg)", background: "white", opacity: 0.85 }}>
                  <c.icon className="w-5 h-5" style={{ color: c.fg }} />
                </div>
                <span className="text-3xl font-black" style={{ color: c.fg }}>{statValues[c.key]}</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold truncate" style={{ color: c.fg }}>{c.label}</p>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="teacher-quick-actions lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group bg-white flex flex-col h-full p-4 sm:p-5 md:p-6 transition-all"
                style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-card)")}
              >
                <div className="flex items-start justify-between mb-3 md:mb-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center shrink-0" style={{ borderRadius: "var(--radius-lg)", background: action.bg }}>
                    <action.icon className="w-5 h-5 md:w-6 md:h-6" style={{ color: action.color }} />
                  </div>
                  <ChevronRight className="w-5 h-5 transition-colors" style={{ color: "var(--border-medium)" }} />
                </div>
                <div className="mt-auto">
                  <h3 className="text-sm md:text-base font-bold mb-1" style={{ color: "var(--foreground)" }}>{action.title}</h3>
                  <p className="text-xs leading-tight" style={{ color: "var(--foreground-muted)" }}>{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Recent Assessments */}
          <div className="teacher-recent-graded bg-white overflow-hidden" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-fine)" }}>
              <h3 className="font-bold" style={{ color: "var(--foreground)" }}>Recent Assessments</h3>
              <Link href={routespath.TEACHER_ASSESSMENTS} className="text-sm font-medium transition-opacity hover:opacity-75" style={{ color: "var(--violet-ink)" }}>
                View All
              </Link>
            </div>
            <div>
              {loading ? (
                <div className="p-8 flex items-center justify-center">
                  <div className="h-6 w-6 rounded-full" style={{ border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
                </div>
              ) : recentAssessments.length === 0 ? (
                <div className="p-6 text-center text-sm" style={{ color: "var(--foreground-muted)" }}>
                  No assessments yet. Create your first one!
                </div>
              ) : (
                recentAssessments.map((assessment: any, idx) => {
                  const ss = getStatusStyle(assessment.status || "not_started");
                  return (
                    <Link
                      key={assessment.id || idx}
                      href={`${routespath.TEACHER_ASSESSMENTS}/${assessment.id}`}
                      className="flex items-center gap-4 px-5 py-4 transition-colors"
                      style={{ borderTop: "1px solid var(--border-fine)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: "var(--radius-lg)", background: "var(--violet-tint)" }}>
                        <FileText className="w-5 h-5" style={{ color: "var(--violet-ink)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" style={{ color: "var(--foreground)" }}>{assessment.title}</p>
                        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                          {assessment.subject?.name || "Subject"} • {assessment.totalMarks || 100} marks
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="w-2 h-2 rounded-full" style={{ background: ss.dot }} />
                        <span className="text-xs font-medium" style={{ color: ss.color }}>{ss.label}</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
