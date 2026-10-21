# Kế hoạch refactor openGym cho desktop web

Ngày: 16/10/2026. Trạng thái: kế hoạch, chưa triển khai giao diện mới.

## 1. Quyết định đã thống nhất

- Lịch tập và nhật ký là khu vực chính. Gym Buddy ở cột phải trên desktop đủ rộng, có trang chat riêng.
- Giữ mascot Gym Buddy đã duyệt: robot, băng đô, tạ, lime, sáu trạng thái.
- Tiếp tục single user và lưu dữ liệu trên server. Không bổ sung đăng nhập vào đợt refactor.
- Giữ mobile sử dụng được; desktop có bố cục và thao tác phù hợp chuột/bàn phím.
- Phong cách đề xuất: ứng dụng luyện tập với nền graphite, hệ surface rõ, accent lime mặc định, typography gọn và bảng số liệu dễ đọc. Tiếp tục tôn trọng accent/theme người dùng đã lưu.
- Taste dùng để rà hierarchy, khoảng thở và tính nhất quán; UI/UX Pro Max dùng cho navigation, layout, keyboard, responsive và accessibility; GSAP dùng cho chuyển trạng thái và mascot.
- Dials đề xuất: variance 5/10, motion 3/10, density 6/10. Đây là giao diện sản phẩm, không áp mẫu landing page/hero marketing vào các màn hình thao tác.

## 2. Kết quả khảo sát source và giao diện đang chạy

Đã đọc shell/router, navigation, CSS desktop, Home, các luồng Plan/RoutineEdit, Library/History/Measurements, phần render và tương tác chính của Workout/Stats, CoachChat/Intake, hệ modal, timer, state và tài liệu kiến trúc repo. Các file lớn được khảo sát theo luồng liên quan, chưa phải audit từng dòng toàn bộ repo.

Đã dùng trình duyệt kiểm tra 8 route ở viewport 1440×1000 và mở chi tiết một bài tập. Chưa bắt đầu hoặc hoàn thành buổi tập trong khảo sát. Log lượt duyệt không có JavaScript page error; đây không thay thế kiểm thử chức năng.

