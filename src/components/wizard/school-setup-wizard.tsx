"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Step1SessionSetup } from "./step1-session-setup";
import { Step2ClassesGrades } from "./step2-classes-grades";
import { Step3Subjects } from "./step3-subjects";
import { Step4GradingSystem } from "./step4-grading-system";
import { Step5ReportCardTemplates } from "./step5-report-card-templates";
import { SubjectsManagementModal } from "./subjects-management-modal";
import {
  onboardingSetup,
  clearError,
  clearSuccess,
  clearWizardData,
} from "@/reduxToolKit/setUp/setUpSlice";
import { useRouter } from "next/navigation";
import { routespath } from "@/lib/routepath";
import { toast } from "sonner";
import AuthHeader from "@/components/auth/authHeader";

interface Term {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface Class {
  id: string;
  name: string;
  level: number;
  stream: string;
  capacity: string;
}

interface GradeScale {
  letter: string;
  minPoints: number;
  maxPoints: number;
  description: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  classIds: string[];
  description?: string;
}

const defaultGradeScales: GradeScale[] = [
  { letter: "A", minPoints: 80, maxPoints: 100, description: "Excellent" },
  { letter: "B", minPoints: 70, maxPoints: 79, description: "Very Good" },
  { letter: "C", minPoints: 60, maxPoints: 69, description: "Good" },
  { letter: "D", minPoints: 50, maxPoints: 59, description: "Pass" },
  { letter: "E", minPoints: 40, maxPoints: 49, description: "Needs Improvement" },
  { letter: "F", minPoints: 0, maxPoints: 39, description: "Fail" },
];

// Default example data for wizard
const defaultTerms: Term[] = [
  {
    id: "1",
    name: "Term 1",
    startDate: `${new Date().getFullYear()}-09-01`,
    endDate: `${new Date().getFullYear()}-12-15`,
  },
  {
    id: "2",
    name: "Term 2",
    startDate: `${new Date().getFullYear() + 1}-01-10`,
    endDate: `${new Date().getFullYear() + 1}-04-10`,
  },
  {
    id: "3",
    name: "Term 3",
    startDate: `${new Date().getFullYear() + 1}-04-25`,
    endDate: `${new Date().getFullYear() + 1}-07-20`,
  },
];

const defaultClasses: Class[] = [
  {
    id: "1",
    name: "JSS1A",
    level: 1,
    stream: "A",
    capacity: "40",
  },
  {
    id: "2",
    name: "JSS1B",
    level: 1,
    stream: "B",
    capacity: "35",
  },
  {
    id: "3",
    name: "JSS2A",
    level: 2,
    stream: "A",
    capacity: "40",
  },
];

// Default example subjects
const defaultSubjects: Subject[] = [
  {
    id: "1",
    name: "Mathematics",
    code: "MATH",
    classIds: ["1"], 
    description: "Core mathematics curriculum",
  },
  {
    id: "2",
    name: "English Language",
    code: "ENG",
    classIds: ["1"],
    description: "Core English language curriculum",
  },
];

export function SchoolSetupWizard() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { loading, error } = useSelector(
    (state: RootState) => state.setUp
  );

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  // Step 5 state
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const toggleTemplate = useCallback((id: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }, []);

  // Step 1 state
  const currentYear = new Date().getFullYear();
  const [terms, setTerms] = useState<Term[]>(defaultTerms);
  const [academicYear, setAcademicYear] = useState(`${currentYear}/${currentYear + 1}`);
  const [sessionStartDate, setSessionStartDate] = useState(`${currentYear}-09-01`);
  const [sessionEndDate, setSessionEndDate] = useState(`${currentYear + 1}-07-31`);

  // Step 2 state
  const [classes, setClasses] = useState<Class[]>(defaultClasses);

  // Step 3 state
  const [subjects, setSubjects] = useState<Subject[]>(defaultSubjects);

