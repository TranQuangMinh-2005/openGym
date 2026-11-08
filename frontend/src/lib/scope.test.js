// The thesis-scope flag itself: on by default, off with VITE_FULL_APP=1 (which the test config sets,
// so the rest of the suite keeps testing the whole app).
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

it('is on by default and hides every out-of-scope route and its sub-paths', async () => {
  vi.stubEnv('VITE_FULL_APP', '')
  vi.resetModules()
  const { FOCUS, hiddenRoute } = await import('./scope.js')
  expect(FOCUS).toBe(true)
  for (const path of ['/admin', '/measurements', '/coach/setup', '/coach/intake', '/muscles', '/checkin']) expect(hiddenRoute(path)).toBe(true)
  for (const path of ['/coach', '/plan', '/history', '/library', '/stats', '/home', '/settings']) expect(hiddenRoute(path)).toBe(false)
})

it('restores the whole app with VITE_FULL_APP=1', async () => {
  vi.stubEnv('VITE_FULL_APP', '1')
  vi.resetModules()
  const { FOCUS, hiddenRoute } = await import('./scope.js')
  expect(FOCUS).toBe(false)
  expect(hiddenRoute('/admin')).toBe(false)
})
