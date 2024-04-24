import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Generate a diagnostic message.
 * 
 * Pass start and end locations as 0-based indexes into the document's text.
 * 
 * @param severity Diagnostic severity
 * @param textDocument Document to which the diagnostic applies.
 * @param start Start location in the text of the diagnostic message.
 * @param end End location in the text of the diagnostic message.
 * @param message Diagnostic message.
 */
export function createDiagnostic(
	severity: DiagnosticSeverity, 
	textDocument: TextDocument,
	start: number, 
	end: number, 
	message: string
): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: severity,
		range: {
			start: textDocument.positionAt(start),
			end: textDocument.positionAt(end)
		},
		message: message,
		source: 'Twine'
	};

	return diagnostic;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function *pairwise(itr: Iterable<any>) {
	let prevEntry;
	for (const item of itr) {
		if (prevEntry !== undefined) {
			yield [prevEntry, item];
		}
		prevEntry = item;
	}
}