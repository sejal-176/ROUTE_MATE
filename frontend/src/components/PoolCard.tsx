import { useState, useEffect, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { Users, Clock, User, Star, StarHalf } from 'lucide-react';
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
  const [creatorName, setCreatorName] = useState(pool.creator_name || 'Captain');
  const [creatorRating, setCreatorRating] = useState<number>(Number(pool.rating || 0));

  useEffect(() => {
    const loadMembershipStatus = async () => {
      if (!pool?.id) return;

      const { data: { session }, error: userError } = await supabase.auth.getSession();
      const user = session?.user;
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

    const fetchCreatorProfile = async () => {
      if (!pool?.creator_id) return;

      try {
        // Fetch name
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('name')
          .eq('id', pool.creator_id)
          .maybeSingle();

        if (profile?.name) setCreatorName(profile.name);

        // Fetch average rating
        const { data: ratings } = await supabase
          .from('ratings')
          .select('score')
          .eq('ratee_id', pool.creator_id);

        if (ratings && ratings.length > 0) {
          const avg = ratings.reduce((sum, item) => sum + Number(item.score || 0), 0) / ratings.length;
          setCreatorRating(avg);
        }
      } catch (err) {
        console.error('Failed to load creator info or ratings:', err);
      }
    };

    loadMembershipStatus();
    fetchCreatorProfile();
  }, [pool]);

  const handleJoin = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const { data: { session }, error: userError } = await supabase.auth.getSession();
    const user = session?.user;
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
      className={`group relative bg-white rounded-[24px] border border-gray-100 px-5 py-4 md:px-6 md:py-4 flex flex-col gap-3 cursor-pointer transition-all duration-300 ${compact ? 'p-3 rounded-2xl gap-2' : ''}`}
      onClick={() => navigate(`/chat/${pool.id}`)}
    >
      {/* Mode Badge */}
      <div className="absolute top-4 right-5 px-3 py-1.5 bg-[#121212] text-[#FFC107] rounded-xl font-black text-xs uppercase tracking-widest shadow-md">
        {pool.mode_of_transport || 'Car'}
      </div>

      {/* Creator Info */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-[#FFC107]/20 rounded-full flex items-center justify-center overflow-hidden border-2 border-[#FFC107]/50 shrink-0">
          <User className="text-[#FFC107]" size={24} />
        </div>
        <div className="flex flex-col min-w-0">
          <h4 className="font-black text-[#121212] leading-tight truncate text-base">{creatorName}</h4>
          <div className="flex items-center gap-2 mt-1">
            {creatorRating > 0 ? (
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFull = creatorRating >= star;
                    const isHalf = !isFull && creatorRating >= star - 0.5;

                    if (isFull) {
                      return <Star key={star} size={12} className="fill-[#FFC107] text-[#FFC107]" />;
                    } else if (isHalf) {
                      return <StarHalf key={star} size={12} className="fill-[#FFC107] text-[#FFC107]" />;
                    } else {
                      return <Star key={star} size={12} className="text-gray-200" />;
                    }
                  })}
                </div>
                <span className="text-xs font-black text-[#121212] leading-none">{creatorRating.toFixed(1)}</span>
              </div>
            ) : (
              <span className="text-xs font-bold text-gray-400 italic">No ratings yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Route Info */}
      <div className="flex flex-col gap-2 relative pl-1">
        {/* Connecting Line */}
        <div className="absolute left-[15px] top-[24px] bottom-[20px] w-0.5 border-l-2 border-dashed border-gray-200" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-5 h-5 rounded-full bg-[#121212] border-[3px] border-white shadow-sm flex items-center justify-center shrink-0" />
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">From</span>
            <span className="text-sm font-bold text-[#121212] truncate">{pool.source_text || pool.start_location}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-5 h-5 rounded-full bg-[#FFC107] border-[3px] border-white shadow-sm flex items-center justify-center shrink-0" />
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">To</span>
            <span className="text-sm font-bold text-[#121212] truncate">{pool.dest_text || pool.end_location}</span>
          </div>
        </div>
      </div>

      {/* Meta Bar */}
      <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-50 mt-auto">
        <div className="flex items-center gap-3 md:gap-5">
          <div className="flex flex-col gap-0.5 font-bold text-[10px] text-gray-500 uppercase tracking-widest">
            <div className="flex items-center gap-1.5 text-[#FFC107]"><Clock size={12} /> <span className="text-gray-400">Time</span></div>
            <span className="text-[#121212]">
              {pool.time_window_start
                ? new Date(pool.time_window_start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : (pool.start_time || '09:00 AM')}
            </span>
          </div>
          <div className="w-px h-6 bg-gray-100 hidden md:block"></div>
          <div className="flex flex-col gap-0.5 font-bold text-[10px] text-gray-500 uppercase tracking-widest">
            <div className="flex items-center gap-1.5 text-[#FFC107]"><Users size={12} /> <span className="text-gray-400">Seats</span></div>
            <span className="text-[#121212]">{pool.available_seats} left</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isCreator && !isAlreadyMember ? (
            <button
              type="button"
              onClick={handleJoin}
              disabled={requestSent || isRequestPending || pool.status === 'full' || pool.available_seats <= 0}
              className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all duration-200 text-[#121212] bg-[#FFC107] disabled:bg-gray-300 disabled:text-gray-600 hover:bg-[#121212] hover:text-[#FFC107]"
            >
              {requestSent ? 'Requested' : isRequestPending ? 'Req...' : (pool.status === 'full' || pool.available_seats <= 0) ? 'Full' : 'Join'}
            </button>
          ) : isAlreadyMember ? (
            <div className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#FFC107] bg-[#121212]">
              Joined Group
            </div>
          ) : null}
        </div>
      </div>

      {/* Decorative Glow */}
      <div className="absolute inset-0 rounded-3xl bg-[#FFC107]/0 group-hover:bg-[#FFC107]/[0.02] pointer-events-none transition-colors duration-500" />
    </motion.div>
  );
};

export default PoolCard;
