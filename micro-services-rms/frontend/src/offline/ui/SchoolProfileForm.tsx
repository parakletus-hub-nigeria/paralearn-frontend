"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, Info, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveProfile, type SchoolProfile } from "../storage/db";
import { imageToPngBytes } from "./logo";
import { DEFAULT_SCHOOL_COLOUR, SCHOOL_COLOUR_PRESETS, cardColours } from "../pdf/schoolColour";
import "./rms-forms.css";

const HEX = /^#[0-9a-fA-F]{6}$/;

const initials = (name: string) =>
  (name || "S")
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "S";

type Field = Exclude<keyof SchoolProfile, "logo">;
type Errors = Partial<Record<"schoolName" | "color" | "logo" | "email", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same trimming as saving, so "saved" compares what will actually be stored */
const clean = (p: SchoolProfile): SchoolProfile => ({
  ...p,
  schoolName: p.schoolName.trim(),
  motto: p.motto.trim(),
  address: p.address.trim(),
  phone: p.phone.trim(),
  email: p.email.trim(),
  color: p.color.trim().toLowerCase(),
  nextTermBegins: (p.nextTermBegins || "").trim(),
});

const sameProfile = (a: SchoolProfile, b: SchoolProfile) => {
  const x = clean(a);
  const y = clean(b);
  return (
    x.schoolName === y.schoolName &&
    x.motto === y.motto &&
    x.address === y.address &&
    x.phone === y.phone &&
    x.email === y.email &&
    x.color === y.color &&
    x.nextTermBegins === y.nextTermBegins &&
    x.logo === y.logo
  );
};

interface PreviewProps {
  color: string;
  colours: ReturnType<typeof cardColours>;
  logoUrl: string | null;
  schoolName: string;
  motto: string;
  contact: string;
  nextTerm: string;
}

/** The top of a printed card, drawn with the same readable colours the PDF uses */
function CardPreview({ color, colours, logoUrl, schoolName, motto, contact, nextTerm }: PreviewProps) {
  const name = schoolName.trim();
  const line = motto.trim();
  return (
    <div className="rms-pf-card" aria-hidden>
      <div className="rms-pf-card-bar" style={{ background: color }} />
      <div className="rms-pf-card-head">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="rms-pf-card-logo" />
        ) : (
          <span className="rms-pf-card-initials" style={{ background: color, color: colours.onFill }}>
            {initials(name)}
          </span>
        )}
        <div className="rms-pf-card-school">
          <p className="rms-pf-card-name" style={{ color: colours.text }}>
            {name || "Your school name"}
          </p>
          {line && <p className="rms-pf-card-motto">&ldquo;{line}&rdquo;</p>}
          <p className="rms-pf-card-contact">{contact || "Address  |  phone  |  email"}</p>
        </div>
        <div className="rms-pf-card-title" style={{ background: colours.soft, color: colours.text }}>
          <span>Student report card</span>
          <strong>First term</strong>
        </div>
      </div>
      {/* The subject table's heading row: white text on the colour, or dark text on a light colour */}
      <div className="rms-pf-card-table">
        <div className="rms-pf-card-row is-head" style={{ background: color, color: colours.onFill }}>
          <span>Subject</span>
          <span>1st CA</span>
          <span>2nd CA</span>
          <span>Exam</span>
          <span>Total</span>
          <span>Grade</span>
        </div>
        <div className="rms-pf-card-row">
          <span>Mathematics</span>
          <span>17</span>
          <span>18</span>
          <span>52</span>
          <strong>87</strong>
          <strong>A</strong>
        </div>
        <div className="rms-pf-card-row is-zebra">
          <span>English Language</span>
          <span>15</span>
          <span>16</span>
          <span>44</span>
          <strong>75</strong>
          <strong>A</strong>
        </div>
      </div>
      <div className="rms-pf-card-foot">
        <span className={nextTerm ? "" : "is-empty"}>{nextTerm ? `Next term begins: ${nextTerm}` : "Next term line hidden"}</span>
        <span className="rms-pf-card-stamp">School stamp</span>
      </div>
    </div>
  );
}

