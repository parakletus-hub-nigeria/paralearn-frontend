"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateReportCardCategoryMutation,
  type ReportCardOptions,
} from "@cbt/store/cbtMicroserviceApi";

export const reportCardErrorMessage = (err: any, fallback: string) =>
  err?.data?.message || err?.message || fallback;

export const selectClass =
  "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border-fine)] bg-white px-2 text-sm disabled:opacity-60";
export const labelClass =
  "text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]";

/** Where an exam's scores go on report cards */
export interface ReportCardSelection {
  classIds: string[];
  subjectId: string;
  categoryId: string;
  session: string;
  term: string;
}

export const emptySelection = (): ReportCardSelection => ({
  classIds: [],
  subjectId: "",
  categoryId: "",
  session: "",
  term: "",
});

/** Subjects taken by every chosen class */
export function sharedSubjects(options: ReportCardOptions | undefined, classIds: string[]) {
  const chosen = options?.classes.filter((c) => classIds.includes(c.id)) ?? [];
  if (chosen.length === 0) return [];
  return chosen[0].subjects.filter((s) =>
    chosen.every((c) => c.subjects.some((cs) => cs.id === s.id)),
  );
}

/** Every choice made and valid, so the exam can be linked */
export function isSelectionComplete(options: ReportCardOptions | undefined, v: ReportCardSelection) {
  return (
    !!options &&
    v.classIds.length > 0 &&
    sharedSubjects(options, v.classIds).some((s) => s.id === v.subjectId) &&
    options.categories.some((c) => c.id === v.categoryId) &&
    (options.periods.find((p) => p.session === v.session)?.terms ?? []).includes(v.term)
  );
}

/**
 * Plain-language reasons the school's ParaLearn set-up stops an exam from being
 * linked, each saying who can fix it and where.
 */
export function setupProblems(options: ReportCardOptions, forReportCard: boolean): string[] {
  const admin = options.tier === "ADMIN";
  const problems: string[] = [];
  if (options.classes.length === 0) {
    problems.push(
      admin
        ? "No classes have subjects in ParaLearn yet. Add subjects to your classes in ParaLearn → Subjects."
        : "You aren't assigned to any classes with subjects in ParaLearn yet. Ask your school admin to assign you to your classes.",
    );
  }
  if (!forReportCard) return problems;
  if (options.periods.every((p) => p.terms.length === 0)) {
    problems.push(
      admin
        ? "Your school has no academic session and term yet. Add them in ParaLearn → Academic."
        : "Your school has no academic session and term yet. Ask your school admin to add them in ParaLearn → Academic.",
    );
  }
  if (options.categories.length === 0 && !options.canCreateCategory) {
    problems.push(
      "Your school has no assessment categories (like CA or Exam) yet. Ask your school admin to add one in ParaLearn → Assessments → Manage Categories.",
    );
  }
  return problems;
}

/**
 * Fills in the obvious choices: the school's current term, and the category
 * when there is only one or one is called "Exam".
 */
export function useSelectionDefaults(
  options: ReportCardOptions | undefined,
  value: ReportCardSelection,
  onChange: (v: ReportCardSelection) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!options || !enabled) return;
    const patch: Partial<ReportCardSelection> = {};
    if (!value.session && options.activePeriod) {
      patch.session = options.activePeriod.session;
      patch.term = options.activePeriod.term;
    }
    if (!value.categoryId && options.categories.length > 0) {
      const exam = options.categories.find((c) => /^exam(ination)?s?$/i.test(c.name.trim()));
      if (exam || options.categories.length === 1) {
        patch.categoryId = (exam ?? options.categories[0]).id;
      }
    }
    if (Object.keys(patch).length) onChange({ ...value, ...patch });
    // Only when new options arrive (e.g. a category was just created)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, enabled]);
}

/**
 * Class, subject, category and term pickers for linking an exam to report
 * cards. With `forReportCard` off (a practice test) only the classes are asked.
 */
