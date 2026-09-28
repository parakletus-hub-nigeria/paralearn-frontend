"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/RMS/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, CheckCircle2, Navigation, Clock, Radio } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/reduxToolKit/store";
import {
  useMarkAttendanceMutation,
  useGetStudentAttendanceQuery,
  useGetStudentActiveSessionsQuery,
} from "@/reduxToolKit/uniFeatures/attendanceApi";
import { format } from "date-fns";

const DEFAULT_PRIMARY = "#641BC4";

const STATUS_STYLES: Record<string, string> = {
  PRESENT: "text-emerald-700 bg-emerald-50",
  LATE: "text-amber-700 bg-amber-50",
  ABSENT: "text-red-700 bg-red-50",
  EXCEPTION: "text-orange-700 bg-orange-50",
};

export function StudentAttendancePage() {
  const { tenantInfo, user } = useSelector((s: RootState) => s.user);
  const primaryColor = DEFAULT_PRIMARY;

  const [lectureId, setLectureId] = useState("");
  const [markAttendance, { isLoading }] = useMarkAttendanceMutation();

  const { data: historyResponse, isLoading: isLoadingHistory } =
    useGetStudentAttendanceQuery();
  const history = Array.isArray(historyResponse)
    ? historyResponse
    : historyResponse?.data || [];

  const { data: activeSessionsResponse } = useGetStudentActiveSessionsQuery(undefined, {
    pollingInterval: 15000,
  });
  const activeSessions = Array.isArray(activeSessionsResponse)
    ? activeSessionsResponse
    : activeSessionsResponse?.data || [];

  const handleCheckIn = async () => {
    if (!lectureId.trim())
      return toast.error("Please enter a valid Lecture Session ID");

    if (!("geolocation" in navigator))
      return toast.error("Geolocation is not supported by your browser");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await markAttendance({
            studentId: user!.id,
            lectureId: lectureId.trim(),
            coords: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
            },
          }).unwrap();

          const status = result?.status;
          if (status === "ALREADY_MARKED") {
            toast.info("You have already checked in for this lecture.");
          } else if (status === "OUTSIDE_FENCE") {
            toast.error("You are outside the lecture geofence. Move closer to the lecture hall.");
          } else {
            toast.success("Successfully checked in!");
          }
          setLectureId("");
        } catch (e: any) {
          toast.error(
            e?.data?.message || e?.message || "Check-in failed. Ensure the session is active.",
          );
        }
      },
      () => toast.error("Location access denied. Check-in requires GPS."),
    );
  };

  return (
    <div className="w-full space-y-6">
      <Header
        schoolLogo={tenantInfo?.logoUrl}
        schoolName={tenantInfo?.name || "ParaLearn University"}
      />

      {/* Live Sessions */}
      {activeSessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
            <h2 className="text-lg font-bold text-slate-900">Live Sessions</h2>
            <span className="ml-auto text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {activeSessions.length} active
            </span>
          </div>
          <div className="space-y-3">
            {activeSessions.map((session: any) => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    <span className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-emerald-100 mr-2">
                      {session.course?.code}
                    </span>
                    {session.course?.title}
                  </p>
                  {session.lectureHall?.name && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {session.lectureHall.name}
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => {
                    setLectureId(session.id);
                    // Scroll to check-in form
                    document.getElementById("checkin-form")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="h-9 px-4 rounded-lg gap-2 text-white bg-emerald-600 hover:bg-emerald-700 shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Check In
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Check-in form */}
      <div id="checkin-form" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col items-center">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto">
            <MapPin className="w-10 h-10 text-[#641BC4]" />
          </div>

          <h1 className="text-3xl font-bold text-slate-900 font-coolvetica">
            Lecture Check-In
          </h1>
          <p className="text-slate-500 font-medium text-sm">
            Enter the Lecture Session ID provided by your lecturer to log your
            attendance. Location services must be enabled.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left">
            <label className="text-sm font-semibold text-slate-700 block mb-2">
              Session ID
            </label>
            <Input
              value={lectureId}
              onChange={(e) => setLectureId(e.target.value)}
              placeholder="e.g. cm4x5z..."
              className="h-12 rounded-xl text-center font-mono text-base tracking-wider bg-white mb-4"
            />

            <Button
              onClick={handleCheckIn}
              disabled={isLoading || !lectureId.trim()}
              className="w-full h-12 rounded-xl font-bold text-white shadow-md hover:shadow-lg transition-all gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              {isLoading ? (
                "Verifying Location..."
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Confirm Attendance
                </>
              )}
            </Button>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
              <Navigation className="w-3.5 h-3.5" />
              GPS verification active
            </div>
          </div>
        </div>
      </div>

      {/* Attendance History */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4">My Attendance History</h2>

        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-slate-200 border-t-purple-600" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Clock className="w-10 h-10 mb-3" />
            <p className="font-medium">No attendance records yet.</p>
            <p className="text-sm mt-1">Check in to a lecture session to see your records here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-slate-500 font-semibold text-xs uppercase tracking-wider py-3 px-4">Course</th>
                  <th className="text-left text-slate-500 font-semibold text-xs uppercase tracking-wider py-3 px-4">Lecture</th>
                  <th className="text-left text-slate-500 font-semibold text-xs uppercase tracking-wider py-3 px-4">Date &amp; Time</th>
                  <th className="text-left text-slate-500 font-semibold text-xs uppercase tracking-wider py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded mr-2">
                        {log.lecture?.course?.code || "—"}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {log.lecture?.course?.title || "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{log.lecture?.name || "—"}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {log.timeStamp
                        ? format(new Date(log.timeStamp), "MMM d, yyyy · h:mm a")
                        : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${
                          STATUS_STYLES[log.status] || STATUS_STYLES.PRESENT
                        }`}
                      >
                        {log.status || "PRESENT"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
