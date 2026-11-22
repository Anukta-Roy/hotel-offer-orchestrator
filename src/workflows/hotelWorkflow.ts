import { log, proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/hotels";
import { HotelOffer, SupplierHotel } from "../types";

const { fetchSupplierA, fetchSupplierB, persistOffers } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "30 seconds",
    retry: {
      initialInterval: "1 second",
      maximumInterval: "10 seconds",
      maximumAttempts: 3
    }
  });

function chooseBestOffers(
  a: SupplierHotel[],
  b: SupplierHotel[]
): HotelOffer[] {
  const best = new Map<string, HotelOffer>();
  const candidates = [
    ...a.map((hotel) => ({ hotel, supplier: "Supplier A" as const })),
    ...b.map((hotel) => ({ hotel, supplier: "Supplier B" as const }))
  ];

  for (const { hotel, supplier } of candidates) {
    const key = hotel.name.trim().toLowerCase();
    const current = best.get(key);

    if (!current || hotel.price < current.price) {
      best.set(key, {
        name: hotel.name.trim(),
        price: hotel.price,
        supplier,
        commissionPct: hotel.commissionPct
      });
    }
  }

  return [...best.values()].sort((x, y) => x.name.localeCompare(y.name));
}

export async function hotelOfferWorkflow(city: string): Promise<HotelOffer[]> {
  log.info("Starting hotel offer workflow", { city });

  const [aResult, bResult] = await Promise.allSettled([
    fetchSupplierA(city),
    fetchSupplierB(city)
  ]);

  const a = aResult.status === "fulfilled" ? aResult.value : [];
  const b = bResult.status === "fulfilled" ? bResult.value : [];

  if (aResult.status === "rejected") {
    log.warn("Supplier A request failed", { city, error: String(aResult.reason) });
  }
  if (bResult.status === "rejected") {
    log.warn("Supplier B request failed", { city, error: String(bResult.reason) });
  }

  if (aResult.status === "rejected" && bResult.status === "rejected") {
    log.error("Both suppliers failed", { city });
    throw new Error("Both suppliers failed");
  }

  const offers = chooseBestOffers(a, b);
  await persistOffers(city, offers);

  log.info("Hotel offer workflow completed", {
    city,
    supplierAHotels: a.length,
    supplierBHotels: b.length,
    finalOffers: offers.length
  });

  return offers;
}
