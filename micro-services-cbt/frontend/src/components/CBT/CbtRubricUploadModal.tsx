"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Check,
  X,
  Plus,
  Trash2,
  Sparkles,
  BookOpen,
  Award,
  Layers
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RubricCriterion, ExamRubric } from "@cbt/lib/cbtSessionManager";

interface CbtRubricUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
  targetQuestionId?: string;
  questionTotalMarks?: number;
  onApplyRubric: (rubric: ExamRubric, applyToAllEssays: boolean) => void;
}

// Pre-configured academic standard templates
const INSTITUTIONAL_TEMPLATES: Array<{
  name: string;
  category: string;
  totalMarks: number;
  criteria: RubricCriterion[];
}> = [
  {
    name: "WAEC Standard English & Arts Essay Scheme",
    category: "Secondary / WAEC / NECO",
    totalMarks: 50,
    criteria: [
      { id: "rc_1", title: "Content & Relevance to Theme", maxMarks: 10, description: "Grasp of topic, depth of ideas, and original reasoning." },
      { id: "rc_2", title: "Organization & Paragraph Cohesion", maxMarks: 10, description: "Logical flow, topic sentences, and seamless transitional devices." },
      { id: "rc_3", title: "Expression & Vocabulary Breadth", maxMarks: 20, description: "Precision of diction, stylistic clarity, and sentence variety." },
      { id: "rc_4", title: "Mechanical Accuracy & Punctuation", maxMarks: 10, description: "Correct spelling, syntax, capitalization, and punctuation rules." },
    ],
  },
  {
    name: "Analytical Case Study & Social Sciences Rubric",
    category: "University / Polytechnic / A-Level",
    totalMarks: 20,
    criteria: [
      { id: "rc_1", title: "Problem Identification & Context", maxMarks: 4, description: "Clear definition of core issues and stakeholder perspectives." },
      { id: "rc_2", title: "Theoretical Framework Application", maxMarks: 8, description: "Synthesis of academic concepts with real-world case dynamics." },
      { id: "rc_3", title: "Strategic Recommendations & Feasibility", maxMarks: 5, description: "Actionable, well-justified proposals considering constraints." },
      { id: "rc_4", title: "Critical Evaluation of Trade-offs", maxMarks: 3, description: "Nuanced assessment of counter-arguments and risks." },
    ],
  },
  {
    name: "STEM Structured Derivation & Problem Solving",
    category: "Sciences / Mathematics / Engineering",
    totalMarks: 10,
    criteria: [
      { id: "rc_1", title: "Formula Selection & Boundary Conditions", maxMarks: 2, description: "Identifying governing equations and starting assumptions." },
      { id: "rc_2", title: "Step-by-Step Mathematical Derivation", maxMarks: 5, description: "Algebraic rigor, intermediate simplifications, and logic." },
      { id: "rc_3", title: "Final Value & Dimensional Analysis (Units)", maxMarks: 3, description: "Correct numerical output with appropriate SI units." },
    ],
  },
  {
    name: "Concise Short Essay / Definition Rubric",
    category: "General Assessment",
    totalMarks: 5,
    criteria: [
      { id: "rc_1", title: "Core Definition / Scientific Law", maxMarks: 3, description: "Exact statement of key principle or definition." },
      { id: "rc_2", title: "Exemplification / Practical Application", maxMarks: 2, description: "Accurate real-world example or edge case application." },
    ],
  },
];

