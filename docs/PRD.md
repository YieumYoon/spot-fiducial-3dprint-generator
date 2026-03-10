# Product Requirements Document (PRD)

## Product Title
**Spot Fiducial AprilTag Plate Generator**

## Document Status
Draft v1.2

## Owner
Yieum Yoon

## Last Updated
March 10, 2026

---

## 1. Overview

Spot Fiducial AprilTag Plate Generator is a browser-based web application that allows users to generate SVG fiducial plate layouts for **Boston Dynamics Spot** robots.

The app supports a fixed plate template that includes:

- one **tag36h11** AprilTag,
- a company name,
- a robot name,
- a displayed 3-digit AprilTag ID,
- an optional logo,
- and four corner drill holes.

The product is a **public website** hosted on **GitHub Pages**. All generation happens **client-side in the browser**. **No backend service** is required for v1.

The primary output for v1 is a **final composed SVG** suitable for downstream CAD or fabrication workflows. The app also provides an on-screen preview before export.

v1 is **SVG-first**. **3D model generation** is deferred to a later phase.

---

## 2. Problem Statement

The current workflow requires manually editing layouts in CAD tools such as Fusion 360 whenever any of the following change:

- the tag36h11 AprilTag ID,
- the rendered AprilTag image,
- the company name,
- the robot name,
- the logo,
- or the drill-hole size.

This is slow, repetitive, and error-prone. It also mixes two different tasks:

1. **layout composition**: placing tag, text, logo, and hole sizes in fixed regions, and  
2. **manufacturing preparation**: converting the layout into a 3D printable or machinable object.

For this product, the layout is mostly fixed and the variable content is limited and structured. Therefore, a browser-based generator is a better fit than repeated manual CAD editing.

---

## 3. Goal

Build a **pure static web app** that generates a consistent, fabrication-ready SVG layout for **Boston Dynamics Spot** AprilTag plates using a fixed template and a small number of controlled inputs.

---

## 4. Non-Goals

The following are explicitly out of scope for v1:

- support for AprilTag families other than **tag36h11**,
- support for AprilTag sizes other than the fixed v1 size,
- arbitrary freeform layout editing,
- browser-based CAD editing,
- browser-based STL or 3MF generation,
- server-side rendering or processing,
- user accounts,
- cloud file storage,
- collaborative editing,
- database-backed asset management,
- per-corner independent drill-hole sizing,
- automatic Fusion 360 file generation.

These may be considered in future versions but are not required for launch.

---

## 5. Target Users

### Primary Users
- Boston Dynamics Spot robot engineers,
- lab operators,
- manufacturing or prototyping team members,
- robotics teams that need to generate AprilTag-based Spot fiducial plates consistently.

### User Characteristics
- need fast output,
- do not want to use CAD for every variation,
- care about visual consistency and correct tag selection,
- may need to upload SVG logos,
- may need to choose a drill-hole size based on a standard bolt size with tolerance.

---

## 6. User Stories

### Core User Stories
1. As a user, I want to select a valid **tag36h11** AprilTag ID so I can generate the correct tag without editing CAD geometry manually.
2. As a user, I want to enter a company name so the plate reflects the correct organization.
3. As a user, I want to enter a robot name so the plate identifies the correct robot.
4. As a user, I want the displayed AprilTag ID to appear as a **3-digit value** such as `001`.
5. As a user, I want to optionally upload a custom SVG logo so the plate can match different companies.
6. As a user, I want to optionally leave the logo box empty.
7. As a user, I want the app to provide one built-in default logo option.
8. As a user, I want to choose a supported Google font family for editable text fields.
9. As a user, I want to choose a global drill-hole size preset based on bolt sizes with tolerance.
10. As a user, I want to preview the final layout before exporting so I can catch errors early.
11. As a user, I want to download the final composed SVG so I can use it in Fusion 360 or another fabrication workflow.
12. As a user, I want the design rules to stay fixed so outputs remain consistent across many plates.

---

## 7. Product Scope

### In Scope for v1
- fixed Spot plate template,
- fixed plate geometry derived from the current CAD design,
- fixed layout slots for:
  - AprilTag,
  - displayed AprilTag ID,
  - company name,
  - robot name,
  - logo,
  - bottom warning text,
