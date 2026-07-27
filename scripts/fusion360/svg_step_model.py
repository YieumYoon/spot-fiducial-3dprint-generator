#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence
import xml.etree.ElementTree as ET


SVG_NS = "http://www.w3.org/2000/svg"
IDENTITY_MATRIX = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
TARGET_BASE_GROUP_IDS = {"background", "holes"}
TARGET_BLACK_GROUP_IDS = {
    "apriltag-black",
    "company-name",
    "robot-name",
    "fixed-title",
    "display-id",
    "logo",
    "bottom-warning",
    "dock-location",
}
DRAWABLE_TAGS = {"path", "rect", "circle", "ellipse", "polygon", "polyline"}
COMMAND_RE = re.compile(
    r"[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d+\.\d+|\d+\.?|\.\d+)(?:[eE][-+]?\d+)?"
)
TRANSFORM_RE = re.compile(r"([A-Za-z]+)\s*\(([^)]*)\)")


def local_name(tag: str) -> str:
    return tag.split("}", 1)[-1]


def multiply_matrix(left: Sequence[float], right: Sequence[float]) -> tuple[float, float, float, float, float, float]:
    a1, b1, c1, d1, e1, f1 = left
    a2, b2, c2, d2, e2, f2 = right
    return (
        (a1 * a2) + (c1 * b2),
        (b1 * a2) + (d1 * b2),
        (a1 * c2) + (c1 * d2),
        (b1 * c2) + (d1 * d2),
        (a1 * e2) + (c1 * f2) + e1,
        (b1 * e2) + (d1 * f2) + f1,
    )


def apply_matrix(matrix: Sequence[float], point: tuple[float, float]) -> tuple[float, float]:
    a, b, c, d, e, f = matrix
    x, y = point
    return ((a * x) + (c * y) + e, (b * x) + (d * y) + f)


def parse_transform(transform_text: str | None) -> tuple[float, float, float, float, float, float]:
    if not transform_text:
        return IDENTITY_MATRIX

    matrix = IDENTITY_MATRIX
    for name, raw_args in TRANSFORM_RE.findall(transform_text):
        args = [float(part) for part in re.split(r"[\s,]+", raw_args.strip()) if part]
        lower_name = name.lower()
        if lower_name == "matrix" and len(args) == 6:
            next_matrix = tuple(args)
        elif lower_name == "translate":
            tx = args[0] if args else 0.0
            ty = args[1] if len(args) > 1 else 0.0
            next_matrix = (1.0, 0.0, 0.0, 1.0, tx, ty)
        elif lower_name == "scale":
            sx = args[0] if args else 1.0
            sy = args[1] if len(args) > 1 else sx
            next_matrix = (sx, 0.0, 0.0, sy, 0.0, 0.0)
        elif lower_name == "rotate":
            angle = math.radians(args[0] if args else 0.0)
            cos_angle = math.cos(angle)
            sin_angle = math.sin(angle)
            rotation = (cos_angle, sin_angle, -sin_angle, cos_angle, 0.0, 0.0)
            if len(args) >= 3:
                cx = args[1]
                cy = args[2]
                next_matrix = multiply_matrix(
                    multiply_matrix((1.0, 0.0, 0.0, 1.0, cx, cy), rotation),
                    (1.0, 0.0, 0.0, 1.0, -cx, -cy),
                )
            else:
                next_matrix = rotation
        else:
            raise ValueError(f"Unsupported transform '{name}' in SVG.")
        matrix = multiply_matrix(matrix, next_matrix)

    return matrix


def parse_length_mm(length_text: str | None, fallback: float = 0.0) -> float:
    if not length_text:
        return fallback
    match = re.match(r"\s*([-+]?(?:\d+\.\d+|\d+\.?|\.\d+))\s*([A-Za-z%]*)", length_text)
    if not match:
        return fallback
    value = float(match.group(1))
    unit = (match.group(2) or "mm").lower()
    if unit in {"mm", ""}:
        return value
    if unit == "cm":
        return value * 10.0
    if unit == "in":
        return value * 25.4
    if unit == "px":
        return value * 25.4 / 96.0
    raise ValueError(f"Unsupported SVG unit '{unit}'.")


