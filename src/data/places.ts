import type { Place } from "@/lib/types";

export const PLACES: Place[] = [
  {
    id: "p1",
    name: "Green Bean Coffee",
    category: "coffee",
    lat: -26.1347,
    lng: 28.0363,
    address: "123 Jan Smuts Ave",
    website: "https://example.com",
    rating: 4.5,
    tags: ["wifi", "outdoor"]
  },
  {
    id: "p2",
    name: "Hyde Clinic",
    category: "clinic",
    lat: -26.1275,
    lng: 28.0432,
    address: "45 Clinic Rd",
    phone: "+27 11 000 0000",
    rating: 4.2,
    openNow: true
  },
  {
    id: "p3",
    name: "Workspace Hub",
    category: "coworking",
    lat: -26.1402,
    lng: 28.0479,
    address: "200 Work St",
    website: "https://workspace.example"
  }
];

export default PLACES;
