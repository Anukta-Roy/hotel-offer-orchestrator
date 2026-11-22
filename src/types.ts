export interface SupplierHotel {
  hotelId: string;
  name: string;
  price: number;
  city: string;
  commissionPct: number;
}

export interface HotelOffer {
  name: string;
  price: number;
  supplier: "Supplier A" | "Supplier B";
  commissionPct: number;
}

export interface SupplierHealth {
  supplier: string;
  status: "up" | "down";
  message: string;
}
