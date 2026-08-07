/**
 * @fileoverview Overrides `Declaration` parsing to support SCSS.
 *
 * A declaration in SCSS may be any of three things, so this parser can return
 * three different node types:
 *
 * 1. `ScssVariableDeclaration` for `$name: value` (and `ns.$name: value`)
 * 2. `ScssNestedProperty` for `font: { family: serif; }`
 * 3. `Declaration` for everything else, including interpolated property names
 *
 * Declarations may also end with `!default` and `!global` in addition to the
 * `!important` that CSS allows.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import {
	AMPERSAND,
	ASTERISK,
	DOLLAR_SIGN,
	EXCLAMATION_MARK,
	FULL_STOP,
	NUMBER_SIGN,
	PLUS_SIGN,
	SOLIDUS,
} from "../char-codes.js";
import {
	isInterpolationStart,
	isVariableStart,
	skipInterpolation,
} from "../util/parser.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { NodeSyntaxConfig } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/** @this {any} */
function consumeValueRaw() {
	return this.Raw(this.consumeUntilExclamationMarkOrSemicolon, true);
}

/** @this {any} */
function consumeCustomPropertyRaw() {
	return this.Raw(this.consumeUntilExclamationMarkOrSemicolon, false);
}

/** @this {any} */
function consumeValue() {
	const startValueToken = this.tokenIndex;
	const value = this.Value();

	if (
		value.type !== "Raw" &&
		this.eof === false &&
		this.tokenType !== tokenTypes.Semicolon &&
		// SCSS allows a nested property block to follow a value
		this.tokenType !== tokenTypes.LeftCurlyBracket &&
		this.isDelim(EXCLAMATION_MARK) === false &&
		this.isBalanceEdge(startValueToken) === false
	) {
		this.error();
	}

	return value;
}

/**
 * Reads a property name, which in SCSS may contain interpolation anywhere
 * within it, such as `border-#{$side}-width`.
 * @this {any}
 * @returns {string} The property name as it appears in the source.
 */
function readProperty() {
	const start = this.tokenStart;

	// CSS browser hacks, none of which start an interpolation
	if (this.tokenType === tokenTypes.Delim && !isInterpolationStart(this)) {
		switch (this.charCodeAt(this.tokenStart)) {
			case ASTERISK:
			case DOLLAR_SIGN:
			case PLUS_SIGN:
			case NUMBER_SIGN:
			case AMPERSAND:
				this.next();
				break;

			case SOLIDUS:
				this.next();
				if (this.isDelim(SOLIDUS)) {
					this.next();
				}
				break;

			default:
				break;
		}
	}

	do {
		if (isInterpolationStart(this)) {
			skipInterpolation(this);
		} else if (this.tokenType === tokenTypes.Hash) {
			this.eat(tokenTypes.Hash);
		} else {
			this.eat(tokenTypes.Ident);
		}
	} while (this.tokenType === tokenTypes.Ident || isInterpolationStart(this));

	return this.substrToCursor(start);
}

/**
 * Reads the `!`-prefixed flags that may follow a value, such as `!important`,
 * `!default`, and `!global`.
 * @this {any}
 * @returns {Array<string>} The flag names in source order, without the `!`.
 */
function readFlags() {
	const flags = [];

	while (this.isDelim(EXCLAMATION_MARK)) {
		this.next();
		this.skipSC();
		flags.push(this.consume(tokenTypes.Ident));
		this.skipSC();
	}

	return flags;
}

/**
 * Determines if a flag list contains a given flag.
 * @param {Array<string>} flags The flags that were read.
 * @param {string} name The flag to look for.
 * @returns {boolean} `true` when the flag is present.
 */
function hasFlag(flags, name) {
	return flags.some(flag => flag.toLowerCase() === name);
}

/**
 * Parses a `$name: value` declaration.
 * @this {any}
 * @param {number} start The source offset the declaration starts at.
 * @param {number} startToken The token index the declaration starts at.
 * @returns {any} The `ScssVariableDeclaration` node.
 */
