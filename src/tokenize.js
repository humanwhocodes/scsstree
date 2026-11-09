/**
 * @fileoverview SCSS-aware tokenizer.
 *
 * SCSS supports single-line comments (`// comment`) that CSS doesn't have. The
 * CSS tokenizer would read the rest of such a line as CSS, where an unmatched
 * quote, a `url(`, or a `/*` (including the one in `//*`) can swallow the
 * lines that follow. So whenever the CSS tokenizer reaches a `//`, this
 * tokenizer stops it, emits the rest of the line as a single `Comment` token,
 * and restarts it at the newline. Everything else is passed through untouched.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "./token-types.js";
import {
	SOLIDUS,
	LINE_FEED,
	FORM_FEED,
	CARRIAGE_RETURN,
} from "./char-codes.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {(type: number, start: number, end: number) => void} OnToken
 * @typedef {(source: string, onToken: OnToken) => void} Tokenizer
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Thrown from the token callback to stop the CSS tokenizer at a line comment.
 */
const STOP = Symbol("stop");

/**
 * Determines if a character code is a newline.
 * @param {number} code The character code to check.
 * @returns {boolean} `true` if the character code is a newline.
 */
function isNewline(code) {
	return code === LINE_FEED || code === CARRIAGE_RETURN || code === FORM_FEED;
}

/**
 * Finds the end of a line comment, which is the offset of the next newline or
 * the end of the source.
 * @param {string} source The source text.
 * @param {number} offset The offset to start searching at.
 * @returns {number} The offset where the comment ends.
 */
function findLineEnd(source, offset) {
	while (offset < source.length && !isNewline(source.charCodeAt(offset))) {
		offset++;
	}

	return offset;
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Creates a tokenizer that understands SCSS single-line comments.
 * @param {Tokenizer} baseTokenize The CSS tokenizer to build upon.
 * @returns {Tokenizer} A tokenizer that emits `Comment` tokens for `//` comments.
 */
export function createScssTokenizer(baseTokenize) {
	return function scssTokenize(source, onToken) {
		let offset = 0;

		do {
			offset = tokenizeFrom(offset);
		} while (offset < source.length);

		/**
		 * Runs the CSS tokenizer from an offset until the end of the source or
		 * the end of the next line comment, whichever comes first.
		 * @param {number} from The offset to start tokenizing at.
		 * @returns {number} The offset to continue tokenizing from.
		 */
		function tokenizeFrom(from) {
			let next = source.length;

			try {
				baseTokenize(
					from === 0 ? source : source.slice(from),
					(type, start, end) => {
						start += from;
						end += from;

						if (
							type === tokenTypes.Delim &&
							source.charCodeAt(start) === SOLIDUS &&
							source.charCodeAt(start + 1) === SOLIDUS
						) {
							next = findLineEnd(source, start + 2);
							onToken(tokenTypes.Comment, start, next);
							throw STOP;
						}

						onToken(type, start, end);
					},
				);
			} catch (error) {
				if (error !== STOP) {
					throw error;
				}
			}

			return next;
		}
	};
}
