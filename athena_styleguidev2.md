# Athena — Industrial Glass Design System
### v2.1 · Engineering & Architecture Handoff

> **Aesthetic Intent:** A clinical, high-fidelity interface blending Swiss typography with Precision Glass materials. Clarity, refraction, and structural depth over colorful gradients.

---

## Design Philosophy

Three principles that must be preserved across all components and pages.

**Material: Precision Glass**
Surfaces feel like frosted steel — neutral refraction, controlled blur, no color bleed. Use `backdrop-filter: blur()` paired with `saturate(180%)` for depth. Never colorful. Never decorative. The material communicates engineering grade, not consumer gloss.

**Hierarchy: Swiss Structure**
Layout is grid-based, typographically driven, and information-dense. Headers use large display type with absolute alignment and micro-labels for metadata. White space is structural — but earn it with content density, not padding.

**Depth via Mechanical Layers**
Elevation defined by neutral refraction tiers, not glows or gradients. Three glass tiers, each with tighter blur and higher fill opacity as Z-axis increases. Panels slide like physical shutters — no fade, no bounce.

---

## Typography

Two font families. No exceptions.

**Display / Headers:** `Inter Tight` — weight 700–900, tracking tighter than default. Falls back to `Inter` with `tracking-tighter` applied manually if `Inter Tight` unavailable.

**Body / UI:** `Inter` — reliable, neutral, legible at all sizes.

**Data / Code:** `JetBrains Mono` — use `.mono` class for all technical values: model IDs, VRAM, latency, tokens, file paths.

### Font Setup

```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;600;700;900&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-display: 'Inter Tight', 'Inter', -apple-system, sans-serif;
  --font-body:    'Inter', -apple-system, sans-serif;
  --font-mono:    'JetBrains Mono', 'Fira Code', monospace;
}

/* Tailwind config */
fontFamily: {
  display: ['Inter Tight', 'Inter', ...defaultTheme.fontFamily.sans],
  sans:    ['Inter', ...defaultTheme.fontFamily.sans],
  mono:    ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
}
```

### Type Scale

| Role | Tailwind Classes | Weight | Notes |
|------|-----------------|--------|-------|
| Display | `font-display text-6xl tracking-tighter leading-[0.9]` | 900 | Hero states, large data values only |
| Heading 1 | `font-display text-4xl font-bold tracking-tight` | 700 | Primary view headers |
| Heading 2 | `font-display text-2xl font-semibold tracking-tight` | 600 | Component / card headers |
| Heading 3 | `font-display text-lg font-semibold tracking-tight` | 600 | Section subheaders |
| Body | `font-sans text-base leading-relaxed` | 400 | Main content |
| Small / Caption | `font-sans text-xs text-muted-foreground` | 400 | Labels, metadata |
| Eyebrow | `font-sans text-[10px] font-bold tracking-[0.3em] uppercase opacity-50` | 700 | Pre-header context labels |
| Mono | `font-mono text-sm opacity-90` | 400 | LLM IDs, VRAM, RAM, latency |

### Swiss Header Pattern

Every major view uses this structure — eyebrow label, display title, no decorative elements:

```tsx
<header className="px-8 py-8 border-b border-white/5">
  <span className="font-sans text-[10px] font-bold tracking-[0.3em] uppercase opacity-50">
    Knowledge Base / Research
  </span>
  <h1 className="font-display text-5xl font-black tracking-tighter mt-2">
    Gradient Descent
  </h1>
</header>
```

---

## Color Tokens

All colors defined as HSL CSS variables. **Never use raw hex or rgb values in components.** Shift to a neutral grayscale base — single Optical Blue accent, used sparingly.