| Phát hiện | Bằng chứng | Hệ quả thiết kế |
|---|---|---|
| Container gốc 560 px, desktop tăng lên 1080 px | `frontend/src/index.css`, `#app`, desktop media query | Có nới width nhưng chưa có application shell desktop |
| Home và Plan vẫn dùng `.narrow` 640 px | `Home.jsx`, `Plan.jsx`, CSS `.narrow`; đo thực tế width 640, left 400 tại viewport 1440 | Hai màn hình quan trọng nhất vẫn là một cột điện thoại |
| Measurements, Settings và StartChooser cũng 640 px | Browser baseline | Không tận dụng không gian cho form/chi tiết liên quan |
| Navigation desktop vẫn là tabbar nổi dưới, 520 px | `components/TabBar.jsx`, `index.css`; đo DOM | History/Measurements/Buddy khó khám phá; Start không có vị trí desktop riêng |
| Plan tách Schedule/Routines bằng segmented control | `views/Plan.jsx`, `PLAN_VIEW_KEY` | Desktop khó xem danh sách buổi và bài trong cùng không gian |
| Rotation đã tồn tại | `lib/rotation.js`, `lib/queue.js`, `Plan.jsx` | Phải giữ chuỗi buổi linh hoạt; không ép mọi người vào lịch theo thứ |
| Reorder routine phụ thuộc danh sách một cột | `RoutineEdit.jsx`, CSS `.routine-list`, `use-list-reorder` | Không chia bài tập đang reorder thành grid hai cột |
| Library dùng nhiều hàng chip cuộn và detail sheet | `views/Library.jsx`, `sheets.jsx` | Desktop cần filter rail và vùng chi tiết bài |
| Chi tiết bài là bottom sheet 640 px, cao khoảng 900 px | `components/Modals.jsx`, screenshot đo DOM | Cần drawer/dialog desktop, nút đóng và focus behavior rõ |
| Modal có swipe/mouse drag và can thiệp browser history/body scroll | `Modals.jsx`, `store/useUI.js` | Đổi presentation phải giữ stack, Back/Escape, locked modal và trả scroll |
| Chưa thấy role/aria-modal/focus trap trong host sheet | Source modal + đo DOM chi tiết bài | Bổ sung semantic dialog, trap/restore focus, nền inert khi modal |
| Chat giới hạn `.narrow`; composer fixed toàn viewport, inner max 560 px | `CoachChat.jsx`, `coach.css` | Không thể nhét nguyên chat vào cột phải mà chỉ thay width |
| Chat text draft đang là state cục bộ | `CoachChat.jsx` | Đóng panel/đổi route có thể mất nháp nếu không thiết kế ownership |
| `App.jsx` key content theo pathname | `App.jsx` | Shell/navigation và controller dùng chung phải nằm ngoài vùng remount |
| Workout có keyboard, scroll anchors, rest/work timer, draft/edit/backfill | `Workout.jsx`, `RestTimer.jsx`, `useUI.js` | Đây là luồng rủi ro cao; chuyển sau shell/modal và giữ nguyên domain behavior |
| LineChart dùng SVG viewBox 340 và pointer/touch tooltip | `LineChart.jsx` | Container co giãn được nhưng cần rà độ đọc trục/tooltip/keyboard ở desktop |
| CSS và UI logic tập trung trong các file lớn | `index.css` ~2137 dòng; `sheets.jsx` ~3422; `Workout.jsx` ~2089; `Settings.jsx` ~1501 | Tách dần theo component, tránh thêm lớp override toàn cục |
| `MOBILE` là build flag Capacitor, không phải độ rộng màn hình | `lib/mobile.js` | Responsive dùng CSS/container/media query; không lấy `MOBILE` để phân loại laptop/điện thoại |
| Persisted state và transient UI đã tách | `useStore.js`, `useUI.js` | Giữ lịch/nhật ký trong S; sidebar/panel/filter presentation vào UI state |
| Buddy đã có Home card, Coach avatar, Intake | `GymBuddyCard.jsx`, `GymMascot.jsx`, `CoachChat.jsx`, `CoachIntake.jsx` | Tái sử dụng asset; thay placement và ownership, không tạo mascot thứ hai |

Baseline: `docs/previews/web-audit/layout-baseline.json` và ảnh cùng thư mục.

## 3. Application shell đề xuất

Desktop rộng:

```text
┌──────────────────┬────────────────────────────────────┬────────────────────┐
│ openGym          │ Tiêu đề trang / trạng thái lưu     │ Gym Buddy          │
│                  ├────────────────────────────────────┤                    │
│ Tổng quan        │ Lịch tập / chi tiết buổi           │ Mascot nhỏ         │
│ Chương trình     │                                    │ Ngữ cảnh đang xem  │
│ Nhật ký          │ Bảng bài tập, sets, reps, nghỉ      │ Hành động phù hợp  │
│ Bài tập          │                                    │ Mở cuộc trò chuyện │
│ Tiến bộ          │ Nội dung theo route                │                    │
│ Gym Buddy        │                                    │                    │
│                  │                                    │                    │
│ Số đo / Cài đặt  ├────────────────────────────────────┴────────────────────┤
│                  │ Thanh phiên tập/nghỉ, chỉ khi có phiên đang hoạt động │
└──────────────────┴─────────────────────────────────────────────────────────┘
```

