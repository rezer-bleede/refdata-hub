/*
  RefData Hub documentation theme switcher.

  Ports the Reviewer UI theme engine (reviewer-ui/src/themes.ts) to the docs
  site. The palette table below must stay in sync with `themeDefinitions` in
  that file; `swatch` values are bg / surface / accent.

  Behaviour deliberately mirrors the app:
    - localStorage key is the same string ("refdata-hub:theme-choice") so a
      visitor who switched themes in the app gets the same palette here.
    - "system" resolves against prefers-color-scheme.
    - <meta name="theme-color"> is rewritten to the palette accent so mobile
      browser chrome matches.
    - The stored value is applied by an inline script in overrides/main.html
      before first paint; this file handles hydration, the picker UI, and
      reacting to OS theme changes.
*/

(function () {
  "use strict";

  // Material loads this script with a path relative to the current page, so it
  // is wrong to build asset URLs from the document root: any page inside a
  // directory (e.g. /architecture/) would request
  // /architecture/assets/... and 404. Derive a base from this script's own
  // src instead, which is always correct at any nesting depth.
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";

  var STORAGE_KEY = "refdata-hub:theme-choice";
  var DARK_IDS = [
    "dark",
    "midnight-marina",
    "burj-gold",
    "aurora",
    "classic-dark",
    "midnight",
  ];

  var THEMES = [
    {
      id: "system",
      name: "System",
      mode: "auto",
      description: "Follows your OS light or dark preference",
      swatch: { bg: "#f8fafc", surface: "#ffffff", accent: "#4f46e5" },
    },
    {
      id: "light",
      name: "Light",
      mode: "light",
      description: "Clean, crisp light dashboard theme",
      swatch: { bg: "#f8fafc", surface: "#ffffff", accent: "#4f46e5" },
    },
    {
      id: "dark",
      name: "Dark",
      mode: "dark",
      description: "Classic dark mode for low-light environments",
      swatch: { bg: "#0b0f19", surface: "#111827", accent: "#6366f1" },
    },
    {
      id: "midnight-marina",
      name: "Midnight Marina",
      mode: "dark",
      description: "Deep navy base with electric cyan and teal accents",
      swatch: { bg: "#030712", surface: "#0b1329", accent: "#06b6d4" },
    },
    {
      id: "burj-gold",
      name: "Burj Gold",
      mode: "dark",
      description: "Near-black base with luxury champagne gold accents",
      swatch: { bg: "#0b0b0d", surface: "#141417", accent: "#d4af37" },
    },
    {
      id: "desert-dusk",
      name: "Desert Dusk",
      mode: "light",
      description: "Warm sand base with terracotta and amber sunset tones",
      swatch: { bg: "#faf6f0", surface: "#fffdfa", accent: "#c85a32" },
    },
    {
      id: "oasis",
      name: "Oasis",
      mode: "light",
      description: "Fresh off-white base with emerald and mint accents",
      swatch: { bg: "#f4f8f6", surface: "#ffffff", accent: "#059669" },
    },
    {
      id: "aurora",
      name: "Aurora",
      mode: "dark",
      description: "Deep violet base with vibrant magenta and cyan gradients",
      swatch: { bg: "#090714", surface: "#120e24", accent: "#d946ef" },
    },
    {
      id: "coral-reef",
      name: "Coral Reef",
      mode: "light",
      description: "Bright airy base with coral and turquoise accents",
      swatch: { bg: "#f7fafc", surface: "#ffffff", accent: "#ff6b6b" },
    },
    {
      id: "harbour-blue",
      name: "Harbour Blue",
      mode: "light",
      description: "Honolulu-blue actions with hairline borders",
      swatch: { bg: "#f5f7fa", surface: "#ffffff", accent: "#226db4" },
    },
    {
      id: "classic-dark",
      name: "Classic Dark",
      mode: "dark",
      description: "Original RefData Hub aurora-on-abyss palette",
      swatch: { bg: "#020617", surface: "#0f172a", accent: "#6366f1" },
    },
    {
      id: "classic-light",
      name: "Classic Light",
      mode: "light",
      description: "Original RefData Hub light workspace palette",
      swatch: { bg: "#f8fafc", surface: "#ffffff", accent: "#6366f1" },
    },
    {
      id: "midnight",
      name: "Midnight",
      mode: "dark",
      description: "Original RefData Hub deep indigo midnight palette",
      swatch: { bg: "#0b1224", surface: "#111827", accent: "#818cf8" },
    },
  ];

  var BY_ID = THEMES.reduce(function (acc, theme) {
    acc[theme.id] = theme;
    return acc;
  }, {});

  function isValidId(value) {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(BY_ID, value);
  }

  function getSystemMode() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function resolve(choice) {
    if (choice === "system") {
      var mode = getSystemMode();
      return { id: mode, mode: mode };
    }
    var theme = BY_ID[choice] || BY_ID.light;
    return { id: theme.id, mode: theme.mode === "dark" ? "dark" : "light" };
  }

  function readStored() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      return isValidId(stored) ? stored : "light";
    } catch (error) {
      return "light";
    }
  }

  function persist(choice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch (error) {
      /* private mode, quota, or disabled storage: theme still applies */
    }
  }

  function apply(choice) {
    var resolved = resolve(choice);
    var root = document.documentElement;
    var theme = BY_ID[resolved.id];

    root.setAttribute("data-theme", resolved.id);
    // Material's own stylesheet is scheme-based; keep it in step so header,
    // search, and footer accents follow the palette too.
    root.setAttribute(
      "data-md-color-scheme",
      resolved.mode === "dark" ? "slate" : "default"
    );
    // Mirrors the anti-flash script in overrides/main.html. Also drives
    // mermaid's light/dark diagram theme.
    root.classList.toggle("rdh-dark", resolved.mode === "dark");

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && theme) {
      meta.setAttribute("content", theme.swatch.accent);
    }

    return resolved;
  }

  /* ---------------------------------------------------------------- picker */

  function buildPreview(swatch) {
    var preview = document.createElement("span");
    preview.className = "rdh-themes__preview";
    preview.setAttribute("aria-hidden", "true");
    [swatch.bg, swatch.surface, swatch.accent].forEach(function (color) {
      var dot = document.createElement("span");
      dot.style.backgroundColor = color;
      preview.appendChild(dot);
    });
    return preview;
  }

  function mountPicker(container, currentChoice) {
    var resolved = resolve(currentChoice);

    var button = document.createElement("button");
    button.type = "button";
    button.className = "rdh-themes__button";
    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Change colour theme");

    var swatch = document.createElement("span");
    swatch.className = "rdh-themes__swatch";
    swatch.setAttribute("aria-hidden", "true");

    var label = document.createElement("span");
    label.className = "rdh-themes__label";

    button.appendChild(swatch);
    button.appendChild(label);

    var menu = document.createElement("div");
    menu.className = "rdh-themes__menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;

    var heading = document.createElement("p");
    heading.className = "rdh-themes__heading";
    heading.textContent = "Palette";
    menu.appendChild(heading);

    var options = {};

    THEMES.forEach(function (theme) {
      var option = document.createElement("button");
      option.type = "button";
      option.className = "rdh-themes__option";
      option.setAttribute("role", "menuitemradio");
      option.setAttribute("aria-checked", "false");
      option.dataset.themeId = theme.id;
      option.appendChild(buildPreview(theme.swatch));

      var body = document.createElement("span");
      body.className = "rdh-themes__option-body";

      var name = document.createElement("span");
      name.textContent = theme.name;
      body.appendChild(name);

      var desc = document.createElement("span");
      desc.className = "rdh-themes__option-desc";
      desc.textContent = theme.description;
      body.appendChild(desc);

      option.appendChild(body);
      option.addEventListener("click", function () {
        persist(theme.id);
        // Repaint the document, not just the picker. Omitting this left the
        // page on the old palette until the next full page load.
        apply(theme.id);
        repaint(theme.id);
        closeMenu();
        button.focus();
      });

      menu.appendChild(option);
      options[theme.id] = option;
    });

    function repaint(choice) {
      var next = resolve(choice);
      var theme = BY_ID[next.id];
      swatch.style.backgroundColor = theme.swatch.accent;
      label.textContent = theme.name;
      Object.keys(options).forEach(function (id) {
        options[id].setAttribute("aria-checked", id === next.id ? "true" : "false");
      });
    }

    function openMenu() {
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
      var active = options[resolved.id] || options[choice];
      if (active) active.focus();
    }

    function closeMenu() {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }

    function toggleMenu() {
      if (menu.hidden) {
        openMenu();
      } else {
        closeMenu();
      }
    }

    button.addEventListener("click", toggleMenu);

    document.addEventListener("click", function (event) {
      if (!menu.hidden && !container.contains(event.target)) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (menu.hidden) return;
      if (event.key === "Escape") {
        closeMenu();
        button.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      var items = Object.keys(options).map(function (id) {
        return options[id];
      });
      var index = items.indexOf(document.activeElement);
      var nextIndex =
        event.key === "ArrowDown"
          ? (index + 1) % items.length
          : (index - 1 + items.length) % items.length;
      event.preventDefault();
      items[nextIndex].focus();
    });

    container.appendChild(button);
    container.appendChild(menu);
    repaint(choice);

    // Returned so callers can resync the picker without re-reading storage.
    return repaint;
  }

  /* ------------------------------------------------------------------ boot */

  var choice = readStored();
  apply(choice);

  var sync = null;

  function boot() {
    apply(choice);
    var container = document.querySelector("[data-rdh-themes]");
    if (container && !container.dataset.rdhReady) {
      container.dataset.rdhReady = "true";
      sync = mountPicker(container, choice);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Re-resolve "system" when the OS preference flips mid-session.
  if (window.matchMedia) {
    var query = window.matchMedia("(prefers-color-scheme: dark)");
    var onChange = function () {
      if (readStored() === "system") {
        apply("system");
        if (sync) sync("system");
      }
    };
    if (query.addEventListener) {
      query.addEventListener("change", onChange);
    } else if (query.addListener) {
      query.addListener(onChange);
    }
  }

  /* --------------------------------------------------------------- mermaid */

  // Mermaid renders by replacing each `.mermaid` element's contents with an
  // <svg>, and it only processes nodes that are not marked `data-processed`.
  // Re-rendering therefore requires putting the original diagram source back
  // first: simply dropping `data-processed` leaves mermaid with no text to
  // parse, which surfaces as an `aria-roledescription="error"` diagram.
  //
  // Calls are also serialised through `rendering`. Concurrent run() calls on
  // overlapping node sets detach each other's nodes and silently drop the SVG.

  var rendering = false;
  var mermaidRequested = false;

  function mermaidConfig() {
    return {
      startOnLoad: false,
      securityLevel: "loose",
      theme: document.documentElement.classList.contains("rdh-dark")
        ? "dark"
        : "default",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
    };
  }

  function stash(node) {
    if (!node.dataset.rdhSrc) {
      node.dataset.rdhSrc = node.textContent.trim();
    }
  }

  function restore(node) {
    node.removeAttribute("data-processed");
    node.innerHTML = "";
    node.textContent = node.dataset.rdhSrc || "";
  }

  function fail(nodes, message) {
    nodes.forEach(function (node) {
      node.innerHTML = '<p class="mermaid-loading">' + message + "</p>";
    });
  }

  function renderMermaid(root) {
    if (rendering || typeof window.mermaid === "undefined") return;


    var all = (root || document).querySelectorAll(".mermaid");
    if (!all.length) return;

    var pending = [];
    all.forEach(function (node) {
      if (node.dataset.rdhFailed === "1") return;
      stash(node);
      // Material can insert the element before its diagram text arrives. Skip
      // the node this pass rather than capturing an empty source, which
      // mermaid rejects as "no diagram type detected" and which would then
      // permanently mark the node as failed.
      if (!node.dataset.rdhSrc) return;
      if (node.dataset.rdhRendered === "1") restore(node);
      pending.push(node);
    });

    if (!pending.length) return;

    rendering = true;
    // mermaid.initialize() returns nothing in v10+, so run() is called
    // separately rather than chained off it.
    window.mermaid.initialize(mermaidConfig());

    Promise.resolve(window.mermaid.run({ nodes: pending }))
      .then(function () {
        pending.forEach(function (node) {
          node.dataset.rdhRendered = "1";
        });
      })
      .catch(function (error) {
        pending.forEach(function (node) {
          node.dataset.rdhFailed = "1";
          node.innerHTML =
            '<p class="mermaid-loading">Diagram could not be rendered.</p>';
        });
        if (window.console) {
          window.console.warn("RefData Hub docs: mermaid render failed", error);
        }
      })
      .then(function () {
        rendering = false;
      });
  }

  // Repaint diagrams so node colors suit the new palette.
  function renderMermaidForTheme() {
    document.querySelectorAll(".mermaid").forEach(function (node) {
      if (node.dataset.rdhFailed === "1") return;
      stash(node);
      if (node.dataset.rdhRendered === "1") restore(node);
    });
    window.clearTimeout(renderMermaid.timer);
    renderMermaid.timer = window.setTimeout(function () {
      renderMermaid(document);
    }, 60);
  }

  // ~2.5 MB, so only fetch it on pages that actually contain a diagram.
  function ensureMermaid() {
    if (!document.querySelector(".mermaid")) return;
    if (window.mermaid) {
      window.mermaid.initialize(mermaidConfig());
      scheduleRender();
      return;
    }
    if (mermaidRequested) return;
    mermaidRequested = true;

    var loader = document.createElement("script");
    loader.src = scriptSrc
      ? new URL("mermaid.min.js", scriptSrc).href
      : "assets/javascripts/mermaid.min.js";
    loader.defer = true;
    loader.addEventListener("load", function () {
      // Claim control immediately. Without this, mermaid's own
      // `startOnLoad` default can render against the default theme on a tree
      // that is still being swapped in by Material's instant navigation.
      window.mermaid.initialize(mermaidConfig());
      scheduleRender();
    });
    loader.addEventListener("error", function () {
      document.querySelectorAll(".mermaid").forEach(function (node) {
        node.dataset.rdhFailed = "1";
      });
      fail(document.querySelectorAll(".mermaid"), "Diagram could not be loaded.");
    });
    document.head.appendChild(loader);
  }

  // Material hydrates and swaps the content area asynchronously, so the
  // `.mermaid` nodes are not reliably present at the instant the mermaid
  // bundle resolves. Retry across a few frames until they appear.
  var renderAttempts = 0;

  function scheduleRender() {
    window.clearTimeout(scheduleRender.timer);
    renderAttempts = 0;

    function attempt() {
      renderMermaid(document);
      // Keep retrying on a fixed budget regardless of whether nodes are
      // present yet. Material hydrates and swaps the content area
      // asynchronously, so `.mermaid` is routinely absent at the moment the
      // mermaid bundle resolves -- gating the retry on node presence stopped
      // it before the nodes ever arrived.
      if (renderAttempts < 25) {
        renderAttempts += 1;
        scheduleRender.timer = window.setTimeout(attempt, 80);
      }
    }

    attempt();
  }

  ensureMermaid();

  // Material swaps page content on instant navigation, so newly-arrived
  // diagrams need rendering too.
  if (typeof window.document$ !== "undefined") {
    window.document$.subscribe(function () {
      window.setTimeout(ensureMermaid, 0);
      if (window.mermaid) {
        window.mermaid.initialize(mermaidConfig());
        scheduleRender();
      }
    });
  }

  // Re-render on palette change, but only when the light/dark boundary is
  // actually crossed -- mermaid's light and dark themes differ and switching
  // between two dark palettes needs no redraw.
  var wasDark = document.documentElement.classList.contains("rdh-dark");
  var observer = new MutationObserver(function () {
    var isDark = document.documentElement.classList.contains("rdh-dark");
    if (isDark === wasDark) return;
    wasDark = isDark;
    renderMermaidForTheme();
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });
})();
