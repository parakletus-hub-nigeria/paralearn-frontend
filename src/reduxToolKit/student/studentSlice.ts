import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { 
  fetchStudentAssessments, 
  fetchAssessmentDetails, 
  startAssessment, 
  submitAssessment,
  syncOfflineSubmissions,
  StudentAssessment
} from "./studentThunks";

interface StudentState {
  assessments: StudentAssessment[];
  currentAssessment: StudentAssessment | null;
  activeSession: {
    assessmentId: string | null;
    submissionId: string | null;
    status: string | null;
    startedAt: string | null;
    deadline: string | null;
    answers: Record<string, any>;
    tabSwitchCount: number;
    windowBlurCount: number;
    suspiciousActivity: string[];
    autoFlaggedQuestions: string[];
  };
  loading: boolean;
  error: string | null;
}

const initialActiveSession = {
  assessmentId: null,
  submissionId: null,
  status: null,
  startedAt: null,
  deadline: null,
  answers: {},
  tabSwitchCount: 0,
  windowBlurCount: 0,
  suspiciousActivity: [],
  autoFlaggedQuestions: [],
};

const initialState: StudentState = {
  assessments: [],
  currentAssessment: null,
  activeSession: initialActiveSession,
  loading: false,
  error: null
};

// ---------------------------------------------------------------------------
// localStorage helpers — keeps session alive across page refreshes
// ---------------------------------------------------------------------------
const SESSION_KEY_PREFIX = "exam_session_";

function saveSessionToStorage(assessmentId: string, session: StudentState["activeSession"]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      SESSION_KEY_PREFIX + assessmentId,
      JSON.stringify({
        assessmentId: session.assessmentId,
        submissionId: session.submissionId,
        startedAt: session.startedAt,
        deadline: session.deadline,
        answers: session.answers,
        status: session.status,
        tabSwitchCount: session.tabSwitchCount,
        windowBlurCount: session.windowBlurCount,
        suspiciousActivity: session.suspiciousActivity,
        autoFlaggedQuestions: session.autoFlaggedQuestions,
      })
    );
  } catch {
    // localStorage can be unavailable in some private browser modes — safe to ignore
  }
}

export function loadSessionFromStorage(assessmentId: string): Partial<StudentState["activeSession"]> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY_PREFIX + assessmentId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSessionFromStorage(assessmentId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY_PREFIX + assessmentId);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------

