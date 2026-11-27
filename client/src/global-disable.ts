import { DiagnosticCode, isTwineDiagnostic } from "@tt3/shared";

/**
 * The parts of a diagnostic needed to decide whether to offer disabling it
 * globally.
 */
export interface DiagnosticSummary {
    source?: string;
    code?: unknown;
}

/**
 * Get the codes of diagnostics that can be disabled project-wide.
 * @param diagnostics Diagnostics to check.
 * @returns Codes that can be added to `tt3.disabledDiagnostics`, one per diagnostic.
 */
export function codesToDisableGlobally(
    diagnostics: readonly DiagnosticSummary[],
): DiagnosticCode[] {
    return diagnostics.filter(isTwineDiagnostic).map((d) => d.code);
}