- Navigation dùng một cấu hình chung cho sidebar desktop và bottom nav mobile. Không đổi URL hiện có.
- Sidebar chính: `/home`, `/plan`, `/history`, `/library`, `/stats`, `/coach`. Số đo `/measurements` và Settings ở nhóm phụ. Admin vẫn theo quyền hiện có.
- Nút Bắt đầu/Tiếp tục là hành động riêng của shell, dùng cùng logic `effectiveRoutineIds`, `startFlow`, `S.active` hiện tại. Không tạo hai cách bắt đầu có hành vi khác nhau.
- Chế độ workout đang hoạt động dùng shell tập trung: rail thu gọn, không mở Buddy rail mặc định; timer và controls có chỗ cố định.
- `/gym-bot` giữ là trang preview có thể mở trực tiếp, không phải lối vào trợ lý chính trong navigation.
- Header chỉ có tiêu đề, breadcrumb khi cần, trạng thái sync và hành động liên quan. Chưa thêm ô tìm kiếm toàn cục nếu chưa có chức năng thật.

### Breakpoint và kích thước khởi điểm

| Viewport | Điều hướng | Nội dung và Buddy |
|---|---|---|
| <768 px | Bottom nav 5 mục hiện có | Một cột; Buddy là card/drawer; giữ viewport keyboard/safe area |
| 768–1023 px | Rail icon khoảng 72 px | Một vùng chính rộng; Buddy đóng/mở theo yêu cầu |
| 1024–1279 px | Sidebar khoảng 224 px | Nội dung chính; Buddy dạng drawer để không ép bảng |
| ≥1280 px | Sidebar khoảng 224 px | Vùng chính + Buddy rail 280–320 px, có thể thu gọn |
| ≥1600 px | Shell vẫn có giới hạn đọc hợp lý | Tăng không gian bảng/chart, không kéo dài dòng chat vô hạn |

- Gutter dự kiến 16/24/32 px theo breakpoint; gap 16–24 px.
- Kiểm tra tổng width thực tế; vùng chính có rail nên còn khoảng 680–720 px trở lên. Thiếu chỗ thì thu rail.
- Sidebar, rail không chồng lên nội dung. Bảng rộng được cuộn cục bộ có chỉ báo, không gây horizontal scroll cả trang.
- Ưu tiên tiếp tục window/document scroll cho các trang thường. Không đổi toàn app thành nested scroll trong đợt shell đầu vì code hiện dùng `window.scrollY`, `scrollIntoView`, modal scroll restore.

## 4. Thiết kế theo màn hình

### Home

- Vùng chính: buổi kế tiếp/hôm nay, nút bắt đầu/tiếp tục, tiến độ chuỗi buổi hoặc tuần, nhật ký gần đây.
- Biểu đồ cân nặng và số liệu phụ bố trí theo grid có ưu tiên; không lặp nguyên dashboard Stats.
- Buddy chuyển từ card giữa feed sang rail phải; mobile giữ card gọn.
- Empty state dẫn tới tạo chương trình hoặc mẫu; có dữ liệu thì hiển thị dữ liệu thật, không tạo số liệu minh họa giả.

### Chương trình và chỉnh buổi

- Chuỗi buổi hoặc tuần cố định là hai presentation dựa trên mode đã có, giữ thứ tự và tiến độ rotation.
- Desktop: danh sách/chuỗi buổi + vùng bài tập buổi đang chọn. Khi có Buddy rail, danh sách buổi dùng row/chip phía trên nếu ba cột con không đủ chỗ.
- Bảng bài: bài tập, sets, khoảng reps, mức tạ có căn cứ, nghỉ, thao tác. Card mobile dùng cùng dữ liệu/action.
- RoutineEdit giữ reorder một trục và quan hệ superset. Thêm nút lên/xuống cho keyboard; drag chỉ ở handle.
- Không tự chuyển tuần, reset rotation hoặc ghi đè chương trình khi chỉ đổi layout.

### Nhật ký và ghi buổi tập

