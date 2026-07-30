"use client";

import Link from "next/link";
import { useState } from "react";
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

const TOTAL_STEPS = 4;

const stepLabels = [
  "Create Semester",
  "Upload Timetable Photo",
  "Upload Holiday List",
  "Done",
];

export default function SetupPage() {
  const supabase = createBrowserSupabaseClient();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSavingSemester, setIsSavingSemester] = useState(false);
  const [isSavingHolidays, setIsSavingHolidays] = useState(false);

  const [semesterName, setSemesterName] = useState("");
  const [semesterStartDate, setSemesterStartDate] = useState("");
  const [semesterEndDate, setSemesterEndDate] = useState("");
  const [savedSemester, setSavedSemester] = useState<SemesterInsert | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [holidayDate, setHolidayDate] = useState("");
  const [holidayReason, setHolidayReason] = useState("");
  const [holidays, setHolidays] = useState<DraftHoliday[]>([]);

  const progressValue = (currentStep / TOTAL_STEPS) * 100;

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
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(nextPreviewUrl);
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
      const { error } = await supabase.from("holidays").insert(
        holidays.map((holiday) => ({
          semester_id: savedSemester.id,
          date: holiday.date,
          reason: holiday.reason,
        }))
      );

      if (error) {
        throw error;
      }

      setCurrentStep(4);
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
    <div className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-950">
      <Toaster />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-500">Attendify Setup</p>
              <h1 className="text-3xl font-semibold tracking-tight">
                Setup wizard
              </h1>
            </div>
            <Badge variant="outline">
              Step {currentStep} of {TOTAL_STEPS}
            </Badge>
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
                      ? "border-zinc-900 bg-white"
                      : isComplete
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-zinc-200 bg-white/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Step {stepNumber}</span>
                    <Badge variant={isActive ? "default" : "outline"}>
                      {isComplete ? "Done" : isActive ? "Current" : "Pending"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">{label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {currentStep === 1 && (
          <Card className="bg-white">
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
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Upload Timetable Photo</CardTitle>
              <CardDescription>
                Upload a photo now. OCR parsing will be added next.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="timetable-photo">Timetable image</Label>
                <Input
                  id="timetable-photo"
                  type="file"
                  accept="image/*"
                  onChange={handleTimetableUpload}
                />
              </div>

              {previewUrl ? (
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Timetable preview"
                    className="max-h-[420px] w-full object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-sm text-zinc-500">
                  Upload an image to preview it here.
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!previewUrl}
                  onClick={() => toast.info("OCR coming soon")}
                >
                  Parse Timetable
                </Button>
                <Button type="button" onClick={() => setCurrentStep(3)}>
                  Continue
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}

        {currentStep === 3 && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Upload Holiday List</CardTitle>
              <CardDescription>
                Add holidays one by one, then save them to your semester.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                onSubmit={handleAddHoliday}
                className="grid gap-4 rounded-xl border border-zinc-200 p-4 sm:grid-cols-[1fr_1.4fr_auto]"
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
                        className="flex flex-col justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center"
                      >
                        <div>
                          <p className="font-medium">{holiday.reason}</p>
                          <p className="text-sm text-zinc-500">{holiday.date}</p>
                        </div>
                        <Badge variant="secondary">Holiday</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                    No holidays added yet.
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Back
              </Button>
              <Button onClick={handleSaveHolidays} disabled={isSavingHolidays}>
                {isSavingHolidays ? "Saving..." : "Save Holidays"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {currentStep === 4 && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Done</CardTitle>
              <CardDescription>
                Your initial Attendify setup is ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-500">Semester</p>
                <p className="mt-1 font-medium">
                  {savedSemester?.name ?? semesterName}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-500">Date range</p>
                <p className="mt-1 font-medium">
                  {(savedSemester?.start_date ?? semesterStartDate) || "-"} to{" "}
                  {(savedSemester?.end_date ?? semesterEndDate) || "-"}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-500">Holidays</p>
                <p className="mt-1 font-medium">{holidays.length}</p>
              </div>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
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
