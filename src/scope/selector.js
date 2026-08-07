/**
 * @fileoverview The SCSS selector recognizer.
 *
 * Adds placeholder selectors (`%button`) and interpolation (`#{$name}`) to the
 * CSS selector recognizer, which is reimplemented here rather than delegated
 * to because a syntax extension isn't always handed the syntax it extends.
 * @see https://github.com/eslint/csstree/blob/main/lib/syntax/scope/selector.js
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import {
	AMPERSAND,
	ASTERISK,
	FULL_STOP,
	GREATER_THAN_SIGN,
	NUMBER_SIGN,
	PLUS_SIGN,
	SOLIDUS,
	TILDE,
	VERTICAL_LINE,
} from "../char-codes.js";
import { isInterpolationStart, isPlaceholderStart } from "../util/parser.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { Recognizer } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Recognizes the node starting at the current token.
 * @this {any}
 * @returns {any} The parsed node, or `undefined` to end the sequence.
 */
function getNode() {
	switch (this.tokenType) {
		case tokenTypes.LeftSquareBracket:
			return this.AttributeSelector();

		case tokenTypes.Hash:
			return this.IdSelector();

		case tokenTypes.Colon:
			return this.lookupType(1) === tokenTypes.Colon
				? this.PseudoElementSelector()
				: this.PseudoClassSelector();

		case tokenTypes.Ident:
			return this.TypeSelector();

		case tokenTypes.Number:
		case tokenTypes.Percentage:
			return this.Percentage();

		case tokenTypes.Dimension:
			// throws on `.123ident`
			if (this.charCodeAt(this.tokenStart) === FULL_STOP) {
				this.error("Identifier is expected", this.tokenStart + 1);
			}

			break;

		case tokenTypes.Delim: {
			if (isInterpolationStart(this)) {
				return this.ScssInterpolation();
			}

			if (isPlaceholderStart(this)) {
				return this.ScssPlaceholderSelector();
			}

			switch (this.charCodeAt(this.tokenStart)) {
				case PLUS_SIGN:
				case GREATER_THAN_SIGN:
				case TILDE:
				case SOLIDUS: // /deep/
					return this.Combinator();

				case FULL_STOP:
					return this.ClassSelector();

				case ASTERISK:
				case VERTICAL_LINE:
					return this.TypeSelector();

				case NUMBER_SIGN:
					return this.IdSelector();

				case AMPERSAND:
					return this.NestingSelector();

				default:
					break;
			}

			break;
		}

		default:
			break;
	}

	return undefined;
}

/**
 * Inserts a descendant combinator for significant whitespace.
 * @param {any} next The node that follows the whitespace.
 * @param {any} children The nodes read so far.
 * @returns {void}
 */
function onWhiteSpace(next, children) {
	if (
		children.last !== null &&
		children.last.type !== "Combinator" &&
		next !== null &&
		next.type !== "Combinator"
	) {
		children.push({
			type: "Combinator",
			loc: null,
			name: " ",
		});
	}
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Creates the SCSS selector recognizer.
 * @param {any} [previous] The recognizer being replaced, when it's available.
 * @returns {any} The SCSS selector recognizer.
 */
export function createSelectorScope(previous) {
	return {
		...previous,
		getNode,
		onWhiteSpace,
	};
}
