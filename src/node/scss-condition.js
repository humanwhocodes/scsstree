/**
 * @fileoverview Overrides `Condition` parsing so that variables and
 * interpolation can appear inside media, container, and supports conditions.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import { isInterpolationStart, isVariableStart } from "../util/parser.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { NodeSyntaxConfig } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const likelyFeatureToken = new Set([
	tokenTypes.Colon,
	tokenTypes.RightParenthesis,
	tokenTypes.EOF,
]);

/**
 * Parses a grouped condition without first attempting a declaration or range.
 * @this {any}
 * @param {string} kind The kind of condition being parsed.
 * @returns {any} The nested condition.
 */
function nestedCondition(kind) {
	this.eat(tokenTypes.LeftParenthesis);
	const result = this.Condition(kind);
	this.eat(tokenTypes.RightParenthesis);
	return result;
}

/**
 * Parses a parenthesized term as either a feature or a feature range.
 * @this {any}
 * @param {string} kind The kind of condition being parsed.
 * @returns {any} The parsed node.
 */
function featureOrRange(kind) {
	if (
		this.lookupTypeNonSC(1) === tokenTypes.Ident &&
		likelyFeatureToken.has(this.lookupTypeNonSC(2))
	) {
		return this.Feature(kind);
	}

	return this.FeatureRange(kind);
}

/** @type {Record<string, (this: any, kind: string) => any>} */
const parentheses = {
	media: featureOrRange,
	container: featureOrRange,

	/** @this {any} */
	supports() {
		return this.SupportsDeclaration();
	},
};

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export const name = "Condition";

/** @type {NodeSyntaxConfig["structure"]} */
export const structure = {
	kind: String,
	children: [
		[
			"Identifier",
			"Feature",
			"FeatureFunction",
			"FeatureRange",
			"SupportsDeclaration",
			"Condition",
			"GeneralEnclosed",
			"ScssVariable",
			"ScssInterpolation",
		],
	],
};

/**
 * Parses a condition.
 * @this {any}
 * @param {string} [kind] The kind of condition being parsed.
 * @returns {any} The `Condition` node.
 */
export function parse(kind = "media") {
	const children = this.createList();

	scan: while (!this.eof) {
		switch (this.tokenType) {
			case tokenTypes.Comment:
			case tokenTypes.WhiteSpace:
				this.next();
				continue;

			case tokenTypes.Ident:
				if (isVariableStart(this)) {
					children.push(this.ScssVariable());
				} else {
					children.push(this.Identifier());
				}
				break;

			case tokenTypes.Delim:
				if (isInterpolationStart(this)) {
					children.push(this.ScssInterpolation());
					break;
				}

				if (isVariableStart(this)) {
					children.push(this.ScssVariable());
					break;
				}

				break scan;

			case tokenTypes.LeftParenthesis: {
				const nextType = this.lookupTypeNonSC(1);

				if (
					nextType === tokenTypes.LeftParenthesis ||
					nextType === tokenTypes.Function ||
					(nextType === tokenTypes.Ident &&
						(this.lookupTypeNonSC(2) ===
							tokenTypes.LeftParenthesis ||
							this.lookupTypeNonSC(2) === tokenTypes.Function))
				) {
					children.push(nestedCondition.call(this, kind));
					break;
				}

				let term = this.parseWithFallback(
					() => parentheses[kind].call(this, kind),
					() => null,
				);

				if (!term) {
					term = this.parseWithFallback(
						() => nestedCondition.call(this, kind),
						() => this.GeneralEnclosed(kind),
					);
				}

				children.push(term);
				break;
			}

			case tokenTypes.Function: {
				const functionName = this.substring(
					this.tokenStart,
					this.tokenEnd - 1,
				).toLowerCase();
				const isFeature =
					kind !== "container" &&
					typeof this.features[kind]?.[functionName] === "function";

				children.push(
					isFeature
						? this.FeatureFunction(kind)
						: this.GeneralEnclosed(kind),
				);
				break;
			}

			default:
				break scan;
		}
	}

	if (children.isEmpty) {
		this.error("Condition is expected");
	}

	return {
		type: name,
		loc: this.getLocationFromList(children),
		kind,
		children,
	};
}

/**
 * Generates the source text for a condition.
 * @this {any}
 * @param {any} node The node to generate.
 * @returns {void}
 */
export function generate(node) {
	node.children.forEach((/** @type {any} */ child) => {
		if (child.type === "Condition") {
			this.token(tokenTypes.LeftParenthesis, "(");
			this.node(child);
			this.token(tokenTypes.RightParenthesis, ")");
		} else {
			this.node(child);
		}
	});
}
