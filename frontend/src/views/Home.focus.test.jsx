// @vitest-environment happy-dom
// Thesis scope (lib/scope.js): the gym check-in card is out of scope, so Home must not offer it.
import React, { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import Home from './Home.jsx'

vi.mock('../lib/scope.js', () => ({ FOCUS: true }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '',
}))

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

it('has no gym check-in card in focus mode', () => {
  useStore.setState(s => ({ S: { ...s.S, routines: [], workouts: [], bodyweight: [], dayPlan: {}, week: {}, active: null, checkIn: true }, user: null }))
  act(() => root.render(<Home />))
  expect(host.querySelector('.home-checkin')).toBeNull()
  expect(host.textContent).not.toContain('Check in')
})
