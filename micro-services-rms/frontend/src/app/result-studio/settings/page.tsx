"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import RmsShell from "@rms/components/ResultStudio/RmsShell";
import { rmsErrorMessage, useGetWorkspaceQuery, useUpdateWorkspaceMutation, type RmsWorkspace } from "@rms/store/rmsApi";

type Form = { [K in keyof Omit<RmsWorkspace, "id">]-?: string };
const EMPTY: Form = { name: "", logoUrl: "", motto: "", address: "", phoneNumber: "", email: "", primaryColor: "#641bc4" };
const HEX = /^#[0-9a-fA-F]{6}$/;

/** How the school's details sit at the top of every report card */
function CardHeaderPreview({ form }: { form: Form }) {
  const color = HEX.test(form.primaryColor || "") ? form.primaryColor : "#641bc4";
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white shadow-[var(--shadow-card)]">
      <div className="h-2" style={{ backgroundColor: color }} />
      <div className="flex items-center gap-4 p-5">
        {form.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.logoUrl} alt="" className="h-16 w-16 shrink-0 object-contain" />
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-lg font-bold text-white" style={{ backgroundColor: color }}>
            {(form.name || "S").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 text-center flex-1">
          <p className="truncate text-lg font-extrabold uppercase tracking-wide" style={{ color }}>
            {form.name || "Your school name"}
          </p>
          {form.motto && <p className="truncate text-xs italic text-[var(--text-secondary)]">&ldquo;{form.motto}&rdquo;</p>}
          <p className="truncate text-xs text-[var(--text-secondary)]">
            {[form.address, form.phoneNumber, form.email].filter(Boolean).join(" · ") || "Address · phone · email"}
          </p>
        </div>
      </div>
      <div className="border-t border-[var(--border-fine)] px-5 py-2 text-center text-xs font-bold tracking-widest" style={{ color }}>
        STUDENT REPORT CARD
      </div>
    </div>
  );
}

function SettingsForm() {
  const { data: workspace, isLoading } = useGetWorkspaceQuery();
  const [updateWorkspace, { isLoading: isSaving }] = useUpdateWorkspaceMutation();
  const [form, setForm] = useState<Form>(EMPTY);

  useEffect(() => {
    if (!workspace) return;
    setForm({
      name: workspace.name || "",
      logoUrl: workspace.logoUrl || "",
      motto: workspace.motto || "",
      address: workspace.address || "",
      phoneNumber: workspace.phoneNumber || "",
      email: workspace.email || "",
      primaryColor: workspace.primaryColor || EMPTY.primaryColor,
    });
  }, [workspace]);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("The school name can't be empty.");
      return;
    }
    if (form.primaryColor && !HEX.test(form.primaryColor)) {
      toast.error("Use a colour like #641bc4.");
      return;
    }
    if (form.logoUrl && !/^https:\/\//.test(form.logoUrl.trim())) {
      toast.error("The logo link must start with https://");
      return;
    }
    // Empty optional fields are sent as null so they can be cleared
    const body = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" && k !== "name" ? null : (v as string).trim()])
    );
    try {
      await updateWorkspace(body).unwrap();
      toast.success("School profile saved. New report cards will use it.");
    } catch (err) {
      toast.error(rmsErrorMessage(err, "Couldn't save the school profile."));
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form onSubmit={save} className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-5 sm:p-6">
        <div className="space-y-1.5">
          <Label htmlFor="name">School name</Label>
          <Input id="name" value={form.name} onChange={set("name")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="motto">Motto</Label>
          <Input id="motto" value={form.motto || ""} onChange={set("motto")} placeholder="e.g. Knowledge and Integrity" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <Input id="address" value={form.address || ""} onChange={set("address")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phoneNumber">Phone</Label>
            <Input id="phoneNumber" type="tel" value={form.phoneNumber || ""} onChange={set("phoneNumber")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">School email</Label>
            <Input id="email" type="email" value={form.email || ""} onChange={set("email")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="logoUrl">Logo link</Label>
          <Input id="logoUrl" type="url" value={form.logoUrl || ""} onChange={set("logoUrl")} placeholder="https://…/logo.png" />
          <p className="text-xs text-[var(--text-secondary)]">A square PNG or JPG works best.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="primaryColor">Card colour</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Pick card colour"
              value={HEX.test(form.primaryColor || "") ? form.primaryColor : EMPTY.primaryColor}
              onChange={set("primaryColor")}
              className="h-9 w-12 cursor-pointer rounded-[var(--radius-md)] border border-[var(--border-fine)] bg-white p-1"
            />
            <Input id="primaryColor" value={form.primaryColor || ""} onChange={set("primaryColor")} className="font-mono" />
          </div>
        </div>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save profile
        </Button>
      </form>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-secondary)]">Report card header preview</h2>
        <CardHeaderPreview form={form} />
        <p className="text-xs text-[var(--text-secondary)]">
          Cards already generated keep the old details. Upload the sheet again to regenerate them.
        </p>
      </div>
    </div>
  );
}

export default function RmsSettingsPage() {
  return (
    <RmsShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">School profile</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">These details print at the top of every report card.</p>
        </div>
        <SettingsForm />
      </div>
    </RmsShell>
  );
}
