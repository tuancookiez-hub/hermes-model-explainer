// The data rules, in one place. CI runs them through embed-data.mjs, and embed-data.mjs
// copies everything between the markers into desktop/plugin.js, which applies the same
// rules to a file fetched at runtime. Edit here, then run: node scripts/embed-data.mjs
//
// VALIDATOR:BEGIN — generated from scripts/validate-data.mjs. Do not edit by hand.
export function normalizeModelId(raw) {
  let s = String(raw ?? '').toLowerCase().trim()
  s = s.replace(/\[[^\]]*\]$/, '')
  s = s.replace(/:(free|[a-z]{2})$/, '')
  if (s.includes(':')) s = s.slice(s.lastIndexOf(':') + 1)
  if (s.includes('/')) s = s.slice(s.lastIndexOf('/') + 1)
  s = s.replace(/[._\s]+/g, '-')
  s = s.replace(/-free$/, '')
  return s
}

/**
 * Returns a list of problems; empty means the file is usable. `strict` is for the
 * repository: it also refuses fields and abilities this version does not know, which an
 * older installed copy must tolerate when it reads a newer file.
 */
export function validateData(data, { strict = false } = {}) {
  const errors = []
  const fail = msg => errors.push(msg)
  const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const isText = (v, max = 400) => typeof v === 'string' && v.length > 0 && v.length <= max
  const isObject = v => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

  if (!isObject(data)) return ['the file must be a JSON object']
  if (data.schema_version !== 1) fail('schema_version must be 1')
  if (!isDate(data.updated)) fail('updated must be YYYY-MM-DD')
  if (!isObject(data.sources)) return [...errors, 'sources must be an object']
  if (!Array.isArray(data.models) || data.models.length === 0) return [...errors, 'models must be a non-empty list']
  if (data.models.length > 2000) return [...errors, 'models: more than 2000 entries']

  const sources = data.sources
  for (const [id, s] of Object.entries(sources)) {
    if (!/^[a-z0-9-]+$/.test(id)) fail(`source id "${id}" must be lowercase kebab-case`)
    if (!isObject(s)) {
      fail(`source ${id}: must be an object`)
      continue
    }
    if (!isText(s.title)) fail(`source ${id}: title required`)
    if (!isDate(s.retrieved)) fail(`source ${id}: retrieved must be YYYY-MM-DD`)
    if (s.url !== null && !(isText(s.url, 2000) && /^https:\/\//.test(s.url))) fail(`source ${id}: url must be https:// (or null for maintainer notes)`)
    if (s.url === null && id !== 'editorial') fail(`source ${id}: only "editorial" may have a null url`)
    for (const k of ['license', 'note']) if (s[k] !== undefined && !isText(s[k], 2000)) fail(`source ${id}: ${k} must be text`)
  }

  const NUMERIC = ['hermes_index', 'cost_per_task_usd', 'context_tokens', 'max_input_tokens', 'max_output_tokens', 'price_input_per_mtok', 'price_output_per_mtok']
  const KNOWN = new Set(['id', 'name', 'vendor', 'aliases', 'summary', 'hermes_index_suites', 'abilities', 'reasoning_curve', ...NUMERIC])
  const ABILITIES = new Set(['reasoning', 'tools', 'vision', 'pdf', 'audio', 'video'])
  const keys = new Map()

  const checkField = (where, f) => {
    if (!isObject(f) || !('v' in f)) return fail(`${where}: must be { v, src }`)
    if (typeof f.src !== 'string' || !Object.hasOwn(sources, f.src)) fail(`${where}: unknown source "${f.src}"`)
    if (f.date !== undefined && !isDate(f.date)) fail(`${where}: date must be YYYY-MM-DD`)
    if (f.note !== undefined && !isText(f.note)) fail(`${where}: note must be text`)
  }

  for (const [i, m] of data.models.entries()) {
    const at = `models[${i}] ${m?.id ?? '?'}`
    if (!isObject(m)) {
      fail(`${at}: must be an object`)
      continue
    }
    if (!isText(m.id) || normalizeModelId(m.id) !== m.id) fail(`${at}: id must already be normalized (got "${m.id}", expected "${normalizeModelId(m.id)}")`)
    if (!isText(m.name)) fail(`${at}: name required`)
    if (m.vendor !== undefined && !isText(m.vendor)) fail(`${at}: vendor must be text`)
    if (m.aliases !== undefined && !(Array.isArray(m.aliases) && m.aliases.every(a => isText(a)))) fail(`${at}: aliases must be a list of text`)
    if (strict) for (const k of Object.keys(m)) if (!KNOWN.has(k)) fail(`${at}: unknown field "${k}"`)
    for (const key of [m.id, ...(Array.isArray(m.aliases) ? m.aliases : [])]) {
      const k = normalizeModelId(key)
      if (keys.has(k) && keys.get(k) !== m.id) fail(`${at}: "${key}" collides with ${keys.get(k)}`)
      keys.set(k, m.id)
    }
    if (m.summary !== undefined) {
      checkField(`${at}.summary`, m.summary)
      if (!isText(m.summary?.v, 160)) fail(`${at}.summary: one line, at most 160 chars`)
    }
    for (const k of NUMERIC) {
      if (m[k] === undefined) continue
      checkField(`${at}.${k}`, m[k])
      const v = m[k]?.v
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) fail(`${at}.${k}: v must be a non-negative number`)
    }
    if (typeof m.hermes_index?.v === 'number' && m.hermes_index.v > 100) fail(`${at}.hermes_index: 0-100`)
    if (m.hermes_index_suites !== undefined) {
      checkField(`${at}.hermes_index_suites`, m.hermes_index_suites)
      const suites = m.hermes_index_suites?.v
      if (!isObject(suites)) fail(`${at}.hermes_index_suites: v must be an object`)
      else for (const [k, v] of Object.entries(suites)) if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) fail(`${at}.hermes_index_suites.${k}: 0-100`)
    }
    if (m.abilities !== undefined) {
      checkField(`${at}.abilities`, m.abilities)
      const list = m.abilities?.v
      if (!Array.isArray(list) || !list.every(a => isText(a, 40))) fail(`${at}.abilities: v must be a list of text`)
      else if (strict) for (const a of list) if (!ABILITIES.has(a)) fail(`${at}.abilities: unknown "${a}"`)
    }
    if (m.reasoning_curve !== undefined) {
      const c = m.reasoning_curve
      if (!isObject(c)) {
        fail(`${at}.reasoning_curve: must be an object`)
        continue
      }
      if (typeof c.src !== 'string' || !Object.hasOwn(sources, c.src)) fail(`${at}.reasoning_curve: unknown source "${c.src}"`)
      if (!isText(c.metric)) fail(`${at}.reasoning_curve: metric required`)
      if (!Array.isArray(c.points) || c.points.length < 2) fail(`${at}.reasoning_curve: at least 2 points`)
      else for (const p of c.points) if (!isText(p?.effort, 40) || typeof p?.v !== 'number' || !Number.isFinite(p.v)) fail(`${at}.reasoning_curve: points are { effort, v }`)
    }
  }
  return errors
}
// VALIDATOR:END
