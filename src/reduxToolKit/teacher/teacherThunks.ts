import { createAsyncThunk } from "@reduxjs/toolkit";
import apiClient from "@/lib/api";

export type AcademicCurrent = {
  session: string;
  term: string;
  sessionId?: string;
  termId?: string;
  startDate?: string;
  endDate?: string;
};

export type Assessment = {
  id: string;
  title: string;
  subjectId?: string;
  classId?: string;
  categoryId?: string;
  totalMarks?: number;
  marks?: number;
  passingMarks?: number;
  duration?: number;
  durationMins?: number;
  durationMinutes?: number;
  instructions?: string;
  startsAt?: string;
  endsAt?: string;
  session?: string;
  term?: string;
  isOnline?: boolean;
  status?: string;
  subject?: { id: string; name: string };
  class?: { id: string; name: string };
  questions?: any[];
};

export type CommentType = "subject_teacher" | "class_teacher" | "principal";

export type TeacherComment = {
  id?: string;
  studentId: string;
  subjectId?: string;
  term: string;
  session: string;
  comment: string;
  type: CommentType;
  createdAt?: string;
};

export const fetchAcademicCurrent = createAsyncThunk(
  "teacher/fetchAcademicCurrent",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get("/api/proxy/academic/current");
      const data = res.data?.data || res.data;
      if (!data) return rejectWithValue("No academic session returned");
      return data as AcademicCurrent;
    } catch (e: any) {
      console.error(
        "[fetchAcademicCurrent] Failed to fetch current academic session:",
        e,
      );
      return rejectWithValue(e?.message || "Failed to load academic session");
    }
  },
);

