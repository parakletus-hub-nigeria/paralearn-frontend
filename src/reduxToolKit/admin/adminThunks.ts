import { createAsyncThunk } from "@reduxjs/toolkit";
import apiClient from "@/lib/api";

// ---------- Types ----------
export type ClassItem = {
  id: string;
  name: string;
  level?: string;
  stream?: string;
  capacity?: number;
  academicYear?: string;
  isActive?: boolean;
  createdAt?: string;
  studentCount?: number;
  teacherCount?: number;
  enrollments?: any[];
  teacherAssignments?: any[];
  _count?: {
    enrollments?: number;
    teacherAssignments?: number;
    students?: number;
    teachers?: number;
  };
};

export type SubjectItem = {
  id: string;
  name: string;
  code?: string;
  schoolId?: string;
  /** @deprecated classId is kept for backward compat only — use classSubjects[] */
  classId?: string;
  description?: string;
  teacherId?: string;
  createdAt?: string;
  teacherAssignments?: any[];
  teachers?: any[];
  /** New model: per-class assignment records */
  classSubjects?: Array<{
    id: string;
    classId: string;
    subjectType?: string;
    difficulty?: string;
    description?: string;
    isActive?: boolean;
    class?: { id: string; name: string; code?: string };
  }>;
};

export type AssessmentItem = {
  id: string;
  title: string;
  subjectId?: string;
  classId?: string;
  categoryId?: string;
  totalMarks?: number;
  passingMarks?: number;
  duration?: number;
  durationMins?: number;
  instructions?: string;
  startsAt?: string;
  endsAt?: string;
  session?: string;
  term?: string;
  isOnline?: boolean;
  status?: string;
  submittedCount?: number;
  _count?: {
    submissions: number;
    questions?: number;
  };
  subject?: { id: string; name: string; code?: string };
  class?: { id: string; name: string; code?: string };
  questions?: Array<{
    id: string;
    text?: string;
    question?: string;
    marks?: number;
    type?: string;
    options?: string[];
    correctAnswer?: string;
  }>;
};

export type SchoolStatistics = {
  overview?: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    averageScore: number;
    passRate: number;
  };
  gradeDistribution?: Record<string, number>;
};

export type ApprovalQueueItem = any;

export interface BookletPreviewStudent {
  studentId: string;
  studentName: string;
  studentIdNumber: string;
  totalScore: number;
  possibleScore: number;
  average: number;
  overallGrade: string;
  subjectCount: number;
  subjectsSubmitted: number;
  reportStatus?: string | null;
}

export interface BookletPreviewResponse {
  className: string;
  session: string;
  term: string;
  totalStudents: number;
  studentsWithScores: number;
  students: BookletPreviewStudent[];
  reportProgress: {
    totalSubjects: number;
    subjectsSubmitted: number;
    percentage: number;
  };
}

// ---------- Helpers ----------
const unwrap = (res: any) => res?.data?.data ?? res?.data ?? null;

// ---------- Admin: Classes ----------
export const fetchClasses = createAsyncThunk(
  "admin/fetchClasses",
  async (
    params: { level?: string; isActive?: boolean } | undefined,
    { rejectWithValue },
  ) => {
    try {
      const q = new URLSearchParams();
      if (params?.level) q.set("level", params.level);
      if (typeof params?.isActive === "boolean")
        q.set("isActive", String(params.isActive));
      const res = await apiClient.get(
        `/api/proxy/classes${q.toString() ? `?${q}` : ""}`,
      );
      const data = unwrap(res) || [];
      return Array.isArray(data) ? (data as ClassItem[]) : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to fetch classes",
      );
    }
  },
);

export const createClass = createAsyncThunk(
  "admin/createClass",
  async (
    payload: {
      name: string;
      level?: number;
      stream?: string;
      capacity?: number;
      academicYear?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post("/api/proxy/classes", payload);
      return unwrap(res) as ClassItem;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to create class",
      );
    }
  },
);