def parse_points(points_text: str, matrix: Sequence[float]) -> list[tuple[float, float]]:
    numbers = [float(token) for token in re.findall(r"[-+]?(?:\d+\.\d+|\d+\.?|\.\d+)(?:[eE][-+]?\d+)?", points_text)]
    if len(numbers) < 4 or len(numbers) % 2:
        return []
    points = []
    for index in range(0, len(numbers), 2):
        points.append(apply_matrix(matrix, (numbers[index], numbers[index + 1])))
    return points


def distance(point_a: tuple[float, float], point_b: tuple[float, float]) -> float:
    return math.hypot(point_b[0] - point_a[0], point_b[1] - point_a[1])


def midpoint(point_a: tuple[float, float], point_b: tuple[float, float]) -> tuple[float, float]:
    return ((point_a[0] + point_b[0]) * 0.5, (point_a[1] + point_b[1]) * 0.5)


def flatten_cubic(
    point_0: tuple[float, float],
    point_1: tuple[float, float],
    point_2: tuple[float, float],
    point_3: tuple[float, float],
    tolerance: float,
    points: list[tuple[float, float]],
    depth: int = 0,
) -> None:
    line_error = max(
        point_line_distance(point_1, point_0, point_3),
        point_line_distance(point_2, point_0, point_3),
    )
    if line_error <= tolerance or depth >= 12:
        points.append(point_3)
        return

    p01 = midpoint(point_0, point_1)
    p12 = midpoint(point_1, point_2)
    p23 = midpoint(point_2, point_3)
    p012 = midpoint(p01, p12)
    p123 = midpoint(p12, p23)
    p0123 = midpoint(p012, p123)
    flatten_cubic(point_0, p01, p012, p0123, tolerance, points, depth + 1)
    flatten_cubic(p0123, p123, p23, point_3, tolerance, points, depth + 1)


def flatten_quadratic(
    point_0: tuple[float, float],
    point_1: tuple[float, float],
    point_2: tuple[float, float],
    tolerance: float,
    points: list[tuple[float, float]],
    depth: int = 0,
) -> None:
    line_error = point_line_distance(point_1, point_0, point_2)
    if line_error <= tolerance or depth >= 12:
        points.append(point_2)
        return

    p01 = midpoint(point_0, point_1)
    p12 = midpoint(point_1, point_2)
    p012 = midpoint(p01, p12)
    flatten_quadratic(point_0, p01, p012, tolerance, points, depth + 1)
    flatten_quadratic(p012, p12, point_2, tolerance, points, depth + 1)


def point_line_distance(
    point: tuple[float, float],
    line_start: tuple[float, float],
    line_end: tuple[float, float],
) -> float:
    if line_start == line_end:
        return distance(point, line_start)
    numerator = abs(
        ((line_end[1] - line_start[1]) * point[0])
        - ((line_end[0] - line_start[0]) * point[1])
        + (line_end[0] * line_start[1])
        - (line_end[1] * line_start[0])
    )
    denominator = distance(line_start, line_end)
    return numerator / denominator


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def vector_angle(u: tuple[float, float], v: tuple[float, float]) -> float:
    ux, uy = u
    vx, vy = v
    magnitude = math.hypot(ux, uy) * math.hypot(vx, vy)
    if magnitude == 0:
        return 0.0
    sign = 1.0 if ((ux * vy) - (uy * vx)) >= 0 else -1.0
    angle = math.acos(clamp(((ux * vx) + (uy * vy)) / magnitude, -1.0, 1.0))
    return sign * angle


