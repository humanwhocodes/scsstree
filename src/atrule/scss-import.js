/**
 * @fileoverview The `@import` at-rule parser.
 *
 * SCSS extends CSS's `@import` with a comma-separated list of paths, as in
 * `@import "a", "b";`. Anything else is parsed as a CSS `@import` so that
 * `layer()`, `supports()`, and media queries keep working.
 *
 * The CSS half is reimplemented here rather than delegated to, because a
 * syntax extension isn't always handed the syntax it extends.
 * @see https://github.com/eslint/csstree/blob/main/lib/syntax/atrule/import.js
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { ConsumerFunction } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Parses a value inside one of `@import`'s functions, falling back to a raw
 * value when it doesn't parse.
 * @this {any}
 * @param {ConsumerFunction} parse The parser to try.
 * @param {ConsumerFunction} [fallback] The parser to fall back to.
 * @returns {any} The parsed node.
 */
function parseWithFallback(parse, fallback) {
	return this.parseWithFallback(
		() => {
			try {
				return parse.call(this);
			} finally {
				this.skipSC();

				if (this.lookupNonWSType(0) !== tokenTypes.RightParenthesis) {
					this.error();
				}
			}
		},
		fallback || (() => this.Raw(null, true)),
	);
}

/**
 * Wraps a parsed node in a list, dropping empty raw values.
 * @this {any}
 * @param {any} node The parsed node.
 * @returns {any} The list of children.
 */
function toChildren(node) {
	const children = this.createList();

	if (node.type !== "Raw" || node.value !== "") {
		children.push(node);
	}

	return children;
}

const parseFunctions = {
	/** @this {any} */
	layer() {
		this.skipSC();

		return toChildren.call(this, parseWithFallback.call(this, this.Layer));
	},

	/** @this {any} */
	supports() {
		this.skipSC();

		return toChildren.call(
			this,
			parseWithFallback.call(this, this.Declaration, () =>
				parseWithFallback.call(this, () => this.Condition("supports")),
			),
		);
	},
};

/**
 * Reads one path from an SCSS import list.
 * @this {any}
 * @returns {any} The `String`, `Url`, or `Function` node for the path.
 */
function readImportPath() {
	switch (this.tokenType) {
		case tokenTypes.String:
			return this.String();

		case tokenTypes.Url:
		case tokenTypes.Function:
			return this.Url();

		default:
			this.error("String or url() is expected");
			return null;
	}
}

/**
 * Determines if the prelude is an SCSS import list, meaning a top-level comma
 * is followed by another path.
 * @this {any}
 * @returns {boolean} `true` when the prelude is a comma-separated path list.
 */
function isImportList() {
	let depth = 0;

	for (let offset = 0; ; offset++) {
		switch (this.lookupType(offset)) {
			case tokenTypes.EOF:
			case tokenTypes.Semicolon:
			case tokenTypes.LeftCurlyBracket:
				return false;

			case tokenTypes.Function:
			case tokenTypes.LeftParenthesis:
				depth++;
				break;

			case tokenTypes.RightParenthesis:
				depth--;
				break;

			case tokenTypes.Comma: {
				if (depth > 0) {
					break;
				}

				let next = offset + 1;
				let nextType = this.lookupType(next);

				while (
					nextType === tokenTypes.WhiteSpace ||
					nextType === tokenTypes.Comment
				) {
					nextType = this.lookupType(++next);
				}

				return (
					nextType === tokenTypes.String ||
					nextType === tokenTypes.Url ||
					(nextType === tokenTypes.Function &&
						this.cmpStr(
							this.getTokenStart(this.tokenIndex + next),
							this.getTokenEnd(this.tokenIndex + next),
							"url(",
						))
				);
			}

			default:
				break;
		}
	}
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export default {
	parse: {
		/**
		 * @this {any}
		 * @returns {any} The prelude children.
		 */
		prelude() {
			const children = this.createList();

			children.push(readImportPath.call(this));

			// `@import "a", "b";` is SCSS-only
			if (isImportList.call(this)) {
				this.skipSC();

				while (this.tokenType === tokenTypes.Comma) {
					children.push(this.Operator());
					this.skipSC();
					children.push(readImportPath.call(this));
					this.skipSC();
				}

				return children;
			}

			for (;;) {
				this.skipSC();

				if (
					this.tokenType === tokenTypes.Function &&
					this.cmpStr(this.tokenStart, this.tokenEnd, "layer(")
				) {
					children.push(this.Function(null, parseFunctions));
				} else if (
					this.tokenType === tokenTypes.Ident &&
					this.cmpStr(this.tokenStart, this.tokenEnd, "layer")
				) {
					children.push(this.Identifier());
				} else {
					break;
				}
			}

			this.skipSC();

			if (
				this.tokenType === tokenTypes.Function &&
				this.cmpStr(this.tokenStart, this.tokenEnd, "supports(")
			) {
				children.push(this.Function(null, parseFunctions));
			}

			if (
				this.lookupNonWSType(0) === tokenTypes.Ident ||
				this.lookupNonWSType(0) === tokenTypes.LeftParenthesis
			) {
				children.push(this.MediaQueryList());
			}

			return children;
		},

		block: null,
	},
};
