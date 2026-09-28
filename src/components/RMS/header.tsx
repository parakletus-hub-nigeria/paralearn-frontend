import Image from "next/image";
import { useSelector } from "react-redux";
import { RootState } from "@/reduxToolKit/store";

export const Header = ({
  schoolLogo,
  schoolName,
  showGreeting = false,
}: {
  schoolLogo?: string;
  schoolName?: string;
  showGreeting?: boolean;
}) => {
  const { user } = useSelector((s: RootState) => s.user);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Good morning";
    if (h >= 12 && h < 17) return "Good afternoon";
    return "Good evening";
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 28,
        gap: 16,
      }}
    >
      {/* Left: greeting */}
      <div>
        {showGreeting && (
          <>
            <h1
              style={{
                fontFamily: "var(--font-manrope), system-ui, sans-serif",
                fontSize: "clamp(1.375rem, 2.5vw, 1.75rem)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                color: "#0f172a",
                margin: 0,
              }}
            >
              {getGreeting()},{" "}
              <span style={{ color: "var(--violet-ink)" }}>
                {user?.firstName || "there"}
              </span>
            </h1>
            <p
              style={{
                fontFamily: "var(--font-manrope), system-ui, sans-serif",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--emerald-signal)",
                  flexShrink: 0,
                }}
              />
              Welcome back to your dashboard
            </p>
          </>
        )}
      </div>

      {/* Right: school logo */}
      {(schoolLogo || schoolName) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            height: 52,
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-fine)",
            background: "#ffffff",
            overflow: "hidden",
            padding: 8,
            flexShrink: 0,
          }}
        >
          {schoolLogo ? (
            <Image
              src={schoolLogo}
              alt={schoolName || "School logo"}
              width={52}
              height={52}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <span
              style={{
                fontFamily: "var(--font-manrope), system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 16,
                color: "var(--violet-ink)",
              }}
            >
              {getInitials(schoolName || "PL")}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
