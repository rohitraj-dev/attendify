"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

const THEME_STORAGE_KEY = "attendify-theme";

type SubjectRow = {
  id: string;
  name: string;
  code: string;
  min_attendance_percent: number;
  semester_id: string;
};

type SemesterRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

type ScheduleSlot = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type DayOverrideRow = {
  id: string;
  slot_id: string;
  date: string;
  type: "cancelled" | "rescheduled";
};

type AttendanceRecord = {
  slot_id: string;
  date: string;
  status: "present" | "absent" | "cancelled";
};

const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  0: "Sunday",
  7: "Sunday",
};

function formatTimeRange(startTime: string, endTime: string) {
  if (!startTime || !endTime) return "";
  const ref = "1970-01-01";
  const start = new Date(`${ref}T${startTime}`);
  const end = new Date(`${ref}T${endTime}`);
  const startStr = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
  const endStr = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(end);
  return `${startStr} - ${endStr}`;
}

function formatDateRecord(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getStatusBadge(status: "present" | "absent" | "cancelled") {
  if (status === "present") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
        <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        Present
      </Badge>
    );
  }
  if (status === "absent") {
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
        <XCircle className="mr-1 h-3 w-3 text-red-600 dark:text-red-400" />
        Absent
      </Badge>
    );
  }
  return (
    <Badge className="bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
      <Ban className="mr-1 h-3 w-3 text-zinc-500 dark:text-zinc-400" />
      Cancelled
    </Badge>
  );
}

function getProgressClass(percentage: number | null, minPercent: number) {
  if (percentage === null || percentage >= minPercent) {
    return "[&_[data-slot=progress-indicator]]:bg-emerald-500";
  }
  if (percentage >= minPercent - 5) {
    return "[&_[data-slot=progress-indicator]]:bg-amber-500";
  }
  return "[&_[data-slot=progress-indicator]]:bg-red-500";
}

