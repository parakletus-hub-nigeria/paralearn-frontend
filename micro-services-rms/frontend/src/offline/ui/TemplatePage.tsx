"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Download, FileSpreadsheet, FolderArchive, Loader2, Share2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_SUBJECTS, SCORE_COLUMNS, buildCsvTemplate, cleanList, type ScoreColumnKey } from "../engine/csvTemplate";
import { buildClassWorkbook, buildSchoolPackZip, buildSingleSubjectWorkbook, buildSubjectWorkbook } from "../engine/subjectSheets";
import { clearRoster, getRoster, saveRoster, type CachedRoster } from "../storage/db";
import { fetchStudentRoster, K12Error, normalizeClassKey } from "../storage/k12";
import { canShareFiles, downloadBlob, plural, safeFileName, shareFile, timeAgo, useOnline } from "./util";
import "./rms-forms.css";

const STORAGE_KEY = "rms-csv-template-settings";

interface Settings {
  classes: string;
  subjects: string;
  scoreColumns: ScoreColumnKey[];
  rowsPerClass: number;
  includeTeacherColumns: boolean;
}

const DEFAULTS: Settings = {
  classes: "",
  subjects: DEFAULT_SUBJECTS.join("\n"),
  scoreColumns: ["CA1", "CA2", "EXAM"],
  rowsPerClass: 40,
  includeTeacherColumns: true,
};

type BusyKind = "roster" | "xlsx" | "zip-class" | "zip-subject" | "csv";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ZIP_MIME = "application/zip";

/**
 * Simple, non-technical score-sheet downloader:
 *   1. Load students from ParaLearn (so names & IDs are already filled in)
 *   2. Tap a Class pill (or All classes)
 *   3. Tap a Subject pill (or All subjects)
 *   4. Tap Download -> 1 clean Excel file (or 1 organized folder for the whole school)
 */
