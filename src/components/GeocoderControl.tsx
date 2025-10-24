"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import * as L from "leaflet";

// plugin CSS + JS
import "leaflet-control-geocoder/dist/Control.Geocoder.css";
import "leaflet-control-geocoder";

type MarkGeocodeEvent = {
  geocode: {
    center: L.LatLng;
    name: string;
    bbox?: L.LatLngBounds;
  };
};

export default function GeocoderControl() {
  const map = useMap();

  useEffect(() => {
    // @ts-expect-error plugin augments L.Control at runtime
    const geocoder = L.Control.geocoder({
      placeholder: "Search address…",
      defaultMarkGeocode: false,
    })
      .on("markgeocode", (e: MarkGeocodeEvent) => {
        const { center, name, bbox } = e.geocode;
        L.marker(center).addTo(map).bindPopup(name).openPopup();
        if (bbox) map.fitBounds(bbox);
        else map.setView(center, 15);
      })
      .addTo(map);

    return () => {
      geocoder.remove();
    };
  }, [map]);

  return null;
}
