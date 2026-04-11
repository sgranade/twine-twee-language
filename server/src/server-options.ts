/**
 * Options about what diagnostics to report.
 */

export interface DiagnosticsOptions {
    warnings: {
        unknownMacro: boolean;
        unknownPassage: boolean;
    };
}

export const defaultDiagnosticsOptions: DiagnosticsOptions = {
    warnings: { unknownMacro: true, unknownPassage: true },
};
