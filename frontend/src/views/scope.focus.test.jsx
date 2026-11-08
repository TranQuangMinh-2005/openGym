import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CoachEntry from './CoachEntry.jsx'
vi.mock('../store/useStore.js', () => ({ useStore: fn => fn({ config: { agent: { enabled: false } }, user: null }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('./AgentChat.jsx', () => ({ default: () => <div>Agent screen</div> }))
vi.mock('./CoachChat.jsx', () => ({ default: () => <div>Legacy screen</div> }))
vi.mock('../components/GymMascot.jsx', () => ({ default: () => null }))
import { describe, it, expect, vi } from 'vitest'
vi.mock('../lib/scope.js', () => ({ FOCUS: true }))
import { secondaryNavigation } from '../components/layout/navigation.js'
import { pageVisible, searchSettings } from './settings-pages.js'
describe('thesis scope', () => {
  it('keeps the existing suite in full app mode', () => {
    expect(import.meta.env.VITE_FULL_APP).toBe('1')
  })
  it('omits measurements navigation', () => {
    expect(secondaryNavigation().some(r => r.path === '/measurements')).toBe(false)
  })
  it('hides out of scope settings and their search results', () => {
    for (const page of ['reminders', 'coach', 'data']) expect(pageVisible(page, {})).toBe(false)
    expect(searchSettings('backup', {}).some(r => r.page === 'data')).toBe(false)
  })
})

it('explains how to enable the agent without legacy chat', () => {
 const html = renderToStaticMarkup(<CoachEntry />)
 expect(html).toContain('The Coach agent is off. Start the API with AGENT_ENABLED=1.')
 expect(html).not.toContain('Legacy screen')
})
