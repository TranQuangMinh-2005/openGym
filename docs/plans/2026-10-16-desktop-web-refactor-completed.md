# openGym desktop workspace — implementation report

Implemented the selected layout: training schedule and log remain the main workspace, with Gym Buddy in the right rail and a dedicated chat route. This report accompanies `2026-10-16-desktop-web-refactor.md`.

## Delivered across the planned phases

| Phase | Implementation |
| --- | --- |
| Shell / Home | Persistent collapsible navigation, page breadcrumb, real sync status, start/resume action, overview metrics, weekly planner, recent sessions, desktop dashboard cards. Mobile retains its bottom navigation. |
| Overlays | Desktop dialogs, wide exercise picker, side drawers for exercise/session/history details; mobile bottom sheets. Focus trapping, heading labels, background inert, Escape/back, nested modal ownership and focus return. Existing history/scroll-lock implementation retained. |
| Plan / RoutineEdit | Responsive fixed-week grid; rotation retains existing sequence rules. Desktop routine list and selected routine inspector. Shared routine list preserves reorder, swipe duplicate/delete and Undo. Editor uses a main editing area and coverage/actions sidebar on wide screens. |
| History / Library | Search and date filters, desktop training table and session drawer, mobile session list. Exercise library has a sticky filter column, result grid/list, search/reset and detail drawer. |
| Workout | Desktop exercise navigator, current exercise / set entry workspace, static Buddy guidance, sticky session header, rest footer, minimized session bar. Existing set, superset, effort, timer, keyboard, edit, save and backfill handlers retained. Resizing does not recreate the active workout. |
| Buddy / Coach | Persistent contextual Buddy rail on wide screens, drawer on tablet/mobile and floating mobile launcher. Buddy also appears in the sidebar, mobile Home, page guidance/empty states, exercise navigator, chat avatar/intake and completion prompt. Dedicated chat retains one status controller; draft survives navigation. Wide chat displays a pending proposal alongside the conversation. Opening Buddy does not start an AI request or another polling loop. |
| Stats / Measurements / Settings | Two-column statistics content, responsive chart coordinates and keyboard value exploration; unique SVG gradient IDs. Measurements trend/log columns. Settings section navigation plus content. Dark/light tokens, visible focus, reduced-motion support and animation pause. Hidden rail/card animations are disabled. |
| Delivery | Source, Docker production build, browser screenshots and machine-readable layout/flow reports. |

## Layout and tokens

```text
Desktop >= 1280
+----------------+-----------------------------------------+----------------+
| Navigation     | Breadcrumb / connection status                           |
| Start / Resume +-----------------------------------------+----------------+
|                | Training schedule / log / active view   | Gym Buddy      |
| Profile        |                                         | Context / chat |
+----------------+-----------------------------------------+----------------+

Tablet 768–1279: navigation + main workspace, Buddy opens as a drawer.
Mobile <768: main workspace + bottom navigation + floating Buddy launcher.
Active workout: exercise navigator + set entry; contextual Buddy stays compact.
```

- `--workspace-sidebar`: 72 px tablet/collapsed, 224 px expanded desktop.
- `--workspace-header`: 72 px; `--workspace-rail`: 288–304 px; gap 24–32 px.
- Theme uses the existing semantic background/surface/text/separator tokens. The saved accent preference remains supported.
- Global application state and training data schema were not replaced by new presentation stores. `buddyActivity` is ephemeral UI state; the chat draft is scoped to the user in session storage.
- Motion uses existing GSAP with component cleanup and scoped mascot selectors. Small instances remain static; reduced motion and the rail pause control suppress continuous animation. SVG renderers lacking native transform support receive the static mascot.

## Verification and evidence

Screenshots: `../previews/web-refactor/`.

- `layout-audit.json`: 64 route/viewport combinations plus 3 drawer checks. Viewports 375×812, 768×1024, 1024×768, 1280×800, 1366×768, 1440×900, 1920×1080 and 812×375. No document horizontal overflow or browser exceptions found. Includes dark/light renders.
- `flow-audit.json`: routine selection/start, logging sets/rest, resize retaining active session ID and timer deadline, minimize/resume, finish/save, dialog focus ownership, chat draft retention, Buddy opening without additional status requests, and a 720×450 viewport equivalent to a 1440×900 workspace at 200% zoom.
- Browser interaction tests use an isolated browser context, local fixture state and intercepted API writes. They do not create test workouts in the real profile or contact an AI provider. Fixture screenshots are identified by filename or the workout flow described here.
- Frontend test and production build results are recorded below after the final verification run.

## Existing service boundaries

The AI provider is still unconfigured on this instance. Buddy renders the mascot/context UI and setup entry, and displays the real configured chat when a provider is available. Chat, provider/judging behavior, consent, proposal approval and training policy remain the existing implementation.

The 18 shipped locale packs remain consistent. Newly added UI strings pass through `t()` and currently use English fallback in packs without translations; the source-string report still includes this translation backlog. No full locale translation was part of this frontend refactor.

## Final results

- Frontend: all 5,063 tests verified across the full sweep and isolated reruns. The final broad sweep passed 5,038 tests; two suites hit filesystem/import time limits while Docker was building. Rerunning those suites alone with one worker and higher CLI time limits passed the remaining 25 tests. No project test timeout settings were changed. The changed Home/chart code also passed a final 42-test focused run; the chat/modal/plan/chart group passed 127 tests.
- Locale consistency: 18 packs × 2,258 keys, pass. The source-string checker remains report-only and reports the English fallback backlog described above.
- Fatigue property checks: 108,000 monotonic comparisons and 1,800 randomized history deletion comparisons, pass.
- `git diff --check`: pass.
- Production: Docker web image built successfully using Node 22; deployed only the web service. Served bundle `assets/index-DLUEEiH5.js`, CSS `assets/index-BZWAuw3e.css`; main JS 1,221.91 kB raw / 382.07 kB gzip. Existing large-bundle warning remains; no arbitrary performance threshold is claimed.
- `production-review.json`: live port 8080, seven additional route renders, mobile Buddy drawer, light/dark screenshots, no browser exceptions or document overflow in the checked routes. API writes are intercepted during review.
- Final flow rerun includes a desktop timer position assertion, and passed all ten flow checks with zero browser exceptions.
- The real profile still has revision 8, three routines, zero workouts and one weigh-in after verification; fixture workouts were kept out of it.

Primary preview: `../previews/web-refactor/production-home-1440.png`. Other `production-*` files show the deployed app; workout/chat/history fixture files show the isolated interaction scenarios. The application is running at **http://localhost:8080/#/home**.