- History desktop thành bảng/list có ngày, buổi, thời lượng, số sets và chi tiết xem được. Trường nào dữ liệu không có thì để rõ chưa có.
- Chọn một buổi mở detail drawer; sửa dùng draft flow hiện có. Không sửa trực tiếp lịch sử chỉ bởi thao tác chọn hàng.
- Màn hình tập: danh sách bài bên trái hoặc trên, bảng hiệp ở giữa, lịch sử/tham chiếu ở vùng phụ khi đủ rộng.
- Phân biệt rõ target và thực hiện; giữ kg/lb, mỗi tay/tổng tải, reps mỗi bên, timed sets, cardio, supersets.
- Timer nghỉ, pause/resume, finish/discard, backfill và chỉnh buổi cũ tiếp tục dùng state machine/helper hiện có.

### Thư viện bài

- Filter rail theo nhóm cơ/thiết bị/loại; ô search và số kết quả ở toolbar.
- Vùng kết quả co giãn theo không gian còn lại, giữ tải tăng dần 40 bài hiện tại trước khi có bằng chứng cần virtualization.
- Chọn bài mở drawer chứa media, hướng dẫn, cơ và thao tác thêm vào buổi. Khi drawer mở ở màn hình hẹp, Buddy rail nhường chỗ.
- Dùng lại filter/search/favourites/equipment behavior, không viết lại engine tìm kiếm.

### Tiến bộ và số đo

- Stats: grid 12 cột ở desktop, biểu đồ chính lớn, body map có chú giải kế bên nếu đủ chỗ.
- Group metric theo mục đích, hạn chế một màn hình xếp rất nhiều card dài.
- Date range và chart selected state nhất quán; tooltip không bị clip, có cách xem số liệu bằng bàn phím.
- Measurements: form và xu hướng cùng màn hình; dữ liệu cm/in/% giữ logic hiện tại.
- Trang hồ sơ tổng hợp tuổi/chiều cao/mục tiêu là hạng mục sản phẩm riêng, chưa gộp vào refactor layout này.

### Settings

- Desktop có danh sách nhóm trái và nội dung nhóm phải; mobile tiếp tục route/page riêng.
- Giữ các URL `/settings/:page`, chế độ single user và đường cấu hình provider.

## 5. Gym Buddy: một trợ lý, nhiều presentation

- Tái sử dụng `GymMascot` và sáu state. Không đổi hình dáng đã duyệt.
- Rail mặc định là mascot + trạng thái AI + ngữ cảnh + thao tác mở chat. Không tự gửi dữ liệu hay gọi model chỉ vì mở rail.
- `/coach` là workspace đầy đủ: chat ở vùng chính, chương trình/đề xuất ở rail phụ. Không hiện đồng thời thêm một chat độc lập khác.
- Kế hoạch dài xem được cạnh chat; before/after và nút chấp nhận giữ flow hiện có, không áp dụng tự động.
- Giai đoạn đầu rail chỉ có context/actions; mini chat thực sự là bước sau khi tách được controller dùng chung.
- Canonical chat dùng `S.coach.chat`, profile/log hiện có; pending proposal/job vẫn từ API và `useCoachStatus`. Không clone một cuộc hội thoại riêng vào component rail.
- Nếu cần mini chat: chỉ một controller/poller quản lý job; rail/page là view của cùng controller. Cần giữ draft khi panel đổi presentation hoặc route, tránh mount hai `CoachChat` cùng polling.
- Trạng thái không kết nối hiển thị rõ và có đường tới cấu hình cho admin; không tạo câu trả lời giả.
- Context chọn bài/buổi phải rõ cho người dùng. Một phản hồi cũ không được ghi vào buổi vừa chọn sau đó; tiếp tục kiểm tra proposal stale/fingerprint của logic hiện tại.
- Trong workout, Buddy không che bảng hiệp/timer; animation chỉ phục vụ trạng thái. Mascot tĩnh khi thu gọn/ngoài màn hình/reduced motion; có pause nếu chuyển động kéo dài.

## 6. Component và CSS architecture