export const fetchMyAssessments = createAsyncThunk(
  "teacher/fetchMyAssessments",
  async (_, { rejectWithValue, getState }) => {
    try {
      // REFACTORED (April 2026): Backend now returns flattened assessments with classId/subjectId at root
      // No need for complex grouping logic or deep normalization

      const state: any = getState();
      const teacherClasses =
        state.teacher?.teacherClasses || state.teacher?.classes || [];

      // Build map of teacher's assigned class-subject pairs for filtering
      const assignedClassSubjectPairs = new Map<string, Set<string>>();

      teacherClasses.forEach((c: any) => {
        if (c.type === "subject_assignment" && c.subjectId && c.classId) {
          if (!assignedClassSubjectPairs.has(c.classId)) {
            assignedClassSubjectPairs.set(c.classId, new Set());
          }
          assignedClassSubjectPairs.get(c.classId)!.add(c.subjectId);
        }
        if (
          c.type === "class_assignment" &&
          c.classId &&
          Array.isArray(c.class?.subjects)
        ) {
          if (!assignedClassSubjectPairs.has(c.classId)) {
            assignedClassSubjectPairs.set(c.classId, new Set());
          }
          c.class.subjects.forEach((s: any) => {
            const subjId = s.id || s;
            assignedClassSubjectPairs.get(c.classId)!.add(subjId);
          });
        }
        if (!c.type && c.subjectId && c.classId) {
          if (!assignedClassSubjectPairs.has(c.classId)) {
            assignedClassSubjectPairs.set(c.classId, new Set());
          }
          assignedClassSubjectPairs.get(c.classId)!.add(c.subjectId);
        }
      });

      console.log("[fetchMyAssessments] Teacher assignments loaded");

      // Fetch assessments from all statuses
      const statuses: Array<"started" | "ended" | "not_started"> = [
        "started",
        "ended",
        "not_started",
      ];
      const results = await Promise.all(
        statuses.map(async (status) => {
          try {
            const res = await apiClient.get(`/api/proxy/assessments/${status}`);
            const data = res.data?.data || res.data || [];
            if (Array.isArray(data)) {
              return data.map((item: any) => ({
                ...item,
                _fetchedStatus: status,
              }));
            }
            return [];
          } catch (e: any) {
            console.error(
              `[fetchMyAssessments] Failed to fetch /assessments/${status}:`,
              e?.message,
            );
            return [];
          }
        }),
      );

      const rawCombined = results.flat();
      console.log(
        `[fetchMyAssessments] Fetched ${rawCombined.length} total assessments`,
      );

      if (rawCombined.length === 0) {
        console.warn("[fetchMyAssessments] No assessments found");
        return [];
      }

      // NEW (APRIL 2026): Backend now returns flat array structure with flattened IDs
      // Check if response is still grouped (old model) or flat (new model)
      const isGrouped = rawCombined.some(
        (item: any) => item.assessments && Array.isArray(item.assessments),
      );

      let items: Assessment[] = [];

      if (isGrouped) {
        // LEGACY PATH: Handle grouped response (backward compatibility)
        console.log(
          "[fetchMyAssessments] Processing grouped response (legacy)",
        );

        items = rawCombined.flatMap((group: any) => {
          if (!group.assessments || !Array.isArray(group.assessments))
            return [];

          const subjectId = group.id || group.subjectId || group.subject?.id;
          const classId = group.class?.id || group.classId;

          // Filter by teacher assignments
          const isAssigned =
            assignedClassSubjectPairs.has(classId) &&
            assignedClassSubjectPairs.get(classId)!.has(subjectId);

          if (!isAssigned) {
            console.warn(
              `[fetchMyAssessments] Skipping group: class=${classId}, subject=${subjectId}`,
            );
            return [];
          }

          return group.assessments.map((a: any) => ({
            ...a,
            classId: classId || a.classId,
            subjectId: subjectId || a.subjectId,
            class: group.class || a.class || { id: classId, name: "Unknown" },
            subject: {
              id: subjectId,
              name: group.name || a.subject?.name || "Unknown",
            },
            isOnline: a.assessmentType === "online" || a.isOnline === true,
            submissionCount: a.submissionCount ?? 0,
          }));
        });
      } else {
        // NEW PATH (PRIMARY): Backend returns flat array with flattened classId/subjectId
        // Simply validate assignments and normalize field names
        console.log(
          "[fetchMyAssessments] Processing flat response (new model)",
        );

        items = rawCombined.filter((a: any) => {
          const classId = a.classId;
          const subjectId = a.subjectId;

          if (!classId || !subjectId) {
            console.warn(
              "[fetchMyAssessments] Assessment missing classId or subjectId:",
              a.title,
            );
            return false;
          }

          const isAssigned =
            assignedClassSubjectPairs.has(classId) &&
            assignedClassSubjectPairs.get(classId)!.has(subjectId);

          return isAssigned;
        }) as Assessment[];
      }

      // NORMALIZATION: Ensure consistent field naming across model versions
      items = items.map((a: any) => {
        const isOnline = a.isOnline ?? a.assessmentType === "online";
        const totalMarks = a.totalMarks ?? a.marks ?? a.totalScore ?? 100;
        const duration = a.duration ?? a.durationMins ?? a.durationMinutes ?? 60;
        const submissionCount = a.submissionCount ?? 0;

        let status = "draft";
        if (a.isPublished) {
          const now = new Date();
          const startsAt = a.startsAt ? new Date(a.startsAt) : null;
          const endsAt = a.endsAt ? new Date(a.endsAt) : null;
          if (endsAt && now > endsAt) {
            status = "ended";
          } else if (startsAt && now >= startsAt) {
            status = "started";
          } else {
            status = "not_started";
          }
        }

        return {
          ...a,
          isOnline,
          totalMarks,
          duration,
          submissionCount,
          status,
        };
      });

      // Deduplicate by ID
      const byId = new Map<string, Assessment>();
      items.forEach((a) => {
        if (a?.id) byId.set(a.id, a);
      });

      const finalItems = Array.from(byId.values());
      console.log(
        `[fetchMyAssessments] Returning ${finalItems.length} assessments`,
      );
      return finalItems;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load assessments",
      );
    }
  },
);

