# Design Guidelines: Par for the Course Mini-Golf Scoring App

## Design Approach

**Primary Strategy:** Material Design principles adapted for sports utility
**Reference Inspiration:** Golf scoring apps (TheGrint, 18Birdies) for sport-specific patterns
**Core Philosophy:** Clarity and usability during active gameplay with high outdoor readability

## Design Principles

1. **Outdoor Readability:** High contrast ratios, bold typography, generous spacing
2. **One-Handed Operation:** Critical actions accessible with thumb reach zones
3. **Glanceable Information:** Key stats visible without scrolling
4. **Progressive Complexity:** Simple primary flows, advanced features tucked away
5. **Zero Distractions:** Minimal animations, focus on data clarity

---

## Typography System

**Font Family:** 
- Primary: Inter or Roboto (via Google Fonts CDN)
- Fallback: system-ui, -apple-system, sans-serif

**Type Scale:**
- Display (Scores): 72-96px, font-weight: 700-800
- Heading 1: 28-32px, font-weight: 700
- Heading 2: 20-24px, font-weight: 600
- Body Large: 18px, font-weight: 500
- Body: 16px, font-weight: 400
- Small/Meta: 14px, font-weight: 400
- Micro: 12px, font-weight: 400

**Hierarchy:**
- Player scores: Ultra-bold display type
- Hole numbers and stats: Bold headings
- Action buttons: 18px medium weight
- Secondary info: Regular weight with muted treatment

---

## Layout System

**Spacing Units:** Tailwind scale focused on 4, 6, 8, 12, 16, 24, 32
- Tight spacing: p-2, gap-2 (8px) for grouped controls
- Standard spacing: p-4, gap-4 (16px) for content sections
- Generous spacing: p-6, p-8 (24-32px) for screen padding
- Large spacing: py-12, py-16 for panel separation

**Container Strategy:**
- Mobile-first: Full width with px-4 padding
- Max-width: max-w-2xl for optimal readability (not needed on most screens)
- Safe areas: Account for notches/home indicators (pb-safe)

**Grid Patterns:**
- Player list: Single column, full width cards
- Stats display: 3-column grid (grid-cols-3) for Scratches/Strokes/Penalties
- Score controls: 2-column layout (score display + increment buttons)
- Box scores: Responsive tables with horizontal scroll

---

## Component Library

### Navigation
- **Bottom Tab Bar:** Fixed navigation with 4-5 primary sections (Game, Scores, Summary, Settings)
- Icons: Heroicons outline for inactive, solid for active states
- Height: 60px with safe-area padding
- Large touch targets: Full width tap zones

### Buttons
- **Primary Actions:** Min height 48px, rounded-lg, bold text
- **Score Increment/Decrement:** 72px tall, large type (28px), prominent positioning
- **Secondary Actions:** 44px tall, outline style or muted fill
- **Destructive Actions:** Red accent, outline style (Undo, End Game, Scratch)
- **Icon Buttons:** 44x44px minimum, clear labels or aria-labels

### Cards & Panels
- **Player Cards:** Rounded corners (rounded-xl), subtle shadow, color indicator (left border or chip)
- **Stat Cards:** Card-style with icon, label, and large numeric display
- **Full Screen Panels:** Slide-up animation for Settings, Scores, Summary
- **Close Controls:** Top-right X button, 44x44px minimum

### Form Elements
- **Text Inputs:** Height 48px, clear borders, large touch targets
- **Select Dropdowns:** Native styled, 48px height, clear labels
- **Color Pickers:** 36-40px circular chips with border indicating selection
- **Toggles:** Modern switch design, 60px wide, clear on/off states

### Data Display
- **Score Display:** Massive centered numerals (72-96px), color-coded relative to par
- **Stats Row:** 3-column grid with label above value
- **Tables:** Sticky headers, alternating row backgrounds, horizontal scroll on mobile
- **Leaderboard:** Card-based with prominent ranking, player name, and score

### Badges & Indicators
- **Leader Badge:** Crown/star icon next to current leader
- **Save Indicator:** Subtle toast/icon animation on auto-save
- **Status Messages:** Non-intrusive, auto-dismiss, top or bottom placement

---

## Visual Treatments

**Depth & Elevation:**
- Cards: Subtle shadow (shadow-sm to shadow-md)
- Floating navigation: Stronger shadow (shadow-lg)
- Modals/Panels: Overlay with backdrop blur

**Borders & Dividers:**
- Section dividers: 1-2px hairline, player color for active player context
- Card borders: 1px subtle borders or none with shadow
- Interactive borders: 2px on focus/active states

**States:**
- Disabled: 40% opacity, cursor-not-allowed
- Active/Selected: Bold border or background shift
- Focus: 3px outline, high contrast
- Pressed: Slight scale (scale-98) or brightness shift

---

## Responsive Behavior

**Breakpoints:**
- Mobile: Base styles (320px+)
- Tablet: md: (768px+) - 2-column layouts where appropriate
- Landscape: Optimize for thumb zones in landscape orientation

**Orientation-Specific:**
- Portrait: Vertical scrolling, bottom navigation
- Landscape: Consider horizontal score displays, split views for tables

**Touch Targets:**
- Minimum: 44x44px (iOS guidelines)
- Preferred: 48x48px for primary actions
- Generous spacing between adjacent buttons (min 8px gap)

---

## Accessibility

- **ARIA labels:** All icon-only buttons
- **Color independence:** Don't rely solely on color (use icons, text labels)
- **Contrast ratios:** WCAG AA minimum (4.5:1 for text)
- **Focus indicators:** Clear, high-contrast outlines
- **Screen reader:** Semantic HTML, proper heading hierarchy

---

## Theme Implementation

**Dark Theme (Default for outdoor use):**
- Background: Near-black (#0a0a0a to #1a1a1a)
- Surface: Slightly lighter (#1f1f1f to #2a2a2a)
- High contrast text for scores

**Light Theme (Optional):**
- Background: Off-white (#f5f5f5)
- Surface: White with subtle shadows
- Maintain contrast ratios

---

## Animations

**Minimal approach - use sparingly:**
- Screen transitions: 200-300ms ease
- Button feedback: Scale or opacity shifts (100-150ms)
- Save indicator: Fade in/out (400ms)
- **Avoid:** Continuous animations, score counting effects, unnecessary flourishes

---

## Images

**Logo/Branding:**
- Splash screen: Centered logo, max-width 280px on mobile
- In-game: Small logo in header if space permits (32-40px height)

**Icons:**
- Heroicons via CDN
- 20-24px standard size
- 28-32px for prominent actions

**No hero images needed** - this is a utility app focused on functionality.