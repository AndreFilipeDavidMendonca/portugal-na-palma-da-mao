const MARKER_INNER_BG_LIGHTEN = 0.35;
const MARKER_CIRCLE_SCALE = 0.62;
const MARKER_CIRCLE_TOP_SCALE = 0.10;
const MARKER_INNER_ICON_SCALE = 0.48;
const MARKER_ICON_COLOR = "#1e293b";
const MARKER_SHADOW = "drop-shadow(0 3px 6px rgba(0,0,0,.35))";

export function ensureSvgSizing(svg: string) {
  let normalized = svg.trim();

  const hasWidth = /width=/.test(normalized);
  const hasHeight = /height=/.test(normalized);
  const hasAspect = /preserveAspectRatio=/.test(normalized);

  if (!hasWidth || !hasHeight || !hasAspect) {
    normalized = normalized.replace(
      "<svg",
      '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"'
    );
  }

  return normalized;
}

export function paintPoiIconSvg(svg: string, fgColor: string) {
  let normalized = ensureSvgSizing(svg);

  normalized = normalized.replace(/fill="[^"]*"/g, "");
  normalized = normalized.replace(/fill='[^']*'/g, "");
  normalized = normalized.replace(/stroke="[^"]*"/g, "");
  normalized = normalized.replace(/stroke='[^']*'/g, "");

  normalized = normalized.replace(
    "<svg",
    `<svg fill="${fgColor}" stroke="${fgColor}"`
  );

  return normalized;
}

function lightenHexColor(hex: string, amount = MARKER_INNER_BG_LIGHTEN) {
  const safeHex = hex.replace("#", "");
  const colorInt = parseInt(safeHex, 16);

  let red = (colorInt >> 16) + Math.round(255 * amount);
  let green = ((colorInt >> 8) & 0xff) + Math.round(255 * amount);
  let blue = (colorInt & 0xff) + Math.round(255 * amount);

  red = Math.min(255, red);
  green = Math.min(255, green);
  blue = Math.min(255, blue);

  return `rgb(${red}, ${green}, ${blue})`;
}

export function buildPoiMarkerHtml(svg: string | null, color: string, sizePx: number) {
  const circleSize = Math.round(sizePx * MARKER_CIRCLE_SCALE);
  const circleTop = Math.round(sizePx * MARKER_CIRCLE_TOP_SCALE);
  const innerIconSize = Math.round(sizePx * MARKER_INNER_ICON_SCALE);

  const innerBackgroundColor = lightenHexColor(color);
  const paintedSvg = svg ? paintPoiIconSvg(svg, MARKER_ICON_COLOR) : null;

  return `
    <div style="
      position: relative;
      width: ${sizePx}px;
      height: ${sizePx}px;
      display: block;
      line-height: 0;
      overflow: visible;
      filter: ${MARKER_SHADOW};
    ">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="${sizePx}"
        height="${sizePx}"
        preserveAspectRatio="xMidYMid meet"
        style="display:block; overflow:visible;"
      >
        <path
          d="M12 0C7.58 0 4 3.58 4 8c0 6 8 16 8 16s8-10 8-16c0-4.42-3.58-8-8-8z"
          fill="${color}"
        />
      </svg>

      <div style="
        position: absolute;
        left: 50%;
        top: ${circleTop}px;
        width: ${circleSize}px;
        height: ${circleSize}px;
        transform: translateX(-50%);
        border-radius: 999px;
        background: ${innerBackgroundColor};
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${
          paintedSvg
            ? `<div style="
                width:${innerIconSize}px;
                height:${innerIconSize}px;
                display:flex;
                align-items:center;
                justify-content:center;
                line-height:0;
              ">
                ${paintedSvg}
              </div>`
            : ""
        }
      </div>
    </div>
  `;
}