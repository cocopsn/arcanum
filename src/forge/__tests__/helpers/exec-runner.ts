import { deepEqual, type CaseResult } from "@/lib/exercise";
import type { ExecRunner } from "@/lib/exercises-validate";
import { execCode } from "@/lib/js-runner";

// In-process ExecRunner over execCode (the synchronous core of runJs, without the Worker or its timeout). Like runJs it
// skips `hint` cases. It passes each case's `input` array to the program as is, WITHOUT cloning: the same object
// reaches every program, which is what the evaluators' clone protections must withstand (§5.1, §5.2, §5.6).
export const execRunner: ExecRunner = async (code, functionName, cases) => {
  const real = cases.filter((c) => !c.hint);
  const out = execCode(code, functionName, real.map((c) => c.input));
  if ("syntaxError" in out) return { syntaxError: out.syntaxError, cases: [] };
  const res: CaseResult[] = real.map((c, i) => {
    const r = out.results[i];
    if (!r || !r.ok) return { input: c.input, expected: c.expected, error: r && !r.ok ? r.error : "sin resultado", pass: false };
    return { input: c.input, expected: c.expected, output: r.value, pass: deepEqual(r.value, c.expected) };
  });
  return { syntaxError: null, cases: res };
};
