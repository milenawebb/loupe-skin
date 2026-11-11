# Loupe

A Video.js v10 skin that turns a video into a contact sheet you can read at a glance, click into, drag across and save as a PDF.

Live demo: [loupevideo.com](https://loupevideo.com)

## What it adds

Every player already builds a contact sheet. It is what powers the thumbnail that appears when you hover a seek bar. Most players show you one tile at a time and throw the rest away.

Loupe shows all of them, as a filmstrip under the video and as a full sheet you can open beneath it. Click a frame to jump there, drag across frames to scrub, move through them with the keyboard, or save the whole sheet as a one page PDF with every frame linked back to its moment in the video.

The player takes the shape of what it plays rather than boxing it, and reads light or dark from the page behind it.

## Requirements

| | |
|---|---|
| Player | Video.js v10 |
| Framework | React 19, TypeScript, Tailwind v4 |
| Source | A Mux playback ID whose asset has a storyboard |

## The storyboard

**Without a storyboard there is no contact sheet.**

Loupe does not extract frames itself. It builds the sheet from the storyboard the video host already generates: one sprite image of evenly spaced frames, plus a JSON file saying where each frame sits.

The storyboard URL is fixed to Mux:

```
https://image.mux.com/<playbackId>/storyboard.json
```

Mux generates one for every asset automatically, and so does Cloudflare Stream. A plain MP4 URL carries no tile data, so there is no sheet. If the storyboard fails to load, the video still plays with ordinary controls and the filmstrip and sheet simply do not appear.

Using another host means changing four things: the source configuration, the poster URL, the storyboard fetch and normalisation, and the caption setup. The sprite must also allow cross-origin canvas readback, or the PDF export cannot draw it.

The shape Loupe expects:

```json
{
  "url": "https://image.mux.com/<playbackId>/storyboard.jpg",
  "tile_width": 284,
  "tile_height": 160,
  "duration": 74.933,
  "tiles": [
    { "start": 0,     "x": 0,   "y": 0 },
    { "start": 1.529, "x": 284, "y": 0 }
  ]
}
```

Real responses contain one entry per tile. Loupe reads `url`, `tile_width`, `tile_height`, `duration`, and each tile's `start` in seconds plus its `x` and `y` pixel offsets into the sprite.

## Install

Loupe is not a published package. There is nothing to `npm install` by name. It is source you copy into a React project that uses the `@/` alias for `src/`.

Copy these files:

```
src/components/ProofSheetPlayer.tsx     the player and skin (default export)
src/components/PlayerExtras.tsx         volume, speed and caption controls
src/components/PlayerIcons.tsx          the drawn icon set
src/components/PlayerTooltip.tsx        control tooltips
src/components/SheetExpansion.tsx       contact sheet open and close
src/components/SheetSeekPreview.tsx     seek preview image
src/components/SaveSheetButton.tsx      PDF export control
src/components/GlassRefraction.tsx      SVG filter for the glass frame
src/components/ui/button.tsx            the "player" button variant
src/hooks/use-*.ts                      chrome, seek, menu, caption and width hooks
src/lib/*.ts                            layout, theme, keyboard and export logic
src/styles.css                          every .ps-* rule and the theme variables
public/displacement-map.png             glass refraction map, frame
public/displacement-map-panel.png       glass refraction map, menus
public/loupe-logo.png                   used by the PDF renderer
```

Then add the dependencies:

```bash
npm install @videojs/react@10.3.0 @videojs/mux-video@10.3.0 @radix-ui/react-tooltip clsx tailwind-merge
```

Tailwind must scan every copied file. Mount `GlassRefraction` once per page, not once per player. The two displacement maps are referenced by root URL, so either preserve those paths or update the references in `GlassRefraction.tsx` and `sheet-export.ts`.

## Usage

`ProofSheetPlayer` is the default export.

```tsx
import ProofSheetPlayer from "@/components/ProofSheetPlayer";
import { GlassRefraction } from "@/components/GlassRefraction";

export default function Page() {
  return (
    <>
      <GlassRefraction />
      <ProofSheetPlayer
        playbackId="YOUR_PLAYBACK_ID"
        title="Your video title"
        aspectRatio={16 / 9}
        muted
      />
    </>
  );
}
```

The player is client only. Under SSR, render it inside whatever browser-only boundary your framework provides.

## Options

Every prop is optional.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `playbackId` | `string` | none | Mux playback ID. Without one the player does not render. |
| `title` | `string` | the playback ID | Used for the PDF header, the PDF document title and the export filename. |
| `aspectRatio` | `number` | none | Width / height to reserve before anything loads. The storyboard ratio supersedes it once available, snapped to a standard ratio within 1%, then confirmed by the video's own metadata. Without it the player stays hidden until a shape is known. |
| `startTime` | `number` | none | Initial seconds, applied once a finite positive duration is available. Values above the duration are capped. |
| `captionsUrl` | `string` | none | English WebVTT override. Unset keeps the source's own tracks. |
| `theme` | `"light" \| "dark"` | detected | Forces the theme. Unset, it is read from the page behind the player. |
| `muted` | `boolean` | `false` | Start muted. |
| `loop` | `boolean` | `false` | Loop playback. |
| `autoPlay` | `boolean` | `false` | Browsers generally only allow this when muted. |
| `initialSheetOpen` | `boolean` | `false` | Initial expansion state only. Not a controlled prop. |
| `posterTime` | `number` | `6` | Seconds into the video for the poster frame, from Mux's thumbnail service. |
| `onFrameCount` | `(count: number) => void` | none | Called with the loaded storyboard tile count, or 0 while unavailable. |

Some values are implementation constants rather than props: the Mux storyboard and thumbnail URLs, the 70vh height cap, the speed list (0.5 to 2), the five second seek step, the 1800ms idle delay before the chrome hides, and the 640px and 380px compact layout widths.

## Theming

Pass `theme` to choose one. Otherwise, after mounting, the skin walks up from the player to the nearest ancestor with a fully opaque background colour and picks light when that colour's relative luminance is above 0.5, dark otherwise. If no opaque background is found it uses dark. Each player decides for itself, so two players on one page can differ.

Detection runs after mount and when ancestor classes or backgrounds change, not continuously. If your host switches themes at runtime, pass an explicit reactive `theme` instead.

The variables are declared on `.ps-player` and `.ps-player[data-theme="light"]`, so setting them on a parent element has no effect. Override them with a selector that targets `.ps-player`.

| Variable | Dark | Light | Used for |
|---|---|---|---|
| `--bg` | `#08090A` | `#F7F8F9` | Base surface |
| `--panel` | `#101214` | `#FFFFFF` | Player background |
| `--chrome-surface` | `#101214` | `#F2F4F6` | Control bar |
| `--sheet-header` | `#101214` | `#F2F4F6` | Contact sheet header |
| `--sheet-body` | `#08090A` | `#FFFFFF` | Behind the tiles |
| `--line` | `#1E2227` | `#E2E6EA` | Hairlines |
| `--text` | `#E8EBED` | `#0D0F11` | Text and icons |
| `--dim` | `#828B94` | `#5C6670` | Secondary text |
| `--accent` | `#FFFFFF` | `#0D0F11` | Active frame and pressed controls |
| `--seek-track` | `rgba(255,255,255,0.15)` | `rgba(13,15,17,0.12)` | Seek bar track |
| `--seek-buffered` | `rgba(255,255,255,0.28)` | `rgba(13,15,17,0.22)` | Loaded range |
| `--seek-played` | `#E8EBED` | `#0D0F11` | Played range and handle |

`--sheet` aliases `--panel`. `--focus-light` is `#FFFFFF` and `--focus-dark` is `#000000` in both themes. The glass frame has its own `--glass-*` variables on `.ps-glass-frame`, with light overrides on `.ps-glass-frame[data-theme="light"]`.

## Keyboard

Shortcuts work while focus is inside the player.

| | | | |
|---|---|---|---|
| `Space` | Play / pause | `← →` | Seek 5s |
| `↑ ↓` | Volume | `M` | Mute |
| `F` | Fullscreen | `C` | Captions |
| `S` | Contact sheet | `Arrows` | Move between frames |
| `Enter` | Seek to frame | `Esc` | Close |

Also supported: `K` play/pause, `J` and `L` seek 10 seconds, `0` to `9` seek 0 to 90%, `Home` and `End` for start and end, and `?` to toggle the keyboard panel.

Editable fields and surfaces with their own keyboard handling are excluded. Alt, Ctrl and Meta combinations are ignored. Space on a focused button activates that button rather than toggling playback.

## Accessibility

**Contact sheet.** The frame grid is a single tab stop using `aria-activedescendant`. Arrow keys move the active descendant and seek immediately. Enter seeks to the focused frame and closes the sheet. Frame names include the number and timestamp, and the current frame is marked `aria-current`. The sheet header's controls remain separate tab stops.

**Touch targets.** Control buttons and menu rows are at least 44 by 44 pixels. Filmstrip tiles are at least 44 pixels in both directions. The seek interaction is 44 pixels tall around a 3 pixel track with a 10 pixel square handle.

**Focus.** Every control has a visible focus outline. Menus trap Tab while open and return focus to the control that opened them.

**Reduced motion.** Under `prefers-reduced-motion`, the sheet expansion, the chrome fade, the seek preview and button transitions are all switched off. The player remains fully functional.

**Forced colors.** Under `forced-colors: active`, glass, blur and shadows are dropped in favour of system colours, and focus and the current frame use the system highlight.

**Right to left.** Under `dir="rtl"`, left and right arrows swap for seeking and sheet navigation, and pointer seeking follows reading direction.

**Contrast.** Control bar text and icons measure 15.7:1 in the dark theme and 17.4:1 in the light theme. The glass frame samples whatever sits behind it, so contrast over an arbitrary host page depends on that background.

## Licence

Apache License 2.0. Copyright 2026 Milena Webb. Full text in [LICENSE](LICENSE).
