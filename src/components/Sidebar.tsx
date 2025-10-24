import { create } from "zustand";

export type Category = "all" | "coffee" | "clinic" | "coworking";

export type Place = {
  id: string;
  lat: number;
  lng: number;
  category: Category;
  name?: string | null;
  address?: string | null;
  tags?: Record<string, string>;
};

type State = {
  // map
  center: [number, number];
  zoom: number;
  radiusM: number;

  // filters/search
  category: Category;
  query: string;

  // data
  places: Place[];

  // selection
  selectedId: string | null;

  // pointer (e.g., user location)
  pointer: [number, number] | null;

  // favourites (to satisfy Sidebar/PlaceItem)
  favourites: string[]; // array of place ids
  toggleFav: (id: string) => void;

  // actions
  setCenter: (c: [number, number]) => void;
  setZoom: (z: number) => void;
  setRadiusM: (m: number) => void;

  setCategory: (c: Category) => void;
  setQuery: (q: string) => void;

  setPlaces: (p: Place[]) => void;

  setSelectedId: (id: string | null) => void;
  clearSelected: () => void;

  setPointer: (p: [number, number] | null) => void;
};

const initialCenter: [number, number] = [-26.2041, 28.0473];

const useStore = create<State>((set, get) => ({
  center: initialCenter,
  zoom: 14,
  radiusM: 1500,

  category: "all",
  query: "",

  places: [],

  selectedId: null,

  pointer: null,

  favourites: [],
  toggleFav: (id) => {
    const { favourites } = get();
    set({
      favourites: favourites.includes(id)
        ? favourites.filter((x) => x !== id)
        : [...favourites, id],
    });
  },

  setCenter: (c) => set({ center: c }),
  setZoom: (z) => set({ zoom: z }),
  setRadiusM: (m) => set({ radiusM: m }),

  setCategory: (c) => set({ category: c }),
  setQuery: (q) => set({ query: q }),

  setPlaces: (p) => set({ places: p }),

  setSelectedId: (id) => set({ selectedId: id }),
  clearSelected: () => set({ selectedId: null }),

  setPointer: (p) => set({ pointer: p }),
}));

export default useStore;

/** Optional helpers */
export const selectors = {
  selectedPlace: (s: State) => s.places.find((p) => p.id === s.selectedId) ?? null,
  filteredPlaces: (s: State) => {
    const list =
      s.category === "all" ? s.places : s.places.filter((p) => p.category === s.category);
    const q = s.query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => (p.name ?? "").toLowerCase().includes(q));
  },
};