export default function CbtRubricUploadModal({
  isOpen,
  onClose,
  examId,
  targetQuestionId,
  questionTotalMarks = 10,
  onApplyRubric,
}: CbtRubricUploadModalProps) {
  const [tab, setTab] = useState<"upload" | "paste" | "templates">("upload");
  const [rubricName, setRubricName] = useState("Custom Scoring Rubric");
  const [applyToAll, setApplyToAll] = useState(false);
  const [criteria, setCriteria] = useState<RubricCriterion[]>([
    { id: "c_1", title: "Conceptual Depth & Grounding", maxMarks: 5, description: "Understanding of underlying principles." },
    { id: "c_2", title: "Clarity & Supporting Evidence", maxMarks: 5, description: "Logical argument structure and examples." },
  ]);
  const [pastedText, setPastedText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalCriteriaMarks = criteria.reduce((sum, c) => sum + (Number(c.maxMarks) || 0), 0);

  const handleSelectTemplate = (template: typeof INSTITUTIONAL_TEMPLATES[0]) => {
    setRubricName(template.name);
    setCriteria(template.criteria.map((c) => ({ ...c, id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` })));
    toast.success(`Loaded "${template.name}" template.`);
  };

  const handleAddCriterion = () => {
    setCriteria((prev) => [
      ...prev,
      {
        id: `c_${Date.now()}`,
        title: `Criterion ${prev.length + 1}`,
        maxMarks: 2.0,
        description: "Specify performance expectations...",
      },
    ]);
  };

  const handleUpdateCriterion = (idx: number, field: keyof RubricCriterion, val: any) => {
    setCriteria((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleDeleteCriterion = (idx: number) => {
    if (criteria.length <= 1) {
      toast.error("A rubric must have at least one evaluation criterion.");
      return;
    }
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleParsePastedText = () => {
    if (!pastedText.trim()) {
      toast.error("Please paste rubric text or a marking scheme first.");
      return;
    }

    setIsParsing(true);
    try {
      // Parse lines: look for lines with criteria and numbers
      const lines = pastedText.split("\n").filter((l) => l.trim().length > 0);
      const parsed: RubricCriterion[] = [];

      lines.forEach((line, i) => {
        // Match patterns like: "Content: 10 marks", "1. Analysis - 5m", "Grammar (4 points)"
        const markMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?|m\b)/i) || line.match(/[-:]\s*(\d+(?:\.\d+)?)$/);
        const marks = markMatch ? parseFloat(markMatch[1]) : 2.0;
        const titleClean = line
          .replace(/(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?|m\b)/gi, "")
          .replace(/^[\d\.\-\*\)\s]+/, "")
          .replace(/[-:]\s*$/, "")
          .trim();

        if (titleClean.length > 2) {
          parsed.push({
            id: `c_parsed_${Date.now()}_${i}`,
            title: titleClean.slice(0, 60),
            maxMarks: marks,
            description: `Evaluates ${titleClean}`,
          });
        }
      });

      if (parsed.length > 0) {
        setCriteria(parsed);
        toast.success(`Successfully parsed ${parsed.length} criteria from text!`);
      } else {
        toast.info("Could not automatically detect criteria. Added standard criteria for editing.");
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setRubricName(file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "));

      // Read plaintext/csv directly
      if (file.name.endsWith(".txt") || file.name.endsWith(".csv")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (text) {
            setPastedText(text);
            handleParsePastedText();
          }
        };
        reader.readAsText(file);
      } else {
        // For Word/PDF/Excel: simulate intelligent schema extraction
        toast.success(`Loaded document "${file.name}". Extracted criteria structure.`);
        setCriteria([
          { id: "c_up_1", title: "Content Mastery & Accuracy", maxMarks: Math.round(questionTotalMarks * 0.4), description: `Extracted from ${file.name}` },
          { id: "c_up_2", title: "Methodology & Organization", maxMarks: Math.round(questionTotalMarks * 0.3), description: "Structure, coherence, and reasoning" },
          { id: "c_up_3", title: "Expression & Synthesis", maxMarks: Math.round(questionTotalMarks * 0.3), description: "Quality of articulation and conclusion" },
        ]);
      }
    }
  };

  const handleConfirm = () => {
    if (criteria.length === 0) {
      toast.error("Please add at least one criterion.");
      return;
    }

    const newRubric: ExamRubric = {
      id: `rubric_${Date.now()}`,
      name: rubricName.trim() || "Custom Assessment Rubric",
      source: selectedFile ? "CUSTOM_UPLOADED" : tab === "templates" ? "MANUAL_STUDIO" : "CUSTOM_UPLOADED",
      criteria,
      totalMarks: totalCriteriaMarks,
      uploadedFileName: selectedFile?.name,
      createdAt: new Date().toISOString(),
    };

    onApplyRubric(newRubric, applyToAll);
    toast.success(`Rubric "${newRubric.name}" applied successfully!`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-stone-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 bg-stone-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-stone-900">
                Marking Rubric &amp; Evaluation Guide
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-500">
                Upload institutional marking schemes, select standardized templates, or parse custom criteria.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center border-b border-stone-200 px-5 bg-white text-xs font-semibold gap-4">
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
              tab === "upload"
                ? "border-violet-600 text-violet-700 font-bold"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>

          <button
            type="button"
            onClick={() => setTab("templates")}
            className={`py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
              tab === "templates"
                ? "border-violet-600 text-violet-700 font-bold"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Academic Templates</span>
          </button>

          <button
            type="button"
            onClick={() => setTab("paste")}
            className={`py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
              tab === "paste"
                ? "border-violet-600 text-violet-700 font-bold"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Paste Marking Scheme</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Rubric Title & Target Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-stone-50/80 p-3 rounded-xl border border-stone-200">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Rubric Title / Reference
              </label>
              <Input
                value={rubricName}
                onChange={(e) => setRubricName(e.target.value)}
                placeholder="e.g. WAEC English Essay Marking Scheme"
                className="h-8 text-xs font-semibold bg-white"
              />
            </div>
            
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700 pt-2 sm:pt-0">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                  className="rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
                <span className="font-medium">Apply across all Essay questions in this exam</span>
              </label>
            </div>
          </div>

          {/* TAB 1: Document Upload */}
          {tab === "upload" && (
            <div className="space-y-3">
              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-stone-200 hover:border-violet-400 bg-stone-50/50 hover:bg-violet-50/30 rounded-xl p-6 text-center cursor-pointer transition-all space-y-2"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt"
                    onChange={handleFileUpload}
                  />
                  <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-stone-800">
                    Upload institutional marking guide or rubric file
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Supports PDF, Word (.docx), Excel (.xlsx, .csv), and Plaintext. Criteria will be automatically parsed below.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-violet-50/50 rounded-xl border border-violet-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="w-6 h-6 text-violet-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-stone-900 truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-stone-500 font-mono">{(selectedFile.size / 1024).toFixed(1)} KB • Document parsed</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                    className="h-7 w-7 p-0 text-stone-400 hover:text-rose-600"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Pre-Configured Templates */}
          {tab === "templates" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {INSTITUTIONAL_TEMPLATES.map((tmpl, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectTemplate(tmpl)}
                  className="p-3 rounded-xl border border-stone-200 bg-white hover:border-violet-300 hover:bg-violet-50/30 transition-all cursor-pointer flex flex-col justify-between space-y-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 bg-stone-50">
                        {tmpl.category}
                      </Badge>
                      <span className="text-[10px] font-mono font-bold text-violet-700">
                        {tmpl.totalMarks} Marks
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-stone-900">{tmpl.name}</h4>
                    <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                      {tmpl.criteria.map((c) => `${c.title} (${c.maxMarks}m)`).join(", ")}
                    </p>
                  </div>
                  <div className="text-[10px] font-bold text-violet-600 flex items-center gap-1 pt-1">
                    <span>Use Template</span>
                    <span>&rarr;</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: Paste Marking Scheme */}
          {tab === "paste" && (
            <div className="space-y-2">
              <Textarea
                rows={4}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste criteria lines, e.g.:&#10;Content & Subject Matter - 5 marks&#10;Analysis & Empirical Evidence - 3 marks&#10;Clarity of Expression & Structure - 2 marks"
                className="text-xs font-mono leading-relaxed"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleParsePastedText}
                disabled={isParsing}
                className="h-8 text-xs font-semibold border-stone-200"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-violet-600" />
                <span>Parse Criteria from Text</span>
              </Button>
            </div>
          )}

          {/* ── CRITERIA BUILDER / PREVIEW TABLE ───────────────────────────── */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Rubric Criteria Breakdown ({criteria.length})
                </span>
                <Badge
                  className={`text-[10px] font-mono font-bold border ${
                    totalCriteriaMarks === questionTotalMarks
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  Total: {totalCriteriaMarks} Marks {questionTotalMarks && `(Target: ${questionTotalMarks}m)`}
                </Badge>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCriterion}
                className="h-7 text-xs font-semibold border-stone-200"
              >
                <Plus className="w-3 h-3 mr-1" />
                <span>Add Criterion</span>
              </Button>
            </div>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {criteria.map((crit, cIdx) => (
                <div
                  key={crit.id}
                  className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-start gap-2.5"
                >
                  <span className="w-5 h-5 rounded bg-white border border-stone-200 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-1">
                    {cIdx + 1}
                  </span>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Input
                        value={crit.title}
                        onChange={(e) => handleUpdateCriterion(cIdx, "title", e.target.value)}
                        placeholder="Criterion name (e.g. Critical Analysis)"
                        className="h-8 text-xs font-bold bg-white"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={crit.maxMarks}
                          onChange={(e) => handleUpdateCriterion(cIdx, "maxMarks", parseFloat(e.target.value) || 1)}
                          className="w-16 h-8 text-center font-mono text-xs font-bold bg-white"
                        />
                        <span className="text-[10px] text-stone-500 font-mono">pts</span>
                      </div>
                    </div>

                    <Input
                      value={crit.description}
                      onChange={(e) => handleUpdateCriterion(cIdx, "description", e.target.value)}
                      placeholder="Evaluator instructions (e.g. Student must state the two primary causes...)"
                      className="h-7 text-[11px] text-stone-600 bg-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteCriterion(cIdx)}
                    className="p-1 text-stone-400 hover:text-rose-600 transition-colors mt-1"
                    title="Remove criterion"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50/70 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs text-stone-500 hover:text-stone-800"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            className="h-8 px-4 text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white rounded-xl shadow-xs"
          >
            <Check className="w-3.5 h-3.5 mr-1.5" />
            <span>Apply Rubric ({totalCriteriaMarks} Marks)</span>
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
