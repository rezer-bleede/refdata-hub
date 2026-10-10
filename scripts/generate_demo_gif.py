import asyncio
import os
from playwright.async_api import async_playwright
from PIL import Image

async def capture_demo():
    frames = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Use a nice desktop resolution
        page = await browser.new_page(viewport={"width": 1280, "height": 720})

        async def record_frame(duration_seconds=1.5):
            path = f"/tmp/frame_{len(frames)}.png"
            await page.screenshot(path=path)
            img = Image.open(path)
            frames.append((img, int(duration_seconds * 1000)))

        # 1. Dashboard & Semantic Match Playground
        await page.goto("http://127.0.0.1:5274/")
        await page.wait_for_selector("text=Dashboard")
        await asyncio.sleep(1)
        await record_frame(2.0)

        # Type a value in Semantic Match Playground
        raw_input = page.locator("textarea")
        await raw_input.fill("")
        await raw_input.type("divorced", delay=100)
        await record_frame(1.0)

        # Click Run match
        await page.click("button:has-text('Run match')")
        await asyncio.sleep(1)
        await record_frame(2.5)

        # 2. Canonical Library
        await page.click("text=Canonical Library")
        await page.wait_for_selector("text=Canonical Library")
        await asyncio.sleep(1)
        await record_frame(2.0)

        # 3. Source Connections
        await page.click("text=Source Connections")
        await page.wait_for_selector("text=Source Connections")
        await asyncio.sleep(1)
        await record_frame(2.0)

        # 4. Match Insights
        await page.click("text=Match Insights")
        await page.wait_for_selector("text=Match Insights")
        await asyncio.sleep(1)
        await record_frame(2.0)

        # 5. Suggestions
        await page.click("text=Suggestions")
        await page.wait_for_selector("text=Suggestions")
        await asyncio.sleep(1)
        await record_frame(2.0)

        await browser.close()

    if frames:
        images = [f[0].convert("P", palette=Image.ADAPTIVE) for f in frames]
        durations = [f[1] for f in frames]
        os.makedirs("docs/screenshots", exist_ok=True)
        output_path = "docs/screenshots/demo.gif"
        images[0].save(
            output_path,
            save_all=True,
            append_images=images[1:],
            optimize=True,
            duration=durations,
            loop=0
        )
        print(f"Saved demo GIF to {output_path}")

if __name__ == "__main__":
    asyncio.run(capture_demo())
