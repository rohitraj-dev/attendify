"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  BookOpen,
  Calendar,
  CheckCircle2,
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
};

type AttendanceRecord = {
  slot_id: string;
  date: string;
  status: "present" | "absent" | "cancelled";
};

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
          .select("id, name, code, min_attendance_percent")
          .eq("id", subjectId)
          .single();

        if (subjectError) throw subjectError;
        if (!subjectData) {
          setError("Subject not found");
          setIsLoading(false);
          return;
        }

        setSubject(subjectData);

        // 2. Fetch all schedule slots for this subject
        const { data: slotsData, error: slotsError } = await supabase
          .from("schedule_slots")
          .select("id")
          .eq("subject_id", subjectId);

        if (slotsError) throw slotsError;

        const slotIds = (slotsData ?? []).map((slot) => slot.id);

        if (slotIds.length === 0) {
          setRecords([]);
          setIsLoading(false);
          return;
        }

        // 3. Fetch all attendance records for these slot IDs ordered by date desc
        const { data: recordsData, error: recordsError } = await supabase
          .from("attendance_records")
          .select("slot_id, date, status")
          .in("slot_id", slotIds)
          .order("date", { ascending: false });

        if (recordsError) throw recordsError;

        setRecords((recordsData ?? []) as AttendanceRecord[]);
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
                    {records.map((record, index) => (
                      <div
                        key={`${record.slot_id}-${record.date}-${index}`}
                        className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <Calendar className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                          </div>
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {formatDateRecord(record.date)}
                          </span>
                        </div>
                        <div>{getStatusBadge(record.status)}</div>
                      </div>
                    ))}
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
