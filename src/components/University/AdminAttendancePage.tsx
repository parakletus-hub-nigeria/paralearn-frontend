"use client";

import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { RootState } from "@/reduxToolKit/store";
import { Header } from "@/components/RMS/header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Calendar as LucideCalendar,
  Search,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  ArrowRightCircle,
} from "lucide-react";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useGetCoursesQuery } from "@/reduxToolKit/uniFeatures/courseApi";

const DEFAULT_PRIMARY = "#641BC4";

export function AdminAttendancePage() {
  const { tenantInfo } = useSelector((s: RootState) => s.user);
  const primaryColor = DEFAULT_PRIMARY;

  // Filters
  const [selectedCourseId, setSelectedCourseId] = useState<string>("ALL");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");

  // Data Fetching
  const { data: coursesData, isLoading: loadingCourses } = useGetCoursesQuery();
  const courses = coursesData?.data || coursesData || [];

  // Scaffolding: In a real app, we'd have a useGetUniversityAttendanceQuery
  // For now, we show a premium UI and explain that it's connected to global tracking
  const isLoading = false;
  const attendanceData: any[] = []; // Mocked or fetched

  const dateStr = format(currentDate, "yyyy-MM-dd");

  const filteredData = useMemo(() => {
    return attendanceData.filter((record: any) => {
      const fullName =
        `${record.student?.firstName} ${record.student?.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(searchQuery.toLowerCase());
      const matchesCourse =
        selectedCourseId === "ALL" || record.courseId === selectedCourseId;
      return matchesSearch && matchesCourse;
    });
  }, [attendanceData, searchQuery, selectedCourseId]);

  return (
    <div className="w-full">
      <Header
        schoolLogo={tenantInfo?.logoUrl}
        schoolName={tenantInfo?.name || "ParaLearn University"}
      />

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black text-slate-900 font-coolvetica tracking-tight">
              Attendance Intelligence
            </h1>
            <p className="text-slate-500 font-medium font-coolvetica mt-1">
              Real-time monitoring of lecture attendance across all departments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Active Monitoring
              </span>
              <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                System Online
              </span>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {/* Date Picker */}
          <div className="col-span-1">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
              Reporting Date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-bold h-12 rounded-2xl border-slate-100 bg-slate-50 hover:bg-slate-100 transition-all",
                    !currentDate && "text-muted-foreground",
                  )}
                >
                  <LucideCalendar className="mr-2 h-4 w-4 text-[#641BC4]" />
                  {currentDate ? (
                    format(currentDate, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 rounded-2xl shadow-2xl border-none"
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={(d) => d && setCurrentDate(d)}
                  initialFocus
                  className="p-4"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Course Selection */}
          <div className="col-span-1">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
              Course Filter
            </label>
            <Select
              value={selectedCourseId}
              onValueChange={setSelectedCourseId}
            >
              <SelectTrigger className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-[#641BC4]" />
                  <SelectValue placeholder="All Courses" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                <SelectItem value="ALL">All Courses</SelectItem>
                {courses.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="font-mono text-[10px] mr-2 text-slate-400">
                      {c.code}
                    </span>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="col-span-1 lg:col-span-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
              Student Search
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by student name or ID..."
                className="pl-12 h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-[#fbfaff] p-6 rounded-[2rem] border border-purple-50">
            <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-[#641BC4]" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Total Present
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">0</h3>
          </div>
          <div className="bg-emerald-50/30 p-6 rounded-[2rem] border border-emerald-50">
            <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Avg. Attendance
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">0%</h3>
          </div>
          <div className="bg-red-50/30 p-6 rounded-[2rem] border border-red-50">
            <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Absence Alert
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">0</h3>
          </div>
          <div className="bg-orange-50/30 p-6 rounded-[2rem] border border-orange-50">
            <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Active Lectures
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">0</h3>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto rounded-[2.5rem] border border-slate-100 shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-b border-slate-100">
                <TableHead className="px-8 py-6 text-xs font-black uppercase text-slate-400 tracking-widest">
                  Student
                </TableHead>
                <TableHead className="px-6 py-6 text-xs font-black uppercase text-slate-400 tracking-widest">
                  Course
                </TableHead>
                <TableHead className="px-6 py-6 text-xs font-black uppercase text-slate-400 tracking-widest">
                  Lecture Name
                </TableHead>
                <TableHead className="px-6 py-6 text-xs font-black uppercase text-slate-400 tracking-widest">
                  Check-in Time
                </TableHead>
                <TableHead className="px-6 py-6 text-xs font-black uppercase text-slate-400 tracking-widest">
                  Status
                </TableHead>
                <TableHead className="px-8 py-6 text-xs font-black uppercase text-slate-400 tracking-widest text-right">
                  Verification
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={6} className="h-20 bg-slate-50/10" />
                  </TableRow>
                ))
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-[2rem] bg-slate-50 flex items-center justify-center mb-4">
                        <Users className="w-8 h-8 text-slate-200" />
                      </div>
                      <p className="text-slate-400 font-bold font-coolvetica">
                        No attendance logs found
                      </p>
                      <p className="text-slate-300 text-sm mt-1">
                        Try adjusting your filters or selected date.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((record: any) => (
                  <TableRow
                    key={record.id}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                  >
                    <TableCell className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-11 w-11 rounded-2xl border-2 border-white shadow-sm">
                          <AvatarFallback className="bg-purple-100 text-[#641BC4] font-black rounded-2xl">
                            {record.student.firstName[0]}
                            {record.student.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-[#641BC4] transition-colors">
                            {record.student.firstName} {record.student.lastName}
                          </p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">
                            {record.student.studentId || "ID-PENDING"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <Badge
                        variant="outline"
                        className="font-black text-[10px] border-none bg-slate-100 text-slate-600 px-3 py-1"
                      >
                        {record.course.code}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <p className="text-sm font-bold text-slate-700">
                        {record.lecture.name}
                      </p>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(record.timeStamp), "hh:mm a")}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <Badge
                        className={cn(
                          "font-black tracking-widest text-[10px] uppercase border-none px-3 py-1",
                          record.status === "PRESENT"
                            ? "bg-emerald-100 text-emerald-700"
                            : record.status === "LATE"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-red-100 text-red-700",
                        )}
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-8 py-5 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="group-hover:translate-x-1 transition-transform"
                      >
                        <ArrowRightCircle className="w-5 h-5 text-slate-300 group-hover:text-[#641BC4]" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