export default function CbtReportCardFields({
  options,
  value,
  onChange,
  locked = false,
  forReportCard = true,
}: {
  options: ReportCardOptions;
  value: ReportCardSelection;
  onChange: (v: ReportCardSelection) => void;
  /** Scores are released: subject and term stay fixed */
  locked?: boolean;
  forReportCard?: boolean;
}) {
  const subjects = useMemo(() => sharedSubjects(options, value.classIds), [options, value.classIds]);
  const terms = options.periods.find((p) => p.session === value.session)?.terms ?? [];

  // A subject the new class choice doesn't share can't stay selected
  useEffect(() => {
    if (!locked && value.subjectId && !subjects.some((s) => s.id === value.subjectId)) {
      onChange({ ...value, subjectId: subjects.length === 1 ? subjects[0].id : "" });
    } else if (!locked && !value.subjectId && subjects.length === 1) {
      onChange({ ...value, subjectId: subjects[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects]);

  const set = (patch: Partial<ReportCardSelection>) => onChange({ ...value, ...patch });
  const toggleClass = (id: string) =>
    set({
      classIds: value.classIds.includes(id)
        ? value.classIds.filter((x) => x !== id)
        : [...value.classIds, id],
    });

  const emptyClasses = options.classes.filter(
    (c) => value.classIds.includes(c.id) && c.studentCount === 0,
  );
  const noSharedSubject = forReportCard && value.classIds.length > 1 && subjects.length === 0;

  return (
    <div className="space-y-4">
      <fieldset className="space-y-1.5">
        <legend className={labelClass}>Classes</legend>
        <div className="flex flex-wrap gap-2">
          {options.classes.map((c) => (
            <label
              key={c.id}
              className="cbt-check flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-fine)] px-2.5 py-1.5 text-sm cursor-pointer has-[:checked]:border-[var(--violet-ink)] has-[:checked]:bg-violet-50"
            >
              <input
                type="checkbox"
                checked={value.classIds.includes(c.id)}
                disabled={locked}
                onChange={() => toggleClass(c.id)}
              />
              {c.name}
              {typeof c.studentCount === "number" && (
                <span className="text-xs text-[var(--text-secondary)]">
                  · {c.studentCount} student{c.studentCount === 1 ? "" : "s"}
                </span>
              )}
            </label>
          ))}
        </div>
        {emptyClasses.length > 0 && (
          <p className="text-xs text-amber-700 flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {emptyClasses.map((c) => c.name).join(", ")}{" "}
            {emptyClasses.length === 1 ? "has" : "have"} no active students in ParaLearn, so nobody
            from {emptyClasses.length === 1 ? "it" : "them"} will be added. Students are enrolled in
            ParaLearn → Enrollments.
          </p>
        )}
        {noSharedSubject && (
          <p className="text-xs text-amber-700 flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            These classes don&apos;t take a common subject in ParaLearn. Choose classes that take
            the same subject.
          </p>
        )}
      </fieldset>

      {forReportCard && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className={labelClass}>Subject</span>
              <select
                className={selectClass}
                value={value.subjectId}
                disabled={locked || subjects.length === 0}
                onChange={(e) => set({ subjectId: e.target.value })}
              >
                <option value="">
                  {value.classIds.length === 0
                    ? "Choose classes first"
                    : subjects.length === 0
                      ? "No subject shared by these classes"
                      : "Choose a subject"}
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            {options.categories.length > 0 ? (
              <label className="space-y-1">
                <span className={labelClass}>Counts as</span>
                <select
                  className={selectClass}
                  value={value.categoryId}
                  onChange={(e) => set({ categoryId: e.target.value })}
                >
                  <option value="">Choose a category</option>
                  {options.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.weight}%)
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="space-y-1">
                <span className={labelClass}>Counts as</span>
                <p className="h-9 flex items-center text-sm text-[var(--text-secondary)]">
                  No categories yet
                </p>
              </div>
            )}

            <label className="space-y-1">
              <span className={labelClass}>Session</span>
              <select
                className={selectClass}
                value={value.session}
                disabled={locked}
                onChange={(e) => set({ session: e.target.value, term: "" })}
              >
                <option value="">Choose a session</option>
                {options.periods.map((p) => (
                  <option key={p.session} value={p.session}>
                    {p.session}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className={labelClass}>Term</span>
              <select
                className={selectClass}
                value={value.term}
                disabled={locked || !value.session}
                onChange={(e) => set({ term: e.target.value })}
              >
                <option value="">Choose a term</option>
                {terms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {options.categories.length === 0 && options.canCreateCategory && (
            <CreateCategory
              suggested={options.suggestedCategory ?? { name: "Exam", weight: 60 }}
              onCreated={(categoryId) => set({ categoryId })}
            />
          )}
        </>
      )}
    </div>
  );
}

/** One-click category for a school that has none (school admins only) */
function CreateCategory({
  suggested,
  onCreated,
}: {
  suggested: { name: string; weight: number };
  onCreated: (categoryId: string) => void;
}) {
  const [weight, setWeight] = useState(String(suggested.weight));
  const [createCategory, { isLoading }] = useCreateReportCardCategoryMutation();
  const weightNumber = Number(weight);
  const validWeight = Number.isFinite(weightNumber) && weightNumber > 0 && weightNumber <= 100;

  const handleCreate = async () => {
    try {
      const { category } = await createCategory({ name: suggested.name, weight: weightNumber }).unwrap();
      onCreated(category.id);
      toast.success(`"${category.name}" category added to your school in ParaLearn.`);
    } catch (err) {
      toast.error(reportCardErrorMessage(err, "Couldn't create the category."));
    }
  };

  return (
    <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-3 space-y-2">
      <p className="text-sm text-[var(--foreground)]">
        Your school has no assessment categories yet, so ParaLearn doesn&apos;t know how much this
        exam should count. Create an <strong>&quot;{suggested.name}&quot;</strong> category now:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cbt-check flex items-center gap-1.5 text-sm">
          Weight
          <input
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            aria-label="Category weight (percent)"
            className="h-8 rounded-[var(--radius-md)] border border-[var(--border-fine)] bg-white px-2 text-sm"
            style={{ width: 80, minHeight: 0 }}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          %
        </label>
        <button
          type="button"
          className="cbt-button primary"
          disabled={!validWeight || isLoading}
          onClick={handleCreate}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create &quot;{suggested.name}&quot; category
        </button>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        The weight sets how much exams count against your other categories in a subject&apos;s
        report-card score (a common split is CA 40%, Exam 60%). You can change it later in ParaLearn
        → Assessments → Manage Categories.
      </p>
    </div>
  );
}
