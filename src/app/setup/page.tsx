"use client";

import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type SemesterInsert = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

type DraftHoliday = {
  id: string;
  date: string;
  reason: string;
};

type ParsedSlot = {
  id: string;
  subject_code: string;
  teacher: string;
  room: string;
  day: number;
  start_time: string;
  end_time: string;
  checked: boolean;
};

const TOTAL_STEPS = 5;

const stepLabels = [
  "Create Semester",
  "Select Branch",
  "Upload Timetable",
  "Upload Holiday List",
  "Done",
];

const dayLabels = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const branches = ["BBA", "BCA", "BSc AIML", "BSc M&C"] as const;
const THEME_STORAGE_KEY = "attendify-theme";

export default function SetupPage() {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [isSavingSemester, setIsSavingSemester] = useState(false);
  const [isParsingTimetable, setIsParsingTimetable] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isSavingHolidays, setIsSavingHolidays] = useState(false);

  const [semesterName, setSemesterName] = useState("");
  const [semesterStartDate, setSemesterStartDate] = useState("");
  const [semesterEndDate, setSemesterEndDate] = useState("");
  const [savedSemester, setSavedSemester] = useState<SemesterInsert | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<(typeof branches)[number] | null>(null);

  const [timetableFile, setTimetableFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [parsedSlots, setParsedSlots] = useState<ParsedSlot[]>([]);

  const [holidayDate, setHolidayDate] = useState("");
  const [holidayReason, setHolidayReason] = useState("");
  const [holidays, setHolidays] = useState<DraftHoliday[]>([]);

  const progressValue = (currentStep / TOTAL_STEPS) * 100;

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const shouldUseDark = savedTheme === "dark";

    document.documentElement.classList.toggle("dark", shouldUseDark);

    const frameId = window.requestAnimationFrame(() => {
      setIsDarkMode(shouldUseDark);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

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

  async function handleSemesterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingSemester(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("semesters")
        .insert({
          name: semesterName,
          start_date: semesterStartDate,
          end_date: semesterEndDate,
          user_id: user?.id ?? "00000000-0000-0000-0000-000000000001",
        })
        .select("id, name, start_date, end_date")
        .single();

      if (error) {
        throw error;
      }

      setSavedSemester(data);
      setCurrentStep(2);
      toast.success("Semester created");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create semester";
      toast.error(message);
    } finally {
      setIsSavingSemester(false);
    }
  }

  function handleTimetableUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setTimetableFile(null);
      setPreviewUrl(null);
      setParsedSlots([]);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setTimetableFile(file);
    setPreviewUrl(nextPreviewUrl);
    setParsedSlots([]);
  }

  async function handleParseTimetable() {
    if (!timetableFile) {
      toast.error("Select a timetable image first");
      return;
    }

    setIsParsingTimetable(true);

    try {
      const formData = new FormData();
      formData.append("image", timetableFile);
      formData.append("branch", selectedBranch ?? "");

      const response = await fetch("/api/parse-timetable", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as
        | {
            success: true;
            slots: Array<{
              subject_code: string;
              teacher: string;
              room: string;
              day: number;
              start_time: string;
              end_time: string;
            }>;
          }
        | { success: false; error: string };

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success ? "Failed to parse timetable" : payload.error
        );
      }

      setParsedSlots(
        payload.slots.map((slot) => ({
          id: crypto.randomUUID(),
          subject_code: slot.subject_code,
          teacher: slot.teacher,
          room: slot.room,
          day: slot.day,
          start_time: slot.start_time,
          end_time: slot.end_time,
          checked: true,
        }))
      );
      toast.success("Timetable parsed");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to parse timetable";
      toast.error(message);
    } finally {
      setIsParsingTimetable(false);
    }
  }

  function handleToggleParsedSlot(slotId: string) {
    setParsedSlots((current) =>
      current.map((slot) =>
        slot.id === slotId ? { ...slot, checked: !slot.checked } : slot
      )
    );
  }

  async function handleSaveSchedule() {
    if (!savedSemester?.id) {
      toast.error("Create a semester first");
      return;
    }

    const selectedSlots = parsedSlots.filter((slot) => slot.checked);

    if (!selectedSlots.length) {
      toast.error("Select at least one parsed slot");
      return;
    }

    setIsSavingSchedule(true);

    try {
      for (const slot of selectedSlots) {
        const { data: subject, error: subjectError } = await supabase
          .from("subjects")
          .upsert(
            {
              name: slot.subject_code,
              code: slot.subject_code,
              min_attendance_percent: 75,
              semester_id: savedSemester.id,
            },
            { onConflict: "semester_id,code" }
          )
          .select("id")
          .single();

        if (subjectError) {
          throw subjectError;
        }

        const { error: slotError } = await supabase.from("schedule_slots").insert({
          subject_id: subject.id,
          day_of_week: slot.day,
          start_time: slot.start_time,
          end_time: slot.end_time,
        });

        if (slotError) {
          throw slotError;
        }
      }

      toast.success("Schedule saved");
      setCurrentStep(4);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save schedule";
      toast.error(message);
    } finally {
      setIsSavingSchedule(false);
    }
  }

  function handleAddHoliday(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!holidayDate || !holidayReason.trim()) {
      toast.error("Add both holiday date and reason");
      return;
    }

    setHolidays((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        date: holidayDate,
        reason: holidayReason.trim(),
      },
    ]);
    setHolidayDate("");
    setHolidayReason("");
  }

  async function handleSaveHolidays() {
    if (!savedSemester?.id) {
      toast.error("Create a semester first");
      return;
    }

    if (!holidays.length) {
      toast.error("Add at least one holiday");
      return;
    }

    setIsSavingHolidays(true);

    try {
      const { error } = await supabase.from("holidays").upsert(
        holidays.map((holiday) => ({
          semester_id: savedSemester.id,
          date: holiday.date,
          reason: holiday.reason,
        })),
        { onConflict: "semester_id,date", ignoreDuplicates: true }
      );

      if (error) {
        throw error;
      }

      setCurrentStep(5);
      toast.success("Holidays saved");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save holidays";
      toast.error(message);
    } finally {
      setIsSavingHolidays(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <Toaster />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Attendify Setup
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                Setup wizard
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Step {currentStep} of {TOTAL_STEPS}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleThemeToggle}
              >
                {isDarkMode ? <Sun /> : <Moon />}
                <span className="sr-only">Toggle theme</span>
              </Button>
            </div>
          </div>

          <Progress value={progressValue} className="h-2" />

          <div className="grid gap-2 sm:grid-cols-4">
            {stepLabels.map((label, index) => {
              const stepNumber = index + 1;
              const isActive = stepNumber === currentStep;
              const isComplete = stepNumber < currentStep;

              return (
                <div
                  key={label}
                  className={`rounded-xl border p-3 ${
                    isActive
                      ? "border-zinc-900 bg-white dark:border-zinc-100 dark:bg-zinc-900"
                      : isComplete
                        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-950 dark:bg-emerald-950/20"
                        : "border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Step {stepNumber}</span>
                    <Badge variant={isActive ? "default" : "outline"}>
                      {isComplete ? "Done" : isActive ? "Current" : "Pending"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Create Semester</CardTitle>
              <CardDescription>
                Start by saving your semester details.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSemesterSubmit}>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="semester-name">Semester name</Label>
                  <Input
                    id="semester-name"
                    value={semesterName}
                    onChange={(event) => setSemesterName(event.target.value)}
                    placeholder="Semester 5"
                    required
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={semesterStartDate}
                      onChange={(event) => setSemesterStartDate(event.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end-date">End date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={semesterEndDate}
                      onChange={(event) => setSemesterEndDate(event.target.value)}
                      required
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                <Button type="submit" disabled={isSavingSemester}>
                  {isSavingSemester ? "Saving..." : "Save semester"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Branch</CardTitle>
              <CardDescription>
                Choose the branch to extract from the timetable image.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {branches.map((branch) => {
                const isSelected = selectedBranch === branch;

                return (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => setSelectedBranch(branch)}
                    className={`rounded-xl border p-5 text-left transition-colors ${
                      isSelected
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <p className="text-base font-semibold">{branch}</p>
                    <p
                      className={`mt-1 text-sm ${
                        isSelected ? "text-zinc-200" : "text-muted-foreground"
                      }`}
                    >
                      Extract only classes for {branch}.
                    </p>
                  </button>
                );
              })}
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button
                type="button"
                disabled={!selectedBranch}
                onClick={() => setCurrentStep(3)}
              >
                Continue
              </Button>
            </CardFooter>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Timetable</CardTitle>
              <CardDescription>
                Upload a timetable photo, parse it, then save the detected slots.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="timetable-photo">Timetable image</Label>
                <Input
                  id="timetable-photo"
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={handleTimetableUpload}
                />
              </div>

              {previewUrl ? (
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Timetable preview"
                    className="max-h-[420px] w-full object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-sm text-muted-foreground dark:border-zinc-700 dark:bg-zinc-900">
                  Upload an image to preview it here.
                </div>
              )}

              {parsedSlots.length ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium">Parsed slots</h2>
                    <Badge variant="outline">
                      {parsedSlots.filter((slot) => slot.checked).length} selected
                    </Badge>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                        <tr>
                          <th className="px-4 py-3 font-medium">Use</th>
                          <th className="px-4 py-3 font-medium">Subject</th>
                          <th className="px-4 py-3 font-medium">Code</th>
                          <th className="px-4 py-3 font-medium">Day</th>
                          <th className="px-4 py-3 font-medium">Start</th>
                          <th className="px-4 py-3 font-medium">End</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedSlots.map((slot) => (
                          <tr
                            key={slot.id}
                            className="border-t border-zinc-200 dark:border-zinc-800"
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={slot.checked}
                                onChange={() => handleToggleParsedSlot(slot.id)}
                                className="h-4 w-4 rounded border-zinc-300"
                              />
                            </td>
                            <td className="px-4 py-3">{slot.subject_code}</td>
                            <td className="px-4 py-3">{slot.subject_code}</td>
                            <td className="px-4 py-3">
                              {dayLabels[slot.day - 1] ?? `Day ${slot.day}`}
                            </td>
                            <td className="px-4 py-3">{slot.start_time}</td>
                            <td className="px-4 py-3">{slot.end_time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Back
              </Button>
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(4)}
                >
                  Skip
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!previewUrl || isParsingTimetable}
                  onClick={() => void handleParseTimetable()}
                >
                  {isParsingTimetable ? "Parsing..." : "Parse Timetable"}
                </Button>
                <Button
                  type="button"
                  disabled={!parsedSlots.length || isSavingSchedule}
                  onClick={() => void handleSaveSchedule()}
                >
                  {isSavingSchedule ? "Saving..." : "Save Schedule"}
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}

        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Holiday List</CardTitle>
              <CardDescription>
                Add holidays one by one, then save them to your semester.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                onSubmit={handleAddHoliday}
                className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-[1fr_1.4fr_auto]"
              >
                <div className="space-y-2">
                  <Label htmlFor="holiday-date">Date</Label>
                  <Input
                    id="holiday-date"
                    type="date"
                    value={holidayDate}
                    onChange={(event) => setHolidayDate(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="holiday-reason">Reason</Label>
                  <Input
                    id="holiday-reason"
                    value={holidayReason}
                    onChange={(event) => setHolidayReason(event.target.value)}
                    placeholder="Festival / college event"
                    required
                  />
                </div>

                <div className="flex items-end">
                  <Button type="submit" className="w-full sm:w-auto">
                    Add holiday
                  </Button>
                </div>
              </form>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium">Added holidays</h2>
                  <Badge variant="outline">{holidays.length} total</Badge>
                </div>

                {holidays.length ? (
                  <div className="space-y-3">
                    {holidays.map((holiday) => (
                      <div
                        key={holiday.id}
                        className="flex flex-col justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center"
                      >
                        <div>
                          <p className="font-medium">{holiday.reason}</p>
                          <p className="text-sm text-muted-foreground">
                            {holiday.date}
                          </p>
                        </div>
                        <Badge variant="secondary">Holiday</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-muted-foreground dark:border-zinc-700 dark:bg-zinc-900">
                    No holidays added yet.
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
                Back
              </Button>
              <Button onClick={handleSaveHolidays} disabled={isSavingHolidays}>
                {isSavingHolidays ? "Saving..." : "Save Holidays"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {currentStep === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Done</CardTitle>
              <CardDescription>
                Your initial Attendify setup is ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-muted-foreground">Semester</p>
                <p className="mt-1 font-medium">
                  {savedSemester?.name ?? semesterName}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-muted-foreground">Date range</p>
                <p className="mt-1 font-medium">
                  {(savedSemester?.start_date ?? semesterStartDate) || "-"} to{" "}
                  {(savedSemester?.end_date ?? semesterEndDate) || "-"}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-muted-foreground">Branch</p>
                <p className="mt-1 font-medium">{selectedBranch ?? "-"}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-muted-foreground">Holidays</p>
                <p className="mt-1 font-medium">{holidays.length}</p>
              </div>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(4)}>
                Back
              </Button>
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
