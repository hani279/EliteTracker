---
name: ELITE Tracker
description: A coach's private ledger for daily sales discipline, not another SaaS dashboard.
colors:
  ink-navy: "#0b1426"
  surface-1: "#111d34"
  surface-2: "#17233f"
  hairline: "#26324c"
  bone: "#efe9db"
  bone-muted: "#a7afc2"
  bone-faint: "#8996b0"
  gold: "#b8934c"
  gold-dim: "#8f7038"
  clay: "#cc7d61"
  clay-dim: "#8a4a37"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(1.75rem, 5vw, 2.75rem)"
    fontWeight: 340
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "20px"
    fontWeight: 480
    lineHeight: 1.2
    letterSpacing: "-0.005em"
  body:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.04em"
  mono:
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 500
rounded:
  sm: "10px"
  lg: "18px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.pill}"
    padding: "14px 22px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    rounded: "{rounded.lg}"
    padding: "12px 18px"
  card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.bone}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: ELITE Tracker

## 1. Overview

**Creative North Star: "The Coach's Ledger"**

ELITE Tracker is not a SaaS dashboard wearing a tracker's clothes. The reference object is a bound field ledger a serious coach keeps on his own desk: dark leather-and-ink cover, a disciplined hand, a rare flash of brass. The interface lives in Harry's own navy, at full strength, as the dominant surface rather than a token accent color squeezed onto a white card grid — this is the "Committed" color strategy, not "restrained." Gold is the brass clasp: it appears where something has actually been earned (a target hit, the active tab, a primary action), never as ambient decoration. Clay, the one addition to Harry's existing pair, does the work red and green usually do in a generic tracker — it is warmth and attention, not a traffic light.

This system explicitly rejects the SaaS-cream-and-gold-pill template the last build fell into: a warm off-white body background with glowing gold drop-shadows, uppercase-tracked eyebrows on every card header, and emoji standing in for iconography. None of that survives here. Surfaces are dark and tonal, panels are cut like glass over a lit ledger page — soft-rounded, translucent, blurred at the edges — and every icon is a drawn line, not a glyph borrowed from a keyboard.

**Key Characteristics:**
- Dark navy is the body, not an accent — brand color carries 30–60% of every screen, now with a faint gold/clay wash glowing through it.
- Gold is rationed: active state, primary CTA, numbers that hit target. Nothing else.
- Clay replaces red/green semantics: "needs attention" reads warm, not alarmed.
- Fraunces headlines carry personality via weight and italic, not size alone.
- Panels are frosted glass — translucent, blurred, softly rounded (18px) — not flat opaque squares; pills stay fully round for anything pressed.
- Elevation comes from glass depth (blur + translucency + a hairline sheen), not blurred color glow.

## 2. Colors

A three-color system — ink-navy, gold, clay — built on navy-tinted neutrals rather than a fourth "safe" color.

