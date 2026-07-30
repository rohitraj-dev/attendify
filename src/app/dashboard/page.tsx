"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { AttendanceStatus } from "@/lib/types";

const PHASE_ONE_USER_ID = "00000000-0000-0000-0000-000000000001";

type ActiveSemester = {
  id: string;
  name: string;
};

type SlotRow = {
  id: string;
  start_time: string;
  end_time: string;
  subjects:
    | {
        name: string;
        code: string;
        min_attendance_percent: number;
      }
    | {
        name: string;
        code: string;
        min_attendance_percent: number;
      }[];
};

type AttendanceRow = {
  slot_id: string;
  status: AttendanceStatus;
};

type DashboardClass = {
  id: string;
  subjectName: string;
  subjectCode: string;
  timeRange: string;
  status: "present" | "absent" | null;
};

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTimeRange(startTime: string, endTime: string) {
  const referenceDate = "1970-01-01";
  const start = new Date(`${referenceDate}T${startTime}`);
  const end = new Date(`${referenceDate}T${endTime}`);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(start) +
    " - " +
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(end);
}

function getBadgeClassName(status: DashboardClass["status"]) {
  if (status === "present") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "absent") {
    return "bg-red-100 text-red-700";
  }

  return "bg-zinc-200 text-zinc-700";
}

export default function DashboardPage() {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [activeSemester, setActiveSemester] = useState<ActiveSemester | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSlotIds, setPendingSlotIds] = useState<string[]>([]);

  const today = new Date();
  const todayDay = today.getDay();
  const todayIso = today.toISOString().split("T")[0];
  const headerDate = formatDisplayDate(today);

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const { data: semester, error: semesterError } = await supabase
          .from("semesters")
          .select("id, name")
          .eq("user_id", PHASE_ONE_USER_ID)
          .lte("start_date", todayIso)
          .gte("end_date", todayIso)
          .limit(1)
          .maybeSingle();

        if (semesterError) {
          throw semesterError;
        }

        if (!semester) {
          setActiveSemester(null);
          setClasses([]);
          return;
        }

        setActiveSemester(semester);

        const { data: slotRows, error: slotsError } = await supabase
          .from("schedule_slots")
          .select("*, subjects(name, code, min_attendance_percent)")
          .eq("day_of_week", todayDay)
          .eq("subjects.semester_id", semester.id)
          .order("start_time", { ascending: true });

        if (slotsError) {
          throw slotsError;
        }

        console.log(slotRows);

        const typedSlots = (slotRows ?? []) as SlotRow[];

        if (!typedSlots.length) {
          setClasses([]);
          return;
        }

        const slotIds = typedSlots.map((slot) => slot.id);
        const { data: attendanceRows, error: attendanceError } = await supabase
          .from("attendance_records")
          .select("slot_id, status")
          .eq("date", todayIso)
          .in("slot_id", slotIds);

        if (attendanceError) {
          throw attendanceError;
        }

        const attendanceMap = new Map(
          ((attendanceRows ?? []) as AttendanceRow[]).map((record) => [
            record.slot_id,
            record.status,
          ])
        );

        setClasses(
          typedSlots.map((slot) => {
            const subject = Array.isArray(slot.subjects)
              ? slot.subjects[0]
              : slot.subjects;

            return {
              id: slot.id,
              subjectName: subject?.name ?? "Unnamed subject",
              subjectCode: subject?.code ?? "",
              timeRange: formatTimeRange(slot.start_time, slot.end_time),
              status:
                attendanceMap.get(slot.id) === "present"
                  ? "present"
                  : attendanceMap.has(slot.id)
                    ? "absent"
                    : null,
            };
          })
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load dashboard"
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, [supabase, todayDay, todayIso]);

  async function handleToggleAttendance(slotId: string) {
    const currentClass = classes.find((item) => item.id === slotId);

    if (!currentClass) {
      return;
    }

    const nextStatus = currentClass.status === "present" ? "absent" : "present";

    setPendingSlotIds((current) => [...current, slotId]);
    setError(null);

    const previousClasses = classes;

    setClasses((current) =>
      current.map((item) =>
        item.id === slotId ? { ...item, status: nextStatus } : item
      )
    );

    try {
      const { error: upsertError } = await supabase
        .from("attendance_records")
        .upsert(
          {
            slot_id: slotId,
            date: todayIso,
            status: nextStatus,
            marked_by: "manual",
          },
          { onConflict: "slot_id,date" }
        );

      if (upsertError) {
        throw upsertError;
      }
    } catch (toggleError) {
      setClasses(previousClasses);
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Failed to update attendance"
      );
    } finally {
      setPendingSlotIds((current) => current.filter((id) => id !== slotId));
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-500">
            {activeSemester?.name ?? "Attendify"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Today — {headerDate}
          </h1>
        </div>

        {error ? (
          <Card className="bg-white">
            <CardContent className="pt-6">
              <p className="text-sm text-red-600">{error}</p>
            </CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2].map((item) => (
              <Card key={item} className="bg-white">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="h-5 w-40 rounded bg-zinc-200" />
                    <div className="h-4 w-28 rounded bg-zinc-100" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : classes.length ? (
          <div className="grid gap-4">
            {classes.map((slot) => {
              const isPending = pendingSlotIds.includes(slot.id);
              const statusLabel = slot.status === "present" ? "Present" : "Absent";

              return (
                <Card key={slot.id} className="bg-white">
                  <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle>{slot.subjectName}</CardTitle>
                      <CardDescription>
                        {slot.subjectCode ? `${slot.subjectCode} • ` : ""}
                        {slot.timeRange}
                      </CardDescription>
                    </div>
                    <Badge className={getBadgeClassName(slot.status)}>
                      {statusLabel}
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-zinc-600">
                      {slot.status === null
                        ? "No attendance record yet. Default view is absent."
                        : "Attendance marked for today."}
                    </p>
                    <Button
                      type="button"
                      variant={slot.status === "present" ? "destructive" : "default"}
                      disabled={isPending}
                      onClick={() => void handleToggleAttendance(slot.id)}
                      className="w-full sm:w-auto"
                    >
                      {isPending
                        ? "Saving..."
                        : slot.status === "present"
                          ? "Mark Absent"
                          : "Mark Present"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-white">
            <CardContent className="pt-6">
              <p className="text-sm text-zinc-600">No classes today</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
