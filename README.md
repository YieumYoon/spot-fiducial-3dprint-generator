# Spot Fiducial AprilTag Plate Generator

Live site: [Boston Dynamics Spot Fiducial AprilTag Plate Generator](https://yieumyoon.github.io/spot-fiducial-3dprint-generator/)

Static browser application for generating fabrication-ready SVG fiducial plates for Boston Dynamics Spot. The app runs entirely client-side and is designed to be hosted directly on GitHub Pages with no backend services.

## Overview

This repository contains a fixed-template generator for Spot fiducial plates built around the `tag36h11` AprilTag family. Users first choose the intended fiducial range, then pick a supported tag ID, set company and robot names or dock text, pick a drill-hole preset when applicable, choose a bundled font, optionally use a built-in logo or upload a custom SVG logo, and export either a print-safe SVG or a CAD-safe SVG.

The exported file preserves the project’s fixed geometry and produces a clean fabrication asset rather than a generic preview graphic.

## Key Capabilities

- Generates Spot fiducial plate SVGs with fixed millimeter-based geometry.
- Supports `tag36h11` IDs `001-586`.
- Adds purpose-first range selection for `1-299` localization, `300-499` not specified, and `500-586` dock fiducials.
- Automatically applies the dock-specific DXF-matched template for `500-586` IDs, including a dock location field.
- Applies automatic text fitting for company name, robot name, title, warning text, and displayed tag ID.
- Uses path-based text in the final SVG for downstream CAD and fabrication workflows.
- Supports a built-in default logo, an empty logo state, or a sanitized uploaded SVG logo.
- Applies a single drill-hole preset to all four corners while preserving fixed hole centers.
- Shows live browser preview guides while keeping exported SVGs fabrication-clean.
- Provides separate print-safe and CAD-safe SVG downloads for PDF/printing and CAD import workflows.
- Runs fully client-side and is deployable as a static GitHub Pages site.

## Export Output

Each generated SVG is intended to be directly usable in print, PDF, CAD, or manufacturing preparation workflows. Both export variants preserve:

- plate size `182.5 mm × 209.875 mm`
- fixed AprilTag placement and geometry
- fixed slot layout for text and logo
- named SVG groups for downstream editing
- outlined text geometry instead of live text nodes

Export variants:

- `Print SVG` keeps the root SVG in millimeter units with a millimeter `viewBox`, which makes SVG-to-PDF conversion and browser printing preserve the intended physical size.
- `CAD SVG` keeps the existing CAD-normalized root, using 96 dpi SVG user units under the hood while preserving millimeter `width` and `height` for importers that expect pixel-based SVG coordinates.

## Fusion STEP Automation

The repository now includes a Fusion 360 automation path for turning an exported CAD SVG into a multi-body STEP without manually selecting every profile in the UI.

Codex users can invoke the repository-scoped `fusion360-svg-to-step` skill in [`.agents/skills/fusion360-svg-to-step`](.agents/skills/fusion360-svg-to-step). The skill drives an open Autodesk Fusion instance through the Fusion MCP connector, reuses the tested project scripts below, and verifies each exported STEP. Because the skill is checked into the repository, every contributor receives the same workflow after cloning the project.

Files:

- [`scripts/fusion360/spot_svg_to_step.py`](scripts/fusion360/spot_svg_to_step.py)
- [`scripts/fusion360/svg_step_model.py`](scripts/fusion360/svg_step_model.py)

What it builds from the SVG:

- plate base: `-1.35 mm`
- white layer: `+1.0 mm`
- black layer: `+1.0005 mm`
- drill holes stay excluded from every extrusion pass

### Use with Codex and Fusion MCP

Requirements:

- Open this repository in Codex so it discovers the checked-in `.agents/skills` directory.
- Open Autodesk Fusion and start its MCP connector.
- Export at least one `CAD SVG` from the site, normally into `output/`.

The skill declares the default local Fusion MCP endpoint at `http://127.0.0.1:27182/mcp`. If the connector is not listed in Codex, add it and restart Codex:

```bash
codex mcp add fusion --url http://127.0.0.1:27182/mcp
```

Invoke the skill explicitly with a prompt such as:

```text
Use $fusion360-svg-to-step to convert output/example-cad.svg to STEP.
```

For a batch:

```text
Use $fusion360-svg-to-step to convert every *-cad.svg file in output/ to STEP.
```

Codex resolves machine-specific paths at runtime, runs the existing project converter through Fusion MCP, writes each `.step` beside its source SVG, and verifies the exported file and Fusion body geometry. It does not overwrite an existing STEP unless explicitly requested.

### Manual Fusion 360 Usage

1. Export a `CAD SVG` from the site.
2. In Fusion 360, create a new script and replace the generated main file with [`spot_svg_to_step.py`](scripts/fusion360/spot_svg_to_step.py).
3. Place [`svg_step_model.py`](scripts/fusion360/svg_step_model.py) in the same Fusion script folder.
4. Run the Fusion script, choose the source SVG, then choose the output `.step` file.

Use a current Fusion 360 build for this workflow. The script relies on the API's profile-face sampling so ring-shaped letters and AprilTag holes can be separated reliably.

The helper parser can also be run locally to inspect how a generated SVG will be interpreted before opening Fusion:

- `python3 scripts/fusion360/svg_step_model.py describe output/example-cad.svg`
- `python3 scripts/fusion360/svg_step_model.py point output/example-cad.svg 20 40`
- `python3 scripts/fusion360/svg_step_model.py emit-layer output/example-cad.svg overlay`

## Tech Stack

- Plain static HTML, CSS, and browser ES modules
- Local Node scripts for development, verification, and asset generation
- `opentype.js` for font loading and text-to-path conversion
- GitHub Pages for static hosting

No application bundler is required for runtime deployment.

## Local Development

Requirements:

- Node.js `20+`

Commands:

- `npm run dev`  
  Starts the local static development server.
- `npm test`  
  Runs the repository’s Node-based test suite.
- `npm run build`  
  Runs static build verification checks.

The deployable site is served from [`site/`](site/).

## Deployment

GitHub Pages deployment is handled by [`deploy.yml`](.github/workflows/deploy.yml).

On pushes to `main`, the workflow:

1. installs Node,
2. runs `npm test`,
3. runs `npm run build`,
4. uploads the static Pages artifact from `site/`,
5. deploys the site to GitHub Pages.

## Repository Layout

- [`site/`](site/)
  Static application files served in development and production.
- [`scripts/`](scripts/)
  Local utility scripts for the dev server, build verification, and AprilTag data generation.
- [`tests/`](tests/)
  Node-based tests covering core logic, tag data, template metadata, and text fitting.
- [`docs/`](docs/)
  Source requirements, template references, and visual assets used to derive the production output.
- [`vendor/`](vendor/)
  Source AprilTag image assets used for generated tag data.

## Fonts and Third-Party Assets

This repository bundles the following Pretendard font files for UI selection and SVG text export:

- `site/assets/fonts/Pretendard-Bold.otf`
- `site/assets/fonts/Pretendard-SemiBold.otf`
- `site/assets/fonts/Pretendard-ExtraBold.otf`

Pretendard is by Orion Cactus and is distributed under the `SIL Open Font License 1.1`. The included license text is available at [`LICENSES/Pretendard-OFL-1.1.txt`](LICENSES/Pretendard-OFL-1.1.txt).

Source project: [orioncactus/pretendard](https://github.com/orioncactus/pretendard)

## License

This project is licensed under the MIT License. See [`LICENSE`](LICENSE) for details.