export const fetchTeacherGradingQueue = createAsyncThunk(
  "teacher/fetchGradingQueue",
  async (params: { assessmentId?: string } | undefined, { rejectWithValue }) => {
    try {
      const q = params?.assessmentId ? `?assessmentId=${encodeURIComponent(params.assessmentId)}` : "";
      const res = await apiClient.get(`/api/proxy/teacher/grading-queue${q}`);
      return res.data?.data || res.data || [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to fetch grading queue",
      );
    }
  },
);

export const fetchTeacherClasses = createAsyncThunk(
  "teacher/fetchTeacherClasses",
  async (params: { teacherId: string }, { rejectWithValue }) => {
    // 1. Try optimized teacher assigned-context endpoint
    try {
      const contextRes = await apiClient.get("/api/proxy/teacher/assigned-context");
      const ctx = contextRes.data?.data || contextRes.data;
      if (ctx && (Array.isArray(ctx.assignedClasses) || Array.isArray(ctx.assignedSubjects))) {
        const merged: any[] = [];
        (ctx.assignedClasses || []).forEach((c: any) => {
          merged.push({
            id: `class-${c.id}`,
            classId: c.id,
            className: c.name,
            class: { ...c, id: c.id, name: c.name },
            subject: null,
            teacherId: params.teacherId,
            type: "class_assignment",
          });
        });
        (ctx.assignedSubjects || []).forEach((s: any) => {
          merged.push({
            id: `subject-${s.id}-${s.classId || "all"}`,
            classId: s.classId || s.id,
            className: s.className || s.class?.name || "Assigned Class",
            class: { id: s.classId || s.id, name: s.className || s.class?.name || "Assigned Class" },
            subject: s,
            teacherId: params.teacherId,
            type: "subject_assignment",
          });
        });
        if (merged.length > 0) {
          return merged;
        }
      }
    } catch (err) {
      // Fall through to dual fetch strategy
    }

    // DUAL FETCH FALLBACK STRATEGY:
    // 1. Fetch classes explicitly assigned to teacher (e.g. Class Teacher role)
    // 2. Fetch subjects explicitly assigned to teacher (Subject Teacher role)
    // Merge results to provide full access list.
    try {
      const [classesRes, subjectsRes] = await Promise.allSettled([
        apiClient.get(`/api/proxy/classes/teacher/${params.teacherId}`),
        apiClient.get(`/api/proxy/subjects?teacherId=${params.teacherId}`),
      ]);

      const mergedItems: any[] = [];
      const seenIds = new Set<string>();

      if (classesRes.status === "fulfilled") {
        const rawClasses =
          classesRes.value.data?.data || classesRes.value.data || [];
        if (Array.isArray(rawClasses)) {
          rawClasses.forEach((c: any) => {
            const item = {
              id: `class-${c.id}`,
              classId: c.id,
              className: c.name,
              class: { ...c, id: c.id, name: c.name },
              subject: null,
              teacherId: params.teacherId,
              type: "class_assignment",
            };
            mergedItems.push(item);
          });
        }
      }

      if (subjectsRes.status === "fulfilled") {
        const allSubjects =
          subjectsRes.value.data?.data || subjectsRes.value.data || [];
        if (Array.isArray(allSubjects)) {
          const assignedSubjects = allSubjects.filter((s: any) => {
            // Check new model (direct 'teachers' array on subject)
            if (s.teachers && Array.isArray(s.teachers)) {
              if (
                s.teachers.some(
                  (t: any) =>
                    t.teacherId === params.teacherId ||
                    t.id === params.teacherId,
                )
              )
                return true;
            }
            // Check legacy model
            if (s.teacherAssignments && Array.isArray(s.teacherAssignments)) {
              return s.teacherAssignments.some(
                (assignment: any) =>
                  assignment.teacherId === params.teacherId ||
                  (assignment.teacher &&
                    assignment.teacher.id === params.teacherId),
              );
            }
            return s.teacherId === params.teacherId;
          });

          assignedSubjects.forEach((s: any) => {
            const classId = s.class?.id || s.classId || s.id;
            const item = {
              id: s.id,
              subjectId: s.id,
              subjectName: s.name,
              classId: classId,
              className:
                s.class?.name ||
                s.className ||
                `Class ${classId?.substring(0, 6) || "Unknown"}`,
              class: s.class || {
                id: classId,
                name:
                  s.className ||
                  `Class ${classId?.substring(0, 6) || "Unknown"}`,
              },
              subject: { id: s.id, name: s.name },
              teacherId: params.teacherId,
              type: "subject_assignment",
            };
            mergedItems.push(item);
          });
        }
      }

      const classesNeedingSubjects = mergedItems.filter(
        (item) =>
          item.type === "class_assignment" &&
          (!item.class?.subjects || item.class.subjects.length === 0),
      );

      if (classesNeedingSubjects.length > 0) {
        await Promise.all(
          classesNeedingSubjects.map(async (item: any) => {
            try {
              const subjectsRes = await apiClient.get(
                `/api/proxy/subjects?classId=${item.classId}`,
              );
              const subjects = subjectsRes.data?.data || subjectsRes.data || [];
              // Update the class object with subjects
              if (item.class) {
                item.class.subjects = Array.isArray(subjects) ? subjects : [];
              }
            } catch (err) {
              console.error(
                `[fetchTeacherClasses] Failed to fetch subjects for class ${item.classId}:`,
                err,
              );
              if (item.class) {
                item.class.subjects = [];
              }
            }
          }),
        );
      }

      return mergedItems;
    } catch (err: any) {
      console.error("fetchTeacherClasses critical failure", err);
      return rejectWithValue(err?.message || "Failed to load teacher classes");
    }
  },
);