export default function SubjectDetailPage() {
  const router = useRouter();
  const rawParams = useParams();
  const subjectId =
    typeof rawParams?.id === "string"
      ? rawParams.id
      : Array.isArray(rawParams?.id)
        ? rawParams.id[0]
        : "";

  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [subject, setSubject] = useState<SubjectRow | null>(null);
  const [semester, setSemester] = useState<SemesterRow | null>(null);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [dayOverrides, setDayOverrides] = useState<DayOverrideRow[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    if (!subjectId) return;

    async function fetchSubjectDetail() {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Fetch subject details
        const { data: subjectData, error: subjectError } = await supabase
          .from("subjects")
          .select("id, name, code, min_attendance_percent, semester_id")
          .eq("id", subjectId)
          .single();

        if (subjectError) throw subjectError;
        if (!subjectData) {
          setError("Subject not found");
          setIsLoading(false);
          return;
        }

        setSubject(subjectData as SubjectRow);

        // 1b. Fetch semester details using subject's semester_id
        const { data: semesterData, error: semesterError } = await supabase
          .from("semesters")
          .select("id, name, start_date, end_date")
          .eq("id", subjectData.semester_id)
          .single();

        if (semesterError) throw semesterError;
        setSemester(semesterData as SemesterRow);

        // 2. Fetch all schedule slots for this subject
        const { data: slotsData, error: slotsError } = await supabase
          .from("schedule_slots")
          .select("id, day_of_week, start_time, end_time")
          .eq("subject_id", subjectId);

        if (slotsError) throw slotsError;

        const typedSlots = (slotsData ?? []) as ScheduleSlot[];
        setScheduleSlots(typedSlots);

        const slotIds = typedSlots.map((slot) => slot.id);

        if (slotIds.length === 0) {
          setRecords([]);
          setDayOverrides([]);
          setIsLoading(false);
          return;
        }

        // 3. Fetch attendance records & cancelled day overrides
        const [{ data: recordsData, error: recordsError }, { data: overridesData, error: overridesError }] =
          await Promise.all([
            supabase
              .from("attendance_records")
              .select("slot_id, date, status")
              .in("slot_id", slotIds)
              .order("date", { ascending: false }),
            supabase
              .from("day_overrides")
              .select("id, slot_id, date, type")
              .in("slot_id", slotIds)
              .eq("type", "cancelled"),
          ]);

        if (recordsError) throw recordsError;
        if (overridesError) throw overridesError;

        setRecords((recordsData ?? []) as AttendanceRecord[]);
        setDayOverrides((overridesData ?? []) as DayOverrideRow[]);
      } catch (err) {
        console.error("Failed to load subject detail:", err);
        setError(err instanceof Error ? err.message : "Failed to load subject details");
      } finally {
        setIsLoading(false);
      }
    }

    void fetchSubjectDetail();
  }, [subjectId, supabase]);

  // Statistics calculation
  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const cancelledCount = records.filter((r) => r.status === "cancelled").length;
  const totalHeld = presentCount + absentCount;
  const overallPercentage =
    totalHeld > 0 ? Math.round((presentCount / totalHeld) * 100) : null;

  const minPercent = subject?.min_attendance_percent ?? 75;

  const canMiss =
    totalHeld > 0
      ? Math.max(0, Math.floor(presentCount / (minPercent / 100)) - totalHeld)
      : 0;

  const needToAttend =
    totalHeld > 0 && overallPercentage !== null && overallPercentage < minPercent
      ? Math.max(
          0,
          Math.ceil(((minPercent / 100) * totalHeld - presentCount) / (1 - minPercent / 100))
        )
      : 0;

  let currentStreak = 0;
  for (const r of records) {
    if (r.status === "cancelled") continue;
    if (r.status === "present") {
      currentStreak += 1;
    } else {
      break;
    }
  }

  // Semester Overview calculations
  let totalClassesInSemester = 0;
  let remainingClassesInSemester = 0;

  if (semester && scheduleSlots.length > 0) {
    const cancelledSet = new Set(
      dayOverrides.map((o) => `${o.slot_id}:${o.date}`)
    );

    const [sY, sM, sD] = semester.start_date.split("-").map(Number);
    const startDate = new Date(sY, sM - 1, sD);
    const [eY, eM, eD] = semester.end_date.split("-").map(Number);
    const endDate = new Date(eY, eM - 1, eD);

    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const current = new Date(startDate);
    while (current <= endDate) {
      const dow = current.getDay();
      if (dow !== 0 && dow !== 6) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, "0");
        const day = String(current.getDate()).padStart(2, "0");
        const isoDate = `${year}-${month}-${day}`;

        for (const slot of scheduleSlots) {
          if (slot.day_of_week === dow) {
            if (!cancelledSet.has(`${slot.id}:${isoDate}`)) {
              totalClassesInSemester += 1;
              if (current >= todayDate) {
                remainingClassesInSemester += 1;
              }
            }
          }
        }
      }
      current.setDate(current.getDate() + 1);
    }
  }

  const maxAllowedAbsences = Math.floor(
    (totalClassesInSemester * (100 - minPercent)) / 100
  );
  const absencesUsed = absentCount;
  const absencesLeft = maxAllowedAbsences - absencesUsed;

  const sortedSlots = [...scheduleSlots].sort((a, b) => {
    const dayA = a.day_of_week === 0 ? 7 : a.day_of_week;
    const dayB = b.day_of_week === 0 ? 7 : b.day_of_week;
    if (dayA !== dayB) return dayA - dayB;
    return a.start_time.localeCompare(b.start_time);
  });

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* Top Header */}
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => router.push("/dashboard")}
            className="shrink-0 rounded-full dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Dashboard</span>
          </Button>

          {isLoading ? (
            <div className="space-y-2 flex-1">
              <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ) : subject ? (
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">{subject.name}</h1>
                <Badge variant="outline" className="text-xs font-semibold dark:border-zinc-700">
                  {subject.code}
                </Badge>
                <Badge
                  variant="secondary"
                  className={
                    currentStreak > 0
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }
                >
                  <Flame
                    className={`mr-1 h-3.5 w-3.5 ${
                      currentStreak > 0 ? "fill-amber-500 text-amber-500" : "text-zinc-400"
                    }`}
                  />
                  {currentStreak > 0 ? `${currentStreak} day streak` : "No active streak"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Subject Attendance History</p>
            </div>
          ) : null}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6">
            <Card className="dark:border-zinc-800 dark:bg-zinc-900">
              <CardHeader>
                <div className="h-5 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-8 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-full animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
              </CardContent>
            </Card>

            <Card className="dark:border-zinc-800 dark:bg-zinc-900">
              <CardHeader>
                <div className="h-5 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-12 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800/60"
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30">
            <CardContent className="flex items-center gap-3 p-6 text-red-700 dark:text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subject Content */}
        {!isLoading && !error && subject && (
          <>
            {/* Overview & Progress Card */}
            <Card className="dark:border-zinc-800 dark:bg-zinc-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Attendance Overview</CardTitle>
                <CardDescription>
                  Attended {presentCount} of {totalHeld} held classes ({cancelledCount} cancelled)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold tracking-tight">
                    {overallPercentage !== null ? `${overallPercentage}%` : "N/A"}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    Required: {minPercent}%
                  </span>
                </div>

                {/* Progress bar container with threshold marker */}
                <div className="space-y-1">
                  <div className="relative pt-1">
                    <Progress
                      value={overallPercentage ?? 0}
                      className={`h-3 ${getProgressClass(overallPercentage, minPercent)}`}
                    />
                    {/* Min Attendance Threshold Line */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-zinc-900 dark:bg-white z-10"
                      style={{ left: `${Math.min(Math.max(minPercent, 0), 100)}%` }}
                      title={`Threshold: ${minPercent}%`}
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                    <span>0%</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      Threshold line at {minPercent}%
                    </span>
                    <span>100%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Semester Overview Card */}
            <Card className="dark:border-zinc-800 dark:bg-zinc-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-zinc-500" />
                  Semester Overview
                </CardTitle>
                {semester && (
                  <CardDescription>
                    {semester.name} ({formatDateRecord(semester.start_date)} - {formatDateRecord(semester.end_date)})
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-center">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <p className="text-xs text-muted-foreground">Total Classes</p>
                    <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                      {totalClassesInSemester}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <p className="text-xs text-muted-foreground">Max Allowed Absences</p>
                    <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                      {maxAllowedAbsences}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <p className="text-xs text-muted-foreground">Classes Remaining</p>
                    <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                      {remainingClassesInSemester}
                    </p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-900/40 dark:bg-red-950/30">
                    <p className="text-xs text-red-600 dark:text-red-400">Absences Used</p>
                    <p className="text-lg font-semibold tracking-tight text-red-700 dark:text-red-400">
                      {absencesUsed}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg border p-3 ${
                      absencesLeft < 0
                        ? "border-red-300 bg-red-100/50 dark:border-red-800 dark:bg-red-950/50"
                        : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/30"
                    }`}
                  >
                    <p
                      className={`text-xs ${
                        absencesLeft < 0
                          ? "text-red-700 dark:text-red-300 font-medium"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      Absences Left
                    </p>
                    <p
                      className={`text-lg font-semibold tracking-tight ${
                        absencesLeft < 0
                          ? "text-red-800 dark:text-red-200"
                          : "text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {absencesLeft}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Status & Stats Summary Card */}
            <Card className="dark:border-zinc-800 dark:bg-zinc-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Attendance Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`rounded-lg p-3.5 text-sm font-medium ${
                    overallPercentage === null
                      ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      : overallPercentage >= minPercent
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
                        : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50"
                  }`}
                >
                  {totalHeld === 0 ? (
                    "No classes held yet."
                  ) : overallPercentage !== null && overallPercentage >= minPercent ? (
                    <span>
                      Safe to miss:{" "}
                      <strong className="font-semibold">
                        {canMiss} {canMiss === 1 ? "more class" : "more classes"}
                      </strong>
                    </span>
                  ) : (
                    <span>
                      Need to attend:{" "}
                      <strong className="font-semibold">
                        {needToAttend} {needToAttend === 1 ? "more class" : "more classes"}
                      </strong>{" "}
                      to reach {minPercent}%
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <p className="text-xs text-muted-foreground">Total Held</p>
                    <p className="text-lg font-semibold tracking-tight">{totalHeld}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Present</p>
                    <p className="text-lg font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">
                      {presentCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-900/40 dark:bg-red-950/30">
                    <p className="text-xs text-red-600 dark:text-red-400">Absent</p>
                    <p className="text-lg font-semibold tracking-tight text-red-700 dark:text-red-400">
                      {absentCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                    <p className="text-xs text-amber-600 dark:text-amber-400">Current Streak</p>
                    <p className="text-sm sm:text-base font-semibold tracking-tight text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1 mt-0.5">
                      <Flame className={`h-4 w-4 ${currentStreak > 0 ? "fill-amber-500 text-amber-500" : "text-amber-400"}`} />
                      {currentStreak > 0 ? `${currentStreak} day streak` : "No active streak"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weekly Schedule Card */}
            <Card className="dark:border-zinc-800 dark:bg-zinc-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-zinc-500" />
                  Weekly Schedule ({sortedSlots.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sortedSlots.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center dark:border-zinc-800">
                    <p className="text-sm text-muted-foreground">No schedule slots configured for this subject.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedSlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60"
                      >
                        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {DAY_NAMES[slot.day_of_week] ?? `Day ${slot.day_of_week}`}
                        </span>
                        <Badge variant="secondary" className="text-xs font-normal dark:bg-zinc-800 dark:text-zinc-300">
                          {formatTimeRange(slot.start_time, slot.end_time)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attendance Records List */}
            <Card className="dark:border-zinc-800 dark:bg-zinc-900">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-zinc-500" />
                  Attendance Records ({records.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {records.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800">
                    <Calendar className="mx-auto h-8 w-8 text-zinc-400 dark:text-zinc-600 mb-2" />
                    <p className="text-sm text-muted-foreground">No attendance records yet.</p>
                  </div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1">
                    {records.map((record, index) => {
                      const isAbsent = record.status === "absent";
                      const isPresent = record.status === "present";

                      return (
                        <div
                          key={`${record.slot_id}-${record.date}-${index}`}
                          className={`flex items-center justify-between rounded-lg border-y border-r border-l-4 p-3.5 transition ${
                            isAbsent
                              ? "border-red-200 border-l-red-500 bg-red-50/70 dark:border-red-900/50 dark:border-l-red-500 dark:bg-red-950/30 hover:bg-red-100/70 dark:hover:bg-red-950/50"
                              : isPresent
                                ? "border-zinc-200 border-l-emerald-500 bg-white dark:border-zinc-800 dark:border-l-emerald-500 dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                                : "border-zinc-200 border-l-zinc-400 bg-zinc-50/50 dark:border-zinc-800 dark:border-l-zinc-400 dark:bg-zinc-900/30 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                isAbsent
                                  ? "bg-red-100 dark:bg-red-950/80"
                                  : isPresent
                                    ? "bg-emerald-100 dark:bg-emerald-950/80"
                                    : "bg-zinc-100 dark:bg-zinc-800"
                              }`}
                            >
                              <Calendar
                                className={`h-4 w-4 ${
                                  isAbsent
                                    ? "text-red-600 dark:text-red-400"
                                    : isPresent
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-zinc-500 dark:text-zinc-400"
                                }`}
                              />
                            </div>
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {formatDateRecord(record.date)}
                            </span>
                          </div>
                          <div>{getStatusBadge(record.status)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
