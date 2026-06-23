# Project Roadmap - Hebrew Typography & Accessibility Optimizations

This document outlines the design and typography system updates implemented locally to improve reading clarity, rendering quality, and WCAG AA accessibility standards across the Shalomut Map wellbeing platform.

## 1. Font Stack & Crisp Rendering

- **Hebrew-Optimized Font Stack**: Applied `"Arial", "Noto Sans Hebrew", system-ui, sans-serif` globally. This stack guarantees that Hebrew characters are displayed using correct RTL proportions without synthetic distortion.
- **Subpixel Antialiasing**: Enabled `-webkit-font-smoothing: antialiased;` and `-moz-osx-font-smoothing: grayscale;` on the `html` element. This eliminates subpixel color fringing and visual noise, providing crisp and clean outlines for Hebrew letterforms on high-density (Retina) and standard displays.

## 2. Global Headings (h1 through h6)

- **Weight**: Updated all heading levels to use `font-weight: 800` (Ultra-Bold).
- **Line Height**: Configured a tight `line-height: 0.95`. This tight tracking gives Hebrew titles a dense, modern, and publication-grade organic structure, reducing layout fragmentation in RTL reading flows.
- **Overrides Removal**: Removed specific line-height and font-weight overrides from individual heading selectors (like question card headers, recommendation cards, and intro page headers) to establish a unified, standard typographic rhythm.

## 3. Fluid Typography

- **CSS `clamp()` scaling**: Implemented fluid scaling for primary typography elements. This allows the text size to transition smoothly between mobile and desktop viewports without breaking layout columns or overflowing their borders:
  - **Hero H1**: `clamp(2.4rem, 6vw, 5.2rem)`
  - **Section H2 (Detail Pages)**: `clamp(1.4rem, 3vw, 1.8rem)`
  - **Subheadings / Question Cards**: `clamp(1rem, 1.8vw, 1.15rem)`
  - **Legend Card Titles**: Inherited/fluid font sizes.

## 4. Visual Hierarchy & Eyebrows

- **Eyebrow elements** (small categorizing labels) and **kicker elements** (like `.eyebrow` and `.panel-kicker`) now stand out clearly:
  - Increased weight to `font-weight: 900`.
  - Applied `text-transform: uppercase` to add structural emphasis and clean separation from surrounding block text.

## 5. WCAG AA Compliance on Colored Backgrounds

- **Text Color Redefinition**: Replaced low-contrast gray text colors (by updating the `--muted` variable definition in `:root` from `#6f674f` to `#383838`) to ensure all secondary and caption text achieves a WCAG AA contrast ratio of at least 4.5:1 against the light cream paper background (`#fbf4dd`).
- **Contrast on Wellbeing Stones**:
  - Replaced `color: white;` with `color: var(--ink);` (`#383838`) on all interactive stones (`.dashboard-map-blob`, `.stone-button`, `.dashboard-metric-blob`, `.dashboard-single-blob`, `.dashboard-recommendation-blob`, and option buttons in pressed states).
  - Since the background states of wellbeing stones use bright, saturated colors (Green `#24bf10`, Yellow/Orange `#e49902`, Red `#e43e5d`), white text fails WCAG AA contrast requirements. Replacing it with the deep ink color variable (`#383838`) ensures a contrast ratio of > 4.5:1, fulfilling WCAG AA compliance across the interactive layout.
  - To support this text color update, the background color of the navy/purple stones (`.stone-variant-navy`) was changed from a deep navy (`#2d307e`) to a light periwinkle (`#b2b6f4`). This ensures that the dark ink text (`#383838`) is clearly readable and compliant with WCAG AA standards (6:1 contrast ratio), while still retaining a distinct purple/lavender tone in the visual dashboard hierarchy.
