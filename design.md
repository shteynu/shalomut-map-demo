---
version: "alpha"
name: "Shalomut Map Demo"
description: "A school wellbeing platform design system featuring Hebrew RTL support, warm organic aesthetics, and interactive 'stone' layout structures."
colors:
  cream: "#fbf4dd"
  ink: "#383838"
  accent: "#e49902"
  accent-dark: "#9f6500"
  teal: "#05a4cd"
  navy: "#2d307e"
  success: "#24bf10"
  warning: "#e49902"
  danger: "#e43e5d"
  danger-surface: "#cf2c4e"
  on-danger: "#ffffff"
  pastel-ink: "#504936"
  success-ink: "#1e7b17"
  warning-ink: "#8a5800"
  danger-ink: "#a8203d"
  teal-surface: "#29b6dd"
  surface: "#fffaf0"
  surface-strong: "#fff5d6"
  surface-panel: "rgba(255, 250, 240, 0.88)"
  surface-panel-strong: "rgba(255, 250, 240, 0.96)"
  muted: "#6f674f"
  line: "#e6d9b7"
  border-soft: "rgba(56, 56, 56, 0.1)"
  pastel-yellow: "#fef1c7"
  pastel-lavender: "#e1e7ff"
  pastel-green: "#d4ebcf"
  pastel-mint: "#ccfbf1"
  pastel-peach: "#ffe1cc"
  pastel-sky: "#d6ecfb"
  pastel-pink: "#fde7f3"
  pastel-lilac: "#eee4fb"
typography:
  fontFamily: "Noto Sans Hebrew, Arial, system-ui, sans-serif"
  h1:
    fontSize: "clamp(2.4rem, 6vw, 5.2rem)"
    fontWeight: "800"
    lineHeight: "1.08"
  body:
    fontSize: "1.08rem"
    lineHeight: "1.8"
    color: "#383838"
  eyebrow:
    fontSize: "0.78rem"
    fontWeight: "800"
    color: "#9f6500"
rounded:
  default: "8px"
  control: "8px"
  panel: "14px"
  panel-organic: "18px 24px 16px 22px / 22px 16px 20px 18px"
  organic-mobile: "18px"
  pill: "999px"
  header: "24px 38px 24px 38px / 32px 24px 32px 24px"
  organic-stone:
    self-expression: "44% 56% 52% 48% / 48% 38% 62% 52%"
    professional-competence: "42% 58% 40% 60% / 47% 38% 62% 53%"
    social-resource: "36% 64% 40% 60% / 44% 34% 66% 56%"
    balance: "40% 60% 37% 63% / 44% 40% 60% 56%"
    management-support: "39% 61% 41% 59% / 48% 36% 64% 52%"
    certainty: "45% 55% 42% 58% / 36% 46% 54% 64%"
    organizational-climate: "42% 58% 38% 62% / 49% 39% 61% 51%"
    meaning: "44% 56% 40% 60% / 44% 34% 66% 56%"
spacing:
  container: "min(1180px, calc(100% - 2rem))"
  page-padding: "clamp(1.4rem, 3vw, 3.5rem) 0 4rem"
elevation:
  shadow: "0 6px 14px rgba(70, 56, 21, 0.08)"
  shadow-ambient: "0 4px 10px rgba(70, 56, 21, 0.07)"
  shadow-raised: "0 8px 18px rgba(70, 56, 21, 0.09)"
  shadow-stone: "0 14px 32px rgba(70, 56, 21, 0.12)"
zIndex:
  sticky: 20
  floating: 30
  popover: 80
  tooltip: 90
---

# Overview

The **Shalomut Map Demo** design language is structured around an **organic stone metaphor** representing the multi-dimensional aspects of school wellbeing (שלומות). Instead of rigid grids and industrial rectangles, this system uses hand-drawn, asymmetrical layouts that mirror natural elements—such as stones, pebbles, and soft gradients. 

This design system is implemented in a **Next.js** web application with **Tailwind CSS 4.0** and custom stylesheet values in `src/app/globals.css`.

