"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, User, Mail, Phone, MapPin, Calendar, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/reduxToolKit/store";
import { updateUserProfile, updateUserRoles, updateUserClasses } from "@/reduxToolKit/user/userThunks";

type UserRow = {
  id: string;
  dbId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "teacher" | "student" | "vp" | "accountant";
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: string;
  classId?: string;
};

type EditUserModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserRow | null;
  primaryColor: string;
  classes: any[];
  onSuccess: () => void;
};

export function EditUserModal({
  open,
  onOpenChange,
  user,
  primaryColor,
  classes = [],
  onSuccess,
}: EditUserModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [role, setRole] = useState<"teacher" | "student" | "vp" | "accountant">("student");
  const [classId, setClassId] = useState("");

  // Populate form when user changes
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setPhone(user.phoneNumber || "");
      setAddress(user.address || "");
      setRole(user.role || "student");
      setClassId(user.classId || "");
      
      if (user.dateOfBirth) {
        try {
          // Format ISO date to yyyy-MM-dd for input[type="date"]
          const date = new Date(user.dateOfBirth);
          const formattedDate = date.toISOString().split("T")[0];
          setDateOfBirth(formattedDate);
        } catch (e) {
          console.error("Failed to format date:", e);
          setDateOfBirth("");
        }
      } else {
        setDateOfBirth("");
      }
    }
  }, [user]);

  const handleClose = () => {
    setErrorMessage(null);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      await dispatch(
        updateUserProfile({
          userId: user.dbId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneNumber: phone.trim() || undefined,
          address: address.trim() || undefined,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
          gender: gender || undefined,
        })
      ).unwrap();

      // Update Roles if changed
      if (role !== user.role) {
        await dispatch(updateUserRoles({ userId: user.dbId, roles: [role] })).unwrap();
      }

      // Update Classes if changed (only relevant for students for now)
      if (role === "student" && classId !== (user.classId || "")) {
        if (classId) {
          await dispatch(updateUserClasses({ userId: user.dbId, classIds: [classId] })).unwrap();
        } else {
           // Optionally handle clearing class? The endpoint requires classIds array. Empty array means clear.
           await dispatch(updateUserClasses({ userId: user.dbId, classIds: [] })).unwrap();
        }
      }

      toast.success("User profile updated successfully!");
      onSuccess();
      handleClose();
    } catch (error: any) {
      setErrorMessage(error || "Failed to update user profile");
    } finally {
      setLoading(false);
    }
  };

  if (!open || !user) return null;

  return typeof document !== "undefined"
    ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 shrink-0 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Edit {user.role === "teacher" ? "Teacher" : "Student"}
                    </h2>
                    <p className="text-sm text-slate-500">
                      Update profile information for {user.firstName} {user.lastName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4">
              {errorMessage && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <p className="text-sm font-medium text-red-700">{errorMessage}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">First Name</label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First Name"
                      className="mt-1.5 h-11 rounded-xl border-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Last Name</label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last Name"
                      className="mt-1.5 h-11 rounded-xl border-slate-200"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as "student" | "teacher")}
                      className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 px-4 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-offset-1 transition-all"
                      style={{ "--tw-ring-color": primaryColor } as any}
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Class</label>
                    <select
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 px-4 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-offset-1 transition-all disabled:opacity-50 disabled:bg-slate-50"
                      style={{ "--tw-ring-color": primaryColor } as any}
                      disabled={role !== "student"}
                    >
                      <option value="">None</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">Email Address (Read-only)</label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={user.email}
                      readOnly
                      className="pl-10 h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Phone Number</label>
                    <div className="relative mt-1.5">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone Number"
                        className="pl-10 h-11 rounded-xl border-slate-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 px-4 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-offset-1 transition-all"
                      style={{ "--tw-ring-color": primaryColor } as any}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">Date of Birth</label>
                  <div className="relative mt-1.5">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="pl-10 h-11 rounded-xl border-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">Address</label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Residential Address"
                      className="w-full pl-10 pr-4 py-2.5 min-h-[80px] rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-offset-1 transition-all resize-none text-sm"
                      style={{ "--tw-ring-color": primaryColor } as any}
                    />
                  </div>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 shrink-0 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
              <Button
                variant="outline"
                onClick={handleClose}
                className="h-11 px-6 rounded-xl border-slate-200"
                type="button"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="h-11 px-8 rounded-xl text-white gap-2"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
}
