import { APP_NAME } from '../../lib/brand.js'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { navigation, secondaryNavigation, activePath } from './navigation.js'
import { useWorkoutStart } from './useWorkoutStart.js'
import { useMediaQuery } from './useMediaQuery.js'
import ThemeToggle from './ThemeToggle.jsx'
import Icon from '../Icon.jsx'
import Elapsed from '../Elapsed.jsx'
import GymMascot from '../GymMascot.jsx'
import BuddyRail from '../buddy/BuddyRail.jsx'

export default function AppShell({ children, enabled = true }) {
  const loc = useLocation()
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const active = useStore(s => s.S.active)
  const sync = useStore(s => s.sync)
  const [buddyOpen, setBuddyOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('gym_sidebar_collapsed') === '1' } catch { return false } })
  const start = useWorkoutStart()
  const root = useRef(null)
  const launcher = useRef(null)
  const activeRoute = activePath(loc.pathname)
  const focus = loc.pathname === '/workout' && !!active
  const wide = useMediaQuery('(min-width:1280px)')
  const items = [...navigation(), ...secondaryNavigation()]
  const title = items.find(x => x.path === activeRoute)?.label || t('Workout')
  const toggleSidebar = () => setCollapsed(v => { try { localStorage.setItem('gym_sidebar_collapsed', v ? '0' : '1') } catch {} return !v })
  useEffect(() => { setBuddyOpen(false) }, [loc.pathname])
  useEffect(() => {
    const media = window.matchMedia('(min-width:1280px)')
    const resize = () => { if (media.matches) setBuddyOpen(false) }
    media.addEventListener('change', resize)
    return () => media.removeEventListener('change', resize)
  }, [])
  const closeBuddy = () => { setBuddyOpen(false); requestAnimationFrame(() => launcher.current?.focus()) }
  // The mobile assistant is an overlay; the permanent desktop rail is not a modal.
  useEffect(() => {
    if (!buddyOpen) return
    const rail = root.current?.querySelector('.buddy-slot')
    const previous = document.activeElement
    const background = [...root.current.querySelectorAll('.workspace-sidebar, .workspace-topbar, .workspace-main, .workspace-mobile-buddy, .active-session-bar'), document.getElementById('tabbar')].filter(Boolean)
    const before = background.map(el => el.inert)
    background.forEach(el => { el.inert = true })
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    rail?.querySelector('button')?.focus()
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); closeBuddy() }
      if (e.key !== 'Tab') return
      const nodes = [...(rail?.querySelectorAll('button, a[href], [tabindex="0"]') || [])].filter(e => !e.disabled && e.getClientRects().length)
      const first = nodes[0], last = nodes.at(-1)
      if (!first) { e.preventDefault(); return }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      background.forEach((el, i) => { el.inert = before[i] })
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus()
    }
  }, [buddyOpen])
  useGSAP(() => {
    if (!buddyOpen) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => gsap.fromTo('.buddy-slot', { x: 20, opacity: 0 }, { x: 0, opacity: 1, duration: .24, clearProps: 'transform,opacity', ease: 'power2.out' }))
    return () => mm.revert()
  }, { scope: root, dependencies: [buddyOpen], revertOnUpdate: true })
  useEffect(() => {
    // Buddy never competes with a real modal for focus.
    return useUI.subscribe((state, previous) => { if (state.sheets.length && !previous.sheets.length) setBuddyOpen(false) })
  }, [])

  const links = list => list.map(item => <Link key={item.path} to={item.path} className={'workspace-nav-link' + (activeRoute === item.path ? ' active' : '')} aria-current={activeRoute === item.path ? 'page' : undefined} title={item.label}>
    <Icon name={item.icon} /><span>{item.label}</span>{activeRoute === item.path && <i />}
  </Link>)
  if (!enabled) return children
  return <div ref={root} className={'workspace-shell' + (collapsed ? ' sidebar-collapsed' : '') + (focus ? ' workout-focus' : '') + (buddyOpen ? ' buddy-is-open' : '')} data-page={loc.pathname.split('/')[1] || 'home'}>
    <a href="#workspace-main" className="skip-link">{t('Skip to content')}</a>
    <aside className="workspace-sidebar" aria-label={t('Main navigation')}>
      <Link to="/home" className="workspace-brand"><Icon name="dumbbell" /><span>{APP_NAME}<small>{t('YOUR TRAINING SPACE')}</small></span></Link>
      <div className="workspace-nav-caption">{t('WORKSPACE')}</div>
      <nav>{links(navigation())}</nav>
      <button className="workspace-start" onClick={start} title={active ? t('Resume') : t('Start workout')}><Icon name="play" /><span>{active ? t('Resume workout') : t('Start workout')}</span></button>
      <div className="workspace-sidebar-bottom">
        <div className="workspace-sidebar-buddy"><GymMascot size={76} animate={false} /><div><strong>GymBuddy</strong><span>{t('Here for your next step.')}</span></div></div>
        <nav>{links(secondaryNavigation())}</nav>
        <button className="workspace-collapse" onClick={toggleSidebar} aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')} aria-expanded={!collapsed}><Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} /><span>{t('Collapse sidebar')}</span></button>
        <div className="workspace-profile"><span>{(user?.name || 'G').slice(0, 1).toUpperCase()}</span><div><strong>{user?.name || t('Guest')}</strong><small>{t('Personal workspace')}</small></div></div>
      </div>
    </aside>
    <div className="workspace-mobile-buddy"><button aria-label={t('Open GymBuddy')} aria-expanded={buddyOpen} onClick={() => setBuddyOpen(v => !v)}><GymMascot size={60} animate={false} /></button></div>
    <div className="workspace-stage">
      <header className="workspace-topbar"><div><span className="workspace-topbrand">{APP_NAME}</span><span className="workspace-breadcrumb">/</span><strong>{title}</strong></div>
        <div className="workspace-top-actions"><span className={'workspace-sync' + (sync?.pending || sync?.lastError || sync?.offline || sync?.held || sync?.auth ? ' attention' : '')}><span />{sync?.offline ? t('Offline') : sync?.lastError || sync?.held || sync?.auth ? t('Sync needs a look') : sync?.pending ? t('Saving…') : user ? t('Saved on your server') : t('Saved on this device')}</span>
          <ThemeToggle />
          <button ref={launcher} className="workspace-buddy-toggle" aria-expanded={buddyOpen} aria-label={t('Open GymBuddy')} onClick={() => setBuddyOpen(v => !v)}><GymMascot size={38} animate={false} /><span>GymBuddy</span></button>
        </div>
      </header>
      <div className="workspace-columns"><div id="workspace-main" className="workspace-main" tabIndex={-1}>{children}</div>
        {buddyOpen && <button className="buddy-scrim" aria-label={t('Close assistant')} onClick={closeBuddy} />}
        <div className="buddy-slot" {...(buddyOpen ? { role: 'dialog', 'aria-modal': true, 'aria-label': t('GymBuddy assistant') } : {})}><BuddyRail pathname={loc.pathname} onClose={closeBuddy} shown={!focus && (wide || buddyOpen)} /></div>
      </div>
      {active && !focus && <div className="active-session-bar"><span className="session-running-dot" /><div><strong>{active.name}</strong><span>{active.editingWorkoutId ? t('Editing a saved workout') : <Elapsed start={active.start} />}</span></div><button className="btn primary" onClick={() => nav('/workout')}><Icon name="play" />{active.editingWorkoutId ? t('Continue editing') : t('Resume')}</button></div>}
    </div>
  </div>
}