Đề xuất tách dần:

```text
src/components/layout/
  AppShell.jsx
  DesktopSidebar.jsx
  MobileNavigation.jsx
  PageHeader.jsx
  WorkspaceLayout.jsx
  ActiveSessionBar.jsx
src/components/buddy/
  BuddyRail.jsx
  BuddyLauncher.jsx
  BuddyContextCard.jsx
src/components/overlays/
  AdaptiveOverlay.jsx
  DialogFrame.jsx
  DrawerFrame.jsx
src/styles/
  tokens.css
  shell.css
  overlays.css
```

Tên file là dự kiến, có thể điều chỉnh theo extraction thực tế.

- `App.jsx` tiếp tục quản lý routing, boot, prefs, global effects. AppShell bao vùng route; giữ ErrorBoundary key/reset theo route ở vùng nội dung, không key cả shell/controller.
- Tách metadata điều hướng/active state khỏi TabBar để desktop/mobile dùng chung. Giữ thông báo lỗi sync và cách Resume hoạt động.
- CSS semantic token: surfaces, text, border, accent, focus, spacing, radii, elevation, sidebar/rail/header sizes. User theme/accent là nguồn giá trị.
- Dùng CSS grid/container/media queries và class theo component. Tránh sửa toàn bộ `.list`, `.narrow`, `.card` bằng override chung.
- Không thêm UI framework lớn chỉ để có sidebar/bảng; tái sử dụng bộ Icon và UI primitives hiện tại. GSAP đã có dependency.
- Sử dụng `t()` và cơ chế locale hiện có cho UI mới; xử lý chuỗi Buddy hardcode trong quá trình extraction. Không biến đợt này thành dự án dịch toàn bộ ứng dụng.
- Sidebar collapse, rail open, nháp chat và filter presentation thuộc UI/local preference; không lưu vào lịch tập hoặc sync chung với domain state nếu không có nhu cầu.

### Adaptive overlay

- Mobile: sheet hiện có, giữ gesture và keyboard insets.
- Desktop confirm: dialog gọn khoảng 400–480 px.
- Chi tiết bài/buổi: drawer khoảng 480–640 px tùy nội dung.
- Picker hoặc form nhiều trường: dialog lớn với `max-width` theo viewport, không cố ép vào 340 px.
- Thêm presentation option tương thích `openSheet` hiện có; chuyển từng caller, không đổi hàng trăm sheet cùng lúc.
- Dialog semantics: accessible name, role/aria-modal, focus trap, focus restore, Escape theo `locked`, close button luôn rõ, background inert.
- Tách drag-to-dismiss desktop khỏi vùng text/input; không để kéo chọn nội dung làm panel di chuyển.
- Modal vẫn portal/host ngoài vùng có animation transform. Giữ stack/Back/Escape/body lock đã có và bổ sung kiểm thử trước khi thay behavior.

## 7. Motion plan với GSAP

| Tình huống | Motion đề xuất |
|---|---|
| Nội dung route xuất hiện | opacity + translateY 8 px, 180–240 ms, không animate cả fixed shell |
| Drawer/rail mở | opacity + translateX, 200–280 ms; chiều rộng layout thay theo CSS, không tween width |
| Card/row phản hồi thao tác | CSS hover/focus/pressed 120–180 ms |
| Proposal được tạo/áp dụng | highlight đúng vùng thay đổi 200–350 ms, không flash cả trang |
| Buddy suy nghĩ | animation state trong lúc job đang chạy, dừng khi job kết thúc |
| Hoàn thành buổi | một nhịp success ngắn; không confetti lặp vô hạn |

- `useGSAP`, scoped selectors, `revertOnUpdate` khi cần, cleanup khi unmount/state đổi.
- Tôn trọng reduced motion, không làm nội dung chỉ hiện được sau animation.
- Không chạy timeline lại theo từng ký tự gõ, polling tick, token hoặc timer tick.
- Không dùng scroll reveal/ScrollTrigger cho bảng thao tác chỉ để trang trông sinh động.

