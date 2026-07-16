const TILE_WIDTH = 36;
const TILE_HEIGHT = 30;

const COIL_SVG = `
<svg xmlns='http://www.w3.org/2000/svg' width='${TILE_WIDTH}' height='${TILE_HEIGHT}' viewBox='0 0 ${TILE_WIDTH} ${TILE_HEIGHT}'>
  <defs>
    <linearGradient id='wire' x1='10%' y1='0%' x2='90%' y2='100%'>
      <stop offset='0%' stop-color='#f5f6f7'/>
      <stop offset='18%' stop-color='#cfd3d6'/>
      <stop offset='40%' stop-color='#8b9096'/>
      <stop offset='60%' stop-color='#6b6f74'/>
      <stop offset='80%' stop-color='#45484c'/>
      <stop offset='100%' stop-color='#232527'/>
    </linearGradient>
    <radialGradient id='hole' cx='40%' cy='35%' r='75%'>
      <stop offset='0%' stop-color='#000000' stop-opacity='0.15'/>
      <stop offset='55%' stop-color='#000000' stop-opacity='0.32'/>
      <stop offset='100%' stop-color='#000000' stop-opacity='0.4'/>
    </radialGradient>
  </defs>
  <ellipse cx='27' cy='15' rx='5' ry='6.5' fill='url(#hole)'/>
  <ellipse cx='18' cy='15' rx='13' ry='9.5' fill='none' stroke='url(#wire)' stroke-width='3.4'/>
  <ellipse cx='16.5' cy='12.5' rx='7' ry='3' fill='none' stroke='#ffffff' stroke-opacity='0.5' stroke-width='0.9'/>
</svg>
`.trim();

const COIL_DATA_URI = `url("data:image/svg+xml,${encodeURIComponent(COIL_SVG)}")`;

export function NotebookSpiral() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-0 left-0 top-0 z-40"
      style={{
        width: TILE_WIDTH,
        backgroundImage: COIL_DATA_URI,
        backgroundSize: `${TILE_WIDTH}px ${TILE_HEIGHT}px`,
        backgroundRepeat: "repeat-y",
        filter: "drop-shadow(1px 2px 2px rgba(20, 24, 31, 0.3))",
      }}
    />
  );
}
