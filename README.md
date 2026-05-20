# MaiPal · 脉伴

Intelligent Traditional Chinese Medicine health-companion mobile app, built as a
**Capacitor.js** hybrid app (iOS / Android) on top of a Vite + React + TypeScript
web layer.

The visual language is the [`maipal-design-system`](https://github.com/MedTechLab/maipal-design-system)
— 千里江山图 (A Thousand Li of Rivers and Mountains) palette: sage-green
mineral pigments, gold-ochre accents, ink on warm xuan paper, the brush-kai
greeting font `ChillHuoKai` (寒蝉活楷).

## Stack

| Layer | Tech |
|---|---|
| Web UI | React 18 + TypeScript + Vite |
| Native shell | Capacitor 7 (iOS / Android) |
| Routing | react-router-dom v7 |
| Icons | lucide-react |
| Animation | CSS keyframes + `motion` (entry/breath/pulse) |
| Plugins wired | `@capacitor/status-bar`, `splash-screen`, `camera`, `keyboard`, `haptics`, `preferences`, `app` |

## Running the web layer

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle into dist/
```

## Running native (iOS / Android)

The native projects are not committed — they are scaffolded on demand by
Capacitor on a machine with Xcode (iOS) or Android Studio (Android) installed.

```bash
# one-time per platform
npm run cap:add:ios
npm run cap:add:android

# build the web bundle, then sync into the native projects
npm run build
npm run cap:sync

# open the native IDE
npm run cap:open:ios       # opens Xcode
npm run cap:open:android   # opens Android Studio

# or run directly (requires a connected device/simulator)
npm run cap:run:ios
npm run cap:run:android
```

The native config — bundle id, app name, splash colors, status-bar style — is
in `capacitor.config.ts`.

## App flow

`/` Splash (2s) → `/userinfo` (collect nickname, gender, age, concerns) →
`/app/chat` (chat with 脉医生) → on `需要检测`, the camera permission →
face observation → mic permission → voice listening flow runs and produces a
health report. From there the report and a 5-task daily plan are visible at
`/app/summary`, and the `/app/store` tab shows the food remedies and partner
Chinese-medicine clinic listings.

Permission modals mimic native iOS dialogs; in the future they'll back onto
`@capacitor/camera` and a microphone plugin so the real OS prompt fires.

## Source layout

```
src/
├── main.tsx                  router + StrictMode mount
├── App.tsx                   route table + status-bar setup
├── contexts/AppContext.tsx   user, messages, plan, points, modal orchestration
├── layouts/MainLayout.tsx    the 91px bottom tab bar with the sliding sage pill
├── pages/
│   ├── SplashScreen.tsx      gradient + 脉 glyph
│   ├── UserInfoPage.tsx      onboarding form
│   ├── ChatPage.tsx          floating bubbles over the doctor mascot
│   ├── SummaryPage.tsx       weekly calendar, report card, daily tasks
│   └── StorePage.tsx         药膳房 grid + 看医生 clinic list
├── components/
│   ├── ShanShuiBackground.tsx
│   ├── ShanShuiHeader.tsx
│   ├── ShiqingButton.tsx
│   ├── PointsPill.tsx
│   ├── SettingsTile.tsx
│   ├── QuickChip.tsx
│   └── modals/               PermissionModal, FaceObservationModal,
│                             VoiceListeningModal, ConfirmModal, ModalHost
└── styles/
    ├── tokens.css            CSS vars (matches maipal-design-system 1:1)
    └── app.css               base styles + animations + utility classes

public/
├── fonts/                    ChillHuoKai Regular / ConRegular / ConBold (.otf)
└── assets/                   bg-shanshui.png, doctor-maipal.png, products, clinics
```

## Brand guardrails (do not break)

- **Background:** every full-screen surface uses the shan-shui photo behind a
  paper-cream protection gradient. Cards float on top with a 1.18px
  `rgba(111,184,153,0.15)` hairline, 20px radius, and a soft drop shadow.
- **Brand H1:** `var(--font-brush)` (ChillHuoKai) in `--shiqing` (`#7b8c76`),
  with the `drop-shadow(0px 3px 3px rgba(0,0,0,0.12))` filter.
- **Primary button:** sage pill, white text, `box-shadow: 0 4px 6px rgba(123,140,118,0.2)`,
  press is `scale(0.95)`. No hover state (mobile-first).
- **Tone in Chinese is informal-respectful.** Doctor uses 你 in casual
  dialogue, 您 in moments of care. No exclamation marks except `获得 10 积分！`.
- **Emoji:** sparing — `😊` only on the doctor's "ok if not now" reply,
  onboarding-concern icons (`🍽️ 😴 🏃 🧘`), and empty-state placeholders.
  Never inside bubbles or buttons.

When in doubt, open the matching preview card in the design system repo or
read its `README.md` and `SKILL.md`.