const studentSlice = createSlice({
  name: "student",
  initialState,
  reducers: {
    setAnswer: (state, action: PayloadAction<{ questionId: string; value: any }>) => {
      state.activeSession.answers[action.payload.questionId] = action.payload.value;
      // Persist answers to localStorage so a refresh doesn't lose progress
      if (state.activeSession.assessmentId) {
        saveSessionToStorage(state.activeSession.assessmentId, state.activeSession);
      }
    },
    incrementTabSwitch: (state, action: PayloadAction<string | undefined>) => {
      state.activeSession.tabSwitchCount += 1;
      state.activeSession.suspiciousActivity.push(`Tab switched at ${new Date().toISOString()}`);
      if (action.payload && !state.activeSession.autoFlaggedQuestions.includes(action.payload)) {
        state.activeSession.autoFlaggedQuestions.push(action.payload);
      }
      if (state.activeSession.assessmentId) {
        saveSessionToStorage(state.activeSession.assessmentId, state.activeSession);
      }
    },
    incrementWindowBlur: (state, action: PayloadAction<string | undefined>) => {
      state.activeSession.windowBlurCount += 1;
      state.activeSession.suspiciousActivity.push(`Window focus lost at ${new Date().toISOString()}`);
      if (action.payload && !state.activeSession.autoFlaggedQuestions.includes(action.payload)) {
        state.activeSession.autoFlaggedQuestions.push(action.payload);
      }
      if (state.activeSession.assessmentId) {
        saveSessionToStorage(state.activeSession.assessmentId, state.activeSession);
      }
    },
    autoFlagQuestion: (state, action: PayloadAction<string>) => {
      if (!state.activeSession.autoFlaggedQuestions.includes(action.payload)) {
        state.activeSession.autoFlaggedQuestions.push(action.payload);
        if (state.activeSession.assessmentId) {
           saveSessionToStorage(state.activeSession.assessmentId, state.activeSession);
        }
      }
    },
    resetActiveSession: (state) => {
      if (state.activeSession.assessmentId) {
        clearSessionFromStorage(state.activeSession.assessmentId);
      }
      state.activeSession = initialActiveSession;
      state.currentAssessment = null;
    },
    /**
     * Restore an in-progress session from localStorage after a page refresh.
     * Call this in the exam page's first useEffect when assessmentId is available.
     */
    restoreSession: (state, action: PayloadAction<Partial<StudentState["activeSession"]>>) => {
      const saved = action.payload;
      if (!saved) return;
      
      // If we don't have a started session yet, restore everything
      if (!state.activeSession.startedAt && saved.startedAt) {
        state.activeSession = {
          ...state.activeSession,
          ...saved,
        };
      } else if (state.activeSession.startedAt) {
        // If we DO have a live session, just ensure we merge any malpractice data that might be out of sync
        if (saved.tabSwitchCount !== undefined) {
           state.activeSession.tabSwitchCount = Math.max(state.activeSession.tabSwitchCount || 0, saved.tabSwitchCount);
        }
        if (saved.windowBlurCount !== undefined) {
           state.activeSession.windowBlurCount = Math.max(state.activeSession.windowBlurCount || 0, saved.windowBlurCount);
        }
        if (saved.suspiciousActivity && saved.suspiciousActivity.length > state.activeSession.suspiciousActivity.length) {
            state.activeSession.suspiciousActivity = saved.suspiciousActivity;
        }
        if (saved.autoFlaggedQuestions && saved.autoFlaggedQuestions.length > state.activeSession.autoFlaggedQuestions.length) {
            // merge sets to prevent overriding new flags that happened between page load and session restore
            const mergedFlags = new Set([...state.activeSession.autoFlaggedQuestions, ...saved.autoFlaggedQuestions]);
            state.activeSession.autoFlaggedQuestions = Array.from(mergedFlags);
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Assessments
      .addCase(fetchStudentAssessments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStudentAssessments.fulfilled, (state, action) => {
        state.loading = false;
        state.assessments = action.payload;
      })
      .addCase(fetchStudentAssessments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Details
      .addCase(fetchAssessmentDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.currentAssessment = null;
      })
      .addCase(fetchAssessmentDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.currentAssessment = action.payload;
        // FIX #9: If the assessment is already submitted (e.g. finished on another device),
        // clear the stored session from localStorage so we don't restore a stale in-progress session.
        const assessmentId = action.meta.arg as string;
        const payload = action.payload;
        const isAlreadySubmitted =
          payload?.status === "submitted" ||
          payload?.submissions?.some(
            (s: any) => s.status === "submitted" && !!s.finishedAt
          );
        if (isAlreadySubmitted && assessmentId) {
          // Dynamically import to avoid circular dep in the reducer
          try {
            if (typeof window !== "undefined") {
              localStorage.removeItem(`exam_session_${assessmentId}`);
            }
          } catch {}
        }
      })
      .addCase(fetchAssessmentDetails.rejected, (state, action) => {
        state.loading = false;
        state.currentAssessment = null;
        state.error = action.payload as string;
      })
      // Start Assessment
      .addCase(startAssessment.fulfilled, (state, action) => {
        const assessmentId = action.meta.arg; // the id passed to the thunk
        state.activeSession.assessmentId = assessmentId;
        state.activeSession.submissionId = action.payload.submissionId;
        state.activeSession.status = action.payload.status;
        state.activeSession.startedAt = action.payload.startedAt;
        state.activeSession.deadline = action.payload.deadline;
        // Immediately persist so a refresh can recover startedAt
        saveSessionToStorage(assessmentId, state.activeSession);
      })
      // Submit Assessment
      .addCase(submitAssessment.pending, (state) => {
        state.loading = true;
      })
      .addCase(submitAssessment.fulfilled, (state) => {
        state.loading = false;
        state.activeSession.status = "submitted";
        // Clear stored session so student can't re-enter
        if (state.activeSession.assessmentId) {
          clearSessionFromStorage(state.activeSession.assessmentId);
        }
      })
      .addCase(submitAssessment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Sync Offline Submissions
      .addCase(syncOfflineSubmissions.pending, (state) => {
        // Option to add an `isSyncing` boolean if we wanted to block the UI, 
        // but typically background syncs shouldn't freeze the dashboard.
        // We'll just leave this silently firing in the background.
      })
      .addCase(syncOfflineSubmissions.fulfilled, (state) => {
        // Successfully synced
      })
      .addCase(syncOfflineSubmissions.rejected, (state, action) => {
        // Silently fail or log, user will be notified via toast from Dashboard
        console.warn("Background sync failed:", action.payload);
      });
  }
});

export const {
  setAnswer,
  incrementTabSwitch,
  incrementWindowBlur,
  resetActiveSession,
  restoreSession,
  autoFlagQuestion,
} = studentSlice.actions;

export default studentSlice.reducer;
