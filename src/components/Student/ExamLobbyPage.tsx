"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { fetchAssessmentDetails, startAssessment } from "@/reduxToolKit/student/studentThunks";
import { getCurrentUserProfile } from "@/reduxToolKit/user/userThunks";
import { StudentHeader } from "@/components/Student/StudentHeader";
import { 
  ClipboardList, 
  AlertCircle, 
  Wifi, 
  Camera, 
  Mic, 
  ShieldCheck,
  ArrowRight,
  Lock,
  Calendar,
  Layers,
  Timer,
  BadgeCheck
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ExamLobbyPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get("assessmentId");

  const { currentAssessment: assessment, loading, error } = useSelector((s: RootState) => s.student);
  const { user, currentUserProfile } = useSelector((s: RootState) => s.user);

  const [agreed, setAgreed] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [systemCheck, setSystemCheck] = useState({
    cam: 'ready', // 'checking' | 'ready' | 'error'
    mic: 'ready',
    net: 'checking',
    ping: 0
  });

  useEffect(() => {
    let mounted = true;

    const checkNetwork = async () => {
      const start = Date.now();
      try {
        await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store' });
        const ping = Date.now() - start;
        if (mounted) setSystemCheck((s: any) => ({ ...s, net: 'ready', ping }));
      } catch (e) {
        if (mounted) setSystemCheck((s: any) => ({ ...s, net: navigator.onLine ? 'ready' : 'error', ping: 0 }));
      }

    };

    checkNetwork();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // FIX #8: Validate assessmentId before dispatching — prevents raw 404/500 errors reaching the student
    if (!assessmentId || assessmentId.trim() === "") {
      return; // The !assessment guard below will handle showing the error UI
    }
    dispatch(fetchAssessmentDetails(assessmentId));
    if (!currentUserProfile) {
      dispatch(getCurrentUserProfile());
    }
  }, [dispatch, assessmentId, currentUserProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
      </div>
    );
  }

  if (!assessment || error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "var(--surface-muted)" }}>
        <AlertCircle className="w-16 h-16 mb-4" style={{ color: "var(--crimson-signal)" }} />
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Assessment Unavailable</h2>
        <p className="mb-6 text-center max-w-md" style={{ color: "var(--foreground-muted)" }}>{error || "The assessment you're looking for was not found."}</p>
        <button onClick={() => router.push('/student/dashboard')} className="px-6 py-2 font-bold text-white" style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-md)", border: "none" }}>Back to Dashboard</button>
      </div>
    );
  }

  const isSubmitted =
    assessment.status === "submitted" ||
    assessment.submissions?.some(
      // Require BOTH status=submitted AND finishedAt to avoid false lockouts
      (s) => s.status === "submitted" && !!s.finishedAt
    );
  const isEnded = assessment.status === "ended";

  if (isSubmitted || isEnded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: "var(--surface-muted)" }}>
        <Lock className="w-16 h-16 mb-4" style={{ color: "var(--violet-ink)" }} />
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Assessment Locked</h2>
        <p className="mb-6 max-w-md" style={{ color: "var(--foreground-muted)" }}>
          {isSubmitted
            ? "You have already submitted this assessment. Multiple attempts are not permitted."
            : "This assessment has ended and is no longer accepting submissions."}
        </p>
        <button onClick={() => router.push('/student/dashboard')} className="px-6 py-2 font-bold text-white" style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-md)", border: "none" }}>Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden font-sans" style={{ background: "var(--surface-muted)" }}>
      <StudentHeader />
      
      {/* Starting/Error Assessment Modal Overlay */}
      {(isStarting || startError) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(12px)" }}>
          <div className="p-10 max-w-sm w-full mx-4 flex flex-col items-center text-center gap-6" style={{ background: "white", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)" }}>
            {startError ? (
              <>
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full" style={{ border: "4px solid var(--crimson-tint)" }} />
                  <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "var(--crimson-tint)" }}>
                    <AlertCircle className="w-10 h-10" style={{ color: "var(--crimson-signal)" }} />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Access Denied</h3>
                  <p className="mt-2 font-medium p-3" style={{ color: "var(--crimson-signal)", background: "var(--crimson-tint)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)" }}>{startError}</p>
                </div>
                <button
                  onClick={() => setStartError(null)}
                  className="w-full py-3 mt-2 font-bold transition-colors"
                  style={{ background: "var(--surface-muted)", color: "var(--foreground)", borderRadius: "var(--radius-lg)", border: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--border-fine)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--surface-muted)")}
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full" style={{ border: "4px solid var(--violet-tint)" }} />
                  <div className="absolute inset-0 rounded-full w-20 h-20 animate-spin" style={{ border: "4px solid var(--violet-ink)", borderTopColor: "transparent" }} />
                  <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "var(--violet-tint)" }}>
                    <ShieldCheck className="w-8 h-8 animate-pulse" style={{ color: "var(--violet-ink)" }} />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Starting Exam</h3>
                  <p className="mt-2 font-medium" style={{ color: "var(--foreground-muted)" }}>Securing session and preparing questions. Please hold on...</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto my-8 flex w-[calc(100%-2rem)] max-w-[1200px] flex-col overflow-hidden" style={{ background: "var(--chalk-white)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-card)" }}>
        {/* Header Section */}
        <div className="relative overflow-hidden p-6 md:p-10" style={{ background: "var(--chalk-white)", borderBottom: "1px solid var(--border-fine)" }}>
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
              <div className="space-y-4 max-w-3xl">
                 <div className="flex flex-wrap items-center gap-3">
                     <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold tracking-wider uppercase" style={{ color: "var(--foreground-muted)", background: "var(--surface-muted)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-pill)" }}>
                        <Calendar className="w-3 h-3" />
                        {/* FIX #12: Use real session data from assessment if available */}
                        {(assessment as any)?.session?.name || (assessment as any)?.academicYear || ""}
                     </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold tracking-wider uppercase" style={{ background: "var(--violet-tint)", border: "1px solid var(--border-fine)", color: "var(--violet-ink)", borderRadius: "var(--radius-pill)" }}>
                       {assessment.category?.name || "Assessment"}
                    </div>
                 </div>
                 <div>
                    <h1 className="text-2xl md:text-4xl font-bold leading-tight tracking-tight pb-2" style={{ color: "var(--foreground)" }}>
                       {assessment.title}
                    </h1>
                    <p className="text-base font-medium" style={{ color: "var(--foreground-muted)" }}>
                       {assessment.subject?.name || "General Subject"} • {assessment.instructions?.split('.')[0] || "Online Assessment"}
                    </p>
                 </div>
              </div>
              
              <div className="flex flex-col items-end gap-3">
                 <div className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold" style={{ background: "var(--emerald-tint)", color: "var(--emerald-signal)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)" }}>
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "var(--emerald-signal)" }}></span>
                      <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: "var(--emerald-signal)" }}></span>
                    </div>
                    Ready to start
                 </div>
              </div>
           </div>
        </div>

        {/* Content Body */}
        <div className="flex flex-col lg:flex-row flex-grow" style={{ background: "white" }}>
           {/* Left Config Panel */}
           <div className="flex-1 p-8 md:p-10 space-y-10">
              <div>
                 <h2 className="text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: "var(--foreground-muted)" }}>
                    <span className="w-4 h-[1px]" style={{ background: "var(--border-medium)" }}></span> Exam Configuration
                 </h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 transition-all shadow-sm flex items-start gap-4 group" style={{ background: "white", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }}>
                       <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-300" style={{ background: "var(--violet-tint)", color: "var(--violet-ink)" }}>
                          <Layers className="w-6 h-6" />
                       </div>
                       <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--foreground-muted)" }}>Volume</p>
                          <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{assessment.questions?.length || assessment.questionCount || "?"} Questions</p>
                       </div>
                    </div>
                    <div className="p-5 transition-all shadow-sm flex items-start gap-4 group" style={{ background: "white", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }}>
                       <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-300" style={{ background: "var(--violet-tint)", color: "var(--violet-ink)" }}>
                          <Timer className="w-6 h-6" />
                       </div>
                       <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--foreground-muted)" }}>Time Limit</p>
                          <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{assessment.durationMins} Minutes</p>
                       </div>
                    </div>
                    <div className="p-5 transition-all shadow-sm flex items-start gap-4 group" style={{ background: "white", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }}>
                       <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-300" style={{ background: "var(--violet-tint)", color: "var(--violet-ink)" }}>
                          <BadgeCheck className="w-6 h-6" />
                       </div>
                       <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--foreground-muted)" }}>Pass Criteria</p>
                          <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{assessment.passingMarks || "50"}% Score</p>
                       </div>
                    </div>
                    <div className="p-5 transition-all shadow-sm flex items-start gap-4 group" style={{ background: "white", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }}>
                       <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-300" style={{ background: "var(--violet-tint)", color: "var(--violet-ink)" }}>
                          <ClipboardList className="w-6 h-6" />
                       </div>
                       <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--foreground-muted)" }}>Format</p>
                          <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>MCQ & Theory</p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="pt-2">
                 <h2 className="text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: "var(--foreground-muted)" }}>
                    <span className="w-4 h-[1px]" style={{ background: "var(--border-medium)" }}></span> Protocol
                 </h2>
                 <div className="p-6" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-lg)" }}>
                    <ul className="space-y-4">
                       <li className="flex items-start gap-4 group" style={{ color: "var(--foreground-muted)" }}>
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--violet-ink)" }} />
                          <span className="leading-relaxed text-sm font-medium">Do not switch browser tabs. Focus is monitored and violations will be flagged immediately.</span>
                       </li>
                       <li className="flex items-start gap-4 group" style={{ color: "var(--foreground-muted)" }}>
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--violet-ink)" }} />
                          <span className="leading-relaxed text-sm font-medium">The timer is absolute. Ensure you submit before the countdown reaches zero.</span>
                       </li>
                       <li className="flex items-start gap-4 group" style={{ color: "var(--foreground-muted)" }}>
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--violet-ink)" }} />
                          <span className="leading-relaxed text-sm font-medium">If the network drops, continue answering. Your browser keeps a local copy while you submit.</span>
                       </li>
                    </ul>
                 </div>
              </div>
           </div>

           {/* Right Sidebar - System Check */}
           <div className="lg:w-[420px] border-t lg:border-t-0 lg:border-l p-8 md:p-10 flex flex-col relative" style={{ background: "var(--chalk-white)", borderColor: "var(--border-fine)" }}>
              <div className="flex items-center gap-4 mb-8 p-4 shadow-sm" style={{ background: "white", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }}>
                 <div className="relative">
                    <img 
                       alt="Student profile" 
                       className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md" style={{ background: "var(--surface-muted)" }}
                       src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || 'student'}`}
                    />
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full" style={{ background: "var(--emerald-signal)", border: "2px solid white" }} />
                 </div>
                 <div>
                    <h3 className="font-bold text-lg" style={{ color: "var(--foreground)" }}>{user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "Student"}</h3>
                    <div className="flex items-center gap-1 text-xs font-semibold tracking-wide" style={{ color: "var(--foreground-muted)" }}>
                       <span className="uppercase" style={{ color: "var(--violet-ink)" }}>ID:</span>
                       {currentUserProfile?.studentId || currentUserProfile?.teacherId || (user as any)?.studentId || (user as any)?.student?.studentId || user?.id?.slice(0, 10).toUpperCase()}
                    </div>
                 </div>
              </div>

               <div className="p-6 mb-auto relative overflow-hidden group" style={{ background: "var(--emerald-tint)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-lg)" }}>
                  <div className="relative z-10">
                     <div className="flex items-center justify-between mb-5 pb-3" style={{ borderBottom: "1px solid var(--border-fine)" }}>
                        <div className="flex items-center gap-2">
                           <ShieldCheck className="w-5 h-5" style={{ color: "var(--emerald-signal)" }} />
                           <h3 className="font-bold text-sm uppercase tracking-wider" style={{ color: "var(--foreground)" }}>System Status</h3>
                        </div>
                        {Object.values(systemCheck).includes("checking") ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded shadow-sm" style={{ background: "var(--amber-tint)", color: "var(--amber-signal)", border: "1px solid var(--border-medium)" }}>CHECKING...</span>
                        ) : Object.values(systemCheck).includes("error") ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded shadow-sm" style={{ background: "var(--crimson-tint)", color: "var(--crimson-signal)", border: "1px solid var(--border-medium)" }}>DEGRADED</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded shadow-sm" style={{ background: "var(--emerald-tint)", color: "var(--emerald-signal)", border: "1px solid var(--border-medium)" }}>READY</span>
                        )}
                     </div>
                     {/* FIX #8: Show warning if device access fails, but don't block exam */}
                     {!Object.values(systemCheck).includes("checking") && Object.values(systemCheck).includes("error") && (
                       <div className="mb-4 text-xs px-3 py-2 leading-relaxed" style={{ background: "var(--amber-tint)", border: "1px solid var(--border-medium)", color: "var(--foreground)", borderRadius: "var(--radius-md)" }}>
                         Network check failed. You may still start, and your answers will be kept locally if the connection drops.
                       </div>
                     )}
                     <div className="space-y-4">
                       <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2 font-medium" style={{ color: "var(--foreground-muted)" }}>
                             <Camera className="w-4 h-4" /> Webcam
                          </div>
                          {systemCheck.cam === "checking" ? <span className="font-bold text-xs px-2 py-0.5 rounded animate-pulse" style={{ color: "var(--amber-signal)", background: "var(--amber-tint)" }}>Wait</span> :
                           systemCheck.cam === "error" ? <span className="font-bold text-xs px-2 py-0.5 rounded" style={{ color: "var(--crimson-signal)", background: "var(--crimson-tint)" }}>Failed</span> :
                          <span className="flex h-2 w-2 rounded-full" style={{ background: "var(--emerald-signal)" }} />}
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2 font-medium" style={{ color: "var(--foreground-muted)" }}>
                             <Mic className="w-4 h-4" /> Microphone
                          </div>
                          {systemCheck.mic === "checking" ? <span className="font-bold text-xs px-2 py-0.5 rounded animate-pulse" style={{ color: "var(--amber-signal)", background: "var(--amber-tint)" }}>Wait</span> :
                           systemCheck.mic === "error" ? <span className="font-bold text-xs px-2 py-0.5 rounded" style={{ color: "var(--crimson-signal)", background: "var(--crimson-tint)" }}>Failed</span> :
                          <span className="flex h-2 w-2 rounded-full" style={{ background: "var(--emerald-signal)" }} />}
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2 font-medium" style={{ color: "var(--foreground-muted)" }}>
                             <Wifi className="w-4 h-4" /> Network
                          </div>
                          {systemCheck.net === "checking" ? <span className="font-bold text-xs px-2 py-0.5 rounded animate-pulse" style={{ color: "var(--amber-signal)", background: "var(--amber-tint)" }}>Wait</span> :
                           systemCheck.net === "error" ? <span className="font-bold text-xs px-2 py-0.5 rounded" style={{ color: "var(--crimson-signal)", background: "var(--crimson-tint)" }}>Offline</span> :
                          <span className="font-bold text-xs px-2 py-0.5 rounded" style={{ color: "var(--emerald-signal)", background: "var(--emerald-tint)" }}>{systemCheck.ping}ms</span>}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="mt-10 space-y-6 relative z-10">
                 <div className="flex items-start gap-3 px-1">
                    <input 
                       className="w-5 h-5 mt-0.5 rounded custom-checkbox cursor-pointer" style={{ accentColor: "var(--violet-ink)" }}
                       id="agree" 
                       type="checkbox"
                       checked={agreed}
                       onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <label className="text-sm cursor-pointer select-none leading-tight font-medium" style={{ color: "var(--foreground-muted)" }} htmlFor="agree">I acknowledge that this session is proctored and recorded.</label>
                 </div>

                  <button 
                     disabled={!agreed || isStarting}
                     onClick={async () => {
                         if (!assessmentId || isStarting) return;
                         setIsStarting(true);
                         setStartError(null);
                         
                         try {
                           // Always go through the backend. It creates a new session or safely resumes
                           // the existing in-progress one, and returns the sanitized question payload.
                           await dispatch(startAssessment(assessmentId)).unwrap();
                           router.push(`/student/exam?assessmentId=${assessment.id}`);
                          } catch (error: any) {
                           setIsStarting(false);
                           
                           let errorMsg = "Failed to start assessment. Please try again.";
                           
                           if (error?.error) {
                             errorMsg = typeof error.error === 'string' 
                               ? error.error 
                               : JSON.stringify(error.error);
                           } else if (error?.message) {
                             errorMsg = error.message;
                           } else if (typeof error === 'string') {
                             errorMsg = error;
                           }
                           
                           setStartError(errorMsg);
                         }
                     }}
                    className="w-full relative overflow-hidden font-bold py-5 px-6 transition-all flex items-center justify-between group"
                    style={{
                      borderRadius: "var(--radius-md)",
                      background: !agreed ? "var(--border-medium)" : "var(--violet-ink)",
                      color: !agreed ? "var(--foreground-muted)" : "white",
                      cursor: !agreed ? "not-allowed" : "pointer",
                      border: !agreed ? "1px solid var(--border-medium)" : "1px solid rgba(255,255,255,0.1)",
                      boxShadow: "none",
                    }}
                 >
                    <span className="text-lg relative z-10">Start Assessment</span>
                    <div className="p-1.5 transition-colors relative z-10" style={{ borderRadius: "var(--radius-md)", background: !agreed ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.2)" }}>
                       <ArrowRight className="w-4 h-4 block" style={{ color: !agreed ? "var(--foreground-muted)" : "white" }} />
                    </div>
                 </button>

                 <div className="flex justify-center items-center gap-2 opacity-60">
                    <Lock className="w-3 h-3" style={{ color: "var(--foreground-muted)" }} />
                    <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "var(--foreground-muted)" }}>
                        ParaLearn Secure Exam
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
}

