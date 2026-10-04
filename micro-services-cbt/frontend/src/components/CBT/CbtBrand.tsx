import Image from "next/image";
import Link from "next/link";

export default function CbtBrand() {
  return (
    <Link
      href="/cbt"
      className="flex min-w-0 items-center gap-3"
      aria-label="ParaLearn CBT home"
    >
      <Image
        src="/mainLogo.svg"
        alt="ParaLearn"
        width={132}
        height={44}
        className="h-11 w-[132px] object-contain"
        priority
      />
      <span className="border-l border-slate-300 pl-3 text-sm font-semibold text-slate-600">
        CBT
      </span>
    </Link>
  );
}
