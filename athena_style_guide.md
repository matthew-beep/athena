# Athena — Liquid Glass Design System
### v1.0 · Visual Language Reference

> A minimal, hyper-modern aesthetic bridging Apple VisionOS and Swiss editorial design. Built on glassmorphism, semantic tokens, and fluid motion.

---

## Design Philosophy

Three principles that must be preserved across all components and pages.

**Material: Liquid Glass**
Surfaces feel like thick high-index glass with varying blur (20–60px) and subtle refraction. Never flat plastic. The `backdrop-filter` property is the primary tool — always pair with `-webkit-backdrop-filter` for Safari compatibility.

**Atmosphere: Breathable**
White space is structural, not decorative. Negative space reduces cognitive load and communicates premium quality. When in doubt, add more breathing room rather than less.

**Depth via Z-Axis**
Elevation is defined by `box-shadow` and `backdrop-filter`, not solid borders or background fills. Three tiers: subtle, default, strong. Never mix tiers on the same elevation level.

---

## Color Tokens

All colors are defined as HSL CSS variables. **Never use raw hex or rgb values directly in components** — always reference a semantic token. This ensures consistent light/dark mode behavior.

### Core Semantic Colors

| Token | Usage |
|-------|-------|
| `hsl(var(--background))` | Page background |
| `hsl(var(--foreground))` | Primary text |
| `hsl(var(--card))` | Card surfaces |
| `hsl(var(--border))` | Dividers and borders |

### Brand Colors

| Token | Name | Notes |
|-------|------|-------|
| `hsl(var(--primary))` | Electric Blue | Main brand color, use sparingly |
| `hsl(var(--primary-foreground))` | White | Text on primary backgrounds |
| `hsl(var(--accent))` | Emerald | Success, confirmations |
| `hsl(var(--destructive))` | Red | Errors, destructive actions |

### Neutral Scale

| Token | Usage |
|-------|-------|
| `hsl(var(--secondary))` | Secondary backgrounds |
| `hsl(var(--muted))` | Subtle backgrounds |
| `hsl(var(--muted-foreground))` | Secondary text, captions |
| `hsl(var(--input))` | Input borders |

### Glass Tokens

| Token | Usage |
|-------|-------|
| `hsl(var(--glass-bg))` | Glass surface fill |
| `hsl(var(--glass-border))` | Glass edge border |
| `hsl(var(--orb-1))` | Background orb color |

---

## Typography

Font family: **Inter** (fallback: `-apple-system, sans-serif`)
Monospace: **JetBrains Mono** — use `.mono` class for all code and technical values.

| Role | Class | Size | Weight | Use |
|------|-------|------|--------|-----|
| Display | `text-5xl font-extrabold tracking-tight` | 48px | 800 | Hero headings only |
| Heading 1 | `text-3xl font-bold tracking-tight` | 30px | 700 | Page titles |
| Heading 2 | `text-xl font-semibold` | 20px | 600 | Section headers |
| Body | `text-base leading-relaxed` | 16px | 400 | Main content |
| Small / Caption | `text-xs text-muted-foreground` | 12px | 400 | Labels, metadata |
| Mono | `font-mono` / `.mono` | 14px | 400 | Code, tech values |

---

## Glass Utilities

Three tiers of glassmorphism. Choose based on the component's Z-axis elevation. **Never mix tiers on the same level.**

| Class | Opacity | Blur | Use Case |
|-------|---------|------|----------|
| `.glass-subtle` | 20% | 20px | Low-hierarchy containers, nested wells |
| `.glass` | 45% | 40px | Default panels and cards |
| `.glass-strong` | 65% | 60px | Sidebars, modals, sticky headers |

### Hover Interaction — `.glass-hover`

Attach to any interactive glass element. Effect: translucency increases, electric blue border glow appears, `translateY(-1px)` lift.

```
.glass.glass-hover
```

---

## Components

### Buttons

| Variant | Class | Use Case |
|---------|-------|----------|
| Primary Glow | `.btn-glow` | Primary CTA — **one per view max** |
| Ghost Glass | `glass-subtle + border + rounded-full` | Secondary actions |
| Accent | `glass-subtle + border-accent/20 + text-accent` | Confirmations, success |
| Disabled | `opacity-50 cursor-not-allowed` | Unavailable actions |

---

### Chat Bubbles

Never center-align chat bubbles. User right, AI left.

| Class | Style | Alignment |
|-------|-------|-----------|
| `.message-user` | Primary blue gradient, white text, `rounded-2xl` | Right — `justify-end` |
| `.message-ai` | `glass-subtle`, muted foreground text, `rounded-2xl` | Left — `justify-start` |

---

### Navigation Items

Sidebar nav uses `.nav-item` for all entries.

```css
.nav-item        → flex items-center gap-2, rounded-xl px-3 py-2, text-sm, hover:glass-subtle
.nav-item.active → text-primary, bg-primary/10, border-l-2 border-primary
```

---

### Input Pill

The primary chat input. Always use `.input-pill` — do not recreate with raw Tailwind.
Contains: icon (left), `flex-1` input, send button (right).