def flatten_arc(
    start_point: tuple[float, float],
    rx: float,
    ry: float,
    x_axis_rotation_deg: float,
    large_arc_flag: int,
    sweep_flag: int,
    end_point: tuple[float, float],
    tolerance: float,
) -> list[tuple[float, float]]:
    if rx == 0 or ry == 0 or start_point == end_point:
        return [end_point]

    rotation = math.radians(x_axis_rotation_deg % 360.0)
    cos_rotation = math.cos(rotation)
    sin_rotation = math.sin(rotation)

    dx2 = (start_point[0] - end_point[0]) * 0.5
    dy2 = (start_point[1] - end_point[1]) * 0.5
    x1_prime = (cos_rotation * dx2) + (sin_rotation * dy2)
    y1_prime = (-sin_rotation * dx2) + (cos_rotation * dy2)

    rx = abs(rx)
    ry = abs(ry)
    lambda_scale = (x1_prime * x1_prime) / (rx * rx) + (y1_prime * y1_prime) / (ry * ry)
    if lambda_scale > 1:
        scale = math.sqrt(lambda_scale)
        rx *= scale
        ry *= scale

    numerator = (rx * rx * ry * ry) - (rx * rx * y1_prime * y1_prime) - (ry * ry * x1_prime * x1_prime)
    denominator = (rx * rx * y1_prime * y1_prime) + (ry * ry * x1_prime * x1_prime)
    if denominator == 0:
        return [end_point]

    center_factor = math.sqrt(max(0.0, numerator / denominator))
    if large_arc_flag == sweep_flag:
        center_factor *= -1.0

    cx_prime = center_factor * ((rx * y1_prime) / ry)
    cy_prime = center_factor * (-(ry * x1_prime) / rx)
    cx = (cos_rotation * cx_prime) - (sin_rotation * cy_prime) + ((start_point[0] + end_point[0]) * 0.5)
    cy = (sin_rotation * cx_prime) + (cos_rotation * cy_prime) + ((start_point[1] + end_point[1]) * 0.5)

    unit_start = ((x1_prime - cx_prime) / rx, (y1_prime - cy_prime) / ry)
    unit_end = ((-x1_prime - cx_prime) / rx, (-y1_prime - cy_prime) / ry)
    start_angle = vector_angle((1.0, 0.0), unit_start)
    delta_angle = vector_angle(unit_start, unit_end)

    if not sweep_flag and delta_angle > 0:
        delta_angle -= 2 * math.pi
    elif sweep_flag and delta_angle < 0:
        delta_angle += 2 * math.pi

    radius = max(rx, ry)
    max_step = 2.0 * math.acos(max(-1.0, min(1.0, 1.0 - (tolerance / max(radius, tolerance)))))
    if not math.isfinite(max_step) or max_step <= 0:
        max_step = math.pi / 12.0
    segment_count = max(4, int(math.ceil(abs(delta_angle) / max_step)))

    points = []
    for index in range(1, segment_count + 1):
        theta = start_angle + (delta_angle * index / segment_count)
        point = (
            cx + (rx * math.cos(theta) * cos_rotation) - (ry * math.sin(theta) * sin_rotation),
            cy + (rx * math.cos(theta) * sin_rotation) + (ry * math.sin(theta) * cos_rotation),
        )
        points.append(point)

    return points


