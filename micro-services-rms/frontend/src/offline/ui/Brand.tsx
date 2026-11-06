/* eslint-disable @next/next/no-img-element */
import React from "react";

/** ParaLearn logo + product name, as on the standalone CBT ("ParaLearn | CBT") */
export function Brand({ onClick }: { onClick?: () => void }) {
  const content = (
    <>
      <img src="/mainLogo.svg" alt="ParaLearn" width={132} height={44} />
      <span>Results</span>
    </>
  );
  return onClick ? (
    <button type="button" className="rms-brand" onClick={onClick} aria-label="ParaLearn Results home">
      {content}
    </button>
  ) : (
    <div className="rms-brand">{content}</div>
  );
}
