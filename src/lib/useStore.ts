// src/lib/useStore.ts
import { create } from "zustand";
import type { Place as CorePlace } from "./types";

// CategoryId is "all" plus whatever category the shared Place uses
export type CategoryId = "all" | CorePlace["category"];

// Store Place is exactly the same as the shared Place
export type Place = CorePlace;

export type UserLocation = { lat: number; lng: number } | null;

export type AreaOverlay =
  | {
      key: string;
      bbox?: [number, number, number, number];
      polygon?: unknown;
    }
  | null;

type ViewState = {
  zoom: number;
};

type State = {
  // map centre, nullable until located
  center: [number, number] | null;
  view: ViewState;
  radius: number | null;

  // filters
  category: CategoryId;
  query: string;

  // data
  places: Place[];
  area: AreaOverlay;

  // selection and focus
  selectedPlace: Place | null;
  lockOnSelection: boolean;

  // user location
  userLocation: UserLocation;

  // global status
  loading: boolean;
  error: string | null;

  // actions
  setCenter: (c: [number, number] | null) => void;
  setZoom: (z: number) => void;
  setRadius: (r: number | null) => void;

  setCategory: (c: CategoryId) => void;
  setQuery: (q: string) => void;

  setPlaces: (p: Place[]) => void;
  setArea: (area: AreaOverlay) => void;

  setSelectedPlace: (p: Place | null) => void;
  setLockOnSelection: (lock: boolean) => void;

  setUserLocation: (loc: UserLocation) => void;

  setLoading: (flag: boolean) => void;
  setError: (msg: string | null) => void;
};

const useStore = create<State>((set) => ({
  center: null,
  view: { zoom: 14 },
  radius: null,

  category: "all",
  query: "",

  places: [],
  area: null,

  selectedPlace: null,
  lockOnSelection: false,

  userLocation: null,

  loading: false,
  error: null,

  setCenter: (center) => set({ center }),
  setZoom: (zoom) =>
    set((state) => ({
      view: { ...state.view, zoom },
    })),
  setRadius: (radius) => set({ radius }),

  setCategory: (category) => set({ category }),
  setQuery: (query) => set({ query }),

  setPlaces: (places) => set({ places }),
  setArea: (area) => set({ area }),

  setSelectedPlace: (selectedPlace) => set({ selectedPlace }),
  setLockOnSelection: (lockOnSelection) => set({ lockOnSelection }),

  setUserLocation: (userLocation) => set({ userLocation }),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

export default useStore;