## 8. Thứ tự triển khai và điều kiện qua từng đợt

| Đợt | Công việc | Điều kiện hoàn thành |
|---|---|---|
| 0 — khảo sát (đã có) | Source audit, baseline 8 route, lựa chọn cấu trúc với người dùng | Có report DOM, screenshots và plan này |
| 1 — thiết kế và shell | Wireframe desktop/mobile; tokens; navigation metadata; AppShell/sidebar/header; Home split layout | 1440/1366 có desktop shell, mobile còn bottom nav, không mất session/scroll |
| 2 — overlay foundation | Adaptive dialog/drawer và focus handling, chuyển exercise detail/confirm trước | Back/Escape/locked/nested modal/focus return đúng; không che controls |
| 3 — lịch và nhật ký | Plan/RoutineEdit layout desktop, History list-detail, Library filter-detail | Chọn/chỉnh buổi, reorder, thêm bài, xem/sửa buổi cũ không sai dữ liệu |
| 4 — workout workspace | Tách view khỏi handlers hiện có, bố trí sets/history/timer, active-session bar | Superset/timed set/RIR/units/keyboard/resume/save/discard/backfill pass |
| 5 — Buddy workspace | Rail theo context, chat route wide, intake, proposal cạnh chat | Một nguồn chat/job; không mất draft, không double polling, duyệt trước khi áp dụng |
| 6 — stats/settings và polish | Dashboard chart, Measurements, Settings hai cột, i18n/motion/a11y | Keyboard, contrast, reduced motion, sáng/tối và viewport matrix pass |
| 7 — đóng refactor | Review diff, regression cần thiết, Docker build, render/screenshots trước-sau | Source và container khớp, có báo cáo thay đổi và giới hạn |

Mỗi đợt là thay đổi có thể review và chạy riêng. Không đổi schema và business rules cùng lúc với shell trừ khi có yêu cầu độc lập và test cho thay đổi đó.

## 9. Kiểm chứng và nghiệm thu

### Visual/layout

- Viewports: 375×812, 768×1024, 1024×768, 1280×800, 1366×768, 1440×900 và 1920×1080; thêm landscape mobile.
- Desktop đủ rộng có sidebar và nội dung tận dụng diện tích; Home/Plan không còn bị `.narrow` 640 px khóa toàn bộ workspace.
- Không horizontal scroll toàn trang; bảng rộng chỉ cuộn trong container của nó.
- Nội dung không nằm dưới sidebar/header/rail/timer/composer; kiểm tra zoom 200% và focus không bị che.
- Font body 14–16 px, thông tin quan trọng không phụ thuộc caption quá nhỏ. Text contrast >=4.5:1, control/focus >=3:1.
- Có render sáng/tối và reduced motion; không dùng màu làm dấu hiệu duy nhất.

### Functional

- Navigation back/forward, deep link, chuyển trang trong lúc có modal, dữ liệu giữ sau reload.
- Start/Resume giữ session, thứ tự bài và timer; đổi kích thước không remount logic phiên tập.
- Rotation không reset theo tuần; week mode vẫn hoạt động.
- Reorder/superset giữ liên kết; undo vẫn khôi phục đúng.
- Sửa saved workout không đổi ngày/thời lượng ngoài yêu cầu; lịch sử đọc lại đúng.
- Input kg/lb, each/total/per-side, time/cardio và RIR/RPE đúng trước và sau đổi layout.
- Chat có nháp, pending/error/stale states; đóng rail không hủy job; mở full page không gọi lại job.
- Dữ liệu thiếu là empty state, không tính thành zero thành tích; offline/sync error hiện đúng.
- Preview/testing dùng dữ liệu fixture hoặc môi trường cô lập, không tạo workout/test weights vào hồ sơ thật.

