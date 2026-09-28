"use client";

import { Header } from "@/components/RMS/header";
import { apiFetch } from "@/lib/interceptor";
import { Plus, Clock, ArrowRight, GraduationCap, Users, BookOpen, FileText, Calendar, ChevronRight, Wallet, Palette, Send, Layers } from "lucide-react";
import { AddStudentDialog, AddTeacherDialog } from "@/components/RMS/dialogs";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { selectDashboardUserData, selectCurrentSession } from "@/reduxToolKit/selectors";
import { fetchAllUsers, getTenantInfo } from "@/reduxToolKit/user/userThunks";
import { fetchCurrentSession } from "@/reduxToolKit/setUp/setUpSlice";
import { routespath } from "@/lib/routepath";
import Link from "next/link";
import { ProductTour } from "@/components/common/ProductTour";

const adminTourSteps = [
  { target: ".rms-header-greeting", title: "Welcome to ParaLearn!", content: "Your central command center. Monitor school performance, manage staff and students, and oversee all academic activities.", disableBeacon: true },
  { target: ".dashboard-academic-banner", title: "Current Term Status", content: "Displays your active academic session and term. Keeping this updated ensures accurate reporting." },
  { target: ".dashboard-stats-grid", title: "Quick Statistics", content: "Instant counts of students, teachers, subjects, and assessments." },
  { target: ".dashboard-recent-assessments", title: "Recent Activity", content: "Track the latest exams and assignments created by teachers." },
];

const statusMeta = (status: string) => {
  if (status === "started" || status === "in_progress")
    return { label: "Active", cls: "badge badge-active" };
  if (status === "ended" || status === "completed")
    return { label: "Ended", cls: "badge badge-draft" };
  return { label: "Draft", cls: "badge badge-draft" };
};

const reportStatusMeta = (status: string) => {
  if (status === "published") return { label: "Published", cls: "badge badge-published" };
  if (status === "approved")  return { label: "Approved",  cls: "badge badge-published" };
  return { label: "Draft", cls: "badge badge-draft" };
};

