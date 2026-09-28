"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { fetchAssessmentDetail, fetchAssessmentSubmissions } from "@/reduxToolKit/teacher/teacherThunks";
import { useGradeAnswerMutation } from "@/reduxToolKit/api/endpoints/assessments";
import { Search, ArrowLeft, Check, Star, ArrowRight, CheckCircle, Calendar, Menu, X, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import Image from "next/image";
import logo from "../../../public/mainLogo.svg";

export function TeacherGradingPage() {
  const params = useParams<{ assessmentId: string; submissionId: string }>();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  const { selectedAssessment, submissions: rawSubmissions, loading } = useSelector((s: RootState) => s.teacher);

  const questions = useMemo(() => {
    return selectedAssessment?.questions || [];
  }, [selectedAssessment]);

  const submissions = useMemo(() => {
    return (rawSubmissions || []).filter((s: any) => {
      const st = s.status?.toLowerCase() || "";
      return !st.includes("in_progress") && !st.includes("in progress") && st !== "not_started";
    });
  }, [rawSubmissions]);

  const [gradeAnswer, { isLoading: isGrading }] = useGradeAnswerMutation();

  const assessmentId = params?.assessmentId as string;
  const submissionId = params?.submissionId as string;

  const [search, setSearch] = useState("");
  const [gradingState, setGradingState] = useState<Record<string, { marksAwarded: string; comment: string }>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!assessmentId) return;
    dispatch(fetchAssessmentDetail(assessmentId));
    dispatch(fetchAssessmentSubmissions(assessmentId));
  }, [dispatch, assessmentId]);

  useEffect(() => {
    if (!loading && submissions.length > 0 && !submissionId) {
      router.replace(`/teacher/assessments/${assessmentId}/grade/${submissions[0].id}`);
    }
  }, [loading, submissions, submissionId, assessmentId, router]);

  const submission: any = useMemo(() => {
    return submissions.find((s: any) => s.id === submissionId);
  }, [submissions, submissionId]);

  const filteredSubmissions = useMemo(() => {
    if (!search) return submissions;
    const lower = search.toLowerCase();
    return submissions.filter((s: any) => {
      const name = `${s.student?.firstName || ""} ${s.student?.lastName || ""}`.toLowerCase();
      const matric = (s.student?.matricNumber || "").toLowerCase();
      const stdId = (s.student?.studentId || s.studentId || "").toLowerCase();
      return name.includes(lower) || matric.includes(lower) || stdId.includes(lower);
    });
  }, [submissions, search]);

  const pendingCount = useMemo(() => {
    return submissions.filter((s: any) => s.status === "submitted" || !s.status || s.status.includes("pending")).length;
  }, [submissions]);

  const currentIndex = submissions.findIndex((s: any) => s.id === submissionId);
  const nextSubmission = submissions[currentIndex + 1];

  useEffect(() => {
    if (submission && submission.answers) {
      const initialState: Record<string, { marksAwarded: string; comment: string }> = {};
      submission.answers.forEach((ans: any) => {
        const earned = ans.marksAwarded ?? ans.score ?? ans.grade;
        initialState[ans.id] = {
          marksAwarded: earned !== null && earned !== undefined ? String(earned) : "0",
          comment: ans.comment || ans.teacherComment || "",
        };
      });
      setGradingState(initialState);
    }
  }, [submission]);

  const isTheoryQuestion = (q: any) =>
    ["theory", "essay", "short_answer", "text"].some(
      (t) =>
        String(q?.type || "").toLowerCase() === t ||
        String(q?.questionType || "").toLowerCase() === t
    );

  const handleSaveProgress = async () => {
    if (!submission?.answers?.length) return;
    setIsSavingAll(true);
    let errorCount = 0;

    const answersToGrade = submission.answers.filter((ans: any) => {
      const q = selectedAssessment?.questions?.find((q: any) => q.id === ans.questionId);
      return q && isTheoryQuestion(q);
    });

    if (answersToGrade.length === 0) {
      toast.info("No theory questions to grade.");
      setIsSavingAll(false);
      return;
    }

    const promises = answersToGrade.map(async (ans: any) => {
      const data = gradingState[ans.id];
      if (!data) return;
      try {
        await gradeAnswer({
          submissionId,
          answerId: ans.id,
          marksAwarded: Number(data.marksAwarded || 0),
          comment: data.comment,
        }).unwrap();
      } catch (err: any) {
        errorCount++;
        console.error("[SaveProgress] Failed to save grade for answer", ans.id, err?.data || err);
      }
    });

    await Promise.all(promises);
    setIsSavingAll(false);

    if (errorCount === 0) {
      toast.success("Progress saved successfully");
    } else {
      toast.error(`Saved with ${errorCount} error(s). Check console for details.`);
    }
  };

  const handleSaveAndNext = async () => {
    await handleSaveProgress();
    if (nextSubmission) {
      router.push(`/teacher/assessments/${assessmentId}/grade/${nextSubmission.id}`);
    } else {
      toast.success("All students graded in this list!");
      router.push(`/teacher/assessments`);
    }
  };

  if (loading && !selectedAssessment) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
      </div>
    );
  }

  if (submissions.length === 0 && !loading) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4" style={{ background: "var(--surface-muted)" }}>
        <div className="p-8 text-center max-w-sm" style={{ background: "white", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: "var(--surface-muted)" }}>
            <Star className="w-6 h-6" style={{ color: "var(--foreground-muted)" }} />
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>No Submissions Yet</h2>
          <p className="text-sm mb-6" style={{ color: "var(--foreground-muted)" }}>Students have not submitted this assessment yet. Check back later.</p>
          <button
            onClick={() => router.push(`/teacher/assessments`)}
            className="px-6 py-2 font-bold text-sm"
            style={{ background: "var(--violet-ink)", color: "white", borderRadius: "var(--radius-md)", border: "none" }}
          >
            Back to Assessments
          </button>
        </div>
      </div>
    );
  }

  if (!submission && submissions.length > 0 && submissionId) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4" style={{ background: "var(--surface-muted)" }}>
        <div className="p-8 text-center max-w-sm" style={{ background: "white", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Submission Not Found</h2>
          <p className="text-sm mb-6" style={{ color: "var(--foreground-muted)" }}>The student submission you are looking for does not exist or has been removed.</p>
          <button
            onClick={() => router.push(`/teacher/assessments/${assessmentId}/grade/${submissions[0].id}`)}
            className="px-6 py-2 font-bold text-sm"
            style={{ background: "var(--violet-ink)", color: "white", borderRadius: "var(--radius-md)", border: "none" }}
          >
            Grade First Student
          </button>
        </div>
      </div>
    );
  }

  const studentName = submission?.student?.firstName
    ? `${submission.student.firstName} ${submission.student.lastName}`
    : `Student ID: ${submission?.student?.studentId || submission?.studentId || "Unknown"}`;

  const studentSubID = submission?.student?.studentId || submission?.student?.matricNumber || submission?.studentId || "—";

  const currentTotalCalculated = submission?.answers?.reduce((acc: number, ans: any) => {
    const st = gradingState[ans.id];
    return acc + (Number(st?.marksAwarded) || Number(ans.marksAwarded) || Number(ans.score) || Number(ans.grade) || 0);
  }, 0) || submission?.score || 0;

  return (
    <div className="font-sans overflow-hidden h-screen flex flex-col" style={{ background: "var(--surface-muted)", color: "var(--foreground)" }}>
      {/* Header */}
      <header className="flex-none flex items-center justify-between whitespace-nowrap px-5 py-2.5 z-20" style={{ background: "white", borderBottom: "1px solid var(--border-fine)" }}>
        <div className="flex items-center gap-3">
          <Image src={logo} alt="ParaLearn Logo" className="h-6 md:h-7 w-auto object-contain" />
          <div className="hidden sm:flex flex-col pl-3 ml-2" style={{ borderLeft: "1px solid var(--border-fine)" }}>
            <span className="text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--foreground)" }}>Assessment Grading</span>
            <span className="text-xs font-medium truncate" style={{ color: "var(--foreground-muted)" }}>{selectedAssessment?.title || "Assessment"}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/teacher/assessments`)}
            className="flex cursor-pointer items-center justify-center overflow-hidden h-8 px-4 text-xs font-bold transition-colors"
            style={{ borderRadius: "var(--radius-md)", background: "var(--violet-tint)", color: "var(--violet-ink)", border: "none" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5 hidden sm:block" />
            <span className="truncate">Back to Assessments</span>
          </button>
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex sm:hidden h-8 w-8 items-center justify-center transition-colors"
            style={{ borderRadius: "var(--radius-md)", background: "var(--violet-tint)", color: "var(--violet-ink)", border: "none" }}
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Overlay */}
        {isMobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 sm:hidden transition-opacity"
            style={{ background: "rgba(15,23,42,0.5)" }}
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`w-[260px] md:w-72 flex-none flex flex-col z-50 fixed inset-y-0 left-0 transition-transform duration-300 ease-in-out sm:relative sm:translate-x-0 ${isMobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`} style={{ background: "white", borderRight: "1px solid var(--border-fine)" }}>
          <div className="p-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border-fine)" }}>
            <div className="relative flex items-center w-full h-9 overflow-hidden" style={{ borderRadius: "var(--radius-md)", background: "var(--surface-muted)", border: "1px solid var(--border-fine)" }}>
              <Search className="absolute left-2.5 w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
              <input
                className="peer h-full w-full outline-none text-xs bg-transparent pl-8 pr-3"
                style={{ color: "var(--foreground)" }}
                placeholder="Filter students..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="sm:hidden h-9 w-9 flex-none flex items-center justify-center"
              style={{ borderRadius: "var(--radius-md)", background: "var(--surface-muted)", color: "var(--foreground-muted)", border: "none" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filteredSubmissions.map((sub: any) => {
              const stdName = sub.student?.firstName ? `${sub.student.firstName} ${sub.student.lastName}` : `ID: ${sub.student?.studentId || sub.studentId}`;
              const stdReadableId = sub.student?.studentId || sub.student?.matricNumber || sub.studentId?.slice(0, 8);
              const isActive = sub.id === submissionId;
              const isGraded = sub.status === "graded";
              const hasFlags = sub.antiMalpracticeData && (
                (sub.antiMalpracticeData.tabSwitchCount || 0) > 0 ||
                (sub.antiMalpracticeData.windowBlurCount || 0) > 0 ||
                (sub.antiMalpracticeData.autoFlaggedQuestions && sub.antiMalpracticeData.autoFlaggedQuestions.length > 0)
              );

              return (
                <button
                  key={sub.id}
                  onClick={() => {
                    router.push(`/teacher/assessments/${assessmentId}/grade/${sub.id}`);
                    setIsMobileSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 p-2.5 text-left transition-all relative overflow-hidden"
                  style={{
                    borderRadius: "var(--radius-md)",
                    background: isActive ? "var(--violet-tint)" : "transparent",
                    border: isActive ? "1px solid var(--border-medium)" : "1px solid transparent",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--surface-muted)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: "var(--violet-ink)" }} />}
                  <div className="h-8 w-8 flex-none rounded-full overflow-hidden" style={{ border: `1px solid ${isGraded ? "var(--emerald-signal)" : isActive ? "var(--violet-ink)" : "var(--border-fine)"}` }}>
                    <img
                      src={sub?.student?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sub?.student?.id || sub?.student?.studentId || sub?.id || 'student'}`}
                      alt=""
                      className="w-full h-full"
                      style={{ background: isGraded ? "var(--emerald-tint)" : isActive ? "var(--violet-tint)" : "var(--surface-muted)" }}
                    />
                  </div>

                  <div className="flex flex-col grow min-w-0">
                    <div className="flex justify-between items-center w-full">
                      <span className="text-sm font-semibold truncate" style={{ color: isActive ? "var(--foreground)" : "var(--foreground-muted)" }}>
                        {stdName}
                      </span>
                      {hasFlags && <AlertTriangle className="w-3.5 h-3.5 animate-pulse" style={{ color: "var(--crimson-signal)" }} />}
                      {isGraded ? (
                        <span className="text-[11px] font-bold" style={{ color: "var(--emerald-signal)" }}>{sub.score || 0}</span>
                      ) : isActive ? (
                        <span className="flex h-1.5 w-1.5 rounded-full" style={{ background: "var(--violet-ink)" }} />
                      ) : null}
                    </div>
                    <span className="text-[11px] truncate" style={{ color: isActive ? "var(--violet-ink)" : "var(--foreground-muted)" }}>
                      {stdReadableId} • {isGraded ? "Graded" : "Pending Review"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="p-3 flex justify-between text-[11px] font-medium" style={{ borderTop: "1px solid var(--border-fine)", background: "var(--surface-muted)", color: "var(--foreground-muted)" }}>
            <span>Total: {submissions.length} Students</span>
            <span>{pendingCount} Pending</span>
          </div>
        </aside>

        {/* Main Content */}
        {!submission ? (
          <main className="flex-1 flex flex-col items-center justify-center" style={{ background: "var(--surface-muted)", color: "var(--foreground-muted)" }}>
            <Star className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm">Select a student from the sidebar to grade.</p>
          </main>
        ) : (
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative" style={{ background: "var(--surface-muted)" }}>
            {/* Grading pane header */}
            <div className="flex-none px-5 py-4 z-10 w-full mb-1" style={{ background: "white", borderBottom: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-5xl mx-auto">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 flex-none rounded-full overflow-hidden transition-transform hover:scale-105" style={{ border: "2px solid var(--border-medium)" }}>
                    <img
                      src={submission?.student?.avatar || submission?.student?.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${submission?.student?.id || submission?.student?.studentId || submission?.id || 'student'}`}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ background: "var(--violet-tint)" }}
                    />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>{studentName}</h1>
                    <div className="flex items-center flex-wrap gap-2 md:gap-3 text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                      <span className="font-bold uppercase tracking-wider" style={{ color: "var(--cobalt-signal)" }}>{studentSubID}</span>
                      <span className="w-1 h-1 rounded-full" style={{ background: "var(--border-medium)" }} />
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Submitted {format(new Date(submission.createdAt || Date.now()), "MMM d, h:mm a")}
                      </span>
                      {submission.status === "graded" && (
                        <>
                          <span className="w-1 h-1 rounded-full" style={{ background: "var(--border-medium)" }} />
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: "var(--emerald-tint)", color: "var(--emerald-signal)" }}>Graded</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {submission?.antiMalpracticeData && (submission.antiMalpracticeData.tabSwitchCount > 0 || submission.antiMalpracticeData.windowBlurCount > 0) && (
                    <div className="hidden md:flex items-center gap-3 px-4 py-2" style={{ background: "var(--crimson-tint)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-medium)" }}>
                      <AlertTriangle className="w-5 h-5" style={{ color: "var(--crimson-signal)" }} />
                      <div className="text-left">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--crimson-signal)" }}>Security Flags</p>
                        <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                          {submission.antiMalpracticeData.tabSwitchCount} Tab {submission.antiMalpracticeData.tabSwitchCount === 1 ? 'Switch' : 'Switches'} • {submission.antiMalpracticeData.windowBlurCount} Focus Lost
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-4 px-5 py-2.5" style={{ background: "var(--violet-tint)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)" }}>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--foreground-muted)" }}>Current Score</p>
                      <p className="text-2xl font-bold leading-none" style={{ color: "var(--violet-ink)" }}>
                        {currentTotalCalculated} <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>/ {selectedAssessment?.totalMarks || 100}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Questions Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-28">
              <div className="max-w-4xl mx-auto space-y-5">
                {(selectedAssessment?.questions || []).map((question: any, idx: number) => {
                  const answerDoc = submission.answers?.find((a: any) => a.questionId === question.id);
                  const answerId = answerDoc?.id;
                  const isTheory = ["theory", "essay", "short_answer", "TEXT"].some(t =>
                    (String(question.type).toLowerCase() === t.toLowerCase()) ||
                    (String(question.questionType).toLowerCase() === t.toLowerCase())
                  );

                  let isCorrect = false;
                  let selectedIds: string[] = [];
                  const options = question.choices || question.options || [];
                  const correctAnswerId = question.correctAnswer || question.correctOption;

                  if (!isTheory) {
                    const rawValue = answerDoc?.value || answerDoc?.answer;
                    if (rawValue) {
                      let parsedValue = rawValue;
                      if (typeof rawValue === 'string') {
                        try { parsedValue = JSON.parse(rawValue); } catch (e) {}
                      }

                      if (Array.isArray(parsedValue)) {
                        selectedIds = parsedValue.map((v: any) => String(typeof v === 'object' ? (v.choiceId || v.id || v) : v));
                      } else if (typeof parsedValue === 'object' && parsedValue !== null) {
                        selectedIds = [String(parsedValue.selected || parsedValue.choiceId)].filter(Boolean);
                      } else if (parsedValue !== undefined && parsedValue !== null) {
                        selectedIds = [String(parsedValue)];
                      }

                      selectedIds = selectedIds.map(id => {
                        if (!options.find((o: any) => String(o.id) === String(id))) {
                          const fallMatch = options.find((o: any) => String(o.text) === String(id));
                          if (fallMatch) return String(fallMatch.id);
                        }
                        return String(id);
                      });

                      const isMultiSelect = question.type === "MULTI_SELECT" || question.questionType === "MULTI_SELECT";
                      const correctIds = options.filter((o: any) => o.isCorrect).map((o: any) => String(o.id));
                      if (correctIds.length === 0 && correctAnswerId) {
                        if (Array.isArray(correctAnswerId)) {
                          correctAnswerId.forEach((c: any) => correctIds.push(String(c)));
                        } else {
                          correctIds.push(String(correctAnswerId));
                        }
                      }

                      let localIsCorrect = false;
                      if (correctIds.length > 0 && selectedIds.length > 0) {
                        localIsCorrect = selectedIds.length === correctIds.length &&
                          selectedIds.every(id => correctIds.includes(id));
                      }

                      if (answerDoc?.isCorrect !== undefined && answerDoc?.isCorrect !== null && !isMultiSelect) {
                        isCorrect = answerDoc.isCorrect;
                      } else {
                        isCorrect = localIsCorrect;
                      }
                    }
                  }

                  const persistedGrade = answerDoc?.marksAwarded ?? answerDoc?.score ?? answerDoc?.grade;
                  const state = gradingState[answerId as string] || { marksAwarded: persistedGrade !== null && persistedGrade !== undefined ? String(persistedGrade) : "0", comment: answerDoc?.comment || answerDoc?.teacherComment || "" };
                  const maxMarks = question.marks || 1;
                  const dbScoreObj = answerDoc?.score ?? answerDoc?.marksAwarded;
                  const earnedMarks = isTheory
                    ? parseFloat(state.marksAwarded || "0")
                    : (dbScoreObj !== undefined && dbScoreObj !== null ? parseFloat(String(dbScoreObj)) : (isCorrect ? maxMarks : 0));

                  const isFlagged = submission?.antiMalpracticeData?.autoFlaggedQuestions?.includes(question.id);

                  if (!isTheory) {
                    return (
                      <div
                        key={question.id || idx}
                        className="overflow-hidden"
                        style={{
                          background: "white",
                          borderRadius: "var(--radius-lg)",
                          border: isFlagged ? `1px solid var(--amber-signal)` : "1px solid var(--border-fine)",
                          boxShadow: "var(--shadow-card)",
                        }}
                      >
                        <div className="flex items-center justify-between px-5 py-3" style={{ background: isFlagged ? "var(--amber-tint)" : "var(--surface-muted)", borderBottom: `1px solid ${isFlagged ? "var(--border-medium)" : "var(--border-fine)"}` }}>
                          <h3 className="font-bold flex items-center gap-2.5 text-sm" style={{ color: "var(--foreground)" }}>
                            <span className="text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider" style={{ background: "var(--border-medium)", color: "var(--foreground-muted)", borderRadius: "var(--radius-sm)" }}>Q{idx + 1}</span>
                            {String(question.type || question.questionType).toUpperCase() === "TRUE_FALSE" ? "True / False" : (question.type === "MULTI_SELECT" || question.questionType === "MULTI_SELECT") ? "Multi-Select" : "Multiple Choice"}
                            {isFlagged && (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider" style={{ background: "var(--amber-tint)", color: "var(--amber-signal)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-sm)" }}>
                                <AlertTriangle className="w-3 h-3 animate-pulse" /> Flagged
                              </span>
                            )}
                          </h3>
                          <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold" style={{ borderRadius: "var(--radius-sm)", background: isCorrect ? "var(--emerald-tint)" : "var(--crimson-tint)", color: isCorrect ? "var(--emerald-signal)" : "var(--crimson-signal)" }}>
                            Auto-Graded: {earnedMarks}/{maxMarks}
                          </span>
                        </div>
                        <div className="p-5">
                          <p className="text-sm font-medium mb-4 leading-relaxed p-3" style={{ color: "var(--foreground)", background: "var(--surface-muted)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)" }}>
                            {question.prompt || question.questionText || question.text}
                          </p>
                          <div className="space-y-2">
                            {options.length > 0 ? options.map((opt: any) => {
                              const isSelected = selectedIds.includes(String(opt.id));
                              const isActualCorrect = opt.isCorrect || String(opt.id) === String(question.correctAnswer) || String(opt.id) === String(question.correctOption);

                              let wrapperStyle: React.CSSProperties = { border: "1px solid var(--border-fine)", background: "white", opacity: 0.8 };
                              let iconStyle: React.CSSProperties = { border: "2px solid var(--border-medium)" };
                              let textStyle: React.CSSProperties = { color: "var(--foreground-muted)" };
                              let badge = null;

                              if (isSelected && isActualCorrect) {
                                wrapperStyle = { border: "1px solid var(--emerald-signal)", background: "var(--emerald-tint)", boxShadow: "var(--shadow-card)" };
                                iconStyle = { border: "2px solid var(--emerald-signal)", background: "var(--emerald-signal)", color: "white" };
                                textStyle = { color: "var(--foreground)", fontWeight: 600 };
                                badge = <span className="text-[10px] font-bold px-2 py-0.5 ml-auto" style={{ borderRadius: "var(--radius-sm)", background: "var(--emerald-tint)", color: "var(--emerald-signal)", border: "1px solid var(--emerald-signal)" }}>Selected (Correct)</span>;
                              } else if (isSelected && !isActualCorrect) {
                                wrapperStyle = { border: "1px solid var(--crimson-signal)", background: "var(--crimson-tint)", boxShadow: "var(--shadow-card)" };
                                iconStyle = { border: "2px solid var(--crimson-signal)", background: "var(--crimson-signal)", color: "white" };
                                textStyle = { color: "var(--foreground)", fontWeight: 600 };
                                badge = <span className="text-[10px] font-bold px-2 py-0.5 ml-auto" style={{ borderRadius: "var(--radius-sm)", background: "var(--crimson-tint)", color: "var(--crimson-signal)", border: "1px solid var(--crimson-signal)" }}>Student Answer</span>;
                              } else if (!isSelected && isActualCorrect) {
                                wrapperStyle = { border: "1px dashed var(--emerald-signal)", background: "var(--emerald-tint)" };
                                iconStyle = { border: "2px solid var(--emerald-signal)", color: "var(--emerald-signal)", background: "white" };
                                textStyle = { color: "var(--foreground)" };
                                badge = <span className="text-[10px] font-bold px-2 py-0.5 ml-auto" style={{ borderRadius: "var(--radius-sm)", background: "var(--surface-muted)", color: "var(--foreground-muted)" }}>Correct Answer</span>;
                              }

                              return (
                                <div key={opt.id} className="flex items-start md:items-center p-3 transition-all" style={{ ...wrapperStyle, borderRadius: "var(--radius-md)" }}>
                                  <div className="h-5 w-5 mt-0.5 md:mt-0 flex-none rounded-full flex items-center justify-center mr-3" style={iconStyle}>
                                    {(isSelected || isActualCorrect) && <Check className="w-3 h-3" />}
                                  </div>
                                  <span className="text-sm" style={textStyle}>{opt.text}</span>
                                  {badge}
                                </div>
                              );
                            }) : (
                              <div className="text-sm italic p-3" style={{ color: "var(--foreground-muted)" }}>No options provided.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // THEORY CARD
                  return (
                    <div
                      key={question.id || idx}
                      className="overflow-hidden relative"
                      style={{
                        background: "white",
                        borderRadius: "var(--radius-lg)",
                        border: isFlagged ? `2px solid var(--amber-signal)` : `2px solid var(--border-medium)`,
                        boxShadow: "var(--shadow-card)",
                      }}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: isFlagged ? "var(--amber-signal)" : "var(--violet-ink)" }} />
                      <div className="flex items-center justify-between px-5 py-3" style={{ background: isFlagged ? "var(--amber-tint)" : "var(--violet-tint)", borderBottom: `1px solid ${isFlagged ? "var(--border-medium)" : "var(--border-fine)"}` }}>
                        <h3 className="font-bold flex items-center gap-2.5 text-sm" style={{ color: "var(--foreground)" }}>
                          <span className="text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider" style={{ background: isFlagged ? "var(--amber-signal)" : "var(--violet-ink)", borderRadius: "var(--radius-sm)" }}>Q{idx + 1}</span>
                          Theory
                          {isFlagged && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider" style={{ background: "var(--amber-tint)", color: "var(--amber-signal)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-sm)" }}>
                              <AlertTriangle className="w-3 h-3 animate-pulse" /> Flagged
                            </span>
                          )}
                        </h3>
                        {(() => {
                          const savedGrade = answerDoc?.marksAwarded ?? answerDoc?.score ?? answerDoc?.grade;
                          return savedGrade !== undefined && savedGrade !== null ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold" style={{ borderRadius: "var(--radius-sm)", background: "var(--cobalt-tint)", color: "var(--cobalt-signal)" }}>
                              Graded: {savedGrade}/{maxMarks}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold" style={{ borderRadius: "var(--radius-sm)", background: "var(--amber-tint)", color: "var(--amber-signal)" }}>
                              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--amber-signal)" }} />
                              Needs Grading
                            </span>
                          );
                        })()}
                      </div>
                      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
                        <div className="lg:col-span-7 space-y-4">
                          <div>
                            <p className="text-sm font-medium mb-3 p-3 leading-relaxed" style={{ color: "var(--foreground)", background: "var(--surface-muted)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)" }}>
                              {question.prompt || question.questionText || question.text}
                            </p>
                            <p className="text-[10px] uppercase font-bold tracking-wider mb-1.5 pl-1" style={{ color: "var(--foreground-muted)" }}>Student Answer:</p>
                            <div className="p-3 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", color: "var(--foreground)" }}>
                              {(() => {
                                const raw = answerDoc?.value || answerDoc?.answer;
                                if (!raw) return <span className="italic" style={{ color: "var(--foreground-muted)" }}>No answer provided.</span>;
                                if (typeof raw === 'string') {
                                  try {
                                    const parsed = JSON.parse(raw);
                                    if (typeof parsed === 'object' && parsed !== null) {
                                      return parsed.selected || parsed.text || JSON.stringify(parsed);
                                    }
                                    return parsed;
                                  } catch (e) { return raw; }
                                }
                                if (typeof raw === 'object' && raw !== null) {
                                  return raw.selected || raw.text || JSON.stringify(raw);
                                }
                                return String(raw);
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="lg:col-span-5 p-4 flex flex-col gap-4" style={{ background: "var(--violet-tint)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)" }}>
                          <div className="flex items-end gap-3">
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: "var(--violet-ink)" }}>Score / {maxMarks}</label>
                              <input
                                className="w-full font-bold text-lg p-2.5 outline-none transition-all"
                                style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-medium)", background: "white", color: "var(--violet-ink)" }}
                                max={maxMarks}
                                min="0"
                                type="number"
                                value={state.marksAwarded}
                                onChange={(e) => {
                                  let val = e.target.value;
                                  if (Number(val) > maxMarks) val = maxMarks.toString();
                                  setGradingState(p => ({
                                    ...p,
                                    [answerId as string]: { ...p[answerId as string], marksAwarded: val }
                                  }));
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = "var(--violet-ink)")}
                                onBlur={e => (e.currentTarget.style.borderColor = "var(--border-medium)")}
                              />
                            </div>
                            <button
                              onClick={() => {
                                setGradingState(p => ({
                                  ...p,
                                  [answerId as string]: { ...p[answerId as string], marksAwarded: maxMarks.toString() }
                                }));
                              }}
                              className="h-11 aspect-square flex items-center justify-center transition-all"
                              style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-medium)", background: "white", color: "var(--foreground-muted)" }}
                              title="Quick Full Marks"
                              onMouseEnter={e => { e.currentTarget.style.color = "var(--amber-signal)"; e.currentTarget.style.borderColor = "var(--amber-signal)"; }}
                              onMouseLeave={e => { e.currentTarget.style.color = "var(--foreground-muted)"; e.currentTarget.style.borderColor = "var(--border-medium)"; }}
                            >
                              <Star className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="flex-1 flex flex-col">
                            <label className="block text-[10px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: "var(--violet-ink)" }}>Teacher Comment</label>
                            <textarea
                              className="flex-1 w-full p-3 text-sm min-h-[90px] resize-none outline-none transition-all"
                              style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-medium)", background: "white", color: "var(--foreground)" }}
                              placeholder="Provide feedback..."
                              value={state.comment}
                              onChange={(e) => {
                                setGradingState(p => ({
                                  ...p,
                                  [answerId as string]: { ...p[answerId as string], comment: e.target.value }
                                }));
                              }}
                              onFocus={e => (e.currentTarget.style.borderColor = "var(--violet-ink)")}
                              onBlur={e => (e.currentTarget.style.borderColor = "var(--border-medium)")}
                            />
                          </div>
                          <button
                            onClick={async () => {
                              if (!answerId) return toast.error("Cannot save: answer ID is missing. Try refreshing the page.");
                              try {
                                await gradeAnswer({
                                  submissionId,
                                  answerId,
                                  marksAwarded: Number(state.marksAwarded || 0),
                                  comment: state.comment,
                                }).unwrap();
                                toast.success("Grade saved successfully.");
                              } catch (err: any) {
                                const msg = err?.data?.message || err?.message || "Failed to save grade";
                                toast.error(msg);
                                console.error("[SaveAnswer] Error:", err?.data || err);
                              }
                            }}
                            disabled={isGrading}
                            className="w-full h-8 text-xs font-bold disabled:opacity-50 transition-all"
                            style={{ borderRadius: "var(--radius-md)", background: "var(--violet-tint)", color: "var(--violet-ink)", border: "1px solid var(--border-medium)" }}
                            onMouseEnter={e => { if (!isGrading) e.currentTarget.style.opacity = "0.8"; }}
                            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                          >
                            {isGrading ? "Saving..." : "Save Answer"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {selectedAssessment?.questions?.length === 0 && (
                  <div className="text-center py-8 text-sm" style={{ color: "var(--foreground-muted)", background: "white", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }}>
                    No questions found in this assessment.
                  </div>
                )}
              </div>
            </div>

            {/* Floating Action Bar */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center z-30 pointer-events-none px-4">
              <div className="p-1.5 pl-3 md:pl-5 flex items-center gap-2 md:gap-4 pointer-events-auto transform transition-transform hover:scale-[1.02]" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-dialog)", border: "1px solid var(--border-fine)" }}>
                <span className="hidden xl:flex text-xs font-semibold items-center gap-1.5" style={{ color: "var(--foreground-muted)" }}>
                  <CheckCircle className="w-4 h-4" style={{ color: "var(--emerald-signal)" }} /> Draft Ready
                </span>
                <div className="hidden xl:block h-6 w-px" style={{ background: "var(--border-fine)" }} />

                <div className="flex items-center gap-1 px-1 overflow-x-auto no-scrollbar max-w-[150px] md:max-w-[300px]">
                  {questions.map((q: any, idx: number) => {
                    const marks = submission?.answers?.find((a: any) => a.questionId === q.id)?.marksAwarded;
                    const hasComment = submission?.answers?.find((a: any) => a.questionId === q.id)?.comment;
                    const isGraded = marks !== undefined && marks !== null;

                    return (
                      <button
                        key={q.id}
                        title={`Question ${idx + 1}`}
                        onClick={() => {
                          const el = document.getElementById(`question-${q.id}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="w-7 h-7 flex-none text-[10px] font-bold transition-all flex items-center justify-center"
                        style={{
                          borderRadius: "var(--radius-sm)",
                          background: isGraded ? "var(--emerald-signal)" : hasComment ? "var(--amber-signal)" : "var(--surface-muted)",
                          color: isGraded || hasComment ? "white" : "var(--foreground-muted)",
                          border: "none",
                        }}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="h-6 w-px" style={{ background: "var(--border-fine)" }} />

                <button
                  onClick={handleSaveProgress}
                  disabled={isSavingAll}
                  className="px-3 md:px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50"
                  style={{ borderRadius: "var(--radius-md)", color: "var(--foreground)", border: "none", background: "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-muted)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {isSavingAll ? "Saving..." : "Save Progress"}
                </button>

                <button
                  onClick={handleSaveAndNext}
                  disabled={isSavingAll}
                  className="flex items-center gap-1.5 px-4 md:px-5 py-2 text-white text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                  style={{ borderRadius: "var(--radius-md)", background: "var(--violet-ink)", boxShadow: "var(--shadow-card)", border: "none" }}
                >
                  Save & Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