export default function TemplatePage({
  schoolName,
  subdomain,
  ownerKey,
  onBack,
  onSignInNeeded,
}: {
  schoolName: string;
  subdomain: string;
  ownerKey: string;
  onBack: () => void;
  onSignInNeeded: () => void;
}) {
  const online = useOnline();
  const [canShare, setCanShare] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [busy, setBusy] = useState<BusyKind | null>(null);
  const [cachedRoster, setCachedRoster] = useState<CachedRoster | null>(null);
  const [pickedClass, setPickedClass] = useState<string | null>(null);
  const [pickedSubject, setPickedSubject] = useState<string | null>(null);
  const [subjectQuery, setSubjectQuery] = useState("");
  const roster = cachedRoster?.classes ?? null;
  const settingsKey = `${STORAGE_KEY}:${ownerKey}`;

  useEffect(() => {
    setCanShare(canShareFiles());
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(settingsKey);
      setS(saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS);
    } catch {
      setS(DEFAULTS);
    }
  }, [settingsKey]);

  useEffect(() => {
    let active = true;
    getRoster(ownerKey)
      .then((saved) => {
        if (active) setCachedRoster(saved);
      })
      .catch(() => {
        if (active) setCachedRoster(null);
      });
    return () => {
      active = false;
    };
  }, [ownerKey]);

  const update = (patch: Partial<Settings>) =>
    setS((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(settingsKey, JSON.stringify(next));
      } catch {
        /* not essential */
      }
      return next;
    });

  const toggleColumn = (key: ScoreColumnKey, on: boolean) =>
    update({ scoreColumns: SCORE_COLUMNS.map((c) => c.key).filter((k) => (k === key ? on : s.scoreColumns.includes(k))) });

  const classes = useMemo(() => cleanList(s.classes), [s.classes]);
  const subjects = useMemo(() => cleanList(s.subjects), [s.subjects]);
  const labels = SCORE_COLUMNS.filter((c) => s.scoreColumns.includes(c.key)).map((c) => c.label);
  const rowsOk = Number.isFinite(s.rowsPerClass) && s.rowsPerClass >= 1 && s.rowsPerClass <= 200;
  const rows = rowsOk ? Math.round(s.rowsPerClass) : 40;
  const subjectsAreDefault = cleanList(s.subjects).join("|") === DEFAULT_SUBJECTS.join("|");
  const rosterByClass = useMemo(
    () => new Map((roster || []).map((cls) => [normalizeClassKey(cls.className), cls.students])),
    [roster]
  );

  // Keep selections valid if classes or subjects change
  const activeClass = pickedClass && classes.includes(pickedClass) ? pickedClass : null;
  const activeSubject = pickedSubject && subjects.includes(pickedSubject) ? pickedSubject : null;
  const filteredSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    return q ? subjects.filter((sub) => sub.toLowerCase().includes(q)) : subjects;
  }, [subjects, subjectQuery]);

  const removeClass = (name: string) => {
    if (pickedClass === name) setPickedClass(null);
    update({ classes: classes.filter((c) => c !== name).join("\n") });
  };

  const clearImportedRoster = async () => {
    setCachedRoster(null);
    await clearRoster(ownerKey).catch(() => undefined);
    toast.info("Cleared imported student names. Sheets will use blank rows.");
  };

  const importRoster = async () => {
    setBusy("roster");
    try {
      const result = await fetchStudentRoster();
      const nextCached: CachedRoster = {
        classes: result.classes,
        subjects: result.subjects,
        importedAt: new Date().toISOString(),
      };
      setCachedRoster(nextCached);
      await saveRoster(ownerKey, nextCached).catch(() => undefined);
      const populated = result.classes.filter((cls) => cls.students.length > 0);
      const selectedClasses = populated.length ? populated : result.classes;
      const skippedEmpty = populated.length ? result.classes.length - populated.length : 0;
      const largest = Math.max(1, ...selectedClasses.map((cls) => cls.students.length));
      const patch: Partial<Settings> = {
        classes: selectedClasses.map((cls) => cls.className).join("\n"),
        rowsPerClass: Math.min(200, largest),
      };
      if (result.subjects.length && (subjectsAreDefault || !subjects.length)) {
        patch.subjects = result.subjects.join("\n");
      }
      update(patch);
      setPickedClass(null);
      setPickedSubject(null);
      const total = selectedClasses.reduce((count, cls) => count + cls.students.length, 0);
      if (total) {
        const skippedNote = skippedEmpty ? ` (${plural(skippedEmpty, "empty class", "empty classes")} skipped)` : "";
        toast.success(`Loaded ${plural(total, "student")} across ${plural(selectedClasses.length, "class", "classes")}${skippedNote}.`);
      } else {
        toast.error("Classes were loaded, but no enrolled students were found yet.");
      }
    } catch (err) {
      if (err instanceof K12Error && err.needsSignIn) onSignInNeeded();
      toast.error(err instanceof Error ? err.message : "Couldn't load students from ParaLearn.");
    } finally {
      setBusy(null);
    }
  };

  const canDownload = classes.length > 0 && subjects.length > 0 && s.scoreColumns.length > 0;
  const sheetOpts = {
    classes,
    subjects,
    scoreColumns: s.scoreColumns,
    rowsPerClass: rows,
    roster: roster || undefined,
  };
  const schoolSlug = safeFileName(schoolName || subdomain || "School");

  const buildSelectedFile = (): { blob: Blob; fileName: string; successMsg: string } | null => {
    if (activeClass && activeSubject) {
      const bytes = buildSingleSubjectWorkbook(activeClass, activeSubject, sheetOpts);
      const fileName = `${safeFileName(`${activeClass} - ${activeSubject}`)}.xlsx`;
      return {
        blob: new Blob([bytes as BlobPart], { type: XLSX_MIME }),
        fileName,
        successMsg: `Downloaded ${fileName}. Send it to the ${activeSubject} teacher.`,
      };
    }
    if (activeClass) {
      const bytes = buildClassWorkbook(activeClass, sheetOpts);
      const fileName = `${safeFileName(`${activeClass} - All Subjects`)}.xlsx`;
      return {
        blob: new Blob([bytes as BlobPart], { type: XLSX_MIME }),
        fileName,
        successMsg: `Downloaded ${fileName} (1 tab per subject).`,
      };
    }
    if (activeSubject) {
      const bytes = buildSubjectWorkbook(activeSubject, sheetOpts);
      const fileName = `${safeFileName(`${activeSubject} - All Classes`)}.xlsx`;
      return {
        blob: new Blob([bytes as BlobPart], { type: XLSX_MIME }),
        fileName,
        successMsg: `Downloaded ${fileName} (1 tab per class). Send this one file to the ${activeSubject} teacher.`,
      };
    }
    return null;
  };

  const downloadSelection = () => {
    if (!canDownload) {
      toast.error("Load students from ParaLearn (or add at least one class and subject below) first.");
      return;
    }
    setBusy("xlsx");
    try {
      const built = buildSelectedFile();
      if (!built) return;
      downloadBlob(built.blob, built.fileName);
      toast.success(built.successMsg);
    } catch {
      toast.error("Couldn't create the Excel file. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const shareSelection = async () => {
    if (!canDownload) {
      toast.error("Load students from ParaLearn (or add at least one class and subject below) first.");
      return;
    }
    setBusy("xlsx");
    try {
      const built = buildSelectedFile();
      if (!built) return;
      const shared = await shareFile(built.blob, built.fileName, built.fileName.replace(/\.xlsx$/i, ""));
      if (shared) toast.success(`Ready to send ${built.fileName}.`);
    } catch {
      toast.error("Couldn't share the Excel file. Tap Download instead.");
    } finally {
      setBusy(null);
    }
  };

  const downloadPack = (mode: "by-class" | "by-subject") => {
    if (!canDownload) {
      toast.error("Load students from ParaLearn (or add at least one class and subject below) first.");
      return;
    }
    setBusy(mode === "by-class" ? "zip-class" : "zip-subject");
    try {
      const bytes = buildSchoolPackZip(mode, sheetOpts);
      const label = mode === "by-class" ? "By Class" : "By Subject";
      const fileName = `${schoolSlug} score sheets (${label}).zip`;
      downloadBlob(new Blob([bytes as BlobPart], { type: ZIP_MIME }), fileName);
      toast.success(`Downloaded ${fileName}. Open the folder to send each teacher their Excel file.`);
    } catch {
      toast.error("Couldn't create the folder of Excel files. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const downloadWholeSchoolCsv = () => {
    if (!canDownload) {
      toast.error("Add at least one class and subject first.");
      return;
    }
    const csv = buildCsvTemplate({
      classes,
      subjects,
      scoreColumns: s.scoreColumns,
      rowsPerClass: rows,
      includeTeacherColumns: s.includeTeacherColumns,
      roster: roster || undefined,
    });
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${schoolSlug} result sheet template.csv`);
    toast.success("Downloaded the full-school CSV.");
  };

  const matchedRosterStudents = classes.reduce((count, cls) => count + (rosterByClass.get(normalizeClassKey(cls))?.length || 0), 0);
  const previewClass = activeClass || classes[0] || "JSS 1A";
  const previewSubject = activeSubject || subjects[0] || "Mathematics";
  const previewRoster = rosterByClass.get(normalizeClassKey(previewClass)) || [];
  const previewRows = (previewRoster.length ? previewRoster.slice(0, 5) : [null, null, null]).map((student, index) => ({
    number: index + 1,
    student,
  }));
  const activeClassCount = activeClass ? rosterByClass.get(normalizeClassKey(activeClass))?.length || rows : matchedRosterStudents;

  return (
    <main className="rms-page">
      <button type="button" className="rms-back" onClick={onBack}>
        <ArrowLeft size={14} />
        Result batches
      </button>
      <div className="rms-page-heading rms-tpl-heading">
        <div>
          <span className="rms-eyebrow">Ready-to-fill Excel sheets for teachers</span>
          <h1>Result sheet template</h1>
          <p className="rms-tpl-lede">
            Load your students, tap a class or subject, and download a clean Excel sheet with student names already filled in.
          </p>
        </div>
        <div className="rms-page-actions">
          <button
            type="button"
            className="rms-button primary"
            onClick={importRoster}
            disabled={!!busy || !online}
            title={!online ? "Connect to the internet to load students from ParaLearn." : undefined}
          >
            {busy === "roster" ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
            {busy === "roster" ? "Loading students" : roster ? "Refresh students" : "Load students from ParaLearn"}
          </button>
        </div>
      </div>

      {cachedRoster && (
        <div className="rms-pf-intro" role="status" style={{ marginBottom: 20 }}>
          <Users size={16} aria-hidden />
          <span style={{ flex: 1 }}>
            <strong>{plural(matchedRosterStudents, "student")}</strong> loaded across <strong>{plural(classes.length, "class", "classes")}</strong>{" "}
            (saved for offline use · {timeAgo(cachedRoster.importedAt)}).{" "}
            <button type="button" className="rms-link" onClick={clearImportedRoster}>
              Use blank rows instead
            </button>
          </span>
        </div>
      )}

      <div className="rms-pf rms-tpl">
        <div className="rms-pf-form">
          {/* Step 1: Pick a Class (big clickable pills, no dropdown) */}
          <section className="rms-pf-section" aria-labelledby="tpl-pick-class">
            <header>
              <span className="rms-step-num" aria-hidden>01</span>
              <h2 id="tpl-pick-class">Pick a class</h2>
              <p>Tap one class, or keep All classes selected.</p>
            </header>
            <div className="rms-pf-fields">
              {classes.length > 0 ? (
                <div className="rms-pill-group" role="group" aria-label="Choose a class">
                  <button type="button" className="rms-pill" aria-pressed={activeClass === null} onClick={() => setPickedClass(null)}>
                    {activeClass === null && <Check size={15} aria-hidden />}
                    All classes
                    <small>{classes.length}</small>
                  </button>
                  {classes.map((cls) => {
                    const count = rosterByClass.get(normalizeClassKey(cls))?.length;
                    const selected = activeClass === cls;
                    return (
                      <button
                        key={cls}
                        type="button"
                        className="rms-pill"
                        aria-pressed={selected}
                        onClick={() => setPickedClass(selected ? null : cls)}
                      >
                        {selected && <Check size={15} aria-hidden />}
                        {cls}
                        {count ? <small>{count}</small> : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rms-pf-note">
                  Tap <strong>Load students from ParaLearn</strong> above to bring in your school&apos;s classes automatically.
                </p>
              )}
            </div>
          </section>

          {/* Step 2: Pick a Subject (big clickable pills + quick filter for long lists) */}
          <section className="rms-pf-section" aria-labelledby="tpl-pick-subject">
            <header>
              <span className="rms-step-num" aria-hidden>02</span>
              <h2 id="tpl-pick-subject">Pick a subject</h2>
              <p>Tap one subject for a subject teacher, or keep All subjects.</p>
            </header>
            <div className="rms-pf-fields">
              {subjects.length > 10 && (
                <label className="rms-field rms-subject-filter">
                  <span className="sr-only">Find a subject</span>
                  <input
                    type="search"
                    className="rms-input"
                    value={subjectQuery}
                    onChange={(e) => setSubjectQuery(e.target.value)}
                    placeholder="Find a subject (e.g. English, Mathematics)..."
                  />
                </label>
              )}
              <div className="rms-pill-group" role="group" aria-label="Choose a subject">
                {!subjectQuery.trim() && (
                  <button type="button" className="rms-pill" aria-pressed={activeSubject === null} onClick={() => setPickedSubject(null)}>
                    {activeSubject === null && <Check size={15} aria-hidden />}
                    All subjects
                    <small>{subjects.length}</small>
                  </button>
                )}
                {filteredSubjects.map((sub) => {
                  const selected = activeSubject === sub;
                  return (
                    <button
                      key={sub}
                      type="button"
                      className="rms-pill"
                      aria-pressed={selected}
                      onClick={() => setPickedSubject(selected ? null : sub)}
                    >
                      {selected && <Check size={15} aria-hidden />}
                      {sub}
                    </button>
                  );
                })}
                {subjectQuery.trim() && !filteredSubjects.length && (
                  <p className="rms-pf-note">No subject matches &ldquo;{subjectQuery}&rdquo;.</p>
                )}
              </div>
            </div>
          </section>

          {/* Step 3: Download */}
          <section className="rms-pf-section" aria-labelledby="tpl-download-step">
            <header>
              <span className="rms-step-num" aria-hidden>03</span>
              <h2 id="tpl-download-step">Send or download</h2>
              <p>Share straight to WhatsApp on Android, or save the Excel file.</p>
            </header>
            <div className="rms-pf-fields">
              <div className="rms-tpl-action-card">
                {activeClass && activeSubject ? (
                  <>
                    <p>
                      <strong>
                        {activeClass}: {activeSubject}
                      </strong>{" "}
                      ({plural(activeClassCount, "student")}, {3 + labels.length} columns). One clean Excel file ready for WhatsApp.
                    </p>
                    <div className="rms-tpl-action-btns">
                      {canShare && (
                        <button type="button" className="rms-button primary" onClick={shareSelection} disabled={!canDownload || !!busy}>
                          {busy === "xlsx" ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                          Share to WhatsApp
                        </button>
                      )}
                      <button
                        type="button"
                        className={`rms-button ${canShare ? "" : "primary"}`}
                        onClick={downloadSelection}
                        disabled={!canDownload || !!busy}
                      >
                        {busy === "xlsx" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        Download {activeClass} ({activeSubject})
                      </button>
                    </div>
                  </>
                ) : activeClass ? (
                  <>
                    <p>
                      <strong>
                        {activeClass}: all {subjects.length} subjects
                      </strong>
                      . One Excel file with a tab for each subject. No unzipping needed.
                    </p>
                    <div className="rms-tpl-action-btns">
                      {canShare && (
                        <button type="button" className="rms-button primary" onClick={shareSelection} disabled={!canDownload || !!busy}>
                          {busy === "xlsx" ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                          Share to WhatsApp
                        </button>
                      )}
                      <button
                        type="button"
                        className={`rms-button ${canShare ? "" : "primary"}`}
                        onClick={downloadSelection}
                        disabled={!canDownload || !!busy}
                      >
                        {busy === "xlsx" ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                        Download {activeClass} (all subjects)
                      </button>
                    </div>
                  </>
                ) : activeSubject ? (
                  <>
                    <p>
                      <strong>
                        {activeSubject}: all {classes.length} classes
                      </strong>
                      . One Excel file with a tab for each class. Send this single file to the {activeSubject} teacher.
                    </p>
                    <div className="rms-tpl-action-btns">
                      {canShare && (
                        <button type="button" className="rms-button primary" onClick={shareSelection} disabled={!canDownload || !!busy}>
                          {busy === "xlsx" ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                          Share to WhatsApp
                        </button>
                      )}
                      <button
                        type="button"
                        className={`rms-button ${canShare ? "" : "primary"}`}
                        onClick={downloadSelection}
                        disabled={!canDownload || !!busy}
                      >
                        {busy === "xlsx" ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                        Download {activeSubject} (all classes)
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      <strong>On a phone?</strong> Tap one class or subject above to send a single Excel file straight to WhatsApp. To download the
                      whole school at once (best on a laptop):
                    </p>
                    <div className="rms-tpl-action-btns">
                      <button
                        type="button"
                        className="rms-button primary"
                        onClick={() => downloadPack("by-subject")}
                        disabled={!canDownload || !!busy}
                      >
                        {busy === "zip-subject" ? <Loader2 size={16} className="animate-spin" /> : <FolderArchive size={16} />}
                        1 file per subject ({subjects.length} files)
                      </button>
                      <button
                        type="button"
                        className="rms-button"
                        onClick={() => downloadPack("by-class")}
                        disabled={!canDownload || !!busy}
                      >
                        {busy === "zip-class" ? <Loader2 size={16} className="animate-spin" /> : <FolderArchive size={16} />}
                        1 file per class ({classes.length} files)
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Collapsible manual customization so non-technical users aren't overwhelmed */}
          <details className="rms-tpl-advanced">
            <summary>
              Edit classes, subjects or score columns
              <ChevronDown size={16} aria-hidden />
            </summary>
            <div className="rms-tpl-advanced-body">
              <section className="rms-pf-section" aria-labelledby="tpl-classes-title">
                <header>
                  <h2 id="tpl-classes-title">Classes</h2>
                  <p>One per line, or separated by commas.</p>
                </header>
                <div className="rms-pf-fields">
                  <label className="rms-field">
                    <span className="sr-only">Classes</span>
                    <textarea
                      id="tpl-classes"
                      className="rms-textarea"
                      rows={4}
                      value={s.classes}
                      onChange={(e) => update({ classes: e.target.value })}
                      placeholder={"JSS 1A\nJSS 1B\nJSS 2A"}
                    />
                  </label>
                  {classes.length > 0 && (
                    <ul className="rms-tpl-chips" aria-label="Classes">
                      {classes.map((c) => {
                        const count = rosterByClass.get(normalizeClassKey(c))?.length;
                        return (
                          <li key={c}>
                            <span>
                              {c}
                              {count ? ` · ${count}` : ""}
                            </span>
                            <button type="button" onClick={() => removeClass(c)} aria-label={`Remove ${c}`}>
                              <X size={13} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>

              <section className="rms-pf-section" aria-labelledby="tpl-subjects-title">
                <header>
                  <h2 id="tpl-subjects-title">Subjects</h2>
                  <p>Each subject is marked out of 100.</p>
                </header>
                <div className="rms-pf-fields">
                  <label className="rms-field">
                    <span className="sr-only">Subjects</span>
                    <textarea
                      id="tpl-subjects"
                      className="rms-textarea"
                      rows={Math.min(10, Math.max(5, s.subjects.split("\n").length + 1))}
                      value={s.subjects}
                      onChange={(e) => update({ subjects: e.target.value })}
                    />
                    <small className="rms-tpl-hintrow">
                      <span>{plural(subjects.length, "subject")}</span>
                      {!subjectsAreDefault && (
                        <button type="button" className="rms-link" onClick={() => update({ subjects: DEFAULT_SUBJECTS.join("\n") })}>
                          Use common subjects
                        </button>
                      )}
                    </small>
                  </label>
                </div>
              </section>

              <section className="rms-pf-section" aria-labelledby="tpl-cols-title" style={{ borderBottom: 0, paddingBottom: 0 }}>
                <header>
                  <h2 id="tpl-cols-title">Score columns</h2>
                  <p>Columns teachers fill in for each subject.</p>
                </header>
                <div className="rms-pf-fields">
                  <div className="rms-tpl-columns" role="group" aria-labelledby="tpl-cols-title">
                    {SCORE_COLUMNS.map((c) => (
                      <label key={c.key} className={`rms-tpl-option ${s.scoreColumns.includes(c.key) ? "is-on" : ""}`}>
                        <input id={`tpl-col-${c.key}`} type="checkbox" checked={s.scoreColumns.includes(c.key)} onChange={(e) => toggleColumn(c.key, e.target.checked)} />
                        <span>
                          <strong>{c.label}</strong>
                          <small>{c.key === "CA3" ? "Printed on cards, not stored in ParaLearn." : c.hint[0].toUpperCase() + c.hint.slice(1)}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <button type="button" className="rms-link" onClick={downloadWholeSchoolCsv} disabled={!canDownload || !!busy}>
                      Download whole school as one CSV file instead
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </details>
        </div>

        {/* Live preview of the exact clean 6-column sheet the teacher opens */}
        <aside className="rms-pf-preview" aria-labelledby="tpl-preview">
          <h2 id="tpl-preview">What the teacher will see</h2>
          <p className="rms-tpl-facts">
            <span>
              <strong>{previewClass}</strong>
            </span>
            <span>
              <strong>{previewSubject}</strong>
            </span>
            <span>
              <strong>{3 + labels.length}</strong> columns
            </span>
          </p>
          <div className="rms-tpl-sheet" tabIndex={0} role="region" aria-label="Preview of the teacher score sheet">
            <table>
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>Student Name</th>
                  <th>Admission No</th>
                  {labels.map((l) => (
                    <th key={l}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map(({ number, student }) => (
                  <tr key={number}>
                    <td className="num">{number}</td>
                    <td>{student?.name || ""}</td>
                    <td>{student?.admissionNo || ""}</td>
                    {labels.map((l) => (
                      <td key={l} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ol className="rms-tpl-steps">
            <li>Send the downloaded Excel file to the teacher (WhatsApp or flash drive).</li>
            <li>The teacher only types scores under {labels.join(", ")} and saves.</li>
            <li>
              Drop all returned files together on{" "}
              <button type="button" className="rms-link" onClick={onBack}>
                Result batches
                <ArrowRight size={13} aria-hidden />
              </button>{" "}
              — we combine them automatically.
            </li>
          </ol>
        </aside>
      </div>

      {/* Sticky bottom bar on phones so Download / Share to WhatsApp is always reachable without scrolling past 26 subject pills */}
      {canDownload && (
        <div className="rms-mobile-sticky-bar" role="region" aria-label="Download or share selected sheet">
          <div className="rms-mobile-sticky-label">
            <strong>
              {activeClass && activeSubject
                ? `${activeClass} – ${activeSubject}`
                : activeClass
                ? `${activeClass} · all subjects`
                : activeSubject
                ? `${activeSubject} · all classes`
                : "Whole school"}
            </strong>
          </div>
          <div className="rms-mobile-sticky-actions">
            {activeClass || activeSubject ? (
              <>
                {canShare && (
                  <button type="button" className="rms-button primary" onClick={shareSelection} disabled={!!busy}>
                    <Share2 size={16} />
                    Share
                  </button>
                )}
                <button type="button" className={`rms-button ${canShare ? "" : "primary"}`} onClick={downloadSelection} disabled={!!busy}>
                  <Download size={16} />
                  Download
                </button>
              </>
            ) : (
              <button type="button" className="rms-button primary" onClick={() => downloadPack("by-subject")} disabled={!!busy}>
                <FolderArchive size={16} />
                All ({subjects.length} files)
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
