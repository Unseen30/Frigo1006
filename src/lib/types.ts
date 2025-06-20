import type { Json } from "@/integrations/supabase/types";

export interface Driver {
  id: string;
  name: string;
  license_number: string;
  phone?: string;
  email?: string;
  truck_id?: string;
  is_admin?: boolean;
  created_at: string;
}

export interface Truck {
  id: string;
  plate_number: string;
  model?: string;
  year?: number;
  capacity?: number;
  driver_id?: string;
  created_at: string;
}

export interface Trip {
  id: string;
  driver_id: string;
  truck_id: string;
  origin: string;
  destination: string;
  cargo_description?: string;
  cargo_weight?: number;
  start_time: string;
  end_time?: string;
  status: 'active' | 'completed';
  distance?: number;
  current_location_coords?: string; // GeoJSON POINT string format "POINT(long lat)"
  location_accuracy?: number; // Accuracy in meters
  created_at: string;
  driver?: Driver;
  truck?: Truck;
}

export interface RoutePoint {
  id: string;
  trip_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

// Legacy interfaces for backward compatibility
export interface CattleDetails extends Record<string, number> {
  vacas?: number;
  novillos?: number;
  terneros?: number;
  vaquillonas?: number;
  toros?: number;
}

export interface Cargo {
  type: 'cattle';
  quantity: number;
  cattleDetails?: CattleDetails;
  loadingLocation?: string;
}