### Bộ kiểm tra liên quan

- Shell/navigation: `App.scroll.test.jsx`, `App.no-tabs.test.js`, `TabBar.test.jsx` và kiểm tra sidebar mới.
- Modal: `Modals.test.jsx`, các test sheet-scroll/keyboard; thêm assertion focus và adaptive presentation khi behavior thay đổi.
- Plan: rotation/day-rows, routine reorder/undo/add/superset.
- Workout: keys, holds, supersets, swipe, sheet-scroll, edit/save/backfill, rest timer.
- Coach: intake/chat/fast-failure/refusal, apply/revert/stale trong `lib/coach`.
- Sync: regression store/adoption/restore khi extraction đụng luồng persistence.
- Production build Node 22 theo Dockerfile. Chạy lint/locale/build checks repo yêu cầu; chọn test theo phần đã sửa, mở rộng nếu gặp lỗi hoặc thay business logic.

Không hứa một ngưỡng hiệu năng tùy ý: ghi baseline bundle, số request/poller, trace input/timer trước-sau. Không có regression rõ khi gõ, nhập hiệp hoặc timer cập nhật; dữ liệu lớn cần kiểm tra bằng fixture.

## 10. Phạm vi và rủi ro cần kiểm soát

- Ưu tiên refactor frontend. Backend, auth single user, file JSON và API contract tiếp tục dùng hiện có.
- Chưa bao gồm kết nối provider AI, xây RAG, thay thuật toán tập, tạo hồ sơ tuổi/chiều cao mới hoặc sửa toàn bộ kiến thức chuyên môn.
- Chưa thêm thư viện table/calendar/chart lớn; dùng baseline để quyết định nếu component tự có không đủ.
- Rủi ro lớn nhất: overlay history/body lock, workout scroll anchor/keyboard/timer, duplicate coach polling và cascade CSS. Mỗi phần cần test riêng trước khi thay rộng.
- Khuyến nghị bắt đầu bằng shell + Home ở đợt 1, render desktop/mobile để kiểm tra hướng thị giác, sau đó áp vào planner/nhật ký. Không chỉ làm lại Home rồi coi toàn bộ app đã web-friendly.

## 11. Deliverables

1. Desktop/mobile wireframe và token map.
2. Application shell dùng chung, navigation responsive.
3. Planner/history/library/workout layouts theo từng đợt.
4. Buddy rail + workspace chat và các trạng thái thực tế.
5. Adaptive overlays có keyboard/focus behavior.
6. Screenshots trước-sau, regression report, Docker chạy được từ source.

## 12. Nguồn khảo sát

- `frontend/src/App.jsx`, `components/TabBar.jsx`, `index.css`, `coach.css`.
- `views/Home.jsx`, `Plan.jsx`, `RoutineEdit.jsx`, `Workout.jsx`, `Stats.jsx`, `History.jsx`, `Library.jsx`, `Measurements.jsx`, `Settings.jsx`.
- `components/Modals.jsx`, `RestTimer.jsx`, `LineChart.jsx`, `ui.jsx`.
- `store/useStore.js`, `store/useUI.js`, `sheets.jsx`, `lib/mobile.js`, `lib/rotation.js`, `lib/session-edit.js` và các test liên quan.
- `views/CoachChat.jsx`, `CoachIntake.jsx`, `components/GymMascot.jsx`, `GymBuddyCard.jsx`, `lib/coach.js`, `lib/coach-api.js`.
- Repo `CLAUDE.md` (kiến trúc, dependency-light, training logic có pure helper/tests).
- Skills GSAP motion, Taste và UI/UX Pro Max đã đọc trong session. Search UI/UX cho sidebar/keyboard, dashboard và React composition; không áp phần marketing/landing trả về lệch bài toán vào product.


Implementation completed: see [the implementation and verification report](2026-10-16-desktop-web-refactor-completed.md).
