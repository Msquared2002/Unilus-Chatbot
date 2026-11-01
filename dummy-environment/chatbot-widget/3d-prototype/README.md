# UNILUS editable 3D avatar — V1 prototype

This is a development-only experiment. No production page, avatar selection, profile preference, entitlement, authentication or backend source was changed by this prototype. The five existing host pages still use their existing 2D renderer. The earlier in-progress 2D work was left as found when this task began.

## Open the preview

From `C:\Users\mjluk\Desktop\FYP\UnilusChatBot`, serve the existing dummy environment:

```powershell
& 'C:\Users\mjluk\AppData\Local\Programs\Python\Python313\python.exe' -m http.server 8772 --bind 127.0.0.1 --directory dummy-environment
```

Open **http://127.0.0.1:8772/avatar-3d-preview.html**. Port 8772 was running during verification. The preview uses local files; it requires no backend, account, CDN or API key. Use HTTP rather than opening the HTML with `file://`.

Controls:

- Hairstyle: **None / Low Afro**.
- Outfit: **No outfit / Black Spirit Hoodie**.
- **Idle / Thinking / Happy / Blink**. Automatic blinking also runs every 3.7–5.5 seconds with normal motion preferences.
- **Follow mouse / touch** toggles independent eye gaze and shared head rotation.
- **Front / Left / Right** disable tracking and choose an inspection angle.
- **Manual orbit** enables dragging the canvas; use the wheel/pinch to zoom. It disables mouse-follow. The rotation slider rotates the character through ±180°.
- **Reset view** restores front framing, normal zoom, tracking and idle state.
- **See at widget size** uses a 150 × 170 CSS-pixel canvas, with a roughly 80px sphere.
- **Dark background** tests contrast without changing the model materials.

Appearance and emotion changes also update the original 2D reference in the comparison iframe. The iframe invokes the unchanged renderer API and never reads or writes a student profile.

## Files to edit

- Editable Blender project: `blender/unilus-avatar-v1.blend`
- Repeatable modelling script: `blender/build-avatar.py`
- Independent reopen/reimport check: `blender/validate-avatar.py`
- Web model: `models/unilus-avatar-v1.glb`
- Measured export statistics: `models/model-stats.json`
- Viewer source: `preview/index.html`, `preview/main.js`, `preview/motion.js`, `preview/style.css`
- Original renderer comparison: `preview/reference-2d.html`
- Built viewer: `dist/index.html` and generated assets
- Tests: `tests/prototype.test.mjs`
- Verification evidence and screenshots: `verification/`
- Convenience entry page: `../../avatar-3d-preview.html` relative to this folder

Exact project locations:

```text
C:\Users\mjluk\Desktop\FYP\UnilusChatBot\dummy-environment\chatbot-widget\3d-prototype\blender\unilus-avatar-v1.blend
C:\Users\mjluk\Desktop\FYP\UnilusChatBot\dummy-environment\chatbot-widget\3d-prototype\models\unilus-avatar-v1.glb
```

## Blender detection and editable project

Detected **Blender 4.2.23 LTS**, installed at:

```text
C:\Program Files\Blender Foundation\Blender 4.2\blender.exe
```

The build ran using `bpy`, saved a real `.blend`, and exported glTF 2.0 binary. A separate Blender process then opened the saved project, checked editable components and packed textures, reset the scene and imported the GLB. Both checks passed; see `verification/blender-validation.json`. Blender emitted a nonfatal warning about its optional user extension cache being unwritable in the sandbox; opening/importing succeeded.

Open the `.blend` normally in Blender. The **UNILUS editable mascot** collection has separate named components. Select `BodyMesh` for the sphere; edit `CapLettering` as a text object; expand `GraduationCap` to edit the board/crown/tassel. `LowAfroCurlMesh` contains editable, disconnected curl meshes joined for efficient web drawing, and `LowAfroUnderCap` closes their gaps. `FittedHoodieShell` and `ApprovedVarsityFrontPrint` are separate editable meshes. `PreviewCamera` and the studio lights are saved for inspection but excluded from the GLB.

### Repeat the build

