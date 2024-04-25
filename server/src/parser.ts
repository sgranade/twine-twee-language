import { Range, Location, Position, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { Passage, PassageMetadata, StoryData } from './index';
import { createDiagnostic, pairwise } from './utilities';

export interface ParserCallbacks {
	onPassage(passage: Passage, contents: string): void;
	onStoryTitle(title: string): void;
	onStoryData(data: StoryData): void;
	onParseError(error: Diagnostic): void;
}

/**
 * Captures information about the current state of parsing
 */
export class ParsingState {
	/**
	 * Document being validated
	 */
	textDocument: TextDocument;
	/**
	 * Document's normalized URI.
	 */
	textDocumentUri: string;
	/**
	 * Callbacks for parsing events
	 */
	callbacks: ParserCallbacks;

	constructor(textDocument: TextDocument, callbacks: ParserCallbacks) {
		this.textDocument = textDocument;
		this.textDocumentUri = textDocument.uri;
		this.callbacks = callbacks;
	}
}

/**
 * Parse header metadata.
 * 
 * @param rawMetadata String containing the unparsed metadata (such as '{"position":"600x400"}')
 * @param metadataIndex Unparsed metadata's location in the document (zero-based index).
 * @param state Parsing state.
 * @returns Parsed header metadata.
 */
function parseHeaderMetadata(rawMetadata: string, metadataIndex: number, state: ParsingState): PassageMetadata {
	let positionMeta: string | undefined;
	let sizeMeta: string | undefined;

	let metadataObject;
	try {
		metadataObject = JSON.parse(rawMetadata);
	}
	catch {
		let errorMessage = "Metadata isn't properly-formatted JSON.";
		if (rawMetadata.includes("'")) {
			errorMessage += " Did you use ' instead of \"?";
		}
		state.callbacks.onParseError(
			createDiagnostic(
				DiagnosticSeverity.Error,
				state.textDocument,
				metadataIndex,
				metadataIndex + rawMetadata.length,
				errorMessage
			)
		);
		return {};
	}

	for (const [k, v] of Object.entries(metadataObject)) {
		const vAsString = String(v);
		const valueIndex = rawMetadata.indexOf(vAsString);
		if (k === 'position') {
			if (typeof v === 'string') {
				if (!/^\d+,\d+$/.test(v)) {
					state.callbacks.onParseError(
						createDiagnostic(
							DiagnosticSeverity.Warning,
							state.textDocument,
							metadataIndex + valueIndex,
							metadataIndex + valueIndex + vAsString.length,
							`"position" metadata should give the tile location in x,y: "600,400"`
						)
					);
				}
				else {
					positionMeta = v;
				}
			}
			else {
				state.callbacks.onParseError(
					createDiagnostic(
						DiagnosticSeverity.Warning,
						state.textDocument,
						metadataIndex + valueIndex,
						metadataIndex + valueIndex + vAsString.length,
						`Must be a string.`
					)
				);
			}
		}
		else if (k === 'size') {
			if (typeof v === 'string') {
				if (!/^\d+,\d+$/.test(v)) {
					state.callbacks.onParseError(
							createDiagnostic(
							DiagnosticSeverity.Warning,
							state.textDocument,
							metadataIndex + valueIndex,
							metadataIndex + valueIndex + vAsString.length,
							`"size" metadata should give the tile size in width,height: "100,200"`
						)
					);
				}
				else {
					sizeMeta = v;
				}
			}
			else {
				state.callbacks.onParseError(
					createDiagnostic(
						DiagnosticSeverity.Warning,
						state.textDocument,
						metadataIndex + valueIndex,
						metadataIndex + valueIndex + vAsString.length,
						`Must be a string.`
					)
				);
			}
		}
		else {
			const keyIndex = rawMetadata.indexOf(k);
			state.callbacks.onParseError(
				createDiagnostic(
					DiagnosticSeverity.Warning,
					state.textDocument,
					metadataIndex + keyIndex,
					metadataIndex + keyIndex + k.length,
					`Unsupported metadata property.`
				)
			);
		}
	}

	return {position: positionMeta, size: sizeMeta};
}

const headerMetaCharPattern = /(?<!\\)(\{|\[)/;

/**
 * Parse a passage header.
 * 
 * @param header Text of the header line, without the leading "::" start token.
 * @param index Passage's location in the document, including the "::" token (zero-based index).
 * @param state Parsing state.
 * @returns Parsed passage object.
 */
function parsePassageHeader(header: string, index: number, state: ParsingState): Passage {
	let unparsedHeader = header;
	let name = "";
	let tags: string[] | undefined;
	let metadata: PassageMetadata | undefined;
	const headerStartIndex = index + 2;  // Index where the header string starts. The + 2 is for the leading "::"
	let parsingIndex = headerStartIndex;  // Index where we're currently parsing.
	const location = Location.create(
		state.textDocumentUri,
		Range.create(
			state.textDocument.positionAt(index),
			state.textDocument.positionAt(parsingIndex + header.length)
		)
	);

	// Stop before an unescaped [ (for tags) or { (for metadata)
	let m = headerMetaCharPattern.exec(unparsedHeader);
	if (m === null) {
		// Easy peasy: the header's just a passage name
		name = unparsedHeader;
		unparsedHeader = '';
	}
	else {
		name = unparsedHeader.substring(0, m.index);
		unparsedHeader = unparsedHeader.substring(m.index);
		parsingIndex += m.index;

		// Handle tags (which should come before any metadata)
		if (m[0] === '[') {
			const tagMatch = /\[(.*?)((?<!\\)\])\s*/.exec(unparsedHeader);
			if (tagMatch === null) {
				state.callbacks.onParseError(
					createDiagnostic(
						DiagnosticSeverity.Error,
						state.textDocument,
						parsingIndex,
						parsingIndex + unparsedHeader.length,
						"Tags aren't formatted correctly. Are you missing a ']'?"
					)
				);
				unparsedHeader = "";
			}
			else {
				tags = tagMatch[1].replace(/\\(.)/g, '$1').split(' ');
				unparsedHeader = unparsedHeader.substring(tagMatch[0].length);
				parsingIndex += tagMatch[0].length;
				m = headerMetaCharPattern.exec(unparsedHeader);  // Re-run to see if we have any trailing metadata
			}
		}

		if (m !== null && m[0] === '{') {
			const metaMatch = /(\{(.*?)((?<!\\)\}))\s*/.exec(unparsedHeader);
			if (metaMatch === null) {
				state.callbacks.onParseError(
					createDiagnostic(
						DiagnosticSeverity.Error,
						state.textDocument,
						parsingIndex,
						parsingIndex + unparsedHeader.length,
						"Metadata isn't formatted correctly. Are you missing a '}'?"
					)
				);
				unparsedHeader = "";
			}
			else {
				metadata = parseHeaderMetadata(metaMatch[1], parsingIndex + metaMatch.index, state);
				unparsedHeader = unparsedHeader.substring(metaMatch[0].length);
				parsingIndex += metaMatch[0].length;
			}
		}
	}

	// If there's any text remaining, it's after a tag or metadata section and isn't allowed
	if (unparsedHeader.trim().length > 0) {
		// Is there a tag section after the metadata?
		const misplacedTagMatch = /(?<!\\)\[.*?(?<!\\)\]/.exec(unparsedHeader);
		if (misplacedTagMatch !== null) {
			state.callbacks.onParseError(
				createDiagnostic(
					DiagnosticSeverity.Error,
					state.textDocument,
					parsingIndex + misplacedTagMatch.index,
					parsingIndex + misplacedTagMatch.index + misplacedTagMatch[0].length,
					"Tags need to come before metadata."
				)
			);
		}
		else {
			state.callbacks.onParseError(
				createDiagnostic(
					DiagnosticSeverity.Error,
					state.textDocument,
					parsingIndex,
					parsingIndex + unparsedHeader.length,
					`Passage headers can't have text after ${metadata !== undefined ? 'metadata': 'tags'}`
				)
			);
		}
	}

	// If the name contains unescaped tag or block closing characters, flag them.
	// (No need to check for tag/block opening characters, as they'll be processed above.)
	for (const closeMatch of name.matchAll(/(?<!\\)(\}|\])/gm)) {
		state.callbacks.onParseError(
			createDiagnostic(
				DiagnosticSeverity.Error,
				state.textDocument,
				headerStartIndex + closeMatch.index,
				headerStartIndex + closeMatch.index + 1,
				`Passage names can't include ${closeMatch[0]} without a \\ in front of it.`
			)
		);
	}

	return {
		name: name.replace(/\\(.)/g, '$1').trim(),  // Remove escape characters
		location: location,
		isScript: tags?.includes('script') || false,
		isStylesheet: tags?.includes('stylesheet') || false,
		tags: tags,
		metadata: metadata
	};
}

/**
 * Parse text from a Twee 3 document.
 * @param text Document text.
 * @param state Parsing state.
 */
function parseTwee3(text: string, state: ParsingState): void {
	// Generate all passages
	const passages = [...text.matchAll(/^::([^:].*?|)$/gm)].map(
		(m) => parsePassageHeader(m[1], m.index, state)
	);

	// Call back on the passages, along with their contents
	for (const [passage1, passage2] of pairwise(passages)) {
		state.callbacks.onPassage(
			passage1,
			text.substring(
				state.textDocument.offsetAt(passage1.location.range.end),
				state.textDocument.offsetAt(passage2.location.range.start) - 1
			)
		);
	}
	
	// Handle the final passage, if any
	const lastPassage = passages.at(-1);
	if (lastPassage !== undefined) {
		state.callbacks.onPassage(
			lastPassage,
			text.substring(
				state.textDocument.offsetAt(lastPassage.location.range.end)
			)
		);
	}
}

/**
 * Parse a Twee 3 document.
 * 
 * @param textDocument Document to parse.
 * @param callbacks Parser event callbacks.
 */
export function parse(textDocument: TextDocument, callbacks: ParserCallbacks): void {
	const state = new ParsingState(textDocument, callbacks);
	const text = textDocument.getText();

	parseTwee3(text, state);
}