// Create assessment with atomic class-subject linking (APRIL 2026 REFACTOR)
// Payload MUST include classSubjectIds array for backend to link assessment atomically
// This removes the separate linking step, improving atomicity and performance
export const createTeacherAssessment = createAsyncThunk(
  "teacher/createTeacherAssessment",
  async (payload: any, { rejectWithValue }) => {
    try {
      console.log(
        "[createTeacherAssessment] Creating assessment with classSubjectIds",
        {
          title: payload.title,
          classSubjectIds: payload.classSubjectIds,
        },
      );

      const res = await apiClient.post("/api/proxy/assessments", payload);
      const data = res.data?.data || res.data || null;

      console.log("[createTeacherAssessment] Assessment created successfully", {
        assessmentId: data?.id,
        classSubjectIds: payload.classSubjectIds,
      });

      return data;
    } catch (e: any) {
      console.error("[createTeacherAssessment] Failed to create assessment", {
        error: e?.response?.data?.message || e?.message,
        payload: {
          title: payload.title,
          classSubjectIds: payload.classSubjectIds,
        },
      });
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to create assessment",
      );
    }
  },
);

export const fetchAssessmentsByClassSubject = createAsyncThunk(
  "teacher/fetchAssessmentsByClassSubject",
  async (
    params: { classId: string; subjectId: string },
    { rejectWithValue },
  ) => {
    try {
      console.log(
        "[fetchAssessmentsByClassSubject] Fetching assessments for class:",
        params.classId,
        "subject:",
        params.subjectId,
      );

      // The API doesn't support query filtering by classId/subjectId
      // Instead, we fetch all assessments and filter client-side
      // The endpoint /api/proxy/assessments/:status returns grouped by subject

      const statuses: Array<"started" | "ended" | "not_started"> = [
        "started",
        "ended",
        "not_started",
      ];
      const results = await Promise.all(
        statuses.map(async (status) => {
          try {
            const res = await apiClient.get(`/api/proxy/assessments/${status}`);
            const data = res.data?.data || res.data || [];
            console.log(
              `[fetchAssessmentsByClassSubject] API response for status=${status}:`,
              data,
            );
            if (Array.isArray(data)) {
              return data.map((item: any) => ({
                ...item,
                _fetchedStatus: status,
              }));
            }
            return [];
          } catch (e: any) {
            console.error(
              `[fetchAssessmentsByClassSubject] Failed to fetch status=${status}:`,
              e?.message,
            );
            return [];
          }
        }),
      );

      const rawCombined = results.flat();
      console.log(
        "[fetchAssessmentsByClassSubject] Combined results:",
        rawCombined,
      );

      if (rawCombined.length === 0) {
        console.warn("[fetchAssessmentsByClassSubject] No assessments found");
        return [];
      }

      // Handle grouped structure (Subject -> Assessments)
      const isGrouped = rawCombined.some(
        (item: any) => item.assessments && Array.isArray(item.assessments),
      );
      let items: Assessment[] = [];

      if (isGrouped) {
        console.log(
          "[fetchAssessmentsByClassSubject] Response is grouped by subject",
        );
        const flattened: Assessment[] = [];

        rawCombined.forEach((group: any) => {
          if (group.assessments && Array.isArray(group.assessments)) {
            const subjectId = group.id || group.subjectId || group.subject?.id;
            const classData = group.class || {};
            const classId = classData.id || group.classId;

            // Filter: Only include assessments matching the selected class/subject
            if (
              String(classId).toLowerCase() !==
              String(params.classId).toLowerCase()
            ) {
              console.log(
                `[fetchAssessmentsByClassSubject] Skipping class=${classId} (looking for ${params.classId})`,
              );
              return;
            }

            if (
              String(subjectId).toLowerCase() !==
              String(params.subjectId).toLowerCase()
            ) {
              console.log(
                `[fetchAssessmentsByClassSubject] Skipping subject=${subjectId} (looking for ${params.subjectId})`,
              );
              return;
            }

            console.log(
              `[fetchAssessmentsByClassSubject] ✓ Including ${group.assessments.length} assessments for class=${classId}, subject=${subjectId}`,
            );

            group.assessments.forEach((assess: any) => {
              flattened.push({
                ...assess,
                classId: classId,
                subjectId: subjectId,
                subject: {
                  id: subjectId,
                  name: group.name || assess.subject?.name || "Unknown",
                  code: group.code || assess.subject?.code,
                },
                class: classData || { id: classId, name: "Unknown" },
                title: assess.title || "Untitled Assessment",
                totalMarks: assess.totalMarks ?? assess.marks ?? 100,
                duration: assess.durationMins ?? assess.duration ?? 60,
                status: assess.status || "not_started",
                isOnline:
                  assess.assessmentType === "online" ||
                  assess.isOnline === true,
              });
            });
          }
        });
        items = flattened;
      } else {
        // Flat array response - filter by class/subject
        items = (Array.isArray(rawCombined) ? rawCombined : [])
          .filter((a: any) => {
            const matchClass =
              String(a.classId).toLowerCase() ===
                String(params.classId).toLowerCase() ||
              String(a.class?.id).toLowerCase() ===
                String(params.classId).toLowerCase();
            const matchSubject =
              String(a.subjectId).toLowerCase() ===
                String(params.subjectId).toLowerCase() ||
              String(a.subject?.id).toLowerCase() ===
                String(params.subjectId).toLowerCase();
            return matchClass && matchSubject;
          })
          .map((a: any) => ({
            ...a,
            classId: a.classId || params.classId,
            subjectId: a.subjectId || params.subjectId,
            totalMarks: a.totalMarks ?? a.marks ?? 100,
            duration: a.durationMins ?? a.duration ?? 60,
            status: a.status || "not_started",
            isOnline: a.assessmentType === "online" || a.isOnline === true,
          })) as Assessment[];
      }

      // Normalize items and compute status dynamically before returning
      items = items.map((a: any) => {
        const isOnline = a.isOnline ?? a.assessmentType === "online";
        const totalMarks = a.totalMarks ?? a.marks ?? a.totalScore ?? 100;
        const duration = a.duration ?? a.durationMins ?? a.durationMinutes ?? 60;
        const submissionCount = a.submissionCount ?? 0;

        let status = "draft";
        if (a.isPublished) {
          const now = new Date();
          const startsAt = a.startsAt ? new Date(a.startsAt) : null;
          const endsAt = a.endsAt ? new Date(a.endsAt) : null;
          if (endsAt && now > endsAt) {
            status = "ended";
          } else if (startsAt && now >= startsAt) {
            status = "started";
          } else {
            status = "not_started";
          }
        }

        return {
          ...a,
          isOnline,
          totalMarks,
          duration,
          submissionCount,
          status,
        };
      });

      console.log(
        `[fetchAssessmentsByClassSubject] Returning ${items.length} assessments`,
      );
      return items;
    } catch (e: any) {
      console.error(
        "[fetchAssessmentsByClassSubject] Critical error:",
        e?.message,
      );
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load assessments for class/subject",
      );
    }
  },
);

