import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { effectiveRoutineIds, effectiveRoutines } from '../../lib/history.js'
import { todayISO } from '../../lib/format.js'
import { startFlow } from '../../sheets.jsx'

export function useWorkoutStart() {
  const nav = useNavigate()
  return () => {
    const { S } = useStore.getState()
    if (!S.active && effectiveRoutines(S, todayISO()).some(r => r.ex.length)) {
      startFlow(effectiveRoutineIds(S, todayISO()))
      return
    }
    nav('/workout')
  }
}
