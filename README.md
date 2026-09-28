# Clarity

A shared visual map for questions, knowledge, meanings, and image references. React + Vite, with live data and file storage in Convex.

## Map controls

- Click a card or image to edit it. Text responds immediately and saves after a short typing pause or when leaving the field.
- Drag to move an item. A dashed outline previews its grid position; release to snap and share the final position with other viewers. Escape cancels the drag.
- Hold the right mouse button on an item, drag to another item, and release to connect. The inspector's **Connect card** button also supports click-to-connect.
- Use **Add image**, the canvas context menu, or paste an image with Ctrl/Cmd+V while the map is focused. PNG, JPEG, WebP, GIF, and AVIF files up to 10 MB are supported. Images have a name-only editor and support connections.
- Photos preserve their original proportions and have their own map size. Drag any corner handle to resize; the opposite corner stays anchored and the final size syncs when released. Escape cancels. Focus a handle and use arrow keys for keyboard resizing (Shift for larger steps). Existing photos adapt automatically when loaded.
- Set any card background color in its inspector. Preview text automatically uses a contrasting foreground.
- Drag spaces in the sidebar to reorder or move them into folders. Alt+Up/Down also reorders a focused space. Right-click a space for **Add to folder**, or a folder to rename, recolor, or remove it. Removing a folder keeps its spaces and cards.

## Run locally

```bash
npm ci
npx convex dev
npm run dev
```

Set `VITE_CONVEX_URL` to the intended deployment. Use a local Convex deployment for automated browser tests; never seed production with test data.

## Verification

```sh
npm run lint
npm test
npm run build
npx tsc --noEmit -p convex/tsconfig.json
npx playwright install chromium
npm run test:e2e
```

Browser tests require a running **local** Convex backend on port 3210. They start their own Vite server on port 5180, seed only that local backend, and cover typing, offline recovery, cross-device drag synchronization, snapping, connections, folders, images, and colors.

## Deployment

Deploy Convex schema/functions to the backend used by the frontend before publishing frontend changes. Pushes to `main` run lint, unit/backend tests, and the production build, then publish the encrypted application to GitHub Pages. The existing site unlock flow remains in place.

This is a shared workspace: changes are visible to all connected viewers. JSON exports contain map metadata and image storage references, not image file bytes; restoring image references requires the same Convex deployment and retained files.
