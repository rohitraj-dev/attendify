"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, Trash2, Upload, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { Holiday } from "@/lib/types";

interface HolidayManagerProps {
  semesterId: string;
}

interface ParsedHolidayItem {
  id: string;
  date: string;
  reason: string;
  checked: boolean;
}

export function HolidayManager({ semesterId }: HolidayManagerProps) {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Saved holidays state
  const [savedHolidays, setSavedHolidays] = useState<Holiday[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(true);

  // Manual input state
  const [manualDate, setManualDate] = useState<string>("");
  const [manualReason, setManualReason] = useState<string>("");
  const [isAddingManual, setIsAddingManual] = useState<boolean>(false);

  // Import/Parse state
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsedHolidays, setParsedHolidays] = useState<ParsedHolidayItem[]>([]);
  const [isSavingParsed, setIsSavingParsed] = useState<boolean>(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch saved holidays from Supabase
  const refreshSavedHolidays = useCallback(async () => {
    if (!semesterId) return;
    try {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .eq("semester_id", semesterId)
        .order("date", { ascending: true });

      if (error) {
        throw error;
      }
      setSavedHolidays(data || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load saved holidays";
      toast.error(message);
    } finally {
      setIsLoadingSaved(false);
    }
  }, [semesterId, supabase]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialHolidays() {
      if (!semesterId) {
        setIsLoadingSaved(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("holidays")
          .select("*")
          .eq("semester_id", semesterId)
          .order("date", { ascending: true });

        if (error) throw error;
        if (isMounted) {
          setSavedHolidays(data || []);
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error ? error.message : "Failed to load saved holidays";
          toast.error(message);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSaved(false);
        }
      }
    }

    void loadInitialHolidays();

    return () => {
      isMounted = false;
    };
  }, [semesterId, supabase]);

  // Handle File Upload & Parsing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-holidays", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as
        | { success: true; holidays: Array<{ date: string; reason: string }> }
        | { success: false; error: string };

      if (!res.ok || !data.success) {
        throw new Error(
          data.success ? "Failed to parse holidays file" : data.error
        );
      }

      if (!data.holidays || data.holidays.length === 0) {
        toast.error("No valid holidays were found in the uploaded file");
        setParsedHolidays([]);
      } else {
        const items: ParsedHolidayItem[] = data.holidays.map((h) => ({
          id: crypto.randomUUID(),
          date: h.date,
          reason: h.reason,
          checked: true, // all checked by default
        }));
        setParsedHolidays(items);
        toast.success(`Successfully parsed ${items.length} holiday(s)`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to parse holidays file";
      toast.error(message);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Toggle single parsed holiday item
  const toggleParsedItem = (id: string) => {
    setParsedHolidays((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  // Toggle all parsed holiday items
  const toggleSelectAllParsed = () => {
    const allChecked = parsedHolidays.every((item) => item.checked);
    setParsedHolidays((prev) =>
      prev.map((item) => ({ ...item, checked: !allChecked }))
    );
  };

  // Save selected parsed holidays to Supabase
  const handleSaveSelectedParsed = async () => {
    const selected = parsedHolidays.filter((item) => item.checked);

    if (selected.length === 0) {
      toast.error("Please select at least one holiday to save");
      return;
    }

    if (!semesterId) {
      toast.error("Invalid semester ID");
      return;
    }

    setIsSavingParsed(true);
    try {
      const payload = selected.map((item) => ({
        semester_id: semesterId,
        date: item.date,
        reason: item.reason,
      }));

      const { error } = await supabase.from("holidays").upsert(payload, {
        onConflict: "semester_id,date",
      });

      if (error) {
        throw error;
      }

      toast.success(`Saved ${selected.length} holiday(s) successfully`);
      setParsedHolidays([]);
      await refreshSavedHolidays();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save selected holidays";
      toast.error(message);
    } finally {
      setIsSavingParsed(false);
    }
  };

  // Save manual holiday to Supabase
  const handleAddManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!manualDate || !manualReason.trim()) {
      toast.error("Please enter both a date and a reason");
      return;
    }

    if (!semesterId) {
      toast.error("Invalid semester ID");
      return;
    }

    setIsAddingManual(true);
    try {
      const { error } = await supabase.from("holidays").upsert(
        {
          semester_id: semesterId,
          date: manualDate,
          reason: manualReason.trim(),
        },
        { onConflict: "semester_id,date" }
      );

      if (error) {
        throw error;
      }

      toast.success("Holiday added successfully");
      setManualDate("");
      setManualReason("");
      await refreshSavedHolidays();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add holiday";
      toast.error(message);
    } finally {
      setIsAddingManual(false);
    }
  };

  // Delete saved holiday from Supabase
  const handleDeleteHoliday = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("holidays").delete().eq("id", id);

      if (error) {
        throw error;
      }

      toast.success("Holiday deleted successfully");
      await refreshSavedHolidays();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete holiday";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Holiday Manager
            </CardTitle>
            <CardDescription className="mt-1">
              Manage your semester holidays by importing notice files or adding them manually.
            </CardDescription>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isParsing}
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto"
            >
              {isParsing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import from file
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Parsed Results Checklist */}
        {parsedHolidays.length > 0 && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant="default">Parsed Results</Badge>
                <span className="text-xs text-muted-foreground">
                  {parsedHolidays.filter((item) => item.checked).length} of{" "}
                  {parsedHolidays.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={toggleSelectAllParsed}
                  className="text-xs"
                >
                  {parsedHolidays.every((item) => item.checked)
                    ? "Deselect All"
                    : "Select All"}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  disabled={isSavingParsed}
                  onClick={() => void handleSaveSelectedParsed()}
                >
                  {isSavingParsed ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Selected"
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {parsedHolidays.map((item) => (
                <label
                  key={item.id}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleParsedItem(item.id);
                  }}
                  className={`flex items-center justify-between p-3 rounded-lg border text-sm cursor-pointer transition-colors ${
                    item.checked
                      ? "border-primary/40 bg-background"
                      : "border-border/60 bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      readOnly
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="font-medium text-foreground">
                        {item.reason}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {item.date}
                  </Badge>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Manual Single Holiday Form */}
        <form onSubmit={handleAddManual} className="space-y-3">
          <Label className="text-sm font-medium">Add Manual Holiday</Label>
          <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
            <div>
              <Input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                type="text"
                placeholder="Reason (e.g. Independence Day)"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isAddingManual}>
              {isAddingManual ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Saved Holidays List at Bottom */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Saved Holidays</Label>
            <Badge variant="secondary">{savedHolidays.length} Total</Badge>
          </div>

          {isLoadingSaved ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
              <span>Loading holidays...</span>
            </div>
          ) : savedHolidays.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No holidays added yet for this semester.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {savedHolidays.map((holiday) => (
                <div
                  key={holiday.id}
                  className="flex items-center justify-between rounded-lg border p-3 bg-card hover:bg-muted/40 transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm text-foreground">
                      {holiday.reason}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground">
                      {holiday.date}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={deletingId === holiday.id}
                    onClick={() => void handleDeleteHoliday(holiday.id)}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Delete holiday"
                  >
                    {deletingId === holiday.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span className="sr-only">Delete holiday</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
