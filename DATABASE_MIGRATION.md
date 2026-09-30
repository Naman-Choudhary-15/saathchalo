# SAATHCHALO — Database Migration & Schema Guide
## Safe, Additive, Zero-Downtime Data Architecture

This guide describes the data model, additive migration procedures, and integrity constraints for **SAATHCHALO**.

---

### 1. Data Safety Principles

1. **Strictly Non-Destructive**: Never drop tables, truncate collections, or overwrite production data with seed fixtures.
2. **Additive Migrations Only**: Schema changes must be backward-compatible (adding optional fields with defaults).
3. **One Person = One Permanent Record**: Canonical user identity is rooted in `usr_<hex>`, never counted by sessions or IP addresses.
4. **Isolated Storage**: Database files must reside outside git-controlled paths.

---

### 2. Core Entities & Schema Definition

#### A. Users (`database.users` / `public.profiles`)
```typescript
interface UserRecord {
  id: string;               // e.g. "usr_a1b2c3d4e5f67890" (Primary Key)
  name: string;             // Display name (e.g. "Aditya")
  email: string;            // Unique email (lowercase)
  passwordHash?: string;    // SHA-256 password hash
  avatar_url: string;       // Avatar image URL
  primary_area: string;     // e.g. "Knowledge Park"
  joined_communities: string[]; // e.g. ["knowledge-park"]
  token: string;            // Session auth token
  created_at: string;       // ISO-8601 timestamp
}
```

#### B. Community Votes (`database.votes` / `public.community_votes`)
Enforces **one vote per user per session**:
```typescript
interface VoteRecord {
  vote_session_id: string;  // Poll session identifier
  option_id: string;        // Destination option ID
  user_id: string;          // Canonical user ID
  community_id: string;     // Community scope
  created_at: string;       // ISO-8601 timestamp
}
```

#### C. Shared Rides (`database.rides` / `public.shared_rides`)
```typescript
interface SharedRideRecord {
  id: string;               // e.g. "ride_1727718000_abcd"
  driver_name: string;      // Driver name
  vehicle_type: string;     // "Auto", "Traveller", "Bus"
  fuel_type: string;        // "EV", "CNG", "PETROL"
  vehicle_number: string;   // Vehicle license number
  pickup: string;           // Shared corridor start
  destination: string;      // Shared corridor destination
  capacity: number;         // e.g. 4 (Auto), 20 (Traveller), 50 (Bus)
  rider_count: number;      // Current number of participants
  total_vehicle_fare: number; // Single total fare for entire vehicle
  status: string;           // "POOL_FORMING", "CONFIRMED", "RIDE_STARTED", "COMPLETED"
  participants: Array<{
    id: string;
    userId: string;
    name: string;
    distanceKm: number;
    fare: number;           // Fair distance-ratio fare: F * (d_i / D)
    pickup: string;
    dropoff: string;
  }>;
}
```

#### D. Passenger Bookings (`database.bookings` / `public.bookings`)
```typescript
interface BookingRecord {
  id: string;               // e.g. "BK-103641"
  ride_id: string;          // Foreign key to SharedRide
  user_id: string;          // Foreign key to User
  pickup: string;
  dropoff: string;
  distance_km: number;
  vehicle_type: string;     // e.g. "Traveller • EV"
  vehicle_id: string;
  fuel_type: string;
  fare: number;             // Frozen passenger fare snapshot
  status: string;           // "CONFIRMED", "COMPLETED", "CANCELLED"
  created_at: string;
}
```

---

### 3. Migration to Supabase / PostgreSQL

To migrate from the persistent JSON engine to Supabase PostgreSQL:

1. **Run the DDL Schema**:
   Execute [`supabase-schema.sql`](./supabase-schema.sql) in the Supabase SQL Editor. This establishes:
   - Tables with Foreign Key integrity constraints.
   - Unique index on `(vote_session_id, user_id)` for voting uniqueness.
   - Row-Level Security (RLS) policies.
   - Realtime replication channels.

2. **Run Data Sync Script**:
   ```bash
   node scripts/migrate_unique_users.js
   ```

3. **Verify Integrity**:
   Run the acceptance suite to confirm all data reconciles:
   ```bash
   npm test
   ```
