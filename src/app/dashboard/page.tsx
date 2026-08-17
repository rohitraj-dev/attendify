"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Moon,
  MoreVertical,
  Settings,
  Sun,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { AttendanceStatus } from "@/lib/types";

const PHASE_ONE_USER_ID = "00000000-0000-0000-0000-000000000001";
const THEME_STORAGE_KEY = "attendify-theme";

type ActiveSemester = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

type SlotRow = {
  id: string;
  start_time: string;
  end_time: string;
  subject_code?: string;
  subjects:
    | {
        name: string;
        code: string;
        semester_id?: string;
      }
    | {
        name: string;
        code: string;
        semester_id?: string;
      }[]
    | null;
};

type AttendanceRow = {
  slot_id: string;
  status: AttendanceStatus;
};

type CalendarAttendanceRow = AttendanceRow & {
  date: string;
};

type DayOverride = {
  id: string;
  slot_id: string;
  type: "cancelled" | "rescheduled";
  new_time: string | null;
};

type DashboardClass = {
  id: string;
  subjectName: string;
  subjectCode: string;
  timeRange: string;
  startTime: string;
  endTime: string;
  status: "present" | "absent" | null;
  overrideType?: "cancelled" | "rescheduled";
  displayTime?: string;
};

type SubjectStat = {
  id: string;
  name: string;
  code: string;
  minAttendancePercent: number;
  totalHeld: number;
  attended: number;
  percentage: number | null;
  canMiss: number;
  remainingClasses: number;
  bestCasePercent: number | null;
  worstCasePercent: number | null;
};

type AlertItem = {
  subjectName: string;
  type: "danger" | "warning";
  message: string;
};

type CalendarSlotRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_code?: string;
  subjects:
    | {
        name: string;
        code: string;
        semester_id?: string;
      }
    | {
        name: string;
        code: string;
        semester_id?: string;
      }[]
    | null;
};

type CalendarClass = {
  id: string;
  dayOfWeek: number;
  subjectName: string;
  subjectCode: string;
  startTime: string;
  endTime: string;
  timeRange: string;
};

function getAlertKey(alert: AlertItem) {
  return `${alert.subjectName}:${alert.type}:${alert.message}`;
}

function formatLocalDateIso(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

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

  return `${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(start)} - ${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(end)}`;
}

function getBadgeClassName(slot: DashboardClass) {
  if (slot.overrideType === "cancelled") {
    return "bg-zinc-200 text-zinc-700";
  }

  if (slot.overrideType === "rescheduled") {
    return "bg-amber-100 text-amber-700";
  }

  if (slot.status === "present") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (slot.status === "absent") {
    return "bg-red-100 text-red-700";
  }

  return "bg-zinc-200 text-zinc-700";
}

function getBadgeLabel(slot: DashboardClass) {
  if (slot.overrideType === "cancelled") {
    return "Cancelled";
  }

  if (slot.overrideType === "rescheduled") {
    return "Rescheduled";
  }

  return slot.status === "present" ? "Present" : "Absent";
}

function getProgressClass(
  percentage: number | null,
  minAttendancePercent: number
) {
  if (percentage === null || percentage >= minAttendancePercent) {
    return "[&_[data-slot=progress-indicator]]:bg-emerald-500";
  }

  if (percentage >= minAttendancePercent - 5) {
    return "[&_[data-slot=progress-indicator]]:bg-amber-500";
  }

  return "[&_[data-slot=progress-indicator]]:bg-red-500";
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildCalendarDays(displayedMonth: Date) {
  const monthStart = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth(),
    1
  );
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(calendarStart);
    day.setDate(calendarStart.getDate() + index);
    return day;
  });
}

function getCalendarDotClass(status: AttendanceStatus) {
  if (status === "present") {
    return "bg-emerald-500";
  }

  if (status === "absent") {
    return "bg-red-500";
  }

  if (status === "cancelled") {
    return "bg-zinc-400";
  }

  return "bg-zinc-300";
}

