import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, Loader, Navigation, MapPin, Users, Car, Clock, ChevronRight, ArrowLeft } from 'lucide-react';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const customUserIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

const encodeGeohash = (lat: number, lng: number, precision: number = 6): string => {
  let isEven = true;
  let bit = 0;
  let ch = 0;
  let geohash = '';
  let latInterval: [number, number] = [-90, 90];
  let lngInterval: [number, number] = [-180, 180];

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lngInterval[0] + lngInterval[1]) / 2;
      if (lng >= mid) {
        ch = (ch << 1) + 1;
        lngInterval[0] = mid;
      } else {
        ch = ch << 1;
        lngInterval[1] = mid;
      }
    } else {
      const mid = (latInterval[0] + latInterval[1]) / 2;
      if (lat >= mid) {
        ch = (ch << 1) + 1;
        latInterval[0] = mid;
      } else {
        ch = ch << 1;
        latInterval[1] = mid;
      }
    }

    isEven = !isEven;
    bit += 1;

    if (bit === 5) {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
};

const MapController = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  React.useEffect(() => {
    map.invalidateSize();
    map.setView([lat, lng], 15, { animate: true });
  }, [lat, lng, map]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 400);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
};

const CreatePool = () => {
  const [formData, setFormData] = useState({
    sourceText: '',
    sourceLat: 0,
    sourceLng: 0,
    destText: '',
    destLat: 0,
    destLng: 0,
    capacity: 3,
    timeWindowStart: '',
    modeOfTransport: 'Car',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleGeocode = async (address: string) => {
    try {
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`,

      );
      if (res.data && res.data.length > 0) {
        return { lat: parseFloat(res.data[0].lat), lng: parseFloat(res.data[0].lon) };
      }
    } catch (e) {
      console.warn('Geocoding failed, using fallback.', e);
    }
    return { lat: 19.0760 + Math.random() * 0.05, lng: 72.8777 + Math.random() * 0.05 };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      const user = session?.user;
      if (authError || !user) throw new Error('You must be logged in to create a pool.');

      let sourceCoords = { lat: formData.sourceLat, lng: formData.sourceLng };
      let destCoords = { lat: formData.destLat, lng: formData.destLng };

      if (!sourceCoords.lat || !sourceCoords.lng) {
        sourceCoords = await handleGeocode(formData.sourceText);
      }
      if (!destCoords.lat || !destCoords.lng) {
        destCoords = await handleGeocode(formData.destText);
      }

      const { error: poolError } = await supabase.from('pools').insert({
        creator_id: user.id,
        source_lat: sourceCoords.lat,
        source_lng: sourceCoords.lng,
        source_geohash: encodeGeohash(sourceCoords.lat, sourceCoords.lng, 6),
        source_text: formData.sourceText,
        dest_lat: destCoords.lat,
        dest_lng: destCoords.lng,
        dest_text: formData.destText,
        time_window_start: new Date(formData.timeWindowStart).toISOString(),
        capacity: formData.capacity,
        available_seats: formData.capacity,
        mode_of_transport: formData.modeOfTransport,
        status: 'open'
      });

      if (poolError) throw new Error(poolError.message);

      setSuccess(true);
      setTimeout(() => navigate('/profile'), 2500);

    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container mx-auto px-6 py-12 min-h-[calc(100vh-80px)] flex flex-col items-center justify-center"
    >
      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div
            key="form"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-gray-100 p-10 md:p-16 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-4xl font-black text-[#121212] tracking-tighter mb-2">Host a <span className="text-[#FFC107] italic">Ride</span></h2>
                <p className="text-gray-400 font-bold text-sm">Fill in the details to find your ride buddies.</p>
              </div>
              <div className="w-16 h-16 bg-[#FFC107]/10 rounded-2xl flex items-center justify-center text-[#FFC107]">
                <Car size={32} />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 border border-red-100 text-red-500 p-4 rounded-2xl mb-8 text-sm font-bold flex gap-3"
              >
                <span>⚠️</span> {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Starting Point</label>
                  <LocationAutocomplete
                    value={formData.sourceText}
                    onChange={(val) => setFormData(prev => ({ ...prev, sourceText: val }))}
                    onSelectLocation={(lat, lng) => setFormData(prev => ({ ...prev, sourceLat: lat, sourceLng: lng }))}
                    placeholder="e.g. Bandra Station"
                    icon={<Navigation className="text-[#FFC107]" size={18} />}
                  />
                  {formData.sourceLat !== 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: '140px' }} className="w-full rounded-2xl overflow-hidden border border-gray-100 mt-2 isolate">
                      <MapContainer center={[formData.sourceLat, formData.sourceLng]} zoom={15} scrollWheelZoom={false} className="h-full w-full">
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                        <Marker position={[formData.sourceLat, formData.sourceLng]} icon={customUserIcon} />
                        <MapController lat={formData.sourceLat} lng={formData.sourceLng} />
                      </MapContainer>
                    </motion.div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Destination</label>
                  <LocationAutocomplete
                    value={formData.destText}
                    onChange={(val) => setFormData(prev => ({ ...prev, destText: val }))}
                    onSelectLocation={(lat, lng) => setFormData(prev => ({ ...prev, destLat: lat, destLng: lng }))}
                    placeholder="e.g. Nariman Point"
                    icon={<MapPin className="text-[#FFC107]" size={18} />}
                  />
                  {formData.destLat !== 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: '140px' }} className="w-full rounded-2xl overflow-hidden border border-gray-100 mt-2 isolate">
                      <MapContainer center={[formData.destLat, formData.destLng]} zoom={15} scrollWheelZoom={false} className="h-full w-full">
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                        <Marker position={[formData.destLat, formData.destLng]} icon={customUserIcon} />
                        <MapController lat={formData.destLat} lng={formData.destLng} />
                      </MapContainer>
                    </motion.div>
                  )}
                </div>
              </div>


              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Seats</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FFC107]" size={18} />
                  <input
                    type="number"
                    min="1" max="10"
                    className="input-premium pl-12"
                    value={formData.capacity}
                    onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Vehicle</label>
                <select
                  className="input-premium"
                  value={formData.modeOfTransport}
                  onChange={e => setFormData({ ...formData, modeOfTransport: e.target.value })}
                >
                  <option value="Car">Car</option>
                  <option value="Bike">Bike</option>
                  <option value="Auto">Auto</option>
                </select>
              </div>



              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Departure Time</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FFC107]" size={18} />
                  <input
                    type="datetime-local"
                    className="input-premium pl-12"
                    value={formData.timeWindowStart}
                    onChange={e => setFormData({ ...formData, timeWindowStart: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 mt-4">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="flex-1 h-[64px] bg-gray-50 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={16} /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] btn-primary h-[64px] text-lg group"
                >
                  {loading ? <Loader className="animate-spin mr-2" /> : 'Host Ride'}
                  <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-32 h-32 bg-[#FFC107] rounded-full flex items-center justify-center mx-auto mb-10 shadow-lg animate-pin-bounce">
              <CheckCircle size={64} className="text-[#121212]" strokeWidth={3} />
            </div>
            <h2 className="text-6xl font-black text-[#121212] tracking-tighter mb-4 italic">Ride Live!</h2>
            <p className="text-gray-400 font-bold text-xl">Your pool is active. Redirecting you to your dashboard...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CreatePool;