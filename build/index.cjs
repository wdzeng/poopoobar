#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const { build } = require('esbuild')

const options = {
  entryPoints: ['./src/main.ts'],
  outfile: './dist/index.cjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  minify: true,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'import.meta.url': 'import_meta_url',
    '__VERSION__': JSON.stringify(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'))).version)
  },
  inject: [path.join(__dirname, 'import.meta.url-polyfill.cjs')],
}

build(options).catch(() => process.exit(1))
