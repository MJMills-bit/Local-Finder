// v3.1.0 — Shared domain types

export type Category =
  | "all"
  | "coffee"
  | "clinic"
  | "coworking"
  | "restaurant"
  | "attraction"
  | "shop"
  | "supermarket"
  | "pharmacy"
  | "pub"
  | "bar"
  | "fastfood"
  | "hotel"
  | "hospital"
  | "bank"
  | "atm"
  | "fuel"
  | "park";

export interface TagFields {
  name?: string;
  brand?: string;
  operator?: string;
  amenity?: string;
  shop?: string;
  addr_full?: string;
  website?: string;
  phone?: string;
  cuisine?: string;
  wheelchair?: string;
  internet_access?: string;
  opening_hours?: string;
  [k: string]: string | undefined;
}

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: Category;
  address?: string;
  tags?: TagFields;
  distanceM?: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export type CenterTuple = [number, number];

export interface ViewState {
  zoom?: number;
}

export interface AreaOverlay {
  key: string;
  bbox?: [number, number, number, number]; // [south, west, north, east]
  polygon?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][]; // handles both types
  } | null;
}

