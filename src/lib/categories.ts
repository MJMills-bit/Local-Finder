// v3.1.0 — Category catalogue + Overpass hints (UI-agnostic)

import type { Category } from "./types";

export interface CategoryDef {
  id: Category;
  label: string;
  icon: string; // /public/icons/*.svg (optional if you later want SVGs instead of Lucide)
  overpass?: {
    amenity?: string[];
    shop?: string[];
    tourism?: string[];
    kv?: Array<{ key: string; values: string[] }>;
  };
}

export const CATEGORY_DEFS: CategoryDef[] = [
  { id: "all", label: "All", icon: "/icons/all.svg" },

  { id: "coffee", label: "Coffee", icon: "/icons/coffee.svg",
    overpass: { amenity: ["cafe", "coffee_shop"] } },

  { id: "restaurant", label: "Restaurants", icon: "/icons/restaurant.svg",
    overpass: { amenity: ["restaurant", "fast_food"] } },

  { id: "attraction", label: "Attractions", icon: "/icons/attraction.svg",
    overpass: { kv: [{ key: "tourism", values: ["attraction", "museum", "gallery", "viewpoint"] }] } },

  { id: "shop", label: "Shops", icon: "/icons/shop.svg",
    overpass: { kv: [{ key: "shop", values: ["*"] }] } },

  { id: "supermarket", label: "Supermarkets", icon: "/icons/supermarket.svg",
    overpass: { shop: ["supermarket", "convenience"] } },

  { id: "pharmacy", label: "Pharmacies", icon: "/icons/pharmacy.svg",
    overpass: { amenity: ["pharmacy"] } },

  { id: "hospital", label: "Hospitals", icon: "/icons/hospital.svg",
    overpass: { amenity: ["hospital"] } },

  { id: "clinic", label: "Clinics", icon: "/icons/clinic.svg",
    overpass: { amenity: ["clinic", "doctors"] } },

  { id: "bank", label: "Banks", icon: "/icons/bank.svg",
    overpass: { amenity: ["bank"] } },

  { id: "atm", label: "ATMs", icon: "/icons/atm.svg",
    overpass: { amenity: ["atm"] } },

  { id: "fuel", label: "Petrol", icon: "/icons/fuel.svg",
    overpass: { amenity: ["fuel"] } },

  { id: "park", label: "Parks", icon: "/icons/park.svg",
    overpass: { kv: [{ key: "leisure", values: ["park"] }] } },

  { id: "hotel", label: "Hotels", icon: "/icons/hotel.svg",
    overpass: { tourism: ["hotel", "guest_house", "hostel"] } },
];

export const CATEGORY_BY_ID: Record<Category, CategoryDef> =
  Object.fromEntries(CATEGORY_DEFS.map((d) => [d.id, d])) as Record<Category, CategoryDef>;