### Primary
- **Ink navy** (#0b1426): The body background and the dominant surface of the entire app, not a header accent. Also the text color on light/gold fills.

### Secondary
- **Brass gold** (#b8934c): Reserved for the primary action, the active nav/tab state, and any number that has met or beaten its target. Deliberately muted, not a shiny yellow-gold — it should read as an object (brass, not a highlighter).

### Tertiary
- **Weathered clay** (#cc7d61): The system's only other color. Carries every "needs attention" signal — behind-pace metrics, stalled pipeline items, at-risk clients, destructive actions — so the app never resorts to stock red/green traffic lighting.

### Neutral
- **Bone** (#efe9db): Primary text on dark surfaces. Warm, but only ever used as text — never as a background fill, which is what keeps this from sliding into the cream-SaaS look.
- **Bone muted** (#a7afc2): Secondary text, timestamps, captions.
- **Bone faint** (#8996b0): Tertiary text, disabled states, placeholder copy (still verified ≥4.5:1 against surface-1).
- **Surface 1** (#111d34): Card and panel surface, one tonal step up from the body.
- **Surface 2** (#17233f): A second elevation step for nested or highlighted panels (used sparingly — two steps is the ceiling).
- **Hairline** (#26324c): The only border color in the system.

### Light theme
A `[data-theme="light"]` variant inverts the ledger rather than palette-swapping it: the page runs on a cool, navy-tinted near-white (#f1f2f6) instead of cream, cards sit on translucent white glass, and gold/clay darken (#a67b2c / #c06f4a) so ink text on a filled button still clears 4.5:1 — the same brass and clay hues, tuned for the opposite surface. The sun/moon toggle lives inside the settings menu (Menu → Appearance), not floating in the topbar — it's a preference, not a primary action, and doesn't deserve permanent chrome real estate. The choice persists to `settings.theme`.

### Page wash (the one gradient in the system)
The body background is not a flat fill. It carries two very low-opacity radial gradients in gold and clay (`--page-wash`) beneath the solid `--page-bg`, so the frosted glass panels have something to actually diffuse — glass over a flat color just looks like transparency with extra steps. This is the system's single, deliberate exception to "no gradients," made purposeful by pairing with `backdrop-filter`. Never add a second gradient anywhere else; extend `--page-wash` if a screen needs more atmosphere.

**The Fill-vs-Ink Split Rule.** Gold and clay each carry two tokens: `--gold`/`--clay` for fills (button backgrounds, bars, the active-tab pill) where ink-navy text sits on top, and `--gold-ink`/`--clay-ink` for the color rendered directly as text or an icon on a surface. In dark mode both resolve to the same value; in light mode they diverge, because a fill light enough to keep navy text readable is too light to itself read as text on a white card. Never introduce a third gold/clay value — extend one of these two.

### Named Rules
**The One Brass Rule.** Gold covers no more than roughly 10% of any single screen. If more than one element on a screen is gold, one of them is wrong.

**The No Traffic Lights Rule.** Never introduce a standalone red or green. Positive = gold. Needs attention = clay. Neutral = bone/hairline.

## 3. Typography

**Display Font:** Fraunces (with Georgia, serif fallback)
**Body Font:** IBM Plex Sans (with system-ui fallback)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace fallback)

**Character:** Fraunces brings a handset, slightly old-style warmth to anything a human wrote (headlines, the coach's nudge, the daily reflection) — it is never used below 18px. IBM Plex Sans carries everything functional (numbers, labels, buttons, nav) with a quietly technical, precise voice that reads as a disciplined tool rather than a friendly consumer app. IBM Plex Mono sets every tabular figure (stepper counts, stats, timestamps) so numbers line up and feel measured, not decorative.

### Hierarchy
- **Display** (weight 340, `clamp(1.75rem, 5vw, 2.75rem)`, line-height 1.05, letter-spacing -0.01em): Screen-defining moments only — the onboarding headline, the daily greeting.
- **Headline** (weight 480, 20px, line-height 1.2): Card and section titles. Fraunces at this size, medium weight — not the uppercase-tracked eyebrow the old build used everywhere.
- **Title** (weight 600, 15px): List-row primary text (a pipeline name, a client name).
- **Body** (weight 400, 14.5px, line-height 1.5, max 70ch): All prose — coach nudges, descriptions, form helper text.
- **Label** (weight 600, 11px, letter-spacing 0.04em, sentence case): Field labels, tags, nav captions. Sentence case, not uppercase — uppercase is reserved for the rare true badge.
- **Mono** (weight 500, 13px, tabular): Every number that is counted, tracked, or timestamped.

### Named Rules
**The Weight-Not-Size Rule.** Build hierarchy by swinging Fraunces and Plex across their weight range (300→600) before reaching for a bigger font-size. A 20px Fraunces headline at weight 480 next to 14.5px Plex body at weight 400 already reads as a clear hierarchy without a third size.

## 4. Elevation

The system is frosted glass over the page wash. Every panel — card, sheet, tag tile, the sticky topbar, the bottom nav — is a translucent tonal fill (`--glass-1` / `--glass-2`, ~55–60% opacity) with `backdrop-filter: blur(14–20px) saturate(1.5–1.6)` behind it, so the gold/clay page wash and whatever scrolled content sits underneath diffuse through softly instead of being fully hidden. Depth still steps tonally (glass-1 → glass-2 for the one nested highlight per screen), but glass is now the primary depth cue, not flat tonal color alone. `box-shadow` supplements it in two ways: a `--glass-sheen` (a 1px inset top highlight, like light catching the edge of real glass) on every glass panel, and the existing floating shadow on things that genuinely sit above the page (sheet, FAB, toast).

### Shadow Vocabulary
- **sheen** (`box-shadow: inset 0 1px 0 rgba(255,255,255,.07)` dark / `rgba(255,255,255,.7)` light): The top-edge highlight every glass panel gets, always paired with `resting` or `floating`.
- **resting** (`box-shadow: 0 1px 2px rgba(4,7,14,.4)`): Cards that sit flush with the page; barely perceptible, just enough to separate from body.
- **floating** (`box-shadow: 0 2px 4px rgba(4,7,14,.35), 0 16px 32px -8px rgba(4,7,14,.55)`): Bottom sheet, FAB, toast — genuinely above the page.

### Named Rules
**The No-Glow Rule.** Never apply `filter: drop-shadow()` or any blurred color-matched glow to an active/selected element. Communicate "active" with fill, weight, or a hairline, not a halo — glass diffusion is not an excuse to bring glow back in through the side door.

**The Blur-Has-Something-to-Blur Rule.** Never apply `backdrop-filter` over a flat, ungradiented fill — that's transparency with a performance cost and no visual payoff. Every glass surface must sit above either the page wash or another screen's scrolled content. If you add a new full-bleed screen background, give it a wash (see §2) before frosting anything on top of it.

**Reduced-transparency fallback.** Every `backdrop-filter` rule ships with a `@supports not (backdrop-filter: blur(1px))` fallback that raises the glass fill's opacity to ~92% — legibility over aesthetic on unsupported browsers.

## 5. Components

### Buttons
- **Shape:** Two families only. Primary and tag/chip actions are full pill (`border-radius: 999px`). Secondary and destructive actions are soft-rounded (`border-radius: 18px`, `rounded.lg`). Never a barely-there radius and never a full pill on a secondary action.
- **Primary:** Gold fill, ink-navy text, pill, `padding: 14px 22px`, weight 600.
- **Secondary / Outline:** Transparent fill, bone text, 1.5px hairline border, `rounded.lg`.
- **Ghost:** Transparent, bone-muted text, no border, used inline (e.g. "add task").
- **Destructive:** Clay-ink text on a clay-tint fill, `rounded.lg`.
- **Hover / Focus:** Primary darkens toward gold-dim; all buttons get a 1.5px bone outline on `:focus-visible`, offset 2px — no glow.

### Chips / Tags
- **Style:** Pill, `surface-2` fill, bone-muted text by default. A tag only takes gold-tint or clay-tint fill (with `--gold-ink`/`--clay-ink` text) when it is reporting an actual state (target hit = gold; needs attention = clay) — never as decoration.

### Cards / Containers (frosted glass)
- **Corner Style:** 18px (`rounded.lg`) — soft-rounded, not sharp, not the old flat 3px edge, and not an oversized 24px+ pill-adjacent radius either.
- **Background:** `--glass-1` (~55% opacity) with `backdrop-filter: blur(20px) saturate(1.6)`, stepping to `--glass-2` only for one nested highlight per screen at most (e.g. the coach-nudge card). Always paired with the `--glass-sheen` inset top highlight.
- **Shadow Strategy:** sheen + resting shadow (see Elevation); a 1px hairline border still frames the glass edge since translucency alone under-defines it.
- **Internal Padding:** Deliberately uneven — 20px top, 24px sides is fine; the padding scale exists to be varied by content weight, not applied identically to every card. This is the asymmetry lever: a hero card can run edge-to-edge on one side while a data card keeps full padding.

### Inputs / Fields
- **Style:** Solid `surface-2` fill (not glass — inputs stay opaque so typed content never fights a blurred backdrop), 1.5px hairline border, `rounded.lg`, bone text, Plex Sans.
- **Focus:** Border shifts to gold at full opacity — no glow ring.
- **Label:** Sentence case Plex label above the field, not uppercase.
- **Search fields:** A leading fine-line icon (`.field-icon`, `bone-faint`, 15px) inset into the input's left padding, never a separate button. Live-filters as you type; if the view fully re-renders on input (this app's render model does), the re-render must restore focus and cursor position or typing becomes unusable after the first keystroke — see `App.pipeSearch` in `app.js` for the pattern.

### Navigation (frosted glass chrome)
- **Bottom nav & topbar:** Both are `--glass-chrome` (translucent navy/near-white) with `backdrop-filter: blur(14px) saturate(1.5)`, so scrolled content visibly passes beneath them — the classic sticky-glass-header treatment, now intentional rather than the old build's plain drop-shadow scrim.
- **Bottom nav layout:** Deliberately not a symmetric five-way split. The active item is a pill in gold-tint behind the icon+label; inactive items are plain bone-faint icon+label with no container. This breaks the "every icon in an identical slot" grid the old nav used.
- **Icons:** Fine-line only (1.5px stroke, Lucide/Feather-derived), 20px, never filled, never emoji. See Signature Component below.

### Signature Component: Fine-line icon set
Every icon in the app (nav, topbar actions, list-row glyphs, record button, sheet actions) is a hand-picked 20–24px, 1.5px-stroke outline icon rendered as inline SVG — sourced from Lucide's icon set for consistency, recolored via `currentColor` so it inherits bone/gold/clay from context. No icon font, no emoji, ever. This is the direct fix for the app's biggest "AI slop" tell.

### Auth
- **Screen:** Reuses the `.onb` shell (brand mark, Fraunces `h2`, glass `.card-light` for fields) so sign-up/log-in doesn't feel like a bolted-on third surface. Toggling between the two is a state swap, not a route change, and preserves the glass/rounded/wash treatment.
- **Google button — the one deliberate exception to the three-color system.** Fixed white background, `#1f1f1f` text, the real four-color "G" mark, pill radius — regardless of app theme. This is not a design lapse: Google's brand guidelines require their sign-in button to stay recognizable and untinted, so it is the single element in ELITE Tracker allowed to ignore ink/gold/clay entirely. Never restyle it toward the brand palette.
- **Email/password is the fallback, not the primary path** — Google sits above the divider because it's the lower-friction option for most agents; don't reorder these without a reason.

## 6. Do's and Don'ts

### Do:
- **Do** run the body background at full ink-navy (#0b1426) plus the low-opacity gold/clay page wash — the brand color is the surface, not a 5% accent.
- **Do** build hierarchy with Fraunces/Plex weight swings (300→600) before increasing font-size.
- **Do** use pill shape exclusively for things you press or that report a state (buttons, tags, active nav); soft-rounded 18px (`rounded.lg`) for everything else.
- **Do** frost every panel — card, sheet, topbar, bottom nav — with translucent glass fill + `backdrop-filter: blur()`, always over the page wash or scrolled content, never over a flat fill.
- **Do** pair every glass surface with a `--glass-sheen` inset top highlight and a hairline border; translucency alone under-defines an edge.
- **Do** render every icon as inline fine-line SVG.
- **Do** vary card padding and section rhythm deliberately — not every block needs identical 14px gutters.
- **Do** keep the theme toggle inside the settings menu (Menu → Appearance) — it's a preference, not primary chrome.

### Don't:
- **Don't** reintroduce a cream/sand/beige body background — that is the exact SaaS-default tell this redesign exists to remove.
- **Don't** use Inter, Roboto, Arial, or any default system sans as a primary typeface.
- **Don't** use a sharp, un-rounded edge (the old 3px "square") or an oversized 24px+ radius on cards/sheets/panels — 18px (`rounded.lg`) is the standard, pill is the only exception.
- **Don't** apply `backdrop-filter` over a surface with nothing behind it to blur — always sit glass over the page wash or scrolled content.
- **Don't** use `filter: drop-shadow()` or any color-matched glow on active/selected elements — glass diffusion is not a backdoor for glow.
- **Don't** use emoji as icons anywhere in the interface.
- **Don't** introduce standalone red or green — clay covers "needs attention," gold covers "on target."
- **Don't** put a tiny uppercase-tracked eyebrow label above every card or section; that scaffolding is banned regardless of how it's styled.
- **Don't** lay out every card at identical width, radius, and padding in a uniform vertical stack with no variation — that symmetry is what reads as machine-generated.
- **Don't** add a second gradient anywhere outside `--page-wash` — one atmospheric wash per theme is the ceiling.