/** School details printed at the top of every card; stored on this laptop */
export default function SchoolProfileForm({
  initial,
  profileScope,
  onSaved,
  firstRun = false,
}: {
  initial: SchoolProfile;
  profileScope: string;
  onSaved: (p: SchoolProfile) => void;
  firstRun?: boolean;
}) {
  const [form, setForm] = useState<SchoolProfile>(initial);
  const [saved, setSaved] = useState<SchoolProfile>(initial);
  const [saving, setSaving] = useState(false);
  const [readingLogo, setReadingLogo] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // requestSubmit (Ctrl+S) ignores the disabled button, so a ref blocks a second save while one runs
  const savingRef = useRef(false);

  // Ctrl+S / Cmd+S saves, as in most editors (the browser's own "save page" is never what's wanted here)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setForm(initial);
    setSaved(initial);
  }, [initial]);

  const dirty = !sameProfile(form, saved);

  // A school that types its details and closes the tab shouldn't lose them silently
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    if (k === "schoolName" && value.trim()) setErrors((er) => ({ ...er, schoolName: undefined }));
    if (k === "color" && HEX.test(value.trim())) setErrors((er) => ({ ...er, color: undefined }));
    if (k === "email" && (!value.trim() || EMAIL.test(value.trim()))) setErrors((er) => ({ ...er, email: undefined }));
  };

  const discard = () => {
    setForm(saved);
    setErrors({});
  };

  const pickColour = (hex: string) => {
    setForm((f) => ({ ...f, color: hex }));
    setErrors((er) => ({ ...er, color: undefined }));
  };

  const pickLogo = async (file?: File) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((er) => ({ ...er, logo: "Choose an image file (PNG, JPG or SVG)." }));
      return;
    }
    setReadingLogo(true);
    try {
      const bytes = await imageToPngBytes(file);
      setForm((f) => ({ ...f, logo: { bytes, type: "png" } }));
      setErrors((er) => ({ ...er, logo: undefined }));
    } catch {
      setErrors((er) => ({ ...er, logo: "That image couldn't be read. Try a PNG or JPG." }));
    } finally {
      setReadingLogo(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Same rule as the Save button: nothing to do while saving, or when nothing changed (outside first run)
    if (savingRef.current || (!dirty && !firstRun)) return;
    const next: Errors = {};
    if (!form.schoolName.trim()) next.schoolName = "Enter the school's name. It's the largest line on every card.";
    if (!HEX.test(form.color.trim())) next.color = "Use a colour code like #641bc4, or pick a colour above.";
    if (form.email.trim() && !EMAIL.test(form.email.trim())) next.email = "Check the school email. It needs an @, e.g. admin@yourschool.ng.";
    setErrors((er) => ({ ...er, ...next }));
    if (next.schoolName) return nameRef.current?.focus();
    if (next.email) return emailRef.current?.focus();
    if (next.color) return colorRef.current?.focus();
    savingRef.current = true;
    setSaving(true);
    const stored = clean(form);
    try {
      await saveProfile(stored, profileScope);
      setSaved(stored);
      setForm(stored);
      toast.success("School profile saved on this laptop.");
      onSaved(stored);
    } catch {
      toast.error("Couldn't save on this laptop. Check that the browser isn't in private mode, then try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const color = HEX.test(form.color.trim()) ? form.color.trim() : DEFAULT_SCHOOL_COLOUR;
  // Same readable colours the PDF uses, so the preview matches the printed card
  const colours = cardColours(color);
  const contact = [form.address, form.phone, form.email].map((s) => s.trim()).filter(Boolean).join("  |  ");
  const preset = SCHOOL_COLOUR_PRESETS.find((p) => p.hex === color.toLowerCase());
  const nextTerm = (form.nextTermBegins || "").trim();
  const previewProps: PreviewProps = { color, colours, logoUrl, schoolName: form.schoolName, motto: form.motto, contact, nextTerm };
  const adjustedNote = colours.adjusted ? (
    <p className="rms-pf-note is-info">
      <Info size={15} aria-hidden />
      This is a light colour, so cards print the school name and labels in a darker shade of it to keep them readable.
    </p>
  ) : null;

  return (
    <div className="rms-pf">
      <form ref={formRef} onSubmit={submit} className="rms-pf-form" noValidate>
        {firstRun && (
          <p className="rms-pf-intro">
            <Info size={16} aria-hidden />
            <span>
              Check how your school appears on report cards before your first batch. You can change this any time.
            </span>
          </p>
        )}

        <section className="rms-pf-section" aria-labelledby="pf-details">
          <header>
            <h2 id="pf-details">School details</h2>
            <p>The name, motto and contact line on each card.</p>
          </header>
          <div className="rms-pf-fields">
            <label className="rms-field">
              School name
              <input
                ref={nameRef}
                id="schoolName"
                className="rms-input"
                value={form.schoolName}
                onChange={set("schoolName")}
                aria-invalid={!!errors.schoolName}
                aria-describedby={errors.schoolName ? "schoolName-error" : undefined}
                autoComplete="organization"
                required
              />
              {errors.schoolName && (
                <span id="schoolName-error" className="rms-pf-error" role="alert">
                  {errors.schoolName}
                </span>
              )}
            </label>
            <label className="rms-field">
              <span>
                Motto <small>Optional</small>
              </span>
              <input id="motto" className="rms-input" value={form.motto} onChange={set("motto")} placeholder="e.g. Knowledge and Integrity" />
            </label>
            <label className="rms-field">
              <span>
                Address <small>Optional</small>
              </span>
              <input id="address" className="rms-input" value={form.address} onChange={set("address")} autoComplete="street-address" />
            </label>
            <div className="rms-pf-pair">
              <label className="rms-field">
                <span>
                  Phone <small>Optional</small>
                </span>
                <input id="phone" className="rms-input" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
              </label>
              <label className="rms-field">
                <span>
                  School email <small>Optional</small>
                </span>
                <input
                  ref={emailRef}
                  id="email"
                  className="rms-input"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email && (
                  <span id="email-error" className="rms-pf-error" role="alert">
                    {errors.email}
                  </span>
                )}
              </label>
            </div>
          </div>
        </section>

        <section className="rms-pf-section" aria-labelledby="pf-look">
          <header>
            <h2 id="pf-look">Logo and card colour</h2>
            <p>The colour fills the bar, the table heading and the school name.</p>
          </header>
          <div className="rms-pf-fields">
            <div className="rms-pf-logo">
              <span className="rms-pf-logo-box" aria-hidden>
                {logoUrl ? <img src={logoUrl} alt="" /> : <strong style={{ color: colours.text }}>{initials(form.schoolName)}</strong>}
              </span>
              <div className="rms-pf-logo-text">
                <strong>{form.logo ? "School logo" : "No logo yet"}</strong>
                <small>{form.logo ? "Printed beside the school name." : "Cards show the school's initials until you add one. PNG, JPG or SVG."}</small>
                <div className="rms-pf-logo-actions">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label="Choose a logo image"
                    onChange={(e) => pickLogo(e.target.files?.[0])}
                  />
                  <button type="button" className="rms-button small" onClick={() => fileRef.current?.click()} disabled={readingLogo}>
                    {readingLogo ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                    {readingLogo ? "Reading image" : form.logo ? "Change logo" : "Add logo"}
                  </button>
                  {form.logo && (
                    <button type="button" className="rms-button small quiet" onClick={() => setForm((f) => ({ ...f, logo: null }))}>
                      <Trash2 size={15} />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            {errors.logo && (
              <span className="rms-pf-error" role="alert">
                {errors.logo}
              </span>
            )}

            <div className="rms-field" role="group" aria-labelledby="pf-colour-label">
              <span id="pf-colour-label">Card colour</span>
              <div className="rms-pf-swatches">
                {SCHOOL_COLOUR_PRESETS.map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    className="rms-pf-swatch"
                    style={{ background: p.hex }}
                    title={p.name}
                    aria-label={p.name}
                    aria-pressed={color.toLowerCase() === p.hex}
                    onClick={() => pickColour(p.hex)}
                  >
                    {color.toLowerCase() === p.hex && <Check size={16} color="#fdfdff" aria-hidden />}
                  </button>
                ))}
              </div>
              <div className="rms-pf-colour">
                <input type="color" aria-label="Pick any colour" value={color} onChange={(e) => pickColour(e.target.value)} className="rms-pf-picker" />
                <input
                  ref={colorRef}
                  id="color"
                  className="rms-input rms-pf-hex"
                  value={form.color}
                  onChange={set("color")}
                  spellCheck={false}
                  aria-label="Colour code"
                  aria-invalid={!!errors.color}
                  aria-describedby={errors.color ? "color-error" : "color-name"}
                />
                <small id="color-name">{preset ? preset.name : "Your own colour"}</small>
              </div>
              {errors.color && (
                <span id="color-error" className="rms-pf-error" role="alert">
                  {errors.color}
                </span>
              )}
            </div>
            {/* On narrow screens the preview sits here, where the colour is chosen */}
            <div className="rms-pf-preview-inline">
              <CardPreview {...previewProps} />
              {adjustedNote}
            </div>
          </div>
        </section>

        <section className="rms-pf-section" aria-labelledby="pf-term">
          <header>
            <h2 id="pf-term">Next term</h2>
            <p>Printed at the bottom of every card. Update it each term.</p>
          </header>
          <div className="rms-pf-fields">
            <label className="rms-field">
              <span>
                Next term begins <small>Optional</small>
              </span>
              <input
                id="nextTermBegins"
                className="rms-input"
                value={form.nextTermBegins || ""}
                onChange={set("nextTermBegins")}
                placeholder="e.g. Monday, 12 January 2027"
              />
              <small>Leave it empty to leave the line off the cards.</small>
            </label>
          </div>
        </section>

        <div className="rms-pf-savebar">
          <p className="rms-pf-savestate" role="status">
            {saving ? "Saving on this laptop" : dirty ? "Unsaved changes" : firstRun ? "Next, you'll open your first result sheet." : "All changes saved on this laptop"}
          </p>
          {dirty && !firstRun && !saving && (
            <button type="button" className="rms-button quiet" onClick={discard}>
              Discard changes
            </button>
          )}
          <button type="submit" className="rms-button primary" disabled={saving || (!dirty && !firstRun)} title="Ctrl+S">
            {saving ? <Loader2 size={16} className="animate-spin" /> : !dirty && !firstRun ? <Check size={16} /> : null}
            {saving ? "Saving" : firstRun ? "Save and continue" : dirty ? "Save profile" : "Saved"}
          </button>
        </div>
      </form>

      <aside className="rms-pf-preview is-profile" aria-labelledby="card-preview">
        <h2 id="card-preview">How your cards will look</h2>
        <CardPreview {...previewProps} />
        {adjustedNote}
        <p className="rms-pf-note">Cards you&apos;ve already made keep the old details. Open the batch and choose Redo cards to update them.</p>
      </aside>
    </div>
  );
}
