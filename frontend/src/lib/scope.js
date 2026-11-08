// Thesis scope: the agent journey only. VITE_FULL_APP=1 restores the whole GymBuddy app.
export const FOCUS = import.meta.env?.VITE_FULL_APP !== '1'
export const HIDDEN_ROUTES = ['/gym-bot', '/checkin', '/muscles', '/structural-balance', '/progress-photos', '/measurements', '/coach/intake', '/coach/setup', '/admin']
export const hiddenRoute = path => FOCUS && HIDDEN_ROUTES.some(r => path === r || path.startsWith(r + '/'))
