# Screenshot Guidelines

This directory contains screenshots for RefData Hub documentation.

## Directory Structure

```
screenshots/
├── dashboard/          - Main dashboard and semantic matching
├── canonical-library/  - Canonical value management interface
├── connections/        - Source connection management
├── field-mappings/     - Field mapping configuration
├── match-insights/     - Analytics and coverage visualization
├── suggestions/        - Review and approval workflow
├── settings/           - Matcher and LLM configuration
└── navigation/         - Navigation rail and theme variants
```

## Standards

### Technical Specifications
- **Theme:** Dark mode (slate theme)
- **Format:** PNG
- **Max file size:** 500KB each
- **Min dimensions:** 1200x800
- **Recommended:** 1920x1080 for full pages, 1200x800 for modals
- **Include:** Navigation rail for context

### Naming Convention
- Use kebab-case: `semantic-playground.png`
- Group by page: `dashboard/`, `canonical-library/`
- Be descriptive: `bulk-import-modal.png`

## Before Capturing

1. **Clear browser state:**
   - Clear browser cache
   - Open DevTools console and clear errors
   - Disable browser extensions

2. **Prepare application:**
   - Run with seeded demo data (`docker compose up --build`)
   - Verify application is accessible at http://localhost:5173
   - Ensure no error toasts are showing
   - Wait for any loading states to complete

3. **Configure browser:**
   - Set zoom to 100%
   - Use dark/slate theme
   - Set viewport size for capture type:
     - Full pages: 1920x1080
     - Modals: 1200x800
     - Focused elements: 1000x600
   - Close DevTools before capture

4. **UI Preparation:**
   - Remove any temporary notifications or toasts
   - Ensure relevant data is visible
   - Where applicable, show focused input fields
   - Keep navigation rail visible

## Recommended Capture Tools

### macOS
- **Built-in:** `Cmd+Shift+4` (selection) or `Cmd+Shift+5` (full screen)
- **CleanShot X** - Professional annotations
- **Skitch** - Quick annotations

### Windows
- **Win+Shift+S** - Snipping Tool
- **ShareX** - Advanced capture and editing

### Cross-platform
- **Chromium DevTools** - Device emulation for responsive screenshots
- **Firefox Developer Tools** - Responsive design mode

## After Capturing

1. **Optimize file size:**
   - Use TinyPNG (https://tinypng.com) or similar
   - Aim for under 500KB per image
   - Maintain visual quality

2. **Add to documentation:**
   - Use descriptive alt text for accessibility
   - Add caption describing what's shown
   - Update relevant .md files with image references

3. **Test rendering:**
   - Test in both light and dark documentation themes
   - Verify responsive behavior on mobile
   - Check image displays correctly on GitHub Pages

## Required Screenshots

### Phase 1: Critical (Priority)
- [ ] `dashboard/overview.png` - Full dashboard view
- [ ] `dashboard/semantic-playground.png` - Matching demo
- [ ] `canonical-library/library-grid.png` - Main library interface
- [ ] `canonical-library/bulk-import-modal.png` - Import workflow
- [ ] `connections/connections-grid.png` - Source connections list

### Phase 2: Feature Documentation
- [ ] `field-mappings/mapping-grid.png` - Field mappings overview
- [ ] `match-insights/coverage-progress.png` - Analytics visualization
- [ ] `match-insights/matched-values.png` - Top matched values
- [ ] `suggestions/review-suggestions.png` - Approval workflow
- [ ] `settings/matcher-config.png` - Configuration interface
- [ ] `settings/llm-settings.png` - LLM configuration

### Phase 3: Supplementary
- [ ] `navigation/light-mode.png` - Theme variant
- [ ] `navigation/dark-mode.png` - Theme variant
- [ ] `navigation/midnight-mode.png` - Theme variant
- [ ] `connections/schema-explorer.png` - Schema inspection
- [ ] `field-mappings/create-mapping.png` - Mapping creation
- [ ] `field-mappings/sample-capture.png` - Sample data preview
- [ ] `canonical-library/column-mapping.png` - Column mapping workflow
- [ ] `canonical-library/edit-modal.png` - Edit canonical value
- [ ] `dashboard/match-results.png` - Match results table
- [ ] `connections/test-connection.png` - Connection testing
- [ ] `connections/connection-form.png` - Connection creation
- [ ] `match-insights/unmatched-preview.png` - Unmatched values

## Tips for Consistency

1. **Same theme throughout:** Use dark mode for all screenshots
2. **Consistent viewport:** Keep browser zoom at 100%
3. **Clean UI:** Remove temporary elements before capture
4. **Real data:** Use seeded demo data, not placeholders
5. **Full context:** Include navigation rail for pages
6. **High contrast:** Ensure text is clearly readable
7. **No personal info:** Mask any sensitive data if present

## Troubleshooting

### Images not displaying
- Verify file paths are correct relative to docs/
- Check file names match (case-sensitive on Linux)
- Ensure images are committed to Git

### Images too large
- Run through image optimizer (TinyPNG)
- Consider reducing resolution slightly
- Check if image includes unnecessary whitespace

### Images blurry
- Capture at 1x scale (not Retina 2x)
- Ensure zoom is at 100%
- Use PNG instead of JPEG for quality

## Documentation Updates

When adding screenshots to documentation:

```markdown
![Descriptive alt text](screenshots/folder/image.png "Optional title")

<!-- With caption -->
<figure>
  <img src="screenshots/folder/image.png" alt="Description" width="1200">
  <figcaption>Caption describing what's shown</figcaption>
</figure>
```

For more information, see the main documentation or the project README.
