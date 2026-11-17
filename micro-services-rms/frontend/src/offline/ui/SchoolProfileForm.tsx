"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveProfile, type SchoolProfile } from "../storage/db";
import { imageToPngBytes } from "./logo";
import { SCHOOL_COLOUR_PRESETS, cardColours } from "../pdf/schoolColour";

const HEX = /^#[0-9a-fA-F]{6}$/;

const initials = (name: string) =>
  (name || "S")
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "S";

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
  useEffect(
    () => () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    },
    [logoUrl]
  );

  const set = (k: Exclude<keyof SchoolProfile, "logo">) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickLogo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file (PNG, JPG or SVG).");
      return;
    }
    try {
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
  // Same readable colours the PDF uses, so the preview matches the printed card
  const colours = cardColours(color);
  const contact = [form.address, form.phone, form.email].filter(Boolean).join("  |  ");

  return (
    <div className="rms-profile">
      <form onSubmit={submit} className="rms-form">
        {firstRun && (
          <p className="rms-notice info">Check how your school appears on report cards. You can change this any time.</p>
        )}
        <label className="rms-field">
          School name
          <input id="schoolName" className="rms-input" value={form.schoolName} onChange={set("schoolName")} required />
        </label>
        <label className="rms-field">
          Motto <small>Optional</small>
          <input id="motto" className="rms-input" value={form.motto} onChange={set("motto")} placeholder="e.g. Knowledge and Integrity" />
        </label>
        <label className="rms-field">
          Address <small>Optional</small>
          <input id="address" className="rms-input" value={form.address} onChange={set("address")} />
        </label>
        <div className="rms-form-grid">
          <label className="rms-field">
            Phone <small>Optional</small>
            <input id="phone" className="rms-input" type="tel" value={form.phone} onChange={set("phone")} />
          </label>
          <label className="rms-field">
            School email <small>Optional</small>
            <input id="email" className="rms-input" type="email" value={form.email} onChange={set("email")} />
          </label>
        </div>
        <fieldset>
          <legend>Logo and colour</legend>
          <div className="rms-logo-row">
            <span className="rms-logo-box" aria-hidden>
              {logoUrl ? <img src={logoUrl} alt="" /> : <strong style={{ color: colours.text }}>{initials(form.schoolName)}</strong>}
            </span>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
            <button type="button" className="rms-button small" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={15} />
              {form.logo ? "Change logo" : "Add logo"}
            </button>
            {form.logo && (
              <button type="button" className="rms-button small quiet" onClick={() => setForm((f) => ({ ...f, logo: null }))}>
                <Trash2 size={15} />
                Remove
              </button>
            )}
          </div>
          <div className="rms-swatches" role="group" aria-label="Suggested card colours">
            {SCHOOL_COLOUR_PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                className="rms-swatch"
                style={{ background: p.hex }}
                title={p.name}
                aria-label={p.name}
                aria-pressed={color.toLowerCase() === p.hex}
                onClick={() => setForm((f) => ({ ...f, color: p.hex }))}
              />
            ))}
          </div>
          <label className="rms-field" style={{ maxWidth: 260 }}>
            Card colour
            <span style={{ display: "flex", gap: 8 }}>
              <input
                type="color"
                aria-label="Pick card colour"
                value={color}
                onChange={set("color")}
                style={{ width: 48, height: 42, borderRadius: 6, border: "1px solid #dce0e7", padding: 3, background: "#fdfdff", cursor: "pointer" }}
              />
              <input id="color" className="rms-input rms-num" value={form.color} onChange={set("color")} />
            </span>
          </label>
        </fieldset>
        <div className="rms-form-footer">
          <button type="submit" className="rms-button primary" disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />}
            {firstRun ? "Save and continue" : "Save profile"}
          </button>
        </div>
      </form>

      <aside aria-labelledby="card-preview" style={{ display: "grid", gap: 10 }}>
        <h2 id="card-preview" className="rms-section-title">
          Top of each report card
        </h2>
        <div className="rms-card-head">
          <div style={{ height: 6, background: color }} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 18 }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" style={{ width: 54, height: 54, objectFit: "contain", flexShrink: 0 }} />
            ) : (
              <span
                style={{ width: 54, height: 54, borderRadius: "50%", background: color, color: colours.onFill, display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0 }}
              >
                {initials(form.schoolName)}
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <p style={{ color: colours.text, fontWeight: 800, fontSize: 15, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {form.schoolName || "Your school name"}
              </p>
              {form.motto && <p style={{ fontSize: 11, fontStyle: "italic", color: "var(--rms-muted)" }}>&ldquo;{form.motto}&rdquo;</p>}
              <p style={{ fontSize: 11, color: "var(--rms-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {contact || "Address  |  phone  |  email"}
              </p>
            </div>
          </div>
          {/* The subject table's heading row: white text on the colour, or dark text on a light colour */}
          <div className="rms-card-head-table" style={{ background: color, color: colours.onFill }} aria-hidden>
            <span>Subject</span>
            <span>1st CA</span>
            <span>2nd CA</span>
            <span>Exam</span>
            <span>Total</span>
            <span>Grade</span>
          </div>
        </div>
        {colours.adjusted && (
          <p className="rms-notice info" style={{ margin: 0 }}>
            This is a light colour, so the cards print text in a darker shade of it to keep it readable.
          </p>
        )}
        <p className="rms-section-sub">Cards already generated keep the old details. Open a batch and choose Redo cards to update them.</p>
      </aside>
    </div>
  );
}
