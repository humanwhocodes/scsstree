/**
 * @fileoverview SCSS custom syntax for CSSTree.
 *
 * The extension is written to work with either shape of input it may receive:
 * `fork()` passes the complete syntax config it's extending, while the ESLint
 * CSS plugin passes only the CSS definition data and merges the result. In the
 * second case anything not returned here is filled in from the defaults, which
 * is why the pieces below never assume that `previous` is complete.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenize as cssTokenize } from "@eslint/css-tree";

import * as ScssAtrulePrelude from "./node/scss-atrule-prelude.js";
import * as ScssBlock from "./node/scss-block.js";
import * as ScssClassSelector from "./node/scss-class-selector.js";
import * as ScssCondition from "./node/scss-condition.js";
import * as ScssDeclaration from "./node/scss-declaration.js";
import * as ScssFeature from "./node/scss-feature.js";
import * as ScssFunction from "./node/scss-function.js";
import * as ScssInterpolation from "./node/scss-interpolation.js";
import * as ScssMediaQuery from "./node/scss-media-query.js";
import * as ScssNestedProperty from "./node/scss-nested-property.js";
import * as ScssPlaceholderSelector from "./node/scss-placeholder-selector.js";
import * as ScssStyleSheet from "./node/scss-stylesheet.js";
import * as ScssVariable from "./node/scss-variable.js";
import * as ScssVariableDeclaration from "./node/scss-variable-declaration.js";

import scssBlock from "./atrule/scss-block.js";
import scssAtRoot from "./atrule/scss-at-root.js";
import scssExtend from "./atrule/scss-extend.js";
import scssImport from "./atrule/scss-import.js";

import { createSelectorScope } from "./scope/selector.js";
import { createValueScope } from "./scope/value.js";

import { createScssAtrules } from "./atrules.js";
import { createScssTokenizer } from "./tokenize.js";
import { scssTypes, scssValueType } from "./types.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { SyntaxExtensionCallback } from "@eslint/css-tree"
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * The at-rules whose blocks may contain declarations, nested rules, and other
 * at-rules all at once. CSSTree otherwise guesses which of those a block holds
 * by looking ahead for a `{`.
 * @type {Array<string>}
 */
const blockAtruleNames = [
	"mixin",
	"include",
	"function",
	"if",
	"else",
	"each",
	"for",
	"while",
];

/**
 * The selector parts that SCSS adds to the CSS ones.
 * @type {Array<string>}
 */
const selectorChildren = [
	"TypeSelector",
	"IdSelector",
	"ClassSelector",
	"AttributeSelector",
	"PseudoClassSelector",
	"PseudoElementSelector",
	"NestingSelector",
	"Combinator",
	"ScssInterpolation",
	"ScssPlaceholderSelector",
];

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * SCSS syntax extension for CSSTree.
 * @type {SyntaxExtensionCallback}
 */
export const scss = prev => {
	/** @type {any} */
	const previous = prev ?? {};

	const atrule = { ...previous.atrule };

	for (const atruleName of blockAtruleNames) {
		atrule[atruleName] = {
			parse: {
				...previous.atrule?.[atruleName]?.parse,
				block: scssBlock,
			},
		};
	}

	atrule.extend = scssExtend;
	atrule["at-root"] = scssAtRoot;
	atrule.import = scssImport;

	/*
	 * Declarations inside an at-rule block are validated as descriptors of
	 * that at-rule, and descriptors are matched without the CSS-wide keywords
	 * that `<scss-value>` rides along with. Widening each property here is
	 * what lets `@mixin m { color: $primary; }` validate.
	 */
	const descriptors = Object.fromEntries(
		Object.entries(previous.properties ?? {}).map(([property, syntax]) => [
			property,
			`${syntax} | ${scssValueType}`,
		]),
	);

	return {
		...previous,

		tokenize: createScssTokenizer(previous.tokenize ?? cssTokenize),

		node: {
			...previous.node,

			// overridden CSS nodes
			AtrulePrelude: ScssAtrulePrelude,
			Block: ScssBlock,
			ClassSelector: ScssClassSelector,
			Condition: ScssCondition,
			Declaration: ScssDeclaration,
			Feature: ScssFeature,
			MediaQuery: ScssMediaQuery,
			StyleSheet: ScssStyleSheet,
			Function: {
				...previous.node?.Function,
				generate: ScssFunction.generate,
			},
			Selector: {
				...previous.node?.Selector,
				structure: {
					children: [selectorChildren],
				},
			},

			// SCSS nodes
			ScssInterpolation,
			ScssNestedProperty,
			ScssPlaceholderSelector,
			ScssVariable,
			ScssVariableDeclaration,
		},

		scope: {
			...previous.scope,
			AtrulePrelude: createValueScope(previous.scope?.AtrulePrelude),
			Selector: createSelectorScope(previous.scope?.Selector),
			Value: createValueScope(previous.scope?.Value),
		},

		atrule,

		atrules: {
			...previous.atrules,
			...createScssAtrules(
				descriptors,
				previous.atrules?.import?.prelude ?? "",
			),
		},

		types: {
			...previous.types,
			...scssTypes,
		},

		cssWideKeywords: [...(previous.cssWideKeywords ?? []), scssValueType],
	};
};
