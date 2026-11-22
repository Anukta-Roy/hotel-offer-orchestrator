import { HotelOffer, SupplierHotel } from "../types";
import { saveHotels } from "../redis";
import { config } from "../config";

async function fetchSupplier(path: string): Promise<SupplierHotel[]> {
  console.info("Calling mock supplier", { path });
  const response = await fetch(`${config.serviceUrl}${path}`);

  if (!response.ok) {
    const message = `${path} returned HTTP ${response.status}`;
    console.error("Supplier request failed", { path, status: response.status });
    throw new Error(message);
  }

  const hotels = await response.json() as SupplierHotel[];
  console.info("Supplier response received", { path, count: hotels.length });
  return hotels;
}

export async function fetchSupplierA(city: string): Promise<SupplierHotel[]> {
  return fetchSupplier(`/supplierA/hotels?city=${encodeURIComponent(city)}`);
}

export async function fetchSupplierB(city: string): Promise<SupplierHotel[]> {
  return fetchSupplier(`/supplierB/hotels?city=${encodeURIComponent(city)}`);
}

export async function persistOffers(city: string, offers: HotelOffer[]): Promise<void> {
  try {
    await saveHotels(city, offers);
    console.info("Deduplicated offers saved in Redis", { city, count: offers.length });
  } catch (error) {
    console.error("Failed to save offers in Redis", { city, error });
    throw error;
  }
}