export const deleteClass = createAsyncThunk(
  "admin/deleteClass",
  async (classId: string, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/api/proxy/classes/${classId}`);
      return classId;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to delete class",
      );
    }
  },
);

export const updateClass = createAsyncThunk(
  "admin/updateClass",
  async (
    payload: {
      id: string;
      data: {
        name?: string;
        level?: number;
        stream?: string;
        capacity?: number;
        academicYear?: string;
      };
    },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.put(
        `/api/proxy/classes/${payload.id}`,
        payload.data,
      );
      return unwrap(res) as ClassItem;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to update class",
      );
    }
  },
);

export const assignTeacherToClass = createAsyncThunk(
  "admin/assignTeacherToClass",
  async (
    payload: { classId: string; teacherId: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post(
        `/api/proxy/classes/${payload.classId}/teachers`,
        {
          teacherId: payload.teacherId,
        },
      );
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to assign teacher",
      );
    }
  },
);

export const enrollStudentToClass = createAsyncThunk(
  "admin/enrollStudentToClass",
  async (
    payload: { classId: string; studentId: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post(
        `/api/proxy/classes/${payload.classId}/enroll`,
        {
          studentId: payload.studentId,
        },
      );
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to enroll student",
      );
    }
  },
);

// Fetch class details with enrolled students and teacher assignments
export const fetchClassDetails = createAsyncThunk(
  "admin/fetchClassDetails",
  async (classId: string, { rejectWithValue }) => {
    try {
      const classRes = await apiClient.get(`/api/proxy/classes/${classId}`);
      const classData = unwrap(classRes) || classRes.data || {};

      let subjectTeachers: any[] = [];
      try {
        const subjectsRes = await apiClient.get(
          `/api/proxy/subjects?classId=${classId}`,
        );
        const subjects = unwrap(subjectsRes) || subjectsRes.data || [];
        if (Array.isArray(subjects)) {
          for (const subject of subjects) {
            const teachers =
              subject.teacherAssignments || subject.teachers || [];
            if (Array.isArray(teachers)) {
              for (const ta of teachers) {
                const teacher = ta.teacher || ta;
                if (teacher && teacher.id) {
                  subjectTeachers.push({
                    ...ta,
                    teacher: { ...teacher, subjectName: subject.name },
                    subjectId: subject.id,
                    subjectName: subject.name,
                    type: "subject_teacher",
                  });
                }
              }
            }
          }
        }
      } catch {
        // Subject fetch failed — proceed without subject teachers
      }

      const classTeachers =
        classData.teacherAssignments || classData.teachers || [];
      const allTeachers = [
        ...classTeachers.map((t: any) => ({ ...t, type: "class_teacher" })),
        ...subjectTeachers,
      ];

      const teacherMap = new Map();
      for (const t of allTeachers) {
        const teacherId = t.teacher?.id || t.id;
        if (teacherId && !teacherMap.has(teacherId)) {
          teacherMap.set(teacherId, t);
        }
      }

      return {
        ...classData,
        teacherAssignments: Array.from(teacherMap.values()),
        subjectTeachers: subjectTeachers,
      };
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch class details",
      );
    }
  },
);

// ---------- Class Promotion ----------

export type PromotionStudentPreview = {
  studentId: string;
  studentName: string;
  studentIdNumber?: string;
  action: "promote" | "graduate" | "repeat" | string;
  targetClassId?: string;
  targetClassName?: string;
  overrideTargetClassId?: string;
};

export type PromotionClassPreview = {
  fromClass: { id: string; name: string };
  toClass: { id: string; name: string } | null;
  students: PromotionStudentPreview[];
};

export type PromotionPreviewResponse = {
  classes: PromotionClassPreview[];
  totalStudents?: number;
  summary?: Record<string, number>;
};

export const previewSchoolPromotion = createAsyncThunk(
  "admin/previewSchoolPromotion",
  async (
    payload: { currentSession: string; newSession: string },
    { rejectWithValue },
  ) => {
    try {
      const { currentSession, newSession } = payload;
      const res = await apiClient.get(
        `/api/proxy/student-progression/school/promotion-preview?currentSession=${encodeURIComponent(
          currentSession,
        )}&newSession=${encodeURIComponent(newSession)}`,
      );
      const data = unwrap(res);
      if (!data) return { classes: [], totalStudents: 0, summary: {} };

      const mappedClasses = (data.classes || []).map((cls: any) => {
        return {
          fromClass: { id: cls.classId, name: cls.className },
          toClass: cls.nextClassName
            ? { id: cls.nextClassId || "", name: cls.nextClassName }
            : null,
          students: (cls.students || []).map((student: any) => {
            let action = "repeat";
            if (
              student.recommendedAction === "promoted" ||
              student.recommendedAction === "promote"
            ) {
              action = "promote";
            } else if (
              student.recommendedAction === "graduated" ||
              student.recommendedAction === "graduate"
            ) {
              action = "graduate";
            } else if (student.recommendedAction === "repeated") {
              action = "repeat";
            }

            return {
              studentId: student.id,
              studentName: student.name,
              action,
              targetClassId: cls.nextClassId || undefined,
              targetClassName: cls.nextClassName || undefined,
            };
          }),
        };
      });

      let totalPromote = 0;
      let totalRepeat = 0;
      let totalGraduate = 0;

      mappedClasses.forEach((c: any) => {
        c.students.forEach((s: any) => {
          if (s.action === "promote") totalPromote++;
          else if (s.action === "repeat") totalRepeat++;
          else if (s.action === "graduate") totalGraduate++;
        });
      });

      return {
        classes: mappedClasses,
        totalStudents: data.totalStudents || 0,
        summary: {
          promote: totalPromote,
          repeat: totalRepeat,
          graduate: totalGraduate,
        },
      };
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to preview promotion",
      );
    }
  },
);

export const executeSchoolPromotion = createAsyncThunk(
  "admin/executeSchoolPromotion",
  async (
    payload: {
      currentSession: string;
      newSession: string;
      overrides: Record<string, { status: string; toClassId?: string }>;
    },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post(
        "/api/proxy/student-progression/school/execute-promotion",
        payload,
      );
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to execute promotion",
      );
    }
  },
);

// Bulk enroll multiple students to a class
// Note: TEACHER_ADMIN_GUIDE uses /enroll with single studentId, Vaniah docs uses /students with array
export const bulkEnrollStudents = createAsyncThunk(
  "admin/bulkEnrollStudents",
  async (
    payload: { classId: string; studentIds: string[] },
    { rejectWithValue },
  ) => {
    try {
      // Try bulk endpoint first (Vaniah docs: POST /classes/:classId/students)
      try {
        const res = await apiClient.post(
          `/api/proxy/classes/${payload.classId}/students`,
          {
            studentIds: payload.studentIds,
          },
        );
        return unwrap(res);
      } catch (bulkError: any) {
        // If bulk endpoint fails (404), try single enrollment endpoint (TEACHER_ADMIN_GUIDE: POST /classes/:classId/enroll)
        if (bulkError?.response?.status === 404) {
          const results = [];
          for (const studentId of payload.studentIds) {
            try {
              const res = await apiClient.post(
                `/api/proxy/classes/${payload.classId}/enroll`,
                { studentId },
              );
              results.push(unwrap(res));
            } catch {
              // Individual enroll failed — skip and continue
            }
          }
          return {
            success: true,
            message: `${results.length} students enrolled`,
            enrolledCount: results.length,
          };
        }
        throw bulkError;
      }
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to enroll students",
      );
    }
  },
);

// Remove student from class
export const removeStudentFromClass = createAsyncThunk(
  "admin/removeStudentFromClass",
  async (
    payload: { classId: string; studentId: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.delete(
        `/api/proxy/classes/${payload.classId}/enroll/${payload.studentId}`,
      );
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to remove student",
      );
    }
  },
);

// Fetch teacher's assigned classes (for admin to view)
export const fetchTeacherAssignedClasses = createAsyncThunk(
  "admin/fetchTeacherAssignedClasses",
  async (teacherId: string, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/reports/teacher/${teacherId}/classes`,
      );
      return unwrap(res) || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch teacher classes",
      );
    }
  },
);