def close_polygon(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if len(points) < 3:
        return []
    if distance(points[0], points[-1]) <= 1e-9:
        points = points[:-1]
    if len(points) < 3:
        return []
    return points


def flatten_path(path_data: str, transform: Sequence[float], tolerance: float = 0.05) -> list[list[tuple[float, float]]]:
    tokens = COMMAND_RE.findall(path_data)
    index = 0
    command = None
    current = (0.0, 0.0)
    start = (0.0, 0.0)
    last_control: tuple[float, float] | None = None
    subpath_points: list[tuple[float, float]] = []
    polygons: list[list[tuple[float, float]]] = []

    def read_number() -> float:
        nonlocal index
        value = float(tokens[index])
        index += 1
        return value

    def begin_subpath(point: tuple[float, float]) -> None:
        nonlocal start, subpath_points
        start = point
        subpath_points = [apply_matrix(transform, point)]

    def end_subpath() -> None:
        nonlocal subpath_points
        polygon = close_polygon(subpath_points)
        if polygon:
            polygons.append(polygon)
        subpath_points = []

    while index < len(tokens):
        token = tokens[index]
        if re.match(r"[A-Za-z]", token):
            command = token
            index += 1
        elif command is None:
            raise ValueError("SVG path data started with numbers instead of a command.")

        absolute = command.isupper()
        op = command.upper()

        if op == "M":
            x = read_number()
            y = read_number()
            current = (x, y) if absolute else (current[0] + x, current[1] + y)
            if subpath_points:
                end_subpath()
            begin_subpath(current)
            last_control = None
            command = "L" if absolute else "l"
        elif op == "L":
            x = read_number()
            y = read_number()
            current = (x, y) if absolute else (current[0] + x, current[1] + y)
            subpath_points.append(apply_matrix(transform, current))
            last_control = None
        elif op == "H":
            value = read_number()
            current = (value, current[1]) if absolute else (current[0] + value, current[1])
            subpath_points.append(apply_matrix(transform, current))
            last_control = None
        elif op == "V":
            value = read_number()
            current = (current[0], value) if absolute else (current[0], current[1] + value)
            subpath_points.append(apply_matrix(transform, current))
            last_control = None
        elif op == "C":
            x1 = read_number()
            y1 = read_number()
            x2 = read_number()
            y2 = read_number()
            x = read_number()
            y = read_number()
            control_1 = (x1, y1) if absolute else (current[0] + x1, current[1] + y1)
            control_2 = (x2, y2) if absolute else (current[0] + x2, current[1] + y2)
            end_point = (x, y) if absolute else (current[0] + x, current[1] + y)
            flattened: list[tuple[float, float]] = []
            flatten_cubic(
                apply_matrix(transform, current),
                apply_matrix(transform, control_1),
                apply_matrix(transform, control_2),
                apply_matrix(transform, end_point),
                tolerance,
                flattened,
            )
            subpath_points.extend(flattened)
            current = end_point
            last_control = control_2
        elif op == "S":
            x2 = read_number()
            y2 = read_number()
            x = read_number()
            y = read_number()
            if last_control is None:
                control_1 = current
            else:
                control_1 = ((2 * current[0]) - last_control[0], (2 * current[1]) - last_control[1])
            control_2 = (x2, y2) if absolute else (current[0] + x2, current[1] + y2)
            end_point = (x, y) if absolute else (current[0] + x, current[1] + y)
            flattened = []
            flatten_cubic(
                apply_matrix(transform, current),
                apply_matrix(transform, control_1),
                apply_matrix(transform, control_2),
                apply_matrix(transform, end_point),
                tolerance,
                flattened,
            )
            subpath_points.extend(flattened)
            current = end_point
            last_control = control_2
        elif op == "Q":
            x1 = read_number()
            y1 = read_number()
            x = read_number()
            y = read_number()
            control_1 = (x1, y1) if absolute else (current[0] + x1, current[1] + y1)
            end_point = (x, y) if absolute else (current[0] + x, current[1] + y)
            flattened = []
            flatten_quadratic(
                apply_matrix(transform, current),
                apply_matrix(transform, control_1),
                apply_matrix(transform, end_point),
                tolerance,
                flattened,
            )
            subpath_points.extend(flattened)
            current = end_point
            last_control = control_1
        elif op == "T":
            x = read_number()
            y = read_number()
            if last_control is None:
                control_1 = current
            else:
                control_1 = ((2 * current[0]) - last_control[0], (2 * current[1]) - last_control[1])
            end_point = (x, y) if absolute else (current[0] + x, current[1] + y)
            flattened = []
            flatten_quadratic(
                apply_matrix(transform, current),
                apply_matrix(transform, control_1),
                apply_matrix(transform, end_point),
                tolerance,
                flattened,
            )
            subpath_points.extend(flattened)
            current = end_point
            last_control = control_1
        elif op == "A":
            rx = read_number()
            ry = read_number()
            angle = read_number()
            large_arc = int(read_number())
            sweep = int(read_number())
            x = read_number()
            y = read_number()
            end_point = (x, y) if absolute else (current[0] + x, current[1] + y)
            subpath_points.extend(
                apply_matrix(transform, point)
                for point in flatten_arc(current, rx, ry, angle, large_arc, sweep, end_point, tolerance)
            )
            current = end_point
            last_control = None
        elif op == "Z":
            subpath_points.append(apply_matrix(transform, start))
            current = start
            last_control = None
            end_subpath()
        else:
            raise ValueError(f"Unsupported SVG path command '{command}'.")

    if subpath_points:
        end_subpath()

    return polygons


@dataclass
class FillShape:
    subpaths: list[list[tuple[float, float]]]
    fill_rule: str = "nonzero"

    def contains(self, x_mm: float, y_mm: float) -> bool:
        if self.fill_rule == "evenodd":
            inside = False
            for polygon in self.subpaths:
                if point_in_polygon_evenodd((x_mm, y_mm), polygon):
                    inside = not inside
            return inside

        winding_total = 0
        for polygon in self.subpaths:
            winding_total += winding_number((x_mm, y_mm), polygon)
        return winding_total != 0


def point_in_polygon_evenodd(point: tuple[float, float], polygon: list[tuple[float, float]]) -> bool:
    inside = False
    x, y = point
    point_count = len(polygon)
    for index in range(point_count):
        x1, y1 = polygon[index]
        x2, y2 = polygon[(index + 1) % point_count]
        intersects = ((y1 > y) != (y2 > y)) and (x < (((x2 - x1) * (y - y1)) / (y2 - y1 + 1e-12) + x1))
        if intersects:
            inside = not inside
    return inside


def winding_number(point: tuple[float, float], polygon: list[tuple[float, float]]) -> int:
    winding = 0
    x, y = point
    point_count = len(polygon)
    for index in range(point_count):
        x1, y1 = polygon[index]
        x2, y2 = polygon[(index + 1) % point_count]
        if y1 <= y:
            if y2 > y and is_left((x1, y1), (x2, y2), (x, y)) > 0:
                winding += 1
        elif y2 <= y and is_left((x1, y1), (x2, y2), (x, y)) < 0:
            winding -= 1
    return winding


def is_left(line_start: tuple[float, float], line_end: tuple[float, float], point: tuple[float, float]) -> float:
    return (
        (line_end[0] - line_start[0]) * (point[1] - line_start[1])
        - (point[0] - line_start[0]) * (line_end[1] - line_start[1])
    )


def element_to_fill_shape(
    element: ET.Element,
    transform: Sequence[float],
    inherited_fill_rule: str = "nonzero",
) -> FillShape | None:
    tag = local_name(element.tag)
    fill_rule = element.attrib.get("fill-rule", inherited_fill_rule).strip().lower() or "nonzero"

    if tag == "path":
        path_data = element.attrib.get("d", "").strip()
        if not path_data:
            return None
        subpaths = flatten_path(path_data, transform)
    elif tag == "rect":
        x = float(element.attrib.get("x", "0"))
        y = float(element.attrib.get("y", "0"))
        width = float(element.attrib.get("width", "0"))
        height = float(element.attrib.get("height", "0"))
        points = [
            apply_matrix(transform, (x, y)),
            apply_matrix(transform, (x + width, y)),
            apply_matrix(transform, (x + width, y + height)),
            apply_matrix(transform, (x, y + height)),
        ]
        subpaths = [close_polygon(points)]
    elif tag == "circle":
        cx = float(element.attrib.get("cx", "0"))
        cy = float(element.attrib.get("cy", "0"))
        radius = float(element.attrib.get("r", "0"))
        subpaths = [sample_ellipse((cx, cy), radius, radius, transform)]
    elif tag == "ellipse":
        cx = float(element.attrib.get("cx", "0"))
        cy = float(element.attrib.get("cy", "0"))
        rx = float(element.attrib.get("rx", "0"))
        ry = float(element.attrib.get("ry", "0"))
        subpaths = [sample_ellipse((cx, cy), rx, ry, transform)]
    elif tag in {"polygon", "polyline"}:
        points = parse_points(element.attrib.get("points", ""), transform)
        polygon = close_polygon(points)
        subpaths = [polygon] if polygon else []
    else:
        return None

    subpaths = [polygon for polygon in subpaths if polygon]
    if not subpaths:
        return None
    return FillShape(subpaths=subpaths, fill_rule=fill_rule)


def sample_ellipse(
    center: tuple[float, float],
    rx: float,
    ry: float,
    transform: Sequence[float],
    segment_count: int = 96,
) -> list[tuple[float, float]]:
    cx, cy = center
    points = []
    for index in range(segment_count):
        theta = (2 * math.pi * index) / segment_count
        point = (cx + rx * math.cos(theta), cy + ry * math.sin(theta))
        points.append(apply_matrix(transform, point))
    return close_polygon(points)


@dataclass
class SvgGroupCapture:
    element: ET.Element
    transform: tuple[float, float, float, float, float, float]
    fill_rule: str


@dataclass
class LayerPointState:
    inside_plate: bool
    inside_hole: bool
    inside_black: bool

    @property
    def base(self) -> bool:
        return self.inside_plate and not self.inside_hole

    @property
    def white(self) -> bool:
        return self.base and not self.inside_black

    @property
    def black(self) -> bool:
        return self.inside_black and not self.inside_hole

    @property
    def visible_layer(self) -> str:
        if self.black:
            return "black"
        if self.white:
            return "white"
        if self.inside_hole:
            return "hole"
        return "outside"


class SpotSvgModel:
    def __init__(
        self,
        *,
        tree: ET.ElementTree,
        root: ET.Element,
        width_mm: float,
        height_mm: float,
        apriltag_box: tuple[float, float, float, float] | None,
        apriltag_grid_size: int | None,
        defs: list[ET.Element],
        base_groups: list[ET.Element],
        overlay_groups: list[ET.Element],
        plate_shapes: list[FillShape],
        hole_shapes: list[FillShape],
        apriltag_black_shapes: list[FillShape],
        decorative_black_shapes: list[FillShape],
        black_shapes: list[FillShape],
    ) -> None:
        self.tree = tree
        self.root = root
        self.width_mm = width_mm
        self.height_mm = height_mm
        self.apriltag_box = apriltag_box
        self.apriltag_grid_size = apriltag_grid_size
        self.defs = defs
        self.base_groups = base_groups
        self.overlay_groups = overlay_groups
        self.plate_shapes = plate_shapes
        self.hole_shapes = hole_shapes
        self.apriltag_black_shapes = apriltag_black_shapes
        self.decorative_black_shapes = decorative_black_shapes
        self.black_shapes = black_shapes

    def classify_point_mm(self, x_mm: float, y_mm: float) -> LayerPointState:
        inside_plate = any(shape.contains(x_mm, y_mm) for shape in self.plate_shapes)
        inside_hole = any(shape.contains(x_mm, y_mm) for shape in self.hole_shapes)
        inside_black = any(shape.contains(x_mm, y_mm) for shape in self.black_shapes)
        return LayerPointState(
            inside_plate=inside_plate,
            inside_hole=inside_hole,
            inside_black=inside_black,
        )

    def build_layer_svg(self, layer: str) -> str:
        ET.register_namespace("", SVG_NS)
        layer_root = ET.Element(
            f"{{{SVG_NS}}}svg",
            {
                "width": format_number(self.width_mm) + "mm",
                "height": format_number(self.height_mm) + "mm",
                "viewBox": f"0 0 {format_number(self.width_mm)} {format_number(self.height_mm)}",
                "version": "1.1",
            },
        )

        for defs_element in self.defs:
            layer_root.append(copy.deepcopy(defs_element))

        selected_groups = self.base_groups if layer == "base" else self.overlay_groups
        for group in selected_groups:
            layer_root.append(copy.deepcopy(group))

        return ET.tostring(layer_root, encoding="unicode")

    def describe(self) -> dict[str, object]:
        return {
            "widthMm": self.width_mm,
            "heightMm": self.height_mm,
            "apriltagBox": self.apriltag_box,
            "apriltagGridSize": self.apriltag_grid_size,
            "apriltagBlackShapeCount": len(self.apriltag_black_shapes),
            "decorativeBlackShapeCount": len(self.decorative_black_shapes),
            "plateShapeCount": len(self.plate_shapes),
            "holeShapeCount": len(self.hole_shapes),
            "blackShapeCount": len(self.black_shapes),
            "baseGroupCount": len(self.base_groups),
            "overlayGroupCount": len(self.overlay_groups),
        }

    def build_apriltag_cell_shapes(self) -> list[FillShape]:
        if not self.apriltag_box or not self.apriltag_grid_size:
            return []

        origin_x, origin_y, width_mm, height_mm = self.apriltag_box
        grid_size = self.apriltag_grid_size
        cell_width = width_mm / grid_size
        cell_height = height_mm / grid_size
        cell_shapes: list[FillShape] = []

        for row_index in range(grid_size):
            for column_index in range(grid_size):
                sample_x = origin_x + ((column_index + 0.5) * cell_width)
                sample_y = origin_y + ((row_index + 0.5) * cell_height)
                if not any(shape.contains(sample_x, sample_y) for shape in self.apriltag_black_shapes):
                    continue

                x0 = origin_x + (column_index * cell_width)
                y0 = origin_y + (row_index * cell_height)
                polygon = close_polygon(
                    [
                        (x0, y0),
                        (x0 + cell_width, y0),
                        (x0 + cell_width, y0 + cell_height),
                        (x0, y0 + cell_height),
                    ]
                )
                if polygon:
                    cell_shapes.append(FillShape(subpaths=[polygon], fill_rule="nonzero"))

        return cell_shapes

    def build_apriltag_white_cell_shapes(self) -> list[FillShape]:
        if not self.apriltag_box or not self.apriltag_grid_size:
            return []

        origin_x, origin_y, width_mm, height_mm = self.apriltag_box
        grid_size = self.apriltag_grid_size
        cell_width = width_mm / grid_size
        cell_height = height_mm / grid_size
        cell_shapes: list[FillShape] = []

        for row_index in range(grid_size):
            for column_index in range(grid_size):
                sample_x = origin_x + ((column_index + 0.5) * cell_width)
                sample_y = origin_y + ((row_index + 0.5) * cell_height)
                if not self.classify_point_mm(sample_x, sample_y).white:
                    continue

                x0 = origin_x + (column_index * cell_width)
                y0 = origin_y + (row_index * cell_height)
                polygon = close_polygon(
                    [
                        (x0, y0),
                        (x0 + cell_width, y0),
                        (x0 + cell_width, y0 + cell_height),
                        (x0, y0 + cell_height),
                    ]
                )
                if polygon:
                    cell_shapes.append(FillShape(subpaths=[polygon], fill_rule="nonzero"))

        return cell_shapes

    def point_in_apriltag_box(self, x_mm: float, y_mm: float) -> bool:
        if not self.apriltag_box:
            return False
        origin_x, origin_y, width_mm, height_mm = self.apriltag_box
        return origin_x <= x_mm <= origin_x + width_mm and origin_y <= y_mm <= origin_y + height_mm


def format_number(value: float) -> str:
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.6f}".rstrip("0").rstrip(".")


