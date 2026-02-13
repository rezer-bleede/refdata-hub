# Screenshot Capture Guide

This guide explains how to capture professional screenshots for RefData Hub documentation.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Before You Start](#before-you-start)
- [Recommended Tools](#recommended-tools)
- [Capturing Screenshots](#capturing-screenshots)
- [Screenshot Checklist](#screenshot-checklist)
- [Optimizing Screenshots](#optimizing-screenshots)
- [Common Issues](#common-issues)

---

## Prerequisites

1. **RefData Hub Application Running**
   ```bash
   docker compose up --build
   ```
   Wait for all services to start (approximately 2-3 minutes).

2. **Demo Data Loaded**
   The application should be seeded with demo canonical values and the `targetdb` should be populated.

3. **Browser Preparation**
   - Chrome, Firefox, or Safari
   - Browser zoom set to 100%
   - Dark mode theme selected in the application

---

## Before You Start

### Clear Browser State

1. Open Developer Tools (F12 or Cmd+Option+I)
2. Clear the console
3. Clear browser cache if needed
4. Disable any browser extensions that might interfere

### Prepare Application State

1. Navigate to http://localhost:5173
2. Ensure no error toasts are displaying
3. Wait for any loading states to complete
4. Verify the application theme is set to **Dark Mode**

### Set Browser Viewport

For consistent screenshots, set your browser window size:

- **Full pages:** 1920x1080 (or maximized on 1080p display)
- **Modals:** 1200x800
- **Focused elements:** 1000x600

You can use browser DevTools to set exact viewport sizes:
1. Open DevTools (F12)
2. Toggle device toolbar (Cmd+Shift+M)
3. Enter desired dimensions

---

## Recommended Tools

### macOS

**Built-in:**
- `Cmd+Shift+4` - Capture selection
- `Cmd+Shift+5` - Full screen with controls
- `Cmd+Ctrl+Shift+4` - Capture selection to clipboard

**Third-party:**
- **CleanShot X** - Professional annotations, scrolling captures
- **Skitch** - Quick annotations and markup
- **Snagit** - Advanced editing capabilities

### Windows

**Built-in:**
- `Win+Shift+S` - Snipping Tool
- `Win+PrtScn` - Capture entire screen to Pictures folder

**Third-party:**
- **ShareX** - Advanced capture, editing, and upload
- **Snagit** - Comprehensive screen capture
- **ScreenToGif** - For creating GIFs/animations

### Cross-Platform

- **Chromium DevTools** - Device emulation for responsive screenshots
- **Firefox Developer Tools** - Responsive design mode

---

## Capturing Screenshots

### General Tips

1. **Use Dark Mode:** All screenshots should use the dark/slate theme for consistency
2. **Include Navigation:** For full page screenshots, include the left navigation rail
3. **Clean UI:** Remove temporary notifications, toasts, or loading indicators
4. **Real Data:** Use seeded demo data, not placeholder text
5. **Focused Elements:** Where applicable, show focused input fields
6. **No Personal Info:** Mask any sensitive data if present

### Screenshot-Specific Instructions

#### Dashboard (`dashboard/`)

**overview.png** (1920x1080)
1. Navigate to Dashboard
2. Ensure coverage metrics are visible
3. Ensure semantic matching playground is visible
4. Wait for all data to load

**semantic-playground.png** (1200x800)
1. Scroll to semantic matching section
2. Enter a sample value (e.g., "never married")
3. Let suggestions appear
4. Capture with confidence scores visible

**match-results.png** (1000x600)
1. Run a match in the playground
2. Capture the results table
3. Ensure top suggestions are visible

#### Canonical Library (`canonical-library/`)

**library-grid.png** (1600x900)
1. Navigate to Canonical Library
2. Filter to a dimension (e.g., "marital_status")
3. Ensure multiple rows are visible
4. Show dimension badges

**bulk-import-modal.png** (1400x900)
1. Click "Bulk import"
2. Have a sample file ready to upload
3. Capture the modal before uploading

**column-mapping.png** (1200x700)
1. Upload a sample file
2. Click "Review mappings"
3. Capture the column mapping interface

**edit-modal.png** (1000x600)
1. Click "Edit" on any canonical value
2. Capture the edit modal
3. Show dimension-specific attributes if available

#### Connections (`connections/`)

**connections-grid.png** (1600x900)
1. Navigate to Source Connections
2. Ensure the demo `targetdb` connection is visible
3. Show connection status indicators

**connection-form.png** (1200x800)
1. Click "New connection"
2. Capture the connection form
3. Fill in sample values (don't save)

**test-connection.png** (1000x500)
1. Click "Test connection" on demo connection
2. Capture the success message with latency

**schema-explorer.png** (1600x900)
1. Click on a connection to view details
2. Navigate to schema explorer
3. Show table/column structure

#### Field Mappings (`field-mappings/`)

**mapping-grid.png** (1600x900)
1. Navigate to Field Mappings
2. Show existing mappings with match statistics

**create-mapping.png** (1200x800)
1. Click "New mapping"
2. Capture the mapping creation form
3. Show sample capture workflow

**sample-capture.png** (1400x800)
1. Create a mapping and click "Capture samples"
2. Show the sample values interface

#### Match Insights (`match-insights/`)

**coverage-progress.png** (1200x600)
1. Navigate to Match Insights
2. Show coverage progress bars

**matched-values.png** (1400x700)
1. Scroll to "Top Matched Values" section
2. Show matched values with confidence scores

**unmatched-preview.png** (1200x600)
1. Scroll to "Unmatched Values" section
2. Show unmatched values with suggestions

#### Suggestions (`suggestions/`)

**review-suggestions.png** (1600x900)
1. Navigate to Suggestions page
2. Filter by connection if needed
3. Show unmatched values with inline suggestions

#### Settings (`settings/`)

**matcher-config.png** (1200x700)
1. Navigate to Settings
2. Capture matcher configuration section
3. Show threshold and top-k settings

**llm-settings.png** (1200x600)
1. Scroll to LLM configuration section
2. Show online/offline mode toggle
3. Show model selection and API settings

#### Navigation (`navigation/`)

**light-mode.png**, **dark-mode.png**, **midnight-mode.png** (600x800)
1. Change theme in application settings
2. Capture the navigation rail
3. Show collapsed and expanded states if possible

---

## Screenshot Checklist

Before finalizing a screenshot, verify:

- [ ] Application is running with demo data
- [ ] Browser is in dark mode
- [ ] Browser zoom is at 100%
- [ ] Console is clear (no errors)
- [ ] No temporary notifications/toasts visible
- [ ] Relevant page/section is visible
- [ ] Sufficient contrast and readability
- [ ] Navigation elements visible (for pages)
- [ ] Image is in PNG format
- [ ] File size is under 500KB
- [ ] Minimum dimensions met

---

## Optimizing Screenshots

### Using TinyPNG

1. Visit https://tinypng.com
2. Drag and drop your screenshots
3. Download optimized versions
4. Replace original files

### Using ImageOptim (macOS)

```bash
# Install with Homebrew
brew install --cask imageoptim

# Optimize all screenshots
imageoptim docs/screenshots/**/*.png
```

### Using Python Script

A validation and optimization script is provided:

```bash
# Validate all screenshots
python scripts/screenshot_util.py validate

# List all screenshots with sizes
python scripts/screenshot_util.py list

# Create missing placeholders
python scripts/screenshot_util.py placeholders
```

### Manual Optimization Tips

1. **Crop Unnecessary Space:** Remove excessive whitespace around content
2. **Reduce Color Depth:** If applicable, reduce from 32-bit to 24-bit PNG
3. **Avoid Compression Artifacts:** Use PNG, not JPEG for screenshots
4. **Check File Size:** Aim for under 500KB per image

---

## Common Issues

### Images Not Displaying

**Problem:** Screenshots show as broken images in documentation.

**Solutions:**
1. Verify file paths are correct (check case sensitivity)
2. Ensure images are committed to Git
3. Check file permissions
4. Run `mkdocs build` to verify static files are included

### Images Too Large

**Problem:** Screenshot file size exceeds 500KB.

**Solutions:**
1. Run through TinyPNG or ImageOptim
2. Crop unnecessary whitespace
3. Reduce window size before capture
4. Consider using PNG compression tools

### Images Blurry

**Problem:** Screenshots appear blurry or pixelated.

**Solutions:**
1. Capture at 1x scale (disable Retina/HiDPI if possible)
2. Ensure browser zoom is at 100%
3. Use PNG format instead of JPEG
4. Increase viewport size and capture at native resolution

### Theme Inconsistency

**Problem:** Some screenshots are in light mode, others in dark.

**Solutions:**
1. Always use dark mode for consistency
2. Check application theme settings before each capture
3. Document theme requirements in the screenshot checklist

### Temporary UI Elements

**Problem:** Loading spinners or notifications appear in screenshots.

**Solutions:**
1. Wait for all loading to complete
2. Clear notifications before capture
3. Use browser DevTools to hide elements temporarily (optional)

---

## Validation

After capturing screenshots, run the validation script:

```bash
python scripts/screenshot_util.py validate
```

This will check:
- All required screenshots exist
- File sizes are within limits
- Dimensions meet minimum requirements

---

## Next Steps

1. Capture all required screenshots following the checklist
2. Optimize file sizes using the tools above
3. Run validation script to verify compliance
4. Commit screenshots to Git
5. Test GitHub Pages deployment

For questions or issues, refer to the main documentation or open an issue on GitHub.
