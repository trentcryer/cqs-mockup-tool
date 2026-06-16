# CQS Mockup Studio — Editor Refactor Status (May 2026)

This document captures the current state of the interactive mockup editor after multiple iterations and a major architectural attempt.

**Goal**: Give another AI (Claude, etc.) full context so it can help stabilize and improve the editor.

---

## 1. Original Architecture (Before the "Rethink")

- Fixed-size Fabric canvas (720 × 820 pixels) used as the "live placement editor".
- User uploads a logo → it is placed on this fixed canvas.
- User can drag, resize (via native Fabric handles or later a custom slider), and rotate the logo.
- Transform data (`left, top, width, height, angle, opacity`) is captured in editor pixel coordinates via `onTransformChange`.
- This data is stored in `currentTransform` in the parent (`app/studio/editor/page.tsx`).
- When the user clicks "Generate High-Quality Mockups":
  - The original logo file + `currentTransform` is sent to `/api/printful/generate-mockup`.
  - The API translates the editor coordinates into Printful’s real print area coordinates using a mapping function.
  - Printful’s mockup generation API is called with the positioned logo.

**Problems with this model** (why the rethink was attempted):
- Different products and placements have very different real print area dimensions and aspect ratios.
- The fixed 720×820 canvas + manual mapping was always approximate and frequently produced results that didn’t match what the user saw in the editor.
- Scaling and positioning in the live editor often didn’t match the final Printful mockups.

---

## 2. The "Rethink" Architecture (What Was Attempted)

The idea was to stop using a fixed arbitrary canvas size and instead drive the editor from Printful’s real data:

- When a placement is selected, fetch the real print area dimensions (`area_width` / `area_height`) from the `printfiles` data for that placement.
- Make the Fabric canvas operate in the **real print area coordinate system** (or at least the real aspect ratio).
- The `currentTransform` values would then be much closer to the units Printful expects.
- The mapping in the generate API could become much simpler / more accurate.

**Implementation steps that were taken**:
- `app/studio/editor/page.tsx` now fetches and stores `printfilesData`.
- A `logicalPrintArea` (later renamed `editorDisplaySize`) is computed based on the real dimensions for the current placement.
- These dimensions are passed to `<FabricEditor>` as `printAreaWidth` / `printAreaHeight`.
- Inside `FabricEditor`, the canvas is created using these dimensions (with some attempts to keep a reasonable on-screen size).
- The generate API (`app/api/printful/generate-mockup/route.ts`) was updated to expect transforms that are closer to real units.

---

## 3. What Broke After the Rethink

The change caused several major regressions:

- **Canvas rendering problems**: Using the raw (sometimes very large) Printful print area dimensions for the actual Fabric canvas pixels caused severe distortion. Background images (the product photos) were often clipped or only partially visible ("the person is seen in half").
- **Logo behavior broke**: The logo stopped responding properly to dragging and the size slider. Positioning and scaling no longer worked as expected.
- **Blinking / leftover artifacts**: The entire preview area started blinking rapidly. Old borders/boxes from previous versions of the code sometimes remained visible and static.
- **Save button regression**: The button frequently stays greyed out or shows "Product or placement not ready yet" / "Product details or placement are still loading" even after a logo is clearly visible on the canvas.
- **Size slider stopped correlating**: Even when the slider visually changes the logo in the live editor, the generated mockups often do not reflect the new size (or the mapping is very inaccurate).
- **Download behavior issues**: Generated mockups sometimes navigate away from the page instead of downloading cleanly.
- **General instability**: Multiple re-renders, effect dependency problems, and object cleanup issues in Fabric made the editor feel broken.

---

## 4. Current State of Key Files (as of latest changes)

### `app/studio/editor/page.tsx`
- Has `isProductLoading`, `mounted`, `logoPreviewUrl`, `logoFile`, `currentTransform`, `originalLogoPath`, `existingDesignId`, `printfilesData`, etc.
- `editorDisplaySize` (or similar) computed from real print area data.
- Save button disabled condition has been relaxed and tightened multiple times.
- `saveToMyFolder()` has logic to handle both new files and blob URLs from the preview.
- `generateHighQualityMockups()` sends `currentTransform` to the backend.
- Product loading sets `isProductLoading`.

### `components/FabricEditor.tsx`
- Canvas is created with `printAreaWidth` / `printAreaHeight` (currently the "display size" values passed from the parent).
- Background and logo loading logic has been modified multiple times (removal of `crossOrigin`, disabling native handles, cleanup of previous objects, etc.).
- Contains a "Logo Size" slider that updates the Fabric object and calls `onTransformChange`.
- Native Fabric resize/rotate handles are currently disabled (`hasControls: false`, `hasBorders: false`).
- Has `baseLogoScaleRef` for the size slider.

### `app/api/printful/generate-mockup/route.ts`
- Receives `transform` (as JSON) from the frontend.
- Contains the mapping logic that translates editor coordinates into Printful `position` data.
- This mapping has been rewritten several times (hardcoded offsets → relative percentages → attempts to use real area dimensions).

### Other relevant files
- `middleware.ts` — has some development-mode leniency around Supabase auth errors.
- `lib/printful.ts` — contains `getDefaultPrintPosition` and the Printful client.

---

## 5. Current Known Problems (as reported by the user)

