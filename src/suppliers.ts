import { SupplierHotel } from "./types";

const supplierA: SupplierHotel[] = [
  { hotelId: "a1", name: "Holtin", price: 6000, city: "delhi", commissionPct: 10 },
  { hotelId: "a2", name: "Radison", price: 5900, city: "delhi", commissionPct: 13 },
  { hotelId: "a3", name: "The Grand", price: 7200, city: "delhi", commissionPct: 12 },
  { hotelId: "a4", name: "Lotus Residency", price: 4100, city: "delhi", commissionPct: 8 },
  { hotelId: "a5", name: "Sea View Inn", price: 3500, city: "mumbai", commissionPct: 9 }
];
const supplierB: SupplierHotel[] = [
  { hotelId: "b1", name: "Holtin", price: 5340, city: "delhi", commissionPct: 20 },
  { hotelId: "b2", name: "Radison", price: 6200, city: "delhi", commissionPct: 15 },
  { hotelId: "b3", name: "The Grand", price: 7000, city: "delhi", commissionPct: 11 },
  { hotelId: "b4", name: "City Square", price: 4600, city: "delhi", commissionPct: 10 },
  { hotelId: "b5", name: "Sea View Inn", price: 3700, city: "mumbai", commissionPct: 12 }
];

export function getSupplierHotels(supplier: "A" | "B", city: string): SupplierHotel[] {
  const enabled = process.env[`SUPPLIER_${supplier}_ENABLED`];
  if (enabled === "false") throw new Error(`Supplier ${supplier} is disabled`);
  const data = supplier === "A" ? supplierA : supplierB;
  return data.filter((hotel) => hotel.city.toLowerCase() === city.toLowerCase());
}
