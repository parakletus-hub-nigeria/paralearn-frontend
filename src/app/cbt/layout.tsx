import CbtWorkspaceShell from "@cbt/components/CBT/CbtWorkspaceShell";

export default function CbtLayout({ children }: { children: React.ReactNode }) {
  return <CbtWorkspaceShell>{children}</CbtWorkspaceShell>;
}
