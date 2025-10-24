"use client";

import * as React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
  useMap,
} from "react-leaflet";
import type { Map as LeafletMap, LatLngExpression } from "leaflet";
import L from "leaflet";
import useStore from "@/lib/useStore";
import RadiusControl from "@/components/RadiusControl";
import "leaflet/dist/leaflet.css";

// ---------- Default POI icon (CDN) ----------
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// ---------- User location icon (green SVG) ----------
const userIcon: L.Icon = L.icon({
  iconUrl:
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="#1e7f43" viewBox="0 0 256 256">
        <path d="M128 24a80 80 0 0 0-80 80c0 63 72.4 122.6 76.5 126a8 8 0 0 0 10.9 0C135.6 226.6 208 167 208 104a80 80 0 0 0-80-80Zm0 112a32 32 0 1 1 32-32 32 32 0 0 1-32 32Z"/>
      </svg>`
    ),
  iconSize: [22, 28],
  iconAnchor: [11, 28],
  popupAnchor: [0, -26],
});

// ---------- Helpers ----------
function centersClose(a: { lat: number; lng: number }, b: { lat: number; lng: number }): boolean {
  const EPS = 1e-6;
  return Math.abs(a.lat - b.lat) < EPS && Math.abs(a.lng - b.lng) < EPS;
}

// ---------- Props ----------
export type Props = {
  center: [number, number];
  initialZoom?: number;
  className?: string;
};

// ---------- Map–store sync ----------
function ExposeMapRef() {
  const map = useMap();
  React.useEffect(() => {
    (window as unknown as { __leafletMap?: LeafletMap }).__leafletMap = map;
    return () => {
      if ((window as unknown as { __leafletMap?: LeafletMap }).__leafletMap === map) {
        (window as unknown as { __leafletMap?: LeafletMap }).__leafletMap = undefined;
      }
    };
  }, [map]);
  return null;
}

function SyncToStore({
  programmaticMoveRef,
}: {
  programmaticMoveRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  const center = useStore((s) => s.center);
  const zoom = useStore((s) => s.view.zoom);

  React.useEffect(() => {
    if (!Array.isArray(center) || center.length !== 2) return;

    const current = map.getCenter();
    const target = { lat: center[0], lng: center[1] };
    const zoomNow = map.getZoom();

    const needsCenter = !centersClose(current, target);
    const needsZoom = zoom !== zoomNow;

    if (needsCenter || needsZoom) {
      programmaticMoveRef.current = true;
      map.setView([target.lat, target.lng], zoom);
    }
  }, [center, zoom, map, programmaticMoveRef]);

  return null;
}

// ---------- Component ----------
export default function MapView({
  center,
  initialZoom = 14,
  className,
}: Props) {
  // subscribe to store (no getState in render)
  const storeCenter = useStore((s) => s.center);
  const storeZoom = useStore((s) => s.view.zoom ?? initialZoom);
  const places = useStore((s) => s.places ?? []);
  const setCenter = useStore((s) => s.setCenter);
  const setZoom = useStore((s) => s.setZoom);

  const selectedPlace = useStore((s) => s.selectedPlace);
  const userLocation = useStore((s) => s.userLocation);
  const lockOnSelection = useStore((s) => s.lockOnSelection);
  const setLockOnSelection = useStore((s) => s.setLockOnSelection);

  const mapRef = React.useRef<LeafletMap | null>(null);
  const programmaticMoveRef = React.useRef(false);

  // Center used by MapContainer only for initial mount
  const effectiveCenter: LatLngExpression = React.useMemo(() => {
    if (
      Array.isArray(storeCenter) &&
      storeCenter.length >= 2 &&
      Number.isFinite(storeCenter[0]) &&
      Number.isFinite(storeCenter[1])
    ) {
      return [storeCenter[0], storeCenter[1]];
    }
    return center;
  }, [storeCenter, center]);

  // Attach move/zoom listeners when map is ready
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMoveEnd = () => {
      if (programmaticMoveRef.current) {
        programmaticMoveRef.current = false;
        return;
      }
      const c = map.getCenter();
      setCenter?.([c.lat, c.lng]);
    };

    const handleZoomEnd = () => {
      if (programmaticMoveRef.current) {
        programmaticMoveRef.current = false;
        return;
      }
      setZoom?.(map.getZoom());
    };

    const handleUserStart = () => setLockOnSelection(false); // user interaction unlocks follow

    map.on("moveend", handleMoveEnd);
    map.on("zoomend", handleZoomEnd);
    map.on("dragstart", handleUserStart);
    map.on("zoomstart", handleUserStart);

    return () => {
      map.off("moveend", handleMoveEnd);
      map.off("zoomend", handleZoomEnd);
      map.off("dragstart", handleUserStart);
      map.off("zoomstart", handleUserStart);
    };
  }, [setCenter, setZoom, setLockOnSelection]);

  // Click on map clears selected place (and unlocks follow)
  const onMapClick = React.useCallback(() => {
    useStore.getState().setSelectedPlace(null);
    setLockOnSelection(false);
  }, [setLockOnSelection]);

  // Fly to selected place ONCE when lock is set by Aside/TopSearch
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlace || !lockOnSelection) return;

    const { lat, lng } = selectedPlace;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      programmaticMoveRef.current = true;
      map.flyTo([lat, lng], Math.max(map.getZoom(), 17), { duration: 0.8 });
      const t = window.setTimeout(() => setLockOnSelection(false), 900);
      return () => window.clearTimeout(t);
    }
  }, [selectedPlace, lockOnSelection, setLockOnSelection]);

  return (
  <div className={["relative h-full w-full", className || ""].join(" ")}>
    <MapContainer
      center={effectiveCenter}
      zoom={storeZoom}
      className="h-full w-full"
      zoomControl={false}
      whenReady={() => {
        const map = mapRef.current;
        if (map) map.on("click", onMapClick);
      }}
      ref={mapRef}
    >
      <ExposeMapRef />
      <SyncToStore programmaticMoveRef={programmaticMoveRef} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Zoom control top-right */}
      <ZoomControl position="topright" />

      {/* User location pin */}
      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {/* POI pins */}
      {places.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          eventHandlers={{
            click: () => {
              const map = mapRef.current;
              if (map) {
                programmaticMoveRef.current = true;
                map.panTo([p.lat, p.lng], { animate: true });
              }
              // Clicking a pin selects place but stops follow/lock
              useStore.getState().setSelectedPlace(p);
              setLockOnSelection(false);
            },
          }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-medium">{p.name ?? "Place"}</div>
              {p.address ? <div className="text-neutral-600">{p.address}</div> : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>

    {/* Radius control overlay (bottom-right) */}
    <div className="pointer-events-none absolute inset-0 z-[1100]">
      <div className="pointer-events-auto absolute bottom-4 right-4">
        <RadiusControl />
      </div>
    </div>
  </div>
);
} 
