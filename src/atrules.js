/**
 * @fileoverview Lexer definitions for the SCSS at-rules.
 *
 * The preludes of the SCSS at-rules are expressions rather than CSS grammars,
 * so they're described as `<any-value>`. That's enough for the at-rule and its
 * descriptors to be recognized as valid; the parser is what gives the prelude
 * its structure.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const REQUIRED_PRELUDE = "<any-value>";
const OPTIONAL_PRELUDE = "<any-value>?";

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Creates the at-rule definitions to add to the CSSTree lexer.
 * @param {Record<string, string>} descriptors The declarations allowed inside
 *      the at-rules that take a style block.
 * @param {string} importPrelude The CSS `@import` prelude to extend.
 * @returns {Record<string, object>} The at-rule definitions.
 */
export function createScssAtrules(descriptors, importPrelude) {
	return {
		// SCSS allows a comma-separated list of paths
		import: { prelude: `${importPrelude} | [ <string> | <url> ]#` },

		// module system
		use: { prelude: REQUIRED_PRELUDE },
		forward: { prelude: REQUIRED_PRELUDE },

		// mixins and functions
		mixin: { prelude: REQUIRED_PRELUDE, descriptors },
		include: { prelude: REQUIRED_PRELUDE, descriptors },
		content: { prelude: OPTIONAL_PRELUDE },
		function: { prelude: REQUIRED_PRELUDE, descriptors },
		return: { prelude: REQUIRED_PRELUDE },

		// flow control
		if: { prelude: REQUIRED_PRELUDE, descriptors },
		else: { prelude: OPTIONAL_PRELUDE, descriptors },
		each: { prelude: REQUIRED_PRELUDE, descriptors },
		for: { prelude: REQUIRED_PRELUDE, descriptors },
		while: { prelude: REQUIRED_PRELUDE, descriptors },

		// everything else
		extend: { prelude: REQUIRED_PRELUDE },
		"at-root": { prelude: OPTIONAL_PRELUDE, descriptors },
		debug: { prelude: REQUIRED_PRELUDE },
		warn: { prelude: REQUIRED_PRELUDE },
		error: { prelude: REQUIRED_PRELUDE },
	};
}
