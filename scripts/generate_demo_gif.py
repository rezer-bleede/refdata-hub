import asyncio
import os
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont

# Constants
UI_URL = "http://127.0.0.1:5274"
SCREENSHOTS_DIR = "docs/screenshots"

QUADRANT_TITLES = [
    "1. AI Semantic Matching & Playground",
    "2. Canonical Reference Library",
    "3. Source System Connections & Profiling",
    "4. Match Insights & Curation Workflow",
]

async def capture_use_cases():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

    uc1_frames = [] # Semantic Matching
    uc2_frames = [] # Canonical Library
    uc3_frames = [] # Source Connections
    uc4_frames = [] # Match Insights & Curation

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Use a high-quality 16:9 aspect ratio viewport
        viewport = {"width": 1280, "height": 720}

        # ----------------------------------------------------
        # Use Case 1: AI Semantic Matching & Playground
        # ----------------------------------------------------
        print("Capturing Use Case 1: AI Semantic Matching & Playground...")
        context1 = await browser.new_context(viewport=viewport)
        page1 = await context1.new_page()
        await page1.goto(f"{UI_URL}/")
        await page1.wait_for_selector("text=Dashboard", timeout=10000)
        await asyncio.sleep(1)

        # Record initial frame
        path = "/tmp/uc1_0.png"
        await page1.screenshot(path=path)
        uc1_frames.append((Image.open(path), 1200))

        # Type in playground
        textarea = page1.locator("textarea")
        if await textarea.count() > 0:
            await textarea.fill("")
            await textarea.type("never married", delay=80)
            await asyncio.sleep(0.5)
            path = "/tmp/uc1_1.png"
            await page1.screenshot(path=path)
            uc1_frames.append((Image.open(path), 1000))

            # Click Run match
            run_btn = page1.locator("button:has-text('Run match')")
            if await run_btn.count() > 0:
                await run_btn.click()
                await asyncio.sleep(1.2)
                path = "/tmp/uc1_2.png"
                await page1.screenshot(path=path)
                uc1_frames.append((Image.open(path), 2000))
        await context1.close()

        # ----------------------------------------------------
        # Use Case 2: Canonical Reference Library
        # ----------------------------------------------------
        print("Capturing Use Case 2: Canonical Reference Library...")
        context2 = await browser.new_context(viewport=viewport)
        page2 = await context2.new_page()
        await page2.goto(f"{UI_URL}/canonical")
        await page2.wait_for_selector("text=Canonical Library", timeout=10000)
        await asyncio.sleep(1)

        path = "/tmp/uc2_0.png"
        await page2.screenshot(path=path)
        uc2_frames.append((Image.open(path), 1500))

        # Filter or search in library
        search_input = page2.locator("input[placeholder*='Search'], input[type='text']").first
        if await search_input.count() > 0:
            await search_input.type("marital", delay=100)
            await asyncio.sleep(0.8)
            path = "/tmp/uc2_1.png"
            await page2.screenshot(path=path)
            uc2_frames.append((Image.open(path), 2700))
        await context2.close()

        # ----------------------------------------------------
        # Use Case 3: Source System Connections & Profiling
        # ----------------------------------------------------
        print("Capturing Use Case 3: Source System Connections & Profiling...")
        context3 = await browser.new_context(viewport=viewport)
        page3 = await context3.new_page()
        await page3.goto(f"{UI_URL}/connections")
        await page3.wait_for_selector("text=Source Connections", timeout=10000)
        await asyncio.sleep(1)

        path = "/tmp/uc3_0.png"
        await page3.screenshot(path=path)
        uc3_frames.append((Image.open(path), 1500))

        # Click on connection row if available
        conn_link = page3.locator("a[href*='/connections/'], button:has-text('Inspect')").first
        if await conn_link.count() > 0:
            await conn_link.click()
            await asyncio.sleep(1.2)
            path = "/tmp/uc3_1.png"
            await page3.screenshot(path=path)
            uc3_frames.append((Image.open(path), 2700))
        else:
            # Fallback frame duration
            uc3_frames[0] = (uc3_frames[0][0], 4200)
        await context3.close()

        # ----------------------------------------------------
        # Use Case 4: Match Insights & Curation Workflow
        # ----------------------------------------------------
        print("Capturing Use Case 4: Match Insights & Curation Workflow...")
        context4 = await browser.new_context(viewport=viewport)
        page4 = await context4.new_page()
        await page4.goto(f"{UI_URL}/match-insights")
        await page4.wait_for_selector("text=Match Insights", timeout=10000)
        await asyncio.sleep(1)

        path = "/tmp/uc4_0.png"
        await page4.screenshot(path=path)
        uc4_frames.append((Image.open(path), 1500))

        # Navigate to Suggestions for Curation
        await page4.goto(f"{UI_URL}/suggestions")
        await asyncio.sleep(1.2)
        path = "/tmp/uc4_1.png"
        await page4.screenshot(path=path)
        uc4_frames.append((Image.open(path), 2700))
        await context4.close()

        await browser.close()

    # Function to create animated GIF from frames
    def create_gif(frames, output_path):
        images = [f[0].convert("P", palette=Image.ADAPTIVE) for f in frames]
        durations = [f[1] for f in frames]
        images[0].save(
            output_path,
            save_all=True,
            append_images=images[1:],
            optimize=True,
            duration=durations,
            loop=0,
        )
        print(f"Saved GIF: {output_path}")

    # Save individual use case GIFs
    create_gif(uc1_frames, os.path.join(SCREENSHOTS_DIR, "demo_semantic_matching.gif"))
    create_gif(uc2_frames, os.path.join(SCREENSHOTS_DIR, "demo_canonical_library.gif"))
    create_gif(uc3_frames, os.path.join(SCREENSHOTS_DIR, "demo_source_connections.gif"))
    create_gif(uc4_frames, os.path.join(SCREENSHOTS_DIR, "demo_match_insights.gif"))

    # ----------------------------------------------------
    # Generate Multi-tiled 4-Quadrant Composite GIF (demo.gif)
    # ----------------------------------------------------
    print("Generating multi-tiled 4-quadrant demo.gif...")

    # Ensure all clip lists have matching frame count for sync loop
    max_frames = max(len(uc1_frames), len(uc2_frames), len(uc3_frames), len(uc4_frames))

    def get_frame(frames_list, idx):
        if idx < len(frames_list):
            return frames_list[idx][0]
        return frames_list[-1][0]

    composite_frames = []
    durations = []

    quad_width, quad_height = 640, 360
    canvas_width, canvas_height = 1280, 720

    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 16)
    except IOError:
        font = ImageFont.load_default()

    for i in range(max_frames):
        img1 = get_frame(uc1_frames, i).resize((quad_width, quad_height), Image.Resampling.LANCZOS)
        img2 = get_frame(uc2_frames, i).resize((quad_width, quad_height), Image.Resampling.LANCZOS)
        img3 = get_frame(uc3_frames, i).resize((quad_width, quad_height), Image.Resampling.LANCZOS)
        img4 = get_frame(uc4_frames, i).resize((quad_width, quad_height), Image.Resampling.LANCZOS)

        canvas = Image.new("RGB", (canvas_width, canvas_height), (15, 23, 42)) # Slate 900 background

        # Tile 4 quadrants (2x2 grid)
        canvas.paste(img1, (0, 0))
        canvas.paste(img2, (quad_width, 0))
        canvas.paste(img3, (0, quad_height))
        canvas.paste(img4, (quad_width, quad_height))

        # Add quadrant header overlays & subtle grid divider borders
        draw = ImageDraw.Draw(canvas)

        # Grid divider lines
        draw.line([(quad_width, 0), (quad_width, canvas_height)], fill=(51, 65, 85), width=3) # Slate 700
        draw.line([(0, quad_height), (canvas_width, quad_height)], fill=(51, 65, 85), width=3)

        # Overlay titles
        positions = [(10, 10), (quad_width + 10, 10), (10, quad_height + 10), (quad_width + 10, quad_height + 10)]
        for title, pos in zip(QUADRANT_TITLES, positions):
            # Banner background rectangle
            text_bbox = font.getbbox(title)
            tw, th = text_bbox[2] - text_bbox[0], text_bbox[3] - text_bbox[1]
            draw.rectangle([pos[0], pos[1], pos[0] + tw + 16, pos[1] + th + 12], fill=(15, 23, 42, 220), outline=(99, 102, 241), width=1)
            draw.text((pos[0] + 8, pos[1] + 6), title, fill=(248, 250, 252), font=font)

        # Duration based on max duration at step
        dur = max(
            uc1_frames[min(i, len(uc1_frames)-1)][1],
            uc2_frames[min(i, len(uc2_frames)-1)][1],
            uc3_frames[min(i, len(uc3_frames)-1)][1],
            uc4_frames[min(i, len(uc4_frames)-1)][1],
        )
        composite_frames.append(canvas)
        durations.append(dur)

    master_gif_path = os.path.join(SCREENSHOTS_DIR, "demo.gif")
    comp_images = [f.convert("P", palette=Image.ADAPTIVE) for f in composite_frames]
    comp_images[0].save(
        master_gif_path,
        save_all=True,
        append_images=comp_images[1:],
        optimize=True,
        duration=durations,
        loop=0,
    )
    print(f"Saved master composite 4-quadrant GIF: {master_gif_path}")

if __name__ == "__main__":
    asyncio.run(capture_use_cases())
