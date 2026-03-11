const EPSILON = 0.0001;

function maxSizeForPredicate(predicate, lowerBound, upperBound, iterations = 26) {
  let low = lowerBound;
  let high = upperBound;

  for (let index = 0; index < iterations; index += 1) {
    const mid = (low + high) / 2;
    if (predicate(mid)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return low;
}

export function findBestFitSize({ measure, boxWidth, boxHeight, minScale = 0.55, maxSize = 80 }) {
  const safeWidth = Math.max(boxWidth, 0);
  const safeHeight = Math.max(boxHeight, 0);

  const heightOnlySize = maxSizeForPredicate(
    (size) => measure(size).height <= safeHeight + EPSILON,
    0.01,
    maxSize
  );

  const fittedSize = maxSizeForPredicate(
    (size) => {
      const bounds = measure(size);
      return bounds.width <= safeWidth + EPSILON && bounds.height <= safeHeight + EPSILON;
    },
    0.01,
    heightOnlySize
  );

  return {
    fittedSize,
    heightOnlySize,
    scaleRatio: heightOnlySize > EPSILON ? fittedSize / heightOnlySize : 1,
    fits: fittedSize > EPSILON,
    tooSmall: heightOnlySize > EPSILON && fittedSize / heightOnlySize < minScale
  };
}
