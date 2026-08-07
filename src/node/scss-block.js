/**
 * @fileoverview Overrides `Block` parsing to support SCSS.
 *
 * The CSS parser has to guess whether something inside a block starts a nested
 * rule or a declaration. SCSS widens both sides of that guess: `%placeholder`
 * and `#{$name}` can start a selector, `&` is far more likely to be glued to a
 * suffix (`&__item`) than to be a browser hack, and `$name: value` is always a
 * declaration.
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
	FULL_STOP,
	GREATER_THAN_SIGN,
	PLUS_SIGN,
	TILDE,
} from "../char-codes.js";
import {
	isInterpolationStart,
	isPlaceholderStart,
	looksLikeSelector,
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

const selectorStarts = new Set([
	AMPERSAND,
	FULL_STOP,
	ASTERISK,
	PLUS_SIGN,
	GREATER_THAN_SIGN,
	TILDE,
]);

/** @this {any} */
function consumeRaw() {
	return this.Raw(null, true);
}

/** @this {any} */
function consumeRule() {
	return this.parseWithFallback(this.Rule, consumeRaw);
}

/** @this {any} */
function consumeRawDeclaration() {
	return this.Raw(this.consumeUntilSemicolonIncluded, true);
}

/** @this {any} */
function consumeDeclaration() {
	if (this.tokenType === tokenTypes.Semicolon) {
		return consumeRawDeclaration.call(this);
	}

	const node = this.parseWithFallback(
		this.Declaration,
		consumeRawDeclaration,
	);

	if (this.tokenType === tokenTypes.Semicolon) {
		this.next();
	}

	return node;
}

/**
 * Determines if an identifier starts a selector rather than a declaration.
 * @this {any}
 * @returns {boolean} `true` when the identifier starts a selector.
 */
function isElementSelectorStart() {
	if (this.tokenType !== tokenTypes.Ident) {
		return false;
	}

	/*
	 * An identifier followed by interpolation is ambiguous the same way `&` is:
	 * `a#{$x} {}` is a selector while `border-#{$side}: 1px` is a declaration.
	 */
	if (isInterpolationStart(this, 1)) {
		return looksLikeSelector(this);
	}

	const nextTokenType = this.lookupTypeNonSC(1);

	if (
		nextTokenType !== tokenTypes.Colon &&
		nextTokenType !== tokenTypes.Semicolon &&
		nextTokenType !== tokenTypes.RightCurlyBracket
	) {
		return true;
	}

	/*
	 * A colon is ambiguous: `p: value` is a declaration, `p:hover {}` is a
	 * selector, and `p: { size: 1px }` is a nested property. Only the first
	 * two can be told apart by looking for a block.
	 */
	if (nextTokenType === tokenTypes.Colon) {
		const tokenAfterColon = this.lookupTypeNonSC(2);

		if (
			tokenAfterColon === tokenTypes.Ident ||
			tokenAfterColon === tokenTypes.Function
		) {
			return looksLikeSelector(this);
		}
	}

	return false;
}

/**
 * Determines if the current token starts a selector.
 * @this {any}
 * @returns {boolean} `true` when a selector starts here.
 */
function isSelectorStart() {
	if (this.tokenType === tokenTypes.Delim) {
		const code = this.charCodeAt(this.tokenStart);

		// `$name: value` is always a declaration
		if (code === DOLLAR_SIGN) {
			return false;
		}

		// `%button {}` is a placeholder selector
		if (isPlaceholderStart(this)) {
			return true;
		}

		/*
		 * `#{$name}` may start either a selector or a property name, so fall
		 * back to looking for the block that a selector must be followed by.
		 */
		if (isInterpolationStart(this)) {
			return looksLikeSelector(this);
		}

		if (!selectorStarts.has(code)) {
			return false;
		}

		/*
		 * `*zoom: 1` and `+width: 100px` are browser hacks. The `&` hack is
		 * not honored because `&__item {}` is idiomatic SCSS.
		 */
		if (code === ASTERISK || code === PLUS_SIGN) {
			if (
				this.lookupType(1) === tokenTypes.Ident &&
				this.lookupTypeNonSC(1) === tokenTypes.Ident
			) {
				return false;
			}
		}

		return true;
	}

	if (this.tokenType === tokenTypes.Hash) {
		return true;
	}

	return (
		this.tokenType === tokenTypes.LeftSquareBracket ||
		this.tokenType === tokenTypes.Colon ||
		isElementSelectorStart.call(this)
	);
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export const name = "Block";
export const walkContext = "block";

/** @type {NodeSyntaxConfig["structure"]} */
export const structure = {
	children: [
		[
			"Atrule",
			"Rule",
			"Declaration",
			"ScssVariableDeclaration",
			"ScssNestedProperty",
		],
	],
};

/**
 * Parses a block.
 * @this {any}
 * @param {boolean} isStyleBlock Whether the block contains declarations.
 * @param {{allowNestedRules?: boolean}} [options] Parsing options.
 * @returns {any} The `Block` node.
 */
export function parse(isStyleBlock, { allowNestedRules = false } = {}) {
	const start = this.tokenStart;
	const children = this.createList();

	this.eat(tokenTypes.LeftCurlyBracket);

	scan: while (!this.eof) {
		switch (this.tokenType) {
			case tokenTypes.RightCurlyBracket:
				break scan;

			case tokenTypes.WhiteSpace:
			case tokenTypes.Comment:
				this.next();
				break;

			case tokenTypes.AtKeyword:
				children.push(
					this.parseWithFallback(
						this.Atrule.bind(this, isStyleBlock, {
							allowNestedRules,
						}),
						consumeRaw,
					),
				);
				break;

			default:
				if (!isStyleBlock) {
					children.push(consumeRule.call(this));
					break;
				}

				if (allowNestedRules && isSelectorStart.call(this)) {
					children.push(consumeRule.call(this));
				} else {
					children.push(consumeDeclaration.call(this));
				}
		}
	}

	if (!this.eof) {
		this.eat(tokenTypes.RightCurlyBracket);
	}

	return {
		type: "Block",
		loc: this.getLocation(start, this.tokenStart),
		children,
	};
}

/**
 * Generates the source text for a block.
 * @this {any}
 * @param {any} node The node to generate.
 * @returns {void}
 */
export function generate(node) {
	this.token(tokenTypes.LeftCurlyBracket, "{");
	this.children(node, (/** @type {any} */ prev) => {
		if (
			prev.type === "Declaration" ||
			prev.type === "ScssVariableDeclaration"
		) {
			this.token(tokenTypes.Semicolon, ";");
		}
	});
	this.token(tokenTypes.RightCurlyBracket, "}");
}
