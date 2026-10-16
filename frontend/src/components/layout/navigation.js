import { t } from '../../lib/i18n.js'

// One route map for the workspace, breadcrumbs and responsive navigation.
export const navigation = () => [
  { path: '/home', label: t('Overview'), icon: 'house', mobile: t('Home') },
  { path: '/plan', label: t('Program'), icon: 'calendar', mobile: t('Plan') },
  { path: '/history', label: t('Training log'), icon: 'history' },
  { path: '/library', label: t('Exercise library'), icon: 'dumbbell', mobile: t('Exercises') },
  { path: '/stats', label: t('Progress'), icon: 'chart', mobile: t('Stats') },
  { path: '/coach', label: 'GymBuddy', icon: 'sparkles' },
]
export const secondaryNavigation = () => [
  { path: '/measurements', label: t('Body measurements'), icon: 'scale' },
  { path: '/settings', label: t('Settings'), icon: 'gear' },
]
export function activePath(pathname) {
  if (pathname.startsWith('/plan')) return '/plan'
  if (['/muscles', '/library'].includes(pathname)) return '/library'
  if (['/structural-balance', '/progress-photos', '/stats'].includes(pathname)) return '/stats'
  if (pathname.startsWith('/coach')) return '/coach'
  if (pathname.startsWith('/settings') || pathname === '/admin') return '/settings'
  return pathname
}
