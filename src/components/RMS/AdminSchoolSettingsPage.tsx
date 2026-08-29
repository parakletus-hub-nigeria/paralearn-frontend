"use client";

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import Image from "next/image";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { getTenantInfo, updateSchoolBranding } from "@/reduxToolKit/user/userThunks";
import { Header } from "@/components/RMS/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Save,
  Palette,
  Building2,
  Globe,
  Phone,
  MapPin,
  Settings,
  FileText,
  Upload,
  X,
  ImageIcon,
} from "lucide-react";

const ReportCardTemplateSettings = dynamic(
  () => import("@/components/settings/ReportCardTemplateSettings").then(m => ({ default: m.ReportCardTemplateSettings })),
  { ssr: false }
);

export const AdminSchoolSettingsPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { tenantInfo, loading } = useSelector((state: RootState) => state.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [brandingData, setBrandingData] = useState({
    logoUrl: "",
    primaryColor: "#641BC4",
    secondaryColor: "#9747FF",
    accentColor: "#AD8ED6",
    motto: "",
    domain: "",
  });

  const [infoData, setInfoData] = useState({
    schoolName: "",
    address: "",
    phoneNumber: "",
    website: "",
  });
  // local preview: base64 string if file picked, otherwise the saved URL
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    dispatch(getTenantInfo());
  }, [dispatch]);

  useEffect(() => {
    if (tenantInfo) {
      setBrandingData({
        logoUrl: tenantInfo.logoUrl || "",
        primaryColor: tenantInfo.primaryColor || "#641BC4",
        secondaryColor: tenantInfo.secondaryColor || "#9747FF",
        accentColor: tenantInfo.accentColor || "#AD8ED6",
        motto: tenantInfo.motto || "",
        domain: tenantInfo.domain || "",
      });
      setInfoData({
        schoolName: tenantInfo.name || "",
        address: tenantInfo.address || "",
        phoneNumber: tenantInfo.phoneNumber || "",
        website: tenantInfo.website || "",
      });
      setLogoPreview(tenantInfo.logoUrl || "");
      setLogoBase64(null);
    }
  }, [tenantInfo]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setLogoBase64(base64);
      setLogoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoBase64(null);
    setLogoPreview("");
    setBrandingData((prev) => ({ ...prev, logoUrl: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // If a new file was picked, send base64 as logoUrl — backend detects it and uploads to Cloudinary
      const payload = {
        ...brandingData,
        ...(logoBase64 ? { logoUrl: logoBase64 } : {}),
      };
      await dispatch(updateSchoolBranding(payload)).unwrap();
      toast.success("Settings saved!");
      setLogoBase64(null);
      dispatch(getTenantInfo());
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dispatch(updateSchoolBranding(infoData)).unwrap();
      toast.success("School information saved!");
      dispatch(getTenantInfo());
    } catch {
      toast.error("Failed to save school information");
    }
  };

  return (
    <div className="w-full pb-8">
      <Header
        schoolLogo={tenantInfo?.logoUrl}
        schoolName={tenantInfo?.name || "ParaLearn School"}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-8">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-md" style={{ backgroundColor: "var(--violet-ink)" }}>
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>School Settings</h1>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Manage your school information and branding</p>
          </div>
        </div>

        {/* ── School Information ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid var(--border-medium)" }}>
          <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ background: "var(--violet-tint)", borderColor: "var(--border-fine)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--violet-ink)" }}>
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold" style={{ color: "var(--foreground)" }}>School Information</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Your registered school details</p>
            </div>
          </div>
          <form onSubmit={handleSaveInfo} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="schoolName" className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>School Name</Label>
              <Input id="schoolName" value={infoData.schoolName}
                onChange={(e) => setInfoData({ ...infoData, schoolName: e.target.value })}
                placeholder="School Name"
                className="h-11 rounded-xl" />
            </div>

            <div className="space-y-1.5 p-4 rounded-xl" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-medium)" }}>
              <Label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Subdomain</Label>
              <p className="font-bold mt-1" style={{ color: "var(--foreground)" }}>
                {tenantInfo?.subdomain || "—"}
                {tenantInfo?.subdomain && <span className="font-normal text-sm ml-1" style={{ color: "var(--foreground-muted)" }}>.pln.ng</span>}
              </p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Subdomain is read-only.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-sm font-semibold flex items-center gap-1" style={{ color: "var(--foreground)" }}>
                <MapPin className="w-3 h-3" /> Address
              </Label>
              <Input id="address" value={infoData.address}
                onChange={(e) => setInfoData({ ...infoData, address: e.target.value })}
                placeholder="School Address"
                className="h-11 rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phoneNumber" className="text-sm font-semibold flex items-center gap-1" style={{ color: "var(--foreground)" }}>
                <Phone className="w-3 h-3" /> Phone Number
              </Label>
              <Input id="phoneNumber" value={infoData.phoneNumber}
                onChange={(e) => setInfoData({ ...infoData, phoneNumber: e.target.value })}
                placeholder="Phone Number"
                className="h-11 rounded-xl" />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="website" className="text-sm font-semibold flex items-center gap-1" style={{ color: "var(--foreground)" }}>
                <Globe className="w-3 h-3" /> Website
              </Label>
              <Input id="website" value={infoData.website}
                onChange={(e) => setInfoData({ ...infoData, website: e.target.value })}
                placeholder="https://yourschool.com"
                className="h-11 rounded-xl" />
            </div>

            <div className="sm:col-span-2 flex justify-end pt-2 border-t mt-2" style={{ borderColor: "var(--border-fine)" }}>
              <Button type="submit" disabled={loading}
                className="h-11 px-6 rounded-xl text-white gap-2"
                style={{ backgroundColor: "#641BC4" }}>
                <Save className="w-4 h-4" />
                {loading ? "Saving…" : "Save Information"}
              </Button>
            </div>
          </form>
        </div>

        {/* ── Report Card Templates ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ background: "var(--violet-tint)", borderColor: "var(--border-fine)" }}>
            <div className="w-9 h-9 rounded-xl bg-[#641BC4] flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Report Card Templates</p>
              <p className="text-xs text-slate-500">Manage templates for generating student report cards</p>
            </div>
          </div>
          <div className="p-6">
            <ReportCardTemplateSettings embedded />
          </div>
        </div>

        {/* ── Branding ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ background: "var(--violet-tint)", borderColor: "var(--border-fine)" }}>
            <div className="w-9 h-9 rounded-xl bg-[#641BC4] flex items-center justify-center">
              <Palette className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900">School Branding</p>
              <p className="text-xs text-slate-500">Upload logo, set colors, and motto</p>
            </div>
          </div>
          <form onSubmit={handleSave} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* ── Logo Upload ── */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" /> School Logo
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />
                <div className="flex items-center gap-3">
                  {/* Preview box */}
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {logoPreview ? (
                      <Image
                        src={logoPreview}
                        alt="Logo preview"
                        width={80}
                        height={80}
                        className="w-full h-full object-contain"
                        unoptimized={logoPreview.startsWith("data:")}
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full gap-2 rounded-xl border-slate-300"
                    >
                      <Upload className="w-4 h-4" />
                      {logoPreview ? "Change Logo" : "Upload Logo"}
                    </Button>
                    {logoPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearLogo}
                        className="w-full gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                      >
                        <X className="w-4 h-4" />
                        Remove
                      </Button>
                    )}
                    <p className="text-xs text-slate-400">PNG, JPG, SVG · max 2 MB</p>
                    {logoBase64 && (
                      <p className="text-xs text-emerald-600 font-medium">New logo ready to save</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="motto" className="text-sm font-semibold text-slate-700">Motto</Label>
                  <Input id="motto" value={brandingData.motto}
                    onChange={(e) => setBrandingData({ ...brandingData, motto: e.target.value })}
                    placeholder="Your school motto"
                    className="h-11 rounded-xl border-slate-200" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="domain" className="text-sm font-semibold text-slate-700">Custom Domain (Optional)</Label>
                  <Input id="domain" value={brandingData.domain}
                    onChange={(e) => setBrandingData({ ...brandingData, domain: e.target.value })}
                    placeholder="e.g. portal.kingscollege.edu.ng"
                    className="h-11 rounded-xl border-slate-200" />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold text-slate-700 mb-3 block">Colors</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { id: "primaryColor", label: "Primary", key: "primaryColor" as const },
                  { id: "secondaryColor", label: "Secondary", key: "secondaryColor" as const },
                  { id: "accentColor", label: "Accent", key: "accentColor" as const },
                ].map(({ id, label, key }) => (
                  <div key={id} className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <Label htmlFor={id} className="text-xs font-semibold text-slate-600">{label}</Label>
                    <div className="flex gap-2">
                      <input id={id} type="color" value={brandingData[key]}
                        onChange={(e) => setBrandingData({ ...brandingData, [key]: e.target.value })}
                        className="w-12 h-11 p-1 rounded-lg border-2 border-slate-200 cursor-pointer bg-white" />
                      <Input type="text" value={brandingData[key]}
                        onChange={(e) => setBrandingData({ ...brandingData, [key]: e.target.value })}
                        className="flex-1 h-11 rounded-xl border-slate-200 font-mono text-sm"
                        placeholder="#641BC4" />
                    </div>
                    <div className="h-8 rounded-lg border border-slate-200"
                      style={{ backgroundColor: brandingData[key] }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button type="submit" disabled={loading}
                className="h-11 px-6 rounded-xl text-white gap-2"
                style={{ backgroundColor: "#641BC4" }}>
                <Save className="w-4 h-4" />
                {loading ? "Saving…" : "Save Settings"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