export const fetchScoresByAssessmentTeacher = createAsyncThunk(
  "teacher/fetchScoresByAssessmentTeacher",
  async (assessmentId: string, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/scores/assessment/${assessmentId}`,
      );
      const items = res.data?.data || res.data || [];
      return Array.isArray(items) ? items : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to load scores",
      );
    }
  },
);

export const fetchAssessmentsByStatus = createAsyncThunk(
  "teacher/fetchAssessmentsByStatus",
  async (status: "started" | "ended" | "not_started", { rejectWithValue }) => {
    try {
      let res: any;
      try {
        res = await apiClient.get(`/api/proxy/assessments/${status}`);
      } catch (e: any) {
        // Fallback for controller mismatch (if status is read from query instead of path)
        if (e?.response?.status === 404) {
          res = await apiClient.get(`/api/proxy/assessments?status=${status}`);
        } else {
          throw e;
        }
      }

      const items = res.data?.data || res.data || [];
      return {
        status,
        items: Array.isArray(items) ? (items as Assessment[]) : [],
      };
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load assessments",
      );
    }
  },
);

export const fetchAssessmentDetail = createAsyncThunk(
  "teacher/fetchAssessmentDetail",
  async (assessmentId: string, { rejectWithValue }) => {
    try {
      // Updated endpoint to avoid collision with :status route
      const res = await apiClient.get(
        `/api/proxy/assessments/details/${assessmentId}`,
      );
      const data = res.data?.data || res.data;
      if (!data) return rejectWithValue("Assessment not found");

      let status = "draft";
      if (data.isPublished) {
        const now = new Date();
        const startsAt = data.startsAt ? new Date(data.startsAt) : null;
        const endsAt = data.endsAt ? new Date(data.endsAt) : null;
        if (endsAt && now > endsAt) {
          status = "ended";
        } else if (startsAt && now >= startsAt) {
          status = "started";
        } else {
          status = "not_started";
        }
      }

      return {
        ...data,
        isOnline: data.isOnline ?? data.assessmentType === "online",
        totalMarks: data.totalMarks ?? data.marks ?? data.totalScore ?? 100,
        duration: data.duration ?? data.durationMins ?? data.durationMinutes ?? 60,
        status,
      } as Assessment;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to load assessment",
      );
    }
  },
);

export const fetchAssessmentSubmissions = createAsyncThunk(
  "teacher/fetchAssessmentSubmissions",
  async (assessmentId: string, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/assessments/${assessmentId}/submissions`,
      );
      const items = res.data?.data || res.data || [];
      return Array.isArray(items) ? items : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load submissions",
      );
    }
  },
);

