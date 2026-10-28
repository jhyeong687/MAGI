// Diagnostic landmarks from TV capture 71. Deliberation is a symmetric front view.
// Captures store 704×480 pixels; display uses TV 4:3 pixel-aspect correction.
export const captureWidth = 704;
export const displayWidth = 640;
export const pixelAspect = displayWidth / captureWidth;
// Front view reconstructed from the canonical panel topology. Camera skew is excluded.
export const coreGeometry = {
  balthasar: {
    points: [
      [242, 54],
      [462, 54],
      [462, 234],
      [397, 299],
      [307, 299],
      [242, 234],
    ],
    label: [251, 217],
    labelWidth: 202,
  },
  casper: {
    points: [
      [60, 239],
      [210, 239],
      [302, 331],
      [302, 434],
      [60, 434],
    ],
    label: [78, 378],
    labelWidth: 207,
  },
  melchior: {
    points: [
      [494, 239],
      [644, 239],
      [644, 434],
      [402, 434],
      [402, 331],
    ],
    label: [420, 378],
    labelWidth: 207,
  },
} as const;
export const diagnosticGeometry = {
  balthasar: { center: [353, 129], size: [166, 150], angle: 0 },
  casper: { center: [224, 327], size: [163, 153], angle: -28 },
  melchior: { center: [477, 328], size: [165, 151], angle: 30 },
} as const;
export const pointsText = (points: readonly (readonly number[])[]) =>
  points.map((point) => point.join(',')).join(' ');
