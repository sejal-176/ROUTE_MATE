import { useState, useEffect, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { Users, Clock, ArrowRight, User, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface PoolCardProps {
  pool: any;
  compact?: boolean;
}

const PoolCard = ({ pool, compact = false }: PoolCardProps) => {
  const navigate = useNavigate();
  const [isRequestPending, setIsRequestPending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);

  useEffect(() => {
    const loadMembershipStatus = async () => {
      if (!pool?.id) return;

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      if (pool.creator_id === user.id) {
        setIsCreator(true);
        return;
      }

      const { data: requestData, error: requestError } = await supabase
        .from('pool_requests')
        .select('status')
        .eq('pool_id', pool.id)
        .eq('requester_id', user.id)
        .maybeSingle();

      if (requestError) {
        console.error('Unable to load existing pool request status', requestError);
        return;
      }

      if (requestData) {
        if (requestData.status === 'accepted') {
          setIsAlreadyMember(true);
        } else if (requestData.status === 'pending') {
          setRequestSent(true);
        }
      }
    };

    loadMembershipStatus();
  }, [pool]);

  const handleJoin = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      alert('Please log in before requesting to join this pool.');
      return;
    }

    if (pool.creator_id === user.id) {
      alert('You are the creator of this pool and cannot request to join it.');
      return;
    }

    if (pool.available_seats <= 0) {
      alert('This pool is already full.');
      return;
    }

    setIsRequestPending(true);
    try {
      const requestPayload = {
        pool_id: pool.id,
        requester_id: user.id,
        requester_source_lat: pool.source_lat ?? 0,
        requester_source_lng: pool.source_lng ?? 0,
        requester_dest_lat: pool.dest_lat ?? 0,
        requester_dest_lng: pool.dest_lng ?? 0,
        requester_time: pool.time_window_start ?? new Date().toISOString(),
        status: 'pending'
      };

      const { error } = await supabase.from('pool_requests').insert(requestPayload);
      if (error) throw error;

      setRequestSent(true);
      alert('Join request sent! The creator can now accept or reject your request.');
    } catch (error) {
      console.error('Failed to send join request', error);
      alert('Could not send the join request. Please try again.');
    } finally {
      setIsRequestPending(false);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.01, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
      whileTap={{ scale: 0.98 }}
      className={`group relative bg-white rounded-3xl border border-gray-100 p-6 flex flex-col gap-6 cursor-pointer transition-all duration-300 ${compact ? 'p-4 rounded-2xl' : ''}`}
      onClick={() => navigate(`/chat/${pool.id}`)}
    >
      {/* Price Badge */}
      <div className="absolute top-6 right-6 px-4 py-2 bg-[#121212] text-[#FFC107] rounded-2xl font-black text-lg shadow-lg">
        ₹{pool.price_per_seat}
      </div>

      {/* Creator Info */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-[#FFC107]/20 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary/50">
          <User className="text-[#FFC107]" size={24} />
        </div>
        <div>
          <h4 className="font-black text-[#121212] leading-tight">{pool.creator_name || 'Verified Captain'}</h4>
          <div className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase tracking-tighter">
            <Star size={12} className="fill-primary text-[#FFC107]" />
            <span>4.9 • Superhost</span>
          </div>
        </div>
      </div>

      {/* Route Info */}
      <div className="flex flex-col gap-3 relative">
        {/* Connecting Line */}
        <div className="absolute left-[11px] top-[24px] bottom-[24px] w-0.5 border-l-2 border-dashed border-gray-200" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-6 h-6 rounded-full bg-[#121212] border-4 border-white shadow-sm flex items-center justify-center" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase">From</span>
            <span className="text-sm font-bold text-[#121212] truncate">{pool.source_text || pool.start_location}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-6 h-6 rounded-full bg-[#FFC107] border-4 border-white shadow-sm flex items-center justify-center" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase">To</span>
            <span className="text-sm font-bold text-[#121212] truncate">{pool.dest_text || pool.end_location}</span>
          </div>
        </div>
      </div>

      {/* Meta Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-50 mt-auto">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-bold text-[10px] text-gray-500 uppercase tracking-widest">
            <Clock size={14} className="text-[#FFC107]" />
            <span>
              {pool.time_window_start 
                ? new Date(pool.time_window_start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }) 
                : (pool.start_time || '09:00 AM')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-xs text-gray-500">
            <Users size={14} className="text-[#FFC107]" />
            <span>{pool.available_seats} Seats</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          {!isCreator && !isAlreadyMember ? (
            <button
              type="button"
              onClick={handleJoin}
              disabled={requestSent || isRequestPending || pool.status === 'full' || pool.available_seats <= 0}
              className="rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all duration-200 text-[#121212] bg-[#FFC107] disabled:bg-gray-300 disabled:text-gray-600 hover:bg-[#121212] hover:text-[#FFC107]"
            >
              {requestSent ? 'Requested' : isRequestPending ? 'Requesting...' : (pool.status === 'full' || pool.available_seats <= 0) ? 'Pool Full' : 'Join'}
            </button>
          ) : isAlreadyMember ? (
            <div className="rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-widest text-white bg-[#121212] bg-opacity-90">
              You are already part of group bro
            </div>
          ) : null}

          <div className="p-2 bg-[#FFC107] rounded-xl group-hover:bg-[#121212] group-hover:text-[#FFC107] transition-colors">
            <ArrowRight size={18} />
          </div>
        </div>
      </div>

      {/* Decorative Glow */}
      <div className="absolute inset-0 rounded-3xl bg-[#FFC107]/0 group-hover:bg-[#FFC107]/[0.02] pointer-events-none transition-colors duration-500" />
    </motion.div>
  );
};

export default PoolCard;
