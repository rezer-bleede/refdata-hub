#!/usr/bin/env python3
"""
Screenshot optimization utility for RefData Hub documentation.

This script provides functions to validate and prepare screenshots for documentation.
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# Screenshot directory
SCREENSHOTS_DIR = Path(__file__).parent.parent / "docs" / "screenshots"

# Required screenshots with minimum dimensions
REQUIRED_SCREENS = {
    "dashboard": {
        "overview.png": (1920, 1080),
        "semantic-playground.png": (1200, 800),
        "match-results.png": (1000, 600),
    },
    "canonical-library": {
        "library-grid.png": (1600, 900),
        "bulk-import-modal.png": (1400, 900),
        "column-mapping.png": (1200, 700),
        "edit-modal.png": (1000, 600),
    },
    "connections": {
        "connections-grid.png": (1600, 900),
        "connection-form.png": (1200, 800),
        "test-connection.png": (1000, 500),
        "schema-explorer.png": (1600, 900),
    },
    "field-mappings": {
        "mapping-grid.png": (1600, 900),
        "create-mapping.png": (1200, 800),
        "sample-capture.png": (1400, 800),
    },
    "match-insights": {
        "coverage-progress.png": (1200, 600),
        "matched-values.png": (1400, 700),
        "unmatched-preview.png": (1200, 600),
    },
    "suggestions": {
        "review-suggestions.png": (1600, 900),
    },
    "settings": {
        "matcher-config.png": (1200, 700),
        "llm-settings.png": (1200, 600),
    },
    "navigation": {
        "light-mode.png": (600, 800),
        "dark-mode.png": (600, 800),
        "midnight-mode.png": (600, 800),
    },
}

# File size limits (in bytes)
MAX_FILE_SIZE = 500 * 1024  # 500KB


def get_image_size(image_path: Path) -> Tuple[int, int]:
    """
    Get image dimensions using PIL.

    Args:
        image_path: Path to the image file

    Returns:
        Tuple of (width, height)
    """
    try:
        from PIL import Image

        with Image.open(image_path) as img:
            return img.size
    except ImportError:
        print("⚠️  PIL/Pillow not installed. Install with: pip install Pillow")
        return (0, 0)
    except Exception as e:
        print(f"⚠️  Error reading {image_path}: {e}")
        return (0, 0)


def validate_screenshots() -> Dict[str, List[str]]:
    """
    Validate all required screenshots exist and meet minimum size requirements.

    Returns:
        Dictionary with 'missing', 'undersized', and 'oversized' lists
    """
    results = {
        "missing": [],
        "undersized": [],
        "oversized": [],
        "valid": [],
    }

    for category, screens in REQUIRED_SCREENS.items():
        for filename, min_dims in screens.items():
            image_path = SCREENSHOTS_DIR / category / filename

            if not image_path.exists():
                results["missing"].append(f"{category}/{filename}")
                continue

            # Check file size
            file_size = image_path.stat().st_size
            if file_size > MAX_FILE_SIZE:
                results["oversized"].append(
                    f"{category}/{filename} ({file_size / 1024:.1f} KB > 500 KB)"
                )

            # Check dimensions (only if file is not a placeholder)
            if file_size < 1000:  # Likely a placeholder
                continue

            width, height = get_image_size(image_path)
            min_width, min_height = min_dims

            if width < min_width or height < min_height:
                results["undersized"].append(
                    f"{category}/{filename} ({width}x{height} < {min_width}x{min_height})"
                )

            if not (
                f"{category}/{filename}" in results["missing"]
                or f"{category}/{filename}" in results["undersized"]
                or f"{category}/{filename}" in results["oversized"]
            ):
                results["valid"].append(f"{category}/{filename}")

    return results


def print_validation_report(results: Dict[str, List[str]]) -> int:
    """Print a formatted validation report and return exit code."""
    print("\n" + "=" * 70)
    print("SCREENSHOT VALIDATION REPORT")
    print("=" * 70)

    total_required = sum(len(screens) for screens in REQUIRED_SCREENS.values())
    total_valid = len(results["valid"])
    total_missing = len(results["missing"])
    total_undersized = len(results["undersized"])
    total_oversized = len(results["oversized"])

    print(f"\nTotal Required: {total_required}")
    print(f"✅ Valid: {total_valid}")
    print(f"❌ Missing: {total_missing}")
    print(f"⚠️  Undersized: {total_undersized}")
    print(f"⚠️  Oversized: {total_oversized}")

    if results["missing"]:
        print("\n" + "-" * 70)
        print("MISSING SCREENSHOTS:")
        print("-" * 70)
        for item in results["missing"]:
            print(f"  ❌ {item}")

    if results["undersized"]:
        print("\n" + "-" * 70)
        print("UNDERSIZED SCREENSHOTS:")
        print("-" * 70)
        for item in results["undersized"]:
            print(f"  ⚠️  {item}")

    if results["oversized"]:
        print("\n" + "-" * 70)
        print("OVERSIZED SCREENSHOTS (>500KB):")
        print("-" * 70)
        for item in results["oversized"]:
            print(f"  ⚠️  {item}")

    if results["valid"]:
        print("\n" + "-" * 70)
        print("VALID SCREENSHOTS:")
        print("-" * 70)
        for item in results["valid"]:
            print(f"  ✅ {item}")

    print("\n" + "=" * 70)

    # Return exit code
    if total_missing > 0:
        return 1
    return 0


def list_all_screenshots() -> None:
    """List all screenshots in the directory structure."""
    print("\n" + "=" * 70)
    print("ALL SCREENSHOTS IN DIRECTORY")
    print("=" * 70)

    for category_dir in sorted(SCREENSHOTS_DIR.iterdir()):
        if not category_dir.is_dir():
            continue

        print(f"\n{category_dir.name}/")
        for image_file in sorted(category_dir.glob("*.png")):
            file_size = image_file.stat().st_size
            width, height = get_image_size(image_file)
            print(
                f"  {image_file.name:40s} {file_size/1024:6.1f} KB  {width:4d}x{height:4d}"
            )


def create_placeholder_screenshots() -> None:
    """Create placeholder files for missing screenshots."""
    import base64

    placeholder_content = """iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="""

    created = 0
    for category, screens in REQUIRED_SCREENS.items():
        category_dir = SCREENSHOTS_DIR / category
        category_dir.mkdir(parents=True, exist_ok=True)

        for filename in screens.keys():
            image_path = category_dir / filename
            if not image_path.exists():
                with open(image_path, "wb") as f:
                    f.write(base64.b64decode(placeholder_content))
                print(f"✅ Created placeholder: {category}/{filename}")
                created += 1

    if created == 0:
        print("ℹ️  All placeholders already exist")
    else:
        print(f"\n✅ Created {created} placeholder files")


def main():
    """Main entry point."""
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()

        if command == "validate":
            results = validate_screenshots()
            exit_code = print_validation_report(results)
            sys.exit(exit_code)

        elif command == "list":
            list_all_screenshots()

        elif command == "placeholders":
            create_placeholder_screenshots()

        elif command == "help":
            print("""
Screenshot Utility for RefData Hub Documentation

Commands:
  validate      Validate all screenshots exist and meet size requirements
  list          List all screenshots in the directory
  placeholders  Create placeholder files for missing screenshots
  help          Show this help message

Examples:
  python scripts/screenshot_util.py validate
  python scripts/screenshot_util.py list
  python scripts/screenshot_util.py placeholders
            """)

        else:
            print(f"Unknown command: {command}")
            print("Run 'python screenshot_util.py help' for usage")
            sys.exit(1)
    else:
        # Default to validation
        results = validate_screenshots()
        exit_code = print_validation_report(results)
        sys.exit(exit_code)


if __name__ == "__main__":
    main()
