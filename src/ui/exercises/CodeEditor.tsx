"use client";

import Editor from "react-simple-code-editor";
import { Highlight, themes } from "prism-react-renderer";
import type { Lang } from "@/lib/exercise";

// Mobile-first code editor: a textarea with a Prism highlight overlay (offline, bundled). Tab inserts
// spaces (2 for JS, 4 for Python) so indentation is usable on a phone keyboard. iPhone-first.
export function CodeEditor({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: Lang }) {
  const language = lang === "python" ? "python" : "javascript";
  return (
    <div className="overflow-hidden rounded-[var(--r-sm)] border border-line" style={{ background: "var(--ink)" }}>
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={(code) => (
          <Highlight code={code} language={language} theme={themes.vsDark}>
            {({ tokens, getLineProps, getTokenProps }) => (
              <>
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })}>
                    {line.map((token, k) => (
                      <span key={k} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </>
            )}
          </Highlight>
        )}
        padding={12}
        tabSize={lang === "python" ? 4 : 2}
        insertSpaces
        textareaClassName="code-editor-ta"
        style={{ fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 13, lineHeight: 1.55, minHeight: 200, caretColor: "var(--accent)" }}
        aria-label="Editor de código"
      />
    </div>
  );
}
