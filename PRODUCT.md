# Product

## Register

product

## Users

School principals, wellbeing coordinators, and district supervisors in Hebrew-speaking (Israeli) schools. They use the platform during the school day, on desktop in the office and occasionally on mobile, to review staff wellbeing survey results, set up new survey rounds, and decide where to act. Teachers answer the wellbeing surveys themselves on their own devices. All primary users read Hebrew; the interface is RTL-first (`dir="rtl"`), with a secondary English (LTR) variant.

## Product Purpose

"Shalomut Map" (מפת שלומות) visualizes multi-dimensional school-staff wellbeing as an interactive map of organic "stones" — one per wellbeing dimension (self-expression, professional competence, social resources, balance, management support, certainty, organizational climate, meaning). Each stone carries a status color (green ≥75, yellow 50–74, red <50). Success means a principal can read the school's wellbeing state at a glance, trust that individual anonymity is protected (privacy threshold: results lock below 10 respondents), and move to concrete goals/recommendations.

## Brand Personality

Warm, humane, trustworthy. The stone metaphor deliberately avoids clinical dashboard coldness: wellbeing is not a rigid score but stones that shift and fit together. Tone is supportive and goal-oriented, never alarmist — even "red" states are framed as areas needing care, not failures.

## Anti-references

- Cold corporate BI dashboards (default blue/gray Tableau/PowerBI look).
- Rigid rectangular card grids — the map must feel scattered, organic, hand-placed.
- Default Tailwind gray scales (`bg-gray-100`, `text-gray-900`) — always the warm token palette.
- Gamified/childish school-app aesthetics; the audience is school leadership.

## Design Principles

1. **RTL is the primary reality, not a translation** — layout, arrows, chevrons, and reading order are designed right-to-left first; the English version adapts from it.
2. **Privacy before insight** — never render data below the anonymity threshold; the locked state is a first-class, explained UI state.
3. **Organic over industrial** — asymmetric border-radii, scattered composition, subtle motion (`transform 150ms ease`, no heavy springs).
4. **Status must be readable without color** — ink text over status colors, explicit status labels (e.g. "נדרש טיפול מיידי"), not color alone.
5. **From picture to action** — every view should lead toward goals and recommendations, not just display metrics.

## Accessibility & Inclusion

WCAG AA target. Ink-on-cream body text aims for 7:1+ contrast. White text on the bright status colors is banned (fails AA); use ink instead. A dedicated high-contrast view exists for both desktop and mobile. Reduced-motion alternatives required for map/stone animations. Hebrew font stack (`Arial, Noto Sans Hebrew, system-ui`) chosen for Hebrew letterform readability.
