-- 1. Enable Row Level Security on all tables
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing policies to prevent conflicts
DROP POLICY IF EXISTS "authenticated users manage own semesters" ON semesters;
DROP POLICY IF EXISTS "authenticated users manage own holidays" ON holidays;
DROP POLICY IF EXISTS "authenticated users manage own subjects" ON subjects;
DROP POLICY IF EXISTS "authenticated users manage own schedule slots" ON schedule_slots;
DROP POLICY IF EXISTS "authenticated users manage own day overrides" ON day_overrides;
DROP POLICY IF EXISTS "authenticated users manage own attendance records" ON attendance_records;

DROP POLICY IF EXISTS "Users own semesters" ON semesters;
DROP POLICY IF EXISTS "Users own holidays" ON holidays;
DROP POLICY IF EXISTS "Users own subjects" ON subjects;
DROP POLICY IF EXISTS "Users own slots" ON schedule_slots;
DROP POLICY IF EXISTS "Users own overrides" ON day_overrides;
DROP POLICY IF EXISTS "Users own attendance" ON attendance_records;

-- 3. Create RLS policies for phase 2

-- semesters: user owns rows by user_id
CREATE POLICY "Users own semesters" ON semesters
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- holidays: user owns via semester
CREATE POLICY "Users own holidays" ON holidays
  FOR ALL USING (
    semester_id IN (SELECT id FROM semesters WHERE user_id = auth.uid())
  ) WITH CHECK (
    semester_id IN (SELECT id FROM semesters WHERE user_id = auth.uid())
  );

-- subjects: user owns via semester
CREATE POLICY "Users own subjects" ON subjects
  FOR ALL USING (
    semester_id IN (SELECT id FROM semesters WHERE user_id = auth.uid())
  ) WITH CHECK (
    semester_id IN (SELECT id FROM semesters WHERE user_id = auth.uid())
  );

-- schedule_slots: user owns via subject → semester
CREATE POLICY "Users own slots" ON schedule_slots
  FOR ALL USING (
    subject_id IN (
      SELECT s.id FROM subjects s
      JOIN semesters sem ON s.semester_id = sem.id
      WHERE sem.user_id = auth.uid()
    )
  ) WITH CHECK (
    subject_id IN (
      SELECT s.id FROM subjects s
      JOIN semesters sem ON s.semester_id = sem.id
      WHERE sem.user_id = auth.uid()
    )
  );

-- day_overrides: user owns via slot → subject → semester
CREATE POLICY "Users own overrides" ON day_overrides
  FOR ALL USING (
    slot_id IN (
      SELECT ss.id FROM schedule_slots ss
      JOIN subjects s ON ss.subject_id = s.id
      JOIN semesters sem ON s.semester_id = sem.id
      WHERE sem.user_id = auth.uid()
    )
  ) WITH CHECK (
    slot_id IN (
      SELECT ss.id FROM schedule_slots ss
      JOIN subjects s ON ss.subject_id = s.id
      JOIN semesters sem ON s.semester_id = sem.id
      WHERE sem.user_id = auth.uid()
    )
  );

-- attendance_records: same chain as day_overrides
CREATE POLICY "Users own attendance" ON attendance_records
  FOR ALL USING (
    slot_id IN (
      SELECT ss.id FROM schedule_slots ss
      JOIN subjects s ON ss.subject_id = s.id
      JOIN semesters sem ON s.semester_id = sem.id
      WHERE sem.user_id = auth.uid()
    )
  ) WITH CHECK (
    slot_id IN (
      SELECT ss.id FROM schedule_slots ss
      JOIN subjects s ON ss.subject_id = s.id
      JOIN semesters sem ON s.semester_id = sem.id
      WHERE sem.user_id = auth.uid()
    )
  );
