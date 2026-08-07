/**
 * @fileoverview Lexer type definitions for SCSS values.
 *
 * A declaration whose value is an SCSS expression can't be validated against
 * the CSS grammar for its property, because the expression's result isn't
 * known until Sass compiles it. `<scss-value>` matches any value that contains
 * at least one unmistakably-SCSS construct — a variable, an interpolation, or
 * a namespaced function call — at any nesting depth. It's registered as a
 * CSS-wide keyword so that it's accepted for every property.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * The name of the type matching any value containing SCSS syntax.
 * @type {string}
 */
export const scssValueType = "<scss-value>";

/**
 * Type definitions to add to the CSSTree lexer.
 * @type {Record<string, string>}
 */
export const scssTypes = {
	// the constructs that make a value unmistakably SCSS
	"scss-marker":
		"'$' <ident> | <ident> '.' '$' <ident> | <ident> '.' <function-token> <scss-part>* ')' | '#' '{' <declaration-value> '}'",

	// any single token that may appear in a value
	"scss-token":
		"<ident-token> | <number-token> | <dimension-token> | <percentage-token> | <string-token> | <hash-token> | <url-token> | <delim-token> | <comma-token> | <colon-token>",

	// a balanced group with no SCSS construct in it
	"scss-group":
		"<function-token> <scss-part>* ')' | '(' <scss-part>* ')' | '[' <scss-part>* ']'",

	"scss-part": "<scss-marker> | <scss-group> | <scss-token>",

	// a balanced group that does contain an SCSS construct
	"scss-marked-group":
		"<function-token> <scss-part>* <scss-marked> <scss-part>* ')' | '(' <scss-part>* <scss-marked> <scss-part>* ')' | '[' <scss-part>* <scss-marked> <scss-part>* ']'",

	"scss-marked": "<scss-marker> | <scss-marked-group>",

	"scss-value": "<scss-part>* <scss-marked> <scss-part>*",
};
