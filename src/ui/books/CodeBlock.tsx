"use client";

import { useState } from "react";
import { Highlight, themes } from "prism-react-renderer";

// Offline syntax highlighting — prism-react-renderer bundles Prism + the theme as JS (no CDN, no
// runtime fetch), so code renders highlighted on the bus with no data. Plus a copy button.
export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const clean = code.replace(/\n$/, "");
  return (
    <div className="my-3 overflow-hidden rounded-[var(--r-sm)] border border-line">
      <div className="flex items-center justify-between border-b border-line bg-surface px-3 py-1">
        <span className="font-sans text-[10px] uppercase tracking-wider text-text-faint">{lang || "code"}</span>
        <button
          onClick={() => {
            try {
              void navigator.clipboard?.writeText(clean);
            } catch {
              /* clipboard blocked */
            }
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          className="min-h-8 text-[10px] uppercase tracking-wider text-text-faint transition hover:text-text"
        >
          {copied ? "copiado ✓" : "copiar"}
        </button>
      </div>
      <Highlight code={clean} language={lang || "text"} theme={themes.vsDark}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="scroll-touch overflow-x-auto p-3 text-[12px] leading-relaxed" style={{ background: "var(--ink)" }}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, k) => (
                  <span key={k} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