  // Step 4 state
  const [gradingSystemType, setGradingSystemType] = useState("letter");
  const [passingGrade, setPassingGrade] = useState("60");
  const [maximumPoints, setMaximumPoints] = useState("100");
  const [gradeScales, setGradeScales] =
    useState<GradeScale[]>(defaultGradeScales);

  // Subjects modal state
  const [subjectsModalOpen, setSubjectsModalOpen] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [subjectDescription, setSubjectDescription] = useState("");

  const progressPercentage = useMemo(() => (currentStep / totalSteps) * 100, [currentStep, totalSteps]);



  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const toggleClass = useCallback((id: string) => {
    setSelectedClasses((prev) =>
      prev.includes(id) ? prev.filter((clsId) => clsId !== id) : [...prev, id]
    );
  }, []);

  const formatStartDate = useCallback((dateStr: string) => `${dateStr}T00:00:00.000Z`, []);
  const formatEndDate = useCallback((dateStr: string) => `${dateStr}T23:59:59.000Z`, []);

  const validateStep1 = useCallback(() => {
    if (!academicYear || !sessionStartDate || !sessionEndDate) {
      toast.error("Please fill in all session fields");
      return false;
    }

    if (terms.length === 0) {
      toast.error("Please add at least one term");
      return false;
    }

    const incompleteTerms = terms.filter(
      (term) => !term.name || !term.startDate || !term.endDate
    );
    if (incompleteTerms.length > 0) {
      toast.error("Please complete all term fields");
      return false;
    }

    if (new Date(sessionStartDate) >= new Date(sessionEndDate)) {
      toast.error("Session start date must be before the end date");
      return false;
    }

    const invalidTerm = terms.find((term) => new Date(term.startDate) >= new Date(term.endDate));
    if (invalidTerm) {
      toast.error(`${invalidTerm.name || "A term"} must start before it ends`);
      return false;
    }

    return true;
  }, [academicYear, sessionStartDate, sessionEndDate, terms]);

  const validateStep2 = useCallback(() => {
    if (classes.length === 0) {
      toast.error("Please add at least one class");
      return false;
    }

    const incompleteClasses = classes.filter(
      (cls) => !cls.name || !cls.capacity || !cls.level || !cls.stream
    );
    if (incompleteClasses.length > 0) {
      toast.error("Please complete all class fields");
      return false;
    }

    const invalidCapacity = classes.find((cls) => Number(cls.capacity) < 1);
    if (invalidCapacity) {
      toast.error(`${invalidCapacity.name || "A class"} must have a valid capacity`);
      return false;
    }

    return true;
  }, [classes]);

  const validateStep3 = useCallback(() => {
    if (subjects.length === 0) {
      toast.error("Please add at least one subject");
      return false;
    }

    const incompleteSubject = subjects.find(
      (subject) => !subject.name || !subject.code || subject.classIds.length === 0
    );
    if (incompleteSubject) {
      toast.error("Please complete each subject and assign it to at least one class");
      return false;
    }

    return true;
  }, [subjects]);

  const validateStep4 = useCallback(() => {
    const invalidScale = gradeScales.find(
      (scale) =>
        !scale.letter ||
        scale.minPoints < 0 ||
        scale.maxPoints > 100 ||
        scale.minPoints > scale.maxPoints
    );
    if (invalidScale) {
      toast.error("Please fix the grading scale ranges before continuing");
      return false;
    }
    return true;
  }, [gradeScales]);