- fixed AprilTag family: **tag36h11**,
- fixed AprilTag size definition,
- company name input,
- robot name input,
- tag ID selection,
- supported Google font family selection,
- optional custom SVG logo upload,
- optional built-in default logo,
- optional empty logo state,
- global drill-hole size preset selection,
- live preview,
- SVG export,
- public static hosting on GitHub Pages,
- client-side processing only.

### Out of Scope for v1
- editing plate dimensions,
- moving or resizing layout slots interactively,
- bitmap logo upload as a first-class feature,
- 3D geometry generation,
- direct printer integration,
- cloud storage of generated designs,
- support for different AprilTag families,
- support for different AprilTag size standards,
- arbitrary font uploads,
- independent per-corner hole customization.

---

## 8. Assumptions

1. The plate layout is fixed and comes from the current CAD design.
2. The app is a **public internet tool**, not an internal-only tool.
3. Text positions and sections are fixed, but some text values vary.
4. Logos may come from one built-in default SVG, a user-uploaded SVG, or no logo at all.
5. AprilTag IDs come only from the supported **tag36h11** set used by the app.
6. The main downstream fabrication workflow can accept SVG input.
7. Exported SVG output must use **named groups/layers** and **outlined/path geometry** for text.
8. Drill-hole center points are fixed; only the diameter changes in v1.
9. Google Fonts are loaded at runtime from a supported allowlist; fonts are not self-hosted in v1.

---

## 9. Key Product Principles

1. **Template-first**  
   The design system is fixed. Users fill predefined slots rather than redesigning the plate.

2. **Client-side only**  
   All logic runs in the browser to keep deployment simple and compatible with GitHub Pages.

3. **Public, no-backend architecture**  
   The product must work as a pure static website with no login, no cloud storage, and no server processing.

4. **Predictable geometry**  
   The same inputs must always produce the same SVG geometry.

5. **CAD-consistent output**  
   The exported SVG must preserve the plate dimensions and region layout from the CAD design.

6. **Safe asset handling**  
   Uploaded SVGs must be sanitized before rendering or export.

---

## 10. Functional Requirements

### 10.1 Inputs

The app must support the following inputs.

#### Required Inputs
- `companyName` (string)
- `robotName` (string)
- `tagId` (validated selection from the supported tag36h11 ID list)
- `fontFamily` (selection from a supported Google Fonts allowlist)
- `drillHolePreset` (global hole-size preset)

#### Optional Inputs
- `logoUpload` (custom SVG upload)
- `useDefaultLogo` (boolean)

#### Input Rules
- AprilTag family is fixed to **tag36h11** in v1; there is **no family selector**.
- The displayed ID must be rendered as a **zero-padded 3-digit string** such as `001`, `042`, or `123`.
- If `logoUpload` is provided, the uploaded logo takes priority.
- If no custom upload is provided and `useDefaultLogo` is enabled, the built-in default logo is used.
- If neither a custom upload nor default logo is selected, the logo box remains empty.
- Company name and robot name are required for export.
- Tag ID must be validated against the supported tag36h11 ID list used by the app.
- Font family must come from the app's supported Google Fonts allowlist.
- The drill-hole preset applies to **all four holes equally**.
- Empty required inputs must block export.

---

### 10.2 Geometry Contract

The following dimensions are based on the current CAD design and the provided dimensioned screenshots. They are the authoritative v1 geometry contract.

#### Units
- All geometry must be authored and exported in **millimeters**.

#### Plate Geometry
- Plate width: **182.50 mm**
- Plate height: **209.88 mm**
- Corner radius: **R9.00 mm**

#### Corner Drill Holes
- Hole count: **4**
- Default hole diameter: **3.40 mm**
- Hole center inset from nearest outer edges:
  - horizontal inset: **9.125 mm**
  - vertical inset: **9.125 mm**
- Hole centers remain fixed in v1.

#### AprilTag Geometry
- Supported family: **tag36h11**
- Size definition: **146.00 mm × 146.00 mm outer black-border square**
- The tag must be placed at the fixed tag location defined by the master template.

