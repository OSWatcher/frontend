// Test the served container, including failures hidden by SPA fallback HTTP 200s.
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const base = process.argv[2] || 'http://127.0.0.1:8080'
const expectedApi = 'http://localhost:4000/'
let html
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await fetch(base, { signal: AbortSignal.timeout(2000) })
    assert.equal(response.status, 200)
    html = await response.text()
    break
  } catch (error) {
    if (attempt === 29) throw error
    await delay(500)
  }
}

const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match => match[1])
assert(assets.some(path => path.endsWith('.js')), 'Page must load JavaScript')
assert(assets.some(path => path.endsWith('.css')), 'Page must load CSS')
let configuredApi = false
for (const path of assets) {
  assert(path.startsWith('/assets/'), `Asset must load from the root: ${path}`)
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10000) })
  assert.equal(response.status, 200, `Asset status: ${path}`)
  const type = response.headers.get('content-type') || ''
  assert(type.includes(path.endsWith('.js') ? 'javascript' : 'text/css'),
    `Asset returned ${type}, possibly the SPA HTML fallback: ${path}`)
  const content = await response.text()
  assert(!content.includes('__OSW_API_URI__'), `Unresolved API placeholder: ${path}`)
  configuredApi ||= content.includes(expectedApi)
}
assert(configuredApi, 'Runtime API URL must appear in the served bundle')

// Vue Router uses history mode; direct navigation must also serve the app.
const route = await fetch(new URL('/inspect/smoke-test', base), { signal: AbortSignal.timeout(10000) })
assert.equal(route.status, 200)
assert.equal(await route.text(), html, 'Deep links must serve the same app shell')
console.log(`PASS: ${assets.length} JS/CSS assets, runtime API URL, and history-route fallback`)
