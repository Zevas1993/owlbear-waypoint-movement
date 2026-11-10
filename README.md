# Waypoint Movement for Owlbear Rodeo 2

A shared, Roll20-style **waypoint movement tool** for desktop and mobile. The movement ruler follows manually placed turns rather than automatically tracing every cursor change. The first waypoint is always the token's original position.

## Install

The site is hosted on GitHub Pages. No build step is required.

**Pinned v0.1.9 manifest:** https://zevas1993.github.io/owlbear-waypoint-movement/manifest-v0.1.9.json

**Latest manifest:** https://zevas1993.github.io/owlbear-waypoint-movement/manifest.json

In Owlbear Rodeo, install the manifest through **Extensions → Add a custom extension**, enable it in the room, and select **Waypoint Movement** in the right-hand toolbar. If replacing an older version, remove the older one and enable the new version. Older pinned releases remain in the repository for rollback.

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Start | Click and drag the token | Touch and drag the token |
| First waypoint | Automatically saved at the token's original position | Same |
| Add a corner | Press **E** while dragging | Release the token at the corner |
| Continue the movement | Continue dragging, or release and regrab | Regrab the same token and keep dragging |
| Undo | **Z**, **Backspace**, or the Undo action | Undo action |
| Finish | **End Movement** | **End Movement** |
| Change tools | Ends tracking and removes the shared path | Same |

**Only Waypoint mode exists in v0.1.9.** The previous automatic Trace mode has been removed. Mouse/finger motion updates just the current segment; moving around a corner doesn't add a waypoint until the player presses E or releases the token. Ending a drag is not the same as ending the movement sequence.

## Player colors and global visibility

- The path stroke uses the current player's selected Owlbear color from `OBR.player.getColor()`. A fallback green is used only if the color cannot be read.
- Changing the player's color during an active movement recolors their shared path through `OBR.player.onChange()`.
- Paths and cumulative distance labels are placed in **`OBR.scene.items`**, making them visible to every player in the room. Each player's own route is identified independently.
- **End Movement** and switching tools remove that player's path and label from everybody's scene, without removing other players' routes.
- A reconnect cleans up old shared paths belonging to the same player.

## Snapping and distance

- Retains the token's original snap alignment (cell center or intersection, independently on X and Y) using Owlbear's `scene.grid.snapPosition()`.
- Supports different token dimensions, including Large and custom rectangular tokens.
- Respects the user's native snapping preferences. **Ctrl/Cmd** can temporarily bypass snapping.
- Uses the scene's square-grid measurement rules; distances accumulate across the anchored path.
- The complete route is used to measure distance. On unusually long paths, shared visual geometry is bounded to avoid large network updates.

## Stability

- Shared path updates are rate-limited and at most one shared update is in flight.
- Long token interactions are renewed before Owlbear's 30-second timeout.
- The full path is kept for the total-distance calculation; a visual approximation is used only when the path exceeds the visible point budget.
- The module files have immutable versioned names, preventing an old cached module from being loaded with newer code.

## Limitations

- Square grids are currently supported; hexagonal and isometric grids aren't.
- The tool doesn't calculate a shortest route around walls or doors; it measures the route the player anchors.
- Snap/drag, multiplayer visibility, and color handling have automated mock-SDK tests. Actual multi-client behavior still needs confirmation in a live Owlbear room.

## Developer notes

- `src/extension-v0.1.9.mjs` — custom tool, sharing, colors, drag handling
- `src/core-v0.1.9.mjs` — waypoint path, snap lattice, distance
- `src/route-visual-v0.1.8.mjs` — visual simplification and shared update limits
- `vendor/owlbear-sdk-3.1.0.mjs` — locally pinned SDK
- `tests/waypoint-color-v0.1.9.test.mjs` — single-mode and per-user color tests

[Owlbear extension documentation](https://docs.owlbear.rodeo/extensions/) · [GitHub Pages documentation](https://docs.github.com/en/pages/)
