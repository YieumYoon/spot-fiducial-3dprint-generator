from __future__ import annotations

import adsk.core
import adsk.fusion
import importlib
import pathlib
import sys
import traceback


SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

BASE_EXTRUDE_MM = -1.35
WHITE_EXTRUDE_MM = 1.0
BLACK_EXTRUDE_MM = 1.0005
CM_TO_MM = 10.0
def run(context):
    ui = None
    temp_paths: list[str] = []

    try:
        app = adsk.core.Application.get()
        ui = app.userInterface

        svg_path = prompt_for_input_svg(ui)
        if not svg_path:
            return

        step_path = prompt_for_output_step(ui, svg_path)
        if not step_path:
            return

        svg_step_model = load_svg_step_model_module()
        model = svg_step_model.load_spot_svg_model(svg_path)
        apriltag_cell_shapes = model.build_apriltag_cell_shapes()
        apriltag_white_cell_shapes = model.build_apriltag_white_cell_shapes()

        app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            raise RuntimeError("Fusion did not open a modeling document.")

        root_component = design.rootComponent
        occurrence = root_component.occurrences.addNewComponent(adsk.core.Matrix3D.create())
        target_component = occurrence.component
        target_component.name = pathlib.Path(svg_path).stem

        base_sketch = target_component.sketches.add(target_component.xYConstructionPlane)
        base_sketch.name = "step-base"
        white_sketch = target_component.sketches.add(target_component.xYConstructionPlane)
        white_sketch.name = "step-white"
        black_sketch = target_component.sketches.add(target_component.xYConstructionPlane)
        black_sketch.name = "step-black"

        draw_shapes_into_sketch(base_sketch, [*model.plate_shapes, *model.hole_shapes], model.width_mm, model.height_mm)
        draw_shapes_into_sketch(
            white_sketch,
            [*model.plate_shapes, *model.hole_shapes, *model.decorative_black_shapes, *apriltag_cell_shapes],
            model.width_mm,
            model.height_mm,
        )
        draw_shapes_into_sketch(
            black_sketch,
            model.decorative_black_shapes,
            model.width_mm,
            model.height_mm,
        )
        app.activeViewport.refresh()

        base_profiles = collect_profiles(base_sketch, model, lambda state: state.base)
        if base_profiles.count == 0:
            base_box = describe_sketch_box(base_sketch)
            raise RuntimeError(
                "No base profiles were detected in the imported SVG. "
                f"Imported sketch curves: {count_sketch_curves(base_sketch)}; "
                f"computed profiles: {base_sketch.profiles.count}; "
                f"sketch box: {base_box}."
            )

        base_feature = extrude_profiles(
            target_component,
            base_profiles,
            BASE_EXTRUDE_MM,
            adsk.fusion.FeatureOperations.NewBodyFeatureOperation,
        )
        if base_feature.bodies.count == 0:
            raise RuntimeError("Fusion created no base bodies from the plate profiles.")

        white_body = base_feature.bodies.item(0)
        white_body.name = "white"

        white_profiles = collect_profiles(
            white_sketch,
            model,
            lambda state: state.white,
            exclude_apriltag_box=True,
        )
        if white_profiles.count == 0:
            overlay_box = describe_sketch_box(white_sketch)
            raise RuntimeError(
                "No white overlay profiles were detected in the imported SVG. "
                f"Imported sketch curves: {count_sketch_curves(white_sketch)}; "
                f"computed profiles: {white_sketch.profiles.count}; "
                f"sketch box: {overlay_box}."
            )
        extrude_profiles(
            target_component,
            white_profiles,
            WHITE_EXTRUDE_MM,
            adsk.fusion.FeatureOperations.JoinFeatureOperation,
        )

        for index, cell_shape in enumerate(apriltag_white_cell_shapes, start=1):
            extrude_single_shape_feature(
                target_component,
                cell_shape,
                model.width_mm,
                model.height_mm,
                WHITE_EXTRUDE_MM,
                f"apriltag-white-cell-{index}",
                adsk.fusion.FeatureOperations.JoinFeatureOperation,
            )

        black_profiles = collect_black_profiles(black_sketch, model)
        if black_profiles.count == 0:
            overlay_box = describe_sketch_box(black_sketch)
            raise RuntimeError(
                "No black overlay profiles were detected in the imported SVG. "
                f"Imported sketch curves: {count_sketch_curves(black_sketch)}; "
                f"computed profiles: {black_sketch.profiles.count}; "
                f"sketch box: {overlay_box}."
            )

        black_feature = extrude_profiles(
            target_component,
            black_profiles,
            BLACK_EXTRUDE_MM,
            adsk.fusion.FeatureOperations.NewBodyFeatureOperation,
        )
        black_body_count = 0
        for index in range(black_feature.bodies.count):
            black_body_count += 1
            black_feature.bodies.item(index).name = f"black ({black_body_count})"

        apriltag_cell_bodies = []
        for cell_shape in apriltag_cell_shapes:
            body = extrude_single_shape_body(
                target_component,
                cell_shape,
                model.width_mm,
                model.height_mm,
                BLACK_EXTRUDE_MM,
                f"apriltag-cell-{black_body_count + 1}",
            )
            black_body_count += 1
            body.name = f"black ({black_body_count})"
            apriltag_cell_bodies.append(body)

        if len(apriltag_cell_bodies) > 1:
            apriltag_body = combine_bodies(
                target_component,
                apriltag_cell_bodies[0],
                apriltag_cell_bodies[1:],
            )
            if apriltag_body:
                apriltag_body.name = "black apriltag"

        export_step(design, target_component, step_path)
        ui.messageBox(
            "STEP export completed.\n\n"
            f"SVG: {svg_path}\n"
            f"STEP: {step_path}\n\n"
            "White body: base -1.35 mm plus +1.0 mm overlay\n"
            f"Black bodies: +{BLACK_EXTRUDE_MM:.4f} mm"
        )
    except Exception:
        if ui:
            ui.messageBox(f"STEP export failed:\n\n{traceback.format_exc()}")
        else:
            raise
    finally:
        cleanup_files(temp_paths)


