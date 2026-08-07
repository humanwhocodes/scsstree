/**
 * @fileoverview SCSS-aware tokenizer.
 *
 * SCSS supports single-line comments (`// comment`) that CSS doesn't have. The
 * CSS tokenizer emits those as two `Delim` tokens followed by whatever happens
 * to be on the rest of the line, so this tokenizer runs the CSS tokenizer first
 * and then folds those token runs into a single `Comment` token. Everything
 * else is passed through untouched.
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
 * Determines if a character code is a newline.
 * @param {number} code The character code to check.
 * @returns {boolean} `true` if the character code is a newline.
 */
function isNewline(code) {
	return code === LINE_FEED || code === CARRIAGE_RETURN || code === FORM_FEED;
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
		/** @type {Array<number>} */
		const types = [];

		/** @type {Array<number>} */
		const starts = [];

		/** @type {Array<number>} */
		const ends = [];

		baseTokenize(source, (type, start, end) => {
			types.push(type);
			starts.push(start);
			ends.push(end);
		});

		for (let i = 0; i < types.length; i++) {
			const isLineCommentStart =
				types[i] === tokenTypes.Delim &&
				types[i + 1] === tokenTypes.Delim &&
				starts[i + 1] === ends[i] &&
				source.charCodeAt(starts[i]) === SOLIDUS &&
				source.charCodeAt(starts[i + 1]) === SOLIDUS;

			if (!isLineCommentStart) {
				onToken(types[i], starts[i], ends[i]);
				continue;
			}

			/*
			 * Everything from `//` up to (but not including) the next newline is
			 * part of the comment. The newline always lives inside a whitespace
			 * token, so find the first whitespace token containing one and split
			 * it at that point.
			 */
			const commentStart = starts[i];
			let commentEnd = source.length;
			let index = i + 2;

			for (; index < types.length; index++) {
				if (types[index] !== tokenTypes.WhiteSpace) {
					continue;
				}

				let offset = starts[index];

				while (
					offset < ends[index] &&
					!isNewline(source.charCodeAt(offset))
				) {
					offset++;
				}

				if (offset < ends[index]) {
					commentEnd = offset;
					break;
				}
			}

			onToken(tokenTypes.Comment, commentStart, commentEnd);

			if (index < types.length) {
				onToken(tokenTypes.WhiteSpace, commentEnd, ends[index]);
			}

			i = index;
		}
	};
}
