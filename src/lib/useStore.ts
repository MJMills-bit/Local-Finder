// src/lib/useStore.ts
import { create } from "zustand";
import type {
  Category,
  Place,
  LatLng,
  CenterTuple,
  ViewState,
  AreaOverlay,
} from "./types";

interface AppState {
  // Map position/view
  center?: CenterTuple;
  setCenter: (c: CenterTuple) => void;
  view: ViewState;
  setZoom: (z: number) => void;

  // User location
  userLocation?: LatLng;
  setUserLocation: (pos: LatLng) => void;

  // Filters
  category: Category;
  radius: number;
  query: string;
  setCategory: (c: Category) => void;
  setRadius: (r: number) => void;
  setQuery: (q: string) => void;

  // Results
  places: Place[];
  setPlaces: (p: Place[]) => void;
  selectedPlace: Place | null;
  setSelectedPlace: (p: Place | null) => void;

  // UI behaviour
  lockOnSelection: boolean;
  setLockOnSelection: (v: boolean) => void;

  // Area overlay
  area: AreaOverlay | null;
  setArea: (a: AreaOverlay | null) => void;

  // Global fetch state (NEW)
  loading: boolean;
  setLoading: (v: boolean) => void;
  error: string | null;
  setError: (e: string | null) => void;
}

const DEFAULT_ZOOM = 14;
const DEFAULT_RADIUS = 1200;

function clampRadius(r: number): number {
  if (Number.isNaN(r)) return DEFAULT_RADIUS;
  return Math.min(12_000, Math.max(50, Math.round(r)));
}

const useStore = create<AppState>((set) => ({
  // Map position/view
  center: undefined,
  setCenter: (c) => set({ center: c }),
  view: { zoom: DEFAULT_ZOOM },
  setZoom: (z) =>
    set((s) => ({
      view: { ...s.view, zoom: Math.max(1, Math.min(20, Math.round(z))) },
    })),

  // User location
  userLocation: undefined,
  setUserLocation: (pos) => set({ userLocation: pos }),

  // Filters
  category: "coffee",
  radius: DEFAULT_RADIUS,
  query: "",
  setCategory: (c) => set({ category: c }),
  setRadius: (r) => set({ radius: clampRadius(r) }),
  setQuery: (q) => set({ query: q }),

  // Results
  places: [],
  setPlaces: (p) => set({ places: p }),
  selectedPlace: null,
  setSelectedPlace: (p) => set({ selectedPlace: p }),

  // UI behaviour
  lockOnSelection: false,
  setLockOnSelection: (v) => set({ lockOnSelection: v }),

  // Area overlay
  area: null,
  setArea: (a) => set({ area: a }),

  // Global fetch state (NEW)
  loading: false,
  setLoading: (v) => set({ loading: v }),
  error: null,
  setError: (e) => set({ error: e }),
}));

export default useStore;

// Legacy re-exports so `import type { Category, Place } from '@/lib/useStore'` still works
export type { Category, Place, AreaOverlay, CenterTuple } from "./types";
