/** Document-wide backdrop filter; mount once, outside all player instances. */
export function GlassRefraction() {
  return (
    <svg width="0" height="0" className="ps-refraction-defs" aria-hidden="true" focusable="false">
      <defs>
        <filter id="glass-refract" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage href="/displacement-map.png" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale="34" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="glass-refract-panel" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage href="/displacement-map-panel.png" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="panel-map" />
          <feDisplacementMap in="SourceGraphic" in2="panel-map" scale="12" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}