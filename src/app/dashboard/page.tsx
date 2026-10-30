"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  LogOut,
  Moon,
  MoreVertical,
  Settings,
  Sun,
  X,
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
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { AttendanceStatus, Exam } from "@/lib/types";

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
        id: string;
        name: string;
        code: string;
        semester_id?: string;
      }
    | {
        id: string;
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

type CalendarOverride = DayOverride & {
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

type DashboardExam = Exam & {
  subjectName?: string;
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
        id: string;
        name: string;
        code: string;
        semester_id?: string;
      }
    | {
        id: string;
        name: string;
        code: string;
        semester_id?: string;
      }[]
    | null;
};

type CalendarClass = {
  id: string;
  subjectId: string;
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

function formatMinutesAsTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}:00`;
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

function getWeekStatusClass(status: AttendanceStatus | "upcoming") {
  if (status === "present") {
    return "border-emerald-200 bg-emerald-50 dark:border-emerald-950 dark:bg-emerald-950/30";
  }

  if (status === "absent") {
    return "border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/30";
  }

  if (status === "cancelled") {
    return "border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800";
  }

  return "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950";
}

function getWeekStatusLabel(status: AttendanceStatus | "upcoming") {
  if (status === "upcoming") {
    return "Upcoming";
  }

  return getAttendanceStatusLabel(status);
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

function examAffectsSubject(exam: Exam, subjectId: string) {
  return exam.subject_id === null || exam.subject_id === subjectId;
}

function examAffectsSlot(exam: Exam, slot: CalendarClass | { subject_id: string }) {
  return examAffectsSubject(
    exam,
    "subjectId" in slot ? slot.subjectId : slot.subject_id
  );
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DashboardPage() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [userId, setUserId] = useState<string | null>(null);
  const hasAutoMarked = useRef(false);
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [todayExams, setTodayExams] = useState<DashboardExam[]>([]);
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
  const [calendarOverrides, setCalendarOverrides] = useState<
    CalendarOverride[]
  >([]);
  const [calendarExams, setCalendarExams] = useState<Exam[]>([]);
  const [calendarSubjectId, setCalendarSubjectId] = useState("all");
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");
  const [selectDaysMode, setSelectDaysMode] = useState(false);
  const [selectedBulkDates, setSelectedBulkDates] = useState<Set<string>>(
    new Set()
  );
  const [bulkConfirmAction, setBulkConfirmAction] = useState<
    "present" | "absent" | null
  >(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [weekStart, setWeekStart] = useState(() => {
    const date = new Date();
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(
    null
  );
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [pendingCalendarSlotIds, setPendingCalendarSlotIds] = useState<string[]>([]);
  const [holidayDialog, setHolidayDialog] = useState<"add" | "remove" | null>(
    null
  );
  const [holidayReason, setHolidayReason] = useState("Holiday");
  const [isHolidaySaving, setIsHolidaySaving] = useState(false);
  const [examDialogOpen, setExamDialogOpen] = useState(false);
  const [examTitle, setExamTitle] = useState("Exam");
  const [examSubjectId, setExamSubjectId] = useState("all");
  const [isExamSaving, setIsExamSaving] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
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
  const mobileHeaderDate = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(today);

  useEffect(() => {
    async function getAuthUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.push("/auth");
        return;
      }

      setUserId(user.id);
    }

    void getAuthUser();
  }, [supabase, router]);

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
      statSlots: Array<{ id: string; subject_id: string; day_of_week: number }>,
      holidayDates: Set<string>,
      exams: Exam[]
    ) {
      if (hasAutoMarked.current) {
        return;
      }

      hasAutoMarked.current = true;

      if (!holidayDates.has(todayIso)) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const pastSlots = slots.filter((slot) => {
          const override = overrideMap[slot.id];
          const subject = Array.isArray(slot.subjects)
            ? slot.subjects[0]
            : slot.subjects;

          if (
            override?.type === "cancelled" ||
            exams.some(
              (exam) =>
                exam.date === todayIso &&
                (exam.subject_id === null || exam.subject_id === subject?.id)
            )
          ) {
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
                if (
                  !holidayDates.has(dateIso) &&
                  !exams.some(
                    (exam) =>
                      exam.date === dateIso &&
                      (exam.subject_id === null || exam.subject_id === slot.subject_id)
                  )
                ) {
                  candidateBackfills.push({ slot_id: slot.id, date: dateIso });
                }
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

    async function loadStats(
      activeSemester: ActiveSemester,
      holidayDates: Set<string>,
      exams: Exam[]
    ) {
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
        .select("slot_id, date, status")
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

      const examByDate = new Map<string, Exam[]>();
      for (const exam of exams) {
        const dateExams = examByDate.get(exam.date) ?? [];
        dateExams.push(exam);
        examByDate.set(exam.date, dateExams);
      }
      const slotSubjectIds = new Map(
        typedStatSlots.map((slot) => [slot.id, slot.subject_id])
      );
      const allAttendance = ((statAttendance as (AttendanceRow & { date: string })[] | null) ?? [])
        .filter(
          (record) =>
            !(examByDate.get(record.date) ?? []).some((exam) =>
              examAffectsSubject(exam, slotSubjectIds.get(record.slot_id) ?? "")
            )
        );
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
                !holidayDates.has(isoDate) &&
                !(examByDate.get(isoDate) ?? []).some((exam) =>
                  examAffectsSubject(exam, subject.id)
                ) &&
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
        if (subject.totalHeld < 4) {
          continue;
        }

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
      if (!userId) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data: semester, error: semesterError } = await supabase
          .from("semesters")
          .select("id, name, start_date, end_date")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();

        if (semesterError) {
          throw semesterError;
        }

        if (!semester) {
          setActiveSemester(null);
          setClasses([]);
          setTodayExams([]);
          setSubjectStats([]);
          setAlerts([]);
          setOverrides({});
          setHolidays([]);
          setCalendarExams([]);
          return;
        }

        setActiveSemester(semester);
        const { data: holidayRows, error: holidaysError } = await supabase
          .from("holidays")
          .select("date, reason")
          .eq("semester_id", semester.id)
          .order("date", { ascending: true });

        if (holidaysError) {
          throw holidaysError;
        }

        const semesterHolidays = (holidayRows ?? []) as Array<{
          date: string;
          reason: string;
        }>;
        setHolidays(semesterHolidays);
        const holidayDates = new Set(
          semesterHolidays.map((holiday) => holiday.date)
        );
        const { data: subjectRows, error: subjectRowsError } = await supabase
          .from("subjects")
          .select("id, name")
          .eq("semester_id", semester.id);

        if (subjectRowsError) {
          throw subjectRowsError;
        }

        const subjectNameById = new Map(
          ((subjectRows ?? []) as Array<{ id: string; name: string }>).map(
            (subject) => [subject.id, subject.name]
          )
        );
        const { data: examRows, error: examsError } = await supabase
          .from("exams")
          .select("id, semester_id, subject_id, date, title, created_at")
          .eq("semester_id", semester.id)
          .order("date", { ascending: true });

        if (examsError) {
          throw examsError;
        }

        const semesterExams = (examRows ?? []) as Exam[];
        const statSlots = await loadStats(semester, holidayDates, semesterExams);

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

        const todayExamRows = semesterExams.filter((exam) => exam.date === todayIso);
        setTodayExams(
          todayExamRows.map((exam) => ({
            ...exam,
            subjectName:
              exam.subject_id
                ? subjectNameById.get(exam.subject_id)
                : undefined,
          }))
        );

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

        await autoMarkPastSlots(
          typedSlots,
          overrideMap,
          semester,
          statSlots ?? [],
          holidayDates,
          semesterExams
        );
        await loadStats(semester, holidayDates, semesterExams);

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
          typedSlots
            .filter((slot) => {
              const subject = Array.isArray(slot.subjects)
                ? slot.subjects[0]
                : slot.subjects;
              return !todayExamRows.some(
                (exam) =>
                  exam.date === todayIso &&
                  (exam.subject_id === null || exam.subject_id === subject?.id)
              );
            })
            .map((slot) => {
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
  }, [supabase, todayDayOfWeek, todayIso, userId, calendarRefreshKey]);

  useEffect(() => {
    async function loadCalendarData() {
      if (!userId || !activeSemester) {
        setCalendarClasses([]);
        setCalendarAttendance([]);
        setCalendarOverrides([]);
        setCalendarExams([]);
        setCalendarError(null);
        setIsCalendarLoading(false);
        return;
      }

      setIsCalendarLoading(true);
      setCalendarError(null);

      try {
        const { data: slotRows, error: slotError } = await supabase
          .from("schedule_slots")
          .select("id, day_of_week, start_time, end_time, subjects(id, name, code, semester_id)")
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
              subjectId: subject?.id ?? "",
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

        const monthStartIso = formatLocalDateIso(
          new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1)
        );
        const monthEndIso = formatLocalDateIso(
          new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0)
        );
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 4);
        const weekStartIso = formatLocalDateIso(weekStart);
        const weekEndIso = formatLocalDateIso(weekEnd);
        const rangeStartIso = monthStartIso < weekStartIso ? monthStartIso : weekStartIso;
        const rangeEndIso = monthEndIso > weekEndIso ? monthEndIso : weekEndIso;

        const { data: examRows, error: examsError } = await supabase
          .from("exams")
          .select("id, semester_id, subject_id, date, title, created_at")
          .eq("semester_id", activeSemester.id)
          .gte("date", rangeStartIso)
          .lte("date", rangeEndIso);

        if (examsError) {
          throw examsError;
        }

        setCalendarExams((examRows ?? []) as Exam[]);

        if (!slotIds.length) {
          setCalendarAttendance([]);
          setCalendarOverrides([]);
          return;
        }

        const { data: attendanceRows, error: attendanceError } = await supabase
          .from("attendance_records")
          .select("slot_id, date, status")
          .in("slot_id", slotIds)
          .gte("date", rangeStartIso)
          .lte("date", rangeEndIso);

        if (attendanceError) {
          throw attendanceError;
        }

        setCalendarAttendance(
          ((attendanceRows ?? []) as CalendarAttendanceRow[]).sort((left, right) =>
            left.date.localeCompare(right.date)
          )
        );

        const { data: overrideRows, error: overrideError } = await supabase
          .from("day_overrides")
          .select("id, slot_id, date, type, new_time")
          .in("slot_id", slotIds)
          .gte("date", rangeStartIso)
          .lte("date", rangeEndIso);

        if (overrideError) {
          throw overrideError;
        }

        setCalendarOverrides((overrideRows ?? []) as CalendarOverride[]);
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
  }, [
    activeSemester,
    displayedMonth,
    supabase,
    backfillDone,
    userId,
    weekStart,
    calendarRefreshKey,
  ]);

  const exportCSV = () => {
    const headers = [
      "Subject",
      "Code",
      "Classes Held",
      "Attended",
      "Absent",
      "Attendance %",
      "Safe to Miss",
      "Min Required %"
    ];

    const escapeCSVValue = (val: string | number | null | undefined) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = subjectStats.map((subject) => {
      const absent = subject.totalHeld - subject.attended;
      const attendancePct = subject.percentage !== null ? `${subject.percentage}%` : "N/A";
      const minRequiredPct = `${subject.minAttendancePercent}%`;
      return [
        subject.name,
        subject.code,
        subject.totalHeld,
        subject.attended,
        absent,
        attendancePct,
        subject.canMiss,
        minRequiredPct
      ];
    });

    const csvContent = [
      headers.map(escapeCSVValue).join(","),
      ...rows.map((row) => row.map(escapeCSVValue).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const semesterName = activeSemester?.name
      ? activeSemester.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      : "";
    const filename = semesterName
      ? `attendance-${semesterName}-${localTodayIso}.csv`
      : `attendance-${localTodayIso}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const semesterName = activeSemester?.name || "Semester";
    const dateStr = localTodayIso;

    const tableRows = subjectStats.map((subject) => {
      const absent = subject.totalHeld - subject.attended;
      const attendancePct = subject.percentage !== null ? `${subject.percentage}%` : "N/A";
      const minRequiredPct = `${subject.minAttendancePercent}%`;
      return `
        <tr>
          <td>${subject.name}</td>
          <td>${subject.code}</td>
          <td>${subject.totalHeld}</td>
          <td>${subject.attended}</td>
          <td>${absent}</td>
          <td>${attendancePct}</td>
          <td>${subject.canMiss}</td>
          <td>${minRequiredPct}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attendance Report - ${semesterName}</title>
        </head>
        <body>
          <div id="attendance-print-container">
            <h1 style="font-size: 20px; margin-bottom: 4px;">Attendance Report</h1>
            <h2 style="font-size: 14px; color: #4b5563; margin-top: 0; margin-bottom: 20px;">
              Semester: ${semesterName} (${dateStr})
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Classes Held</th>
                  <th>Attended</th>
                  <th>Absent</th>
                  <th>Attendance %</th>
                  <th>Safe to Miss</th>
                  <th>Min Required %</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();

    const styleEl = printWindow.document.createElement("style");
    styleEl.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #attendance-print-container, #attendance-print-container * {
          visibility: visible;
        }
        #attendance-print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
      }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        padding: 20px;
        color: #111;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      th, td {
        border: 1px solid #e5e7eb;
        padding: 8px 12px;
        text-align: left;
        font-size: 12px;
      }
      th {
        background-color: #f9fafb;
        font-weight: 600;
      }
    `;
    printWindow.document.head.appendChild(styleEl);

    let hasPrinted = false;
    const doPrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      printWindow.print();
      printWindow.close();
    };

    printWindow.onload = doPrint;
    setTimeout(doPrint, 250);
  };

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
      setCalendarOverrides((prev) => [
        ...prev.filter(
          (override) => !(override.slot_id === slotId && override.date === date)
        ),
        {
          id: `${slotId}:${date}`,
          slot_id: slotId,
          date,
          type: "cancelled",
          new_time: null,
        },
      ]);

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
      setCalendarOverrides((prev) =>
        prev.filter(
          (override) => !(override.slot_id === slotId && override.date === date)
        )
      );

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

  function openHolidayDialog(mode: "add" | "remove") {
    if (!selectedCalendarDate) {
      return;
    }

    if (mode === "add") {
      setHolidayReason("Holiday");
    }
    setHolidayDialog(mode);
  }

  async function handleHolidayAction() {
    if (!selectedCalendarDate || !activeSemester || !holidayDialog) {
      return;
    }

    setIsHolidaySaving(true);

    try {
      if (holidayDialog === "add") {
        const reason = holidayReason.trim() || "Holiday";
        const slotIds = calendarClasses.map((item) => item.id);

        const { error: holidayError } = await supabase.from("holidays").insert({
          semester_id: activeSemester.id,
          date: selectedCalendarDate,
          reason,
        });

        if (holidayError) {
          throw holidayError;
        }

        if (slotIds.length) {
          const { error: attendanceError } = await supabase
            .from("attendance_records")
            .delete()
            .in("slot_id", slotIds)
            .eq("date", selectedCalendarDate);

          if (attendanceError) {
            throw attendanceError;
          }
        }

        toast.success("Holiday added");
      } else {
        const { error: holidayError } = await supabase
          .from("holidays")
          .delete()
          .eq("semester_id", activeSemester.id)
          .eq("date", selectedCalendarDate);

        if (holidayError) {
          throw holidayError;
        }

        toast.success("Holiday removed");
      }

      setHolidayDialog(null);
      setCalendarRefreshKey((current) => current + 1);
    } catch (actionError) {
      toast.error(
        actionError instanceof Error
          ? actionError.message
          : `Failed to ${holidayDialog === "add" ? "add" : "remove"} holiday`
      );
    } finally {
      setIsHolidaySaving(false);
    }
  }

  function openExamDialog() {
    if (!selectedCalendarDate) {
      return;
    }

    setExamTitle("Exam");
    setExamSubjectId("all");
    setExamDialogOpen(true);
  }

  async function handleAddExam() {
    if (!selectedCalendarDate || !activeSemester) {
      return;
    }

    setIsExamSaving(true);

    try {
      const { data: exam, error: examError } = await supabase
        .from("exams")
        .insert({
          semester_id: activeSemester.id,
          date: selectedCalendarDate,
          subject_id: examSubjectId === "all" ? null : examSubjectId,
          title: examTitle.trim() || "Exam",
        })
        .select("id, semester_id, subject_id, date, title, created_at")
        .single();

      if (examError) {
        throw examError;
      }

      const affectedSlotIds = calendarClasses
        .filter((item) => examAffectsSlot(exam as Exam, item))
        .map((item) => item.id);

      if (affectedSlotIds.length) {
        const { error: attendanceError } = await supabase
          .from("attendance_records")
          .delete()
          .in("slot_id", affectedSlotIds)
          .eq("date", selectedCalendarDate);

        if (attendanceError) {
          throw attendanceError;
        }
      }

      setExamDialogOpen(false);
      setExamTitle("Exam");
      setExamSubjectId("all");
      toast.success("Exam added");
      setCalendarRefreshKey((current) => current + 1);
    } catch (actionError) {
      toast.error(
        actionError instanceof Error ? actionError.message : "Failed to add exam"
      );
    } finally {
      setIsExamSaving(false);
    }
  }

  async function handleRemoveExam(exam: Exam) {
    if (!window.confirm(`Remove "${exam.title}"?`)) {
      return;
    }

    try {
      const { error: examError } = await supabase
        .from("exams")
        .delete()
        .eq("id", exam.id);

      if (examError) {
        throw examError;
      }

      toast.success("Exam removed");
      setCalendarRefreshKey((current) => current + 1);
    } catch (actionError) {
      toast.error(
        actionError instanceof Error
          ? actionError.message
          : "Failed to remove exam"
      );
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

  function toggleBulkDate(dateKey: string) {
    if (!selectableBulkDates.has(dateKey)) {
      return;
    }

    setSelectedBulkDates((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  }

  async function handleBulkAttendance() {
    if (!bulkConfirmAction || !selectedBulkDates.size) {
      return;
    }

    setIsBulkSaving(true);

    try {
      const records: Array<{
        slot_id: string;
        date: string;
        status: "present" | "absent";
        marked_by: "manual";
      }> = [];

      for (const date of selectedBulkDates) {
        const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
        const dayExams = examsByDate.get(date) ?? [];

        for (const slot of filteredCalendarClasses) {
          if (
            slot.dayOfWeek !== dayOfWeek ||
            calendarOverrides.some(
              (override) =>
                override.slot_id === slot.id &&
                override.date === date &&
                override.type === "cancelled"
            ) ||
            dayExams.some((exam) => examAffectsSlot(exam, slot))
          ) {
            continue;
          }

          records.push({
            slot_id: slot.id,
            date,
            status: bulkConfirmAction,
            marked_by: "manual",
          });
        }
      }

      if (records.length) {
        const { error: attendanceError } = await supabase
          .from("attendance_records")
          .upsert(records, { onConflict: "slot_id,date" });

        if (attendanceError) {
          throw attendanceError;
        }
      }

      const statusLabel = bulkConfirmAction === "absent" ? "absent" : "present";
      setSelectedBulkDates(new Set());
      setSelectDaysMode(false);
      setBulkConfirmAction(null);
      setCalendarRefreshKey((current) => current + 1);
      toast.success(`Marked ${records.length} classes ${statusLabel}`);
    } catch (actionError) {
      toast.error(
        actionError instanceof Error
          ? actionError.message
          : "Failed to update attendance"
      );
    } finally {
      setIsBulkSaving(false);
    }
  }

  const selectedRescheduleClass = classes.find(
    (item) => item.id === rescheduleSlotId
  );
  const unreadAlertCount = alerts.filter(
    (alert) => !readAlerts.has(getAlertKey(alert))
  ).length;
  const calendarDays = buildCalendarDays(displayedMonth);
  const weekDays = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const academicDays = buildCalendarDays(academicMonth);
  const holidaySet = new Map<string, string>(holidays.map((h) => [h.date, h.reason]));
  const filteredCalendarExams = calendarExams.filter(
    (exam) =>
      calendarSubjectId === "all" ||
      exam.subject_id === null ||
      exam.subject_id === calendarSubjectId
  );
  const examsByDate = new Map<string, Exam[]>();
  for (const exam of filteredCalendarExams) {
    const dateExams = examsByDate.get(exam.date) ?? [];
    dateExams.push(exam);
    examsByDate.set(exam.date, dateExams);
  }
  const selectedAcademicHoliday = selectedAcademicDate ? holidaySet.get(selectedAcademicDate) : null;
  const isSemesterDay = (dateIso: string) => {
    if (!activeSemester) return false;
    return dateIso >= activeSemester.start_date && (!activeSemester.end_date || dateIso <= activeSemester.end_date);
  };
  const attendanceBySlotDate = new Map<string, AttendanceStatus>();

  for (const record of calendarAttendance) {
    attendanceBySlotDate.set(`${record.date}:${record.slot_id}`, record.status);
  }

  const selectedCalendarDateObject = selectedCalendarDate
    ? new Date(`${selectedCalendarDate}T00:00:00`)
    : null;
  const filteredCalendarClasses =
    calendarSubjectId === "all"
      ? calendarClasses
      : calendarClasses.filter((item) => item.subjectId === calendarSubjectId);
  const filteredCalendarSlotIds = new Set(
    filteredCalendarClasses.map((item) => item.id)
  );
  const selectableBulkDates = new Set(
    calendarDays
      .map((day) => formatLocalDateIso(day))
      .filter((dateKey) => {
        const date = new Date(`${dateKey}T00:00:00`);
        return (
          date.getMonth() === displayedMonth.getMonth() &&
          date.getFullYear() === displayedMonth.getFullYear() &&
          dateKey <= localTodayIso &&
          date.getDay() !== 0 &&
          date.getDay() !== 6 &&
          !holidaySet.has(dateKey) &&
          !examsByDate.has(dateKey) &&
          filteredCalendarClasses.some(
            (item) => item.dayOfWeek === date.getDay()
          )
        );
      })
  );
  const filteredAttendanceByDate = new Map<string, CalendarAttendanceRow[]>();
  const overrideBySlotDate = new Map<string, CalendarOverride>();

  for (const record of calendarAttendance) {
    if (!filteredCalendarSlotIds.has(record.slot_id)) {
      continue;
    }

    const currentRecords = filteredAttendanceByDate.get(record.date) ?? [];
    currentRecords.push(record);
    filteredAttendanceByDate.set(record.date, currentRecords);
  }

  for (const override of calendarOverrides) {
    overrideBySlotDate.set(`${override.date}:${override.slot_id}`, override);
  }

  const selectedCalendarClasses = selectedCalendarDateObject
    ? calendarClasses
        .filter(
          (item) =>
            item.dayOfWeek === selectedCalendarDateObject.getDay() &&
            filteredCalendarSlotIds.has(item.id) &&
            !(examsByDate.get(selectedCalendarDate!) ?? []).some((exam) =>
              examAffectsSlot(exam, item)
            )
        )
        .map((item) => {
          const override = overrideBySlotDate.get(
            `${selectedCalendarDate}:${item.id}`
          );
          const duration = Math.max(
            timeToMinutes(item.endTime) - timeToMinutes(item.startTime),
            0
          );
          const startTime =
            override?.type === "rescheduled" && override.new_time
              ? override.new_time
              : item.startTime;

          return {
            ...item,
            timeRange:
              override?.type === "rescheduled" && override.new_time
                ? formatTimeRange(
                    startTime,
                    formatMinutesAsTime(timeToMinutes(startTime) + duration)
                  )
                : item.timeRange,
            status:
              override?.type === "cancelled"
                ? "cancelled"
                : attendanceBySlotDate.get(`${selectedCalendarDate}:${item.id}`) ??
                  null,
          };
        })
    : [];
  const weekClassByDate = new Map<
    string,
    Array<{
      item: CalendarClass;
      status: AttendanceStatus | "upcoming";
      timeRange: string;
      sortTime: number;
    }>
  >();

  for (const day of weekDays) {
    const dateKey = formatLocalDateIso(day);
    if (holidaySet.has(dateKey)) {
      continue;
    }

    const dayClasses = filteredCalendarClasses
      .filter((item) => item.dayOfWeek === day.getDay())
      .map((item) => {
        const override = overrideBySlotDate.get(`${dateKey}:${item.id}`);
        const status: AttendanceStatus | "upcoming" =
          override?.type === "cancelled"
            ? "cancelled"
            : attendanceBySlotDate.get(`${dateKey}:${item.id}`) ??
              "upcoming";
        const startTime =
          override?.type === "rescheduled" && override.new_time
            ? override.new_time
            : item.startTime;
        const duration = Math.max(
          timeToMinutes(item.endTime) - timeToMinutes(item.startTime),
          0
        );
        const endTime =
          override?.type === "rescheduled" && override.new_time
            ? formatMinutesAsTime(timeToMinutes(override.new_time) + duration)
            : item.endTime;

        return {
          item,
          status,
          timeRange: formatTimeRange(startTime, endTime),
          sortTime: timeToMinutes(startTime),
        };
      })
      .sort((left, right) => left.sortTime - right.sortTime);

    weekClassByDate.set(dateKey, dayClasses);
  }

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
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {activeSemester?.name ?? "Attendify"}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Today — <span className="sm:hidden">{mobileHeaderDate}</span><span className="hidden sm:inline">{headerDate}</span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <a href="/setup">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                title="Go to Setup"
                aria-label="Go to Setup"
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
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun /> : <Moon />}
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/auth");
              }}
              title="Logout"
              aria-label="Logout"
            >
              <LogOut />
              <span className="sr-only">Logout</span>
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="relative shrink-0"
                  aria-label="Open notifications"
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
                    size="default"
                    disabled={unreadAlertCount === 0}
                    onClick={() =>
                      setReadAlerts(new Set(alerts.map((alert) => getAlertKey(alert))))
                    }
                  >
                    Mark all as read
                  </Button>
                </div>
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4">
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
                            className={`min-w-0 break-words text-sm font-medium ${
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
          <TabsList className="max-sm:grid max-sm:w-full max-sm:grid-cols-4">
            <TabsTrigger className="text-xs sm:text-sm" value="today">Today</TabsTrigger>
            <TabsTrigger className="text-xs sm:text-sm" value="stats">Stats</TabsTrigger>
            <TabsTrigger className="text-xs sm:text-sm" value="calendar">Calendar</TabsTrigger>
            <TabsTrigger className="text-xs sm:text-sm" value="academic">Academic</TabsTrigger>
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
                  <div className="min-w-0 flex items-start gap-2">
                    <span className="text-sm">⚠</span>
                    <p className="min-w-0 break-words text-sm font-medium">{alert.message}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                    aria-label="Dismiss alert"
                    onClick={() =>
                      setDismissedAlerts((current) => {
                        const next = new Set(current);
                        next.add(alert.subjectName);
                        return next;
                      })
                    }
                  >
                    <X />
                  </Button>
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
            ) : todayExams.length || classes.length ? (
              <div className="grid gap-4">
                {todayExams.map((exam) => (
                  <Card key={exam.id} className="border-purple-200 dark:border-purple-950">
                    <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <CardTitle>{exam.title}</CardTitle>
                        <CardDescription>
                          {exam.subjectName ?? "All subjects"}
                        </CardDescription>
                      </div>
                      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-200">
                        Exam
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Classes affected by this exam are excluded from attendance.
                      </p>
                    </CardContent>
                  </Card>
                ))}
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
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportCSV}
                    className="w-full flex items-center gap-2 sm:w-auto"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportPDF}
                    className="w-full flex items-center gap-2 sm:w-auto"
                  >
                    <FileText className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
                <div className="grid gap-4">
                {subjectStats.map((subject) => (
                  <Card
                    key={subject.id}
                    className="group cursor-pointer transition hover:border-zinc-300 dark:hover:border-zinc-700"
                    onClick={() => router.push(`/subject/${subject.id}`)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="min-w-0">
                        <CardTitle className="min-w-0 break-words">{subject.name}</CardTitle>
                        <CardDescription>{subject.code}</CardDescription>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {subject.totalHeld === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No classes held yet
                        </p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="min-w-0 break-words text-muted-foreground">
                              {subject.attended} / {subject.totalHeld} classes attended so far
                            </span>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {subject.percentage}%
                            </span>
                          </div>
                          <Progress
                            value={subject.percentage ?? 0}
                            className={getProgressClass(
                              subject.percentage,
                              subject.minAttendancePercent
                            )}
                          />
                          <p
                            className={`text-sm font-medium ${
                              subject.percentage !== null &&
                              subject.percentage >= subject.minAttendancePercent &&
                              subject.canMiss > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : subject.percentage !== null &&
                                    subject.percentage >=
                                      subject.minAttendancePercent &&
                                    subject.canMiss === 0
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {subject.percentage !== null &&
                            subject.percentage >= subject.minAttendancePercent &&
                            subject.canMiss > 0
                              ? `Can miss ${subject.canMiss} more ${
                                  subject.canMiss === 1 ? "class" : "classes"
                                }`
                              : subject.percentage !== null &&
                                  subject.percentage >=
                                    subject.minAttendancePercent &&
                                  subject.canMiss === 0
                                ? "On the edge — attend next class"
                                : `Attend ${Math.abs(subject.canMiss)} ${
                                    Math.abs(subject.canMiss) === 1 ? "class" : "classes"
                                  } to recover`}
                          </p>
                          {subject.remainingClasses > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {subject.remainingClasses} total classes remaining this semester
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
              </>
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
                  <CardTitle className="min-w-0 truncate">
                    {calendarView === "month"
                      ? formatMonthLabel(displayedMonth)
                      : `${new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                        }).format(weekDays[0])} – ${new Intl.DateTimeFormat(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" }
                        ).format(weekDays[4])}`}
                  </CardTitle>
                  <CardDescription>
                    {calendarView === "month"
                      ? "Monthly attendance overview for the active semester"
                      : "Weekly attendance overview for the active semester"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {calendarView === "month" ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Previous month"
                        onClick={() => {
                          setDisplayedMonth(
                            new Date(
                              displayedMonth.getFullYear(),
                              displayedMonth.getMonth() - 1,
                              1
                            )
                          );
                          setSelectedCalendarDate(null);
                          setSelectedBulkDates(new Set());
                        }}
                      >
                        <ChevronLeft />
                        <span className="sr-only">Previous month</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Next month"
                        onClick={() => {
                          setDisplayedMonth(
                            new Date(
                              displayedMonth.getFullYear(),
                              displayedMonth.getMonth() + 1,
                              1
                            )
                          );
                          setSelectedCalendarDate(null);
                          setSelectedBulkDates(new Set());
                        }}
                      >
                        <ChevronRight />
                        <span className="sr-only">Next month</span>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Previous week"
                        onClick={() => {
                          const previousWeek = new Date(weekStart);
                          previousWeek.setDate(previousWeek.getDate() - 7);
                          setWeekStart(previousWeek);
                          setSelectedCalendarDate(null);
                        }}
                      >
                        <ChevronLeft />
                        <span className="sr-only">Previous week</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 px-3 sm:min-h-8"
                        onClick={() => {
                          const date = new Date();
                          const day = date.getDay();
                          date.setDate(
                            date.getDate() - (day === 0 ? 6 : day - 1)
                          );
                          date.setHours(0, 0, 0, 0);
                          setWeekStart(date);
                          setSelectedCalendarDate(null);
                        }}
                      >
                        This week
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Next week"
                        onClick={() => {
                          const nextWeek = new Date(weekStart);
                          nextWeek.setDate(nextWeek.getDate() + 7);
                          setWeekStart(nextWeek);
                          setSelectedCalendarDate(null);
                        }}
                      >
                        <ChevronRight />
                        <span className="sr-only">Next week</span>
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {calendarError ? (
                  <p className="text-sm text-red-600">{calendarError}</p>
                ) : null}

                <div className="flex w-full rounded-lg border border-border p-1 sm:w-fit">
                  <Button
                    type="button"
                    variant={calendarView === "month" ? "secondary" : "ghost"}
                    className="min-h-11 flex-1 sm:min-h-8 sm:flex-none"
                    onClick={() => {
                      setCalendarView("month");
                      setSelectedCalendarDate(null);
                    }}
                  >
                    Month
                  </Button>
                  <Button
                    type="button"
                    variant={calendarView === "week" ? "secondary" : "ghost"}
                    className="min-h-11 flex-1 sm:min-h-8 sm:flex-none"
                    onClick={() => {
                      setCalendarView("week");
                      setSelectDaysMode(false);
                      setSelectedBulkDates(new Set());
                      setSelectedCalendarDate(null);
                    }}
                  >
                    Week
                  </Button>
                  {calendarView === "month" ? (
                    <Button
                      type="button"
                      variant={selectDaysMode ? "secondary" : "ghost"}
                      className="min-h-11 flex-1 sm:min-h-8 sm:flex-none"
                      onClick={() => {
                        setSelectDaysMode((current) => !current);
                        setSelectedBulkDates(new Set());
                        setSelectedCalendarDate(null);
                      }}
                    >
                      Select days
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Select
                    value={calendarSubjectId}
                    onValueChange={(value) => {
                      setCalendarSubjectId(value);
                      setSelectedCalendarDate(null);
                      setSelectedBulkDates(new Set());
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filter calendar by subject">
                      <SelectValue placeholder="All subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All subjects</SelectItem>
                      {subjectStats.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {calendarSubjectId !== "all" ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>
                        Showing:{" "}
                        {subjectStats.find(
                          (subject) => subject.id === calendarSubjectId
                        )?.name ?? "Selected subject"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7"
                        aria-label="Clear subject filter"
                        onClick={() => {
                          setCalendarSubjectId("all");
                          setSelectedCalendarDate(null);
                        }}
                      >
                        <X />
                        <span className="sr-only">Clear subject filter</span>
                      </Button>
                    </div>
                  ) : null}
                </div>

                {calendarView === "month" ? (
                  <div className="grid grid-cols-7 gap-2 max-sm:gap-0.5">
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
                    const dayRecords = filteredAttendanceByDate.get(dateKey) ?? [];
                    const isSelected = selectedCalendarDate === dateKey;
                    const isBulkSelected = selectedBulkDates.has(dateKey);
                    const isToday = dateKey === localTodayIso;

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        disabled={
                          !isCurrentMonth ||
                          (selectDaysMode && !selectableBulkDates.has(dateKey))
                        }
                        onClick={() =>
                          selectDaysMode
                            ? toggleBulkDate(dateKey)
                            : setSelectedCalendarDate(dateKey)
                        }
                        className={`rounded-xl border p-2 text-left transition max-sm:aspect-square max-sm:p-1 ${
                          isSelected || isBulkSelected
                            ? "ring-2 ring-zinc-900/10 max-sm:bg-zinc-100 dark:max-sm:bg-zinc-800"
                            : ""
                        } ${
                          isCurrentMonth
                            ? "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                            : "border-zinc-100 bg-zinc-50 text-zinc-400 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-600"
                        } sm:min-h-24`}
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold max-sm:text-sm ${
                            isToday
                              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                              : isCurrentMonth
                                ? "text-zinc-900 dark:text-zinc-100"
                                : "text-zinc-400 dark:text-zinc-600"
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        <div className="mt-3 flex flex-wrap gap-1 max-sm:mt-1 max-sm:justify-center max-sm:gap-0.5">
                          {examsByDate.has(dateKey) ? (
                            <span
                              className="h-2.5 w-2.5 rounded-full bg-purple-500 max-sm:h-1.5 max-sm:w-1.5"
                              title="Exam"
                            />
                          ) : null}
                          {dayRecords.slice(0, 4).map((record, index) => (
                            <span
                              key={`${record.slot_id}-${record.status}-${index}`}
                              className={`h-2.5 w-2.5 rounded-full max-sm:h-1.5 max-sm:w-1.5 ${getCalendarDotClass(
                                record.status
                              )}`}
                            />
                          ))}
                        </div>
                        {selectDaysMode && isBulkSelected ? (
                          <span className="mt-1 block text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                            Selected
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-5">
                    {weekDays.map((day) => {
                      const dateKey = formatLocalDateIso(day);
                      const dayExams = examsByDate.get(dateKey) ?? [];
                      const dayClasses = (weekClassByDate.get(dateKey) ?? []).filter(
                        ({ item }) =>
                          !dayExams.some((exam) => examAffectsSlot(exam, item))
                      );
                      const holidayReason = holidaySet.get(dateKey);
                      const isToday = dateKey === localTodayIso;

                      return (
                        <div
                          key={dateKey}
                          className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          <div
                            className={`mb-3 rounded-lg px-2 py-2 ${
                              isToday
                                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                                : "bg-zinc-50 dark:bg-zinc-950"
                            }`}
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                              {new Intl.DateTimeFormat("en-US", {
                                weekday: "short",
                              }).format(day)}
                            </p>
                            <p className="text-lg font-semibold">
                              {new Intl.DateTimeFormat("en-US", {
                                month: "short",
                                day: "numeric",
                              }).format(day)}
                            </p>
                          </div>

                          {holidayReason ? (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800 dark:border-amber-950 dark:bg-amber-950/30 dark:text-amber-200">
                              Holiday: {holidayReason}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {dayExams.map((exam) => (
                                <button
                                  key={`${dateKey}-exam-${exam.id}`}
                                  type="button"
                                  className="flex min-h-11 w-full items-start gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-left transition hover:shadow-sm dark:border-purple-950 dark:bg-purple-950/30"
                                  onClick={() => setSelectedCalendarDate(dateKey)}
                                >
                                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-purple-500" />
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium">
                                      {exam.title}
                                    </span>
                                    <span className="block text-[11px] font-medium text-purple-700 dark:text-purple-300">
                                      Exam
                                      {exam.subject_id
                                        ? ` · ${
                                            subjectStats.find(
                                              (subject) => subject.id === exam.subject_id
                                            )?.name ?? "Subject"
                                          }`
                                        : " · All subjects"}
                                    </span>
                                  </span>
                                </button>
                              ))}
                              {dayClasses.map(({ item, status, timeRange }) => (
                                <button
                                  key={`${dateKey}-${item.id}`}
                                  type="button"
                                  className={`flex min-h-11 w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition hover:shadow-sm ${getWeekStatusClass(
                                    status
                                  )}`}
                                  onClick={() => setSelectedCalendarDate(dateKey)}
                                >
                                  <span
                                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                                      status === "present"
                                        ? "bg-emerald-500"
                                        : status === "absent"
                                          ? "bg-red-500"
                                          : status === "cancelled"
                                            ? "bg-zinc-400"
                                            : "bg-zinc-300"
                                    }`}
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium">
                                      {item.subjectName}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      {timeRange}
                                    </span>
                                    <span className="block text-[11px] font-medium text-muted-foreground">
                                      {getWeekStatusLabel(status)}
                                    </span>
                                  </span>
                                </button>
                              ))}
                              {!dayExams.length && !dayClasses.length ? (
                                <p className="px-1 py-3 text-xs text-muted-foreground">
                                  No classes
                                </p>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {calendarView === "month" && selectDaysMode && selectedBulkDates.size ? (
                  <div className="sticky bottom-4 z-20 -mx-4 mt-4 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:bottom-4 sm:rounded-xl sm:border sm:shadow-md">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium">
                        {selectedBulkDates.size} day
                        {selectedBulkDates.size === 1 ? "" : "s"} selected
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                        <Button
                          type="button"
                          className="min-h-11 sm:min-h-8"
                          onClick={() => setBulkConfirmAction("absent")}
                        >
                          Mark absent
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 sm:min-h-8"
                          onClick={() => setBulkConfirmAction("present")}
                        >
                          Mark present
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="col-span-2 min-h-11 sm:min-h-8 sm:w-auto"
                          onClick={() => {
                            setSelectedBulkDates(new Set());
                            setSelectDaysMode(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

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

                    <div className="mb-4 space-y-3 rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-3 dark:border-purple-950 dark:bg-purple-950/20">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                            Exams
                          </p>
                          <p className="text-xs text-purple-700 dark:text-purple-300">
                            Exams replace affected classes and attendance records.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 w-full border-purple-300 bg-background sm:min-h-8 sm:w-auto"
                          onClick={openExamDialog}
                        >
                          Add exam
                        </Button>
                      </div>
                      {(examsByDate.get(selectedCalendarDate) ?? []).length ? (
                        <div className="space-y-2">
                          {(examsByDate.get(selectedCalendarDate) ?? []).map((exam) => (
                            <div
                              key={exam.id}
                              className="flex flex-col gap-2 rounded-lg border border-purple-200 bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-purple-900"
                            >
                              <div className="min-w-0">
                                <p className="break-words text-sm font-medium">
                                  {exam.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {exam.subject_id
                                    ? subjectStats.find(
                                        (subject) => subject.id === exam.subject_id
                                      )?.name ?? "Subject"
                                    : "All subjects"}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                className="min-h-11 w-full text-destructive sm:min-h-8 sm:w-auto"
                                onClick={() => void handleRemoveExam(exam)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No exams scheduled for this day.
                        </p>
                      )}
                    </div>

                    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between">
                      {holidaySet.has(selectedCalendarDate) ? (
                        <>
                          <p className="text-sm text-red-600 dark:text-red-400">
                            Holiday: {holidaySet.get(selectedCalendarDate)}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 w-full sm:min-h-8 sm:w-auto"
                            onClick={() => openHolidayDialog("remove")}
                          >
                            Remove holiday
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">
                            Mark this date as a holiday.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 w-full sm:min-h-8 sm:w-auto"
                            onClick={() => openHolidayDialog("add")}
                          >
                            Add holiday
                          </Button>
                        </>
                      )}
                    </div>

                    {selectedCalendarClasses.length ? (
                      <div className="space-y-3">
                        {selectedCalendarClasses.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="min-w-0 break-words text-sm font-medium text-zinc-900">
                                {item.subjectName}
                              </p>
                              <p className="min-w-0 break-words text-xs text-muted-foreground">
                                {item.subjectCode ? `${item.subjectCode} • ` : ""}
                                {item.timeRange}
                              </p>
                            </div>
                            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:flex-wrap">
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
                                  className="w-full sm:w-auto"
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
                                    className="w-full sm:w-auto"
                                    disabled={pendingCalendarSlotIds.includes(item.id)}
                                    onClick={() => void handleCalendarToggle(item.id, selectedCalendarDate!, item.status)}
                                  >
                                    {item.status === "present" ? "Mark Absent" : "Mark Present"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full sm:w-auto"
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
                    size="icon-sm"
                    variant="outline"
                    className="max-sm:min-h-11 max-sm:min-w-11"
                    aria-label="Previous month"
                    onClick={() => {
                      setAcademicMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
                      setSelectedAcademicDate(null);
                    }}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    className="max-sm:min-h-11 max-sm:min-w-11"
                    aria-label="Next month"
                    onClick={() => {
                      setAcademicMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
                      setSelectedAcademicDate(null);
                    }}
                  >
                    <ChevronRight />
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
                          "flex max-sm:min-h-11 flex-col items-center rounded-lg py-1 text-sm transition-colors",
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
          <DialogFooter
            showCloseButton
            className="max-sm:[&>button]:w-full sm:flex-row"
          >
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

      <Dialog
        open={holidayDialog !== null}
        onOpenChange={(open) => {
          if (!open && !isHolidaySaving) {
            setHolidayDialog(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {holidayDialog === "add" ? "Add holiday" : "Remove holiday"}
            </DialogTitle>
            <DialogDescription>
              {holidayDialog === "add"
                ? "Add a holiday for the selected date. Attendance records for this date will be removed."
                : `Remove the holiday for ${
                    selectedCalendarDate
                      ? formatDisplayDate(
                          new Date(`${selectedCalendarDate}T00:00:00`)
                        )
                      : "this date"
                  }?`}
            </DialogDescription>
          </DialogHeader>

          {holidayDialog === "add" ? (
            <div className="space-y-2">
              <Label htmlFor="holiday-reason">Reason</Label>
              <Input
                id="holiday-reason"
                value={holidayReason}
                onChange={(event) => setHolidayReason(event.target.value)}
                disabled={isHolidaySaving}
                autoFocus
              />
            </div>
          ) : null}

          <DialogFooter className="max-sm:[&>button]:w-full sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setHolidayDialog(null)}
              disabled={isHolidaySaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleHolidayAction()}
              disabled={isHolidaySaving}
            >
              {isHolidaySaving
                ? "Saving..."
                : holidayDialog === "add"
                  ? "Save"
                  : "Remove holiday"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={examDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isExamSaving) {
            setExamDialogOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add exam</DialogTitle>
            <DialogDescription>
              Add an exam for{" "}
              {selectedCalendarDate
                ? formatDisplayDate(new Date(`${selectedCalendarDate}T00:00:00`))
                : "the selected date"}
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exam-title">Title</Label>
              <Input
                id="exam-title"
                value={examTitle}
                onChange={(event) => setExamTitle(event.target.value)}
                disabled={isExamSaving}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-subject">Subject</Label>
              <Select
                value={examSubjectId}
                onValueChange={setExamSubjectId}
                disabled={isExamSaving}
              >
                <SelectTrigger id="exam-subject" className="w-full">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {subjectStats.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="max-sm:[&>button]:w-full sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExamDialogOpen(false)}
              disabled={isExamSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleAddExam()}
              disabled={isExamSaving}
            >
              {isExamSaving ? "Saving..." : "Save exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkConfirmAction !== null}
        onOpenChange={(open) => {
          if (!open && !isBulkSaving) {
            setBulkConfirmAction(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mark {selectedBulkDates.size} day
              {selectedBulkDates.size === 1 ? "" : "s"}{" "}
              {bulkConfirmAction === "absent" ? "absent" : "present"}?
            </DialogTitle>
            <DialogDescription>
              This will overwrite existing attendance records for eligible
              classes on the selected days. Cancelled classes will be skipped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="max-sm:[&>button]:w-full sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkConfirmAction(null)}
              disabled={isBulkSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleBulkAttendance()}
              disabled={isBulkSaving}
            >
              {isBulkSaving ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
