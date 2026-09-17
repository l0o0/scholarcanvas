export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split("")
      .map((ch) => ch + ch)
      .join("")
      .toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return null;
}

// Use the browser's color parser for theme defaults such as OKLCH.
export function colorToHex(input: string): string | null {
  const hex = normalizeHex(input);
  if (hex || input === "transparent" || typeof document === "undefined")
    return hex;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = input;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

function toHexByte(value: number) {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, "0");
}

// Columns stay in the same order so outlines and fills are easy to pair.
const COLOR_FAMILIES = [
  ["#f1f3f5", "#adb5bd", "#343a40"],
  ["#ffe3e3", "#e599a4", "#a34557"],
  ["#fff3bf", "#d9b45a", "#946b28"],
  ["#e3f0e4", "#8eb998", "#426d50"],
  ["#e3edf7", "#85a9ca", "#416888"],
  ["#eee6f5", "#b39aca", "#75558d"],
];

export function colorPalette(lightFirst: boolean): string[] {
  return (lightFirst ? [0, 1, 2] : [2, 1, 0]).flatMap((shade) =>
    COLOR_FAMILIES.map((family) => family[shade]),
  );
}
