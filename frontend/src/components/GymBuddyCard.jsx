import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { coachAvailable } from '../lib/coach.js'
import { MOBILE } from '../lib/mobile.js'
import { DEMO } from '../lib/demo.js'
import GymMascot from './GymMascot.jsx'
import Icon from './Icon.jsx'
import './GymBuddyCard.css'
import { useMediaQuery } from './layout/useMediaQuery.js'

export default function GymBuddyCard({ active = false, done = false }) {
  const nav = useNavigate()
  const desktop = useMediaQuery('(min-width:768px)')
  const config = useStore(s => s.config)
  const user = useStore(s => s.user)
  const coachLocal = useStore(s => s.coachLocal)
  const available = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode: coachLocal?.mode })
  const state = active ? 'training' : done ? 'success' : 'idle'
  const message = active ? 'Tập theo nhịp của bạn, từng hiệp một.'
    : done ? 'Làm tốt lắm! Một buổi tập nữa đã được ghi lại.'
    : 'Thêm một hiệp. Tiến bộ mỗi ngày.'

  return <section className="card gym-buddy-card" aria-labelledby="gym-buddy-title">
    <div className="gym-buddy-avatar"><GymMascot state={state} size={112} animate={!active && !desktop} /></div>
    <div className="gym-buddy-content">
      <h2 id="gym-buddy-title">GymBuddy <span>Người bạn tập của bạn</span></h2>
      <p>{message}</p>
      <div className="gym-buddy-actions">
        <button className="gym-buddy-action" onClick={() => nav(available ? '/coach' : '/plan')}>
          {available ? 'Trò chuyện với Buddy' : 'Mở lịch tập'}<Icon name="chevronRight" />
        </button>
        {!available && user?.admin && <button className="gym-buddy-connect" onClick={() => nav('/admin')}>Kết nối AI</button>}
      </div>
      {!available && <div className="gym-buddy-status">AI chưa được kết nối</div>}
    </div>
  </section>
}
