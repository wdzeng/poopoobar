# TypeScript Template

My typescript project template. Integrates with:

- Node.js v20
- Pnpm
- ECMAScript 2022
- ESM modules
- TypeScript v5
- ESLint/Prettier

## Node and TypeScript Configurations

### ES2022

This template integrates with ECMAScript 2022, so `target` and `module` fields in tsconfig are set
to `es2022`.

### ES Module

This template is using ES module (ESM), so `type` is set to `module` in package.json and
`moduleResolution` set to `bundler` in tsconfig.

Replace `require` with `import`; do not use `exports` or `modules.export`.

```js
❌ const fs = require('fs')
✅ import fs from 'node:fs'
```

Prevent CJS-only syntax. See [Differences between ES modules and CommonJS](https://nodejs.org/api/esm.html#differences-between-es-modules-and-commonjs).

```js
❌ const currentDir = __dirname
✅ const currentDir = path.dirname(url.fileURLToPath(import.meta.url))
```

### Path Alias

The template is using path alias `@` which is set to `src`.

```ts
import helloworld from '@/helloworld.js'
```

Please update `paths` field in tsconfig to change path aliases.

## Development

This template is using [`tsx`](https://github.com/esbuild-kit/tsx) for development.

```shell
pnpm dev
```

## Linting

This template leverages ESLint and Prettier, using my custom eslint configurations at
[`wdzeng/eslint-config`](https://github.com/wdzeng/eslint-config).

Please use ESLint as default formatter if you are developing with VSCode, or use `pnpm lint` command
to lint codes under src directory.

```shell
pnpm lint
```

## Build Project

This template is using [`esbuild`](https://github.com/evanw/esbuild) to transpile all TypeScript
files into a single JavaScript file.

```shell
pnpm build
node dist/index.cjs
```
