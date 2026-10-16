"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getExaminerSession, saveExaminerSession, type ExaminerWorkspace } from "@cbt/lib/cbtSessionManager";

interface DeveloperSettings {
  apiKey: string | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cbt${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Try again.");
  return data;
}

function SecretRow({
  label,
  value,
  onRotate,
  rotating,
  hint,
}: {
  label: string;
  value: string | null;
  onRotate: () => void;
  rotating: boolean;
  hint: string;
}) {
  const [shown, setShown] = useState(false);
  const masked = value ? `${value.slice(0, 12)}${"•".repeat(16)}${value.slice(-4)}` : "Not set";
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 min-w-0 break-all rounded-md border border-[var(--border-fine)] bg-[var(--surface-subtle)] px-3 py-2 text-xs">
          {shown && value ? value : masked}
        </code>
        <button
          type="button"
          className="cbt-icon"
          aria-label={shown ? `Hide ${label}` : `Show ${label}`}
          onClick={() => setShown((s) => !s)}
          disabled={!value}
        >
          {shown ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button
          type="button"
          className="cbt-icon"
          aria-label={`Copy ${label}`}
          disabled={!value}
          onClick={() =>
            navigator.clipboard
              .writeText(value || "")
              .then(() => toast.success(`${label} copied`))
              .catch(() => toast.error("Couldn't copy. Select the text and copy it instead."))
          }
        >
          <Copy size={16} />
        </button>
        <button type="button" className="cbt-button" onClick={onRotate} disabled={rotating}>
          {rotating ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Rotate
        </button>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{hint}</p>
    </div>
  );
}

/** Workspace name, webhook and API credentials for developers integrating with the CBT */
export default function CbtSettingsPage() {
  const [workspace, setWorkspace] = useState<ExaminerWorkspace | null>(null);
  const [settings, setSettings] = useState<DeveloperSettings | null>(null);
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "key" | "secret">("");

  useEffect(() => {
    const ws = getExaminerSession();
    setWorkspace(ws);
    if (!ws?.id) return;
    setName(ws.name || "");
    api(`/workspaces/${encodeURIComponent(ws.id)}/developer`)
      .then((data: DeveloperSettings) => {
        setSettings(data);
        setWebhookUrl(data.webhookUrl || "");
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  if (!workspace?.id) {
    return (
      <main className="cbt-dashboard">
        <p>Sign in to manage your workspace.</p>
      </main>
    );
  }

  const save = async () => {
    setBusy("save");
    try {
      const updated = await api(`/workspaces/${encodeURIComponent(workspace.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), webhookUrl: webhookUrl.trim() || null }),
      });
      const next = { ...workspace, name: updated.name };
      saveExaminerSession(next);
      setWorkspace(next);
      toast.success("Workspace settings saved.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  };

  const rotate = async (what: "key" | "secret") => {
    const label = what === "key" ? "API key" : "webhook secret";
    if (!confirm(`Issue a new ${label}? The current one stops working immediately.`)) return;
    setBusy(what);
    try {
      const data = await api(
        `/workspaces/${encodeURIComponent(workspace.id)}/${what === "key" ? "rotate-api-key" : "rotate-webhook-secret"}`,
        { method: "POST" },
      );
      setSettings((s) => ({ ...(s as DeveloperSettings), ...data }));
      toast.success(`New ${label} issued. Update your integration.`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <main className="cbt-dashboard" style={{ maxWidth: 760 }}>
      <div className="cbt-page-heading">
        <div>
          <span className="cbt-eyebrow">{workspace.name} / Settings</span>
          <h1>Workspace settings</h1>
        </div>
      </div>

      <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-5">
        <h2 className="text-base font-bold">General</h2>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Workspace name</span>
          <input
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-fine)] px-3 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Webhook URL</span>
          <input
            value={webhookUrl}
            type="url"
            placeholder="https://your-app.example.com/cbt-webhook"
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-fine)] px-3 text-sm"
          />
          <span className="block text-xs text-[var(--text-secondary)]">
            We POST each submitted and graded attempt here, signed with your webhook secret. Must be a public https:// address.
          </span>
        </label>
        <button type="button" className="cbt-button primary" onClick={save} disabled={busy === "save"}>
          {busy === "save" && <Loader2 size={15} className="animate-spin" />}
          Save
        </button>
      </section>

      <section className="space-y-5 rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-5">
        <div>
          <h2 className="text-base font-bold">API access</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Use these with the <a className="underline" href="/cbt/api-docs">Developer API</a>. Keep them secret.
          </p>
        </div>
        {loadError ? (
          <p role="alert" className="text-sm text-[var(--crimson-signal)]">{loadError}</p>
        ) : !settings ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
        ) : (
          <>
            <SecretRow
              label="API key"
              value={settings.apiKey}
              rotating={busy === "key"}
              onRotate={() => rotate("key")}
              hint="Send as Authorization: Bearer <key>. It only reaches this workspace."
            />
            <SecretRow
              label="Webhook secret"
              value={settings.webhookSecret}
              rotating={busy === "secret"}
              onRotate={() => rotate("secret")}
              hint="Verify the x-cbt-signature header: sha256= HMAC-SHA256 of the raw body with this secret."
            />
          </>
        )}
      </section>
    </main>
  );
}
