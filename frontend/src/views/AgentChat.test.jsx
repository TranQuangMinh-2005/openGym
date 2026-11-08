import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import AgentChat from './AgentChat.jsx'
import * as agent from '../lib/agent-api.js'

const mocks = vi.hoisted(() => ({ pullState: vi.fn(), thread: null }))
vi.mock('../store/useStore.js', () => {
  const snapshot = () => ({ user: { id: 'u' }, S: { coach: { ledger: [] } }, pullState: mocks.pullState })
  const useStore = selector => selector(snapshot())
  useStore.getState = snapshot
  return { useStore }
})
vi.mock('../components/GymMascot.jsx', () => ({ default: () => null, GYM_BOT_STATES: Object.fromEntries(['idle','searching','blocked','success','error'].map(state => [state, { status: state }])) }))
vi.mock('../lib/agent-api.js', () => ({
  savedThread: vi.fn(() => null),
  listDrafts: vi.fn(async () => []),
  sendMessage: vi.fn(async () => ({ threadId: 't' })),
  resume: vi.fn(async () => ({ threadId: 't' })),
  pollThread: vi.fn(async (id, options) => {
    options.onUpdate(mocks.thread)
    return mocks.thread
  })
}))
let root, container
beforeEach(() => {
  vi.clearAllMocks()
  const { window } = parseHTML('<html><body><div id="root"></div></body></html>')
  globalThis.window = window
  globalThis.document = window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.getElementById('root')
  root = createRoot(container)
  mocks.thread = { threadId: 't', status: 'done', messages: [{ role: 'assistant', text: 'Reply [kb-001] <img src=x onerror=alert(1)>' }] }
})
afterEach(async () => { await act(async () => root.unmount()) })
async function send(draft) {
  if (draft) mocks.thread = { ...mocks.thread, status: 'awaiting_approval', approval: { drafts: [draft] } }
  await act(async () => root.render(<AgentChat />))
  await act(async () => {
    const textarea = container.querySelector('textarea')
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(textarea), 'value')?.set
    if (setter) setter.call(textarea, 'Hello')
    else textarea.value = 'Hello'
    textarea.dispatchEvent(new window.Event('input', { bubbles: true }))
    textarea.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  // React's controlled change plugin depends on browser feature detection. Invoke the
  // mounted input handler to supply the same value in this lightweight DOM.
  await act(async () => {
    const textarea = container.querySelector('textarea')
    const key = Object.keys(textarea).find(key => key.startsWith('__reactProps'))
    textarea[key].onChange({ target: { value: 'Hello' } })
  })
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
}
async function click(label) {
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === label).click())
}
it('sends a message and renders reply, citations and HTML as text', async () => {
  await send()
  expect(agent.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello' }))
  expect(container.textContent).toContain('Reply')
  expect(container.querySelector('.agent-citation').textContent).toBe('[kb-001]')
  expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  expect(container.querySelector('img')).toBeNull()
})
it('shows routine and exercise lines and approves then pulls state', async () => {
  await send({ id: 'd', kind: 'plan_create', diff: { routines: [{ id: 'r', before: null, after: { name: 'Buổi A', ex: [{ id: 'unknown', sets: 3, reps: 8 }] } }] } })
  expect(container.textContent).toContain('New session')
  // An added exercise shows its dose alone, without a "– →" from nothing.
  const line = container.querySelector('.agent-added')
  expect([line.querySelector('.agent-ex-name').textContent, line.querySelector('.agent-ex-dose').textContent]).toEqual(['unknown', '3×8'])
  await click('Approve')
  expect(agent.resume).toHaveBeenCalledWith('t', [{ draftId: 'd', decision: 'approve' }])
  expect(mocks.pullState).toHaveBeenCalled()
})
it('submits only checked changes and disables approval when empty', async () => {
  await send({ id: 'd', kind: 'plan_edit', changes: ['a', 'b'].map(id => ({ id, type: 'update_exercise', target: { exId: id }, before: 3, after: 4, why: 'Tiến bộ' })) })
  const inputs = [...container.querySelectorAll('input')]
  const change = async input => act(async () => {
    const key = Object.keys(input).find(key => key.startsWith('__reactProps'))
    input[key].onChange({ target: { checked: false } })
  })
  await change(inputs[0])
  await click('Approve')
  expect(agent.resume).toHaveBeenCalledWith('t', [{ draftId: 'd', decision: 'approve', acceptedChangeIds: ['b'] }])
  await change(inputs[1])
  expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Approve').disabled).toBe(true)
})
it('rejects a draft and pulls state', async () => {
  await send({ id: 'd', kind: 'plan_create', diff: {} })
  await click('Reject')
  expect(agent.resume).toHaveBeenCalledWith('t', [{ draftId: 'd', decision: 'reject' }])
  expect(mocks.pullState).toHaveBeenCalled()
})
it('shows constraint summary and readable labels', async () => {
  await send({ id: 'd', kind: 'constraints', summary: 'Protect the shoulder', diff: [{ before: null, after: { type: 'avoid_region', value: 'shoulder', strength: 'hard', op: 'add' } }] })
  for (const label of ['Protect the shoulder', 'Protect area', 'shoulder', 'required', 'add']) expect(container.textContent).toContain(label)
})
it('shows the server-computed weekly sessions and sets per muscle', async () => {
  await send({ id: 'd', kind: 'plan_create', summary: 'PPL', diff: {}, facts: { trainingDaysPerWeek: 3, minutesByRoutine: { Push: 44 },
    byPrimaryMuscle: { pectorals: { sessionsPerWeek: 1, setsPerWeek: 9 }, delts: { sessionsPerWeek: 2, setsPerWeek: 9 } } } })
  const rows = [...container.querySelectorAll('.agent-volume li')].map(li => ['.agent-muscle', '.agent-sets', '.agent-freq'].map(c => li.querySelector(c).textContent))
  expect(container.querySelectorAll('.agent-track[aria-hidden="true"] .agent-bar')).toHaveLength(2)
  expect(rows).toEqual([['Chest', '9', '1×'], ['Shoulders', '9', '2×']])
  const stats = Object.fromEntries([...container.querySelectorAll('.agent-stats div')].map(d => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]))
  expect(stats).toEqual({ 'days / week': '3', 'min / session': '~44', 'sets / week': '18' })
})

it('suggestion sends immediately and send button is named', async () => {
  await act(async () => root.render(<AgentChat />))
  expect(container.querySelector('form button').getAttribute('aria-label')).toBeTruthy()
  await click('Build me a program')
  expect(agent.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: 'Build me a 3-day-a-week program for my gym' }))
})
it('Enter sends while Shift+Enter preserves a newline', async () => {
  await act(async () => root.render(<AgentChat />))
  const input = container.querySelector('textarea')
  const props = () => input[Object.keys(input).find(key => key.startsWith('__reactProps'))]
  await act(async () => props().onChange({ target: { value: 'Hello' } }))
  const preventDefault = vi.fn()
  await act(async () => props().onKeyDown({ key: 'Enter', shiftKey: true, preventDefault }))
  expect(preventDefault).not.toHaveBeenCalled()
  expect(agent.sendMessage).not.toHaveBeenCalled()
  await act(async () => props().onKeyDown({ key: 'Enter', shiftKey: false, preventDefault }))
  expect(preventDefault).toHaveBeenCalled()
  expect(agent.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello' }))
})
