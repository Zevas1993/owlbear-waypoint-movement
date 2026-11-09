# Waypoint Movement for Owlbear Rodeo 2

A custom movement tool for **desktop and mobile**. It tracks a character token's original position as waypoint zero, accumulates movement around manually placed corners and touch-traced turns, and offers **End Movement** on both devices.

## Install with GitHub Pages

This repository serves static files with no build step.

1. In GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, set branch to **main**, folder to **/(root)**, and save.
3. Verify the public JSON at https://zevas1993.github.io/owlbear-waypoint-movement/manifest.json.
4. In **Owlbear Rodeo → Extensions → Add a custom extension**, enter that same manifest URL, then enable the extension in your room.
5. Select the **Waypoint Movement** tool in the toolbar.

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Start | Click and drag Character token | Touch and drag Character token |
| Origin | Token's original position automatically | Same |
| Add corner | Press **E** during drag | Use **Trace** mode, or release at a corner |
| Continue | Drag same token again | Lift finger and regrab same token |
| End | **End Movement** action | **End Movement** action |
| Undo | **Z**, **Backspace**, or Undo action | Undo action |
| Change tool | Finalizes session | Finalizes session |

Releasing a drag commits the position **without resetting the accumulated measurement**. Dragging a different token clears the previous session and starts a new one.

## Known limitations

- Square grid only.
- Paths are player-local overlays; token movement is synchronized.
- Tracks the path you draw, not collision/pathfinding against fog walls or doors. Touch tracing reflects sampled positions and cannot recover corners the browser never reports.
- The SDK is loaded at runtime from a pinned CDN. If those hosts are blocked, the extension can't initialize.
- Not yet validated in a real Owlbear room on desktop and phone. Automated tests of the earlier implementation are not evidence of production compatibility.

## Developer notes

Static HTML and ES modules; no npm or build required. `src/core.mjs` contains grid and waypoint math; `src/extension.mjs` registers the Owlbear tool, modes, overlays and actions.

[Owlbear extension documentation](https://docs.owlbear.rodeo/extensions/) · [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
