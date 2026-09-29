-- ========================================================================
-- SAATHCHALO — PRODUCTION SUPABASE POSTGRESQL SCHEMA & REALTIME SETUP
-- ========================================================================
-- This migration script creates the full database schema, foreign keys,
-- uniqueness constraints, Row-Level Security (RLS) policies, triggers,
-- and Supabase Realtime publication for multi-device live sync.
-- ========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    primary_area TEXT NOT NULL DEFAULT 'Knowledge Park',
    pending_fine NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. COMMUNITIES TABLE
CREATE TABLE IF NOT EXISTS public.communities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Greater Noida',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. COMMUNITY MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.community_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id TEXT NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(community_id, user_id)
);

-- 5. REAL-TIME COMMUNITY MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id TEXT NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. COMMUNITY VOTE SESSIONS
CREATE TABLE IF NOT EXISTS public.vote_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id TEXT NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Today''s Shared Commute',
    departure_time TEXT NOT NULL DEFAULT '6:30 PM Today',
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, CLOSED, ALLOCATED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. VOTE OPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.vote_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vote_session_id UUID NOT NULL REFERENCES public.vote_sessions(id) ON DELETE CASCADE,
    destination TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0
);

-- 8. VOTES TABLE (1 Vote per User per Session)
CREATE TABLE IF NOT EXISTS public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vote_session_id UUID NOT NULL REFERENCES public.vote_sessions(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.vote_options(id) ON DELETE CASCADE,
    community_id TEXT NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(vote_session_id, user_id)
);

-- 9. RIDES TABLE (Allocated from Real Participants)
CREATE TABLE IF NOT EXISTS public.rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id TEXT REFERENCES public.communities(id) ON DELETE SET NULL,
    destination TEXT NOT NULL,
    departure_time TEXT NOT NULL DEFAULT '6:30 PM Today',
    status TEXT NOT NULL DEFAULT 'MATCH_FOUND', -- SEARCHING, MATCH_FOUND, VEHICLE_ASSIGNED, DRIVER_EN_ROUTE, ARRIVING, RIDE_STARTED, RIDE_COMPLETED, CANCELLED
    vehicle_type TEXT NOT NULL DEFAULT 'Auto', -- Auto, Traveller, Bus
    vehicle_id TEXT NOT NULL DEFAULT 'Auto UP16-AB-1411',
    driver_name TEXT NOT NULL DEFAULT 'Ramesh Kumar',
    driver_rating NUMERIC NOT NULL DEFAULT 4.9,
    total_passengers INT NOT NULL DEFAULT 1,
    current_lat NUMERIC DEFAULT 28.4744,
    current_lng NUMERIC DEFAULT 77.5040,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. RIDE PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS public.ride_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pickup_name TEXT NOT NULL DEFAULT 'Knowledge Park Campus Gate',
    drop_name TEXT NOT NULL,
    fare NUMERIC NOT NULL DEFAULT 24.67,
    status TEXT NOT NULL DEFAULT 'CONFIRMED', -- CONFIRMED, NO_SHOW, CANCELLED
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ride_id, user_id)
);

-- 11. SHUTTLES SCHEDULE TABLE
CREATE TABLE IF NOT EXISTS public.shuttles (
    id TEXT PRIMARY KEY,
    route TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    capacity INT NOT NULL DEFAULT 20,
    available_seats INT NOT NULL DEFAULT 20,
    status TEXT NOT NULL DEFAULT 'Available',
    fare NUMERIC NOT NULL DEFAULT 20.00
);

-- 12. SHUTTLE BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.shuttle_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shuttle_id TEXT NOT NULL REFERENCES public.shuttles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. DIRECT BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pickup TEXT NOT NULL,
    dropoff TEXT NOT NULL,
    distance_km NUMERIC NOT NULL,
    vehicle_type TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    fare NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================================================
-- 15. AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
-- ========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, avatar_url, primary_area)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'),
        COALESCE(NEW.raw_user_meta_data->>'primary_area', 'Knowledge Park')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================================================
-- 16. ROW-LEVEL SECURITY (RLS) POLICIES
-- ========================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shuttles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shuttle_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users can view display name/avatar; users can update their own
CREATE POLICY "Public profiles can be viewed by authenticated users"
    ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Communities: Everyone authenticated can read communities
CREATE POLICY "Communities are readable by authenticated users"
    ON public.communities FOR SELECT TO authenticated USING (true);

-- Community Members: Users can view and join
CREATE POLICY "Community members readable by authenticated users"
    ON public.community_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can join community as themselves"
    ON public.community_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Messages: Authenticated users can read messages in communities; insert only as themselves
