import { useMemo, useRef, type ReactNode } from "react";
import type { ConfigFile } from "@/lib/types";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Lightweight line-based highlighter for ini/cfg/json/xml/lua. Returns HTML. */
export function highlight(code: string, format: ConfigFile["format"]) {
  return code.split("\n").map((line) => {
    let l = esc(line);
    const C = (cls: string, s: string) => `<span class="${cls}">${s}</span>`;
    if (format === "ini") {
      if (/^\s*[;#]/.test(line)) return C("text-muted-foreground italic", l);
      if (/^\s*\[.*\]\s*$/.test(line)) return C("text-primary font-semibold", l);
      return l.replace(/^(\s*[^=]+)(=)(.*)$/, (_m, k, e, v) => `${C("text-info", k)}${C("text-muted-foreground", e)}${C("text-success", v)}`);
    }
    if (format === "cfg" || format === "lua") {
      const cm = format === "lua" ? "--" : "//";
      const idx = line.indexOf(cm);
      let codePart = idx >= 0 ? esc(line.slice(0, idx)) : l;
      const comment = idx >= 0 ? C("text-muted-foreground italic", esc(line.slice(idx))) : "";
      codePart = codePart.replace(/(&quot;|")([^"]*)(")/g, (_m, a, b, c) => C("text-success", a + b + c));
      if (format === "lua") codePart = codePart.replace(/\b(local|function|end|return|for|in|do|if|then|else|true|false|nil|pairs)\b/g, (m) => C("text-primary", m));
      else codePart = codePart.replace(/^(\s*)(\w+)/, (_m, s, w) => s + C("text-info", w));
      codePart = codePart.replace(/(?<![\w#])(-?\d+(\.\d+)?)(?![\w"])/g, (m) => C("text-warning", m));
      return codePart + comment;
    }
    if (format === "json") {
      return l
        .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, (_m, k, c) => C("text-info", k) + c)
        .replace(/:\s*("(?:[^"\\]|\\.)*")/g, (m, v) => m.replace(v, C("text-success", v)))
        .replace(/\b(true|false|null)\b/g, (m) => C("text-primary", m))
        .replace(/(?<![\w"])(-?\d+(\.\d+)?)(?![\w"])/g, (m) => C("text-warning", m));
    }
    // xml
    return l
      .replace(/(&lt;\/?)([\w:?-]+)/g, (_m, a, t) => C("text-muted-foreground", a) + C("text-primary", t))
      .replace(/([\w-]+)=("[^"]*")/g, (_m, a, v) => C("text-info", a) + "=" + C("text-success", v));
  }).join("\n");
}

export function CodeEditor({ value, onChange, format, readOnly, footer }: { value: string; onChange?: (v: string) => void; format: ConfigFile["format"]; readOnly?: boolean; footer?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => highlight(value, format) + "\n", [value, format]);
  const lines = value.split("\n").length;
  const shared = "m-0 whitespace-pre p-3 font-mono text-[12.5px] leading-[1.6] tracking-normal";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-background/60">
        <div ref={gutterRef} className="w-11 shrink-0 select-none overflow-hidden border-r py-3 pr-2 text-right font-mono text-[12.5px] leading-[1.6] text-muted-foreground/60">
          {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <div className="relative min-w-0 flex-1">
          <pre ref={preRef} aria-hidden className={`${shared} pointer-events-none absolute inset-0 overflow-hidden`} dangerouslySetInnerHTML={{ __html: html }} />
          <textarea
            value={value}
            readOnly={readOnly}
            spellCheck={false}
            onChange={(e) => onChange?.(e.target.value)}
            onScroll={(e) => {
              const t = e.currentTarget;
              if (preRef.current) { preRef.current.scrollTop = t.scrollTop; preRef.current.scrollLeft = t.scrollLeft; }
              if (gutterRef.current) gutterRef.current.scrollTop = t.scrollTop;
            }}
            onKeyDown={(e) => {
              if (e.key === "Tab" && !readOnly) {
                e.preventDefault();
                const t = e.currentTarget; const s = t.selectionStart;
                const v = value.slice(0, s) + "  " + value.slice(t.selectionEnd);
                onChange?.(v);
                requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; });
              }
            }}
            className={`${shared} absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent text-transparent caret-foreground outline-none selection:bg-primary/30`}
          />
        </div>
      </div>
      {footer}
    </div>
  );
}

/** Simple LCS line diff. */
export function diffLines(a: string, b: string) {
  const A = a.split("\n"), B = b.split("\n");
  const m = A.length, n = B.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { type: "same" | "add" | "del"; text: string }[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (A[i] === B[j]) { out.push({ type: "same", text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: "del", text: A[i++] });
    else out.push({ type: "add", text: B[j++] });
  }
  while (i < m) out.push({ type: "del", text: A[i++] });
  while (j < n) out.push({ type: "add", text: B[j++] });
  return out;
}
