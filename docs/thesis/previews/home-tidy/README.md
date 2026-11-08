# Home and Buddy spacing refinement — 2026-10-16

- Stack check-in and streak in one desktop column; keep the weight chart in the adjacent wider column. Independent column heights prevent the chart from pushing streak down.
- Simplify Buddy to avatar, one heading/short contextual sentence, relevant session, one primary action and compact connection status. Connect AI opens setup for the admin; configured instances retain Chat with Buddy. Retain animation pause, mobile close and context navigation.
- Mobile preserves the compact cards and floating assistant entry.

Verification: 34 existing Home regression tests passed; production build passed; browser checks at 375, 768, 1280, 1440 and 1920 px, dark/light renders, no page exceptions or horizontal overflow. The desktop check-in/streak gap is 16 px. Interaction review blocks API writes to protect the real profile.

`home-1440.png` shows the updated full workspace; `buddy.png` shows the compact rail. `layout.json` records the browser measurements. The final screenshots are captured from http://localhost:8080.
