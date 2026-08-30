"use client";

import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import {
  fetchStudentAssessments,
  syncOfflineSubmissions,
} from "@/reduxToolKit/student/studentThunks";
import { useGetStudentReportCardQuery } from "@/reduxToolKit/api/endpoints/reports";
import { downloadStudentReportCardPdf } from "@/lib/reportPdf";
import { useSessionsAndTerms } from "@/hooks/useSessionsAndTerms";
import { StudentHeader } from "@/components/Student/StudentHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  Clock,
  CheckCircle,
  PlayCircle,
  AlertCircle,
  ArrowRight,
  Calculator,
  Beaker,
  Lock,
  FileText,
  BarChart3,
  CheckSquare,
  BookOpen,
  Download,
  Trophy,
  Banknote,
} from "lucide-react";
import { ProductTour } from "@/components/common/ProductTour";
import Link from "next/link";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const studentTourSteps = [
  {
    target: ".student-stats-grid",
    content:
      "Welcome to your command center! Here you can instantly see your overall progress and how many exams you have coming up next.",
    disableBeacon: true,
  },
  {
    target: ".student-assessments-grid",
    content:
      "This is your active assessment board. All your upcoming tests and past assignments are organized here by subject and timeline.",
  },
  {
    target: ".student-enter-lobby-button",
    content:
      "Ready to take a test? Click 'Enter Lobby' to securely start or resume your assessment when the time is right.",
  },
];