def stop(context):
    return


def load_svg_step_model_module():
    module_name = "svg_step_model"
    if module_name in sys.modules:
        return importlib.reload(sys.modules[module_name])
    return importlib.import_module(module_name)


def prompt_for_input_svg(ui: adsk.core.UserInterface) -> str | None:
    dialog = ui.createFileDialog()
    dialog.title = "Select a Spot CAD SVG"
    dialog.filter = "SVG Files (*.svg)"
    dialog.isMultiSelectEnabled = False
    if dialog.showOpen() != adsk.core.DialogResults.DialogOK:
        return None
    return dialog.filename


def prompt_for_output_step(ui: adsk.core.UserInterface, svg_path: str) -> str | None:
    svg_file = pathlib.Path(svg_path)
    dialog = ui.createFileDialog()
    dialog.title = "Save STEP Export"
    dialog.filter = "STEP Files (*.step)"
    dialog.isMultiSelectEnabled = False
    dialog.initialDirectory = str(svg_file.parent)
    dialog.initialFilename = svg_file.with_suffix(".step").name
    if dialog.showSave() != adsk.core.DialogResults.DialogOK:
        return None
    filename = dialog.filename
    if not filename.lower().endswith(".step"):
        filename += ".step"
    return filename


def cleanup_files(paths: list[str]) -> None:
    return


def draw_shapes_into_sketch(sketch: adsk.fusion.Sketch, shapes, model_width_mm: float, model_height_mm: float) -> None:
    sketch.isComputeDeferred = True
    for shape in shapes:
        for polygon in shape.subpaths:
            draw_polygon(sketch, polygon, model_width_mm, model_height_mm)
    sketch.isComputeDeferred = False


