# GymBuddy — light theme and branding

UI/UX Pro Max was applied using its targeted `light mode text contrast` UX search: dark text on light surfaces, distinguishable surfaces, and a minimum 4.5:1 contrast for body text.

- Soft off-white page, white navigation/cards, green-gray borders, dark green text, a darker chart accent and readable text actions. Existing accent choices remain supported.
- A 44×44 sun/moon control in the desktop header and mobile Home header uses the existing persisted theme preference. Settings retains Light / Dark / System. The saved theme is applied before first paint; browser zoom remains enabled.
- Display name is exactly **GymBuddy** in the application shell, bot, browser title, login/onboarding, app version and PWA manifest. Upstream source attribution and the required media licence wording remain in About.
- 55 focused regression tests passed; production Docker build passed. Browser verification covers seven routes, five viewport sizes, desktop/mobile toggling, reload persistence and OS-controlled System mode.
- Measured contrast: heading 13.96:1, secondary text 6.14:1, Buddy text 6.61:1, text action 5.40:1, primary button 9.46:1. No browser exceptions or document overflow in the checked cases.
- Browser tests intercept preference writes and use an isolated profile copy; the real profile theme was not changed by the tests.

`home-1440.png` is the light-theme overview. `verification.json` contains the checks and measured contrast values. Final screenshots are captured from http://localhost:8080.
