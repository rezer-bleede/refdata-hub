# RefData Hub — Brand Assets Reference

Complete listing of all brand assets available in the `branding/` directory.

---

## Quick Reference

| Asset Type | Location | Formats | Count |
|------------|----------|---------|-------|
| Logos | `branding/logo/` | SVG | 7 |
| Favicons | `branding/favicon/` | SVG | 3 |
| App Icons | `branding/app-icons/` | SVG | 4 |
| Social Media | `branding/social/` | SVG | 5 |
| UI Icons | `branding/ui-icons/` | SVG | 15 |
| Patterns | `branding/patterns/` | SVG | 2 |

---

## Logo Assets

### Primary Logo
- **File:** `branding/logo/refdata-hub-primary.svg`
- **Size:** 512x512
- **Format:** SVG
- **Usage:** General use, presentations

### Dark Mode Logo
- **File:** `branding/logo/refdata-hub-primary-dark.svg`
- **Size:** 512x512
- **Format:** SVG
- **Usage:** Dark backgrounds

### Light Mode Logo
- **File:** `branding/logo/refdata-hub-primary-light.svg`
- **Size:** 512x512
- **Format:** SVG
- **Usage:** Light backgrounds

### Monochrome Logo
- **File:** `branding/logo/refdata-hub-mono.svg`
- **Size:** 512x512
- **Format:** SVG
- **Usage:** Print, one-color applications

### Icon Only
- **File:** `branding/logo/refdata-hub-icon.svg`
- **Size:** 512x512
- **Format:** SVG
- **Usage:** Small spaces, app icons

### Horizontal Layout
- **File:** `branding/logo/refdata-hub-horizontal.svg`
- **Size:** 800x256
- **Format:** SVG
- **Usage:** Headers, wide layouts

### Stacked Layout
- **File:** `branding/logo/refdata-hub-stacked.svg`
- **Size:** 256x384
- **Format:** SVG
- **Usage:** Compact vertical spaces

---

## Favicon Assets

### Primary Favicon
- **File:** `branding/favicon/favicon.svg`
- **Size:** 64x64
- **Format:** SVG

### 16x16 Favicon
- **File:** `branding/favicon/favicon-16x16.png.svg`
- **Size:** 16x16
- **Format:** SVG

### 32x32 Favicon
- **File:** `branding/favicon/favicon-32x32.png.svg`
- **Size:** 32x32
- **Format:** SVG

---

## App Icon Assets

### macOS Icon (512x512)
- **File:** `branding/app-icons/macos/icon_512x512.png.svg`
- **Size:** 1024x1024
- **Format:** SVG

### Windows Tile
- **File:** `branding/app-icons/windows/tile.png.svg`
- **Size:** 270x270
- **Format:** SVG

### Android Adaptive Icon
- **File:** `branding/app-icons/android/adaptive-icon.png.svg`
- **Size:** 512x512
- **Format:** SVG

### iOS Medium Icon (2x)
- **File:** `branding/app-icons/ios/icon-medium-2x.png.svg`
- **Size:** 180x180
- **Format:** SVG

---

## Social Media Assets

### Twitter Profile Image
- **File:** `branding/social/twitter-profile.svg`
- **Size:** 400x400
- **Format:** SVG

### Twitter Header
- **File:** `branding/social/twitter-header.svg`
- **Size:** 1500x500
- **Format:** SVG

### GitHub Social Image
- **File:** `branding/social/github-social.svg`
- **Size:** 1280x640
- **Format:** SVG

### LinkedIn Banner
- **File:** `branding/social/linkedin-banner.svg`
- **Size:** 1128x192
- **Format:** SVG

### Discord Icon
- **File:** `branding/social/discord-icon.svg`
- **Size:** 1024x1024
- **Format:** SVG

---

## UI Icon Assets

### Navigation Icons
| Icon | File | Purpose |
|------|------|---------|
| Grid | `grid.svg` | Dashboard |
| Dimensions | `dimensions.svg` | Dimensions page |
| Library | `library.svg` | Canonical Library |
| Relations | `relations.svg` | Dimension Relations |
| Connections | `connections.svg` | Source Connections |
| Mappings | `mappings.svg` | Field Mappings |
| Insights | `insights.svg` | Match Insights |
| Suggestions | `suggestions.svg` | Suggestions |
| History | `history.svg` | Mapping History |
| Settings | `settings.svg` | Settings |

### Status Icons
| Icon | File | Purpose |
|------|------|---------|
| Check Circle | `check-circle.svg` | Success |
| Close | `close.svg` | Dismiss, error |
| Info Circle | `info-circle.svg` | Information |
| External Link | `external-link.svg` | External resources |

---

## Pattern Assets

### Dots Grid Pattern
- **File:** `branding/patterns/dots-grid.svg`
- **Size:** 800x800
- **Format:** SVG
- **Usage:** Subtle background pattern

### Mesh Gradient Pattern
- **File:** `branding/patterns/mesh-gradient.svg`
- **Size:** 800x800
- **Format:** SVG
- **Usage:** Tech pattern for empty states

---

## File Naming Convention

All brand assets follow this naming pattern:
```
[component]-[variant].[format]
```

### Examples
- `refdata-hub-primary.svg` — Primary logo variant
- `favicon-16x16.png.svg` — 16x16 favicon
- `icon-medium-2x.png.svg` — iOS medium icon at 2x scale

---

## Usage Notes

### SVG Format
All assets are provided in SVG format for:
- Scalability without quality loss
- Small file sizes
- Easy color customization
- Web optimization

### Color Customization
SVG assets can be easily recustomized by editing the `<linearGradient>` definitions:
```xml
<stop offset="0%" stop-color="#YOUR_COLOR_1" />
<stop offset="100%" stop-color="#YOUR_COLOR_2" />
```

### Size Customization
SVGs are vector-based and can be scaled to any size. Update the `viewBox` and/or width/height attributes as needed.

---

## Asset Integration

### React Components
To use SVGs in React:
```tsx
import Logo from '../branding/logo/refdata-hub-primary.svg';

function App() {
  return <img src={Logo} alt="RefData Hub" />;
}
```

### HTML
To use SVGs in HTML:
```html
<img src="/branding/logo/refdata-hub-primary.svg" alt="RefData Hub" />
```

### CSS Backgrounds
To use patterns as backgrounds:
```css
.bg-pattern {
  background-image: url('/branding/patterns/dots-grid.svg');
  background-repeat: repeat;
}
```

---

*Version: 1.0 • Last Updated: 2026*
