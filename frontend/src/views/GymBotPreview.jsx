import { APP_NAME } from '../lib/brand.js'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import GymMascot, { GYM_BOT_STATES } from '../components/GymMascot.jsx'
import Icon from '../components/Icon.jsx'
import './GymBotPreview.css'

const STATES = [
  ['idle', 'Sẵn sàng', 'heart'],
  ['searching', 'Lên lịch', 'calendar'],
  ['training', 'Tập luyện', 'dumbbell'],
  ['success', 'Hoàn thành', 'trophy'],
  ['blocked', 'Cần hỏi thêm', 'shield'],
  ['error', 'Mất kết nối', 'cloud'],
]

export default function GymBotPreview() {
  const [state, setState] = useState('idle')
  const [animate, setAnimate] = useState(true)
  const [replay, setReplay] = useState(0)
  const root = useRef(null)
  const current = GYM_BOT_STATES[state]
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.buddy-reveal', { opacity: 0, y: 12, duration: 0.4, stagger: 0.06, ease: 'power2.out' })
    })
    return () => mm.revert()
  }, { scope: root })

  return <main ref={root} className="buddy-page">
    <header className="buddy-nav buddy-reveal">
      <Link className="buddy-brand" to="/home"><span><Icon name="dumbbell" /></span>{APP_NAME}<span className="buddy-brand-divider" />MASCOT</Link>
      <Link className="buddy-back" to="/home">Về ứng dụng <Icon name="chevronRight" /></Link>
    </header>
    <section className="buddy-hero">
      <div className="buddy-copy buddy-reveal">
        <div className="buddy-eyebrow"><span /> NGƯỜI BẠN TẬP CỦA BẠN</div>
        <h1>Thêm một hiệp.<br /><em>Tiến bộ mỗi ngày.</em></h1>
        <p>Một người bạn nhỏ cho hành trình dài. Cùng bạn lên lịch, hiểu bài tập và ghi nhận từng tiến bộ.</p>
        <div className="buddy-actions">
          <button className="buddy-primary" onClick={() => { setState(state === 'training' ? 'success' : 'training'); setReplay(v => v + 1) }}>
            <Icon name={state === 'training' ? 'check' : 'play'} />{state === 'training' ? 'Hoàn thành hiệp' : 'Tập cùng Buddy'}
          </button>
          <button className="buddy-pause" aria-pressed={!animate} onClick={() => setAnimate(v => !v)}>
            <Icon name={animate ? 'pause' : 'play'} />{animate ? 'Tạm dừng chuyển động' : 'Bật chuyển động'}
          </button>
        </div>
        <div className="buddy-caption"><Icon name="heart" /> Tiến bộ theo nhịp của bạn.</div>
      </div>
      <div className="buddy-stage buddy-reveal" data-state={state}>
        <div className="buddy-stage-heading"><span>GẶP GYM BUDDY</span><span className="buddy-live">Bản xem thử</span></div>
        <div className="buddy-orbit" aria-hidden="true" />
        <div className="buddy-figure"><GymMascot state={state} size={400} animate={animate} celebrateKey={replay} /></div>
        <div className="buddy-speech" role="status" aria-live="polite"><span>{current.status}</span><p>{current.text}</p></div>
        <span className="buddy-stage-note">BẠN TẬP NHỎ. ĐỘNG LỰC LỚN.</span>
      </div>
    </section>
    <section className="buddy-controls buddy-reveal" aria-labelledby="buddy-controls-title">
      <div className="buddy-controls-title"><h2 id="buddy-controls-title">Một Buddy, nhiều cảm xúc.</h2><p>Chọn trạng thái để xem Buddy phản hồi.</p></div>
      <div className="buddy-state-list" role="group" aria-label="Trạng thái của GymBuddy">
        {STATES.map(([value, label, icon]) => <button key={value} aria-pressed={state === value} onClick={() => { setState(value); setReplay(v => v + 1) }}>
          <Icon name={icon} /><span>{label}</span>
        </button>)}
      </div>
    </section>
    <footer className="buddy-footer"><span>Được tạo cho hành trình tập luyện của bạn.</span><span>{APP_NAME} <Icon name="dumbbell" /></span></footer>
  </main>
}
