// Adapted from RedLine HomeMatchMascot (original: HomeMatch P-187).
// Gym silhouette, equipment and copy belong to this openGym adaptation.
import { useId, useRef } from 'react'
import './GymMascot.css'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

export const GYM_BOT_STATES = {
  idle: { status: 'Sẵn sàng', text: 'Hôm nay mình tập gì nào?', border: '#b9e849', badge: '#435c16' },
  searching: { status: 'Đang lên kế hoạch', text: 'Để mình xem mục tiêu và lịch tập của bạn nhé.', border: '#f5bf56', badge: '#805a16' },
  training: { status: 'Cùng tập nào', text: 'Từng hiệp một. Bạn làm được!', border: '#b9e849', badge: '#435c16' },
  success: { status: 'Hoàn thành', text: 'Thêm một buổi tập được ghi lại. Làm tốt lắm!', border: '#77d8a7', badge: '#166b47' },
  blocked: { status: 'Chậm lại một chút', text: 'Mình cần thêm thông tin trước khi đề xuất nhé.', border: '#f5bf56', badge: '#805a16' },
  error: { status: 'Thử lại nhé', text: 'Kết nối đang gián đoạn. Mình thử lại nhé?', border: '#f69b89', badge: '#9f4937' },
}
const STATE_TEXT = GYM_BOT_STATES

/** Màu orb/badge/visor theo state — set tĩnh (không tween), đúng luật transform/opacity. */
const STATE_ACCENT = {
  training: { orb: '#b9e849', badge: '#526b24', visor: '#b9e849' },
  idle: { orb: '#b9e849', badge: '#526b24', visor: '#b9e849' },
  searching: { orb: '#f59e0b', badge: '#526b24', visor: '#b9e849' },
  success: { orb: '#69cf96', badge: '#69cf96', visor: '#b9e849' },
  blocked: { orb: '#ef4444', badge: '#B91C1C', visor: '#ef4444' },
  error: { orb: '#B45309', badge: '#B45309', visor: '#f59e0b' },
}