  const buildSetupPayload = useCallback(() => {
    const activeTerm = terms[0];
    const gradingSystemMap: Record<string, string> = {
      letter: "letter_grade",
      percentage: "percentage",
      gpa: "letter_grade",
      custom: "percentage",
    };

    return {
      currentSession: academicYear,
      currentTerm: activeTerm?.name || "Term 1",
      session: {
        session: academicYear,
        startsAt: formatStartDate(sessionStartDate),
        endsAt: formatEndDate(sessionEndDate),
        terms: terms.map((term) => ({
          term: term.name,
          startsAt: formatStartDate(term.startDate),
          endsAt: formatEndDate(term.endDate),
        })),
      },
      classes: classes.map((cls) => ({
        localId: cls.id,
        name: cls.name.trim(),
        level: Number(cls.level),
        stream: cls.stream.trim().toUpperCase(),
        capacity: Number(cls.capacity),
      })),
      subjects: subjects.map((subject) => ({
        name: subject.name.trim(),
        code: subject.code.trim().toUpperCase(),
        classIds: subject.classIds,
        description: subject.description?.trim() || undefined,
      })),
      gradingSystem: gradingSystemMap[gradingSystemType] || "percentage",
      gradeBoundaries: gradeScales.map((scale) => ({
        grade: scale.letter.trim(),
        min: scale.minPoints,
        max: scale.maxPoints,
        description: scale.description || `${scale.letter} Grade`,
      })),
      settings: {
        timezone: "Africa/Lagos",
        currency: "NGN",
        enableParentPortal: true,
        enableEmailNotifications: true,
      },
      selectedReportCardTemplateIds: selectedTemplateIds,
    };
  }, [
    academicYear,
    classes,
    formatEndDate,
    formatStartDate,
    gradeScales,
    gradingSystemType,
    selectedTemplateIds,
    sessionEndDate,
    sessionStartDate,
    subjects,
    terms,
  ]);

  const handleFinishSetup = useCallback(async () => {
    if (!validateStep1() || !validateStep2() || !validateStep3() || !validateStep4()) return;

    try {
      await dispatch(onboardingSetup(buildSetupPayload())).unwrap();
      toast.success("School setup completed successfully!");
      dispatch(clearSuccess());
      dispatch(clearError());
      dispatch(clearWizardData());
      router.push(routespath.DASHBOARD);
    } catch (error: any) {
      toast.error(error?.message || String(error) || "Failed to complete school setup");
    }
  }, [
    buildSetupPayload,
    dispatch,
    router,
    validateStep1,
    validateStep2,
    validateStep3,
    validateStep4,
  ]);

  const stepNames = useMemo(() => [
    "Session",
    "Classes",
    "Subjects",
    "Grading",
    "Templates",
  ], []);

  const handleBack = useCallback(() => {
    setCurrentStep(Math.max(1, currentStep - 1));
  }, [currentStep]);

  const handleNext = useCallback(async () => {
    let success = true;

    if (currentStep === 1) success = validateStep1();
    else if (currentStep === 2) success = validateStep2();
    else if (currentStep === 3) success = validateStep3();
    else if (currentStep === 4) success = validateStep4();

    if (success || currentStep === 5) {
      setCurrentStep(Math.min(totalSteps, currentStep + 1));
    }
  }, [currentStep, totalSteps, validateStep1, validateStep2, validateStep3, validateStep4]);

