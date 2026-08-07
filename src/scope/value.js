/**
 * @fileoverview The SCSS value recognizer.
 *
 * SCSS values are expressions, so on top of everything CSS allows this
 * recognizer handles variables, interpolation, namespaced functions, maps
 * (`(key: value, ...)`), argument lists (`$args...`), and the arithmetic,
 * comparison, and modulo operators that only exist in SCSS.
 *
 * The CSS half is reimplemented here rather than delegated to, because a
 * syntax extension isn't always handed the syntax it extends.
 * @see https://github.com/eslint/csstree/blob/main/lib/syntax/scope/default.js
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import {
	AMPERSAND,
	ASTERISK,
	EQUALS_SIGN,
	EXCLAMATION_MARK,
	FULL_STOP,
	GREATER_THAN_SIGN,
	HYPHEN_MINUS,
	LESS_THAN_SIGN,
	LOWERCASE_U,
	NUMBER_SIGN,
	PERCENT_SIGN,
	PLUS_SIGN,
	SOLIDUS,
} from "../char-codes.js";
import {
	isInterpolationStart,
	isNamespacedFunctionStart,
	isVariableStart,
} from "../util/parser.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { Recognizer } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const comparisonStarts = new Set([
	EQUALS_SIGN,
	LESS_THAN_SIGN,
	GREATER_THAN_SIGN,
	EXCLAMATION_MARK,
]);

/**
 * Reads a fixed number of adjacent tokens as a single `Operator` node.
 * @this {any}
 * @param {number} count The number of tokens to consume.
 * @returns {any} The `Operator` node.
 */
function readOperator(count) {
	const start = this.tokenStart;
	let end = this.tokenEnd;

	for (let i = 0; i < count; i++) {
		end = this.tokenEnd;
		this.next();
	}

	return {
		type: "Operator",
		loc: this.getLocation(start, end),
		value: this.substring(start, end),
	};
}

/**
 * Reads a run of adjacent `.` delimiters, which is how the `...` in
 * `$args...` is tokenized.
 * @this {any}
 * @returns {any} The `Operator` node.
 */
function readDots() {
	let count = 1;

	while (
		this.isDelim(FULL_STOP, count) &&
		this.getTokenStart(this.tokenIndex + count) ===
			this.getTokenEnd(this.tokenIndex + count - 1)
	) {
		count++;
	}

	return readOperator.call(this, count);
}

/**
 * Reads a comparison operator such as `==`, `!=`, `<`, or `>=`.
 * @this {any}
 * @returns {any} The `Operator` node, or `null` when the delimiter isn't part
 *      of a comparison. A lone `!` is not, because it starts `!default`.
 */
function readComparison() {
	const code = this.charCodeAt(this.tokenStart);
	const followedByEquals =
		this.isDelim(EQUALS_SIGN, 1) &&
		this.getTokenStart(this.tokenIndex + 1) === this.tokenEnd;

	if (code === EXCLAMATION_MARK && !followedByEquals) {
		return null;
	}

	return readOperator.call(this, followedByEquals ? 2 : 1);
}

/**
 * Reads a namespaced function call such as `math.div(1, 2)`. The namespace is
 * folded into the function name so that the result is a regular `Function`
 * node.
 * @this {any}
 * @param {{recognizer: Recognizer}} context The current sequence context.
 * @returns {any} The `Function` node.
 */
function readNamespacedFunction(context) {
	const start = this.tokenStart;
	const namespace = this.consume(tokenTypes.Ident);

	this.eatDelim(FULL_STOP);

	const fn = this.Function(this.readSequence, context.recognizer);

	return {
		type: "Function",
		loc: this.getLocation(start, this.tokenStart),
		name: `${namespace}.${fn.name}`,
		children: fn.children,
	};
}

/**
 * Determines if a node is an operator ending in `+` or `-`.
 * @param {any} node The node to check.
 * @returns {boolean} `true` when the node is such an operator.
 */
function isPlusMinusOperator(node) {
	return (
		node !== null &&
		node.type === "Operator" &&
		(node.value.endsWith("-") || node.value.endsWith("+"))
	);
}

/**
 * Recognizes the node starting at the current token.
 * @this {any}
 * @param {{recognizer: Recognizer}} context The current sequence context.
 * @returns {any} The parsed node, or `undefined` to end the sequence.
 */
function getNode(context) {
	switch (this.tokenType) {
		case tokenTypes.Hash:
			return this.Hash();

		case tokenTypes.Comma:
			return this.Operator();

		// map entries and default parameter values: `(key: value)`
		case tokenTypes.Colon:
			return readOperator.call(this, 1);

		case tokenTypes.LeftParenthesis:
			return this.Parentheses(this.readSequence, context.recognizer);

		case tokenTypes.LeftSquareBracket:
			return this.Brackets(this.readSequence, context.recognizer);

		case tokenTypes.String:
			return this.String();

		case tokenTypes.Dimension:
			return this.Dimension();

		case tokenTypes.Percentage:
			return this.Percentage();

		case tokenTypes.Number:
			return this.Number();

		case tokenTypes.Function:
			return this.cmpStr(this.tokenStart, this.tokenEnd, "url(")
				? this.Url()
				: this.Function(this.readSequence, context.recognizer);

		case tokenTypes.Url:
			return this.Url();

		case tokenTypes.Ident:
			if (isVariableStart(this)) {
				return this.ScssVariable();
			}

			if (isNamespacedFunctionStart(this)) {
				return readNamespacedFunction.call(this, context);
			}

			// unicode ranges start with `u+` or `U+`
			if (
				this.cmpChar(this.tokenStart, LOWERCASE_U) &&
				this.cmpChar(this.tokenStart + 1, PLUS_SIGN)
			) {
				return this.UnicodeRange();
			}

			return this.Identifier();

		case tokenTypes.Delim: {
			const code = this.charCodeAt(this.tokenStart);

			if (isVariableStart(this)) {
				return this.ScssVariable();
			}

			if (isInterpolationStart(this)) {
				return this.ScssInterpolation();
			}

			if (
				code === SOLIDUS ||
				code === ASTERISK ||
				code === PLUS_SIGN ||
				code === HYPHEN_MINUS
			) {
				return this.Operator();
			}

			// modulo, and the parent selector inside `#{&}`
			if (code === PERCENT_SIGN || code === AMPERSAND) {
				return readOperator.call(this, 1);
			}

			if (code === FULL_STOP) {
				return readDots.call(this);
			}

			if (comparisonStarts.has(code)) {
				const operator = readComparison.call(this);

				if (operator) {
					return operator;
				}
			}

			// a `#` that isn't interpolation is a malformed hex color
			if (code === NUMBER_SIGN) {
				this.error(
					"Hex or identifier is expected",
					this.tokenStart + 1,
				);
			}

			break;
		}

		default:
			break;
	}

	return undefined;
}

/**
 * Keeps the whitespace around `+` and `-` operators, which changes their
 * meaning in both CSS and SCSS.
 * @param {any} next The node that follows the whitespace.
 * @param {any} children The nodes read so far.
 * @returns {void}
 */
function onWhiteSpace(next, children) {
	if (isPlusMinusOperator(next)) {
		next.value = ` ${next.value}`;
	}

	if (isPlusMinusOperator(children.last)) {
		children.last.value += " ";
	}
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Creates the SCSS value recognizer.
 * @param {any} [previous] The recognizer being replaced, when it's available.
 * @returns {any} The SCSS value recognizer.
 */
export function createValueScope(previous) {
	return {
		...previous,
		getNode,
		onWhiteSpace,
	};
}