### Key System Rationale
1. **Hebrew Right-to-Left (RTL):** The interface is designed exclusively for Hebrew readers (`dir="rtl"`). Navigation flow, chevron orientations, and text columns flow from right to left.
2. **The Wellbeing Stone Metaphor:** Wellbeing is not a rigid score; it is a stack of stones that can shift, move, and fit together in different ways. The interactive map allows users to drag, drop, and rearrange the stones to visualize how professional, social, and emotional factors co-exist.
3. **Soft, High-Contrast Palette:** The cream background (`#fbf4dd`) and ink text (`#383838`) are warm and highly readable. Warning colors (green, yellow, red) use curated, saturated HSL tones instead of default primary tones.
4. **Privacy-First Data Display:** High-fidelity tooltips explain the privacy thresholds. If fewer than 10 respondents participate, the map displays a locked state to protect individual anonymity.

---

# Colors

Colors are selected to balance high visual appeal with professional school dashboard expectations. They use a warm baseline rather than cold blue/gray tones.

| Token | CSS Variable | Hex Code | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `cream` | `--cream` | `#fbf4dd` | Global body background color. Warm, eye-friendly, paper-like. |
| `ink` | `--ink` | `#383838` | Primary text color, primary buttons, and heavy borders. |
| `accent` | `--accent` | `#e49902` | Highlights, hover states, brand symbols, and secondary outlines. |
| `accent-dark`| `--accent-dark`| `#9f6500` | High-contrast text labels (like eyebrows) over light backgrounds. |
| `teal` | `--teal` | `#05a4cd` | Special indicator color, informative tooltips, and secondary highlights. |
| `navy` | `--navy` | `#2d307e` | Secondary brand focus color, solid icons, or active filters. |
| `surface` | `--surface` | `#fffaf0` | Card background, input backgrounds, and form panel bodies. |
| `surface-strong`| `--surface-strong`| `#fff5d6`| Highlighted alert cards, banner bands, or focused form blocks. |
| `surface-panel` | `--surface-panel` | `rgba(255, 250, 240, 0.88)` | Standard product panels where the task should stay quiet. |
| `surface-panel-strong` | `--surface-panel-strong` | `rgba(255, 250, 240, 0.96)` | Compact rows and repeated editable items. |
| `muted` | `--muted` | `#383838` | Secondary text, helper labels, captions, and descriptions. |
| `line` | `--line` | `#e6d9b7` | Subtle borders, section dividers, and grid lines. |
| `border-soft` | `--border-soft` | `rgba(56, 56, 56, 0.1)` | Product-panel border that pairs with low elevation. |
| `success` | `--green` | `#24bf10` | Green stone status (Score 75+): "הכל טוב" (Everything is fine). |
| `warning` | `--yellow` | `#e49902` | Yellow stone status (Score 50-74): "מצב סביר" (Fair / Needs attention). |
| `danger` | `--red` | `#e43e5d` | Red stone status (Score <50): "נדרש טיפול מיידי" (Requires immediate action). |

