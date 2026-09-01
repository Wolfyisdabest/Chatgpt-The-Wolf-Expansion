export type WolfIconName =
  | "tray"
  | "star-outline"
  | "star-filled"
  | "folder"
  | "chevron-right"
  | "chevron-down"
  | "plus"
  | "settings"
  | "arrow-up"
  | "arrow-down"
  | "more";

const ICON_PATHS: Record<WolfIconName, string[]> = {
  tray: ["M3 5.5h10l1.5 7h-13l1.5-7Z", "M2.2 10h3l1 1.5h3.6l1-1.5h3"],
  "star-outline": ["m8 1.7 1.9 3.8 4.2.6-3.05 2.95.72 4.15L8 11.25l-3.77 1.98.72-4.15L1.9 6.1l4.2-.6L8 1.7Z"],
  "star-filled": ["m8 1.7 1.9 3.8 4.2.6-3.05 2.95.72 4.15L8 11.25l-3.77 1.98.72-4.15L1.9 6.1l4.2-.6L8 1.7Z"],
  folder: ["M1.5 4h5l1.2 1.5h6.8v7.5h-13V4Z"],
  "chevron-right": ["m6 3.5 4.5 4.5L6 12.5"],
  "chevron-down": ["m3.5 6 4.5 4.5L12.5 6"],
  plus: ["M8 3v10M3 8h10"],
  settings: ["M8 5.4A2.6 2.6 0 1 0 8 10.6 2.6 2.6 0 0 0 8 5.4Z", "M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"],
  "arrow-up": ["M8 13V3M4.5 6.5 8 3l3.5 3.5"],
  "arrow-down": ["M8 3v10m-3.5-3.5L8 13l3.5-3.5"],
  more: ["M3.5 8h.01M8 8h.01M12.5 8h.01"],
};

export function createIcon(name: WolfIconName, label?: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("focusable", "false");
  svg.classList.add("wolf-icon");
  if (label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
  } else {
    svg.setAttribute("aria-hidden", "true");
  }
  const filled = name === "star-filled";
  for (const pathData of ICON_PATHS[name]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", filled ? "currentColor" : "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", filled ? "0" : "1.35");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
  }
  return svg;
}
