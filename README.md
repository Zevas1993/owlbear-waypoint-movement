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

## Shared movement tracking (v0.1.7)

**Movement paths and distance labels are global, not private.** The extension stores them with `OBR.scene.items` so every player in the Owlbear scene can see the path being drawn and its cumulative distance in real time, whether or not they are using the movement tool themselves.

- Each player's shared path is marked with their own Owlbear player ID; different players' paths do not interfere.
- Releasing and regrabbing a token keeps the global line and running total visible to everyone.
- **End Movement** deletes the path and label from the shared scene for all players.
- Switching to another tool also ends and clears the shared movement automatically (normal Owlbear tool-change event, mode deactivation, and a fallback active-tool check).
- When a player reconnects after a crash or reload, the extension removes abandoned paths owned by *that player*, not paths belonging to other players.
- The route itself is not permanently saved after End Movement; the token's final location remains on the scene.

The new `src/extension-v0.1.7.mjs` and `src/core-v0.1.7.mjs` preserve v0.1.6's native per-token snapping behavior. The earlier versioned files remain available for rollback.

## Native snapping (v0.1.6)

**Movement snaps the same way as the selected Owlbear token was already placed.** On the first drag, the extension asks Owlbear for both the nearest cell center and grid intersection at the token's current position, then remembers the nearest alignment *separately on the X and Y axes* for the movement session.

- A Medium token already at cell centers continues to snap to cell centers.
- A Large token already centered on grid intersections continues to snap to grid intersections.
- A Large token **intentionally placed on cell centers** keeps its placement choice; token size is only a fallback for ambiguous alignment.
- Rectangular tokens (2x3, etc.) can preserve different horizontal/vertical lattice alignments.
- The extension now calls **OBR.scene.grid.snapPosition** during movement instead of rounding coordinates itself, leaving sensitivity undefined so Owlbear uses the user's normal snapping preference. When scene/user snap is disabled, the tool respects that.
- Holding **Ctrl/Cmd** while dragging temporarily bypasses snapping, as in Owlbear's Move tool.
- The token's original position stays waypoint zero; the same snap lattice is retained across release/regrab until **End Movement**.

Important: A character left off-grid by 0.1.5 will initially select the nearest existing lattice when first moved with 0.1.6. You can restore its desired default placement using Owlbear's normal Move tool first if necessary.

The new modules `src/extension-v0.1.6.mjs` and `src/core-v0.1.6.mjs` are independent of older releases so Owlbear cannot mix a new module with a cached old one.

## Long, complex routes (v0.1.8)

This release protects against network overload when a movement path has many corners.

- The shared **visual line is simplified to at most 144 points**. This does not remove waypoints from the underlying route or change the distance measured from processed positions.
- Shared path/label updates are limited to approximately **10 times per second** (one in flight), rather than every pointer event.
- Trace mode buffers up to **512 pending moves**; beyond this extreme input backlog, it preferentially drops low-significance pending points. Manual E waypoints are preserved. Distances reflect all positions that were processed.
- Live token movement interactions are renewed after approximately **22 seconds** to avoid Owlbear's documented 30-second expiration.
- The existing per-token center/corner snapping, shared view for other players, End Movement button, tool-switch cleanup, and mobile continuation are unchanged.

The visual line may be slightly less detailed after very long zigzags, while the measured distance retains the actual processed movement segments.

## Known limitations

- Square grid only.
- Paths and labels are shared scene items visible to everyone, and token movement is synchronized. These shared updates may be subject to normal network latency.
- Tracks the path you draw, not collision/pathfinding against fog walls or doors. Touch tracing reflects sampled positions and cannot recover corners the browser never reports.
- Owlbear's SDK is self-hosted from the pinned `vendor/owlbear-sdk-3.1.0.mjs`; no third-party runtime CDN is required.
- The custom desktop movement tool has been confirmed to load and draw a route in an Owlbear room. Native snap selection, token dragging, and cumulative waypoints have automated tests; in-room mobile behavior still needs manual confirmation.

## Developer notes

Static HTML and ES modules; no npm or build required. `src/core-v0.1.8.mjs` preserves route math and grid snapping; `src/route-visual-v0.1.8.mjs` manages bounded geometry; `src/extension-v0.1.8.mjs` registers the tool, shared throttled renderer and interactions. Older versioned files are retained for rollback.

[Owlbear extension documentation](https://docs.owlbear.rodeo/extensions/) · [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