def draw_polygon(sketch: adsk.fusion.Sketch, polygon, model_width_mm: float, model_height_mm: float) -> None:
    if len(polygon) < 3:
        return

    lines = sketch.sketchCurves.sketchLines
    previous_point = point3d_from_mm(*polygon[0], model_width_mm=model_width_mm, model_height_mm=model_height_mm)
    first_point = previous_point

    for point in polygon[1:]:
        next_point = point3d_from_mm(*point, model_width_mm=model_width_mm, model_height_mm=model_height_mm)
        lines.addByTwoPoints(previous_point, next_point)
        previous_point = next_point

    lines.addByTwoPoints(previous_point, first_point)


def point3d_from_mm(x_mm: float, y_mm: float, model_width_mm: float, model_height_mm: float) -> adsk.core.Point3D:
    mirrored_y_mm = model_height_mm - y_mm
    return adsk.core.Point3D.create(x_mm / CM_TO_MM, mirrored_y_mm / CM_TO_MM, 0.0)


def extrude_single_shape_body(
    component: adsk.fusion.Component,
    shape,
    model_width_mm: float,
    model_height_mm: float,
    distance_mm: float,
    sketch_name: str,
):
    sketch = component.sketches.add(component.xYConstructionPlane)
    sketch.name = sketch_name
    draw_shapes_into_sketch(sketch, [shape], model_width_mm, model_height_mm)
    if sketch.profiles.count == 0:
        raise RuntimeError(f"No profile was created for {sketch_name}.")
    profiles = adsk.core.ObjectCollection.create()
    profiles.add(sketch.profiles.item(0))
    feature = extrude_profiles(
        component,
        profiles,
        distance_mm,
        adsk.fusion.FeatureOperations.NewBodyFeatureOperation,
    )
    if feature.bodies.count == 0:
        raise RuntimeError(f"Fusion created no body for {sketch_name}.")
    return feature.bodies.item(0)


def extrude_single_shape_feature(
    component: adsk.fusion.Component,
    shape,
    model_width_mm: float,
    model_height_mm: float,
    distance_mm: float,
    sketch_name: str,
    operation,
):
    sketch = component.sketches.add(component.xYConstructionPlane)
    sketch.name = sketch_name
    draw_shapes_into_sketch(sketch, [shape], model_width_mm, model_height_mm)
    if sketch.profiles.count == 0:
        raise RuntimeError(f"No profile was created for {sketch_name}.")
    profiles = adsk.core.ObjectCollection.create()
    profiles.add(sketch.profiles.item(0))
    return extrude_profiles(
        component,
        profiles,
        distance_mm,
        operation,
    )


def combine_bodies(
    component: adsk.fusion.Component,
    target_body,
    tool_bodies,
):
    if not tool_bodies:
        return target_body

    tools = adsk.core.ObjectCollection.create()
    for body in tool_bodies:
        tools.add(body)

    combine_features = component.features.combineFeatures
    combine_input = combine_features.createInput(target_body, tools)
    combine_input.isKeepToolBodies = False
    combine_input.isNewComponent = False
    combine_input.operation = adsk.fusion.FeatureOperations.JoinFeatureOperation
    combine_feature = combine_features.add(combine_input)
    if not combine_feature:
        raise RuntimeError("Fusion failed to combine AprilTag cell bodies.")
    return target_body


def count_sketch_curves(sketch: adsk.fusion.Sketch) -> int:
    curves = sketch.sketchCurves
    collection_names = (
        "sketchLines",
        "sketchArcs",
        "sketchCircles",
        "sketchEllipses",
        "sketchEllipticalArcs",
        "sketchFittedSplines",
        "sketchFixedSplines",
        "sketchConics",
        "sketchControlPointSplines",
    )
    total = 0
    for name in collection_names:
        collection = getattr(curves, name, None)
        if collection:
            total += collection.count
    return total


def collect_profiles(
    sketch: adsk.fusion.Sketch,
    model,
    predicate,
    exclude_apriltag_box: bool = False,
) -> adsk.core.ObjectCollection:
    profiles = adsk.core.ObjectCollection.create()
    for index in range(sketch.profiles.count):
        profile = sketch.profiles.item(index)
        sample_x, sample_y = profile_sample_point(profile)
        sample_x_mm = sample_x * CM_TO_MM
        sample_y_mm = model.height_mm - (sample_y * CM_TO_MM)
        point_state = model.classify_point_mm(sample_x_mm, sample_y_mm)
        if exclude_apriltag_box and model.point_in_apriltag_box(sample_x_mm, sample_y_mm):
            continue
        if predicate(point_state):
            profiles.add(profile)
    return profiles