```css
.input-pill → glass, rounded-full, border border-border/40, focus-within:border-primary/40
```

---

### Stat Cards

Dashboard metrics. Always include: icon (top left), secondary text (top right), large value, label.

```
glass-subtle rounded-xl p-4 space-y-2 glass-hover border border-border/30
```

---

### Badges & Status

| Type | Class | When to Use |
|------|-------|-------------|
| Primary | `glass-subtle + text-primary + border-primary/20` | Active features, AI tier badges |
| Accent | `glass-subtle + text-accent + border-accent/20` | Success, online status |
| Muted | `glass-subtle + text-muted-foreground + border-border/40` | Neutral info, metadata |
| Filled | `bg-primary/10 text-primary rounded-full` | Active tab indicators |
| Status dot | `.status-online` | Service health indicators |

---

### Progress Bars

Used for VRAM, RAM, storage, and mastery scores. Always pair value text color with bar fill color. Apply a subtle glow matching bar color.

```jsx
// Container
<div className="h-1.5 rounded-full bg-muted overflow-hidden">
  // Fill
  <div style={{ width: `${value}%`, background: color, boxShadow: `0 0 8px ${color}66` }} />
</div>
```

---

### Typing Indicator

Three `.typing-dot` elements side by side. Used while waiting for LLM response.
**Disappears as soon as first token streams in** — do not keep visible during streaming.

```css
.typing-dot → w-1.5 h-1.5 rounded-full bg-muted-foreground, animation: bounce staggered
```

---

## Animations & Motion

All transitions use `cubic-bezier(0.4, 0, 0.2, 1)` — Apple's standard ease curve. **Never use `linear` timing for UI animations.**

| Class | Effect | Use Case |
|-------|--------|----------|
| `.animate-fade-up` | opacity 0→1, translateY 20px→0 | Page entry, content reveals |
| `.animate-scale-in` | scale 0.8→1, opacity 0→1 | Modals, cards, dropdowns |
| `.animate-float` | subtle Y oscillation, looping | Knowledge graph nodes |
| `.animate-pulse-glow` | primary color glow pulse, looping | Active status, loading states |
| `.shimmer` | horizontal gradient sweep, looping | Skeleton loading placeholders |

---

## Shadows & Glows

| Token | Value | Use |
|-------|-------|-----|
| `.shadow-glass` | `0 4px 24px rgba(0,0,0,0.06)` | Default panel elevation |
| `.shadow-glass-lg` | `0 8px 40px rgba(0,0,0,0.12)` | Modals, floating cards |
| `.shadow-glow` | `0 0 20px hsl(var(--primary)/0.4)` | Active elements, primary CTA |

---

## Border Radius Scale

| Class | Value | Use |
|-------|-------|-----|
| `rounded-sm` | 10px | Inline chips, tiny badges |
| `rounded-md` | 14px | Small buttons, tags |
| `rounded-lg` | 16px | Inputs, form elements |
| `rounded-xl` | 12px | Most interactive elements |
| `rounded-2xl` | 24px | Cards, panels, modals |
| `rounded-3xl` | 32px | Large hero cards |
| `rounded-full` | 9999px | Pill buttons, avatars, status dots |

---

## Background Orbs

Every page uses two ambient gradient orbs fixed in the background. Always `pointer-events-none`, always `aria-hidden`, always behind all content.

```jsx
// Orb 1 — top left
className="absolute w-[700px] h-[700px] rounded-full opacity-15 blur-3xl"
style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)", top: "-15%", left: "-10%" }}

// Orb 2 — bottom right
className="absolute w-[500px] h-[500px] rounded-full opacity-10 blur-3xl"
style={{ background: "radial-gradient(circle, hsl(260 60% 55%) 0%, transparent 70%)", bottom: "0%", right: "0%" }}
```

**Never remove the orbs.** Never exceed opacity-20 for Orb 1 or opacity-15 for Orb 2.

---

## Sticky Header Pattern

All pages use a sticky header with `glass-strong` and a bottom border.

```
sticky top-0 z-30 glass-strong border-b border-border/40 px-6 py-4
```

Always includes: back button (if nested page), logo + title, right-side actions.
Use `z-30` minimum. Use `z-40` for modals and overlays.

---

## Usage Rules

### ✅ Do

- Use `hsl(var(--token))` for all colors
- Choose glass tier by Z-axis elevation
- Apply `.glass-hover` on interactive glass elements
- Use `cubic-bezier(0.4, 0, 0.2, 1)` for all transitions
- Pair `text-muted-foreground` for secondary text
- Use `border-border/30` for subtle separators
- Always include `-webkit-backdrop-filter` prefix
- Use `.mono` class for all code and technical values

### ❌ Don't

- Use raw hex or rgb values in components
- Mix glass tiers on the same elevation level
- Use `text-white` or `bg-black` directly
- Skip `-webkit-backdrop-filter` prefix (Safari breaks)
- Use `linear` timing for animations
- Add borders without opacity (`/30` minimum)
- Use more than one `.btn-glow` per view
- Keep typing indicator visible during token streaming

---

*Athena Liquid Glass Design System · v1.0 · Built with Tailwind CSS + CSS Custom Properties*