#### Top Layout Region
The top content region is centered horizontally and uses the same **146.00 mm** usable width as the main tag square.

- Top content region width: **146.00 mm**
- Top content region height: **18.25 mm**

Sub-regions inside the top content region:

1. **Company/Robot box**
   - width: **18.25 mm**
   - height: **18.25 mm**
   - split into two rows of **9.125 mm** each
   - top row = company name
   - bottom row = robot name

2. **Title/ID box**
   - width: **109.50 mm**
   - height: **18.25 mm**
   - title strip height: **6.25 mm**
   - ID strip height: **12.00 mm**
   - title text is fixed and non-editable: `ROBOT LOCALIZATION FIDUCIAL`
   - ID text is dynamic and displays the selected AprilTag ID in 3-digit form

3. **Logo box**
   - width: **18.25 mm**
   - height: **18.25 mm**
   - may contain an uploaded SVG, the built-in default logo, or remain empty

#### Bottom Warning Region
- warning region width: **146.00 mm**
- warning region height: **9.125 mm**
- warning text is fixed and non-editable: `DO NOT BLOCK OR MOVE`

#### Geometry Source of Truth
- The v1 implementation must use one **master SVG template** derived from the CAD layout.
- The screenshot dimensions above define the official box sizes and layout proportions for v1.
- The template must preserve the current alignment and placement of all fixed regions.

---

### 10.3 Text and Font Behavior

Because company names and robot names vary in length, the app must enforce predictable layout behavior.

#### Editable Text Fields
- company name,
- robot name,
- displayed 3-digit AprilTag ID.

#### Fixed Non-Editable Text
- `ROBOT LOCALIZATION FIDUCIAL`
- `DO NOT BLOCK OR MOVE`

#### Required Behavior
- company name must render in the company-name row,
- robot name must render in the robot-name row,
- company and robot name are **single-line fields** in v1,
- editable text must auto-scale down when it exceeds the available width,
- text alignment must remain fixed to the template,
- if text still does not fit after scaling, the app must show a validation error,
- users may choose a font family only from a supported **Google Fonts allowlist**,
- the app must wait for the selected font to load before final measurement and export,
- the exported SVG must convert editable text to **outlines/paths**.

#### Out of Scope for v1
- arbitrary user font uploads,
- freeform text rotation,
- multi-line fallback for company or robot name,
- editable fixed-title or warning text.

---

### 10.4 Logo Handling

#### Supported Logo Modes
1. **Uploaded SVG logo**
2. **Built-in default logo**
3. **Empty logo box**

#### Required Logo Rules
- only SVG uploads are supported in v1,
- uploaded SVGs must be sanitized before inclusion,
- uploaded logo takes priority over the built-in default logo,
- if no upload is present and default logo is enabled, the built-in default logo is used,
- if neither is used, the logo box remains empty,
- aspect ratio must be preserved,
- logos must be scaled and centered within the fixed top-right logo box,
- if parsing fails, the user must receive a clear error message.

---

### 10.5 AprilTag Handling

The app must render the correct AprilTag for the selected ID.

#### Required Behavior
- the app must support exactly one AprilTag family: **tag36h11**,
- the rendered tag must be deterministic and visually correct,
- the tag must be scaled so that the **outer black-border square** is exactly **146.00 mm × 146.00 mm**,
- the tag must render into the predefined tag zone at fixed scale and placement,
- the UI-facing display ID must be shown as a zero-padded 3-digit value,
- duplicate AprilTag IDs across different robots are allowed.

#### Implementation Options
The system may do either of the following:
1. load precomputed SVG assets for each supported tag, or
2. generate the tag pattern client-side from structured data.

For v1, either approach is acceptable as long as the output is correct and deterministic.

---

### 10.6 Drill-Hole Handling

#### Required Behavior
- the app must support **one global drill-hole preset** for all four holes,
- hole centers remain fixed,
- only the hole diameter changes in v1,
- drill-hole presets must be based on **standard bolt sizes with tolerance**,
- each preset must map to a final rendered diameter,
- users must not enter arbitrary freeform hole coordinates.