// Remove teacher from class
export const removeTeacherFromClass = createAsyncThunk(
  "admin/removeTeacherFromClass",
  async (
    payload: { classId: string; teacherId: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.delete(
        `/api/proxy/classes/${payload.classId}/teachers/${payload.teacherId}`,
      );
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to remove teacher",
      );
    }
  },
);

// ---------- Admin: Subjects ----------
export const fetchSubjects = createAsyncThunk(
  "admin/fetchSubjects",
  async (_, { rejectWithValue }) => {
    try {
      // Try fetching with include parameters to get teacher assignments
      let res;
      try {
        res = await apiClient.get(
          "/api/proxy/subjects?include=teachers,teacherAssignments,classSubjects",
        );
      } catch (e) {
        // Fallback to basic endpoint
        res = await apiClient.get("/api/proxy/subjects");
      }
      const data = unwrap(res) || [];
      return Array.isArray(data) ? (data as SubjectItem[]) : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to fetch subjects",
      );
    }
  },
);

export const createSubject = createAsyncThunk(
  "admin/createSubject",
  async (
    payload: {
      name: string;
      code?: string;
      classId?: string;
      subjectType?: string;
      difficulty?: string;
      description?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post("/api/proxy/subjects", payload);
      return unwrap(res) as SubjectItem;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to create subject",
      );
    }
  },
);