export default function StudentDashboardPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { assessments, loading, error } = useSelector(
    (s: RootState) => s.student,
  );
  const { user } = useSelector((s: RootState) => s.user);

  const [activeTab, setActiveTab] = useState<"active" | "ended" | "reports">("active");
  const [resultAssessment, setResultAssessment] = useState<any>(null);

  // Report card state
  const { sessionOptions, allTermOptions, getTermsForSession, currentSession, currentTerm } = useSessionsAndTerms();
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Auto-select current session/term
  useEffect(() => {
    if (currentSession && !selectedSession) setSelectedSession(currentSession);
    if (currentTerm && !selectedTerm) setSelectedTerm(currentTerm);
  }, [currentSession, currentTerm, selectedSession, selectedTerm]);

  const termOptionsForSession = selectedSession
    ? getTermsForSession(selectedSession)
    : allTermOptions;

  const studentId = (user as any)?.id || "";
  const classId =
    (user as any)?.classId ||
    (user as any)?.class?.id ||
    (user as any)?.studentProfile?.classId ||
    "";

  const { data: reportCard, isLoading: reportLoading, isError: reportError } =
    useGetStudentReportCardQuery(
      { studentId, session: selectedSession, term: selectedTerm },
      { skip: !studentId || !selectedSession || !selectedTerm || activeTab !== "reports" },
    );

  const handleDownloadPdf = async () => {
    if (!studentId || !selectedSession || !selectedTerm) {
      toast.error("Please select a session and term first");
      return;
    }
    setDownloadingPdf(true);
    try {
      await downloadStudentReportCardPdf({ studentId, session: selectedSession, term: selectedTerm });
      toast.success("Report card downloaded!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to download report card");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Guard against React StrictMode double-invoke and repeated mounts
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    dispatch(fetchStudentAssessments());

    // Sync offline submissions when dashboard loads
    const syncOffline = async () => {
      if (hasSyncedRef.current) return;
      hasSyncedRef.current = true;

      try {
        const rawSubmissions = localStorage.getItem("offline_submissions");
        if (!rawSubmissions) return;

        const allSaved: any[] = JSON.parse(rawSubmissions);
        if (!Array.isArray(allSaved) || allSaved.length === 0) {
          localStorage.removeItem("offline_submissions");
          return;
        }

        // Drop items that have been retried too many times (stale/already submitted)
        const MAX_RETRIES = 3;
        const retryable = allSaved.filter(
          (s) => (s.syncAttempts ?? 0) < MAX_RETRIES,
        );

        if (retryable.length === 0) {
          // All items exhausted retries — clear and stop spamming
          localStorage.removeItem("offline_submissions");
          return;
        }

        toast.info(
          `Attempting to sync ${retryable.length} offline submission(s)...`,
        );

        try {
          await dispatch(syncOfflineSubmissions(retryable)).unwrap();
          localStorage.removeItem("offline_submissions");
          toast.success("Offline submissions synced successfully!");
          dispatch(fetchStudentAssessments());
        } catch (err: any) {
          const status = err?.statusCode ?? err?.status ?? err?.data?.statusCode;
          const isAlreadyProcessed =
            status === 400 || status === 409 || status === 422;

          if (isAlreadyProcessed) {
            // Backend already has these — safe to discard, they won't succeed on retry
            localStorage.removeItem("offline_submissions");
            console.info("[OfflineSync] Server rejected as already processed — cleared localStorage");
          } else {
            // Network or server error — increment retry counter and save back
            const incremented = allSaved.map((s) => ({
              ...s,
              syncAttempts: (s.syncAttempts ?? 0) + 1,
            }));
            localStorage.setItem(
              "offline_submissions",
              JSON.stringify(incremented),
            );
            console.warn("[OfflineSync] Sync failed, will retry next visit", err);
            toast.error("Failed to sync offline submissions. Will try again later.");
          }
        }
      } catch (parseErr) {
        // Corrupted localStorage entry — clear it
        localStorage.removeItem("offline_submissions");
        console.error("[OfflineSync] Corrupted offline_submissions data, cleared", parseErr);
      }
    };

    if (typeof window !== "undefined" && navigator.onLine) {
      syncOffline();
    }
  }, [dispatch]);

  // K-12 System: Backend already filters for published assessments only
  // All assessments in this list are guaranteed to be published and available for students
  const visibleAssessments = assessments || [];

  const activeList = visibleAssessments.filter((a) => a.status !== "ended");
  const endedList = visibleAssessments.filter((a) => a.status === "ended");

  const currentList = activeTab === "active" ? activeList : endedList;

  const completedCount = visibleAssessments.filter(
    (a) =>
      a.status === "submitted" ||
      a.submissions?.some((s) => s.status === "submitted" && !!s.finishedAt),
  ).length;

  const upcomingCount = activeList.filter((a) => {
    const isSubmitted =
      a.status === "submitted" ||
      a.submissions?.some((s) => s.status === "submitted" && !!s.finishedAt);
    return !isSubmitted;
  }).length;

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col relative font-sans overflow-x-hidden">
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[#e0e7ff] opacity-60" />
        <div className="absolute top-0 left-0 w-full h-[800px] bg-[radial-gradient(at_0%_0%,hsla(253,16%,7%,1)_0,transparent_50%)] opactity-80" />
        <div className="absolute top-0 left-[50%] w-full h-[600px] bg-[radial-gradient(at_50%_0%,hsla(225,39%,30%,1)_0,transparent_50%)] opacity-60" />
        <div className="absolute top-0 right-0 w-full h-[600px] bg-[radial-gradient(at_100%_0%,hsla(339,49%,30%,1)_0,transparent_50%)] opacity-50" />
      </div>

      <div className="relative z-10 w-full">
        <ProductTour tourKey="student_dashboard" steps={studentTourSteps} />
        <StudentHeader transparent={true} />

        <main className="w-full pb-20">
          <div className="relative pt-16 pb-24 text-center px-4">
            <div className="max-w-4xl mx-auto space-y-4">
              <span className="inline-block py-1 px-3 text-xs font-semibold tracking-wider uppercase mb-2" style={{ borderRadius: "var(--radius-xl)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)" }}>
                Online Assessment Platform
              </span>
              <h1 className="text-4xl md:text-6xl font-serif font-bold mb-4 drop-shadow-sm tracking-tight" style={{ color: "white" }}>
                Welcome back, {user?.firstName || "Student"}!
              </h1>
              <p className="text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>
                Your academic journey continues. You have{" "}
                <span className="font-bold px-1" style={{ color: "white", borderBottom: "2px solid rgba(255,255,255,0.5)" }}>
                  {activeList.length} assessment
                  {activeList.length !== 1 ? "s" : ""}
                </span>{" "}
                waiting for you.
              </p>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
            {/* Stats Grid */}
            <div className="student-stats-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
              <div className="p-5 flex items-center gap-4 cursor-default" style={{ background: "rgba(255,255,255,0.92)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
                <div className="w-12 h-12 flex items-center justify-center" style={{ borderRadius: "var(--radius-lg)", background: "var(--violet-tint)", color: "var(--violet-ink)" }}>
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
                    Total Assessments
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {visibleAssessments.length}
                  </p>
                </div>
              </div>

              <div className="p-5 flex items-center gap-4 cursor-default" style={{ background: "rgba(255,255,255,0.92)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
                <div className="w-12 h-12 flex items-center justify-center" style={{ borderRadius: "var(--radius-lg)", background: "var(--amber-tint)", color: "var(--amber-signal)" }}>
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
                    Upcoming Exams
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {upcomingCount}
                  </p>
                </div>
              </div>

              <div className="p-5 flex items-center gap-4 cursor-default" style={{ background: "rgba(255,255,255,0.92)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
                <div className="w-12 h-12 flex items-center justify-center" style={{ borderRadius: "var(--radius-lg)", background: "var(--emerald-tint)", color: "var(--emerald-signal)" }}>
                  <CheckSquare className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
                    Completed Tests
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {completedCount}
                  </p>
                </div>
              </div>

              <Link
                href="/student/fees"
                className="p-5 flex items-center justify-between gap-3 group transition-transform hover:scale-105"
                style={{ background: "rgba(255,255,255,0.95)", borderRadius: "var(--radius-xl)", border: "1px solid #10b981", boxShadow: "0 4px 12px rgba(16,185,129,0.15)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                      School Fees
                    </p>
                    <p className="text-xs font-semibold text-slate-600">
                      Invoices &amp; Paystack
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center justify-center mb-10 overflow-x-auto no-scrollbar px-2">
              <div className="p-1.5 flex gap-1 sm:gap-2 shrink-0" style={{ background: "rgba(255,255,255,0.15)", borderRadius: "var(--radius-xl)", border: "1px solid rgba(255,255,255,0.2)" }}>
                <button
                  onClick={() => setActiveTab("active")}
                  className="relative px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-1.5 sm:gap-2"
                  style={{ borderRadius: "var(--radius-lg)", color: activeTab === "active" ? "var(--violet-ink)" : "rgba(255,255,255,0.7)" }}
                >
                  {activeTab === "active" && (
                    <motion.div
                      layoutId="activeTabBg"
                      className="absolute inset-0 z-0"
                      style={{ background: "white", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)" }}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <PlayCircle className="w-4 h-4 relative z-10" style={{ color: activeTab === "active" ? "var(--violet-ink)" : "rgba(255,255,255,0.5)" }} />
                  <span className="relative z-10">Active Exams</span>
                  {activeList.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="relative z-10 ml-1 px-2 py-0.5 text-[10px] font-black hidden sm:inline-block"
                      style={{ borderRadius: "var(--radius-xl)", background: activeTab === "active" ? "var(--violet-tint)" : "rgba(255,255,255,0.2)", color: activeTab === "active" ? "var(--violet-ink)" : "rgba(255,255,255,0.8)" }}
                    >
                      {activeList.length}
                    </motion.span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("ended")}
                  className="relative px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-1.5 sm:gap-2"
                  style={{ borderRadius: "var(--radius-lg)", color: activeTab === "ended" ? "var(--crimson-signal)" : "rgba(255,255,255,0.7)" }}
                >
                  {activeTab === "ended" && (
                    <motion.div
                      layoutId="activeTabBg"
                      className="absolute inset-0 z-0"
                      style={{ background: "white", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)" }}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Clock className="w-4 h-4 relative z-10" style={{ color: activeTab === "ended" ? "var(--crimson-signal)" : "rgba(255,255,255,0.5)" }} />
                  <span className="relative z-10">History</span>
                  {endedList.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="relative z-10 ml-1 px-2 py-0.5 text-[10px] font-black hidden sm:inline-block"
                      style={{ borderRadius: "var(--radius-xl)", background: activeTab === "ended" ? "var(--crimson-tint)" : "rgba(255,255,255,0.2)", color: activeTab === "ended" ? "var(--crimson-signal)" : "rgba(255,255,255,0.8)" }}
                    >
                      {endedList.length}
                    </motion.span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("reports")}
                  className="relative px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-1.5 sm:gap-2"
                  style={{ borderRadius: "var(--radius-lg)", color: activeTab === "reports" ? "var(--emerald-signal)" : "rgba(255,255,255,0.7)" }}
                >
                  {activeTab === "reports" && (
                    <motion.div
                      layoutId="activeTabBg"
                      className="absolute inset-0 z-0"
                      style={{ background: "white", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)" }}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <BookOpen className="w-4 h-4 relative z-10" style={{ color: activeTab === "reports" ? "var(--emerald-signal)" : "rgba(255,255,255,0.5)" }} />
                  <span className="relative z-10">Report Cards</span>
                </button>

                <Link
                  href="/student/fees"
                  className="relative px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-1.5 sm:gap-2 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700/30"
                >
                  <Banknote className="w-4 h-4 text-emerald-300" />
                  <span>Pay Fees</span>
                </Link>
              </div>
            </div>

            {activeTab === "reports" ? (
              <StudentReportCardTab
                sessionOptions={sessionOptions}
                termOptions={termOptionsForSession}
                selectedSession={selectedSession}
                selectedTerm={selectedTerm}
                onSessionChange={(v) => { setSelectedSession(v); setSelectedTerm(""); }}
                onTermChange={setSelectedTerm}
                reportCard={reportCard}
                reportLoading={reportLoading}
                reportError={reportError}
                onDownload={handleDownloadPdf}
                downloadingPdf={downloadingPdf}
              />
            ) : loading ? (
              <div className="flex flex-col items-center justify-center py-20" style={{ background: "rgba(255,255,255,0.12)", borderRadius: "var(--radius-xl)", border: "1px solid rgba(255,255,255,0.15)" }}>
                <div className="animate-spin rounded-full h-12 w-12 mb-4" style={{ border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "white" }} />
                <p className="font-medium" style={{ color: "white" }}>
                  Loading your assessments...
                </p>
              </div>
            ) : error ? (
              <div className="p-8 text-center max-w-2xl mx-auto" style={{ background: "rgba(255,255,255,0.92)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
                <AlertCircle className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--crimson-signal)" }} />
                <h3 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
                  Unavailable
                </h3>
                <p className="font-medium mb-6" style={{ color: "var(--crimson-signal)" }}>{error}</p>
                <button
                  onClick={() => dispatch(fetchStudentAssessments())}
                  className="px-8 py-3 font-semibold text-white"
                  style={{ background: "var(--crimson-signal)", borderRadius: "var(--radius-lg)", border: "none" }}
                >
                  Retry Connection
                </button>
              </div>
            ) : currentList.length === 0 ? (
              <div className="p-16 text-center max-w-3xl mx-auto" style={{ background: "rgba(255,255,255,0.12)", borderRadius: "var(--radius-xl)", border: "1px solid rgba(255,255,255,0.15)" }}>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(255,255,255,0.15)" }}>
                  {activeTab === "active" ? (
                    <ClipboardList className="w-12 h-12" style={{ color: "rgba(255,255,255,0.6)" }} />
                  ) : (
                    <Clock className="w-12 h-12" style={{ color: "rgba(255,255,255,0.6)" }} />
                  )}
                </div>
                <h3 className="text-2xl font-bold mb-3 font-serif" style={{ color: "white" }}>
                  {activeTab === "active" ? "All Caught Up!" : "No History Yet"}
                </h3>
                <p className="text-lg max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {activeTab === "active"
                    ? "You have no pending assessments at the moment. Enjoy your free time!"
                    : "Your completed and expired exams will appear here in the future."}
                </p>
              </div>
            ) : (
              <motion.div
                layout
                className="student-assessments-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20"
              >
                <AnimatePresence mode="popLayout">
                  {currentList.map((assessment, idx) => {
                    const subjectName = assessment.subject?.name || "General";
                    // ... (rest of normalization logic inside map)
                    const isMath = subjectName.toLowerCase().includes("math");
                    const isScience =
                      subjectName.toLowerCase().includes("science") ||
                      subjectName.toLowerCase().includes("physics") ||
                      subjectName.toLowerCase().includes("chem");
                    const isSubmitted =
                      assessment.status === "submitted" ||
                      assessment.submissions?.some(
                        (s) => s.status === "submitted" || !!s.finishedAt,
                      );
                    const isOffline = assessment.isOnline === false;

                    let statusLabel = "Not Started";
                    let statusStyle: React.CSSProperties = { background: "rgba(255,255,255,0.6)", color: "var(--foreground-muted)", border: "1px solid var(--border-fine)" };
                    if (isSubmitted) {
                      statusLabel = "Completed";
                      statusStyle = { background: "var(--emerald-tint)", color: "var(--emerald-signal)", border: "1px solid var(--border-fine)" };
                    } else if (
                      assessment.status === "started" ||
                      assessment.submissions?.some(
                        (s) =>
                          s.status === "started" || s.status === "in_progress",
                      )
                    ) {
                      statusLabel = "In Progress";
                      statusStyle = { background: "var(--amber-tint)", color: "var(--amber-signal)", border: "1px solid var(--border-fine)" };
                    } else if (assessment.status === "ended") {
                      statusLabel = "Ended";
                      statusStyle = { background: "var(--crimson-tint)", color: "var(--crimson-signal)", border: "1px solid var(--border-fine)" };
                    }

                    // Subject accent colors (solid, no gradient)
                    const subjectAccentBg = isMath
                      ? "oklch(0.55 0.22 0)"
                      : isScience
                        ? "oklch(0.55 0.18 220)"
                        : "var(--violet-ink)";

                    const iconBg = isMath
                      ? "oklch(0.95 0.04 0)"
                      : isScience
                        ? "oklch(0.95 0.04 220)"
                        : "var(--violet-tint)";

                    const iconColor = isMath
                      ? "oklch(0.55 0.22 0)"
                      : isScience
                        ? "oklch(0.55 0.18 220)"
                        : "var(--violet-ink)";

                    return (
                      <motion.div
                        key={assessment.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4, delay: idx * 0.05 }}
                        className="group flex flex-col h-auto min-h-[340px] relative overflow-hidden hover:-translate-y-2 transition-all duration-300"
                        style={{ background: "rgba(255,255,255,0.92)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)", padding: "1.5rem" }}
                      >
                        {/* Subject tag */}
                        <div
                          className="absolute top-0 left-1/2 transform -translate-x-1/2 text-white text-[10px] font-bold px-3 py-1 uppercase tracking-wide z-10"
                          style={{ background: subjectAccentBg, borderRadius: "0 0 var(--radius-md) var(--radius-md)" }}
                        >
                          {subjectName} {isOffline ? "(Offline)" : ""}
                        </div>

                        <div className="mt-4 flex justify-between items-start mb-6 z-10 relative">
                          <div
                            className="w-14 h-14 flex items-center justify-center"
                            style={{ borderRadius: "var(--radius-lg)", background: iconBg, color: iconColor, border: "1px solid var(--border-fine)" }}
                          >
                            {isMath ? (
                              <Calculator className="w-7 h-7" />
                            ) : isScience ? (
                              <Beaker className="w-7 h-7" />
                            ) : (
                              <ClipboardList className="w-7 h-7" />
                            )}
                          </div>
                          <span
                            className="px-3 py-1 text-xs font-bold tracking-wide uppercase"
                            style={{ borderRadius: "var(--radius-xl)", ...statusStyle }}
                          >
                            {statusLabel}
                          </span>
                        </div>

                        <h2 className="text-xl font-bold mb-2 relative z-10" style={{ color: "var(--foreground)" }}>
                          {assessment.title}
                        </h2>
                        <p className="text-sm mb-6 line-clamp-2 leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                          {assessment.instructions ||
                            "No detailed instructions provided for this assessment."}
                        </p>

                        <div className="mt-auto space-y-4 relative z-10">
                          <div className="flex items-center gap-3 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                            {!isOffline && (
                              <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)" }}>
                                <Clock className="w-4 h-4" style={{ color: iconColor }} />
                                <span>{assessment.durationMins} Mins</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)" }}>
                              <CheckCircle className="w-4 h-4" style={{ color: iconColor }} />
                              <span>{assessment.questionCount || "?"} Qs</span>
                            </div>
                          </div>

                          {isSubmitted ? (
                            <button
                              onClick={() => setResultAssessment(assessment)}
                              className="w-full font-semibold py-4 flex items-center justify-center gap-2 text-white"
                              style={{ background: "var(--emerald-signal)", borderRadius: "var(--radius-lg)", border: "none" }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                            >
                              View Result <BarChart3 className="w-4 h-4" />
                            </button>
                          ) : isOffline ? (
                            <button className="w-full font-semibold py-4 flex items-center justify-center gap-2 cursor-not-allowed" style={{ background: "var(--surface-muted)", color: "var(--foreground-muted)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }} disabled>
                              Paper Exam <Lock className="w-4 h-4" />
                            </button>
                          ) : statusLabel === "Ended" ? (
                            <button className="w-full font-semibold py-4 flex items-center justify-center gap-2 cursor-not-allowed" style={{ background: "var(--surface-muted)", color: "var(--crimson-signal)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }} disabled>
                              Time Expired <Lock className="w-4 h-4" />
                            </button>
                          ) : (
                            <Link
                              href={`/student/lobby?assessmentId=${assessment.id}`}
                              className="student-enter-lobby-button block"
                            >
                              <button
                                className="w-full text-white py-4 flex items-center justify-center gap-2 transition-all font-bold"
                                style={{ background: subjectAccentBg, borderRadius: "var(--radius-lg)", border: "none", boxShadow: "var(--shadow-card)" }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                              >
                                {statusLabel === "In Progress"
                                  ? "Resume Exam"
                                  : "Enter Lobby"}
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                              </button>
                            </Link>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </main>
      </div>

      {/* Result Modal */}
      {resultAssessment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(12px)" }}
          onClick={() => setResultAssessment(null)}
        >
          <div
            className="max-w-md w-full p-6 sm:p-8"
            style={{ background: "white", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Assessment Result</h2>
              <button
                onClick={() => setResultAssessment(null)}
                className="w-8 h-8 flex items-center justify-center transition-colors"
                style={{ borderRadius: "50%", background: "var(--surface-muted)", color: "var(--foreground-muted)", border: "none" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--border-fine)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--surface-muted)")}
              >
                ✕
              </button>
            </div>
            <p className="text-xl font-bold mb-1" style={{ color: "var(--foreground)" }}>{resultAssessment.title}</p>
            <p className="text-sm mb-6" style={{ color: "var(--foreground-muted)" }}>
              {resultAssessment.subject?.name || "General"} •{" "}
              {resultAssessment.subject?.class?.name || ""}
            </p>
            {(() => {
              const submission = resultAssessment.submissions?.[0];
              const score = submission?.score ?? submission?.totalScore ?? null;
              const totalMarks = resultAssessment.totalMarks ?? resultAssessment.maxMarks ?? null;
              const passingMarks = resultAssessment.passingMarks ?? null;
              const passed = score !== null && passingMarks !== null ? score >= passingMarks : null;

              return (
                <div className="space-y-4">
                  <div className="p-5 text-center" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-lg)" }}>
                    {score !== null ? (
                      <>
                        <p className="text-5xl font-black" style={{ color: "var(--foreground)" }}>
                          {score}
                          {totalMarks !== null && (
                            <span className="text-2xl font-medium" style={{ color: "var(--foreground-muted)" }}>/{totalMarks}</span>
                          )}
                        </p>
                        {totalMarks !== null && (
                          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
                            {((score / totalMarks) * 100).toFixed(1)}%
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="py-3">
                        <Clock className="w-10 h-10 mx-auto mb-2" style={{ color: "var(--amber-signal)" }} />
                        <p className="font-medium" style={{ color: "var(--foreground)" }}>Awaiting Manual Grading</p>
                        <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>Your teacher is reviewing your answers.</p>
                      </div>
                    )}
                  </div>
                  {passed !== null && (
                    <div className="px-4 py-3 text-center font-semibold text-sm" style={{ borderRadius: "var(--radius-lg)", background: passed ? "var(--emerald-tint)" : "var(--crimson-tint)", color: passed ? "var(--emerald-signal)" : "var(--crimson-signal)" }}>
                      {passed ? "✓ Passed" : "✗ Did not meet passing mark"}
                      {passingMarks !== null && (
                        <span className="font-normal opacity-75"> (passing: {passingMarks})</span>
                      )}
                    </div>
                  )}
                  {submission?.finishedAt && (
                    <p className="text-xs text-center" style={{ color: "var(--foreground-muted)" }}>
                      Submitted {new Date(submission.finishedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Student Report Card Tab ─────────────────────────────────────────────────

type StudentReportCardTabProps = {
  sessionOptions: { value: string; label: string }[];
  termOptions: { value: string; label: string }[];
  selectedSession: string;
  selectedTerm: string;
  onSessionChange: (v: string) => void;
  onTermChange: (v: string) => void;
  reportCard: any;
  reportLoading: boolean;
  reportError: boolean;
  onDownload: () => void;
  downloadingPdf: boolean;
};

function StudentReportCardTab({
  sessionOptions,
  termOptions,
  selectedSession,
  selectedTerm,
  onSessionChange,
  onTermChange,
  reportCard,
  reportLoading,
  reportError,
  onDownload,
  downloadingPdf,
}: StudentReportCardTabProps) {
  const raw = reportCard?.data ?? reportCard;

  // The grades API returns: { studentId, term, session, grades: { overall: {...}, [subjectId]: SubjectGrade }, student: {...} }
  // When the student has no active enrollments/subjects, the backend returns overall.grade = 'N/A'
  const data = raw;
  const gradesMap: Record<string, any> = data?.grades ?? {};
  const overall = gradesMap.overall;
  const subjects: any[] = Object.entries(gradesMap)
    .filter(([k]) => k !== "overall")
    .map(([subjectId, grade]: [string, any]) => ({ subjectId, ...grade }));
  const studentName = data?.student
    ? `${data.student.firstName || ""} ${data.student.lastName || ""}`.trim()
    : data?.studentName ?? "";
  const average = overall?.percent ?? data?.summary?.average ?? data?.average ?? null;
  const overallGrade = overall?.grade ?? data?.summary?.overallGrade ?? data?.overallGrade ?? null;
  // grades API generates on-the-fly, no published status — treat data presence as availability
  const isAvailable = !!data && (subjects.length > 0 || !!overall);
  // 'N/A' grade means backend found no subjects/enrollments for this student — no real scores yet
  const hasNoScores = subjects.length === 0 && (overallGrade === "N/A" || overall?.score === 0);

  const getGradeStyle = (grade: string): React.CSSProperties => {
    switch (grade?.toUpperCase()) {
      case "A": case "A+": return { background: "var(--emerald-tint)", color: "var(--emerald-signal)" };
      case "B": case "B+": return { background: "var(--cobalt-tint)", color: "var(--cobalt-signal)" };
      case "C": case "C+": return { background: "var(--amber-tint)", color: "var(--amber-signal)" };
      case "F": return { background: "var(--crimson-tint)", color: "var(--crimson-signal)" };
      default: return { background: "var(--surface-muted)", color: "var(--foreground-muted)" };
    }
  };

  const emptyCardStyle: React.CSSProperties = { background: "rgba(255,255,255,0.12)", borderRadius: "var(--radius-xl)", border: "1px solid rgba(255,255,255,0.15)" };

  return (
    <div className="space-y-6 pb-20">
      {/* Session / Term selectors */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3" style={{ background: "rgba(255,255,255,0.92)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)" }}>
        <Select value={selectedSession} onValueChange={onSessionChange}>
          <SelectTrigger className="h-11 flex-1" style={{ borderRadius: "var(--radius-lg)" }}>
            <SelectValue placeholder="Select Session" />
          </SelectTrigger>
          <SelectContent style={{ borderRadius: "var(--radius-lg)" }}>
            {sessionOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedTerm} onValueChange={onTermChange} disabled={!selectedSession}>
          <SelectTrigger className="h-11 flex-1" style={{ borderRadius: "var(--radius-lg)" }}>
            <SelectValue placeholder="Select Term" />
          </SelectTrigger>
          <SelectContent style={{ borderRadius: "var(--radius-lg)" }}>
            {termOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* States */}
      {!selectedSession || !selectedTerm ? (
        <div className="p-12 text-center" style={emptyCardStyle}>
          <BookOpen className="w-14 h-14 mx-auto mb-4" style={{ color: "rgba(255,255,255,0.4)" }} />
          <p className="font-semibold text-lg" style={{ color: "white" }}>Select a session and term</p>
          <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>Your report cards will appear here once you choose an academic period.</p>
        </div>
      ) : reportLoading ? (
        <div className="p-12 text-center" style={emptyCardStyle}>
          <div className="animate-spin rounded-full h-10 w-10 mx-auto mb-4" style={{ border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "white" }} />
          <p className="font-medium" style={{ color: "white" }}>Loading your report card…</p>
        </div>
      ) : reportError ? (
        <div className="p-12 text-center" style={emptyCardStyle}>
          <AlertCircle className="w-14 h-14 mx-auto mb-4" style={{ color: "var(--crimson-signal)" }} />
          <p className="font-semibold text-lg" style={{ color: "white" }}>Could Not Load Report Card</p>
          <p className="mt-1 text-sm max-w-sm mx-auto" style={{ color: "rgba(255,255,255,0.65)" }}>
            There was a problem fetching your report card. Please try again or contact your school administrator.
          </p>
        </div>
      ) : !isAvailable ? (
        <div className="p-12 text-center" style={emptyCardStyle}>
          <FileText className="w-14 h-14 mx-auto mb-4" style={{ color: "rgba(255,255,255,0.35)" }} />
          <p className="font-semibold text-lg" style={{ color: "white" }}>No Report Card Available</p>
          <p className="mt-1 text-sm max-w-sm mx-auto" style={{ color: "rgba(255,255,255,0.65)" }}>
            No grades have been recorded for this period yet. Check back after your teacher submits scores.
          </p>
        </div>
      ) : hasNoScores ? (
        <div className="p-12 text-center" style={emptyCardStyle}>
          <BarChart3 className="w-14 h-14 mx-auto mb-4" style={{ color: "rgba(255,255,255,0.35)" }} />
          <p className="font-semibold text-lg" style={{ color: "white" }}>No Scores Recorded Yet</p>
          <p className="mt-1 text-sm max-w-sm mx-auto" style={{ color: "rgba(255,255,255,0.65)" }}>
            Your teacher hasn't uploaded scores for this term yet. Report cards will appear here once scores are available.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden" style={{ background: "rgba(255,255,255,0.95)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          {/* Header */}
          <div className="p-5 sm:p-6 text-white" style={{ background: "var(--emerald-signal)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">{studentName || "Report Card"}</h3>
                <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.8)" }}>
                  {selectedSession} • {selectedTerm}
                </p>
              </div>
              <div className="flex flex-col sm:items-end gap-2">
                {average != null && (
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" style={{ color: "rgba(255,255,255,0.8)" }} />
                    <span className="text-2xl font-black">{Number(average).toFixed(1)}%</span>
                  </div>
                )}
                {overallGrade && (
                  <span className="px-3 py-1 text-sm font-bold" style={{ background: "rgba(255,255,255,0.2)", borderRadius: "var(--radius-xl)" }}>
                    Grade: {overallGrade}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Subject scores */}
          {subjects.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border-fine)" }}>
                    <th className="text-left py-3 px-4 sm:px-5 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>Subject</th>
                    <th className="text-center py-3 px-3 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>Score</th>
                    <th className="text-center py-3 px-3 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>Max</th>
                    <th className="text-center py-3 px-3 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>%</th>
                    <th className="text-center py-3 px-3 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subj: any, i: number) => {
                    const name = subj.subjectName || subj.name || "—";
                    const score = subj.score ?? subj.totalScore ?? "—";
                    const max = subj.max ?? "—";
                    const pct = subj.percent != null ? Number(subj.percent).toFixed(1) + "%" : "—";
                    const grade = subj.grade ?? subj.letterGrade ?? "—";
                    return (
                      <tr
                        key={i}
                        style={{ borderBottom: "1px solid var(--border-fine)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-muted)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                      >
                        <td className="py-3 px-4 sm:px-5 font-medium text-sm" style={{ color: "var(--foreground)" }}>{name}</td>
                        <td className="py-3 px-3 text-center font-bold text-sm" style={{ color: "var(--foreground)" }}>{score}</td>
                        <td className="py-3 px-3 text-center text-sm" style={{ color: "var(--foreground-muted)" }}>{max}</td>
                        <td className="py-3 px-3 text-center text-sm" style={{ color: "var(--foreground-muted)" }}>{pct}</td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 text-xs font-bold" style={{ borderRadius: "var(--radius-xl)", ...getGradeStyle(grade) }}>
                            {grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Download button */}
          <div className="p-4 sm:p-5 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border-fine)" }}>
            <button
              onClick={onDownload}
              disabled={downloadingPdf || hasNoScores || subjects.length === 0}
              className="w-full sm:w-auto h-11 font-semibold flex items-center justify-center gap-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--emerald-signal)", borderRadius: "var(--radius-lg)", border: "none", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}
              onMouseEnter={e => { if (!downloadingPdf && subjects.length > 0) e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <Download className="w-4 h-4" />
              {downloadingPdf ? "Downloading…" : "Download PDF"}
            </button>
            {subjects.length === 0 && (
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>PDF available once subject scores are recorded.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