export const publishAssessment = createAsyncThunk(
  "teacher/publishAssessment",
  async (
    params: { assessmentId: string; publish: boolean },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post(
        `/api/proxy/assessments/${params.assessmentId}/publish`,
        { publish: params.publish },
      );
      const data = res.data?.data || res.data || {};
      // Always return id + isPublished so the slice reducer can update the right assessment
      return {
        id: data.id || params.assessmentId,
        isPublished: data.isPublished ?? params.publish,
        ...data,
      };
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to update publish state",
      );
    }
  },
);

export const gradeAnswer = createAsyncThunk(
  "teacher/gradeAnswer",
  async (
    params: {
      submissionId: string;
      answerId: string;
      marksAwarded: number;
      comment?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post(
        `/api/proxy/assessments/submissions/${params.submissionId}/answers/${params.answerId}/grade`,
        { marksAwarded: params.marksAwarded, comment: params.comment },
      );
      return res.data?.data || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to grade answer",
      );
    }
  },
);

export const uploadOfflineScores = createAsyncThunk(
  "teacher/uploadOfflineScores",
  async (
    params: {
      assessmentId: string;
      scores: Array<{
        studentId: string;
        marksAwarded: number;
        maxMarks: number;
        comment?: string;
      }>;
    },
    { rejectWithValue },
  ) => {
    try {
      const payload = {
        scores: params.scores,
        // Optional defaultMaxMarks can be omitted if per-student is provided
      };

      const res = await apiClient.post(
        `/api/proxy/assessments/${params.assessmentId}/scores`,
        payload,
      );
      return res.data?.data || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to upload scores",
      );
    }
  },
);