- Save button is active in some states but still produces "Product or placement not ready yet" / similar errors when clicked.
- Logo size slider changes the live editor visually but the generated mockups are still very off in scale.
- The live placement editor sometimes shows the product image clipped or only partially visible.
- Canvas can still blink or show leftover static borders from previous versions of the code.
- When editing existing saved designs, behavior around `originalLogoPath` vs new uploads can be inconsistent.
- Download links for generated mockups have had navigation vs. proper download issues.

---

## 6. What the User Wants

- A working, stable live placement editor where:
  - Dragging moves the logo.
  - The size slider reliably changes the logo size.
  - The generated Printful mockups closely match what is seen in the editor (especially scale).
- Reliable "Save Design" that actually saves the current state on the canvas (position + scale + placement + notes).
- Clean UI with no erratic blinking, leftover boxes, or confusing disabled states.
- The editor should feel professional and predictable.

The user has explicitly asked for a "rethink" of the positioning/scaling approach because incremental tweaks have not been sufficient.

---

## 7. Suggested Next Steps for Anyone Helping

1. **Stabilize the visual editor first** (reasonable fixed display size + correct aspect ratio from the real print area, without making the internal canvas pixels enormous).
2. Decide on a coordinate system for `currentTransform` that is both easy to work with in the editor and easy to translate to Printful (normalized 0–1 is often the cleanest).
3. Make the Save button reliably enabled whenever a logo is visible on the canvas and the product/placement data is loaded. Remove the confusing loading guard or make it much more accurate.
4. Revisit the mapping in `generate-mockup/route.ts` with the new coordinate system (it should become much simpler).
5. Clean up any remaining Fabric object leaks, effect dependency issues, and hydration problems.
6. Improve loading states and feedback so the user never feels like the UI is lying to them about whether a logo is attached.

---

## 8. Notes for the Next Person (Claude or otherwise)

- The user has been patient through many iterations and is now frustrated.
- They want to work through problems one by one.
- The "rethink" attempt (real print area dimensions as the canvas coordinate system) was conceptually good but executed in a way that broke the visual editor badly.
- Prioritize getting the live editor visually stable and the Save button working before chasing perfect 1:1 scale matching.
- Ask clarifying questions about current behavior rather than assuming the last change is still in place.

---

**Last updated**: May 2026 (after the major architecture attempt and several rollback/stabilization attempts).

If you're Claude (or another model) reading this: the user wants you to have the full context of what was attempted and what is currently broken so you can propose a practical path forward.

---

## 9. Current Bugs & Desired Behavior (Tactical Summary for Claude)

**Current State (as of latest user feedback):**
- The "rethink" architecture (driving the Fabric canvas from real Printful print area dimensions) caused significant regressions.
- Many incremental patches have been applied on top, leaving the code in a hybrid/inconsistent state.
- The editor is currently fragile and hard to use.

**Active Problems (ranked by user frustration):**

1. **Save Button Still Broken**
   - Button is sometimes active but clicking it shows:  
     `"Product details or placement are still loading. Please wait a minute and try again."`
   - Even when a logo is clearly visible and positioned on the canvas.
   - `isProductLoading`, `selectedPlacement`, and `product` state are not reliable enough.

2. **Logo Size Slider vs Generated Mockups**
   - Adjusting the size slider changes the logo visually in the live "placement editor".
   - The scale does **not** match when the user clicks "Generate High-Quality Mockups".
   - The mapping between the editor’s coordinate system and Printful’s real print area remains inaccurate and frustrating.

3. **Canvas Visual Problems**
   - Background image (product photo) is frequently clipped or only partially visible ("the person is seen in half").
   - Rapid blinking of the entire preview area in some states.
   - Leftover static border boxes from previous versions of the code that do not move with the logo.

4. **Download Behavior**
   - Clicking "Download" on a generated mockup sometimes navigates away from the page instead of triggering a clean file download.
   - After navigating away and hitting back, the editor state (logo position, size, etc.) is lost.

5. **General Usability**
   - The editor does not feel professional or predictable.
   - User frequently has to hard-refresh or restart the dev server after changes.
   - Hydration mismatch warnings appear regularly on buttons (especially the Generate button).

**Desired Behavior (What "Good" Looks Like):**

- When the user uploads a logo and positions/scales it in the live editor, clicking **Save Design** should reliably save the current state (including the latest transform from the slider/dragging).
- When the user adjusts the size slider and then clicks **Generate High-Quality Mockups**, the resulting Printful mockup should closely match the scale and position they see in the live editor.
- The canvas should render the full product image cleanly without clipping or rapid blinking.
- No more static leftover borders or confusing disabled states.
- Downloads should work cleanly without losing editor state.
- The editor should feel stable enough that the user does not need to constantly hard-refresh.

**Recommended Priorities for the Next Helper (Claude or otherwise):**

1. Make the **Save button** reliably work when a logo is on the canvas (remove the confusing loading guard or make loading state accurate).
2. Stabilize the **live canvas** visually (reasonable fixed display size + correct aspect ratio, no more huge internal canvases or clipping).
3. Fix or replace the **scale/position mapping** so that what the user sees with the slider is close to what Printful returns (this may require rethinking normalized coordinates vs pixel mapping).
4. Clean up any remaining Fabric object leaks, effect loops, and hydration issues.
5. Improve loading states and visual feedback so the UI never lies to the user about the current state of the logo.

**Important Note to Next Helper:**
The user is frustrated after many failed attempts. Please work **incrementally** and **one problem at a time**. Verify each fix with the user before moving to the next. Do not make large refactors without agreement.

Ask the user to test after each meaningful change rather than making many changes at once.
