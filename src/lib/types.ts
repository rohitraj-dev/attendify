export interface Semester {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
}

export interface Holiday {
  id: string;
  semester_id: string;
  date: string;
  reason: string;
}

export interface Exam {
  id: string;
  semester_id: string;
  subject_id: string | null;
  date: string;
  title: string;
  created_at: string;
}

export interface Subject {
  id: string;
  semester_id: string;
  name: string;
  code: string;
  min_attendance_percent: number;
  pass_percent: number;
}

export type MarkComponent = "quiz1" | "midsem" | "quiz2" | "endsem";

export interface Mark {
  id: string;
  subject_id: string;
  component: MarkComponent;
  marks_obtained: number | null;
  max_marks: number;
  created_at: string;
}

export interface ScheduleSlot {
  id: string;
  subject_id: string;
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  start_time: string;
  end_time: string;
}

export type DayOverrideType = "cancelled" | "rescheduled";

export interface DayOverride {
  id: string;
  slot_id: string;
  date: string;
  type: DayOverrideType;
  new_time?: string | null;
}

export type AttendanceStatus = "present" | "absent" | "cancelled";
export type AttendanceMarkedBy = "auto" | "manual";

export interface AttendanceRecord {
  id: string;
  slot_id: string;
  date: string;
  status: AttendanceStatus;
  marked_by: AttendanceMarkedBy;
}