Run from the repository root:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 4.2\blender.exe' --background --factory-startup --python dummy-environment/chatbot-widget/3d-prototype/blender/build-avatar.py
& 'C:\Program Files\Blender Foundation\Blender 4.2\blender.exe' --background --factory-startup --python dummy-environment/chatbot-widget/3d-prototype/blender/validate-avatar.py
```

The build is seeded and uses the existing approved black hoodie asset from the adjacent `outfits` folder. Regeneration overwrites V1, so save manual refinements under another filename first.

From this `3d-prototype` directory:

```powershell
npm ci
npm run build
npm test
```

The existing parent widget's installed Vite is reused; Three.js **0.186.1** is pinned only in this isolated package. No parent package or lockfile was edited. For live source development, run `npm run dev` and open **http://127.0.0.1:8773/**. The built static preview is the verified route above.

## Original character audit

Inspected `avatar.js`, `avatar.css`, `avatar-hairstyles.js`, `avatar-entitlements.js`, `widget.js`, the existing PNG directories and rendered frontend. The existing renderer was also used directly in the comparison page.

- Body: unchanged reference is a 78px near-black sphere, with no limbs, neck, nose or mouth.
- Eyes: white 16 × 19px ovals, 30px between their centres, positioned 25.5px below the sphere's top. Those ratios drive the 3D eye width, height, spacing and height.
- Cap: the actual `cap.png` has a black mortarboard, rounded crown, gold UNILUS lettering and a gold side tassel. Its transparent canvas contains padding, so its visible board is smaller than its CSS width.
- Cursor: reference uses a clamped 26° maximum tilt and 11px extra eye movement. V1 uses restrained ±19.5° yaw / ±11.5° pitch plus a much smaller independent 3D gaze.
- Existing idle/emotion transforms and body-clipped clothing were inspected. No standalone automatic blink system was present in the original; natural blinking is new in this isolated 3D viewer.
- Hair is an external overlay in the reference; clothing covers the lower sphere. V1 preserves those placement concepts using actual geometry.

## Model hierarchy

Blender is Z-up; the GLB exporter converts to glTF/Three.js Y-up. The front of the exported character faces +Z. The sphere diameter is 2 model units.

```text
AvatarRoot
└── HeadMotionPivot
    ├── BodyMesh
    ├── Eyes
    │   ├── LeftEyePivot → LeftEye
    │   └── RightEyePivot → RightEye
    ├── GraduationCap
    │   └── CapTilt
    │       ├── Mortarboard
    │       ├── CapCrown
    │       ├── CapLettering
    │       └── Tassel → cord, knot, stem, fringe and strands
    ├── HairAnchor
    │   └── LowAfro → curl mesh + continuous undercap
    ├── OutfitAnchor
    │   └── BlackSpiritHoodie → shell, neckline, drawstrings, aglets, print
    └── AccessoryAnchor