export const bulkUploadScoresExcel = createAsyncThunk(
  "teacher/bulkUploadScoresExcel",
  async (params: { assessmentId: string; file: File }, { rejectWithValue }) => {
    try {
      const form = new FormData();
      form.append("file", params.file);
      const res = await apiClient.post(
        `/api/proxy/scores/bulk?assessmentId=${encodeURIComponent(params.assessmentId)}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return res.data?.data || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to bulk upload scores",
      );
    }
  },
);

export const addComment = createAsyncThunk(
  "teacher/addComment",
  async (payload: TeacherComment, { rejectWithValue }) => {
    try {
      const res = await apiClient.post("/api/proxy/comments", payload);
      return res.data?.data || res.data || payload;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to add comment",
      );
    }
  },
);

export const fetchMyComments = createAsyncThunk(
  "teacher/fetchMyComments",
  async (params: { session: string; term: string }, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/comments/my-comments?session=${encodeURIComponent(params.session)}&term=${encodeURIComponent(
          params.term,
        )}`,
      );
      const items = res.data?.data || res.data || [];
      return Array.isArray(items) ? (items as TeacherComment[]) : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to load comments",
      );
    }
  },
);

export const fetchBookletPreview = createAsyncThunk(
  "teacher/fetchBookletPreview",
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
      return res.data?.data || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load booklet preview",
      );
    }
  },
);

export const submitReportsForApproval = createAsyncThunk(
  "teacher/submitReportsForApproval",
  async (
    params: { classId: string; session: string; term: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post(
        "/api/proxy/reports/submit-for-approval",
        params,
      );
      return res.data?.data || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to submit for approval",
      );
    }
  },
);

// Fetch students in a class (for score entry)
// Based on API docs: GET /classes/:classId returns { students: [...] }
// Fetch students in a class (for score entry)
// Based on API docs: GET /classes/:classId returns { students: [...] }
export const fetchClassStudents = createAsyncThunk(
  "teacher/fetchClassStudents",
  async (classId: string, { rejectWithValue }) => {
    try {
      let students: any[] = [];

      const classRes = await apiClient.get(`/api/proxy/classes/${classId}`);
      const classData = classRes.data?.data || classRes.data || {};

      if (classData.students && Array.isArray(classData.students)) {
        students = classData.students;
        return students;
      } else if (
        classData.enrollments &&
        Array.isArray(classData.enrollments)
      ) {
        students = classData.enrollments
          .map((e: any) => {
            const base = e.student || e;
            return base;
          })
          .filter((s: any) => s && (s.id || s.firstName));
        return students;
      }

      // Return empty array if no students found, avoiding insecure fallbacks
      return [];
    } catch (e: any) {
      console.error("[fetchClassStudents] Critical Error:", e);
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load class students",
      );
    }
  },
);

