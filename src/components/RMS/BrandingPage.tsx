"use client";

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import Image from "next/image";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { Header } from "@/components/RMS/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Palette,
  Upload,
  Globe,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Eye,
  Sparkles,
  ShieldCheck,
  Building2,
  Trash2,
} from "lucide-react";
import {
  useGetSchoolBrandingQuery,
  useUpdateSchoolBrandingMutation,
} from "@/reduxToolKit/api/endpoints/tenant";
import { getTenantInfo } from "@/reduxToolKit/user/userThunks";

const PRESET_PALETTES = [
  { name: "Royal Navy", primary: "#1e3a8a", secondary: "#172554", accent: "#3b82f6" },
  { name: "Deep Emerald", primary: "#065f46", secondary: "#064e3b", accent: "#10b981" },
  { name: "Regal Purple", primary: "#641bc4", secondary: "#4c1d95", accent: "#a855f7" },
  { name: "Crimson Maroon", primary: "#881337", secondary: "#4c0519", accent: "#e11d48" },
  { name: "Ocean Teal", primary: "#0f766e", secondary: "#134e4a", accent: "#14b8a6" },
];

export default function BrandingPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { tenantInfo } = useSelector((s: RootState) => s.user);

  const { data: brandingData, isLoading, refetch } = useGetSchoolBrandingQuery();
  const [updateBranding, { isLoading: isSaving }] = useUpdateSchoolBrandingMutation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    primaryColor: "#1e3a8a",
    secondaryColor: "#172554",
    accentColor: "#3b82f6",
    motto: "",
    domain: "",
    schoolName: "",
    address: "",
    phoneNumber: "",
  });

  const [logoPreview, setLogoPreview] = useState<string>("");
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    if (brandingData || tenantInfo) {
      const source = brandingData || tenantInfo;
      setForm({
        primaryColor: source?.primaryColor || "#1e3a8a",
        secondaryColor: source?.secondaryColor || "#172554",
        accentColor: source?.accentColor || "#3b82f6",
        motto: source?.motto || "",
        domain: source?.domain || "",
        schoolName: source?.name || tenantInfo?.name || "",
        address: tenantInfo?.address || "",
        phoneNumber: tenantInfo?.phoneNumber || "",
      });
      setLogoPreview(source?.logoUrl || tenantInfo?.logoUrl || "");
    }
  }, [brandingData, tenantInfo]);

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, or SVG)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo file must be smaller than 2MB");
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

  const handleRemoveLogo = () => {
    setLogoBase64(null);
    setLogoPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        accentColor: form.accentColor,
        motto: form.motto.trim() || undefined,
        domain: form.domain.trim() || undefined,
        schoolName: form.schoolName.trim() || undefined,
        address: form.address.trim() || undefined,
        phoneNumber: form.phoneNumber.trim() || undefined,
        ...(logoBase64 ? { logoUrl: logoBase64 } : logoPreview === "" ? { logoUrl: "" } : {}),
      };

      await updateBranding(payload).unwrap();
      toast.success("School visual identity and branding updated successfully!");
      setLogoBase64(null);
      dispatch(getTenantInfo());
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to update branding settings");
    }
  };

  const applyPreset = (preset: typeof PRESET_PALETTES[0]) => {
    setForm((prev) => ({
      ...prev,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent,
    }));
  };

  return (
    <div className="w-full min-h-screen bg-slate-50/50 pb-16">
      <Header
        schoolLogo={logoPreview || tenantInfo?.logoUrl}
        schoolName={form.schoolName || tenantInfo?.name || "ParaLearn School"}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Top Title Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-border shadow-xs">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md transition-colors"
              style={{ backgroundColor: form.primaryColor }}
            >
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                School Branding &amp; Visual Identity
              </h1>
              <p className="text-sm text-muted-foreground">
                Customize your official colors, crest, school motto, and custom subdomain.
              </p>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="gap-2 shrink-0"
            style={{ backgroundColor: form.primaryColor }}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Save &amp; Apply Branding
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form Fields (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Color Palette */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" />
                  Brand Color Palette
                </CardTitle>
                <CardDescription>
                  These colors define your student dashboard, report card header, and badges.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preset quick picker */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Preset Color Schemes</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_PALETTES.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:border-slate-400 bg-white transition-all shadow-2xs"
                      >
                        <div className="flex -space-x-1">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white"
                            style={{ backgroundColor: preset.primary }}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white"
                            style={{ backgroundColor: preset.accent }}
                          />
                        </div>
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Primary Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.primaryColor}
                        onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                        className="w-9 h-9 rounded-md border p-0.5 cursor-pointer bg-transparent"
                      />
                      <Input
                        value={form.primaryColor}
                        onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                        className="font-mono text-xs uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Secondary Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.secondaryColor}
                        onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                        className="w-9 h-9 rounded-md border p-0.5 cursor-pointer bg-transparent"
                      />
                      <Input
                        value={form.secondaryColor}
                        onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                        className="font-mono text-xs uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.accentColor}
                        onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                        className="w-9 h-9 rounded-md border p-0.5 cursor-pointer bg-transparent"
                      />
                      <Input
                        value={form.accentColor}
                        onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                        className="font-mono text-xs uppercase"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. School Crest & Logo */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  Official School Crest / Logo
                </CardTitle>
                <CardDescription>
                  Appears on official PDF report cards, login pages, and navigation bars.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-5">
                  <div className="relative w-20 h-20 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {logoPreview ? (
                      <Image
                        src={logoPreview}
                        alt="School Logo"
                        fill
                        className="object-contain p-2"
                        unoptimized
                      />
                    ) : (
                      <Building2 className="w-8 h-8 text-slate-400" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFile}
                      className="hidden"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-1.5 text-xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {logoPreview ? "Change Logo" : "Upload Logo"}
                      </Button>
                      {logoPreview && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveLogo}
                          className="gap-1 text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recommended: High-resolution PNG or SVG with transparent background (Max 2MB).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Motto & Custom Domain */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Domain &amp; Institutional Motto
                </CardTitle>
                <CardDescription>
                  Configure your school motto and custom domain routing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">School Motto</Label>
                  <Input
                    placeholder="e.g. Floreat Collegium / Knowledge is Light"
                    value={form.motto}
                    onChange={(e) => setForm({ ...form, motto: e.target.value })}
                  />
                  <p className="text-2xs text-muted-foreground">
                    Printed under the school crest on certified report cards.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Custom Domain (Optional)</Label>
                  <Input
                    placeholder="e.g. portal.kingscollege.edu.ng"
                    value={form.domain}
                    onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  />
                  <p className="text-2xs text-muted-foreground">
                    Point your CNAME record to <code>cname.pln.ng</code> for custom domain activation.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Preview Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="sticky top-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5 text-slate-800">
                  <Eye className="w-4 h-4 text-primary" />
                  Real-time Visual Preview
                </h3>
                <span className="text-2xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                  Live Preview
                </span>
              </div>

              {/* Sample Report Card Header Preview */}
              <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden divide-y">
                {/* Header Strip in Primary Color */}
                <div
                  className="p-5 text-white transition-colors flex items-center justify-between"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-white/10 backdrop-blur-xs flex items-center justify-center p-1 overflow-hidden shrink-0 border border-white/20">
                      {logoPreview ? (
                        <Image
                          src={logoPreview}
                          alt="Crest Preview"
                          width={40}
                          height={40}
                          className="object-contain"
                          unoptimized
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-white/80" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-base leading-tight">
                        {form.schoolName || tenantInfo?.name || "King's College Lagos"}
                      </p>
                      <p className="text-xs text-white/80 italic mt-0.5">
                        {form.motto || "Floreat Collegium"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sub-strip with Secondary & Accent Badges */}
                <div className="p-4 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Report Card Terminal Header</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-white text-2xs font-semibold"
                      style={{ backgroundColor: form.accentColor }}
                    >
                      Term 1 Verified
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-700">Student Name</span>
                      <span className="font-semibold text-slate-900">Emeka Chukwu</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-700">Class</span>
                      <span className="font-semibold text-slate-900">JSS 1 Gold</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-700">Academic Decision</span>
                      <span className="text-emerald-700 font-bold">PASSED (88.4%)</span>
                    </div>
                  </div>

                  {/* Tamper-proof badge preview */}
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-2xs">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>Tamper-Proof Verification: <strong>pln.ng/verify/...</strong></span>
                  </div>
                </div>
              </div>

              {/* Subdomain Info Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                <p className="font-semibold text-slate-800">Your Active Subdomain</p>
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg font-mono text-slate-700">
                  <span>
                    {brandingData?.subdomain || tenantInfo?.subdomain || "school"}.pln.ng
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xs text-muted-foreground">
                  Teachers and students can access your portal directly via this address.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