CREATE POLICY "Authenticated users can read messages"
    ON public.messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can send messages as themselves"
    ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- Vote Sessions & Options: Readable by all authenticated users
CREATE POLICY "Vote sessions readable by authenticated users"
    ON public.vote_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Vote options readable by authenticated users"
    ON public.vote_options FOR SELECT TO authenticated USING (true);

-- Votes: Readable by all; insert only as self
CREATE POLICY "Votes readable by authenticated users"
    ON public.votes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can vote only as themselves"
    ON public.votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Rides & Participants: Readable by authenticated users
CREATE POLICY "Rides readable by authenticated users"
    ON public.rides FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create a ride"
    ON public.rides FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update ride state"
    ON public.rides FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Ride participants readable by authenticated users"
    ON public.ride_participants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can join ride participants as themselves"
    ON public.ride_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Shuttles & Shuttle Bookings:
CREATE POLICY "Shuttles readable by authenticated users"
    ON public.shuttles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Shuttles updatable by authenticated users for booking"
    ON public.shuttles FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Shuttle bookings viewable by user"
    ON public.shuttle_bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can book shuttle as themselves"
    ON public.shuttle_bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Bookings: Viewable and insertable only by owner
CREATE POLICY "Users can view own bookings"
    ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookings"
    ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Notifications:
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ========================================================================
-- 17. SUPABASE REALTIME CONFIGURATION
-- ========================================================================
-- Add tables to supabase_realtime publication for live subscription broadcasting
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_sessions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_participants;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shuttles;
EXCEPTION WHEN OTHERS THEN
    -- If table is already added, continue silently
    NULL;
END;
$$;

-- Set replica identity to full so that realtime events include old & new row data
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.votes REPLICA IDENTITY FULL;
ALTER TABLE public.vote_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.ride_participants REPLICA IDENTITY FULL;
ALTER TABLE public.shuttles REPLICA IDENTITY FULL;

-- ========================================================================
-- 18. INITIAL SEED DATA
-- ========================================================================

-- Communities
INSERT INTO public.communities (id, name, city) VALUES
    ('knowledge-park', 'Knowledge Park Community', 'Greater Noida'),
    ('pari-chowk', 'Pari Chowk Community', 'Greater Noida'),
    ('alpha-1', 'Alpha 1 & 2 Community', 'Greater Noida'),
    ('noida-sec-62', 'Noida Sector 62 Hub', 'Noida'),
    ('ghaziabad', 'Ghaziabad Commuters', 'Ghaziabad')
ON CONFLICT (id) DO NOTHING;

-- Initial Vote Session for Knowledge Park
INSERT INTO public.vote_sessions (id, community_id, title, departure_time, status)
VALUES ('e1b0c950-7f2e-4b68-98e1-5e263d9196b0', 'knowledge-park', 'Today''s Shared Commute', '6:30 PM Today', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Options for the initial vote session
INSERT INTO public.vote_options (vote_session_id, destination, display_order) VALUES
    ('e1b0c950-7f2e-4b68-98e1-5e263d9196b0', 'Pari Chowk', 1),
    ('e1b0c950-7f2e-4b68-98e1-5e263d9196b0', 'Alpha 1', 2),
    ('e1b0c950-7f2e-4b68-98e1-5e263d9196b0', 'Noida Sector 62', 3),
    ('e1b0c950-7f2e-4b68-98e1-5e263d9196b0', 'Ghaziabad Terminal', 4)
ON CONFLICT DO NOTHING;

-- Shuttles
INSERT INTO public.shuttles (id, route, departure_time, arrival_time, capacity, available_seats, status, fare) VALUES
    ('SH-01', 'Knowledge Park → Pari Chowk', '08:30 AM', '08:50 AM', 20, 18, 'Available', 20.00),
    ('SH-02', 'Knowledge Park → Noida Sector 62', '09:00 AM', '09:50 AM', 20, 0, 'Full', 45.00),
    ('SH-03', 'Alpha 1 → Knowledge Park', '05:45 PM', '06:05 PM', 20, 12, 'Available', 20.00),
    ('SH-04', 'Knowledge Park → Pari Chowk', '06:30 PM', '06:50 PM', 20, 18, 'Filling Fast', 20.00),
    ('SH-05', 'Pari Chowk → Ghaziabad Terminal', '07:15 PM', '08:05 PM', 20, 14, 'Available', 50.00)
ON CONFLICT (id) DO NOTHING;

-- ========================================================================
-- 19. AVATARS STORAGE BUCKET
-- ========================================================================
-- To create the public 'avatars' bucket in Supabase SQL editor:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images are publicly accessible"
    ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
    ON storage.objects FOR INSERT TO authenticated 
    WITH CHECK (bucket_id = 'avatars');