// Fetch subjects for a class — uses GET /subjects/by-class/:classId (new model)
// Returns subjects with classSubjectId, subjectType, difficulty, isActive flattened
export const fetchClassSubjects = createAsyncThunk(
  "teacher/fetchClassSubjects",
  async (classId: string, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/subjects/by-class/${classId}`,
      );
      const data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "Failed to load subjects",
      );
    }
  },
);

// Fetch teacher's assigned subjects with class info (for authorization)
export const fetchTeacherSubjectsWithClasses = createAsyncThunk(
  "teacher/fetchTeacherSubjectsWithClasses",
  async (teacherId: string, { rejectWithValue }) => {
    try {
      // Per API docs: GET /subjects?teacherId=:id returns subjects with class info
      const res = await apiClient.get(
        `/api/proxy/subjects?teacherId=${teacherId}`,
      );
      const data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load teacher subjects",
      );
    }
  },
);

// Fetch individual student report card
export const fetchStudentReportCard = createAsyncThunk(
  "teacher/fetchStudentReportCard",
  async (
    params: { studentId: string; session: string; term: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.get(
        `/api/proxy/reports/student/${params.studentId}/report-card?session=${encodeURIComponent(
          params.session,
        )}&term=${encodeURIComponent(params.term)}`,
      );
      return res.data?.data || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load report card",
      );
    }
  },
);

// Fetch class report summary (all students with averages, ranks)
export const fetchClassReportSummary = createAsyncThunk(
  "teacher/fetchClassReportSummary",
  async (
    params: { classId: string; session: string; term: string },
    { rejectWithValue },
  ) => {
    try {
      // Try booklet preview first as it has summary data
      const res = await apiClient.get(
        `/api/proxy/reports/class/${params.classId}/booklet-preview?session=${encodeURIComponent(
          params.session,
        )}&term=${encodeURIComponent(params.term)}`,
        { skipGlobalRedirect: true } as any,
      );
      return res.data?.data || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load class report summary",
      );
    }
  },
);

// Generate and notify (email) report cards
export const generateAndNotifyReports = createAsyncThunk(
  "teacher/generateAndNotifyReports",
  async (
    params: { studentIds: string[]; session: string; term: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.post(
        "/api/proxy/reports/generate-and-notify",
        params,
      );
      return res.data?.data || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to generate and send reports",
      );
    }
  },
);

export const fetchAssessmentCategories = createAsyncThunk(
  "teacher/fetchAssessmentCategories",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get("/api/proxy/assessment-categories");
      const data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load assessment categories",
      );
    }
  },
);

export const updateTeacherAssessment = createAsyncThunk(
  "teacher/updateTeacherAssessment",
  async (
    params: { id: string; data: Partial<Assessment> },
    { rejectWithValue },
  ) => {
    try {
      const res = await apiClient.patch(
        `/api/proxy/assessments/${params.id}`,
        params.data,
      );
      return res.data?.data || res.data || null;
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        (Array.isArray(e?.response?.data?.errors)
          ? e.response.data.errors.join(", ")
          : null) ||
        e?.message ||
        "Failed to update assessment";
      return rejectWithValue(msg);
    }
  },
);

export const deleteTeacherAssessment = createAsyncThunk(
  "teacher/deleteTeacherAssessment",
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

export const bulkUploadQuestions = createAsyncThunk(
  "teacher/bulkUploadQuestions",
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
      return res.data?.data || res.data || null;
    } catch (e: any) {
      return rejectWithValue(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to upload questions",
      );
    }
  },
);

// Fetch generated report cards for a class (for Download tab)
export const fetchClassReportCards = createAsyncThunk(
  "teacher/fetchClassReportCards",
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