#### Recommended Preset Model
- presets should be named by bolt size rather than raw diameter where possible,
- each preset may include a tolerance-adjusted final hole diameter,
- the default preset must match the current CAD default of **3.40 mm**.

---

### 10.7 Preview

The app must provide a live preview of the final plate.

#### Required Behavior
- preview updates when any input changes,
- preview reflects final SVG composition as closely as possible,
- preview must show the selected font once loaded,
- preview must show the selected logo mode: uploaded, default, or empty,
- preview must show the selected global drill-hole preset,
- invalid states must be visible before export.

---

### 10.8 Export

#### v1 Export Requirement
- export final composed SVG file.

#### SVG Export Rules
- exported SVG must contain all visible elements needed for downstream use,
- exported SVG must use **millimeter-based dimensions**,
- SVG dimensions and `viewBox` must be consistent and documented,
- exported SVG must contain **named groups/layers**,
- all visible text in the final export must be converted to **outlines/paths**,
- file names should follow a predictable pattern,
- file-name sanitization is required.

#### Required Named Groups/Layers
At minimum, the final SVG should contain named groups/layers equivalent to:
- `plate-outline`
- `holes`
- `apriltag`
- `company-name`
- `robot-name`
- `fixed-title`
- `display-id`
- `logo`
- `bottom-warning`

#### Example Filename Format
`{companyName}-{robotName}-tag{displayId}.svg`

---

## 11. Non-Functional Requirements

### Performance
- first usable render within 2 seconds on a modern laptop,
- preview refresh within 200 ms for normal input changes after font load,
- export action completes within 1 second for typical designs.

### Reliability
- deterministic output for the same inputs,
- no server dependency,
- no required login,
- no required cloud storage.

### Security
- uploaded SVGs must be sanitized before insertion,
- no execution of embedded scripts from uploaded assets,
- no remote code loading from untrusted logo sources,
- only supported SVG elements and attributes should be preserved in uploaded logo content.

### Compatibility
- latest versions of Chrome, Edge, and Firefox,
- reasonable support for Safari if feasible,
- responsive enough for laptop screens,
- mobile can be best-effort in v1.

### Hosting
- must deploy cleanly to GitHub Pages,
- must function as a **pure static website** with no backend service.

### Font Loading
- supported fonts are loaded from Google Fonts at runtime,
- the app must avoid export before the selected font finishes loading,
- the app must provide a supported fallback if a selected Google Font cannot be loaded.

---

## 12. UX Requirements

### 12.1 Core Flow
1. User opens the generator page.
2. User enters company name.
3. User enters robot name.
4. User selects a valid tag ID.
5. User selects a supported Google font.
6. User chooses one logo mode:
   - empty,
   - built-in default,
   - or uploaded SVG.
7. User selects a global drill-hole size preset.
8. User reviews the preview.
9. User clicks export to download the final SVG.

### 12.2 Form Design
The UI should contain:
- a right-side input panel,
- a main preview area,
- a clear export action at the bottom of the right-side panel,
- validation messages near the relevant inputs.

### 12.3 UX Constraints
- users should not need to understand CAD concepts,
- users should not need to adjust coordinates manually,
- errors should be phrased in plain language,
- the UI should not expose unsupported AprilTag families in v1.

#### Example Errors
- `Robot name is too long for the current layout.`
- `Selected AprilTag ID is not supported.`
- `Uploaded logo is not a valid SVG file.`
- `The selected font could not be loaded.`
- `The selected drill-hole preset is not supported.`

---

## 13. Technical Approach

### 13.1 Architecture
Static web app hosted on GitHub Pages.

### Suggested Stack
- HTML
- CSS
- JavaScript or TypeScript
- SVG-based rendering
- optional lightweight frontend framework if needed, but not required

### 13.2 Asset Structure
Suggested asset groups:
- master template SVG,
- built-in default logo SVG,
- AprilTag assets or tag data,
- app logic,
- configuration for supported Google Fonts,
- configuration for drill-hole presets.

### 13.3 Rendering Strategy
The system should treat the design as:
- one fixed template,
- a set of predefined variable slots,
- a final assembled SVG document.

