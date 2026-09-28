"use client";
import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/reduxToolKit/store";
import { BookOpen, CalendarDays, PenLine, CheckCircle2, Clock } from "lucide-react";
import { useGetStudentAttendanceQuery } from "@/reduxToolKit/uniFeatures/attendanceApi";
import { useGetAllCoursesWithStatusQuery } from "@/reduxToolKit/uniFeatures/courseApi";
import { useGetStudentTimetableQuery } from "@/reduxToolKit/uniFeatures/timetableApi";
import { format } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  PRESENT: "text-emerald-700 bg-emerald-50 border-emerald-100",
  LATE: "text-amber-700 bg-amber-50 border-amber-100",
  ABSENT: "text-red-700 bg-red-50 border-red-100",
  EXCEPTION: "text-orange-700 bg-orange-50 border-orange-100",
};

const TODAY = new Date()
  .toLocaleDateString("en-US", { weekday: "long" })
  .toUpperCase();

export default function UniStudentDashboardPage() {
  const { user, tenantInfo } = useSelector((state: RootState) => state.user);

  const { data: historyResponse } = useGetStudentAttendanceQuery();
  const { data: coursesResponse } = useGetAllCoursesWithStatusQuery();
  const { data: timetableResponse } = useGetStudentTimetableQuery();

  const history = Array.isArray(historyResponse)
    ? historyResponse
    : historyResponse?.data || [];

  const allCourses = Array.isArray(coursesResponse)
    ? coursesResponse
    : coursesResponse?.data || [];
  const enrolledCourses = allCourses.filter((c: any) => c.isEnrolled);

  const timetableEntries = Array.isArray(timetableResponse)
    ? timetableResponse
    : timetableResponse?.data || [];

  const todayClasses = timetableEntries.filter(
    (e: any) => (e.dayOfWeek || "").toUpperCase() === TODAY
  );

  // Per-course attendance summary
  const attendanceByCourse = enrolledCourses.map((course: any) => {
    const logs = history.filter(
      (log: any) => log.lecture?.course?.code === course.code
    );
    const present = logs.filter((l: any) =>
      ["PRESENT", "LATE"].includes(l.status)
    ).length;
    const total = logs.length;
    const pct = total > 0 ? Math.round((present / total) * 100) : null;
    return { ...course, attendanceLogs: logs, present, total, pct };
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white rounded-xl shadow-sm border border-purple-100/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-100/40 to-transparent rounded-full translate-x-32 -translate-y-32 blur-3xl" />
        <div className="relative z-10 space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-900 to-indigo-600 bg-clip-text text-transparent">
            Welcome, {user?.firstName}
          </h1>
          <p className="text-gray-500 font-medium text-sm">
            Ready for your classes at{" "}
            <span className="text-gray-700 font-semibold">
              {tenantInfo?.name || "ParaLearn University"}
            </span>
            ?
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: BookOpen,
            title: "Enrolled Courses",
            value: enrolledCourses.length || "—",
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            icon: CalendarDays,
            title: "Today's Classes",
            value: todayClasses.length || "0",
            color: "text-indigo-600",
            bg: "bg-indigo-50",
          },
          {
            icon: CheckCircle2,
            title: "Total Check-ins",
            value: history.filter((l: any) => ["PRESENT", "LATE"].includes(l.status)).length || "0",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            icon: PenLine,
            title: "Overall Attendance",
            value:
              history.length > 0
                ? Math.round(
                    (history.filter((l: any) =>
                      ["PRESENT", "LATE"].includes(l.status)
                    ).length /
                      history.length) *
                      100
                  ) + "%"
                : "—",
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow"
          >
            <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{stat.title}</p>
              <p className="text-xl font-bold text-gray-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            Today&apos;s Schedule
          </h3>
          {todayClasses.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-sm">
              No classes scheduled today
            </div>
          ) : (
            <div className="space-y-3">
              {todayClasses.map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100"
                >
                  <div className="w-1 h-12 rounded-full bg-indigo-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      <span className="font-mono text-xs bg-slate-100 px-1 rounded mr-1">
                        {entry.course?.code}
                      </span>
                      {entry.course?.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {entry.startTime} – {entry.endTime}
                      {entry.hall?.name ? ` · ${entry.hall.name}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Attendance */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            Recent Attendance
          </h3>
          {history.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-sm">
              No attendance records yet
            </div>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 5).map((log: any) => (
                <div key={log.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        <span className="font-mono text-xs bg-slate-100 px-1 rounded mr-1">
                          {log.lecture?.course?.code || "—"}
                        </span>
                        {log.lecture?.course?.title || "—"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {log.timeStamp
                          ? format(new Date(log.timeStamp), "MMM d · h:mm a")
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      STATUS_STYLES[log.status] || STATUS_STYLES.PRESENT
                    }`}
                  >
                    {log.status || "PRESENT"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attendance by Course */}
      {attendanceByCourse.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            Attendance by Course
          </h3>
          <div className="space-y-4">
            {attendanceByCourse.map((course: any) => (
              <div key={course.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                      {course.code}
                    </span>
                    <span className="text-sm font-semibold text-slate-700 truncate max-w-[200px]">
                      {course.title}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">
                    {course.pct !== null ? `${course.pct}%` : "No data"}
                    <span className="text-xs text-slate-400 font-normal ml-1">
                      ({course.present}/{course.total})
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (course.pct ?? 0) >= 75
                        ? "bg-emerald-500"
                        : (course.pct ?? 0) >= 50
                          ? "bg-amber-400"
                          : "bg-red-400"
                    }`}
                    style={{ width: `${course.pct ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
