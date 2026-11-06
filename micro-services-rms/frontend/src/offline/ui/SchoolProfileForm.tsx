"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProfile, type SchoolProfile } from "../storage/db";
import { imageToPngBytes } from "./logo";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** School details printed at the top of every card; stored on this laptop */
export default function SchoolProfileForm({
  initial,
  onSaved,
  firstRun = false,
}: {
  initial: SchoolProfile;
  onSaved: (p: SchoolProfile) => void;
  firstRun?: boolean;
}) {
  const [form, setForm] = useState<SchoolProfile>(initial);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setForm(initial), [initial]);

  const logoUrl = useMemo(
    () => (form.logo ? URL.createObjectURL(new Blob([form.logo.bytes as BlobPart], { type: form.logo.type === "png" ? "image/png" : "image/jpeg" })) : null),
    [form.logo]
  );
  useEffect(() => () => {
    if (logoUrl) URL.revokeObjectURL(logoUrl);
  }, [logoUrl]);

  const set = (k: Exclude<keyof SchoolProfile, "logo">) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickLogo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file (PNG, JPG or SVG).");
      return;
    }
    try {
      setForm((f) => ({ ...f, logo: null }));
      const bytes = await imageToPngBytes(file);
      setForm((f) => ({ ...f, logo: { bytes, type: "png" } }));
    } catch {
      toast.error("That image couldn't be read. Try a PNG or JPG.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.schoolName.trim()) return toast.error("Enter the school's name.");
    if (!HEX.test(form.color)) return toast.error("Use a colour like #641bc4.");
    setSaving(true);
    const clean: SchoolProfile = {
      ...form,
      schoolName: form.schoolName.trim(),
      motto: form.motto.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
    };
    await saveProfile(clean);
    setSaving(false);
    toast.success("School profile saved on this laptop.");
    onSaved(clean);
  };

  const color = HEX.test(form.color) ? form.color : "#641bc4";

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={submit} className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-5 sm:p-6">
        {firstRun && (
          <p className="rounded-[var(--radius-md)] bg-[var(--violet-tint)] px-3 py-2 text-sm text-[var(--violet-ink)]">
            Check how your school appears on report cards. You can change this any time.
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="schoolName">School name</Label>
          <Input id="schoolName" value={form.schoolName} onChange={set("schoolName")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="motto">Motto</Label>
          <Input id="motto" value={form.motto} onChange={set("motto")} placeholder="e.g. Knowledge and Integrity" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <Input id="address" value={form.address} onChange={set("address")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" value={form.phone} onChange={set("phone")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">School email</Label>
            <Input id="email" type="email" value={form.email} onChange={set("email")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Logo</Label>
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="mr-1.5 h-4 w-4" />
              {form.logo ? "Change logo" : "Add logo"}
            </Button>
            {form.logo && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, logo: null }))}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="color">Card colour</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Pick card colour"
              value={color}
              onChange={set("color")}
              className="h-9 w-12 cursor-pointer rounded-[var(--radius-md)] border border-[var(--border-fine)] bg-white p-1"
            />
            <Input id="color" value={form.color} onChange={set("color")} className="font-mono" />
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {firstRun ? "Save and continue" : "Save profile"}
        </Button>
      </form>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-secondary)]">Card header preview</h2>
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white shadow-[var(--shadow-card)]">
          <div className="h-2" style={{ backgroundColor: color }} />
          <div className="flex items-center gap-4 p-5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-16 w-16 shrink-0 object-contain" />
            ) : (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-lg font-bold text-white" style={{ backgroundColor: color }}>
                {(form.schoolName || "S")
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join("")}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold uppercase" style={{ color }}>
                {form.schoolName || "Your school name"}
              </p>
              {form.motto && <p className="truncate text-xs italic text-[var(--text-secondary)]">&ldquo;{form.motto}&rdquo;</p>}
              <p className="truncate text-xs text-[var(--text-secondary)]">
                {[form.address, form.phone, form.email].filter(Boolean).join(" | ") || "Address | phone | email"}
              </p>
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          Report cards already generated keep the old details. Open a batch and choose &ldquo;Redo cards&rdquo; to update them.
        </p>
      </div>
    </div>
  );
}
