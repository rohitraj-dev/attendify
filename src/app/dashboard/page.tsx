"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
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
  subject_code?: string;
  subjects:
    | {
        name: string;
        code: string;
      }
    | {
        name: string;
        code: string;
      }[];
};

type AttendanceRow = {
  slot_id: string;
  status: AttendanceStatus;
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

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export default function DashboardPage() {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const hasAutoMarked = useRef(false);
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [overrides, setOverrides] = useState<Record<string, DayOverride>>({});
  const [activeSemester, setActiveSemester] = useState<ActiveSemester | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSlotIds, setPendingSlotIds] = useState<string[]>([]);
  const [rescheduleSlotId, setRescheduleSlotId] = useState<string | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState("");

  const today = new Date();
  const todayDayOfWeek = today.getDay();
  const todayIso = today.toISOString().split("T")[0];
  const headerDate = formatDisplayDate(today);

  useEffect(() => {
    async function autoMarkPastSlots(
      slots: SlotRow[],
      overrideMap: Record<string, DayOverride>
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

        const effectiveStart = override?.type === "rescheduled" && override.new_time
          ? override.new_time
          : slot.start_time;
        const duration = Math.max(
          timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time),
          0
        );
        const effectiveEndMinutes = timeToMinutes(effectiveStart) + duration;

        return currentMinutes > effectiveEndMinutes;
      });

      if (!pastSlots.length) {
        return;
      }

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

      if (!slotsToInsert.length) {
        return;
      }

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
          setOverrides({});
          return;
        }

        setActiveSemester(semester);

        const { data: slotRows, error: slotsError } = await supabase
          .from("schedule_slots")
          .select("*, subjects(name, code)")
          .eq("day_of_week", todayDayOfWeek)
          .eq("subjects.semester_id", semester.id)
          .order("start_time", { ascending: true });

        if (slotsError) {
          throw slotsError;
        }

        const typedSlots = (slotRows ?? []) as SlotRow[];

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

        await autoMarkPastSlots(typedSlots, overrideMap);

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
            ? { ...item, overrideType: "cancelled", status: null, displayTime: undefined }
            : item
        )
      );
      toast.success("Class cancelled");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel class"
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reschedule class"
      );
    } finally {
      setPendingSlotIds((current) => current.filter((id) => id !== slotId));
    }
  }

  async function handleRemoveOverride(slotId: string) {
    const targetClass = classes.find((item) => item.id === slotId);
    const currentOverride = overrides[slotId];

    if (!targetClass || !currentOverride) {
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove override"
      );
    } finally {
      setPendingSlotIds((current) => current.filter((id) => id !== slotId));
    }
  }

  const selectedRescheduleClass = classes.find(
    (item) => item.id === rescheduleSlotId
  );

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

              return (
                <Card key={slot.id} className="bg-white">
                  <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle
                        className={
                          slot.overrideType === "cancelled" ? "line-through text-zinc-400" : ""
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
                          : "text-zinc-600"
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
          <Card className="bg-white">
            <CardContent className="pt-6">
              <p className="text-sm text-zinc-600">No classes today</p>
            </CardContent>
          </Card>
        )}
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
              Pick a new start time for {selectedRescheduleClass?.subjectName ?? "this class"}.
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
