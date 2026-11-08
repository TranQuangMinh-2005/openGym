import { it, expect, vi, afterEach } from 'vitest'
import { api } from './api.js'
import { pollThread } from './agent-api.js'
vi.mock('./api.js', () => ({ api: vi.fn() }))
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
it('stops on non-running status', async () => {
  vi.useFakeTimers()
  api.mockResolvedValueOnce({ status: 'running' }).mockResolvedValueOnce({ status: 'idle' })
  const onUpdate = vi.fn()
  const result = pollThread('a', { onUpdate })
  await vi.runAllTimersAsync()
  expect(await result).toEqual({ status: 'idle' })
  expect(onUpdate).toHaveBeenCalledTimes(2)
})
it('honours abort before fetching', async () => {
  const ctl = new AbortController()
  ctl.abort()
  await expect(pollThread('a', { signal: ctl.signal })).rejects.toHaveProperty('name', 'AbortError')
  expect(api).not.toHaveBeenCalled()
})
