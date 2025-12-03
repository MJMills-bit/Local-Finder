// src/components/MapView.tsx
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
import L, { LeafletEventHandlerFnMap } from "leaflet";
import useStore from "@/lib/useStore";
import PinPopup from "@/components/PinPopup";
import { useIsDesktop } from "@/lib/useMedia";
import "leaflet/dist/leaflet.css";

declare global {
  interface Window {
    __leafletMap?: LeafletMap;
  }
}

// Default Leaflet icon setup
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



function centersClose(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): boolean {
  const EPS = 1e-6;
  return Math.abs(a.lat - b.lat) < EPS && Math.abs(a.lng - b.lng) < EPS;
}

export type Props = {
  center?: [number, number] | null;
  initialZoom?: number;
  className?: string;
  showLocate?: boolean;
  onLocate?: () => void;
};

function ExposeMapRef() {
  const map = useMap();
  React.useEffect(() => {
    window.__leafletMap = map;
    return () => {
      if (window.__leafletMap === map) window.__leafletMap = undefined;
    };
  }, [map]);
  return null;
}

function SyncToStore({
  programmaticMoveRef,
  suppressAutoMoveRef,
}: {
  programmaticMoveRef: React.MutableRefObject<boolean>;
  suppressAutoMoveRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  const center = useStore((s) => s.center);
  const zoom = useStore((s) => s.view.zoom);
  const selected = useStore((s) => s.selectedPlace);
  const lockOnSelection = useStore((s) => s.lockOnSelection);

  React.useEffect(() => {
    if (!Array.isArray(center) || center.length !== 2) return;
    if (lockOnSelection || selected) return;
    if (suppressAutoMoveRef.current) return;

    const current = map.getCenter();
    const target = { lat: center[0], lng: center[1] };
    const zoomNow = map.getZoom();

    const needsCenter = !centersClose(current, target);
    const needsZoom = typeof zoom === "number" && zoom !== zoomNow;

    if (needsCenter || needsZoom) {
      programmaticMoveRef.current = true;
      map.setView([target.lat, target.lng], needsZoom ? zoom : undefined, {
        animate: false,
      });
    }
  }, [center, zoom, map, programmaticMoveRef, suppressAutoMoveRef, lockOnSelection, selected]);

  return null;
}

export default function MapView({
  center,
  initialZoom = 14,
  className,
  showLocate,
  onLocate,
}: Props) {
  const isDesktop = useIsDesktop();
  const isMobile = !isDesktop;

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
  const programmaticMoveRef = React.useRef<boolean>(false);
  const suppressAutoMoveRef = React.useRef<boolean>(false);

  const effectiveCenter: LatLngExpression = React.useMemo(() => {
    if (
      Array.isArray(storeCenter) &&
      storeCenter.length >= 2 &&
      Number.isFinite(storeCenter[0]) &&
      Number.isFinite(storeCenter[1])
    ) {
      return [storeCenter[0], storeCenter[1]];
    }
    if (
      Array.isArray(center) &&
      center.length >= 2 &&
      Number.isFinite(center[0]) &&
      Number.isFinite(center[1])
    ) {
      return [center[0], center[1]];
    }
    return [0, 0];
  }, [storeCenter, center]);

  const cancelAnim = React.useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    if (typeof m.stop === "function") m.stop();
  }, []);

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

    const handleUserStart = () => {
      if (lockOnSelection) setLockOnSelection(false);
      suppressAutoMoveRef.current = false;
    };

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
  }, [setCenter, setZoom, setLockOnSelection, lockOnSelection]);

  const onMapClick = React.useCallback((): void => {
    useStore.getState().setSelectedPlace(null);
    setLockOnSelection(false);
    suppressAutoMoveRef.current = false;
  }, [setLockOnSelection]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlace) return;

    cancelAnim();
    suppressAutoMoveRef.current = true;
    setLockOnSelection(true);

    const { lat, lng } = selectedPlace;
    const target = L.latLng(lat, lng);
    const z = Math.max(map.getZoom() ?? 13, 16);

    programmaticMoveRef.current = true;
    map.setView(target, z, { animate: isMobile });

    const t = window.setTimeout(() => {
      suppressAutoMoveRef.current = false;
    }, 600);
    return () => window.clearTimeout(t);
  }, [selectedPlace, isMobile, cancelAnim, setLockOnSelection]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lockOnSelection) return;
    if (suppressAutoMoveRef.current) return;
    if (!places || places.length === 0) return;

    const pts: [number, number][] = places.map((p) => [p.lat, p.lng]);
    const bounds = L.latLngBounds(pts);
    const cur = map.getBounds();

    if (!cur.contains(bounds)) {
      programmaticMoveRef.current = true;
      map.fitBounds(bounds, { padding: [24, 24], animate: isMobile });
    }
  }, [places, lockOnSelection, isMobile]);

  return (
    <div
      className={[
        "relative h-full min-h-[45vh] w-full",
        className ?? "",
      ].join(" ")}
    >
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
        <SyncToStore
          programmaticMoveRef={programmaticMoveRef}
          suppressAutoMoveRef={suppressAutoMoveRef}
        />

        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/">OSM</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ZoomControl position="topright" />

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup autoPan={false}>You are here</Popup>
          </Marker>
        )}

        {places.map((p) => {
          const handlers: LeafletEventHandlerFnMap = {
            click: () => {
              useStore.getState().setSelectedPlace(p);
              setLockOnSelection(true);
            },
          };

          return (
            <Marker key={p.id} position={[p.lat, p.lng]} eventHandlers={handlers}>
              {!isDesktop ? (
                <Popup
                  autoPan={false}
                  closeButton
                  keepInView={false}
                  maxWidth={320}
                  minWidth={220}
                >
                  <PinPopup place={{ ...p, name: p.name ?? "Unnamed place" }} />

                </Popup>
              ) : null}
            </Marker>
          );
        })}
      </MapContainer>

      {showLocate && (
        <div className="pointer-events-none absolute inset-0 z-[1400]">
          <button
            type="button"
            className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white/95 px-5 py-3 text-base font-medium shadow"
            onClick={onLocate}
            aria-label="Press to locate"
          >
            Press to locate
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-[1300]">
        <div className="pointer-events-auto absolute bottom-4 right-4">
        </div>
      </div>
    </div>
  );
}