```

The `.blend` keeps editable lettering as text. It is converted to mesh only in memory after saving, so the GLB has reliable actual geometry without sacrificing editable text in the project.

## Modelling and motion implementation

**Body:** smooth 48-segment, 32-ring UV sphere; radius 1; charcoal Principled material with subtle highlights. It is not a PNG or billboard.

**Eyes:** two rounded 3D ellipsoids, width .41 and height .488, centred at ±.385 and at height .345. Each has its own pivot. Small translations provide gaze; scaling their local vertical axis provides blinking. A 220ms blink closes to 6% of normal height and reopens.

**Cap:** bevelled square mortarboard, cylindrical crown, editable gold text, and mesh cord/knot/fringe. A fixed 12° tilt makes the branded board visible without forcing a steep camera angle onto the face. The cap raises .18 units for the afro and returns for None.

**Low Afro:** seeded rounded curl geometry on an upper/side sphere surface plus a continuous fitted undercap. The front hairline clears the eyes; side/back curls extend lower. This is stylized low-cost geometry, not individual strands or a flat image.

**Hoodie:** fitted lower-sphere mesh shell with a simple curved neckline, 3D white drawstrings and aglets. No conventional shoulders, sleeves or human torso. The actual approved U + UNILUS print is UV-selected from the existing PNG, packed into the `.blend`, and embedded in the GLB. It is not redrawn. A proportional 1024px texture copy is used; the original file is not edited.

**Viewer:** orthographic camera, restrained studio/hemisphere lighting, transparent WebGL canvas and optional dark stage. No dynamic shadows, external environment downloads or framework beyond Three.js. The classic 2D reference remains in its own iframe.

**Animation composition:** bob/bounce moves the scene root, yaw/pitch moves `HeadMotionPivot`, and eye gaze/blink affects only eye controls. Frame-rate-independent exponential damping smooths target rotations. Thinking adds upward/side gaze and a small roll; Happy adds a bounce and taller eyes. Reduced-motion mode reduces root motion and suppresses automatic blinking; the explicit Blink button still works.

## Verification results

- **11/11 prototype tests passed**: GLB headers/chunks/buffer bounds, genuine sphere extents, hierarchy, independent eye controls, removable geometry groups, embedded print, geometry/file budget, Blender validation, damping, blink curve, emotion composition and production baseline hashes.
- **110/110 existing frontend tests passed**.
- **193/193 backend regression tests passed**; no backend source was changed.
- **Prototype Vite build passed**. Output includes the actual GLB, Three.js code, CSS and the unchanged renderer reference page. The bundled JS is about 638kB / 161kB gzip; Vite reports its normal >500kB chunk-size advisory.
- **Existing frontend build passed**, using `npm run build -- --outDir 3d-prototype/verification/production-build`. Output was deliberately isolated so the production bundle was not overwritten. Its existing Vite ESM/CommonJS config warning remains nonfatal.
- The `.blend` was reopened in Blender and checked; the GLB was independently reimported into Blender and then visibly loaded by Three.js.
- Browser verification covered None/Low Afro, no outfit/hoodie, front/left/right, manual orbit to the back, mouse-follow in both directions, independent gaze, root float, Thinking, Happy, manual Blink, compact widget-size rendering, and a 375 × 812 viewport. Live DOM render diagnostics recorded eye closure to **0.060**, and opposite signed yaw/gaze under cursor movement.
- Desktop layouts were inspected at 1280 × 900 and 1280 × 1200. At 375px the preview stacks vertically and has no horizontal document overflow.
- Production source, host pages and approved assets were checked against a SHA-256 baseline captured at prototype task start (76 existing files). All match. Existing unrelated working-tree edits were not reverted.

Screenshots are in `verification/`: `desktop-front.png`, `no-hair-no-outfit.png`, `left-view.png`, `right-view.png`, `cursor-left.png`, `manual-orbit.png`, `thinking.png`, `happy.png`, `widget-size.png`, and `mobile-375.png`. Browser/Blender measurements accompany them. The Blender project was checked through an actual `bpy` reopen, rather than an interactive Blender GUI editing session.

## Performance and limitations

- Model: **58,596 triangles**, **29 mesh draw calls** with hair/outfit enabled, **2,061,812-byte GLB** and **4,859,736-byte editable project**. None/no outfit reduces the rendered scene to about 14,892 triangles / 20 calls.
- Pixel ratio is capped at 1.75 and the renderer requests low-power preference. Geometry uses modest subdivision; hair curls are joined rather than hundreds of independent draw calls. No live hair simulation or expensive shadow pass.
- Rendering pauses on hidden documents and when the canvas leaves the viewport. Resize/intersection observers, orbit controls, animation loops and WebGL geometry/material/texture resources are disposed on page exit. WebGL construction/loading errors show a readable message while leaving the reference intact.
- The offscreen check held the frame counter at **4,325** across two observations while the canvas was above the mobile viewport; see `verification/browser-pause.json`.
- These are browser viewport and desktop observations, not a physical low-powered phone benchmark. No FPS guarantee is claimed.
- The afro is intentionally stylized and smoother/coarser than the approved photographic curls. Its curl density and side silhouette can be refined manually in Blender.
- The cap has real volume and readable branding; final crown/board/tassel proportions and font styling can be refined against the source image. There is no simulated cloth or tassel physics yet.
- The print uses the approved source pixels, including baked fabric shading in the sampled area. Curved-surface projection and lighting differ from the flat source; a dedicated production fabric/print texture bake would improve close-up continuity. No substitute crest or invented lettering was used.
- There is no rigged facial skeleton, morph-target library, programme wardrobe integration, full hairstyle conversion or production 3D selection. This V1 proves coherent 3D geometry, modular attachments and motion.

## Added/modified file scope

All implementation files were **added** under `chatbot-widget/3d-prototype/`, plus the new `dummy-environment/avatar-3d-preview.html` entry page. No existing production file was modified by this prototype. `dist/` is generated from the isolated viewer source; do not hand-edit it. Nothing was pushed or merged.

## API references

- [Blender 4.2 glTF import/export](https://docs.blender.org/manual/en/4.2/addons/import_export/scene_gltf2.html)
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader)
- [Three.js WebGLRenderer and disposal](https://threejs.org/docs/pages/WebGLRenderer)
