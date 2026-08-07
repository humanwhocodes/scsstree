/**
 * @fileoverview Lookahead helpers shared by the SCSS nodes and scopes.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import {
	DOLLAR_SIGN,
	FULL_STOP,
	NUMBER_SIGN,
	PERCENT_SIGN,
} from "../char-codes.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * The CSSTree parser context. Typed loosely because the SCSS syntax adds its
 * own consumers to it at runtime.
 * @typedef {any} ScssParserContext
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Determines if the token at `offset` begins immediately after the token
 * before it, with no whitespace or comment in between.
 * @param {ScssParserContext} parser The parser to inspect.
 * @param {number} offset The token offset relative to the current token.
 * @returns {boolean} `true` when the tokens are adjacent in the source.
 */
function isAdjacent(parser, offset) {
	const index = parser.tokenIndex + offset;

	return parser.getTokenStart(index) === parser.getTokenEnd(index - 1);
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Determines if the parser is positioned at the start of an interpolation
 * such as `#{$name}`.
 * @param {ScssParserContext} parser The parser to inspect.
 * @param {number} [offset] The token offset relative to the current token.
 * @returns {boolean} `true` if an interpolation starts here.
 */
export function isInterpolationStart(parser, offset = 0) {
	return (
		parser.isDelim(NUMBER_SIGN, offset) &&
		parser.lookupType(offset + 1) === tokenTypes.LeftCurlyBracket &&
		isAdjacent(parser, offset + 1)
	);
}

/**
 * Determines if the parser is positioned at the start of a variable such as
 * `$name` or `namespace.$name`.
 * @param {ScssParserContext} parser The parser to inspect.
 * @returns {boolean} `true` if a variable starts here.
 */
export function isVariableStart(parser) {
	if (
		parser.isDelim(DOLLAR_SIGN) &&
		parser.lookupType(1) === tokenTypes.Ident &&
		isAdjacent(parser, 1)
	) {
		return true;
	}

	return (
		parser.tokenType === tokenTypes.Ident &&
		parser.isDelim(FULL_STOP, 1) &&
		parser.isDelim(DOLLAR_SIGN, 2) &&
		parser.lookupType(3) === tokenTypes.Ident &&
		isAdjacent(parser, 1) &&
		isAdjacent(parser, 2) &&
		isAdjacent(parser, 3)
	);
}

/**
 * Determines if the parser is positioned at a namespaced function call such as
 * `math.div(...)`.
 * @param {ScssParserContext} parser The parser to inspect.
 * @returns {boolean} `true` if a namespaced function call starts here.
 */
export function isNamespacedFunctionStart(parser) {
	return (
		parser.tokenType === tokenTypes.Ident &&
		parser.isDelim(FULL_STOP, 1) &&
		parser.lookupType(2) === tokenTypes.Function &&
		isAdjacent(parser, 1) &&
		isAdjacent(parser, 2)
	);
}

/**
 * Determines if the parser is positioned at a placeholder selector such as
 * `%button`.
 * @param {ScssParserContext} parser The parser to inspect.
 * @returns {boolean} `true` if a placeholder selector starts here.
 */
export function isPlaceholderStart(parser) {
	return (
		parser.isDelim(PERCENT_SIGN) &&
		parser.lookupType(1) === tokenTypes.Ident &&
		isAdjacent(parser, 1)
	);
}

/**
 * Moves the parser past a complete `#{...}` interpolation.
 * @param {ScssParserContext} parser The parser to advance.
 * @returns {void}
 * @throws {Error} When the interpolation isn't terminated.
 */
export function skipInterpolation(parser) {
	const closeIndex = parser.getBlockTokenPairIndex(parser.tokenIndex + 1);

	if (closeIndex === -1) {
		parser.error("Unterminated interpolation");
	}

	parser.skip(closeIndex - parser.tokenIndex + 1);
}

/**
 * Determines whether the upcoming tokens look like a selector rather than a
 * declaration. A selector is followed by a block, while a declaration ends at
 * a semicolon or the end of the enclosing block. Curly brackets belonging to
 * an interpolation are not treated as the start of a block.
 * @param {ScssParserContext} parser The parser to inspect.
 * @returns {boolean} `true` when the tokens look like a selector.
 */
export function looksLikeSelector(parser) {
	let depth = 0;

	for (let offset = 0; ; offset++) {
		switch (parser.lookupType(offset)) {
			case tokenTypes.EOF:
				return false;

			case tokenTypes.Function:
			case tokenTypes.LeftParenthesis:
			case tokenTypes.LeftSquareBracket:
				depth++;
				break;

			case tokenTypes.RightParenthesis:
			case tokenTypes.RightSquareBracket:
				depth--;
				break;

			case tokenTypes.LeftCurlyBracket:
				if (parser.isDelim(NUMBER_SIGN, offset - 1)) {
					depth++;
					break;
				}

				if (depth === 0) {
					return true;
				}

				depth++;
				break;

			case tokenTypes.RightCurlyBracket:
				if (depth === 0) {
					return false;
				}

				depth--;
				break;

			case tokenTypes.Semicolon:
				if (depth === 0) {
					return false;
				}

				break;

			default:
				break;
		}
	}
}
