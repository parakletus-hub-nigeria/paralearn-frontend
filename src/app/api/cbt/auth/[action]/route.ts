import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookie,
  CoreUnavailableError,
  getPrincipal,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  resolveSignInChoices,
  setSessionCookie,
  signSelection,
  signSession,
  verifySelection,
  type CbtSessionInput,
} from "@/lib/cbtAuth";
import { cbtServerStore, type StoredWorkspace } from "@/lib/cbtServerStore";

export const dynamic = "force-dynamic";
// ParaLearn Core can be slow to answer while its host wakes up
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ action: string }>;
}

/** Workspace fields safe to show the signed-in examiner */
function publicWorkspace(ws: StoredWorkspace) {
  return {
    id: ws.id,
    name: ws.name,
    type: ws.type,
    ownerName: ws.ownerName,
    ownerEmail: ws.ownerEmail,
    credits: ws.credits,
    webhookUrl: ws.webhookUrl || null,
    createdAt: ws.createdAt,
  };
}

async function signIn(choice: CbtSessionInput) {
  const ws = await cbtServerStore.getWorkspace(choice.wsId);
  if (!ws) {
    return NextResponse.json({ message: "Workspace not found." }, { status: 404 });
  }
  const res = NextResponse.json({
    workspace: publicWorkspace(ws),
    session: { type: choice.type, email: choice.email, name: choice.name },
  });
  setSessionCookie(res, signSession(choice));
  return res;
}

async function login(body: any) {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    return NextResponse.json(
      { message: "Enter your email and password." },
      { status: 400 }
    );
  }

  let choices: CbtSessionInput[];
  try {
    choices = await resolveSignInChoices(email, password);
  } catch (err) {
    if (err instanceof CoreUnavailableError) {
      return NextResponse.json(
        { message: "ParaLearn sign-in is temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }
    throw err;
  }

  if (choices.length === 0) {
    return NextResponse.json(
      { message: "That email and password don't match a ParaLearn school account or exam hall." },
      { status: 401 }
    );
  }
  if (choices.length === 1) return signIn(choices[0]);

  return NextResponse.json({
    requiresChoice: true,
    selectionToken: signSelection(email, choices),
    choices: choices.map((c) => ({ workspaceId: c.wsId, type: c.type, name: c.name })),
  });
}

async function select(body: any) {
  const selection = verifySelection(String(body.selectionToken || ""));
  if (!selection) {
    return NextResponse.json(
      { message: "This sign-in has expired. Please sign in again." },
      { status: 401 }
    );
  }
  const choice = selection.choices.find((c) => c.wsId === body.workspaceId);
  if (!choice) {
    return NextResponse.json({ message: "Choose one of the listed workspaces." }, { status: 400 });
  }
  return signIn(choice);
}

async function register(body: any) {
  const email = String(body.email || "").trim().toLowerCase();
  const ownerName = String(body.ownerName || "").trim();
  const password = String(body.password || "");
  if (!email || !ownerName) {
    return NextResponse.json({ message: "Enter your name and email address." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { message: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }
  if (await cbtServerStore.findStandaloneWorkspaceByEmail(email)) {
    return NextResponse.json(
      { message: "An exam hall already uses this email. Sign in instead." },
      { status: 409 }
    );
  }

  const ws = await cbtServerStore.createStandaloneWorkspace({
    name: String(body.name || "").trim() || `${ownerName}'s Exam Hall`,
    ownerName,
    email,
    passwordHash: hashPassword(password),
  });
  return signIn({ wsId: ws.id, type: "STANDALONE_HALL", email, name: ws.name });
}

async function me(request: NextRequest) {
  const principal = await getPrincipal(request);
  if (!principal) {
    return NextResponse.json({ message: "Not signed in." }, { status: 401 });
  }
  const ws = await cbtServerStore.getWorkspace(principal.wsId);
  if (!ws) {
    return NextResponse.json({ message: "Workspace not found." }, { status: 404 });
  }
  return NextResponse.json({
    workspace: publicWorkspace(ws),
    session: { type: principal.type, email: principal.email, name: ws.name },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { action } = await params;
  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  try {
    switch (action) {
      case "login":
        return await login(body);
      case "select":
        return await select(body);
      case "register":
        return await register(body);
      case "logout": {
        const res = NextResponse.json({ success: true });
        clearSessionCookie(res);
        return res;
      }
    }
  } catch (err) {
    console.error(`[CBT Auth] ${action} failed:`, err);
    return NextResponse.json(
      { message: "Sign-in failed. Please try again." },
      { status: 500 }
    );
  }
  return NextResponse.json({ message: "Endpoint not found" }, { status: 404 });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { action } = await params;
  if (action === "me") return me(request);
  return NextResponse.json({ message: "Endpoint not found" }, { status: 404 });
}
