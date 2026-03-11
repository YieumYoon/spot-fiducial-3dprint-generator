import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const tagDirectory = path.join(root, "vendor/apriltag-imgs/tag36h11");
const outputPath = path.join(root, "site/data/tag36h11.js");

function paethPredictor(left, up, upLeft) {
  const prediction = left + up - upLeft;
  const leftDistance = Math.abs(prediction - left);
  const upDistance = Math.abs(prediction - up);
  const upLeftDistance = Math.abs(prediction - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  if (upDistance <= upLeftDistance) {
    return up;
  }

  return upLeft;
}

export function decodePng(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error("Invalid PNG signature.");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString("ascii");
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length + 4;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth} colorType=${colorType}`);
  }

  const channels = 4;
  const bytesPerPixel = channels;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const rows = [];
  let cursor = 0;
  let previousRow = new Uint8Array(stride);

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filterType = inflated[cursor];
    cursor += 1;
    const scanline = inflated.subarray(cursor, cursor + stride);
    cursor += stride;
    const decodedRow = new Uint8Array(stride);

    for (let byteIndex = 0; byteIndex < stride; byteIndex += 1) {
      const left = byteIndex >= bytesPerPixel ? decodedRow[byteIndex - bytesPerPixel] : 0;
      const up = previousRow[byteIndex];
      const upLeft = byteIndex >= bytesPerPixel ? previousRow[byteIndex - bytesPerPixel] : 0;

      switch (filterType) {
        case 0:
          decodedRow[byteIndex] = scanline[byteIndex];
          break;
        case 1:
          decodedRow[byteIndex] = (scanline[byteIndex] + left) & 0xff;
          break;
        case 2:
          decodedRow[byteIndex] = (scanline[byteIndex] + up) & 0xff;
          break;
        case 3:
          decodedRow[byteIndex] = (scanline[byteIndex] + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          decodedRow[byteIndex] = (scanline[byteIndex] + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG filter type ${filterType}`);
      }
    }

    rows.push(decodedRow);
    previousRow = decodedRow;
  }

  return {
    width,
    height,
    rows
  };
}

export function extractBlackCells(decodedPng, threshold = 128) {
  let minX = decodedPng.width;
  let minY = decodedPng.height;
  let maxX = -1;
  let maxY = -1;

  const isBlackPixel = (x, y) => {
    const row = decodedPng.rows[y];
    const index = x * 4;
    const alpha = row[index + 3];
    return alpha > 0 && row[index] < threshold && row[index + 1] < threshold && row[index + 2] < threshold;
  };

  for (let y = 0; y < decodedPng.height; y += 1) {
    for (let x = 0; x < decodedPng.width; x += 1) {
      if (isBlackPixel(x, y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const cells = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (isBlackPixel(x, y)) {
        cells.push([x - minX, y - minY]);
      }
    }
  }

  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    cells
  };
}

export async function generateTagDefinitions() {
  const files = (await readdir(tagDirectory))
    .filter((fileName) => /^tag36_11_\d{5}\.png$/.test(fileName))
    .sort();

  const definitions = {};
  for (const fileName of files) {
    const tagId = fileName.slice(-7, -4);
    if (Number(tagId) < 1 || Number(tagId) > 586) {
      continue;
    }

    const buffer = await readFile(path.join(tagDirectory, fileName));
    const blackCells = extractBlackCells(decodePng(buffer));

    if (blackCells.width !== 8 || blackCells.height !== 8) {
      throw new Error(`Unexpected tag grid dimensions for ${fileName}`);
    }

    definitions[tagId] = blackCells.cells;
  }

  return definitions;
}

async function main() {
  const definitions = await generateTagDefinitions();
  await mkdir(path.dirname(outputPath), { recursive: true });

  const source = `export const TAG_GRID_SIZE = 8;\nexport const TAG_DEFINITIONS = ${JSON.stringify(definitions, null, 2)};\n`;
  await writeFile(outputPath, source, "utf8");
  console.log(`Wrote ${Object.keys(definitions).length} tag definitions to ${outputPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