export const assignSubjectToClass = createAsyncThunk(
  "admin/assignSubjectToClass",
  async (
    payload: {
      subjectId: string;
      classId: string;
      subjectType?: string;
      difficulty?: string;
      description?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const { subjectId, ...body } = payload;
      const res = await apiClient.post(`/api/proxy/subjects/${subjectId}/classes`, body);
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to assign subject to class",
      );
    }
  },
);

export const removeSubjectFromClass = createAsyncThunk(
  "admin/removeSubjectFromClass",
  async (
    payload: { subjectId: string; classId: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.delete(
        `/api/proxy/subjects/${payload.subjectId}/classes/${payload.classId}`,
      );
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to remove subject from class",
      );
    }
  },
);

export const updateSubjectDetails = createAsyncThunk(
  "admin/updateSubjectDetails",
  async (
    payload: { id: string; name?: string; code?: string },
    { rejectWithValue },
  ) => {
    try {
      const { id, ...body } = payload;
      const res = await apiClient.patch(`/api/proxy/subjects/${id}`, body);
      return unwrap(res) as SubjectItem;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to update subject",
      );
    }
  },
);

export const assignTeacherToSubject = createAsyncThunk(
  "admin/assignTeacherToSubject",
  async (
    payload: { subjectId: string; teacherId: string },
    { rejectWithValue },
  ) => {
    try {
      // Try the documented endpoint (TEACHER_ADMIN_GUIDE: /assign-teacher, Vaniah: /teachers)
      // First try /assign-teacher, fallback to /teachers if needed
      let res;
      try {
        res = await apiClient.post(
          `/api/proxy/subjects/${payload.subjectId}/assign-teacher`,
          {
            teacherId: payload.teacherId,
          },
        );
      } catch (e: any) {
        if (e?.response?.status === 404) {
          // Fallback to /teachers endpoint
          res = await apiClient.post(
            `/api/proxy/subjects/${payload.subjectId}/teachers`,
            {
              teacherId: payload.teacherId,
            },
          );
        } else {
          throw e;
        }
      }
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to assign teacher",
      );
    }
  },
);

export const assignTeacherToClassSubject = createAsyncThunk(
  "admin/assignTeacherToClassSubject",
  async (
    payload: { teacherId: string; classSubjectId: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post(
        `/api/proxy/subjects/class-subjects/${payload.classSubjectId}/teachers`,
        {
          teacherId: payload.teacherId,
        },
      );
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to assign teacher",
      );
    }
  },
);

export const removeTeacherFromClassSubject = createAsyncThunk(
  "admin/removeTeacherFromClassSubject",
  async (
    payload: { teacherId: string; classSubjectId: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.delete(
        `/api/proxy/subjects/class-subjects/${payload.classSubjectId}/teachers/${payload.teacherId}`,
      );
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to remove teacher",
      );
    }
  },
);

export const fetchClassSubjects = createAsyncThunk(
  "admin/fetchClassSubjects",
  async (classId: string, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(`/api/proxy/subjects/by-class/${classId}`);
      const data = unwrap(res) || [];
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to fetch class subjects",
      );
    }
  },
);

// ---------- Admin: Assessments ----------
export const fetchAssessments = createAsyncThunk(
  "admin/fetchAssessments",
  async (_, { rejectWithValue }) => {
    try {
      // Backend supports GET /assessments/:status.
      // For "All", fetch all statuses and merge.
      const statuses: Array<"started" | "ended" | "not_started"> = [
        "started",
        "ended",
        "not_started",
      ];

      const results = await Promise.all(
        statuses.map(async (status) => {
          try {
            const res = await apiClient.get(`/api/proxy/assessments/${status}`);
            const data = unwrap(res) || [];
            return Array.isArray(data) ? (data as AssessmentItem[]) : [];
          } catch (e: any) {
            // Fallback if backend expects query param instead of path
            if (e?.response?.status === 404) {
              const res = await apiClient.get(
                `/api/proxy/assessments?status=${status}`,
              );
              const data = unwrap(res) || [];
              return Array.isArray(data) ? (data as AssessmentItem[]) : [];
            }
            throw e;
          }
        }),
      );

      const merged = results.flat();
      const byId = new Map<string, AssessmentItem>();
      for (const a of merged) {
        if (a?.id) byId.set(a.id, a);
      }
      return Array.from(byId.values());
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch assessments",
      );
    }
  },
);

