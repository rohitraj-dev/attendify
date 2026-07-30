import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type SeedResult =
  | { success: true }
  | { success: false; error: string };

export async function seedTestData(): Promise<SeedResult> {
  const supabase = createBrowserSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  try {
    const { data: semester, error: semesterError } = await supabase
      .from("semesters")
      .select("id")
      .lte("start_date", today)
      .gte("end_date", today)
      .limit(1)
      .maybeSingle();

    if (semesterError) {
      throw semesterError;
    }

    if (!semester) {
      return { success: false, error: "No active semester found" };
    }

    const { data: subjects, error: subjectsError } = await supabase
      .from("subjects")
      .insert([
        {
          name: "Mathematics",
          code: "MATH101",
          min_attendance_percent: 75,
          semester_id: semester.id,
        },
        {
          name: "Physics",
          code: "PHY101",
          min_attendance_percent: 75,
          semester_id: semester.id,
        },
        {
          name: "Computer Science",
          code: "CS101",
          min_attendance_percent: 75,
          semester_id: semester.id,
        },
      ])
      .select("id, code");

    if (subjectsError) {
      throw subjectsError;
    }

    const subjectIdByCode = new Map(
      (subjects ?? []).map((subject) => [subject.code, subject.id])
    );

    const { error: slotsError } = await supabase.from("schedule_slots").insert([
      {
        subject_id: subjectIdByCode.get("MATH101"),
        day_of_week: 4,
        start_time: "09:00",
        end_time: "10:00",
      },
      {
        subject_id: subjectIdByCode.get("PHY101"),
        day_of_week: 4,
        start_time: "10:00",
        end_time: "11:00",
      },
      {
        subject_id: subjectIdByCode.get("CS101"),
        day_of_week: 4,
        start_time: "11:00",
        end_time: "12:00",
      },
    ]);

    if (slotsError) {
      throw slotsError;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to seed test data",
    };
  }
}