export default function GymMascot({ state = 'idle', size = 110, speech = null, celebrateKey = 0, speechHeader = true, animate = true }) {
  const rootRef = useRef(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  useGSAP(() => {
    const root = rootRef.current
    if (!root || typeof window.matchMedia !== 'function' || typeof window.getComputedStyle !== 'function') return undefined
    // A static SVG remains usable in renderers without the native SVG transform API.
    if (typeof root.querySelector('g')?.transform?.baseVal?.consolidate !== 'function') return undefined
    const select = gsap.utils.selector(root)
    const q = selector => select(selector.replace(/#([a-zA-Z][\w-]*)/g, (_, id) => '#' + uid + id))

    // ===== Lớp "gương mặt": chỉ set opacity (không tween) để lớp CSS .gym-look crossfade =====
    const applyLook = (st) => {
      const show = (sel, on) => gsap.set(q(sel), { opacity: on ? 1 : 0 })
      show('#sonarWaveGroup', st === 'searching')
      show('#eyesNeutral', st === 'idle')
      show('#mouthNeutral', st === 'idle')
      show('#eyesCuteConfused', st === 'searching')
      show('#mouthCuteConfused', st === 'searching')
      show('#eyesHappy', st === 'success')
      show('#mouthHappy', st === 'success')
      show('#eyesWorried', st === 'blocked')
      show('#mouthWorried', st === 'blocked')
      show('#alertMark', st === 'blocked')
      show('#eyesSad', st === 'error')
      show('#mouthSad', st === 'error')
      show('#sadTear', st === 'error')
      show('#cuteQuestionBubble', st === 'searching')
      show('#successSparkles', st === 'success')
      // Đổi màu là thay trạng thái tĩnh — dùng set (không tween) đúng luật transform/opacity.
      gsap.set(q('#cuteBlush'), { opacity: st === 'success' ? 0.6 : st === 'searching' ? 1 : 0 })
      const accent = STATE_ACCENT[st] || STATE_ACCENT.idle
      gsap.set(q('#antennaOrb'), { fill: accent.orb })
      gsap.set(q('#chestBadge'), { fill: accent.badge })
      gsap.set(q('#mascotVisor'), { stroke: accent.visor })
      // Tư thế trung tính trước khi state mới chạy (context cũ đã revert ở cùng frame).
      gsap.set(q('#mascotBodyGroup'), { rotation: 0, y: 0, scale: 1, transformOrigin: '50% 100%' })
      gsap.set([q('#handLeft'), q('#handRight')], { x: 0, y: 0, rotation: 0 })
    }

    // ===== Nền tảng dùng chung: bồng bềnh + bóng tiếp đất =====
    const baseFloat = () => {
      gsap.to(q('#mascotBodyGroup'), { y: -9, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 100%' })
      gsap.to(q('#mascotShadow'), { scaleX: 0.82, opacity: 0.12, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: 'center center' })
    }

    const idleState = () => {
      applyLook('idle')
      baseFloat()
      // Hít thở: scale 1 ↔ 1.02, mỗi chiều 1.5s → chu kỳ 3s
      gsap.to(q('#mascotBodyGroup'), { scale: 1.02, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 100%' })
      // Chớp mắt ngẫu nhiên — timeline nằm trong context nên tự chết khi đổi state
      const blink = gsap.timeline({ repeat: -1, repeatDelay: 2.6, onRepeat() { this.repeatDelay(gsap.utils.random(2.4, 4.8)) } })
      blink
        .to(q('#eyesNeutral .bot-eye'), { scaleY: 0.12, duration: 0.08, ease: 'power2.in', transformOrigin: 'center center' })
        .to(q('#eyesNeutral .bot-eye'), { scaleY: 1, duration: 0.1, ease: 'power2.out', transformOrigin: 'center center' })
    }

    const searchingState = () => {
      applyLook('searching')
      baseFloat()
      // Pulse nhịp tìm kiếm (chậm hơn breathe)
      gsap.to(q('#mascotBodyGroup'), { scale: 1.02, duration: 0.85, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 100%' })
      // Sonar quét bằng scale + opacity (không animate thuộc tính r)
      gsap.set(q('#sonarRing1'), { transformOrigin: '140px 150px' })
      gsap.set(q('#sonarRing2'), { transformOrigin: '140px 150px' })
      gsap.set(q('#sonarRing3'), { transformOrigin: '140px 150px' })
      gsap.timeline({ repeat: -1 })
        .fromTo(q('#sonarRing1'), { scale: 1, opacity: 0.65 }, { scale: 3.25, opacity: 0, duration: 2.4, ease: 'power1.out' }, 0)
        .fromTo(q('#sonarRing2'), { scale: 1, opacity: 0.5 }, { scale: 2.9, opacity: 0, duration: 2.4, ease: 'power1.out' }, 0.7)
        .fromTo(q('#sonarRing3'), { scale: 1, opacity: 0.4 }, { scale: 2.5, opacity: 0, duration: 2.4, ease: 'power1.out' }, 1.4)
      // Đầu nghiêng qua lại
      gsap.fromTo(q('#mascotBodyGroup'), { rotation: -8 }, { rotation: 8, duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 100%' })
      // Ăng-ten lắc + orb pulse
      gsap.fromTo(q('#antennaGroup'), { rotation: -7 }, { rotation: 7, duration: 0.55, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 100%' })
      gsap.to(q('#antennaOrb'), { scale: 1.3, duration: 0.55, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: 'center center' })
      // Tay nhún nhẹ theo nhịp
      gsap.to(q('#handLeft'), { y: -5, rotation: -8, duration: 0.7, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: 'center center' })
      gsap.to(q('#handRight'), { y: -5, rotation: 8, duration: 0.7, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: 'center center' })
      // Dấu ? bồng bềnh (opacity do applyLook + crossfade CSS)
      gsap.fromTo(q('#cuteQuestionBubble'), { y: 2 }, { y: -8, duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }

    const successState = () => {
      applyLook('success')
      baseFloat()
      // Pop 1 → 1.06 → 1 trong ~350ms (non-overshoot)
      gsap.timeline()
        .to(q('#mascotBodyGroup'), { scale: 1.06, duration: 0.12, ease: 'power2.out', transformOrigin: '50% 100%' })
        .to(q('#mascotBodyGroup'), { scale: 1, duration: 0.23, ease: 'power2.inOut' })
      // Sparkle nở ra (opacity do applyLook + crossfade CSS)
      gsap.fromTo(q('#successSparkles'), { scale: 0.6 }, { scale: 1.08, duration: 0.32, delay: 0.06, ease: 'power2.out', transformOrigin: 'center center' })
      gsap.to(q('.sparkle'), { rotation: 45, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: 'center center' })
      // Tay giơ cao rồi vẫy nhẹ
      gsap.to(q('#handLeft'), { x: -6, y: -30, rotation: -16, duration: 0.28, ease: 'power2.out', transformOrigin: 'center center' })
      gsap.to(q('#handRight'), { x: 6, y: -30, rotation: 16, duration: 0.28, ease: 'power2.out', transformOrigin: 'center center' })
      gsap.to([q('#handLeft'), q('#handRight')], { y: -35, duration: 0.5, delay: 0.28, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      // Confetti bùng nổ một lần (transform/opacity, tổng ≤ ~0.5s)
      const pieces = q('.confetti-piece')
      pieces.forEach((p, idx) => {
        const angle = (idx / pieces.length) * Math.PI * 2 + gsap.utils.random(-0.2, 0.2)
        const dist = gsap.utils.random(70, 130)
        gsap.fromTo(p,
          { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 },
          {
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            rotation: gsap.utils.random(-160, 160),
            scale: gsap.utils.random(0.7, 1.2),
            opacity: 0,
            duration: gsap.utils.random(0.32, 0.44),
            delay: 0.06 + idx * 0.015,
            ease: 'power2.out',
            transformOrigin: 'center center',
          })
      })
    }

    const blockedState = () => {
      applyLook('blocked')
      baseFloat()
      // Đầu lắc nhẹ như đang từ chối — biên độ nhỏ, chu kỳ 1.2s (calm)
      gsap.fromTo(q('#mascotBodyGroup'), { rotation: -3 }, { rotation: 3, duration: 1.2, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 100%' })
      // Ăng-ten cụp xuống rồi run nhẹ theo nhịp lắc (giữ nguyên tư thế cụp)
      gsap.fromTo(q('#antennaGroup'), { rotation: -12 }, { rotation: -8, duration: 1.2, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 100%' })
      // Dấu "!" nảy ra một lần ~300ms
      gsap.fromTo(q('#alertMark'), { scale: 0.6 }, { scale: 1, duration: 0.3, ease: 'power2.out', transformOrigin: 'center center' })
      // Tay trái nhô lên như ra hiệu dừng
      gsap.to(q('#handLeft'), { y: -12, rotation: -10, duration: 0.4, ease: 'power2.out', transformOrigin: 'center center' })
    }

    const trainingState = () => {
      applyLook('idle')
      gsap.to(q('#handLeft'), { y: -28, rotation: -12, duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: 'center center' })
      gsap.to(q('#handRight'), { y: -28, rotation: 12, duration: 0.8, delay: 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: 'center center' })
      gsap.to(q('#mascotBodyGroup'), { y: -3, duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }

    const errorState = () => {
      applyLook('error')
      baseFloat()
      // Buồn: đung đưa rất chậm (2.2s/chiều), không rung
      gsap.fromTo(q('#mascotBodyGroup'), { rotation: -2.5 }, { rotation: 2.5, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 100%' })
      // Giọt lệ rơi lặp lại: hiện 150ms → rơi 900ms → nghỉ 1.1s
      gsap.timeline({ repeat: -1, repeatDelay: 1.1 })
        .fromTo(q('#sadTear'), { y: 0, opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'power2.out' }, 0)
        .to(q('#sadTear'), { y: 12, opacity: 0, duration: 0.9, ease: 'power1.in' }, 0.15)
      // Hai tay buông nhẹ
      gsap.to([q('#handLeft'), q('#handRight')], { y: 4, duration: 1.8, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: 'center center' })
    }

    // matchMedia: reduced-motion → chỉ trạng thái tĩnh, không chạy timeline nào.
    const mm = gsap.matchMedia()
    mm.add(
      { reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' },
      (ctx) => {
        const reduce = Boolean(ctx.conditions?.reduce)
        if (reduce || !animate) {
          applyLook(state === 'training' ? 'idle' : state)
          return
        }
        if (state === 'training') trainingState()
        else if (state === 'searching') searchingState()
        else if (state === 'success') successState()
        else if (state === 'blocked') blockedState()
        else if (state === 'error') errorState()
        else idleState()
      },
    )

    return () => mm.revert()
  }, { dependencies: [state, celebrateKey, animate], revertOnUpdate: true })

  const bubble = STATE_TEXT[state] || STATE_TEXT.idle

  // Khi có bong bóng -> wrapper đủ rộng để bong bóng KHÔNG tràn ra ngoài mascot
  const wrapperWidth = speech !== null ? Math.max(size, 208) : size

  return (
    <div
      ref={rootRef}
      aria-hidden={speech === null ? true : undefined}
      style={{ position: 'relative', width: wrapperWidth, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {speech !== null && (
        <div className="gym-mascot-bubble" style={{ border: `1.5px solid ${bubble.border}` }}>
          {speechHeader && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#526b24', letterSpacing: 0.4, textTransform: 'uppercase' }}>
              <span style={{ background: bubble.badge, color: '#fff', padding: '1px 7px', borderRadius: 6, fontSize: 8.5 }}>GYM BUDDY</span>
              <span>{bubble.status}</span>
            </div>
          )}
          <div style={{ fontSize: speechHeader ? 13 : 14, fontWeight: 600, color: '#18211c', marginTop: speechHeader ? 2 : 0, lineHeight: 1.4 }}>{speech || bubble.text}</div>
        </div>
      )}

      {/* SVG thuần trang trí: trạng thái đã được đọc qua text kề bên (speech/badge) */}
      <svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"
        style={{ width: '100%', height: 'auto', overflow: 'visible', display: 'block', filter: 'drop-shadow(0 8px 14px rgba(10,18,8,0.18))' }}>
        <defs>
          <linearGradient id={`${uid}roofGrad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b9e849" />
            <stop offset="100%" stopColor="#526b24" />
          </linearGradient>
          <linearGradient id={`${uid}bodyGrad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e4edcd" />
          </linearGradient>
          <linearGradient id={`${uid}goldBadge`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <filter id={`${uid}softGlow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id={`${uid}sonarGlow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Vòng sóng sonar/radar (hiệu ứng tìm kiếm) */}
        <g id={`${uid}sonarWaveGroup`} className="gym-look" opacity="0">
          <circle id={`${uid}sonarRing1`} cx="140" cy="150" r="45" fill="none" stroke="#b9e849" strokeWidth="1.4" opacity="0" filter={`url(#${uid}sonarGlow)`} />
          <circle id={`${uid}sonarRing2`} cx="140" cy="150" r="45" fill="none" stroke="#789638" strokeWidth="1.2" opacity="0" />
          <circle id={`${uid}sonarRing3`} cx="140" cy="150" r="45" fill="none" stroke="#e4edcd" strokeWidth="1" opacity="0" />
        </g>

        {/* Bóng tiếp đất */}
        <ellipse id={`${uid}mascotShadow`} cx="140" cy="256" rx="54" ry="9" fill="rgba(10,18,8,0.18)" />

        {/* 2. Khung thân mascot */}
        <g id={`${uid}mascotBodyGroup`} style={{ transformOrigin: '140px 180px' }}>

          {/* Dấu hỏi dễ thương */}
          <g id={`${uid}cuteQuestionBubble`} className="gym-look" transform="translate(198, 48)" opacity="0">
            <circle cx="0" cy="0" r="13" fill={`url(#${uid}goldBadge)`} filter={`url(#${uid}softGlow)`} />
            <text x="0" y="4.5" fontSize="14" fontWeight="900" fill="#ffffff" textAnchor="middle" fontFamily="system-ui, sans-serif">?</text>
          </g>

          {/* Sparkles ăn mừng khi tìm thấy */}
          <g id={`${uid}successSparkles`} className="gym-look" opacity="0">
            <path className="sparkle" d="M 62,72 Q 62,80 54,80 Q 62,80 62,88 Q 62,80 70,80 Q 62,80 62,72 Z" fill="#fbbf24" filter={`url(#${uid}softGlow)`} />
            <path className="sparkle" d="M 218,68 Q 218,74 212,74 Q 218,74 218,80 Q 218,74 224,74 Q 218,74 218,68 Z" fill="#b9e849" />
            <path className="sparkle" d="M 226,170 Q 226,175 221,175 Q 226,175 226,180 Q 226,175 231,175 Q 226,175 226,170 Z" fill="#8ce4ae" />
          </g>

          {/* Ăng-ten */}
          <g id={`${uid}antennaGroup`}>
            <line x1="140" y1="84" x2="140" y2="50" stroke="#e4edcd" strokeWidth="3.5" strokeLinecap="round" />
            <circle id={`${uid}antennaOrb`} cx="140" cy="46" r="7.5" fill="#b9e849" filter={`url(#${uid}softGlow)`} />
          </g>

          {/* Athletic helmet and a terry headband replace HomeMatch's roof. */}
          <rect x="74" y="82" width="132" height="58" rx="28" fill={`url(#${uid}bodyGrad)`} stroke="#c6d6a3" strokeWidth="2" />
          <rect x="65" y="132" width="12" height="32" rx="6" fill="#789638" />
          <rect x="203" y="132" width="12" height="32" rx="6" fill="#789638" />
          <rect x="102" y="208" width="23" height="25" rx="9" fill="#d7e4bd" />
          <rect x="155" y="208" width="23" height="25" rx="9" fill="#d7e4bd" />
          <path d="M98 226q0-8 12-8h10q9 0 9 13v5H96v-5q0-5 2-5Z" fill="#f6f9eb" stroke="#bdce9b" strokeWidth="2" />
          <path d="M151 226q0-8 12-8h10q9 0 9 13v5h-33v-5q0-5 2-5Z" fill="#f6f9eb" stroke="#bdce9b" strokeWidth="2" />
          <path d="M97 233h30m24 0h29" stroke="#789638" strokeWidth="3" />

          {/* Thân mascot */}
          <rect x="74" y="108" width="132" height="106" rx="28" fill={`url(#${uid}bodyGrad)`} stroke="#e4edcd" strokeWidth="2" />

          <rect x="72" y="96" width="136" height="18" rx="7" fill="#b9e849" />
          <path d="M84 100v10m5-10v10m102-10v10m5-10v10" stroke="#8fb436" strokeWidth="1" />
          <rect x="126" y="96" width="28" height="18" rx="4" fill="#526b24" />
          <path d="M133 105h14m-11-4v8m8-8v8" stroke="#f6f9eb" strokeWidth="2" strokeLinecap="round" />

          {/* Mặt kính visor */}
          <rect id={`${uid}mascotVisor`} x="88" y="120" width="104" height="60" rx="18" fill="#18211c" stroke="#b9e849" strokeWidth="1.5" />

          {/* Má hồng chibi */}
          <g id={`${uid}cuteBlush`} className="gym-look" opacity="0">
            <ellipse cx="102" cy="160" rx="6.5" ry="3.5" fill="#f43f5e" opacity="0.45" />
            <ellipse cx="178" cy="160" rx="6.5" ry="3.5" fill="#f43f5e" opacity="0.45" />
          </g>

          {/* Mắt: neutral */}
          <g id={`${uid}eyesNeutral`} className="gym-look">
            <rect className="bot-eye" x="107" y="135" width="15" height="23" rx="7.5" fill="#b9e849" filter={`url(#${uid}softGlow)`} />
            <rect className="bot-eye" x="158" y="135" width="15" height="23" rx="7.5" fill="#b9e849" filter={`url(#${uid}softGlow)`} />
          </g>

          {/* Mắt: tò mò long lanh (searching) */}
          <g id={`${uid}eyesCuteConfused`} className="gym-look" opacity="0">
            <g transform="translate(114, 145)">
              <ellipse cx="0" cy="0" rx="10" ry="11" fill="#b9e849" filter={`url(#${uid}softGlow)`} />
              <ellipse cx="-2.5" cy="-3.5" rx="3.5" ry="4" fill="#ffffff" />
              <circle cx="3" cy="3" r="1.8" fill="#ffffff" />
            </g>
            <g transform="translate(166, 145)">
              <ellipse cx="0" cy="0" rx="9" ry="10" fill="#b9e849" filter={`url(#${uid}softGlow)`} />
              <ellipse cx="-2" cy="-3" rx="3" ry="3.5" fill="#ffffff" />
              <circle cx="2.5" cy="2.5" r="1.5" fill="#ffffff" />
            </g>
          </g>

          {/* Mắt: cười tươi ^ ^ (success) */}
          <g id={`${uid}eyesHappy`} className="gym-look" opacity="0">
            <path d="M 104 150 Q 115 134 126 150" stroke="#8ce4ae" strokeWidth="4" strokeLinecap="round" fill="none" filter={`url(#${uid}softGlow)`} />
            <path d="M 154 150 Q 165 134 176 150" stroke="#8ce4ae" strokeWidth="4" strokeLinecap="round" fill="none" filter={`url(#${uid}softGlow)`} />
          </g>

          {/* Miệng neutral */}
          <path id={`${uid}mouthNeutral`} className="gym-look" d="M 130 164 Q 140 171 150 164" stroke="#b9e849" strokeWidth="2.5" strokeLinecap="round" fill="none" />

          {/* Miệng chúm chím 'o' (searching) */}
          <ellipse id={`${uid}mouthCuteConfused`} className="gym-look" cx="140" cy="165" rx="3.5" ry="4.5" fill="#b9e849" opacity="0" filter={`url(#${uid}softGlow)`} />

          {/* Miệng cười rạng rỡ (success) */}
          <path id={`${uid}mouthHappy`} className="gym-look" d="M 128 162 Q 140 176 152 162 Z" fill="#8ce4ae" opacity="0" filter={`url(#${uid}softGlow)`} />

          {/* Mắt: nghiêm lo lắng — lông mày + đồng tử nhỏ (blocked) */}
          <g id={`${uid}eyesWorried`} className="gym-look" opacity="0">
            <path d="M 103 134 L 121 140" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M 177 134 L 159 140" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" fill="none" />
            <ellipse cx="113" cy="150" rx="4.5" ry="6.5" fill="#ef4444" filter={`url(#${uid}softGlow)`} />
            <ellipse cx="167" cy="150" rx="4.5" ry="6.5" fill="#ef4444" filter={`url(#${uid}softGlow)`} />
          </g>

          {/* Miệng mím nghiêm (blocked) */}
          <path id={`${uid}mouthWorried`} className="gym-look" d="M 129 167 Q 140 163 151 167" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0" />

          {/* Dấu "!" cảnh báo (blocked) */}
          <g id={`${uid}alertMark`} className="gym-look" transform="translate(198, 48)" opacity="0">
            <circle cx="0" cy="0" r="13" fill="#ef4444" filter={`url(#${uid}softGlow)`} />
            <text x="0" y="5" fontSize="15" fontWeight="900" fill="#ffffff" textAnchor="middle" fontFamily="system-ui, sans-serif">!</text>
          </g>

          {/* Mắt cụp buồn (error) */}
          <g id={`${uid}eyesSad`} className="gym-look" opacity="0">
            <path d="M 103 144 Q 113 153 123 144" stroke="#b45309" strokeWidth="4" strokeLinecap="round" fill="none" filter={`url(#${uid}softGlow)`} />
            <path d="M 157 144 Q 167 153 177 144" stroke="#b45309" strokeWidth="4" strokeLinecap="round" fill="none" filter={`url(#${uid}softGlow)`} />
          </g>

          {/* Miệng buồn (error) */}
          <path id={`${uid}mouthSad`} className="gym-look" d="M 129 169 Q 140 160 151 169" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0" />

          {/* Giọt lệ (error) — GSAP cho rơi lặp; không dùng .gym-look để khỏi bị CSS transition opacity chồng lên */}
          <path id={`${uid}sadTear`} d="M 112 152 q 3.5 4.5 0 8 q -3.5 -3.5 0 -8" fill="#38bdf8" opacity="0" />

          {/* Huy hiệu ngực */}
          <circle id={`${uid}chestBadge`} cx="140" cy="195" r="12" fill="#526b24" />
          <path d="M132 195h16m-14-4v8m12-8v8m-9-10v12m6-12v12" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />

          {/* Hai tay */}
          <g id={`${uid}handLeft`}>
            <path d="M54 158L78 168" stroke="#9cb773" strokeWidth="9" strokeLinecap="round" />
            <rect x="35" y="150" width="42" height="7" rx="3" fill="#8e9990" />
            <rect x="34" y="140" width="9" height="27" rx="3" fill="#354239" />
            <rect x="41" y="136" width="9" height="35" rx="3" fill="#526b24" />
            <rect x="62" y="136" width="9" height="35" rx="3" fill="#526b24" />
            <rect x="69" y="140" width="9" height="27" rx="3" fill="#354239" />
            <circle cx="56" cy="160" r="10" fill="#b9e849" stroke="#8fae48" strokeWidth="2" />
          </g>
          <g id={`${uid}handRight`}>
            <path d="M226 158L202 168" stroke="#9cb773" strokeWidth="9" strokeLinecap="round" />
            <rect x="203" y="150" width="42" height="7" rx="3" fill="#8e9990" />
            <rect x="202" y="140" width="9" height="27" rx="3" fill="#354239" />
            <rect x="209" y="136" width="9" height="35" rx="3" fill="#526b24" />
            <rect x="230" y="136" width="9" height="35" rx="3" fill="#526b24" />
            <rect x="237" y="140" width="9" height="27" rx="3" fill="#354239" />
            <circle cx="224" cy="160" r="10" fill="#b9e849" stroke="#8fae48" strokeWidth="2" />
          </g>
        </g>

        {/* 3. Confetti bùng nổ ăn mừng khi có kết quả (GSAP phóng từ tâm) */}
        <g id={`${uid}confettiBurst`}>
          {['#69cf96', '#8ce4ae', '#fbbf24', '#b9e849', '#f472b6', '#526b24', '#789638'].flatMap((color, ci) =>
            [0, 1].map(k => (
              <rect key={`${ci}-${k}`} className="confetti-piece" x="136" y="146"
                width={9 - (ci % 3) * 2} height={9 - (ci % 3) * 2} rx="1.5" opacity="0"
                fill={color} style={{ transformOrigin: '140px 150px' }} />
            ))
          )}
        </g>
      </svg>
    </div>
  )
}
