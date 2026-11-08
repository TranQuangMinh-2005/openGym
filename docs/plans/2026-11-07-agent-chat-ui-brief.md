# Agent Coach chat — UI redesign brief (2026-11-07)

Scope: `frontend/src/views/AgentChat.jsx` + `AgentChat.css` only (plus its test). No new dependencies:
`gsap` and `@gsap/react` are already in `frontend/package.json`. No external fonts or CDNs (the app is
self-hosted, no third-party requests). Skills to apply: `ui-ux-pro-max`, `gsap-react`, `gsap-core`,
`gsap-timeline`, `gsap-performance`, `taste-skill` (principles only: one system, one button pair,
hover/press feedback, one entrance, reduced motion; do NOT run its gate — this is app UI, not a site).

## Design direction
- Keep the app's own tokens from `src/index.css` (`--bg`, `--surface*`, `--label*`, `--sep`, `--hair`
  (a WIDTH, .5px — never a colour), `--acc`, `--on-acc`, `--acc-soft`, `--r*`, `--ease`, `--fast`, `--med`,
  `--sab`). Dark is default; light via `:root[data-theme="light"]`. Both must read well.
- Coach identity = the mascot (`components/GymMascot.jsx`, props `state`, `size`, `speech`,
  `celebrateKey`, `speechHeader`, `animate`; states idle/searching/blocked/success/error/training,
  texts in `GYM_BOT_STATES`). The mascot is the face of the chat, not a decoration in the corner.
- Feel: calm, sporty, confident. Large readable type (body 16px, line-height 1.5), generous spacing,
  one accent. No emoji as icons — inline SVG icons, one stroke width.

## Layout (mobile-first; desktop ≥ 900px adds a right column)
1. **Header (sticky):** mascot (size ~64) + title "Coach" + live status line from
   `GYM_BOT_STATES[state].status` (aria-live polite). Mascot state follows the run: running →
   `searching`, awaiting approval → `blocked`, just approved → `success` (bump `celebrateKey`),
   error → `error`, else `idle`.
2. **Empty state** (no messages): big mascot (~140) with `speech` greeting, then 3 suggestion chips
   that send immediately: "Tạo lịch 3 buổi/tuần", "Đánh giá tiến bộ của tôi", "Nên tập bao nhiêu set
   mỗi tuần?". Chips ≥ 44px tall.
3. **Transcript** (`role="log"`, `aria-live="polite"`): user bubbles right on `--acc`/`--on-acc`;
   coach bubbles left on `--surface` with a small static mascot avatar (`animate={false}`,
   size ~28, `speechHeader={false}`), only on the first bubble of a coach run of messages. Max width
   ~78%. Keep `AssistantText` (bold + `[kb-…]` citation pills, `.agent-citation`). Auto-scroll to
   the newest message.
4. **Thinking indicator** while `running`: a coach bubble with three animated dots and the status
   text; a "Hủy" (cancel) text button next to it.
5. **Approval card** (the hero moment): elevated surface, kind chip (Tạo / Sửa chương trình /
   Xác nhận điều kiện), summary, then
   - **Facts** (`PlanFacts`): headline row "3 buổi/tuần" + per-routine minute pills; then the per-muscle
     table KEPT AS A `<table>` (columns Nhóm cơ chính | Buổi/tuần | Set/tuần) where each row also
     shows a horizontal bar (an `aria-hidden` span, width ∝ sets / max sets) — the cell text must stay
     the plain numbers. Sessions shown as "1×" style badge is fine only if the cell text stays the number.
   - **Plan diff**: one block per routine (name + exercise lines, `+`/`−` marks coloured), weekday
     schedule as a 7-cell strip (CN..T7) showing routine name or "Nghỉ".
   - plan_edit changes as toggle rows (keep `<input type="checkbox">` semantics).
   - Action row, sticky at the card bottom on phones: primary "Duyệt" (accent fill), secondary
     "Từ chối" (tonal). Same two button styles everywhere.
6. **Composer** (sticky bottom, respects `--sab`): pill-shaped field, auto-growing textarea (1–5
   rows), round 44px send button with an SVG arrow and `aria-label`. Enter sends, Shift+Enter is a
   newline. Disabled while running or awaiting approval, with a one-line hint why ("Duyệt hoặc từ chối
   đề xuất trước nhé").
7. **Constraints panel**: desktop right column card; on phones a `<details>` disclosure under the
   header ("Điều kiện tập luyện (n)").

## Motion (GSAP, `useGSAP` with `scope` ref, `contextSafe` for handlers)
- New messages only (track the previous count in a ref): `from {y: 12, opacity: 0}`, 0.32 s, `power3.out`.
- Approval card enters once: card 0.4 s, then facts bars `scaleX` 0→1 from the left, stagger 0.04
  (transform only, `transform-origin: left`).
- Thinking dots: a looping timeline (y bounce, 0.9 s cycle), killed when not running.
- Button press via CSS `:active { transform: scale(.97) }` with `--fast`; hover colour shift.
- `gsap.matchMedia()` with `(prefers-reduced-motion: reduce)`: no tweens, final state shown.
- Guard like GymMascot does: skip GSAP when `window.matchMedia` is missing (tests run in linkedom).
- No scroll-linked animation, no parallax, nothing fades in on scroll.

## Constraints
- Keep every existing behaviour and export (`AssistantText`, `PlanDiff`, `ConstraintDiff`,
  `PlanFacts`, `ApprovalCard`, default `AgentChat`), the `agent-api.js` calls and the i18n `t()` use.
- `src/views/AgentChat.test.jsx` must pass unchanged, except where a test asserts markup that the
  brief deliberately changes — then update that test minimally and say which and why.
- Accessibility: visible `:focus-visible` rings, every icon button named, contrast ≥ 4.5:1 for text in
  both themes, tap targets ≥ 44px, no horizontal scroll at 320px.
- Plain CSS in `AgentChat.css` (BEM-ish `agent-*` classes), no inline style except computed bar widths.