### Core Semantic Colors

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--background` | `240 10% 3.9%` | Deep charcoal — not pure black |
| `--foreground` | `0 0% 98%` | Off-white — not pure white |
| `--card` | `240 10% 6%` | Card surfaces |
| `--border` | `240 5% 20%` | Dividers and structural borders |
| `--muted` | `240 5% 15%` | Subtle backgrounds |
| `--muted-foreground` | `240 5% 55%` | Secondary text, captions |
| `--input` | `240 5% 18%` | Input borders |

```css
:root {
  --background:        240 10% 3.9%;
  --foreground:        0 0% 98%;
  --card:              240 10% 6%;
  --border:            240 5% 20%;
  --muted:             240 5% 15%;
  --muted-foreground:  240 5% 55%;
  --input:             240 5% 18%;
}
```

### Brand Colors

| Token | Name | Notes |
|-------|------|-------|
| `--primary` | Optical Blue `217 91% 60%` | Single accent — use sparingly |
| `--primary-foreground` | Off-white | Text on primary backgrounds |
| `--accent` | Emerald `142 71% 45%` | Success, confirmations, online |
| `--destructive` | Red `0 72% 51%` | Errors, destructive actions only |

### Glass Tokens

| Token | Usage |
|-------|-------|
| `--glass-bg` | Neutral glass surface fill |
| `--glass-border` | Glass edge — always with opacity |

---

## Precision Glass Utilities

**Neutral refraction only.** No colorful fills. No gradient tints. Three tiers based on Z-axis elevation — never mix tiers at the same level.

| Tier | Class | Blur | Fill Opacity | Border | Use Case |
|------|-------|------|-------------|--------|----------|
| L1 Subtle | `.glass-subtle` | 12px | 5% | `1px / 10%` | Inset wells, menu hovers, nested containers |
| L2 Base | `.glass` | 32px | 12% | `1px / 20%` | Default cards, main panels |
| L3 Focus | `.glass-strong` | 64px | 25% | `1px / 40%` | Sidebars, modals, sticky headers |

```css
.glass-subtle {
  background: hsl(var(--glass-bg) / 0.05);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid hsl(var(--glass-border) / 0.10);
}

.glass {
  background: hsl(var(--glass-bg) / 0.12);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  border: 1px solid hsl(var(--glass-border) / 0.20);
}