export const createAssessment = createAsyncThunk(
  "admin/createAssessment",
  async (payload: any, { rejectWithValue }) => {
    try {
      const res = await apiClient.post("/api/proxy/assessments", payload);
      return unwrap(res) as AssessmentItem;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to create assessment",
      );
    }
  },
);

export const updateAssessment = createAsyncThunk(
  "admin/updateAssessment",
  async (
    payload: { id: string; data: Partial<AssessmentItem> },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.patch(
        `/api/proxy/assessments/${payload.id}`,
        payload.data,
      );
      return unwrap(res) as AssessmentItem;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to update assessment",
      );
    }
  },
);

export const deleteAssessment = createAsyncThunk(
  "admin/deleteAssessment",
  async (id: string, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/api/proxy/assessments/${id}`);
      return id;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to delete assessment",
      );
    }
  },
);

export const publishAssessmentAdmin = createAsyncThunk(
  "admin/publishAssessment",
  async (
    payload: { assessmentId: string; publish: boolean },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post(
        `/api/proxy/assessments/${payload.assessmentId}/publish`,
        {
          publish: payload.publish,
        },
      );
      const data = unwrap(res) as any;
      return {
        id: data?.id || payload.assessmentId,
        isPublished: data?.isPublished ?? payload.publish,
        ...data,
      };
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to publish assessment",
      );
    }
  },
);

export const fetchAssessmentDetail = createAsyncThunk(
  "admin/fetchAssessmentDetail",
  async (assessmentId: string, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/assessments/details/${assessmentId}`,
      );
      const data = unwrap(res) || res.data;
      if (!data) return rejectWithValue("Assessment not found");
      return data as AssessmentItem;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load assessment details",
      );
    }
  },
);

export const fetchAssessmentSubmissions = createAsyncThunk(
  "admin/fetchAssessmentSubmissions",
  async (assessmentId: string, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/assessments/${assessmentId}/submissions`,
      );
      const data = unwrap(res) || res.data || [];
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load submissions",
      );
    }
  },
);

export const bulkUploadQuestions = createAsyncThunk(
  "admin/bulkUploadQuestions",
  async (
    payload: { assessmentId: string; file: File },
    { rejectWithValue },
  ) => {
    try {
      const form = new FormData();
      form.append("file", payload.file);
      const res = await apiClient.post(
        `/api/proxy/assessments/${payload.assessmentId}/questions/bulk`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to upload questions",
      );
    }
  },
);

export const addQuestion = createAsyncThunk(
  "admin/addQuestion",
  async (
    payload: {
      assessmentId: string;
      existingQuestions: Array<any>;
      question: string;
      options: Array<{ text: string; isCorrect: boolean }>;
      points?: number;
      type?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const normalizeType = (t?: string) => {
        if (!t) return "MCQ";
        const up = t.toUpperCase().replace(/[-\s]/g, "_");
        if (up === "TRUE_FALSE" || up === "TRUEFALSE" || up === "BOOLEAN") return "TRUE_FALSE";
        return "MCQ";
      };
      const newQ: any = {
        prompt: payload.question,
        type: normalizeType(payload.type),
        marks: payload.points ?? 1,
        choices: payload.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
        correctAnswer: payload.options.find((o) => o.isCorrect)?.text ?? "",
      };
      if ((payload as any).explanation) newQ.explanation = (payload as any).explanation;
      const questions = [
        ...payload.existingQuestions.map((q: any) => {
          const mapped: any = {
            prompt: q.prompt ?? q.question ?? q.questionText ?? "",
            type: normalizeType(q.type),
            marks: q.marks ?? q.points ?? 1,
            choices: (q.choices ?? q.options ?? []).map((c: any) => ({ text: c.text, isCorrect: c.isCorrect })),
            correctAnswer: q.correctAnswer ?? (q.choices ?? q.options ?? []).find((c: any) => c.isCorrect)?.text ?? "",
          };
          if (q.id) mapped.id = q.id;
          if (q.explanation) mapped.explanation = q.explanation;
          return mapped;
        }),
        newQ,
      ];
      const res = await apiClient.patch(
        `/api/proxy/assessments/${payload.assessmentId}`,
        { questions },
      );
      return unwrap(res) ?? res.data;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to add question",
      );
    }
  },
);

export const deleteQuestion = createAsyncThunk(
  "admin/deleteQuestion",
  async (
    payload: { assessmentId: string; questionId: string },
    { rejectWithValue },
  ) => {
    try {
      await apiClient.delete(
        `/api/proxy/assessments/${payload.assessmentId}/questions/${payload.questionId}`,
      );
      return payload.questionId;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to delete question",
      );
    }
  },
);

export const fetchCBTExams = createAsyncThunk(
  "admin/fetchCBTExams",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(
        "/api/proxy/assessments?isOnline=true",
      );
      const data = unwrap(res) || [];
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to fetch CBT exams",
      );
    }
  },
);

// ---------- Admin: Scores ----------
export const fetchScoresByAssessment = createAsyncThunk(
  "admin/fetchScoresByAssessment",
  async (assessmentId: string, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/scores/assessment/${assessmentId}`,
      );
      const data = unwrap(res) || [];
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to fetch scores",
      );
    }
  },
);