function parseVariableDeclaration(start, startToken) {
	let namespace = null;

	if (this.tokenType === tokenTypes.Ident) {
		namespace = this.consume(tokenTypes.Ident);
		this.eatDelim(FULL_STOP);
	}

	this.eatDelim(DOLLAR_SIGN);

	const variableName = this.consume(tokenTypes.Ident);

	this.skipSC();
	this.eat(tokenTypes.Colon);
	this.skipSC();

	const value = this.parseValue
		? this.parseWithFallback(consumeValue, consumeValueRaw)
		: consumeValueRaw.call(this);

	const flags = readFlags.call(this);

	if (
		this.eof === false &&
		this.tokenType !== tokenTypes.Semicolon &&
		this.isBalanceEdge(startToken) === false
	) {
		this.error();
	}

	return {
		type: "ScssVariableDeclaration",
		loc: this.getLocation(start, this.tokenStart),
		namespace,
		name: variableName,
		value,
		default: hasFlag(flags, "default"),
		global: hasFlag(flags, "global"),
	};
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export const name = "Declaration";

/** @type {NodeSyntaxConfig["structure"]} */
export const structure = {
	important: [Boolean, String],
	property: String,
	value: ["Value", "Raw"],
};

/**
 * Parses a declaration.
 * @this {any}
 * @returns {any} A `Declaration`, `ScssVariableDeclaration`, or
 *      `ScssNestedProperty` node.
 */
export function parse() {
	const start = this.tokenStart;
	const startToken = this.tokenIndex;

	if (isVariableStart(this)) {
		return parseVariableDeclaration.call(this, start, startToken);
	}

	const property = readProperty.call(this);
	const customProperty = property.startsWith("--");
	const parseValue = customProperty
		? this.parseCustomProperty
		: this.parseValue;
	const consumeRaw = customProperty
		? consumeCustomPropertyRaw
		: consumeValueRaw;
	/** @type {boolean|string} */
	let important = false;
	let value = null;

	this.skipSC();
	this.eat(tokenTypes.Colon);

	/*
	 * A block immediately after the colon means nested properties, as in
	 * `font: { family: serif; }`. Custom properties are excluded because a
	 * block is a legitimate custom property value in plain CSS.
	 */
	if (
		!customProperty &&
		this.lookupTypeNonSC(0) === tokenTypes.LeftCurlyBracket
	) {
		this.skipSC();

		return {
			type: "ScssNestedProperty",
			loc: this.getLocation(start, this.tokenStart),
			property,
			value: null,
			block: this.Block(true, { allowNestedRules: false }),
		};
	}

	const valueStart = this.tokenIndex;

	if (!customProperty) {
		this.skipSC();
	}

	if (parseValue) {
		value = this.parseWithFallback(consumeValue, consumeRaw);
	} else {
		value = consumeRaw.call(this);
	}

	if (customProperty && value.type === "Value" && value.children.isEmpty) {
		for (let offset = valueStart - this.tokenIndex; offset <= 0; offset++) {
			if (this.lookupType(offset) === tokenTypes.WhiteSpace) {
				value.children.appendData({
					type: "WhiteSpace",
					loc: null,
					value: " ",
				});
				break;
			}
		}
	}

	// `font: 12px/1.5 { family: serif; }` combines a value with nested properties
	if (this.tokenType === tokenTypes.LeftCurlyBracket) {
		return {
			type: "ScssNestedProperty",
			loc: this.getLocation(start, this.tokenStart),
			property,
			value,
			block: this.Block(true, { allowNestedRules: false }),
		};
	}

	if (this.isDelim(EXCLAMATION_MARK)) {
		const flags = readFlags.call(this);

		important =
			flags.length === 1 && flags[0] === "important"
				? true
				: flags.join(" !");
	}

	if (
		this.eof === false &&
		this.tokenType !== tokenTypes.Semicolon &&
		this.isBalanceEdge(startToken) === false
	) {
		this.error();
	}

	return {
		type: "Declaration",
		loc: this.getLocation(start, this.tokenStart),
		important,
		property,
		value,
	};
}

/**
 * Generates the source text for a declaration.
 * @this {any}
 * @param {any} node The node to generate.
 * @returns {void}
 */
export function generate(node) {
	// the property may contain interpolation, so let the tokenizer sort it out
	this.tokenize(node.property);
	this.token(tokenTypes.Colon, ":");
	this.node(node.value);

	if (node.important) {
		this.token(tokenTypes.Delim, "!");
		this.token(
			tokenTypes.Ident,
			node.important === true ? "important" : node.important,
		);
	}
}
