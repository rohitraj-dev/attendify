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

export interface Subject {
  id: string;
  semester_id: string;
  name: string;
  code: string;
  min_attendance_percent: number;
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
