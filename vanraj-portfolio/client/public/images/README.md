# Images folder

Place your real avatar concept image here as:

```
avatar-concept.png
```

This file is **intentionally not included** in the repo — it is your personal
artwork/photo and the app does not fabricate a placeholder image on disk.

Until that file exists, the Hero section automatically falls back to the
procedural 3D avatar scene (and a CSS gradient silhouette if WebGL is
unavailable). See `docs/3d-avatar-roadmap.md` in the project root for how to
later swap in a real rigged `.glb` model.

Recommended spec for `avatar-concept.png`:
- Square or portrait aspect ratio (e.g. 1024x1024 or 1024x1365)
- Transparent or dark (#111111) background works best with this theme
- Reasonable file size (under ~500KB) for fast loading