function getAttendanceStatusLabel(status: AttendanceStatus | null) {
  if (status === "present") {
    return "Present";
  }

  if (status === "absent") {
    return "Absent";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  return "No record";
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DashboardPage() {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const hasAutoMarked = useRef(false);
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [overrides, setOverrides] = useState<Record<string, DayOverride>>({});
  const [activeSemester, setActiveSemester] = useState<ActiveSemester | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSlotIds, setPendingSlotIds] = useState<string[]>([]);
  const [rescheduleSlotId, setRescheduleSlotId] = useState<string | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [readAlerts, setReadAlerts] = useState<Set<string>>(new Set());
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [displayedMonth, setDisplayedMonth] = useState(() => {
    const currentDate = new Date();
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  });
  const [calendarClasses, setCalendarClasses] = useState<CalendarClass[]>([]);
  const [calendarAttendance, setCalendarAttendance] = useState<
    CalendarAttendanceRow[]
  >([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(
    null
  );
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [pendingCalendarSlotIds, setPendingCalendarSlotIds] = useState<string[]>([]);
  const [academicMonth, setAcademicMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [holidays, setHolidays] = useState<Array<{ date: string; reason: string }>>([]);
  const [selectedAcademicDate, setSelectedAcademicDate] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [backfillDone, setBackfillDone] = useState(false);

  const today = new Date();
  const todayDayOfWeek = today.getDay();
  const todayIso = today.toISOString().split("T")[0];
  const localTodayIso = formatLocalDateIso(today);
  const headerDate = formatDisplayDate(today);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const shouldUseDark = savedTheme === "dark";

    document.documentElement.classList.toggle("dark", shouldUseDark);

    const frameId = window.requestAnimationFrame(() => {
      setIsDarkMode(shouldUseDark);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    async function autoMarkPastSlots(
      slots: SlotRow[],
      overrideMap: Record<string, DayOverride>,
      activeSemester: ActiveSemester,
      statSlots: Array<{ id: string; subject_id: string; day_of_week: number }>
    ) {
      if (hasAutoMarked.current) {
        return;
      }

      hasAutoMarked.current = true;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const pastSlots = slots.filter((slot) => {
        const override = overrideMap[slot.id];

        if (override?.type === "cancelled") {
          return false;
        }

        const effectiveStart =
          override?.type === "rescheduled" && override.new_time
            ? override.new_time
            : slot.start_time;
        const duration = Math.max(
          timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time),
          0
        );
        const effectiveEndMinutes = timeToMinutes(effectiveStart) + duration;

        return currentMinutes > effectiveEndMinutes;
      });

      if (pastSlots.length) {
        const pastSlotIds = pastSlots.map((slot) => slot.id);
        const { data: existingAttendance, error: existingAttendanceError } =
          await supabase
            .from("attendance_records")
            .select("slot_id")
            .eq("date", todayIso)
            .in("slot_id", pastSlotIds);

        if (existingAttendanceError) {
          throw existingAttendanceError;
        }

        const existingSlotIds = new Set(
          (existingAttendance ?? []).map((record) => record.slot_id)
        );

        const slotsToInsert = pastSlots
          .filter((slot) => !existingSlotIds.has(slot.id))
          .map((slot) => ({
            slot_id: slot.id,
            date: todayIso,
            status: "present" as const,
            marked_by: "auto" as const,
          }));

        if (slotsToInsert.length) {
          const { error: upsertError } = await supabase
            .from("attendance_records")
            .upsert(slotsToInsert, {
              onConflict: "slot_id,date",
              ignoreDuplicates: true,
            });

          if (upsertError) {
            throw upsertError;
          }
        }
      }

      if (activeSemester.start_date && statSlots.length > 0) {
        const yesterdayDate = new Date(`${todayIso}T00:00:00`);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayIso = formatLocalDateIso(yesterdayDate);

        if (activeSemester.start_date <= yesterdayIso) {
          const pastDates: Array<{ dateIso: string; dayOfWeek: number }> = [];
          const currDate = new Date(`${activeSemester.start_date}T00:00:00`);
          const endDate = new Date(`${yesterdayIso}T00:00:00`);

          while (currDate <= endDate) {
            const dow = currDate.getDay();
            if (dow !== 0 && dow !== 6) {
              pastDates.push({
                dateIso: formatLocalDateIso(currDate),
                dayOfWeek: dow,
              });
            }
            currDate.setDate(currDate.getDate() + 1);
          }

          if (pastDates.length > 0) {
            const candidateBackfills: Array<{ slot_id: string; date: string }> = [];
            for (const { dateIso, dayOfWeek } of pastDates) {
              const matchingSlots = statSlots.filter(
                (s) => s.day_of_week === dayOfWeek
              );
              for (const slot of matchingSlots) {
                candidateBackfills.push({ slot_id: slot.id, date: dateIso });
              }
            }

            const allSlotIds = Array.from(
              new Set(statSlots.map((s) => s.id))
            );

            if (allSlotIds.length > 0 && candidateBackfills.length > 0) {
              const { data: existingRecords, error: existingErr } = await supabase
                .from("attendance_records")
                .select("slot_id, date")
                .in("slot_id", allSlotIds)
                .gte("date", activeSemester.start_date)
                .lte("date", yesterdayIso);

              if (existingErr) {
                throw existingErr;
              }

              const existingSet = new Set(
                (existingRecords ?? []).map((r) => `${r.slot_id}:${r.date}`)
              );

              const backfillInserts = candidateBackfills
                .filter((item) => !existingSet.has(`${item.slot_id}:${item.date}`))
                .map((item) => ({
                  slot_id: item.slot_id,
                  date: item.date,
                  status: "present" as const,
                  marked_by: "auto" as const,
                }));

              if (backfillInserts.length > 0) {
                const { error: backfillUpsertErr } = await supabase
                  .from("attendance_records")
                  .upsert(backfillInserts, {
                    onConflict: "slot_id,date",
                    ignoreDuplicates: true,
                  });

                if (backfillUpsertErr) {
                  throw backfillUpsertErr;
                }
              }
            }
          }
        }
      }

      setBackfillDone(true);
    }

    async function loadStats(activeSemester: ActiveSemester) {
      const { data: subjects, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, name, code, min_attendance_percent")
        .eq("semester_id", activeSemester.id);

      if (subjectsError) {
        throw subjectsError;
      }

      const typedSubjects =
        (subjects as
          | Array<{
              id: string;
              name: string;
              code: string;
              min_attendance_percent: number;
            }>
          | null) ?? [];

      if (!typedSubjects.length) {
        setSubjectStats([]);
        setAlerts([]);
        return [];
      }

      const subjectIds = typedSubjects.map((subject) => subject.id);
      const { data: statSlots, error: statSlotsError } = await supabase
        .from("schedule_slots")
        .select("id, subject_id, day_of_week")
        .in("subject_id", subjectIds);

      if (statSlotsError) {
        throw statSlotsError;
      }

      const typedStatSlots =
        (statSlots as
          | Array<{ id: string; subject_id: string; day_of_week: number }>
          | null) ?? [];
      const statSlotIds = typedStatSlots.map((slot) => slot.id);

      if (!statSlotIds.length) {
        setSubjectStats(
          typedSubjects.map((subject) => ({
            id: subject.id,
            name: subject.name,
            code: subject.code,
            minAttendancePercent: subject.min_attendance_percent,
            totalHeld: 0,
            attended: 0,
            percentage: null,
            canMiss: 0,
            remainingClasses: 0,
            bestCasePercent: null,
            worstCasePercent: null,
          }))
        );
        setAlerts([]);
        return [];
      }

      const { data: statAttendance, error: statAttendanceError } = await supabase
        .from("attendance_records")
        .select("slot_id, status")
        .in("slot_id", statSlotIds)
        .lte("date", todayIso)
        .neq("status", "cancelled");

      if (statAttendanceError) {
        throw statAttendanceError;
      }

      const { data: futureCancelledOverrides, error: futureCancelledOverridesError } =
        await supabase
          .from("day_overrides")
          .select("slot_id, date")
          .eq("type", "cancelled")
          .in("slot_id", statSlotIds)
          .gt("date", todayIso)
          .lte("date", activeSemester.end_date);

      if (futureCancelledOverridesError) {
        throw futureCancelledOverridesError;
      }

      const allAttendance = (statAttendance as AttendanceRow[] | null) ?? [];
      const slotsBySubject = new Map<
        string,
        Array<{ id: string; subject_id: string; day_of_week: number }>
      >();
      const cancelledOverrideSet = new Set(
        (
          (futureCancelledOverrides as
            | Array<{ slot_id: string; date: string }>
            | null) ?? []
        ).map((override) => `${override.slot_id}:${override.date}`)
      );

      for (const slot of typedStatSlots) {
        const currentSlots = slotsBySubject.get(slot.subject_id) ?? [];
        currentSlots.push(slot);
        slotsBySubject.set(slot.subject_id, currentSlots);
      }

      const computedStats = typedSubjects.map((subject) => {
          const subjectSlotIds = typedStatSlots
            .filter((slot) => slot.subject_id === subject.id)
            .map((slot) => slot.id);
          const subjectSlots = slotsBySubject.get(subject.id) ?? [];
          const subjectRecords = allAttendance.filter((record) =>
            subjectSlotIds.includes(record.slot_id)
          );
          const totalHeld = subjectRecords.filter(
            (record) =>
              record.status === "present" || record.status === "absent"
          ).length;
          const attended = subjectRecords.filter(
            (record) => record.status === "present"
          ).length;
          const percentage =
            totalHeld > 0 ? Math.round((attended / totalHeld) * 100) : null;
          const canMiss =
            Math.floor(attended / (subject.min_attendance_percent / 100)) -
            totalHeld;
          let remainingClasses = 0;

          const futureDate = new Date(`${todayIso}T00:00:00`);
          futureDate.setHours(0, 0, 0, 0);
          futureDate.setDate(futureDate.getDate() + 1);
          const semesterEndDate = new Date(`${activeSemester.end_date}T00:00:00`);
          semesterEndDate.setHours(0, 0, 0, 0);

          while (futureDate <= semesterEndDate) {
            const isoDate = formatLocalDateIso(futureDate);
            const dayOfWeek = futureDate.getDay();

            for (const slot of subjectSlots) {
              if (
                slot.day_of_week === dayOfWeek &&
                !cancelledOverrideSet.has(`${slot.id}:${isoDate}`)
              ) {
                remainingClasses += 1;
              }
            }

            futureDate.setDate(futureDate.getDate() + 1);
          }

          const bestCasePercent =
            remainingClasses > 0
              ? Math.round(
                  ((attended + remainingClasses) /
                    (totalHeld + remainingClasses)) *
                    100
                )
              : Math.round(
                  percentage ?? 0
                );
          const worstCasePercent =
            remainingClasses > 0
              ? Math.round((attended / (totalHeld + remainingClasses)) * 100)
              : percentage;

          console.log({
            name: subject.name,
            totalHeld,
            attended,
            percentage,
            remainingClasses,
          });

          return {
            id: subject.id,
            name: subject.name,
            code: subject.code,
            minAttendancePercent: subject.min_attendance_percent,
            totalHeld,
            attended,
            percentage,
            canMiss,
            remainingClasses,
            bestCasePercent,
            worstCasePercent,
          };
        });

      setSubjectStats(computedStats);
      const nextAlerts: AlertItem[] = [];

      for (const subject of computedStats) {
        if (
          subject.percentage !== null &&
          subject.percentage < subject.minAttendancePercent
        ) {
          nextAlerts.push({
            subjectName: subject.name,
            type: "danger",
            message: `${subject.name} is below minimum attendance (${subject.percentage}%)`,
          });
          continue;
        }

        if (
          subject.percentage !== null &&
          subject.percentage >= subject.minAttendancePercent &&
          subject.canMiss <= 1 &&
          subject.canMiss >= 0
        ) {
          nextAlerts.push({
            subjectName: subject.name,
            type: "warning",
            message: `${subject.name} can only miss ${subject.canMiss} more class(es)`,
          });
        }
      }

      setAlerts(nextAlerts);
      return typedStatSlots;
    }

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const storedSemesterId = localStorage.getItem("activeSemesterId");

        let semesterQuery = supabase
          .from("semesters")
          .select("id, name, start_date, end_date")
          .eq("user_id", PHASE_ONE_USER_ID);

        if (storedSemesterId) {
          semesterQuery = semesterQuery.eq("id", storedSemesterId);
        } else {
          semesterQuery = semesterQuery
            .lte("start_date", todayIso)
            .gte("end_date", todayIso)
            .order("start_date", { ascending: false })
            .limit(1);
        }

        const { data: semester, error: semesterError } =
          await semesterQuery.maybeSingle();

        if (semesterError) {
          throw semesterError;
        }

        if (!semester) {
          setActiveSemester(null);
          setClasses([]);
          setSubjectStats([]);
          setAlerts([]);
          setOverrides({});
          return;
        }

        setActiveSemester(semester);
        const statSlots = await loadStats(semester);

        const { data: slotRows, error: slotsError } = await supabase
          .from("schedule_slots")
          .select("*, subjects(name, code, semester_id)")
          .eq("day_of_week", todayDayOfWeek)
          .order("start_time", { ascending: true });

        if (slotsError) {
          throw slotsError;
        }

        const rawSlots = (slotRows ?? []) as SlotRow[];
        const typedSlots = rawSlots.filter((slot) => {
          if (!slot.subjects) return false;
          const subject = Array.isArray(slot.subjects)
            ? slot.subjects[0]
            : slot.subjects;
          return Boolean(subject && subject.semester_id === semester.id);
        });

        if (!typedSlots.length) {
          setClasses([]);
          setOverrides({});
          return;
        }

        const slotIds = typedSlots.map((slot) => slot.id);
        const { data: overrideRows, error: overridesError } = await supabase
          .from("day_overrides")
          .select("id, slot_id, type, new_time")
          .eq("date", todayIso)
          .in("slot_id", slotIds);

        if (overridesError) {
          throw overridesError;
        }

        const overrideMap = Object.fromEntries(
          ((overrideRows ?? []) as DayOverride[]).map((override) => [
            override.slot_id,
            override,
          ])
        );

        setOverrides(overrideMap);

        await autoMarkPastSlots(typedSlots, overrideMap, semester, statSlots ?? []);
        await loadStats(semester);

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
            const override = overrideMap[slot.id];

            return {
              id: slot.id,
              subjectName:
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (slot.subjects as any)?.name ?? slot.subject_code ?? "Unnamed",
              subjectCode: subject?.code ?? "",
              timeRange: formatTimeRange(slot.start_time, slot.end_time),
              startTime: slot.start_time,
              endTime: slot.end_time,
              status:
                attendanceMap.get(slot.id) === "present"
                  ? "present"
                  : attendanceMap.has(slot.id)
                    ? "absent"
                    : null,
              overrideType: override?.type,
              displayTime:
                override?.type === "rescheduled" && override.new_time
                  ? formatTimeRange(override.new_time, slot.end_time)
                  : undefined,
            };
          })
        );
      } catch (loadError) {
        console.error("Failed to load dashboard:", loadError);
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
  }, [supabase, todayDayOfWeek, todayIso]);

  useEffect(() => {
    async function loadCalendarData() {
      if (!activeSemester) {
        setCalendarClasses([]);
        setCalendarAttendance([]);
        setCalendarError(null);
        setIsCalendarLoading(false);
        return;
      }

      setIsCalendarLoading(true);
      setCalendarError(null);

      try {
        const { data: slotRows, error: slotError } = await supabase
          .from("schedule_slots")
          .select("id, day_of_week, start_time, end_time, subjects(name, code, semester_id)")
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

        if (slotError) {
          throw slotError;
        }

        const rawSlots = (slotRows ?? []) as CalendarSlotRow[];
        const typedSlots = rawSlots.filter((slot) => {
          if (!slot.subjects) return false;
          const subject = Array.isArray(slot.subjects)
            ? slot.subjects[0]
            : slot.subjects;
          return Boolean(subject && subject.semester_id === activeSemester.id);
        });

        setCalendarClasses(
          typedSlots.map((slot) => {
            const subject = Array.isArray(slot.subjects)
              ? slot.subjects[0]
              : slot.subjects;

            return {
              id: slot.id,
              dayOfWeek: slot.day_of_week,
              subjectName:
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (slot.subjects as any)?.name ?? slot.subject_code ?? "Unnamed",
              subjectCode: subject?.code ?? "",
              startTime: slot.start_time,
              endTime: slot.end_time,
              timeRange: formatTimeRange(slot.start_time, slot.end_time),
            };
          })
        );

        const slotIds = typedSlots.map((slot) => slot.id);

        if (!slotIds.length) {
          setCalendarAttendance([]);
          return;
        }

        const monthStartIso = formatLocalDateIso(
          new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1)
        );
        const monthEndIso = formatLocalDateIso(
          new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0)
        );

        const { data: attendanceRows, error: attendanceError } = await supabase
          .from("attendance_records")
          .select("slot_id, date, status")
          .in("slot_id", slotIds)
          .gte("date", monthStartIso)
          .lte("date", monthEndIso);

        if (attendanceError) {
          throw attendanceError;
        }

        setCalendarAttendance(
          ((attendanceRows ?? []) as CalendarAttendanceRow[]).sort((left, right) =>
            left.date.localeCompare(right.date)
          )
        );
      } catch (loadError) {
        console.error("Failed to load calendar:", loadError);
        setCalendarError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load calendar"
        );
      } finally {
        setIsCalendarLoading(false);
      }
    }

    void loadCalendarData();
  }, [activeSemester, displayedMonth, supabase, backfillDone]);

  useEffect(() => {
    if (!activeSemester?.id) return;
    void (async () => {
      const { data } = await supabase
        .from("holidays")
        .select("date, reason")
        .eq("semester_id", activeSemester.id)
        .order("date", { ascending: true });
      setHolidays((data ?? []) as Array<{ date: string; reason: string }>);
    })();
  }, [activeSemester, supabase]);

  async function handleToggleAttendance(slotId: string) {
    const currentClass = classes.find((item) => item.id === slotId);

    if (!currentClass || currentClass.overrideType === "cancelled") {
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

  async function handleCalendarToggle(slotId: string, date: string, currentStatus: AttendanceStatus | null) {
    if (currentStatus === "cancelled") return;
    const nextStatus: AttendanceStatus = currentStatus === "present" ? "absent" : "present";
    setPendingCalendarSlotIds((prev) => [...prev, slotId]);
    try {
      const { error: upsertError } = await supabase
        .from("attendance_records")
        .upsert(
          { slot_id: slotId, date, status: nextStatus, marked_by: "manual" },
          { onConflict: "slot_id,date" }
        );
      if (upsertError) throw upsertError;
      setCalendarAttendance((prev) =>
        prev.some((r) => r.slot_id === slotId && r.date === date)
          ? prev.map((r) =>
              r.slot_id === slotId && r.date === date ? { ...r, status: nextStatus } : r
            )
          : [...prev, { slot_id: slotId, date, status: nextStatus, subject_id: "" } as CalendarAttendanceRow]
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update attendance");
    } finally {
      setPendingCalendarSlotIds((prev) => prev.filter((id) => id !== slotId));
    }
  }

  async function handleCalendarCancelClass(slotId: string, date: string) {
    setPendingCalendarSlotIds((prev) => [...prev, slotId]);
    try {
      const { error: overrideError } = await supabase
        .from("day_overrides")
        .upsert(
          { slot_id: slotId, date, type: "cancelled", new_time: null },
          { onConflict: "slot_id,date" }
        );
      if (overrideError) throw overrideError;

      const { error: upsertError } = await supabase
        .from("attendance_records")
        .upsert(
          { slot_id: slotId, date, status: "cancelled", marked_by: "manual" },
          { onConflict: "slot_id,date" }
        );
      if (upsertError) throw upsertError;

      setCalendarAttendance((prev) =>
        prev.some((r) => r.slot_id === slotId && r.date === date)
          ? prev.map((r) =>
              r.slot_id === slotId && r.date === date ? { ...r, status: "cancelled" } : r
            )
          : [...prev, { slot_id: slotId, date, status: "cancelled", subject_id: "" } as CalendarAttendanceRow]
      );
      toast.success("Class marked as cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel class");
    } finally {
      setPendingCalendarSlotIds((prev) => prev.filter((id) => id !== slotId));
    }
  }

  async function handleCalendarUncancelClass(slotId: string, date: string) {
    setPendingCalendarSlotIds((prev) => [...prev, slotId]);
    try {
      const { error: deleteError } = await supabase
        .from("day_overrides")
        .delete()
        .eq("slot_id", slotId)
        .eq("date", date);
      if (deleteError) throw deleteError;

      const { error: upsertError } = await supabase
        .from("attendance_records")
        .upsert(
          { slot_id: slotId, date, status: "absent", marked_by: "manual" },
          { onConflict: "slot_id,date" }
        );
      if (upsertError) throw upsertError;

      setCalendarAttendance((prev) =>
        prev.map((r) =>
          r.slot_id === slotId && r.date === date ? { ...r, status: "absent" } : r
        )
      );
      toast.success("Cancellation removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to uncancel class");
    } finally {
      setPendingCalendarSlotIds((prev) => prev.filter((id) => id !== slotId));
    }
  }

  async function handleCancelClass(slotId: string) {
    const targetClass = classes.find((item) => item.id === slotId);

    if (!targetClass) {
      return;
    }

    setPendingSlotIds((current) => [...current, slotId]);

    try {
      const { data: overrideRow, error: overrideError } = await supabase
        .from("day_overrides")
        .upsert(
          {
            slot_id: slotId,
            date: todayIso,
            type: "cancelled",
            new_time: null,
          },
          { onConflict: "slot_id,date" }
        )
        .select("id, slot_id, type, new_time")
        .single();

      if (overrideError) {
        throw overrideError;
      }

      const { error: attendanceError } = await supabase
        .from("attendance_records")
        .upsert(
          {
            slot_id: slotId,
            date: todayIso,
            status: "cancelled",
            marked_by: "manual",
          },
          { onConflict: "slot_id,date" }
        );

      if (attendanceError) {
        throw attendanceError;
      }

      setOverrides((current) => ({
        ...current,
        [slotId]: overrideRow as DayOverride,
      }));
      setClasses((current) =>
        current.map((item) =>
          item.id === slotId
            ? {
                ...item,
                overrideType: "cancelled",
                status: null,
                displayTime: undefined,
              }
            : item
        )
      );
      toast.success("Class cancelled");
    } catch (actionError) {
      toast.error(
        actionError instanceof Error
          ? actionError.message
          : "Failed to cancel class"
      );
    } finally {
      setPendingSlotIds((current) => current.filter((id) => id !== slotId));
    }
  }

  async function handleRescheduleClass(slotId: string, newTime: string) {
    const targetClass = classes.find((item) => item.id === slotId);

    if (!targetClass) {
      return;
    }

    setPendingSlotIds((current) => [...current, slotId]);

    try {
      const { data: overrideRow, error: overrideError } = await supabase
        .from("day_overrides")
        .upsert(
          {
            slot_id: slotId,
            date: todayIso,
            type: "rescheduled",
            new_time: newTime,
          },
          { onConflict: "slot_id,date" }
        )
        .select("id, slot_id, type, new_time")
        .single();

      if (overrideError) {
        throw overrideError;
      }

      setOverrides((current) => ({
        ...current,
        [slotId]: overrideRow as DayOverride,
      }));
      setClasses((current) =>
        current.map((item) =>
          item.id === slotId
            ? {
                ...item,
                overrideType: "rescheduled",
                displayTime: formatTimeRange(newTime, item.endTime),
              }
            : item
        )
      );
      setRescheduleSlotId(null);
      setRescheduleTime("");
      toast.success("Class rescheduled");
    } catch (actionError) {
      toast.error(
        actionError instanceof Error
          ? actionError.message
          : "Failed to reschedule class"
      );
    } finally {
      setPendingSlotIds((current) => current.filter((id) => id !== slotId));
    }
  }

  async function handleRemoveOverride(slotId: string) {
    const currentOverride = overrides[slotId];

    if (!currentOverride) {
      return;
    }

    setPendingSlotIds((current) => [...current, slotId]);

    try {
      const { error: deleteError } = await supabase
        .from("day_overrides")
        .delete()
        .eq("id", currentOverride.id);

      if (deleteError) {
        throw deleteError;
      }

      setOverrides((current) => {
        const next = { ...current };
        delete next[slotId];
        return next;
      });
      setClasses((current) =>
        current.map((item) =>
          item.id === slotId
            ? {
                ...item,
                overrideType: undefined,
                displayTime: undefined,
              }
            : item
        )
      );
      toast.success("Override removed");
    } catch (actionError) {
      toast.error(
        actionError instanceof Error
          ? actionError.message
          : "Failed to remove override"
      );
    } finally {
      setPendingSlotIds((current) => current.filter((id) => id !== slotId));
    }
  }

  const selectedRescheduleClass = classes.find(
    (item) => item.id === rescheduleSlotId
  );
  const unreadAlertCount = alerts.filter(
    (alert) => !readAlerts.has(getAlertKey(alert))
  ).length;
  const calendarDays = buildCalendarDays(displayedMonth);
  const academicDays = buildCalendarDays(academicMonth);
  const holidaySet = new Map<string, string>(holidays.map((h) => [h.date, h.reason]));
  const selectedAcademicHoliday = selectedAcademicDate ? holidaySet.get(selectedAcademicDate) : null;
  const isSemesterDay = (dateIso: string) => {
    if (!activeSemester) return false;
    return dateIso >= activeSemester.start_date && (!activeSemester.end_date || dateIso <= activeSemester.end_date);
  };
  const attendanceByDate = new Map<string, CalendarAttendanceRow[]>();
  const attendanceBySlotDate = new Map<string, AttendanceStatus>();

  for (const record of calendarAttendance) {
    const currentRecords = attendanceByDate.get(record.date) ?? [];
    currentRecords.push(record);
    attendanceByDate.set(record.date, currentRecords);
    attendanceBySlotDate.set(`${record.date}:${record.slot_id}`, record.status);
  }

  const selectedCalendarDateObject = selectedCalendarDate
    ? new Date(`${selectedCalendarDate}T00:00:00`)
    : null;
  const selectedCalendarClasses = selectedCalendarDateObject
    ? calendarClasses
        .filter((item) => item.dayOfWeek === selectedCalendarDateObject.getDay())
        .map((item) => ({
          ...item,
          status:
            attendanceBySlotDate.get(`${selectedCalendarDate}:${item.id}`) ?? null,
        }))
    : [];

  function handleThemeToggle() {
    setIsDarkMode((current) => {
      const next = !current;

      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        next ? "dark" : "light"
      );

      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {activeSemester?.name ?? "Attendify"}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Today — {headerDate}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/setup">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                title="Go to Setup"
              >
                <Settings />
                <span className="sr-only">Setup</span>
              </Button>
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              onClick={handleThemeToggle}
            >
              {isDarkMode ? <Sun /> : <Moon />}
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="relative shrink-0"
                >
                  <Bell />
                  {unreadAlertCount > 0 ? (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                      {unreadAlertCount}
                    </span>
                  ) : null}
                  <span className="sr-only">Open notifications</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Notifications</SheetTitle>
                  <SheetDescription>
                    Attendance alerts for your dashboard.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex items-center justify-between px-4">
                  <p className="text-sm text-muted-foreground">
                    {alerts.length} alert{alerts.length === 1 ? "" : "s"}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={unreadAlertCount === 0}
                    onClick={() =>
                      setReadAlerts(new Set(alerts.map((alert) => getAlertKey(alert))))
                    }
                  >
                    Mark all as read
                  </Button>
                </div>
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
                  {alerts.length ? (
                    alerts.map((alert) => {
                      const isUnread = !readAlerts.has(getAlertKey(alert));

                      return (
                        <div
                          key={getAlertKey(alert)}
                          className={`rounded-xl border px-4 py-3 ${
                            alert.type === "danger"
                              ? "border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/30"
                              : "border-amber-200 bg-amber-50 dark:border-amber-950 dark:bg-amber-950/20"
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span
                              className={`text-xs font-semibold uppercase tracking-wide ${
                                alert.type === "danger"
                                  ? "text-red-700 dark:text-red-300"
                                  : "text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {alert.type}
                            </span>
                            {isUnread ? (
                              <span className="text-xs font-medium text-red-500">
                                Unread
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Read
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-sm font-medium ${
                              alert.type === "danger"
                                ? "text-red-700 dark:text-red-200"
                                : "text-amber-700 dark:text-amber-200"
                            }`}
                          >
                            {alert.message}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-border bg-card px-4 py-6">
                      <p className="text-sm text-muted-foreground">
                        No alerts right now
                      </p>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <Tabs defaultValue="today" className="gap-4">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="academic">Academic</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4">
            {error ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-red-600">{error}</p>
                </CardContent>
              </Card>
            ) : null}

            {alerts
              .filter((alert) => !dismissedAlerts.has(alert.subjectName))
              .map((alert) => (
                <div
                  key={alert.subjectName}
                  className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
                    alert.type === "danger"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm">⚠</span>
                    <p className="text-sm font-medium">{alert.message}</p>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-medium"
                    onClick={() =>
                      setDismissedAlerts((current) => {
                        const next = new Set(current);
                        next.add(alert.subjectName);
                        return next;
                      })
                    }
                  >
                    X
                  </button>
                </div>
              ))}

            {isLoading ? (
              <div className="grid gap-4">
                {[1, 2].map((item) => (
                  <Card key={item}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
                        <div className="h-4 w-28 rounded bg-zinc-100 dark:bg-zinc-800" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : classes.length ? (
              <div className="grid gap-4">
                {classes.map((slot) => {
                  const isPending = pendingSlotIds.includes(slot.id);

                  return (
                    <Card key={slot.id}>
                      <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <CardTitle
                            className={
                              slot.overrideType === "cancelled"
                                ? "line-through text-zinc-400"
                                : ""
                            }
                          >
                            {slot.subjectName}
                          </CardTitle>
                          <CardDescription>
                            {slot.subjectCode ? `${slot.subjectCode} • ` : ""}
                            {slot.overrideType === "rescheduled" && slot.displayTime
                              ? slot.displayTime
                              : slot.timeRange}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getBadgeClassName(slot)}>
                            {getBadgeLabel(slot)}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" type="button">
                                <MoreVertical />
                                <span className="sr-only">Open slot actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {slot.overrideType ? (
                                <>
                                  <DropdownMenuItem
                                    onSelect={() => void handleRemoveOverride(slot.id)}
                                  >
                                    Remove Override
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              ) : null}
                              <DropdownMenuItem
                                onSelect={() => void handleCancelClass(slot.id)}
                              >
                                Cancel Class
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setRescheduleSlotId(slot.id);
                                  setRescheduleTime(slot.startTime);
                                }}
                              >
                                Reschedule
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p
                          className={`text-sm ${
                              slot.overrideType === "cancelled"
                              ? "text-zinc-400 line-through"
                              : "text-muted-foreground"
                          }`}
                        >
                          {slot.overrideType === "cancelled"
                            ? "This class is cancelled for today."
                            : slot.overrideType === "rescheduled"
                              ? "This class has a new time for today."
                              : slot.status === null
                                ? "No attendance record yet. Default view is absent."
                                : "Attendance marked for today."}
                        </p>
                        {slot.overrideType !== "cancelled" ? (
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
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">No classes today</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            {subjectStats.length ? (
              <div className="grid gap-4">
                {subjectStats.map((subject) => (
                  <Card key={subject.id}>
                    <CardHeader>
                      <CardTitle>{subject.name}</CardTitle>
                      <CardDescription>{subject.code}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {subject.totalHeld === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No classes held yet
                        </p>
                      ) : (
                        <>
                          <Progress
                            value={subject.percentage ?? 0}
                            className={getProgressClass(
                              subject.percentage,
                              subject.minAttendancePercent
                            )}
                          />
                          <p className="text-sm text-muted-foreground">
                            {subject.percentage}% attendance ({subject.attended}/
                            {subject.totalHeld} classes)
                          </p>
                          <p
                            className={`text-sm font-medium ${
                              subject.percentage !== null &&
                              subject.percentage >= subject.minAttendancePercent &&
                              subject.canMiss > 0
                                ? "text-emerald-600"
                                : subject.percentage !== null &&
                                    subject.percentage >=
                                      subject.minAttendancePercent &&
                                    subject.canMiss === 0
                                  ? "text-amber-600"
                                  : "text-red-600"
                            }`}
                          >
                            {subject.percentage !== null &&
                            subject.percentage >= subject.minAttendancePercent &&
                            subject.canMiss > 0
                              ? `Can miss ${subject.canMiss} more classes`
                              : subject.percentage !== null &&
                                  subject.percentage >=
                                    subject.minAttendancePercent &&
                                  subject.canMiss === 0
                                ? "On the edge — attend next class"
                                : `Attend ${Math.abs(subject.canMiss)} classes to recover`}
                          </p>
                          {subject.remainingClasses > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {subject.remainingClasses} classes remaining this semester
                              {subject.bestCasePercent !== null && subject.bestCasePercent < 100
                                ? ` · Max possible: ${subject.bestCasePercent}%`
                                : ""}
                            </p>
                          ) : null}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    No subject stats available
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <Card>
              <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>{formatMonthLabel(displayedMonth)}</CardTitle>
                  <CardDescription>
                    Monthly attendance overview for the active semester
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setDisplayedMonth(
                        new Date(
                          displayedMonth.getFullYear(),
                          displayedMonth.getMonth() - 1,
                          1
                        )
                      );
                      setSelectedCalendarDate(null);
                    }}
                  >
                    <ChevronLeft />
                    <span className="sr-only">Previous month</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setDisplayedMonth(
                        new Date(
                          displayedMonth.getFullYear(),
                          displayedMonth.getMonth() + 1,
                          1
                        )
                      );
                      setSelectedCalendarDate(null);
                    }}
                  >
                    <ChevronRight />
                    <span className="sr-only">Next month</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {calendarError ? (
                  <p className="text-sm text-red-600">{calendarError}</p>
                ) : null}

                <div className="grid grid-cols-7 gap-2">
                  {WEEKDAY_LABELS.map((label) => (
                    <div
                      key={label}
                      className="px-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {label}
                    </div>
                  ))}
                  {calendarDays.map((day) => {
                    const dateKey = formatLocalDateIso(day);
                    const isCurrentMonth =
                      day.getMonth() === displayedMonth.getMonth() &&
                      day.getFullYear() === displayedMonth.getFullYear();
                    const dayRecords = attendanceByDate.get(dateKey) ?? [];
                    const isSelected = selectedCalendarDate === dateKey;
                    const isToday = dateKey === localTodayIso;

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        disabled={!isCurrentMonth}
                        onClick={() => setSelectedCalendarDate(dateKey)}
                        className={`min-h-24 rounded-xl border p-2 text-left transition ${
                          isCurrentMonth
                            ? "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                            : "border-zinc-100 bg-zinc-50 text-zinc-400 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-600"
                        } ${isSelected ? "ring-2 ring-zinc-900/10" : ""}`}
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                            isToday
                              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                              : isCurrentMonth
                                ? "text-zinc-900 dark:text-zinc-100"
                                : "text-zinc-400 dark:text-zinc-600"
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {dayRecords.map((record, index) => (
                            <span
                              key={`${record.slot_id}-${record.status}-${index}`}
                              className={`h-2.5 w-2.5 rounded-full ${getCalendarDotClass(
                                record.status
                              )}`}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {isCalendarLoading ? (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm text-muted-foreground">
                      Loading calendar...
                    </p>
                  </div>
                ) : selectedCalendarDate ? (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-zinc-900">
                        {formatDisplayDate(
                          new Date(`${selectedCalendarDate}T00:00:00`)
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedCalendarClasses.length
                          ? "Classes and attendance status"
                          : "No classes scheduled for this day"}
                      </p>
                    </div>

                    {selectedCalendarClasses.length ? (
                      <div className="space-y-3">
                        {selectedCalendarClasses.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-sm font-medium text-zinc-900">
                                {item.subjectName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.subjectCode ? `${item.subjectCode} • ` : ""}
                                {item.timeRange}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                className={
                                  item.status === "present"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : item.status === "absent"
                                      ? "bg-red-100 text-red-700"
                                      : item.status === "cancelled"
                                        ? "bg-zinc-200 text-zinc-700"
                                        : "bg-zinc-100 text-zinc-600"
                                }
                              >
                                {getAttendanceStatusLabel(item.status)}
                              </Badge>
                              {item.status === "cancelled" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={pendingCalendarSlotIds.includes(item.id)}
                                  onClick={() => void handleCalendarUncancelClass(item.id, selectedCalendarDate!)}
                                >
                                  Uncancel
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={pendingCalendarSlotIds.includes(item.id)}
                                    onClick={() => void handleCalendarToggle(item.id, selectedCalendarDate!, item.status)}
                                  >
                                    {item.status === "present" ? "Mark Absent" : "Mark Present"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={pendingCalendarSlotIds.includes(item.id)}
                                    onClick={() => void handleCalendarCancelClass(item.id, selectedCalendarDate!)}
                                  >
                                    Cancel Class
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm text-muted-foreground">
                      Select a day to view its classes and attendance status.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="academic" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>{formatMonthLabel(academicMonth)}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAcademicMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
                      setSelectedAcademicDate(null);
                    }}
                  >
                    ‹
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAcademicMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
                      setSelectedAcademicDate(null);
                    }}
                  >
                    ›
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1">
                  {academicDays.map((day) => {
                    const dateKey = formatLocalDateIso(day);
                    const isCurrentMonth = day.getMonth() === academicMonth.getMonth();
                    const isToday = dateKey === localTodayIso;
                    const isHoliday = holidaySet.has(dateKey);
                    const inSemester = isSemesterDay(dateKey);
                    const isStart = activeSemester && dateKey === activeSemester.start_date;
                    const isSelected = selectedAcademicDate === dateKey;
                    return (
                      <button
                        key={dateKey}
                        onClick={() => setSelectedAcademicDate(dateKey === selectedAcademicDate ? null : dateKey)}
                        className={[
                          "flex flex-col items-center rounded-lg py-1 text-sm transition-colors",
                          !isCurrentMonth ? "opacity-30" : "",
                          isSelected ? "bg-zinc-200 dark:bg-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                          isToday ? "font-bold text-blue-600 dark:text-blue-400" : "",
                          !inSemester && isCurrentMonth ? "opacity-40" : "",
                        ].join(" ")}
                      >
                        <span>{day.getDate()}</span>
                        <span className="flex gap-0.5 mt-0.5">
                          {isHoliday && <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />}
                          {isStart && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />Holiday</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />Semester Start</span>
                  <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">Today</span>
                </div>

                {selectedAcademicDate && (
                  <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatDisplayDate(new Date(`${selectedAcademicDate}T00:00:00`))}
                    </p>
                    {selectedAcademicHoliday ? (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">🎉 Holiday: {selectedAcademicHoliday}</p>
                    ) : activeSemester && selectedAcademicDate === activeSemester.start_date ? (
                      <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">📅 Semester Start</p>
                    ) : !isSemesterDay(selectedAcademicDate) ? (
                      <p className="mt-1 text-sm text-muted-foreground">Outside semester range</p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">No special events</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={rescheduleSlotId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRescheduleSlotId(null);
            setRescheduleTime("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Class</DialogTitle>
            <DialogDescription>
              Pick a new start time for{" "}
              {selectedRescheduleClass?.subjectName ?? "this class"}.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="time"
            value={rescheduleTime}
            onChange={(event) => setRescheduleTime(event.target.value)}
          />
          <DialogFooter showCloseButton>
            <Button
              type="button"
              disabled={!rescheduleSlotId || !rescheduleTime}
              onClick={() =>
                rescheduleSlotId
                  ? void handleRescheduleClass(rescheduleSlotId, rescheduleTime)
                  : undefined
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
