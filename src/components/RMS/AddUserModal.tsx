"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, User, Mail, Phone, Info, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Step = "profile";

export type UserType = "student" | "teacher" | "vp" | "accountant";

type AddUserModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: UserType;
  onTypeChange: (type: UserType) => void;
  primaryColor: string;
  onSuccess: () => void;
};

export function AddUserModal({
  open,
  onOpenChange,
  type,
  onTypeChange,
  primaryColor,
  onSuccess,
}: AddUserModalProps) {
  const [step, setStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Profile data
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [address, setAddress] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");


  const steps: { id: Step; label: string; icon: typeof User }[] = [
    { id: "profile", label: "Profile", icon: User },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  const resetForm = () => {
    setStep("profile");
    setFullName("");
    setEmail("");
    setPhone("");
    setDateOfBirth("");
    setGender("");
    setAddress("");
    setGuardianName("");
    setGuardianPhone("");
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleNext = () => {
    if (!fullName.trim()) return toast.error("Please enter the full name");
    if (!email.trim()) return toast.error("Please enter the email address");
    handleSubmit();
  };

  const handleBack = () => {};

  const validateForm = () => {
    // Name validation: No numbers allowed
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(fullName.trim())) {
      setErrorMessage("Full Name should not contain numbers or special characters");
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage("Please enter a valid email address");
      return false;
    }

    // Phone validation (if provided, it must be valid)
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length > 0 && phoneDigits.length < 10) {
      setErrorMessage("Phone number must be at least 10 digits");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    setErrorMessage(null);
    try {
      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // @ts-ignore
      const { apiFetch } = await import("@/lib/interceptor");
      
      // Format date to ISO
      const dateTime = dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined;

      const payload = {
        firstName,
        lastName,
        email: email.trim(),
        personalEmail: email.trim(),
        phoneNumber: phone.trim() || undefined,
        dateOfBirth: dateTime,
        gender: gender || undefined,
        address: address.trim() || undefined,
        roles: [type],
        guardianName: type === "student" ? guardianName.trim() || undefined : undefined,
        guardianPhone: type === "student" ? guardianPhone.trim() || undefined : undefined,
      };

      await apiFetch("/api/proxy/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const roleLabels: Record<string, string> = {
        student: "Student",
        teacher: "Teacher",
        vp: "Vice Principal",
        accountant: "Accountant",
      };
      toast.success(`${roleLabels[type] || type} added successfully!`);
      
      onSuccess();
      handleClose();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || error?.message || "Failed to add user";
      // Show inline banner inside modal (toast is hidden by backdrop-blur)
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };



  if (!open) return null;

  const roleTitleMap: Record<string, string> = {
    student: "Student",
    teacher: "Teacher",
    vp: "Vice Principal",
    accountant: "Accountant / Bursar",
  };

  return typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Add New {roleTitleMap[type] || "User"}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Fill in the information below to create a new {type} profile.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Type Toggle */}
          {step === "profile" && (
            <div className="grid grid-cols-4 gap-1.5 mt-4">
              {[
                { id: "student", label: "Student" },
                { id: "teacher", label: "Teacher" },
                { id: "vp", label: "Vice Principal" },
                { id: "accountant", label: "Accountant" },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onTypeChange(r.id as UserType)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all text-center ${
                    type === r.id
                      ? "text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  style={type === r.id ? { backgroundColor: primaryColor } : {}}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {/* Step Indicator */}
          {steps.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {steps.map((s, idx) => {
                const isCompleted = idx < currentStepIndex;
                const isCurrent = s.id === step;
                const Icon = s.icon;

                return (
                  <div key={s.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isCompleted
                            ? "text-white"
                            : isCurrent
                            ? "text-white"
                            : "bg-slate-100 text-slate-400"
                        }`}
                        style={
                          isCompleted || isCurrent
                            ? { backgroundColor: primaryColor }
                            : {}
                        }
                      >
                        {isCompleted ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                      <span
                        className={`text-xs font-medium mt-1.5 ${
                          isCurrent ? "text-slate-900" : "text-slate-500"
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {idx < steps.length - 1 && (
                      <div
                        className={`w-16 h-0.5 mx-2 mb-5 ${
                          isCompleted ? "" : "bg-slate-200"
                        }`}
                        style={isCompleted ? { backgroundColor: primaryColor } : {}}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-6 pb-2 flex-1 overflow-y-auto">

          {/* Inline error banner — always visible inside the modal regardless of backdrop-blur */}
          {errorMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-9.25a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3zm.75 6a.875.875 0 100-1.75.875.875 0 000 1.75z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-red-700">{errorMessage}</p>
            </div>
          )}
          {step === "profile" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Full Name <span className="text-red-500">*</span></label>
                <div className="relative mt-2">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="pl-10 h-12 rounded-xl border-slate-200 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Email Address <span className="text-red-500">*</span></label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="sarah.jenkins@paralearn.edu"
                      className="pl-10 h-12 rounded-xl border-slate-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Phone Number <span className="text-slate-400 font-normal">(Optional)</span></label>
                  <div className="relative mt-2">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="pl-10 h-12 rounded-xl border-slate-200"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Date of Birth <span className="text-slate-400 font-normal">(Optional)</span></label>
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="mt-2 h-12 rounded-xl border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Gender <span className="text-slate-400 font-normal">(Optional)</span></label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="mt-2 w-full h-12 rounded-xl border border-slate-200 px-4 bg-white text-slate-700"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Address <span className="text-slate-400 font-normal">(Optional)</span></label>
                <div className="relative mt-2">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Residential Address"
                    className="pl-10 h-12 rounded-xl border-slate-200"
                  />
                </div>
              </div>

              {type === "student" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Guardian Name <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <Input
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Parent/Guardian Name"
                      className="mt-2 h-12 rounded-xl border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Guardian Phone <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <Input
                      type="tel"
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      placeholder="Guardian Phone"
                      className="mt-2 h-12 rounded-xl border-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* Info box */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 text-sm">Credentials Delivery</p>
                  <p className="text-blue-700 text-sm mt-0.5">
                    {type === "teacher"
                      ? "Login credentials will be emailed to this personal email address after the teacher is created."
                      : "An automated email with login instructions will be sent to the address provided above."}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <Button
            variant="outline"
            onClick={currentStepIndex > 0 ? handleBack : handleClose}
            className="h-11 px-6 rounded-xl border-slate-200"
          >
            {currentStepIndex > 0 ? "Back" : "Cancel"}
          </Button>
          <Button
            onClick={handleNext}
            disabled={loading}
            className="h-11 px-6 rounded-xl text-white gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            {loading ? "Creating..." : (
              <>
                Create {type === "teacher" ? "Teacher" : "Student"}
                <Check className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>, document.body) : null;
}