export const DashboardPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { studentCount, teacherCount, tenantInfo } = useSelector(selectDashboardUserData);
  const { users } = useSelector((state: RootState) => state.user);
  const currentSession = useSelector(selectCurrentSession);
  const [subjectCount, setSubjectCount] = useState(0);
  const [assessmentCount, setAssessmentCount] = useState(0);
  const [recentAssessments, setRecentAssessments] = useState<any[]>([]);
  const [recentReportCards, setRecentReportCards] = useState<any[]>([]);

  useEffect(() => {
    dispatch(fetchCurrentSession());
    dispatch(getTenantInfo());

    async function load() {
      const fetchJson = async (url: string) => {
        const res = await apiFetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
        return res.ok ? res.json() : null;
      };
      const fetchByStatus = async (status: string) => {
        try { const d = await fetchJson(`/api/proxy/assessments/${status}`); return Array.isArray(d) ? d : []; }
        catch { try { const d = await fetchJson(`/api/proxy/assessments?status=${status}`); return Array.isArray(d) ? d : []; } catch { return []; } }
      };

      const [usersResult, subjectResult, aStarted, aEnded, aNotStarted, reportResult] = await Promise.all([
        dispatch(fetchAllUsers()).unwrap().catch(() => ({ users: [] as any[] })),
        fetchJson("/api/proxy/subjects").catch(() => null),
        fetchByStatus("started"),
        fetchByStatus("ended"),
        fetchByStatus("not_started"),
        fetchJson("/api/proxy/reports/report-cards?limit=10").catch(() => null),
      ]);

      const subjectsArr = subjectResult?.data || subjectResult?.subjects || subjectResult;
      setSubjectCount(Array.isArray(subjectsArr) ? subjectsArr.length : 0);

      const all = [...aStarted, ...aEnded, ...aNotStarted];
      setAssessmentCount(all.length);
      setRecentAssessments([...all].sort((a, b) => new Date(b.createdAt || b.startsAt || 0).getTime() - new Date(a.createdAt || a.startsAt || 0).getTime()).slice(0, 5));

      const usersData: any[] = usersResult?.users || [];
      if (reportResult) {
        const studentsArr = reportResult?.data || reportResult || [];
        const allReports: any[] = [];
        if (Array.isArray(studentsArr)) {
          studentsArr.forEach((s: any) => (s.reportCardsAsStudent || []).forEach((r: any) => allReports.push({ ...r, studentId: r.studentId })));
        }
        const enriched = allReports.map((r) => {
          const student = usersData.find((u: any) => u.id === r.studentId);
          const enrollment = student?.enrollments?.find((e: any) => e.status === "active") || student?.enrollments?.[0];
          return { ...r, student: student ? { id: student.id, code: student.studentId || student.id, firstName: student.firstName, lastName: student.lastName, class: enrollment?.class } : null };
        });
        setRecentReportCards(enriched.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 10));
      }
    }

    load().catch(console.error);
  }, [dispatch]);

  const stats = [
    { label: "Students",    value: studentCount,    icon: GraduationCap, tint: "var(--violet-tint)",  iconColor: "var(--violet-ink)" },
    { label: "Teachers",    value: teacherCount,    icon: Users,         tint: "var(--emerald-tint)", iconColor: "var(--emerald-signal)" },
    { label: "Subjects",    value: subjectCount,    icon: BookOpen,      tint: "var(--cobalt-tint)",  iconColor: "var(--cobalt-signal)" },
    { label: "Assessments", value: assessmentCount, icon: FileText,      tint: "var(--amber-tint)",   iconColor: "var(--amber-signal)" },
  ];

  return (
    <div style={{ width: "100%", paddingBottom: 48 }}>
      <ProductTour tourKey="admin_dashboard" steps={adminTourSteps} />

      <Header
        schoolLogo={tenantInfo?.logoUrl}
        schoolName={tenantInfo?.name || "ParaLearn School"}
        showGreeting
      />

      {/* ── Active term banner ──────────────────────────────────────── */}
      {currentSession && (
        <div
          className="dashboard-academic-banner"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "16px 20px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-fine)",
            background: "#ffffff",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-md)",
                background: "var(--violet-tint)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Calendar style={{ width: 16, height: 16, color: "var(--violet-ink)" }} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.3 }}>
                Active academic period
              </p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em", lineHeight: 1.3, marginTop: 2 }}>
                {currentSession.session} — {currentSession.term}
              </p>
            </div>
          </div>
          <Link href={routespath.ACADEMIC}>
            <button className="btn-ghost" style={{ padding: "7px 14px", fontSize: 13 }}>
              Manage
              <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          </Link>
        </div>
      )}

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div
        className="dashboard-stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {stats.map(({ label, value, icon: Icon, tint, iconColor }) => (
          <div
            key={label}
            style={{
              background: "#ffffff",
              border: "1px solid var(--border-fine)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-card)",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-md)",
                background: tint,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon style={{ width: 18, height: 18, color: iconColor }} strokeWidth={1.75} />
            </div>
            <div>
              <p
                style={{
                  fontFamily: "var(--font-manrope), system-ui, sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  lineHeight: 1.3,
                }}
              >
                {label}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-manrope), system-ui, sans-serif",
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "#0f172a",
                  lineHeight: 1.1,
                  marginTop: 2,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {value.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Action Hub ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Essential Management Hub
            </h2>
            <p className="text-xs text-slate-500">Direct shortcuts to core school operations</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/RMS/finance"
            className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Wallet className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="mt-4">
              <p className="text-sm font-bold text-slate-900">Bursary &amp; Finance</p>
              <p className="text-xs text-slate-500 mt-0.5">Fees, invoices &amp; debt tracking</p>
            </div>
          </Link>

          <Link
            href="/RMS/branding"
            className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-purple-300 transition-all flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <Palette className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="mt-4">
              <p className="text-sm font-bold text-slate-900">Visual Identity Studio</p>
              <p className="text-xs text-slate-500 mt-0.5">Custom colors, logo &amp; live preview</p>
            </div>
          </Link>

          <Link
            href="/RMS/reports"
            className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <Send className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="mt-4">
              <p className="text-sm font-bold text-slate-900">Report Cards &amp; Dispatch</p>
              <p className="text-xs text-slate-500 mt-0.5">Bulk WhatsApp/Email &amp; signatures</p>
            </div>
          </Link>

          <Link
            href={routespath.ACADEMIC}
            className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="mt-4">
              <p className="text-sm font-bold text-slate-900">Academic Sessions</p>
              <p className="text-xs text-slate-500 mt-0.5">Terms, classes &amp; grading setup</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Main 2-col grid ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: 24,
          alignItems: "start",
        }}
        className="grid-cols-1 lg:grid-cols-[1fr_2fr]"
      >
        {/* Recent Assessments */}
        <div className="dashboard-recent-assessments">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
              Recent Assessments
            </h2>
            <Link href={routespath.ASSESSMENTS}>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--violet-ink)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 0",
                }}
              >
                View all <ArrowRight style={{ width: 13, height: 13 }} />
              </button>
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentAssessments.length === 0 ? (
              <div
                style={{
                  border: "1px dashed var(--border-fine)",
                  borderRadius: "var(--radius-lg)",
                  padding: "32px 24px",
                  textAlign: "center",
                }}
              >
                <FileText style={{ width: 28, height: 28, color: "var(--text-secondary)", margin: "0 auto 8px" }} strokeWidth={1.5} />
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>No assessments yet</p>
              </div>
            ) : (
              recentAssessments.map((item: any, i: number) => {
                const { label, cls } = statusMeta(item.status);
                return (
                  <div
                    key={item.id || i}
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--border-fine)",
                      borderRadius: "var(--radius-lg)",
                      padding: "14px 16px",
                      transition: "box-shadow var(--dur-smooth) var(--ease-out-expo)",
                    }}
                    className="hover:shadow-[var(--shadow-hover)]"
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.title || item.subject?.name || "Untitled"}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                          {item.subject?.name || "—"}
                        </p>
                      </div>
                      <span className={cls} style={{ flexShrink: 0 }}>{label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        {item.totalMarks || 100} marks
                      </span>
                      {item.duration && (
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{item.duration} min</span>
                      )}
                      {item.startsAt && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-secondary)" }}>
                          <Clock style={{ width: 11, height: 11 }} />
                          {new Date(item.startsAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Report Cards */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
              Recent Report Cards
            </h2>
            <Link href={routespath.REPORT}>
              <button className="btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
                <Plus style={{ width: 14, height: 14 }} />
                Generate
              </button>
            </Link>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border-fine)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-card)",
              overflow: "hidden",
            }}
          >
            {recentReportCards.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <FileText style={{ width: 32, height: 32, color: "var(--text-secondary)", margin: "0 auto 10px" }} strokeWidth={1.5} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>No report cards yet</p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Generate report cards at the end of each term</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border-fine)" }}>
                      {["Student ID", "Name", "Class", "Session / Term", "Status", "Created"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 16px",
                            textAlign: "left",
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#0f172a",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            whiteSpace: "nowrap",
                            fontFamily: "var(--font-manrope), system-ui, sans-serif",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentReportCards.map((r: any, i: number) => {
                      const { label, cls } = reportStatusMeta(r.status);
                      return (
                        <tr
                          key={r.id || i}
                          style={{
                            borderBottom: "1px solid var(--border-fine)",
                            transition: "background var(--dur-quick)",
                          }}
                          className="hover:bg-[#f7f3ff]/50"
                        >
                          <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", fontFamily: "'Geist Mono', ui-monospace, monospace", whiteSpace: "nowrap" }}>
                            {r.student?.code || r.studentId || "—"}
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13, color: "#0f172a", fontWeight: 500 }}>
                            {r.student?.firstName || ""} {r.student?.lastName || r.studentName || "—"}
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                            {r.student?.class?.name || r.className || "—"}
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                            {r.session || "—"} / {r.term || "—"}
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            <span className={cls}>{label}</span>
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