def load_spot_svg_model(svg_path: str | Path) -> SpotSvgModel:
    tree = ET.parse(str(svg_path))
    root = tree.getroot()
    width_mm = parse_length_mm(root.attrib.get("width"))
    height_mm = parse_length_mm(root.attrib.get("height"))
    defs = [copy.deepcopy(child) for child in root if local_name(child.tag) == "defs"]
    metadata_spec = read_template_metadata(root)
    apriltag_box = None
    apriltag_grid_size = None
    if metadata_spec:
        apriltag_spec = metadata_spec.get("apriltag", {})
        tag_box = apriltag_spec.get("tagBox")
        if isinstance(tag_box, dict):
            apriltag_box = (
                float(tag_box.get("x", 0.0)),
                float(tag_box.get("y", 0.0)),
                float(tag_box.get("width", 0.0)),
                float(tag_box.get("height", 0.0)),
            )
        grid_size = apriltag_spec.get("gridSize")
        if isinstance(grid_size, (int, float)):
            apriltag_grid_size = int(grid_size)

    geometry_root = find_geometry_root(root)
    base_groups: list[ET.Element] = []
    overlay_groups: list[ET.Element] = []
    plate_shapes: list[FillShape] = []
    hole_shapes: list[FillShape] = []
    apriltag_black_shapes: list[FillShape] = []
    decorative_black_shapes: list[FillShape] = []
    black_shapes: list[FillShape] = []

    captures: dict[str, list[SvgGroupCapture]] = {group_id: [] for group_id in TARGET_BASE_GROUP_IDS | TARGET_BLACK_GROUP_IDS}
    traversal_roots: Iterable[ET.Element]
    if geometry_root is root:
        traversal_roots = (root,)
    else:
        traversal_roots = tuple(geometry_root)

    for traversal_root in traversal_roots:
        visit_group_tree(traversal_root, IDENTITY_MATRIX, "nonzero", captures)

    for capture in captures["background"]:
        base_groups.append(copy.deepcopy(capture.element))
        overlay_groups.append(copy.deepcopy(capture.element))
        plate_shapes.extend(collect_fill_shapes(capture.element, capture.transform, capture.fill_rule))

    for capture in captures["holes"]:
        base_groups.append(copy.deepcopy(capture.element))
        overlay_groups.append(copy.deepcopy(capture.element))
        hole_shapes.extend(collect_fill_shapes(capture.element, capture.transform, capture.fill_rule))

    for group_id in TARGET_BLACK_GROUP_IDS:
        for capture in captures[group_id]:
            overlay_groups.append(copy.deepcopy(capture.element))
            shapes = collect_fill_shapes(capture.element, capture.transform, capture.fill_rule)
            black_shapes.extend(shapes)
            if group_id == "apriltag-black":
                apriltag_black_shapes.extend(shapes)
            else:
                decorative_black_shapes.extend(shapes)

    if not plate_shapes:
        raise ValueError("SVG is missing a usable plate background group.")

    return SpotSvgModel(
        tree=tree,
        root=root,
        width_mm=width_mm,
        height_mm=height_mm,
        apriltag_box=apriltag_box,
        apriltag_grid_size=apriltag_grid_size,
        defs=defs,
        base_groups=base_groups,
        overlay_groups=overlay_groups,
        plate_shapes=plate_shapes,
        hole_shapes=hole_shapes,
        apriltag_black_shapes=apriltag_black_shapes,
        decorative_black_shapes=decorative_black_shapes,
        black_shapes=black_shapes,
    )