.glass-strong {
  background: hsl(var(--glass-bg) / 0.25);
  backdrop-filter: blur(64px) saturate(180%);
  -webkit-backdrop-filter: blur(64px) saturate(180%);
  border: 1px solid hsl(var(--glass-border) / 0.40);
}
```

### Hover Interaction — `.glass-hover`

No glow. No color shift. Scale and border contrast only:

```css
.glass-hover:hover {
  border-color: hsl(var(--border) / 1.0);  /* full opacity border */
  transform: scale(1.01);
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## Animations & Motion

**No float. No pulse glow. No bounce.** Mechanical transitions only. Fast springs, zero unnecessary movement.

### Spring Config (Framer Motion)

```tsx
// Use this spring for ALL interactive UI transitions
const tightSpring = {
  type: "spring",
  stiffness: 260,
  damping: 20
}

// Panel / shutter transitions — slide with no opacity fade
const shutterTransition = {
  type: "spring",
  stiffness: 300,
  damping: 30
}
```

### Transition Classes

| Class | Effect | Use Case |
|-------|--------|----------|
| `.animate-fade-up` | opacity 0→1, translateY 12px→0 | Page entry, content reveals |
| `.animate-scale-in` | scale 0.96→1, opacity 0→1 | Modals, cards, dropdowns |
| `.animate-shutter` | translateX slide, no opacity | Detail panels, side drawers |
| `.shimmer` | horizontal gradient sweep, looping | Skeleton loading placeholders |

**Removed:** `.animate-float`, `.animate-pulse-glow` — these add visual noise and signal consumer-grade rather than engineering-grade.

### CSS Implementation

```css
@keyframes fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes shimmer {
  from { background-position: -200% 0; }
  to   { background-position:  200% 0; }
}

.animate-fade-up  { animation: fade-up  200ms cubic-bezier(0.4, 0, 0.2, 1) forwards; }
.animate-scale-in { animation: scale-in 150ms cubic-bezier(0.4, 0, 0.2, 1) forwards; }

.shimmer {
  background: linear-gradient(90deg,
    hsl(var(--muted)) 25%,
    hsl(var(--muted-foreground) / 0.1) 50%,
    hsl(var(--muted)) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

---

## Components

### Buttons

Primary actions use **high-contrast white** — not glowing blue. One per view maximum.

| Variant | Class | Use Case |
|---------|-------|----------|
| Primary | `bg-foreground text-background font-semibold rounded-sm px-4 py-2` | Primary CTA — one per view max |
| Ghost Glass | `glass-subtle border border-border/40 rounded-sm px-4 py-2` | Secondary actions |
| Accent | `glass-subtle border border-accent/30 text-accent rounded-sm px-4 py-2` | Confirmations |
| Destructive | `glass-subtle border border-destructive/30 text-destructive rounded-sm` | Destructive actions |
| Disabled | `opacity-30 cursor-not-allowed` | Unavailable actions |

Note: `rounded-sm` (4px) replaces `rounded-full` for all buttons except status indicators.

```tsx
// Primary button — high contrast, no glow
<button className="
  bg-foreground text-background 
  font-display font-semibold text-sm tracking-tight
  rounded-sm px-4 py-2
  hover:opacity-90 
  transition-opacity duration-150
">
  Generate Quiz
</button>
```

---

### Chat Bubbles

Never center-align. User right, AI left. `rounded-2xl` retained for message bubbles only — conversational context justifies softer radius.

| Class | Style | Alignment |
|-------|-------|-----------|
| `.message-user` | `bg-primary text-primary-foreground rounded-2xl` | Right — `justify-end` |
| `.message-ai` | `glass-subtle border border-border/20 rounded-2xl` | Left — `justify-start` |

---

### Navigation Items

Sidebar nav. `rounded-sm` for architectural feel. Active state uses left border indicator, no background fill glow.

```css
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 4px;   /* rounded-sm */
  padding: 8px 12px;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-item:hover {
  background: hsl(var(--glass-bg) / 0.05);
  color: hsl(var(--foreground));
}

.nav-item.active {
  color: hsl(var(--foreground));
  border-left: 2px solid hsl(var(--primary));
  padding-left: 10px;  /* compensate for border */
}
```

---

### Input

Rectangular, not pill-shaped. Architectural feel over consumer softness.

```css
.input-field {
  /* rounded-sm — not rounded-full */
  border-radius: 4px;
  background: hsl(var(--glass-bg) / 0.08);
  backdrop-filter: blur(12px);
  border: 1px solid hsl(var(--border) / 0.40);
  transition: border-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.input-field:focus-within {
  border-color: hsl(var(--primary) / 0.60);
  outline: none;
}
```

```tsx
<div className="flex items-center gap-2 glass-subtle rounded-sm px-4 py-3 border border-border/40 focus-within:border-primary/60 transition-colors">
  <MessageSquare size={14} className="text-muted-foreground flex-shrink-0" />
  <input
    className="bg-transparent flex-1 text-sm font-sans text-foreground placeholder:text-muted-foreground outline-none"
    placeholder="Ask Athena anything..."
  />
  <button className="bg-foreground text-background rounded-sm px-3 py-1 text-xs font-semibold">
    Send
  </button>
</div>
```

---

### Research Card (Active State)

Grid pattern overlay signals system/machine state. No ambient orbs.

```css
.research-card-active {
  background-image: radial-gradient(
    hsl(var(--primary) / 0.08) 1px,
    transparent 1px
  );
  background-size: 20px 20px;
  border: 1px solid hsl(var(--primary) / 0.25);
}
```

```tsx
<div className="glass rounded-sm p-6 research-card-active">
  <span className="font-sans text-[10px] font-bold tracking-[0.3em] uppercase opacity-50">
    Research / Active
  </span>
  <h2 className="font-display text-xl font-semibold tracking-tight mt-1">
    React Server Components
  </h2>
  <div className="font-mono text-xs text-muted-foreground mt-3">
    Stage 2 / 5 · 4 sources · 00:32
  </div>
</div>
```

---

### Stat Cards

Dense information display. Display-weight number, mono metadata.

```tsx
<div className="glass-subtle rounded-sm p-4 border border-border/20 glass-hover">
  <div className="flex items-center justify-between mb-3">
    <Brain size={14} className="text-primary" />
    <span className="font-mono text-[10px] text-muted-foreground">
      +12 this week
    </span>
  </div>
  <p className="font-display text-3xl font-black tracking-tighter text-foreground">
    61
  </p>
  <p className="font-sans text-xs text-muted-foreground mt-1">
    Concepts
  </p>
</div>
```

---

### Badges & Status

| Type | Class | When to Use |
|------|-------|-------------|
| Primary | `glass-subtle text-primary border border-primary/20 rounded-sm px-2 py-0.5` | Active features, AI tier |
| Accent | `glass-subtle text-accent border border-accent/20 rounded-sm px-2 py-0.5` | Success, online |
| Muted | `glass-subtle text-muted-foreground border border-border/40 rounded-sm px-2 py-0.5` | Neutral info |
| Status dot | `.status-online` | Service health — `rounded-full` retained |

Note: `rounded-sm` replaces `rounded-full` for all badge types except the status dot.

---

### Progress Bars

No glow. Neutral fill, precise labels in mono.

```tsx
<div>
  <div className="flex justify-between mb-1.5">
    <span className="font-mono text-xs text-muted-foreground">VRAM</span>
    <span className="font-mono text-xs text-foreground">68%</span>
  </div>
  <div className="h-px rounded-none bg-muted overflow-hidden">
    <div
      className="h-full transition-all duration-500"
      style={{ 
        width: `${value}%`, 
        background: 'hsl(var(--primary))'
        /* No glow — clean mechanical fill */
      }}
    />
  </div>
</div>
```

`h-px` (1px height) over `h-1.5` — thinner bars signal precision instrument rather than consumer dashboard.

---

### Typing Indicator

Three dots, no color. Muted, minimal.

```css
.typing-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: hsl(var(--muted-foreground));
  animation: bounce 1s infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.15s; }
.typing-dot:nth-child(3) { animation-delay: 0.30s; }
```

Disappears as soon as first token streams in. Never keep visible during streaming.

---

## Shadows

No glows. Shadow for structural elevation only.

| Token | Value | Use |
|-------|-------|-----|
| `.shadow-glass` | `0 4px 24px rgba(0,0,0,0.12)` | Default panel elevation |
| `.shadow-glass-lg` | `0 8px 40px rgba(0,0,0,0.20)` | Modals, floating panels |

**Removed:** `.shadow-glow` — replace all glow shadows with `border-opacity-100` on hover instead.

---

## Border Radius Scale

Shifted toward architectural / brutalist. Pills (`rounded-full`) reserved for status dots only.

| Class | Value | Use |
|-------|-------|-----|
| `rounded-none` | 0px | Code blocks, sidebar items, data tables |
| `rounded-sm` | 4px | Buttons, badges, inputs, most components |
| `rounded-md` | 6px | Small cards, tags |
| `rounded-lg` | 8px | Modals, larger panels |
| `rounded-2xl` | 24px | Chat bubbles only — conversational context |
| `rounded-full` | 9999px | Status dots only |

---

## Layout: Precision Grid

All spacing multiples of 4px. No exceptions.

| Element | Value |
|---------|-------|
| Sidebar expanded | `240px` |
| Sidebar collapsed | `72px` |
| Content gutter | `32px` |
| Card padding | `24px` |
| Dense card padding | `16px` |

### Z-Index Stack

| Layer | Z-index | Contents |
|-------|---------|----------|
| Background | `z-0` | Ceiling gradient, grid patterns |
| Content | `z-10` | Main page content |
| Shutter panels | `z-20` | Sliding detail panels |
| Navigation | `z-30` | Sticky header, sidebar |
| Modals | `z-40` | Overlays, dialogs |

---

## Background — Ceiling Light

No orbs. Single subtle vertical gradient simulating a ceiling light source:

```tsx
{/* Replace orbs with this */}
<div
  className="fixed inset-0 pointer-events-none z-0"
  aria-hidden
  style={{
    background: 'linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, transparent 40%)'
  }}
/>
```

This is the only decorative background element. No radial gradients, no colored orbs, no purple/blue ambience.

---

## Sticky Header

Same structure as v1 — `glass-strong`, bottom border, `z-30`. Updated to use Swiss header pattern inside:

```tsx
<header className="sticky top-0 z-30 glass-strong border-b border-border/20 px-8 py-5 flex items-center justify-between">
  <div>
    <span className="font-sans text-[10px] font-bold tracking-[0.3em] uppercase opacity-50">
      Athena / Knowledge
    </span>
    <h1 className="font-display text-lg font-bold tracking-tight mt-0.5">
      Research Sessions
    </h1>
  </div>
  <div className="flex items-center gap-3">
    {/* actions */}
  </div>
</header>
```

---

## Usage Rules

### ✅ Do

- Use `font-display` (`Inter Tight`) for all headings — never `font-sans` for headers
- Use eyebrow labels (`text-[10px] tracking-[0.3em] uppercase opacity-50`) above display headings
- Use `hsl(var(--token))` for all colors — never raw hex
- Choose glass tier by Z-axis elevation
- Use `rounded-sm` (4px) as default radius for interactive elements
- Apply `.glass-hover` with scale + border contrast only
- Use `cubic-bezier(0.4, 0, 0.2, 1)` for all transitions
- Use tight spring (`stiffness: 260, damping: 20`) for Framer Motion
- Use `font-mono` for all technical values (VRAM, latency, model IDs)
- Always include `-webkit-backdrop-filter` prefix
- Use `saturate(180%)` alongside all `blur()` calls
- Space all elements in multiples of 4px

### ❌ Don't

- Use `font-sans` for page or section headers
- Use `rounded-full` for anything except status dots
- Use raw hex or rgb values in components
- Mix glass tiers on the same elevation level
- Add glow shadows — use border contrast instead
- Use `text-white` or `bg-black` directly
- Skip `-webkit-backdrop-filter` prefix
- Use `linear` timing for any animation
- Add borders without opacity (`/20` minimum)
- Use more than one primary (white) button per view
- Use `.animate-float` or `.animate-pulse-glow` — deleted in v2
- Keep typing indicator visible during token streaming
- Use background orbs — replaced by ceiling gradient

---

*Athena Industrial Glass Design System · v2.1 · Inter Tight + JetBrains Mono + Tailwind CSS*