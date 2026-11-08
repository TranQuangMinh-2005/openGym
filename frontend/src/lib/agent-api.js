import { api } from './api.js'

const base = '/api/coach/agent/'
const post = (path, body) => api(base + path, { method: 'POST', body: JSON.stringify(body) })
export const sendMessage = ({ threadId, text, lang }) => post('messages', { threadId, text, lang })
export const getThread = id => api(base + 'thread?id=' + encodeURIComponent(id))
export const resume = (threadId, decisions) => post('resume', { threadId, decisions })
export const cancel = threadId => post('cancel', { threadId })
export const listDrafts = () => api(base + 'drafts')
export function savedThread(uid, id) {
  try {
    if (!uid) return null
    const key = 'gymbuddy_agent_thread_' + uid
    if (id !== undefined) localStorage.setItem(key, id)
    return localStorage.getItem(key)
  } catch { return null }
}
const aborted = () => new DOMException('Aborted', 'AbortError')
export async function pollThread(id, { onUpdate, signal, intervalMs = 1500 } = {}) {
  const start = Date.now()
  while (true) {
    if (signal?.aborted) throw aborted()
    const thread = await getThread(id)
    if (signal?.aborted) throw aborted()
    onUpdate?.(thread)
    if (thread.status !== 'running') return thread
    await new Promise((resolve, reject) => {
      const cleanup = () => signal?.removeEventListener('abort', abort)
      const timer = setTimeout(() => { cleanup(); resolve() }, Date.now() - start >= 30000 ? 5000 : intervalMs)
      const abort = () => { clearTimeout(timer); cleanup(); reject(aborted()) }
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) abort()
    })
  }
}
