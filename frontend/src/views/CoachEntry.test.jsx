import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { it, expect, vi } from 'vitest'
import CoachEntry from './CoachEntry.jsx'
const state = vi.hoisted(() => ({ config: { agent: { enabled: true } }, user: null }))
vi.mock('../store/useStore.js', () => ({ useStore: fn => fn(state) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('./AgentChat.jsx', () => ({ default: () => <div>Agent screen</div> }))
vi.mock('./CoachChat.jsx', () => ({ default: () => <div>Legacy screen</div> }))
vi.mock('../components/GymMascot.jsx', () => ({ default: () => null }))
it('only advertises agent when enabled', () => {
  expect(renderToStaticMarkup(<CoachEntry />)).toContain('Agent screen')
  state.config.agent.enabled = false
  expect(renderToStaticMarkup(<CoachEntry />)).not.toContain('Agent screen')
})
// Opening /#/coach directly renders before /api/config has loaded: config is still null.
it('renders while config is not loaded yet', () => {
  state.config = null
  expect(() => renderToStaticMarkup(<CoachEntry />)).not.toThrow()
})