### Accessibility Guidance
- Always pair text written in `{colors.ink}` with backgrounds in `{colors.cream}` or `{colors.surface}` to achieve a WCAG AA contrast ratio of over 7:1.
- Saturated status colors `success` (#24bf10) and `warning` (#e49902) must be paired with `{colors.ink}` text (measured 4.7:1 and 4.9:1). White text fails WCAG AA on them.
- The bright `danger` (#e43e5d) passes AA with **neither** ink (2.85:1) nor white (4.1:1). Any red surface that carries text uses `danger-surface` (#cf2c4e) with `on-danger` white text (5.1:1). Bright `danger` is reserved for non-text accents (dots, borders).
- Teal surfaces that carry text use `teal-surface` (#29b6dd) with ink (4.9:1); the brand `teal` (#05a4cd) with ink is only 4.0:1 and stays non-text.

---

# Typography

The font scale is tailored for Hebrew letters, which have a blockier, wider form factor than Latin characters. 

* **Font Stack:** `"Noto Sans Hebrew", "Arial", system-ui, sans-serif`
* **Text Flow:** `dir="rtl"` (Right-to-Left).
* **Headings:** Large headings use ultra-bold weights (`800`) with line-height `1.12` — Hebrew ascenders (lamed) and final-letter descenders collide below ~1.1, so tighter values are forbidden.

### Type scale

* **Hero H1:** `clamp(2.4rem, 6vw, 5.2rem)` | weight: `800` | line-height: `1.08`
  * *Usage:* Screen intros, page headers.
* **Section H2:** `clamp(1.4rem, 3vw, 1.8rem)` | weight: `800` | line-height: `1.12`
  * *Usage:* Card headers, main layout sub-headings.
* **Component H3:** `clamp(1rem, 1.5vw, 1.15rem)` | weight: `800` | line-height: `1.12`
  * *Usage:* Form sections, card subtitles, recommendation headings.
* **Body Text:** `1.08rem` | weight: `400` | line-height: `1.8` | color: `{colors.muted}`
  * *Usage:* Long paragraphs, summaries, descriptions.
* **Eyebrows / Kickers:** `0.78rem` | weight: `800` | line-height: `1.0` | color: `{colors.accent-dark}`
  * *Usage:* Small categorizing labels above main titles. Never uppercase and never letter-spaced — both are dead styles in Hebrew.

---

# Layout & Spacing

Layout structures support responsive viewport sizes and adapt dynamically using fluid metrics.

### Grids & Alignments
1. **Container Width:** Standard pages are restricted to `min(1180px, calc(100% - 2rem))` and centered using `margin: 0 auto`.
2. **Page Intro:** Uses a grid-like alignment with two columns on desktop (`grid-template-columns: minmax(0, 1fr) auto`) to push actionable links to the left and title content to the right (RTL).
3. **Metric Grid:** 4-column desktop grid collapsing into 2 columns on tablets, and 1 column on mobile devices.
4. **Workflow Grid:** 4-column flow grid for steps, using `{colors.surface}` background cards with hover micro-animations (`transform: translateY(-2px)`).
5. **Form Grid:** 2-column input fields for demographic entries (sickness days, socio-economic index, number of students).

---

# Shapes

The signature element of the design system is the **asymmetric rounded shapes**, giving panels and cards an organic look.

### Border-Radius Rules
- **Controls:** Buttons, inputs, compact rows, and editable survey rows use `--radius-control` (`8px`) or `--radius-panel` (`14px`). These product surfaces should feel familiar and efficient.
- **Product Panels:** Admin panels use `--radius-panel-organic` (`18px 24px 16px 22px / 22px 16px 20px 18px`) when they need the Shalomut tone without becoming stones.
- **Headers / Feature Panels:** Large feature panels and headers may use the stronger header radius:
  ```css
  border-radius: 24px 38px 24px 38px / 32px 24px 32px 24px;
  ```
- **Stone Blobs:** The interactive map "stones" use extreme percentage values to create irregular oval-like shapes:
  - *Example (Self-Expression Stone):* `border-radius: 44% 56% 52% 48% / 48% 38% 62% 52%`
  - *Example (Social Resource Stone):* `border-radius: 36% 64% 40% 60% / 44% 34% 66% 56%`

### Elevation Rules
- Ordinary product panels pair a soft border with `--shadow` or `--shadow-ambient`; do not combine `1px` borders with wide decorative blur.
- Signature stones, dashboard blobs, and floating stat pebbles may use `--shadow-stone` because they are the product metaphor, not standard cards.
- Semantic stacking is tokenized: `--z-sticky`, `--z-floating`, `--z-popover`, and `--z-tooltip`. Avoid arbitrary values such as `9999`.

---

# Components

### 1. Site Header (`.site-header`)
A sticky navigation bar that acts as the entry shell.
* **Structure:** Logo mark on the right (RTL), navigation link items on the left.
* **Styling:** 
  * Background: `rgba(251, 244, 221, 0.94)` (translucent cream)
  * Backdrop filter: `blur(16px)`
  * Border: `1px solid rgba(56, 56, 56, 0.1)`
  * Shape: `{rounded.header}`
  * Box Shadow: `0 14px 34px rgba(56, 56, 56, 0.08)`

### 2. Metric Card (`.metric-card`)
Displays key performance/privacy metrics.
* **Structure:** Bold metric score (`strong`), label name (`span`), and sub-text helper (`small`).
* **Interactive Tooltip:** Cards with a "סף פרטיות" (Privacy threshold) label contain a custom tooltip icon (`.custom-tooltip-icon`) that shows detailed explanations on hover/focus about data anonymization.
* **Colors:** Uses variant styling:
  * `.stone-variant-navy`: Navy text background with light overlays.
  * `.stone-variant-teal`: Teal highlight outline.
  * `.stone-variant-red`: Danger red highlight.
  * `.stone-variant-green`: Success green highlight.

### 3. Interactive Map Stone (`.dashboard-map-blob`)
An interactive component rendered inside the map canvas (dotted-paper background).
* **Properties:**
  * Draggable by cursor/touch on desktop viewports; a reset button appears once the layout is customized.
  * Uses CSS variables `--drag-x` and `--drag-y` to persist offsets via local storage.
  * Positioned absolutely on the map canvas using one of three soft status surfaces: green, yellow, or red/pink.
  * Status is carried both by the stone surface and by a small `.status-dot` plus explicit status label, so the map does not rely on color alone.
  * Rotated slightly to mimic scattered stones; shows dimension icon, name, and score (`NN%`).
  * Renders a small plus symbol (`+`) as an invite to click through to the dimension page.

### 4. Stat Stone (`.stat-stone`) & Action Card (`.action-card`)
Dashboard home building blocks.
* **Stat Stone:** pastel pebble (`organic-shape-1..4`) with a large value, label, and helper; floats gently (`gentle-float`, 4.5s ease-in-out, staggered delays; paused and lifted on hover, fully disabled under `prefers-reduced-motion`).
* **Action Card:** surface card with icon circle, copy, «מעבר למסך» link, and a blurred pastel glow blob behind the leading corner.

### 5. Score Ring (`ScoreRing`)
SVG progress ring for the overall wellbeing score: navy track at 18% opacity, teal fill, sweeps counter-clockwise from 12 o'clock (RTL reading direction).

### 6. Survey Answer Stones (`.answer-stone`)
The respondent survey shows one question per screen with three large answer stones: pastel fill + status-colored border + face icon (Smile / Meh / Frown). Selection auto-advances after 260ms; the previous-question button lets respondents revise.

### 7. Survey Builder (`.survey-builder-*`)
The admin builder keeps the full 8-dimension / 24-question model but presents questions through dimension filter pills. Summary metric stones retain the organic metaphor; repeated editable question rows use compact product-panel geometry and icon actions with accessible labels/tooltips.

### 8. Dashboard Detail Suite
Dimension detail, metrics, and recommendations stay fullscreen and no-header. Metrics display a label chip plus primary/secondary visual emphasis. Recommendations use priority chips ("יעד ראשון", "יעד 2"...) so principals can identify the next action without relying on shape or color alone.

---

# Do's and Don'ts

### Do:
- **Do** align all text layouts to the right (`text-align: right`) and ensure arrows point left for forwarding movements (`←` or Lucide `<ArrowLeft />`).
- **Do** use organic border-radius values (`border-radius: 24px 38px 24px 38px / 32px 24px 32px 24px`) for card and container modules.
- **Do** reserve extreme organic radii for stones/blobs and use the quieter panel/control radii for forms, rows, and repeated admin items.
- **Do** use semantic z-index tokens for sticky headers, floating map controls, popovers, and tooltips.
- **Do** enforce privacy thresholds. When building views that display data, verify if the response count is below the minimum threshold before displaying results.

### Don't:
- **Don't** use standard Tailwind CSS gray-scales (such as `bg-gray-100`, `text-gray-900`). Always map to `{colors.cream}`, `{colors.surface}`, `{colors.muted}`, or `{colors.ink}`.
- **Don't** align components strictly to clean rectangular grids on the wellbeing dashboard. The wellbeing map must look scattered, organic, and hand-placed.
- **Don't** use animations with heavy spring metrics. Keep transitions smooth and subtle (`transition: transform 150ms ease`).
- **Don't** pair soft 1px borders with wide decorative shadows on standard product panels.
- **Don't** use arbitrary z-index values like `9999`; add or reuse a semantic stacking token.
