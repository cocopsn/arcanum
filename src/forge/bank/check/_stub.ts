import type { BankCheck } from "@/lib/exercises-validate";

// Phase-0 STUB check (§9.2, §22.3). The branch that owns the type replaces its module file (./<tipo>.ts) with the
// real check. While the stub stays, the item is PENDING: accepted without validation, never offered, and the bank
// stays at most «Autorado» (regla de pendientes). It never pretends a validation.
export const stubCheck: BankCheck = async () => ({ disponible: false });
