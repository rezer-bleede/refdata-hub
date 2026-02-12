# RefData Hub Brand

This directory contains the complete brand identity system for RefData Hub.

---

## Directory Structure

```
branding/
├── logo/           # Logo variants (7 SVGs)
├── favicon/         # Favicon assets (3 SVGs)
├── app-icons/      # Application icons (4 SVGs)
│   ├── macos/
│   ├── windows/
│   ├── android/
│   └── ios/
├── social/         # Social media assets (5 SVGs)
├── ui-icons/       # UI icon set (15 SVGs)
├── patterns/       # Background patterns (2 SVGs)
└── docs/           # Brand documentation
    ├── brand-guidelines.md
    └── assets.md
```

---

## Getting Started

### Quick Access
- **Primary Logo:** `logo/refdata-hub-primary.svg`
- **Favicon:** `favicon/favicon.svg`
- **Twitter:** `social/twitter-profile.svg`
- **App Icon:** `app-icons/macos/icon_512x512.png.svg`

### Documentation
- [Brand Guidelines](./docs/brand-guidelines.md) — Complete brand system documentation
- [Assets Reference](./docs/assets.md) — Detailed asset listing and usage

---

## Usage Examples

### Web Integration
```html
<!-- Logo -->
<img src="/branding/logo/refdata-hub-primary.svg" alt="RefData Hub" />

<!-- Favicon -->
<link rel="icon" type="image/svg+xml" href="/branding/favicon/favicon.svg" />

<!-- Background Pattern -->
<style>
  .bg-pattern {
    background-image: url('/branding/patterns/dots-grid.svg');
  }
</style>
```

### React Integration
```tsx
import Logo from '@/branding/logo/refdata-hub-primary.svg';

export default function Header() {
  return <img src={Logo} alt="RefData Hub" className="h-8" />;
}
```

---

## Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| Aurora | `#6366f1` | Primary actions, accents |
| Neon | `#22d3ee` | Highlights, success |
| Midnight | `#0f172a` | Dark backgrounds |
| Slate-50 | `#f8fafc` | Light backgrounds |

---

## Typography

| Role | Font | Weight |
|------|------|--------|
| Headings | Space Grotesk | 600-700 |
| Body | Inter | 400-500 |
| UI Elements | Inter | 600 |
| Code | JetBrains Mono | 400-500 |

---

## Support

For brand-related questions or asset requests:
- 📖 [Read the Guidelines](./docs/brand-guidelines.md)
- 🐛 [Open an Issue](https://github.com/rezer-bleede/refdata-hub/issues)
- 💬 [Start a Discussion](https://github.com/rezer-bleede/refdata-hub/discussions)

---

*RefData Hub © 2026 — All rights reserved*
