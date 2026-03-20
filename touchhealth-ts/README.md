# Touch Health · DM/HTN NCD Management System

A clinical dashboard for managing Diabetes and Hypertension patients in Tanzania, built for the Touch Health NCD Programme (Bukoba Municipal Council, Kagera Region).

---

## Features

- **Patient Registration** — Auto-generated unique patient codes (`KG-BK-ZMZ-M0001`)
- **Visit Recording** — BP, glucose, BMI, medications, clinical notes
- **HbA1c Tracker** — Quarterly monitoring for DM/DM+HTN patients (WHO NCD STG 2017)
- **Clinic Schedule** — 30-day max interval with clinic-day snapping
- **LTFU Tracing** — Lost-to-follow-up detection and contact management
- **SMS Reminders** — Africa's Talking / Twilio integration for Tanzania networks
- **Drug Supply** — Stockout flagging per facility, admin supply overview
- **DHIS2 Export** — De-identified aggregate CSV/JSON for Tanzania national HMIS
- **Admin Dashboard** — Programme-wide analytics, doctor performance, user management
- **Offline-first** — Works fully without internet; sync when connected

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open browser
# http://localhost:3000
```

### Default Login Credentials

| Role  | Username       | Password   |
|-------|---------------|------------|
| Admin | `admin`        | `admin123` |
| Admin | `alexalpha360` | `admin123` |

> **Important:** Change default passwords immediately in production.

---

## Project Structure

```
touchhealth-ts/
├── src/
│   ├── types/
│   │   └── index.ts          # All TypeScript interfaces & types
│   ├── services/
│   │   ├── clinical.ts       # BP, glucose, HbA1c classification; clinic scheduling
│   │   ├── auth.ts           # Login, session, user/hospital management
│   │   ├── patients.ts       # Patient CRUD, visit recording, auto-code generation
│   │   ├── storage.ts        # localStorage wrapper
│   │   ├── sms.ts            # SMS queue and sending (Africa's Talking / Twilio)
│   │   └── dhis2.ts          # Aggregate export for Tanzania DHIS2
│   ├── store/
│   │   ├── usePatientStore.ts # Zustand — patient state & actions
│   │   ├── useAuthStore.ts    # Zustand — auth & session
│   │   ├── useUIStore.ts      # Zustand — navigation, modals, clinic settings
│   │   └── index.ts          # Barrel export
│   ├── components/           # Reusable UI components (add here)
│   ├── pages/                # Page components (add here)
│   ├── App.tsx               # Root — auth gate, store init
│   ├── main.tsx              # React entry point
│   └── index.css             # Tailwind base + CSS variables
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── postcss.config.js
```

---

## Patient Code Format

```
KG - BK - ZMZ - M0001
│     │     │    │ │
│     │     │    │ └── Sequence (0001, 0002…)
│     │     │    └──── Gender (M = Male, F = Female)
│     │     └───────── Hospital prefix (3 chars)
│     └─────────────── District prefix (2 chars)
└───────────────────── Region prefix (2 chars)
```

Sequence is unique per location + gender combination. Collision-safe.

---

## Clinical Thresholds

### Blood Pressure (WHO ISH 2023 · Tanzania NCD STG)
| Grade | SBP | DBP | Action |
|-------|-----|-----|--------|
| Normal | <120 | <80 | No intervention |
| High-Normal | <140 | <90 | Lifestyle modification |
| Grade 1 | <160 | <100 | Consider pharmacotherapy |
| Grade 2 | <180 | <110 | Drug treatment indicated |
| Grade 3 | ≥180 | ≥110 | **URGENT** |

### HbA1c (Tanzania NCD STG 2017)
| Level | Value | Status |
|-------|-------|--------|
| Normal | <5.7% | No diabetes |
| Pre-diabetes | 5.7–6.5% | Lifestyle intervention |
| DM Excellent | <7.0% | Maintain therapy |
| **DM At Target** | **<8.0%** | **Continue therapy** |
| Above Target | 8.0–9.0% | Intensify |
| Poor Control | 9.0–10.0% | Intensify urgently |
| Danger Zone | >10.0% | **Urgent review** |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 6 |
| State | Zustand 5 |
| Forms | React Hook Form + Zod |
| Charts | Chart.js 4 + react-chartjs-2 |
| Styling | Tailwind CSS 3 |
| Dates | date-fns 4 |
| Storage | localStorage (offline-first) |

---

## Production Roadmap

- [ ] Replace `localStorage` with Supabase / Firebase for multi-device sync
- [ ] Hash passwords with bcrypt (currently plain text)
- [ ] Add SMS backend proxy for Africa's Talking CORS compliance
- [ ] Connect DHIS2 export to `https://dhis2.moh.go.tz/api/dataValueSets`
- [ ] Add CHW (Community Health Worker) role
- [ ] USSD integration for feature phone patients

---

## Tanzania Context

- **Networks supported:** Vodacom, Airtel, Tigo, Halotel, TTCL
- **Regions covered:** All 17 mainland regions + Zanzibar West
- **DHIS2 schema:** Compatible with Tanzania national HMIS (dhis2.moh.go.tz)
- **Guidelines:** Tanzania NCD Standard Treatment Guidelines 2017, WHO ISH 2023

---

## License

Touch Health NCD Programme · Bukoba Municipal Council · Tanzania  
Built with ❤️ for rural and urban NCD care.