This avoids CAD-like complexity and keeps the problem in the domain of layout composition.

### 13.4 Best-Practice Static-Site Rules
- no backend,
- no server-side storage,
- no server-side SVG processing,
- all composition, validation, and export must happen in the browser,
- one master SVG template should be the implementation source of truth for geometry,
- CAD remains the design reference, but browser rendering uses the master SVG template.

---

## 14. Success Metrics

Because v1 is a pure static website with no backend, launch readiness is measured primarily through **acceptance testing and manual QA**, not server-side telemetry.

### Primary Success Metrics
- time to generate a valid output,
- successful completion of acceptance-test scenarios,
- reduction in manual CAD edits,
- reduction in formatting or labeling errors during manual review.

### Target Benchmarks
- 90% of test users can generate a valid file on first try,
- median generation time under 60 seconds,
- no critical geometry mismatch against the CAD-derived template,
- no critical export failures in supported browsers.

---

## 15. Risks and Mitigations

### Risk 1: Long text breaks layout
**Mitigation:** bounded text zones, auto-scaling, validation, fixed one-line editable boxes.

### Risk 2: Uploaded SVGs contain unsafe or incompatible content
**Mitigation:** sanitize uploaded SVGs and allow only supported elements and attributes.

### Risk 3: Google Font rendering differs or loads late
**Mitigation:** use a curated allowlist, wait for font load before final measurement/export, and provide a supported fallback.

### Risk 4: AprilTag scaling is incorrect
**Mitigation:** validate that the rendered tag uses a **146.00 mm outer black-border square**.

### Risk 5: Users expect STL or 3MF export immediately
**Mitigation:** clearly position v1 as **SVG-first** and defer 3D generation to a later phase.

### Risk 6: Hole presets drift from manufacturing needs
**Mitigation:** define drill-hole presets using standard bolt-size labels and tolerance-adjusted final diameters.

---

## 16. Open Questions

1. What exact Google Fonts allowlist should be supported in v1?
2. What exact bolt-size presets and tolerance-adjusted diameters should be exposed in the UI?
3. What exact tag36h11 ID list should be exposed in the selector for v1?
4. In v2, should the first CAD-ready export priority be DXF, STL, or 3MF?

---

## 17. Acceptance Criteria

The product will be considered successful for v1 if all of the following are true:

1. A user can open the GitHub Pages site and use it without login.
2. A user can input company name, robot name, and a valid tag36h11 ID.
3. A user can choose a supported Google font.
4. A user can use one of the three supported logo states:
   - uploaded SVG,
   - built-in default logo,
   - empty.
5. A user can choose a global drill-hole size preset.
6. The app generates a live preview using the fixed Spot plate template.
7. The final SVG can be downloaded successfully.
8. Text fitting rules prevent broken layouts.
9. Invalid input states are clearly explained.
10. The app works without any backend service.
11. The AprilTag is rendered so that the **outer black-border square is exactly 146.00 mm**.
12. The exported plate matches the fixed template geometry, including:
    - width **182.50 mm**,
    - height **209.88 mm**,
    - corner radius **R9.00 mm**,
    - fixed hole centers inset **9.125 mm** from adjacent edges.
13. The selected drill-hole preset changes all four hole diameters uniformly while keeping centers fixed.
14. The exported SVG uses named groups/layers and converts visible text to outlines/paths.
15. Duplicate AprilTag IDs across different robots are allowed.

---

## 18. Future Enhancements

Potential v2+ features:

- STL generation for 2.5D plates,
- 3MF generation for 2.5D plates,
- DXF export,
- multiple template variants,
- batch generation from CSV,
- print-production presets,
- automated filename metadata and revision tracking.

---

## 19. Summary

Spot Fiducial AprilTag Plate Generator is a public, browser-based, SVG-first tool for generating consistent Spot fiducial plate layouts from a fixed template with a small number of structured inputs. v1 focuses on solving the repetitive layout problem, not the full manufacturing pipeline. By limiting scope to client-side SVG generation and export, the product reduces operational complexity while addressing the main user pain point: fast, repeatable, low-error generation of Spot AprilTag plate designs.