def collect_black_profiles(
    sketch: adsk.fusion.Sketch,
    model,
) -> adsk.core.ObjectCollection:
    profiles = adsk.core.ObjectCollection.create()
    for index in range(sketch.profiles.count):
        profile = sketch.profiles.item(index)
        sample_x, sample_y = profile_sample_point(profile)
        sample_x_mm = sample_x * CM_TO_MM
        sample_y_mm = model.height_mm - (sample_y * CM_TO_MM)
        point_state = model.classify_point_mm(sample_x_mm, sample_y_mm)
        if point_state.black or profile_has_inner_loops(profile):
            profiles.add(profile)
    return profiles


def profile_has_inner_loops(profile: adsk.fusion.Profile) -> bool:
    loops = profile.profileLoops
    for index in range(loops.count):
        if not loops.item(index).isOuter:
            return True
    return False


def profile_sample_point(profile: adsk.fusion.Profile) -> tuple[float, float]:
    face = getattr(profile, "face", None)
    if face:
        point = face.pointOnFace
        return (point.x, point.y)

    area_properties = profile.areaProperties(adsk.fusion.CalculationAccuracy.HighCalculationAccuracy)
    centroid = area_properties.centroid
    return (centroid.x, centroid.y)


def build_curve_bounding_box(sketch: adsk.fusion.Sketch):
    curves = sketch.sketchCurves
    boxes = []
    for name in (
        "sketchLines",
        "sketchArcs",
        "sketchCircles",
        "sketchEllipses",
        "sketchEllipticalArcs",
        "sketchFittedSplines",
        "sketchFixedSplines",
        "sketchConics",
        "sketchControlPointSplines",
    ):
        collection = getattr(curves, name, None)
        if not collection:
            continue
        for index in range(collection.count):
            entity = collection.item(index)
            if entity and entity.boundingBox:
                boxes.append(entity.boundingBox)

    if not boxes:
        return None

    bounding_box = adsk.core.BoundingBox3D.create(
        boxes[0].minPoint.copy(),
        boxes[0].maxPoint.copy(),
    )
    for box in boxes[1:]:
        bounding_box.combine(box)
    return bounding_box


def describe_sketch_box(sketch: adsk.fusion.Sketch) -> str:
    bounding_box = sketch.boundingBox
    if not bounding_box:
        bounding_box = build_curve_bounding_box(sketch)
    if not bounding_box:
        return "none"
    min_point = bounding_box.minPoint
    max_point = bounding_box.maxPoint
    return (
        f"min=({min_point.x:.4f}, {min_point.y:.4f}), "
        f"max=({max_point.x:.4f}, {max_point.y:.4f})"
    )


def extrude_profiles(
    component: adsk.fusion.Component,
    profiles: adsk.core.ObjectCollection,
    distance_mm: float,
    operation: adsk.fusion.FeatureOperations,
) -> adsk.fusion.ExtrudeFeature:
    extrudes = component.features.extrudeFeatures
    extrude_input = extrudes.createInput(profiles, operation)
    distance_value = adsk.core.ValueInput.createByString(f"{distance_mm} mm")
    if not extrude_input.setDistanceExtent(False, distance_value):
        raise RuntimeError(f"Fusion rejected the extrude distance {distance_mm} mm.")
    feature = extrudes.add(extrude_input)
    if not feature:
        raise RuntimeError("Fusion failed to create an extrude feature.")
    return feature


def export_step(design: adsk.fusion.Design, component: adsk.fusion.Component, step_path: str) -> None:
    export_manager = design.exportManager
    options = export_manager.createSTEPExportOptions(step_path, component)
    if not export_manager.execute(options):
        raise RuntimeError(f"Fusion failed to export the STEP file to {step_path}.")
