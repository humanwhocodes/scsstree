# SCSSTree

by [Nicholas C. Zakas](https://humanwhocodes.com)

If you find this useful, please consider supporting my work with a [donation](https://humanwhocodes.com/donate).

## Description

SCSS (Sass-style CSS) custom syntax in CSSTree format.

## Installation

```shell
npm install scsstree
```

## Usage

This package exports the following object:

- `scss` - CSSTree syntax extensions for SCSS syntax

You can import it like this:

```js
import { scss } from "scsstree";
```

### Use with ESLint CSS Plugin

To use this package with the [ESLint CSS plugin](https://github.com/eslint/css), use `languageOptions.customSyntax` in your `eslint.config.js` file:

```js
// eslint.config.js
import { defineConfig } from "eslint/config";
import css from "@eslint/css";
import { scss } from "scsstree";

export default defineConfig([
	{
		files: ["**/*.scss"],
		plugins: {
			css,
		},
		language: "css/css",
		languageOptions: {
			customSyntax: scss,
		},
		rules: {
			"css/no-empty-blocks": "error",
		},
	},
]);
```

**Note:** Not all ESLint CSS plugin rules make sense for SCSS. See [Limitations](#limitations).

### Use with CSSTree directly

If you're using [CSSTree](https://github.com/eslint/csstree) directly, pass `scss` to `fork()`:

```js
import { fork } from "@eslint/css-tree";
import { scss } from "scsstree";

const { parse, toPlainObject } = fork(scss);

const result = parse("$primary: #333; .a { color: $primary; }");
console.log(toPlainObject(result));
```

## Supported syntax

Everything CSS supports, plus:

| Feature                | Example                                               |
| ---------------------- | ----------------------------------------------------- |
| Single-line comments   | `// comment`                                          |
| Variables              | `$primary: #333 !default;`, `color: $primary`         |
| Namespaced variables   | `colors.$primary`, `config.$spacing: 8px;`            |
| Interpolation          | `#{$name}` in selectors, property names, and values   |
| Placeholder selectors  | `%button { ... }`                                     |
| Parent selector suffix | `&__element`, `&--modifier`                           |
| Nested properties      | `font: { family: serif; size: 30em; }`                |
| Maps and lists         | `$m: (key: value, other: 1px);`                       |
| Operators              | `+ - * / %`, `== != < <= > >=`, `and`, `or`, `not`    |
| Namespaced functions   | `math.div(1, 2)`, `map.get($m, "k")`                  |
| Argument lists         | `@mixin m($args...)`                                  |
| Module system          | `@use`, `@forward`                                    |
| Multi-path imports     | `@import "a", "b";`                                   |
| Mixins                 | `@mixin`, `@include ... using (...)`, `@content`      |
| Functions              | `@function`, `@return`                                |
| Flow control           | `@if`, `@else if`, `@else`, `@each`, `@for`, `@while` |
| Inheritance            | `@extend .a !optional`                                |
| Output placement       | `@at-root`, `@at-root (without: media)`               |
| Diagnostics            | `@debug`, `@warn`, `@error`                           |
| SCSS in media queries  | `@media (min-width: $w)`, `@media #{$query}`          |

## AST

The syntax adds these node types on top of CSSTree's:

| Node                      | Description                                                           |
| ------------------------- | --------------------------------------------------------------------- |
| `ScssVariable`            | A variable reference: `name`, `namespace`                             |
| `ScssVariableDeclaration` | `$a: 1px !default`: `name`, `namespace`, `value`, `default`, `global` |
| `ScssInterpolation`       | `#{...}`: `children`                                                  |
| `ScssPlaceholderSelector` | `%button`: `name`                                                     |
| `ScssNestedProperty`      | `font: { ... }`: `property`, `value`, `block`                         |

A `$name: value` assignment is deliberately **not** a `Declaration`, because it isn't a CSS property and shouldn't be checked like one. Rules that visit `Declaration` will skip variable assignments and nested property blocks.

Namespaced function calls are regular `Function` nodes whose `name` includes the namespace, so `math.div(1, 2)` has the name `math.div`.

## Limitations

Some ESLint CSS plugin rules reason about CSS semantics that SCSS doesn't share:

- `css/no-invalid-at-rule-placement` flags `@import` after `@use` and `@forward`, which is the order SCSS requires.
- `css/use-baseline` flags `@function` because CSS is shipping an unrelated at-rule of the same name.
- `css/no-invalid-properties` flags interpolated property names such as `#{$prop}: red`, because the property that the interpolation produces isn't known until Sass compiles it.

Turn those rules off for your SCSS files.

Values are only checked against the CSS grammar for their property when they contain no SCSS. A value with a variable, an interpolation, or a namespaced function call in it is accepted as-is, since its result isn't known until Sass compiles it.

## License

Copyright 2026 Nicholas C. Zakas

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
