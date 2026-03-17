# Spot Fiducial AprilTag Plate Generator

Static browser application for generating fabrication-ready SVG fiducial plates for Boston Dynamics Spot. The app runs entirely client-side and is designed to be hosted directly on GitHub Pages with no backend services.

## Overview

This repository contains a fixed-template generator for Spot fiducial plates built around the `tag36h11` AprilTag family. Users can choose a supported tag ID, set company and robot names, pick a drill-hole preset, choose a bundled font, optionally use a built-in logo or upload a custom SVG logo, and export either a print-safe SVG or a CAD-safe SVG.

The exported file preserves the project’s fixed geometry and produces a clean fabrication asset rather than a generic preview graphic.

## Key Capabilities

- Generates Spot fiducial plate SVGs with fixed millimeter-based geometry.
- Supports `tag36h11` IDs `001-586`.
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

The deployable site is served from [`site/`](/Users/junsu/Documents/github/spot-fiducial-3dprint-generator/site).

## Deployment

GitHub Pages deployment is handled by [`deploy.yml`](/Users/junsu/Documents/github/spot-fiducial-3dprint-generator/.github/workflows/deploy.yml).

On pushes to `main`, the workflow:

1. installs Node,
2. runs `npm test`,
3. runs `npm run build`,
4. uploads the static Pages artifact from `site/`,
5. deploys the site to GitHub Pages.

## Repository Layout

- [`site/`](/Users/junsu/Documents/github/spot-fiducial-3dprint-generator/site)  
  Static application files served in development and production.
- [`scripts/`](/Users/junsu/Documents/github/spot-fiducial-3dprint-generator/scripts)  
  Local utility scripts for the dev server, build verification, and AprilTag data generation.
- [`tests/`](/Users/junsu/Documents/github/spot-fiducial-3dprint-generator/tests)  
  Node-based tests covering core logic, tag data, template metadata, and text fitting.
- [`docs/`](/Users/junsu/Documents/github/spot-fiducial-3dprint-generator/docs)  
  Source requirements, template references, and visual assets used to derive the production output.
- [`vendor/`](/Users/junsu/Documents/github/spot-fiducial-3dprint-generator/vendor)  
  Source AprilTag image assets used for generated tag data.

## Fonts and Third-Party Assets

This repository bundles the following Pretendard font files for UI selection and SVG text export:

- `site/assets/fonts/Pretendard-Bold.otf`
- `site/assets/fonts/Pretendard-SemiBold.otf`
- `site/assets/fonts/Pretendard-ExtraBold.otf`

Pretendard is by Orion Cactus and is distributed under the `SIL Open Font License 1.1`. The included license text is available at [`LICENSES/Pretendard-OFL-1.1.txt`](/Users/junsu/Documents/github/spot-fiducial-3dprint-generator/LICENSES/Pretendard-OFL-1.1.txt).

Source project: [orioncactus/pretendard](https://github.com/orioncactus/pretendard)

## License

This project is licensed under the MIT License. See [`LICENSE`](/Users/junsu/Documents/github/spot-fiducial-3dprint-generator/LICENSE) for details.
