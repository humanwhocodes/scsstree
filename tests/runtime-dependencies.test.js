/**
 * @fileoverview Tests for runtime dependency behavior.
 *
 * The nodes, at-rules, and scopes are meant to work against any CSSTree
 * implementation, so they use the numeric token type constants in
 * `src/token-types.js` rather than importing them from a particular package.
 * `src/scss.js` is the one exception: it needs a CSS tokenizer to build the
 * SCSS one on top of, and can't always get one from the syntax it extends.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const allowedRuntimeImports = new Set(["src/scss.js"]);

/**
 * Lists every JavaScript file under a directory.
 * @param {string} directory The directory to walk.
 * @returns {Promise<Array<string>>} The file paths, relative to the cwd.
 */
async function findSourceFiles(directory) {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const entryPath = path.posix.join(directory, entry.name);

		if (entry.isDirectory()) {
			files.push(...(await findSourceFiles(entryPath)));
		} else if (entry.name.endsWith(".js")) {
			files.push(entryPath);
		}
	}

	return files;
}

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("Runtime dependencies", () => {
	it("should only import @eslint/css-tree at runtime where allowed", async () => {
		const importPattern =
			/^\s*import\s+(?!type\b)[^;]*?from\s*["']@eslint\/css-tree["']/mu;

		for (const file of await findSourceFiles("src")) {
			const contents = await fs.readFile(file, "utf8");
			const hasRuntimeImport = importPattern.test(contents);

			assert.strictEqual(
				hasRuntimeImport,
				allowedRuntimeImports.has(file),
				hasRuntimeImport
					? `Unexpected runtime import of @eslint/css-tree in ${file}`
					: `Expected a runtime import of @eslint/css-tree in ${file}`,
			);
		}
	});
});
