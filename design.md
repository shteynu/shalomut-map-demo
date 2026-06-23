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
  surface: "#fffaf0"
  surface-strong: "#fff5d6"
  muted: "#6f674f"
  line: "#e6d9b7"
typography:
  fontFamily: "Arial, Noto Sans Hebrew, system-ui, sans-serif"
  h1:
    fontSize: "clamp(2.4rem, 6vw, 5.2rem)"
    fontWeight: "800"
    lineHeight: "0.95"
  body:
    fontSize: "1.08rem"
    lineHeight: "1.8"
    color: "#6f674f"
  eyebrow:
    fontSize: "0.82rem"
    fontWeight: "800"
    color: "#9f6500"
rounded:
  default: "8px"
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
| `muted` | `--muted` | `#6f674f` | Secondary text, helper labels, captions, and descriptions. |
| `line` | `--line` | `#e6d9b7` | Subtle borders, section dividers, and grid lines. |
| `success` | `--green` | `#24bf10` | Green stone status (Score 75+): "הכל טוב" (Everything is fine). |
| `warning` | `--yellow` | `#e49902` | Yellow stone status (Score 50-74): "מצב סביר" (Fair / Needs attention). |
| `danger` | `--red` | `#e43e5d` | Red stone status (Score <50): "נדרש טיפול מיידי" (Requires immediate action). |

### Accessibility Guidance
- Always pair text written in `{colors.ink}` with backgrounds in `{colors.cream}` or `{colors.surface}` to achieve a WCAG AA contrast ratio of over 7:1.
- Saturated status colors (`success`, `warning`, `danger`) should be used as background blobs with high-contrast text (`#ffffff` or `{colors.ink}`) layered on top.

---

# Typography

The font scale is tailored for Hebrew letters, which have a blockier, wider form factor than Latin characters. 

* **Font Stack:** `"Arial", "Noto Sans Hebrew", system-ui, sans-serif`
* **Text Flow:** `dir="rtl"` (Right-to-Left).
* **Headings:** Large headings use ultra-bold weights (`800`) and very tight line-heights (`0.95` to `1.05`) to create a modern, compressed layout.

### Type scale

* **Hero H1:** `clamp(2.4rem, 6vw, 5.2rem)` | weight: `800` | line-height: `0.95`
  * *Usage:* Screen intros, page headers.
* **Section H2:** `clamp(1.8rem, 4vw, 2.5rem)` | weight: `700` | line-height: `1.1`
  * *Usage:* Card headers, main layout sub-headings.
* **Component H3:** `1.25rem` | weight: `700` | line-height: `1.2`
  * *Usage:* Form sections, card subtitles.
* **Body Text:** `1.08rem` | weight: `400` | line-height: `1.8` | color: `{colors.muted}`
  * *Usage:* Long paragraphs, summaries, descriptions.
* **Eyebrows / Kickers:** `0.82rem` | weight: `800` | line-height: `1.0` | color: `{colors.accent-dark}`
  * *Usage:* Small categorizing labels placed directly above main titles.

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
- **Standard Cards / Headers:** Rather than standard circular borders, cards use a skewed border-radius using the slash (`/`) CSS shorthand to define horizontal and vertical radii independently:
  ```css
  border-radius: 24px 38px 24px 38px / 32px 24px 32px 24px;
  ```
- **Stone Blobs:** The interactive map "stones" use extreme percentage values to create irregular oval-like shapes:
  - *Example (Self-Expression Stone):* `border-radius: 44% 56% 52% 48% / 48% 38% 62% 52%`
  - *Example (Social Resource Stone):* `border-radius: 36% 64% 40% 60% / 44% 34% 66% 56%`

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
An interactive component rendered inside the map canvas.
* **Properties:**
  * Draggable by cursor/touch on desktop viewports.
  * Uses CSS variables `--drag-x` and `--drag-y` to persist offsets via local storage.
  * Positioned absolutely on the map canvas using `{colors.success}`, `{colors.warning}`, or `{colors.danger}` backgrounds.
  * Rotated slightly to mimic scattered stones.
  * Renders a large plus symbol (`+`) inside as an invite to click.
  * Houses a labels section: Bold Dimension Title + Subtitle + Status text.

---

# Do's and Don'ts

### Do:
- **Do** align all text layouts to the right (`text-align: right`) and ensure arrows point left for forwarding movements (`←` or Lucide `<ArrowLeft />`).
- **Do** use organic border-radius values (`border-radius: 24px 38px 24px 38px / 32px 24px 32px 24px`) for card and container modules.
- **Do** enforce privacy thresholds. When building views that display data, verify if the response count is below the minimum threshold before displaying results.

### Don't:
- **Don't** use standard Tailwind CSS gray-scales (such as `bg-gray-100`, `text-gray-900`). Always map to `{colors.cream}`, `{colors.surface}`, `{colors.muted}`, or `{colors.ink}`.
- **Don't** align components strictly to clean rectangular grids on the wellbeing dashboard. The wellbeing map must look scattered, organic, and hand-placed.
- **Don't** use animations with heavy spring metrics. Keep transitions smooth and subtle (`transition: transform 150ms ease`).