def find_geometry_root(root: ET.Element) -> ET.Element:
    for element in root.iter():
        if local_name(element.tag) == "g" and element.attrib.get("id") == "export-geometry-root":
            return element
    return root


def read_template_metadata(root: ET.Element) -> dict[str, object] | None:
    for child in root:
        if local_name(child.tag) != "metadata":
            continue
        if child.attrib.get("id") != "template-spec":
            continue
        text = (child.text or "").strip()
        if not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return None
    return None


def visit_group_tree(
    element: ET.Element,
    inherited_transform: Sequence[float],
    inherited_fill_rule: str,
    captures: dict[str, list[SvgGroupCapture]],
) -> None:
    current_transform = multiply_matrix(inherited_transform, parse_transform(element.attrib.get("transform")))
    current_fill_rule = element.attrib.get("fill-rule", inherited_fill_rule).strip().lower() or "nonzero"

    if local_name(element.tag) == "g":
        group_id = element.attrib.get("id")
        if group_id in captures:
            captures[group_id].append(
                SvgGroupCapture(
                    element=copy.deepcopy(element),
                    transform=current_transform,
                    fill_rule=current_fill_rule,
                )
            )

    for child in element:
        visit_group_tree(child, current_transform, current_fill_rule, captures)


def collect_fill_shapes(
    element: ET.Element,
    inherited_transform: Sequence[float],
    inherited_fill_rule: str,
) -> list[FillShape]:
    shapes: list[FillShape] = []
    current_transform = multiply_matrix(inherited_transform, parse_transform(element.attrib.get("transform")))
    current_fill_rule = element.attrib.get("fill-rule", inherited_fill_rule).strip().lower() or "nonzero"

    if local_name(element.tag) in DRAWABLE_TAGS:
        shape = element_to_fill_shape(element, current_transform, current_fill_rule)
        if shape:
            shapes.append(shape)

    for child in element:
        shapes.extend(collect_fill_shapes(child, current_transform, current_fill_rule))

    return shapes


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Parse and classify Spot fiducial SVGs for Fusion STEP export.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    describe_parser = subparsers.add_parser("describe", help="Print a JSON summary for an SVG.")
    describe_parser.add_argument("svg_path")

    point_parser = subparsers.add_parser("point", help="Classify a point in millimeters.")
    point_parser.add_argument("svg_path")
    point_parser.add_argument("x_mm", type=float)
    point_parser.add_argument("y_mm", type=float)

    layer_parser = subparsers.add_parser("emit-layer", help="Emit a derived base or overlay SVG.")
    layer_parser.add_argument("svg_path")
    layer_parser.add_argument("layer", choices=("base", "overlay"))

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    model = load_spot_svg_model(args.svg_path)

    if args.command == "describe":
        print(json.dumps(model.describe(), indent=2, sort_keys=True))
        return 0

    if args.command == "point":
        state = model.classify_point_mm(args.x_mm, args.y_mm)
        print(
            json.dumps(
                {
                    "insidePlate": state.inside_plate,
                    "insideHole": state.inside_hole,
                    "insideBlack": state.inside_black,
                    "base": state.base,
                    "white": state.white,
                    "black": state.black,
                    "visibleLayer": state.visible_layer,
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0

    if args.command == "emit-layer":
        print(model.build_layer_svg(args.layer))
        return 0

    parser.error("Unsupported command.")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
