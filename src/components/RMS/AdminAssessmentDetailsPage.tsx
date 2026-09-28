"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import {
  fetchAssessmentDetail,
  fetchAssessmentSubmissions,
  deleteAssessment,
} from "@/reduxToolKit/admin/adminThunks";
import { Header } from "@/components/RMS/header";
import {
  ArrowLeft,
  Clock,
  FileText,
  Users,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Calendar,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { getTenantInfo } from "@/reduxToolKit/user/userThunks";

export function AdminAssessmentDetailsPage() {
  const params = useParams<{ assessmentId: string }>();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { selectedAssessment, assessmentSubmissions, loading, error } =
    useSelector((s: RootState) => s.admin);
  const { tenantInfo } = useSelector((s: RootState) => s.user);

  useEffect(() => {
    if (params.assessmentId) {
      dispatch(fetchAssessmentDetail(params.assessmentId));
      dispatch(fetchAssessmentSubmissions(params.assessmentId));
      dispatch(getTenantInfo());
    }
  }, [params.assessmentId, dispatch]);

  const handleDelete = async () => {
    if (!selectedAssessment) return;

    if (
      window.confirm(
        `Are you sure you want to delete "${selectedAssessment.title}"? This action cannot be undone.`,
      )
    ) {
      try {
        const res = await dispatch(
          deleteAssessment(selectedAssessment.id),
        ).unwrap();
        if (res) {
          toast.success("Assessment deleted successfully");
          router.push("/RMS/assessments");
        }
      } catch (err: any) {
        toast.error(err || "Failed to delete assessment");
      }
    }
  };

  // Helper to normalize isOnline to boolean (handles both string and boolean values)
  const isOnline = () => {
    const value = selectedAssessment?.isOnline;
    if (typeof value === "string") {
      return value === "true" || value === "1" || value === "yes";
    }
    return !!value;
  };

  if (loading && !selectedAssessment) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !selectedAssessment) {
    return (
      <div
        className="p-8 text-center rounded-xl m-8"
        style={{ background: "var(--crimson-tint)" }}
      >
        <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--crimson-signal)" }} />
        <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
          Error Loading Assessment
        </h2>
        <p className="mt-2" style={{ color: "var(--crimson-signal)" }}>{error || "Assessment not found"}</p>
        <button
          onClick={() => router.back()}
          className="mt-6 px-4 py-2 rounded-xl border text-sm font-medium transition-colors"
          style={{ borderColor: "var(--border-medium)", color: "var(--foreground-muted)", background: "white" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--crimson-tint)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
        >
          Go Back
        </button>
      </div>
    );
  }

  const statusLabel =
    selectedAssessment.status === "started"
      ? "Active"
      : selectedAssessment.status === "ended"
        ? "Ended"
        : "Pending";
  const statusStyle =
    selectedAssessment.status === "started"
      ? { background: "var(--emerald-tint)", color: "var(--emerald-signal)" }
      : selectedAssessment.status === "ended"
        ? { background: "var(--crimson-tint)", color: "var(--crimson-signal)" }
        : { background: "var(--amber-tint)", color: "var(--amber-signal)" };

  return (
    <div className="w-full pb-10">
      <Header
        schoolLogo={tenantInfo?.logoUrl}
        schoolName={tenantInfo?.name || "ParaLearn School"}
      />

      <div className="max-w-6xl mx-auto px-4 mt-6">
        {/* Navigation Breadcrumb */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 transition-colors mb-6"
          style={{ color: "var(--foreground-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-muted)")}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "var(--surface-muted)" }}
          >
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="font-medium text-sm">Back to Assessments</span>
        </button>

        {/* Hero Section */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-8" style={{ border: "1px solid var(--border-fine)" }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span
                  className="border-0 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                  style={statusStyle}
                >
                  {statusLabel}
                </span>
                <span
                  className="border-0 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                  style={{ background: "var(--surface-muted)", color: "var(--foreground-muted)" }}
                >
                  {isOnline() ? "Online" : "Offline"}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
                  {selectedAssessment.title}
                </h1>
                <p className="flex items-center gap-2" style={{ color: "var(--foreground-muted)" }}>
                  <span className="font-semibold" style={{ color: "var(--violet-ink)" }}>
                    {selectedAssessment.subject?.name || "Subject"}
                  </span>
                  <span style={{ color: "var(--border-medium)" }}>•</span>
                  <span>{selectedAssessment.class?.name || "Class"}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  router.push(`/RMS/assessments/edit/${selectedAssessment.id}`)
                }
                className="rounded-xl px-4 py-2 text-sm font-medium border transition-colors"
                style={{ borderColor: "var(--border-medium)", color: "var(--foreground-muted)", background: "white" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="rounded-xl px-4 py-2 text-sm font-medium border-0 flex items-center gap-2 transition-colors"
                style={{ background: "var(--crimson-tint)", color: "var(--crimson-signal)" }}
                onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.95)")}
                onMouseLeave={(e) => (e.currentTarget.style.filter = "")}
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-8 pt-8" style={{ borderTop: "1px solid var(--border-fine)" }}>
            <div className="rounded-2xl p-4" style={{ background: "var(--surface-muted)" }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: "var(--foreground-muted)" }}>
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Duration
                </span>
              </div>
              <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                {selectedAssessment.durationMins ||
                  selectedAssessment.duration ||
                  "—"}{" "}
                Mins
              </p>
            </div>

            <div className="rounded-2xl p-4" style={{ background: "var(--surface-muted)" }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: "var(--foreground-muted)" }}>
                <BarChart3 className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Total Marks
                </span>
              </div>
              <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                {selectedAssessment.totalMarks || "—"}
              </p>
            </div>

            <div className="rounded-2xl p-4" style={{ background: "var(--surface-muted)" }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: "var(--foreground-muted)" }}>
                <HelpCircle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Questions
                </span>
              </div>
              <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                {selectedAssessment._count?.questions ||
                  selectedAssessment.questions?.length ||
                  0}
              </p>
            </div>

            <div className="rounded-2xl p-4" style={{ background: "var(--surface-muted)" }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: "var(--emerald-signal)" }}>
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Submissions
                </span>
              </div>
              <p className="text-xl font-bold" style={{ color: "var(--emerald-signal)" }}>
                {assessmentSubmissions.length}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Instructions */}
            <section className="bg-white rounded-3xl shadow-sm p-6" style={{ border: "1px solid var(--border-fine)" }}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <FileText className="w-5 h-5" style={{ color: "var(--violet-ink)" }} /> Instructions
              </h2>
              <div className="prose max-w-none leading-relaxed italic" style={{ color: "var(--foreground-muted)" }}>
                {selectedAssessment.instructions ||
                  "No special instructions provided for this assessment."}
              </div>
            </section>

            {/* Questions List */}
            <section className="bg-white rounded-3xl shadow-sm overflow-hidden" style={{ border: "1px solid var(--border-fine)" }}>
              <div className="p-6 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-fine)" }}>
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                  <HelpCircle className="w-5 h-5" style={{ color: "var(--violet-ink)" }} /> Assessment
                  Questions
                </h2>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ border: "1px solid var(--border-medium)", color: "var(--foreground-muted)", background: "white" }}
                >
                  {selectedAssessment.questions?.length || 0} Total
                </span>
              </div>
              <div>
                {selectedAssessment.questions &&
                selectedAssessment.questions.length > 0 ? (
                  selectedAssessment.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-6 transition-colors"
                      style={{ borderTop: idx === 0 ? undefined : "1px solid var(--border-fine)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--border-medium)" }}>
                            Question {idx + 1}
                          </p>
                          <p className="font-medium text-lg leading-relaxed" style={{ color: "var(--foreground)" }}>
                            {q.text || q.question}
                          </p>
                          {q.options && q.options.length > 0 && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                              {q.options.map((opt: string, i: number) => (
                                <div
                                  key={i}
                                  className="text-sm p-2.5 rounded-xl"
                                  style={
                                    opt === q.correctAnswer
                                      ? { background: "var(--emerald-tint)", border: "1px solid var(--emerald-signal)", color: "var(--emerald-signal)" }
                                      : { background: "white", border: "1px solid var(--border-fine)", color: "var(--foreground-muted)" }
                                  }
                                >
                                  <span className="font-bold mr-2">
                                    {String.fromCharCode(65 + i)}.
                                  </span>{" "}
                                  {opt}
                                  {opt === q.correctAnswer && (
                                    <CheckCircle className="w-3 h-3 inline ml-2" />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold" style={{ color: "var(--violet-ink)" }}>
                            {q.marks || 0} Marks
                          </p>
                          <span
                            className="mt-2 inline-block text-[10px] font-bold uppercase rounded-lg px-2 py-0.5"
                            style={{ border: "1px solid var(--border-medium)", background: "var(--surface-muted)", color: "var(--foreground-muted)" }}
                          >
                            {q.type || "Multiple Choice"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center" style={{ color: "var(--border-medium)" }}>
                    <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No questions have been added to this assessment yet.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar Info Column */}
          <div className="space-y-8">
            {/* Timeline Info */}
            <section className="bg-white rounded-3xl shadow-sm p-6" style={{ border: "1px solid var(--border-fine)" }}>
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Calendar className="w-5 h-5" style={{ color: "var(--violet-ink)" }} /> Schedule &
                Timeline
              </h2>
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--surface-muted)", color: "var(--foreground-muted)" }}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--border-medium)" }}>
                      Start Time
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {selectedAssessment.startsAt
                        ? format(new Date(selectedAssessment.startsAt), "PPp")
                        : "Not scheduled"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--surface-muted)", color: "var(--foreground-muted)" }}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--border-medium)" }}>
                      End Time
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {selectedAssessment.endsAt
                        ? format(new Date(selectedAssessment.endsAt), "PPp")
                        : "Continuous"}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Submissions Overview */}
            <section className="bg-white rounded-3xl shadow-sm p-6 overflow-hidden" style={{ border: "1px solid var(--border-fine)" }}>
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Users className="w-5 h-5" style={{ color: "var(--violet-ink)" }} /> Submissions (
                {assessmentSubmissions.length})
              </h2>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {assessmentSubmissions.length > 0 ? (
                  assessmentSubmissions.map((sub: any) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 rounded-2xl transition-colors"
                      style={{ background: "var(--surface-muted)", border: "1px solid transparent" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--border-fine)";
                        e.currentTarget.style.borderColor = "var(--border-fine)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--surface-muted)";
                        e.currentTarget.style.borderColor = "transparent";
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs"
                          style={{ background: "var(--violet-tint)", color: "var(--violet-ink)" }}
                        >
                          {sub.student?.firstName?.[0] || "S"}
                        </div>
                        <div>
                          <p className="text-sm font-bold leading-none mb-1" style={{ color: "var(--foreground)" }}>
                            {sub.student?.firstName} {sub.student?.lastName}
                          </p>
                          <p className="text-[10px] font-medium" style={{ color: "var(--foreground-muted)" }}>
                            Score:{" "}
                            <span className="font-bold" style={{ color: "var(--violet-ink)" }}>
                              {sub.score ?? "—"}
                            </span>{" "}
                            / {selectedAssessment.totalMarks}
                          </p>
                        </div>
                      </div>
                      <span
                        className="border-0 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter"
                        style={
                          sub.status === "graded"
                            ? { background: "var(--emerald-tint)", color: "var(--emerald-signal)" }
                            : { background: "var(--cobalt-tint)", color: "var(--cobalt-signal)" }
                        }
                      >
                        {sub.status || "Submitted"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10">
                    <Users className="w-10 h-10 mx-auto mb-2" style={{ color: "var(--border-medium)" }} />
                    <p className="text-sm" style={{ color: "var(--border-medium)" }}>
                      No submissions yet.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
