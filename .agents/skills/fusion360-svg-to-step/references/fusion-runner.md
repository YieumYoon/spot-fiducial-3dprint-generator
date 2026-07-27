# Fusion Runner Reference

Use this runner only through the Autodesk Fusion MCP connector. Replace the three placeholder values with resolved absolute paths before execution.

```python
from __future__ import annotations

import importlib
import os
import pathlib
import sys

import adsk.core
import adsk.fusion


REPO_ROOT = pathlib.Path("<REPO_ROOT>").resolve()
SVG_PATH = pathlib.Path("<SVG_PATH>").resolve()
STEP_PATH = pathlib.Path("<STEP_PATH>").resolve()
SCRIPT_DIR = REPO_ROOT / "scripts" / "fusion360"


def run(_context: str):
    if not SVG_PATH.is_file():
        raise FileNotFoundError(f"SVG input not found: {SVG_PATH}")
    if SVG_PATH.suffix.lower() != ".svg":
        raise ValueError(f"Expected an SVG input: {SVG_PATH}")
    if not (SCRIPT_DIR / "spot_svg_to_step.py").is_file():
        raise FileNotFoundError(f"Project converter not found: {SCRIPT_DIR}")

    STEP_PATH.parent.mkdir(parents=True, exist_ok=True)
    if str(SCRIPT_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPT_DIR))

    import spot_svg_to_step as script

    importlib.reload(script)
    app = adsk.core.Application.get()
    svg_step_model = script.load_svg_step_model_module()
    model = svg_step_model.load_spot_svg_model(str(SVG_PATH))
    apriltag_cell_shapes = model.build_apriltag_cell_shapes()
    apriltag_white_cell_shapes = model.build_apriltag_white_cell_shapes()

    app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)
    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        raise RuntimeError("Fusion did not open a modeling document.")

    root_component = design.rootComponent
    occurrence = root_component.occurrences.addNewComponent(adsk.core.Matrix3D.create())
    target_component = occurrence.component
    target_component.name = SVG_PATH.stem

    base_sketch = target_component.sketches.add(target_component.xYConstructionPlane)
    base_sketch.name = "step-base"
    white_sketch = target_component.sketches.add(target_component.xYConstructionPlane)
    white_sketch.name = "step-white"
    black_sketch = target_component.sketches.add(target_component.xYConstructionPlane)
    black_sketch.name = "step-black"

    script.draw_shapes_into_sketch(
        base_sketch,
        [*model.plate_shapes, *model.hole_shapes],
        model.width_mm,
        model.height_mm,
    )
    script.draw_shapes_into_sketch(
        white_sketch,
        [
            *model.plate_shapes,
            *model.hole_shapes,
            *model.decorative_black_shapes,
            *apriltag_cell_shapes,
        ],
        model.width_mm,
        model.height_mm,
    )
    script.draw_shapes_into_sketch(
        black_sketch,
        model.decorative_black_shapes,
        model.width_mm,
        model.height_mm,
    )
    app.activeViewport.refresh()

    base_profiles = script.collect_profiles(base_sketch, model, lambda state: state.base)
    if base_profiles.count == 0:
        raise RuntimeError("No base profiles were detected in the SVG.")
    base_feature = script.extrude_profiles(
        target_component,
        base_profiles,
        script.BASE_EXTRUDE_MM,
        adsk.fusion.FeatureOperations.NewBodyFeatureOperation,
    )
    if base_feature.bodies.count == 0:
        raise RuntimeError("Fusion created no base body.")
    base_feature.bodies.item(0).name = "white"

    white_profiles = script.collect_profiles(
        white_sketch,
        model,
        lambda state: state.white,
        exclude_apriltag_box=True,
    )
    if white_profiles.count == 0:
        raise RuntimeError("No white overlay profiles were detected in the SVG.")
    script.extrude_profiles(
        target_component,
        white_profiles,
        script.WHITE_EXTRUDE_MM,
        adsk.fusion.FeatureOperations.JoinFeatureOperation,
    )

    for index, cell_shape in enumerate(apriltag_white_cell_shapes, start=1):
        script.extrude_single_shape_feature(
            target_component,
            cell_shape,
            model.width_mm,
            model.height_mm,
            script.WHITE_EXTRUDE_MM,
            f"apriltag-white-cell-{index}",
            adsk.fusion.FeatureOperations.JoinFeatureOperation,
        )

    black_profiles = script.collect_black_profiles(black_sketch, model)
    if black_profiles.count == 0:
        raise RuntimeError("No black overlay profiles were detected in the SVG.")
    black_feature = script.extrude_profiles(
        target_component,
        black_profiles,
        script.BLACK_EXTRUDE_MM,
        adsk.fusion.FeatureOperations.NewBodyFeatureOperation,
    )
    black_body_count = 0
    for index in range(black_feature.bodies.count):
        black_body_count += 1
        black_feature.bodies.item(index).name = f"black ({black_body_count})"

    apriltag_cell_bodies = []
    for cell_shape in apriltag_cell_shapes:
        black_body_count += 1
        body = script.extrude_single_shape_body(
            target_component,
            cell_shape,
            model.width_mm,
            model.height_mm,
            script.BLACK_EXTRUDE_MM,
            f"apriltag-cell-{black_body_count}",
        )
        body.name = f"black ({black_body_count})"
        apriltag_cell_bodies.append(body)

    if len(apriltag_cell_bodies) > 1:
        apriltag_body = script.combine_bodies(
            target_component,
            apriltag_cell_bodies[0],
            apriltag_cell_bodies[1:],
        )
        apriltag_body.name = "black apriltag"

    script.export_step(design, target_component, str(STEP_PATH))
    size_bytes = os.path.getsize(STEP_PATH)
    print(
        {
            "step_path": str(STEP_PATH),
            "size_bytes": size_bytes,
            "size_mib": round(size_bytes / 1024 / 1024, 2),
            "component": target_component.name,
            "body_count": target_component.bRepBodies.count,
        }
    )
```

## Batch document cleanup

After verifying each conversion, use the connector's document operation equivalent to:

```json
{
  "operation": "close",
  "userConfirmedCloseWithoutSave": true
}
```

Older Claude connectors accepted that object through `fusion_mcp_execute` with `featureType="document"`. Discover the current connector's equivalent instead of assuming the legacy tool name.
