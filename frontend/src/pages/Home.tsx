import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Navigation, Calendar, Clock, Car, ChevronDown } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import HeroSection from '../components/HeroSection';
import PoolCard from '../components/PoolCard';
import AnimatedEmptyState from '../components/AnimatedEmptyState';

const API_BASE_URL = 'http://localhost:8000/api';

const customUserIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const customPoolIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'animate-pin-bounce'
});

/** Keeps tiles aligned: Leaflet must call invalidateSize after container layout changes. */
const MapLayoutSync = ({ lat, lng, expanded }: { lat: number; lng: number; expanded: boolean }) => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.flyTo([lat, lng], 13);
  }, [lat, lng, map]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => map.invalidateSize());
    const t = window.setTimeout(() => map.invalidateSize(), 400);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [map, expanded]);

  return null;
};

const Home = () => {
  const [pools, setPools] = useState<any[]>([]);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);

  // Search state
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchTime, setSearchTime] = useState('');
  const isSearchComplete = searchFrom && searchTo;

  const [loading, setLoading] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  const navigate = useNavigate();
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getUserLocation();

    const channel = supabase.channel('pools_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pools' }, () => {
        if (location) fetchNearbyPools(location.lat, location.lng);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);



  const fetchNearbyPools = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const response = await axios.post(`${API_BASE_URL}/pools/nearby`, {
        lat, lng, radius_km: 15.0, user_id: user?.id
      });
      setPools(response.data.pools || []);
    } catch (err) {
      console.error('Failed to load pools', err);
      setPools([]);
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({ lat, lng });
          fetchNearbyPools(lat, lng);
        },
        () => {
          const defaultLoc = { lat: 19.0760, lng: 72.8777 }; // fallback map center when geolocation unavailable
          setLocation(defaultLoc);
          fetchNearbyPools(defaultLoc.lat, defaultLoc.lng);
        }
      );
    }
  };

  const handleSearch = async () => {
    if (!searchFrom) return;
    setLoading(true);
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchFrom)}`);
      let destLat, destLng;
      if (searchTo) {
          const destRes = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTo)}`);
          if (destRes.data && destRes.data.length > 0) {
             destLat = parseFloat(destRes.data[0].lat);
             destLng = parseFloat(destRes.data[0].lon);
          }
      }
      if (res.data && res.data.length > 0) {
        const lat = parseFloat(res.data[0].lat);
        const lng = parseFloat(res.data[0].lon);
        setLocation({ lat, lng });

        const { data: { user } } = await supabase.auth.getUser();
        const response = await axios.post(`${API_BASE_URL}/pools/nearby`, {
          lat, lng, radius_km: 15.0, user_id: user?.id,
          dest_lat: destLat, dest_lng: destLng, search_date: searchDate, search_time: searchTime
        });
        setPools(response.data.pools || []);
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      console.error("Geocoding failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col bg-white"
    >
      <div className="relative">
        <HeroSection onExploreClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' })} />

        {/* SEARCH SECTION — compact first fold; modest gap before pools */}
        <div id="search" className="container mx-auto px-6 mt-2 md:mt-3 relative z-20 pb-4 md:pb-5">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="bg-[#121212] rounded-3xl p-5 md:p-6 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5 items-end">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Leaving From</label>
                <div className="relative">
                  <Navigation size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FFC107]" />
                  <input
                    type="text"
                    placeholder="Street, locality, or landmark"
                    value={searchFrom}
                    onChange={(e) => setSearchFrom(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white/10 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-white/5"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Going To</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FFC107]" />
                  <input
                    type="text"
                    placeholder="Destination area"
                    value={searchTo}
                    onChange={(e) => setSearchTo(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white/10 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-white/5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Date</label>
                  <div className="relative">
                    <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FFC107]" />
                    <input
                      type="date"
                      value={searchDate}
                      onChange={(e) => setSearchDate(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white/10 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-white/5 color-scheme-dark"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Time</label>
                  <div className="relative">
                    <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FFC107]" />
                    <input
                      type="time"
                      value={searchTime}
                      onChange={(e) => setSearchTime(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white/10 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-white/5 color-scheme-dark"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSearch}
                disabled={!isSearchComplete || loading}
                className="btn-primary w-full min-h-[52px] h-[52px] text-base md:text-lg disabled:bg-gray-700 disabled:text-gray-500 disabled:scale-100"
              >
                {loading ? 'Searching...' : 'Find Carpool'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* RESULTS SECTION */}
      <section ref={resultsRef} className="container mx-auto px-6 pt-2 pb-10 md:pt-4 md:pb-14 scroll-mt-24">
        <div className="flex flex-col items-center text-center mb-10 md:mb-12">
          <h2 className="text-4xl font-black text-[#121212] tracking-tighter">Available <span className="text-[#FFC107] italic">Pools</span></h2>
          <div className="h-1 w-20 md:w-24 bg-gray-100 mt-4 rounded-full" />
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* RIDES COLUMN */}
          <div className="flex-1 flex flex-col gap-6 order-2 lg:order-1 min-h-0">
            {pools.length === 0 ? (
              <AnimatedEmptyState />
            ) : (
              <div
                className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6 pr-2 custom-scrollbar scroll-smooth ${
                  pools.length > 6
                    ? 'max-h-[min(900px,70vh)] overflow-y-auto overscroll-y-contain'
                    : ''
                }`}
              >
                <AnimatePresence>
                  {pools.map((pool, idx) => (
                    <motion.div
                      key={pool.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <PoolCard pool={pool} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            <div className="flex flex-col items-center gap-3 pt-8 md:pt-12 px-4">
              <button
                type="button"
                onClick={() => navigate('/create-pool')}
                className="btn-primary flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 w-full max-w-xl px-8 py-5 md:py-6 rounded-2xl text-center shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="font-bold normal-case tracking-normal text-sm md:text-base text-[#121212]/80">
                  Can&apos;t find a ride?
                </span>
                <span className="font-black uppercase tracking-widest text-base md:text-lg flex items-center gap-2">
                  <Car size={22} strokeWidth={2.5} /> Host now!
                </span>
              </button>
            </div>
          </div>

          {/* MAP COLUMN — no Framer `layout` here: transforms break Leaflet tile positioning */}
          <div
            className={`w-full lg:sticky lg:top-24 order-1 lg:order-2 transition-all duration-500 ${mapExpanded ? 'lg:flex-[1.5]' : 'lg:flex-[0.8]'}`}
          >
            <div className={`relative w-full rounded-3xl overflow-hidden border border-gray-100 shadow-lg transition-all duration-500 isolate ${mapExpanded ? 'h-[600px] md:h-[800px]' : 'h-[320px] md:h-[560px]'}`}>
              {location ? (
                <MapContainer
                  center={[location.lat, location.lng]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                  className="z-0"
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapLayoutSync lat={location.lat} lng={location.lng} expanded={mapExpanded} />

                  <Marker position={[location.lat, location.lng]} icon={customUserIcon}>
                    <Popup>You are here</Popup>
                  </Marker>

                  {pools.map((pool) => (
                    <Marker key={pool.id} position={[pool.source_lat, pool.source_lng]} icon={customPoolIcon}>
                      <Popup className="premium-popup">
                        <div className="p-2 font-bold text-[#121212] italic">₹{pool.price_per_seat} to {pool.end_location}</div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              ) : (
                <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                  <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest animate-pulse">Locating Navigator...</p>
                </div>
              )}

              {/* Map Controls */}
              <div className="absolute top-6 right-6 flex flex-col gap-2 z-[999]">
                <button
                  onClick={() => setMapExpanded(!mapExpanded)}
                  className="bg-white/90 backdrop-blur p-3 rounded-2xl shadow-lg hover:bg-white transition-colors text-[#121212] font-black text-xs uppercase tracking-tighter flex items-center gap-2"
                >
                  <ChevronDown className={`transition-transform duration-300 ${mapExpanded ? 'rotate-180' : ''}`} />
                  {mapExpanded ? 'Compact' : 'Expand'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="w-full bg-[#FFC107] scroll-mt-24">
        <div className="container mx-auto px-6 py-6 md:py-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-8 lg:gap-12 text-center md:text-left">
          <h2 className="text-3xl md:text-4xl font-black text-[#121212] tracking-tighter italic shrink-0 whitespace-nowrap md:whitespace-normal">
            Ready to ride?
          </h2>
          <p className="text-[#121212]/70 font-bold text-sm md:text-base flex-1 md:min-w-0 leading-snug md:px-4">
            Save money, make buddies, and take a car off the road one shared ride at a time.
          </p>
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="btn-dark px-8 py-3.5 text-base md:text-lg shadow-xl hover:shadow-dark/20 shrink-0 w-full md:w-auto justify-center"
          >
            Join the Community
          </button>
        </div>
      </section>

      <footer className="bg-[#121212] text-white border-t border-white/10">
        <div className="container mx-auto px-6 py-12 md:py-16">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-10">
            <Link to="/" className="flex items-center gap-2 group w-fit">
              <div className="w-10 h-10 bg-white/10 flex items-center justify-center rounded-xl group-hover:bg-[#FFC107]/20 transition-colors">
                <span className="text-[#FFC107] font-black text-xl italic">R</span>
              </div>
              <span className="text-xl font-black tracking-tighter">
                Route<span className="text-[#FFC107]">Mate</span>
              </span>
            </Link>
            <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-bold text-gray-400">
              <Link to="/" className="hover:text-[#FFC107] transition-colors">Dashboard</Link>
              <Link to="/security" className="hover:text-[#FFC107] transition-colors">Safety Center</Link>
              <a href="#search" className="hover:text-[#FFC107] transition-colors">Find a ride</a>
              <Link to="/how-it-works" className="hover:text-[#FFC107] transition-colors">How it works</Link>
            </nav>
          </div>
          <div className="mt-10 pt-8 border-t border-white/10 text-center text-xs font-bold text-gray-500 tracking-wide">
            © {new Date().getFullYear()} RouteMate · Smart carpooling for commuters
          </div>
        </div>
      </footer>

      <style>{`
        .leaflet-container img { max-width: none !important; }
        .leaflet-container { background: #f9fafb !important; }
        .color-scheme-dark { color-scheme: dark; }
        .premium-popup .leaflet-popup-content-wrapper { border-radius: 12px; padding: 0; overflow: hidden; }
        .premium-popup .leaflet-popup-content { margin: 0; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
      `}</style>
    </motion.div>
  );
};

export default Home;