export const bulkUploadScores = createAsyncThunk(
  "admin/bulkUploadScores",
  async (
    payload: { assessmentId: string; file: File },
    { rejectWithValue },
  ) => {
    try {
      const form = new FormData();
      form.append("file", payload.file);
      const res = await apiClient.post(
        `/api/proxy/scores/bulk?assessmentId=${encodeURIComponent(payload.assessmentId)}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to upload scores",
      );
    }
  },
);

// ---------- Admin: Reports ----------
export const fetchSchoolStatistics = createAsyncThunk(
  "admin/fetchSchoolStatistics",
  async (params: { session: string; term: string }, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/reports/school/statistics?session=${encodeURIComponent(params.session)}&term=${encodeURIComponent(
          params.term,
        )}`,
      );
      return (unwrap(res) || res.data) as SchoolStatistics;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch statistics",
      );
    }
  },
);

export const fetchApprovalQueue = createAsyncThunk(
  "admin/fetchApprovalQueue",
  async (status: string = "pending", { rejectWithValue }) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/reports/approval-queue?status=${encodeURIComponent(status)}`,
      );
      const data = unwrap(res) || [];
      return Array.isArray(data) ? (data as ApprovalQueueItem[]) : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch approval queue",
      );
    }
  },
);

export const approveReports = createAsyncThunk(
  "admin/approveReports",
  async (
    payload: {
      action: "approve" | "reject" | "publish";
      reportCardIds: string[];
      rejectionReason?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post("/api/proxy/reports/approve", payload);
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to update reports",
      );
    }
  },
);

export const fetchBookletPreviewAdmin = createAsyncThunk(
  "admin/fetchBookletPreviewAdmin",
  async (
    params: { classId: string; session: string; term: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/reports/class/${params.classId}/booklet-preview?session=${encodeURIComponent(
          params.session,
        )}&term=${encodeURIComponent(params.term)}`,
      );
      return unwrap(res) || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch booklet preview",
      );
    }
  },
);

// ---------- Admin: School Settings (Guide section 11) ----------
export const fetchSchoolSettings = createAsyncThunk(
  "admin/fetchSchoolSettings",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get("/api/proxy/school-settings");
      return unwrap(res) || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch school settings",
      );
    }
  },
);

export const updateSchoolSettings = createAsyncThunk(
  "admin/updateSchoolSettings",
  async (payload: any, { rejectWithValue }) => {
    try {
      const res = await apiClient.put("/api/proxy/school-settings", payload);
      return unwrap(res) || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to update school settings",
      );
    }
  },
);

export const fetchGradingTemplates = createAsyncThunk(
  "admin/fetchGradingTemplates",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(
        "/api/proxy/school-settings/grading/templates",
      );
      const data = unwrap(res) || [];
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch grading templates",
      );
    }
  },
);

export const fetchGradingSystem = createAsyncThunk(
  "admin/fetchGradingSystem",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get("/api/proxy/school-settings/grading");
      return unwrap(res) || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch grading system",
      );
    }
  },
);