  return (
    <div className="min-h-screen bg-slate-50">
      <AuthHeader />
      <div className="py-6 sm:py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="space-y-6 sm:space-y-8">
          {/* Page Title */}
            <div className="flex justify-between items-start w-full">
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  School Setup Wizard
                </h1>
                <p className="text-sm sm:text-base text-slate-600">
                  Complete the setup process to get started with your school management system
                </p>
              </div>
            </div>

          {/* Wizard Steps */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8">
            <div className="space-y-6">
              {/* Step Indicators */}
              <div className="flex items-center justify-between">
                {stepNames.map((name, index) => {
                  const stepNum = index + 1;
                  const isActive = currentStep === stepNum;
                  const isCompleted = currentStep > stepNum;
                  
                  return (
                    <div key={stepNum} className="flex flex-col items-center flex-1">
                      <div className="flex items-center w-full">
                        {/* Step Badge */}
                        <div className="flex flex-col items-center flex-1">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                              isActive
                                ? "bg-gradient-to-br from-[#641BC4] to-[#8538E0] text-white shadow-md"
                                : isCompleted
                                ? "bg-slate-300 text-slate-600"
                                : "bg-slate-200 text-slate-400"
                            }`}
                          >
                            {stepNum}
                          </div>
                          <p
                            className={`mt-2 text-xs sm:text-sm font-medium ${
                              isActive ? "text-slate-900" : "text-slate-500"
                            }`}
                          >
                            {name}
                          </p>
                          {isActive && (
                            <p className="mt-1 text-xs text-slate-600">
                              Step {stepNum} of {totalSteps}
                            </p>
                          )}
                        </div>
                        
                        {/* Connector Line */}
                        {stepNum < totalSteps && (
                          <div className="flex-1 h-0.5 mx-2 -mt-5">
                            <div
                              className={`h-full transition-all ${
                                isCompleted
                                  ? "bg-gradient-to-r from-[#641BC4] to-[#8538E0]"
                                  : "bg-slate-200"
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#641BC4] to-[#8538E0] transition-all duration-500 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-600">
                    Step {currentStep} of {totalSteps}
                  </span>
                  <span className="text-slate-500">
                    {Math.round(progressPercentage)}% complete
                  </span>
                </div>
              </div>
            </div>
          </div>

        {/* Step Content */}
        {currentStep === 1 && (
          <Step1SessionSetup
            academicYear={academicYear}
            setAcademicYear={setAcademicYear}
            sessionStartDate={sessionStartDate}
            setSessionStartDate={setSessionStartDate}
            sessionEndDate={sessionEndDate}
            setSessionEndDate={setSessionEndDate}
            terms={terms}
            setTerms={setTerms}
            loading={loading}
          />
        )}

        {currentStep === 2 && (
          <Step2ClassesGrades classes={classes} setClasses={setClasses} />
        )}

        {currentStep === 3 && (
          <Step3Subjects 
            onAddSubject={() => setSubjectsModalOpen(true)}
            subjects={subjects}
            classes={classes}
            onRemoveSubject={(id) => setSubjects(subjects.filter((s) => s.id !== id))}
          />
        )}

        {currentStep === 4 && (
          <Step4GradingSystem
            academicYear={academicYear}
            setAcademicYear={setAcademicYear}
            gradingSystemType={gradingSystemType}
            setGradingSystemType={setGradingSystemType}
            passingGrade={passingGrade}
            setPassingGrade={setPassingGrade}
            maximumPoints={maximumPoints}
            setMaximumPoints={setMaximumPoints}
            gradeScales={gradeScales}
            setGradeScales={setGradeScales}
          />
        )}

        {currentStep === 5 && (
          <Step5ReportCardTemplates
            selectedTemplateIds={selectedTemplateIds}
            onToggle={toggleTemplate}
          />
        )}

        {/* Navigation Buttons */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mt-6">
          <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="w-full sm:w-auto h-11 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 font-semibold text-sm rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {currentStep === totalSteps ? (
              <Button 
                onClick={handleFinishSetup}
                disabled={loading}
                className="w-full sm:w-auto h-11 bg-gradient-to-r from-[#641BC4] to-[#8538E0] hover:from-[#5a2ba8] hover:to-[#7530c7] text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Processing..." : "Finish Set Up"}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                className="w-full sm:w-auto h-11 bg-gradient-to-r from-[#641BC4] to-[#8538E0] hover:from-[#5a2ba8] hover:to-[#7530c7] text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all rounded-lg"
              >
                Next
              </Button>
            )}
          </div>
        </div>
        </div>
        </div>
      </div>

      {/* Subjects Management Modal */}
      <SubjectsManagementModal
        open={subjectsModalOpen}
        onOpenChange={setSubjectsModalOpen}
        subjectName={subjectName}
        setSubjectName={setSubjectName}
        subjectCode={subjectCode}
        setSubjectCode={setSubjectCode}
        selectedClasses={selectedClasses}
        setSelectedClasses={setSelectedClasses}
        toggleClass={toggleClass}
        subjectDescription={subjectDescription}
        setSubjectDescription={setSubjectDescription}
        classes={classes}
        onAddSubject={(subject) => {
          setSubjects((prev) => [...prev, subject]);
        }}
      />
    </div>
  );
}
