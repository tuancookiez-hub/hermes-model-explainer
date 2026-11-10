#!/usr/bin/env node
// Validates data/models.json and embeds it into desktop/plugin.js as a JSON string
// (parsed with JSON.parse at load, so data can never run as code). Also copies the
// validator from validate-data.mjs, so both copies of the rules always match.
//
//   node scripts/embed-data.mjs           validate + write the embedded copies
//   node scripts/embed-data.mjs --check   validate + fail if an embedded copy is stale (CI)
//
// No dependencies, no network.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateData } from './validate-data.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const dataPath = path.join(root, 'data', 'models.json')
const pluginPath = path.join(root, 'desktop', 'plugin.js')
const check = process.argv.includes('--check')

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
const errors = validateData(data, { strict: true })
if (errors.length) {
  console.error(`data/models.json: ${errors.length} problem(s)\n - ${errors.join('\n - ')}`)
  process.exit(1)
}

const block = fs.readFileSync(path.join(here, 'validate-data.mjs'), 'utf8').match(/\/\/ VALIDATOR:BEGIN[\s\S]*\/\/ VALIDATOR:END/)
if (!block) {
  console.error('scripts/validate-data.mjs: VALIDATOR:BEGIN / VALIDATOR:END markers not found')
  process.exit(1)
}

const src = fs.readFileSync(pluginPath, 'utf8')
const dataRe = /(\/\/ DATA:BEGIN[^\n]*\n)const DATA_JSON = [^\n]*\n(\/\/ DATA:END)/
const validatorRe = /\/\/ VALIDATOR:BEGIN[\s\S]*\/\/ VALIDATOR:END/
if (!dataRe.test(src) || !validatorRe.test(src)) {
  console.error('desktop/plugin.js: DATA or VALIDATOR markers not found')
  process.exit(1)
}

const literal = JSON.stringify(JSON.stringify(data))
const next = src
  .replace(dataRe, (_, a, b) => `${a}const DATA_JSON = ${literal}\n${b}`)
  .replace(validatorRe, () => block[0].replace(/^export function/gm, 'function'))

const counts = `${data.models.length} models, ${Object.keys(data.sources).length} sources`
if (check) {
  if (next !== src) {
    console.error('desktop/plugin.js embeds a stale copy of the data or validator. Run: node scripts/embed-data.mjs')
    process.exit(1)
  }
  console.log(`ok: ${counts}, embedded copies current`)
} else {
  fs.writeFileSync(pluginPath, next)
  console.log(`embedded ${counts} into desktop/plugin.js`)
}