export const updateGradingSystem = createAsyncThunk(
  "admin/updateGradingSystem",
  async (payload: any, { rejectWithValue }) => {
    try {
      const res = await apiClient.put(
        "/api/proxy/school-settings/grading",
        payload,
      );
      return unwrap(res) || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to update grading system",
      );
    }
  },
);

// ---------- Attendance (Guide section 13) ----------
export const recordAttendance = createAsyncThunk(
  "admin/recordAttendance",
  async (
    payload: {
      studentId: string;
      session: string;
      term: string;
      daysPresent: number;
      totalDays: number;
    },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post("/api/proxy/attendance", payload);
      return unwrap(res) || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to record attendance",
      );
    }
  },
);

export const fetchAttendance = createAsyncThunk(
  "admin/fetchAttendance",
  async (
    params: {
      studentId?: string;
      classId?: string;
      session: string;
      term: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const q = new URLSearchParams();
      if (params.studentId) q.set("studentId", params.studentId);
      if (params.classId) q.set("classId", params.classId);
      q.set("session", params.session);
      q.set("term", params.term);
      const res = await apiClient.get(`/api/proxy/attendance?${q.toString()}`);
      const data = unwrap(res) || [];
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch attendance",
      );
    }
  },
);

// ---------- Comments (Guide section 12) ----------
export const addCommentAdmin = createAsyncThunk(
  "admin/addCommentAdmin",
  async (payload: any, { rejectWithValue }) => {
    try {
      const res = await apiClient.post("/api/proxy/comments", payload);
      return unwrap(res) || res.data || payload;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to add comment",
      );
    }
  },
);

export const bulkAddComments = createAsyncThunk(
  "admin/bulkAddComments",
  async (payload: any, { rejectWithValue }) => {
    try {
      const res = await apiClient.post("/api/proxy/comments/bulk", payload);
      return unwrap(res) || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to bulk add comments",
      );
    }
  },
);

export const fetchStudentComments = createAsyncThunk(
  "admin/fetchStudentComments",
  async (
    params: { studentId: string; session: string; term: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/comments/student/${params.studentId}?term=${encodeURIComponent(params.term)}&session=${encodeURIComponent(
          params.session,
        )}`,
      );
      const data = unwrap(res) || [];
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch student comments",
      );
    }
  },
);

// ---------- Admin: Assessment Categories ----------
export const fetchAssessmentCategoriesMap = createAsyncThunk(
  "admin/fetchAssessmentCategories",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get("/api/proxy/assessment-categories");
      const data = unwrap(res) || [];
      if (Array.isArray(data)) return data;
      // Backend may return { items: [...] } or { data: [...] } wrapped shapes
      if (data && Array.isArray(data.items)) return data.items;
      if (data && Array.isArray(data.data)) return data.data;
      return [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch assessment categories",
      );
    }
  },
);

export const createAssessmentCategory = createAsyncThunk(
  "admin/createAssessmentCategory",
  async (
    payload: {
      name: string;
      code: string;
      weight: number;
      description?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post(
        "/api/proxy/assessment-categories",
        payload,
      );
      return unwrap(res);
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to create assessment category",
      );
    }
  },
);

export const deleteAssessmentCategory = createAsyncThunk(
  "admin/deleteAssessmentCategory",
  async (id: string, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/api/proxy/assessment-categories/${id}`);
      return id;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to delete assessment category",
      );
    }
  },
);

// Fetch students by class using /users endpoint
export const fetchStudentsByClass = createAsyncThunk(
  "admin/fetchStudentsByClass",
  async (params: { classId: string }, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/users?classId=${params.classId}&role=student`,
      );
      const data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to fetch students",
      );
    }
  },
);

// Fetch generated report cards for a class
export const fetchClassReportCards = createAsyncThunk(
  "admin/fetchClassReportCards",
  async (
    params: { classId?: string; session?: string; term?: string },
    { rejectWithValue },
  ) => {
    try {
      const query = new URLSearchParams();
      if (params.classId) query.set("classId", params.classId);
      if (params.session) query.set("session", params.session);
      if (params.term) query.set("term", params.term);

      const res = await apiClient.get(
        `/api/proxy/reports/report-cards?${query}`,
      );
      const data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load report cards",
      );
    }
  },
);
