import type { MarkComponent } from "@/lib/types";

export const MARK_COMPONENTS: Array<{
  component: MarkComponent;
  label: string;
  maxMarks: number;
}> = [
  { component: "quiz1", label: "Quiz 1", maxMarks: 10 },
  { component: "midsem", label: "Midsem", maxMarks: 25 },
  { component: "quiz2", label: "Quiz 2", maxMarks: 10 },
  { component: "endsem", label: "Endsem", maxMarks: 50 },
  { component: "teacher", label: "Teacher", maxMarks: 5 },
];

export const TOTAL_MARKS = MARK_COMPONENTS.reduce(
  (total, component) => total + component.maxMarks,
  0
);

export type MarkSummary = {
  totalObtained: number;
  maxTakenMarks: number;
  remainingMarks: number;
  passMarks: number;
  neededMarks: number;
  status: "passed" | "cannot-pass" | "needs-marks";
};

export function calculateMarkSummary(
  obtainedMarks: Partial<Record<MarkComponent, number | null>>,
  passPercent: number
): MarkSummary {
  const totalObtained = MARK_COMPONENTS.reduce((total, { component, maxMarks }) => {
    const obtained = obtainedMarks[component];
    return total +
      (obtained !== null &&
      obtained !== undefined &&
      Number.isFinite(obtained) &&
      obtained >= 0 &&
      obtained <= maxMarks
        ? obtained
        : 0);
  }, 0);
  const maxTakenMarks = MARK_COMPONENTS.reduce(
    (total, { component, maxMarks }) =>
      total +
      (obtainedMarks[component] !== null &&
      obtainedMarks[component] !== undefined &&
      Number.isFinite(obtainedMarks[component]) &&
      obtainedMarks[component] >= 0 &&
      obtainedMarks[component] <= maxMarks
        ? maxMarks
        : 0),
    0
  );
  const remainingMarks = TOTAL_MARKS - maxTakenMarks;
  const passMarks = (Number.isFinite(passPercent) ? passPercent : 0) * (TOTAL_MARKS / 100);
  const neededMarks = Math.max(0, passMarks - totalObtained);

  return {
    totalObtained,
    maxTakenMarks,
    remainingMarks,
    passMarks,
    neededMarks,
    status:
      neededMarks > remainingMarks
        ? "cannot-pass"
        : neededMarks === 0
          ? "passed"
          : "needs-marks",
  };
}
