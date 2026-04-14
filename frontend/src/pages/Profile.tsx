import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
  User, Star, LogOut, CheckCircle,
  MessageSquare, Phone, Mail, VenusAndMars, Calendar,
  ShieldCheck, TrendingUp, ChevronRight
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000/api';

const Profile = () => {
  const [profile, setProfile] = useState<any>(null);
  const [pools, setPools] = useState<any[]>([]);
  const [pendingRequestsByPool, setPendingRequestsByPool] = useState<Record<string, any[]>>({});
  const [reviewingPoolId, setReviewingPoolId] = useState<string | null>(null);
  const [requestPanel, setRequestPanel] = useState<any[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [ratingModal, setRatingModal] = useState<{ open: boolean; poolId: string | null }>({ open: false, poolId: null });
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [receivedRatings, setReceivedRatings] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ongoing' | 'history' | 'reviews'>('ongoing');

  const navigate = useNavigate();

  const fetchRatingStats = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('ratings')
        .select('*')
        .eq('ratee_id', userId)
        .order('created_at', { ascending: false });

      if (!data || data.length === 0) {
        setReceivedRatings([]);
        setRatingCount(0);
        setAverageRating(0);
        return;
      }

      const raterIds = Array.from(new Set(data.map((ratingItem: any) => ratingItem.rater_id)));
      const { data: raterProfiles } = await supabase
        .from('user_profiles')
        .select('id, name')
        .in('id', raterIds);

      const raterMap = new Map<string, string>();
      (raterProfiles || []).forEach((profile: any) => {
        raterMap.set(profile.id, profile.name || 'Rider');
      });

      const enrichedRatings = data.map((ratingItem: any) => ({
        ...ratingItem,
        rater_name: raterMap.get(ratingItem.rater_id) || 'Rider'
      }));

      setReceivedRatings(enrichedRatings);
      setRatingCount(enrichedRatings.length);
      const avg = enrichedRatings.reduce((sum, item) => sum + Number(item.score || 0), 0) / enrichedRatings.length;
      setAverageRating(avg);
    } catch (err) {
      console.error('Failed to load user ratings:', err);
    }
  };

  const fetchFullProfileData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profileData) setProfile(profileData);

        await fetchRatingStats(user.id);

        const { data: createdPools } = await supabase
          .from('pools')
          .select('*')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false });

        const { data: joinedRequests } = await supabase
          .from('pool_requests')
          .select('pool_id')
          .eq('requester_id', user.id)
          .eq('status', 'accepted');

        let myPools = createdPools || [];

        if (joinedRequests && joinedRequests.length > 0) {
           const poolIds = joinedRequests.map(r => r.pool_id);
           const { data: joinedPools } = await supabase
             .from('pools')
             .select('*')
             .in('id', poolIds)
             .order('created_at', { ascending: false });
           
           if (joinedPools) {
              const existingIds = new Set(myPools.map(p => p.id));
              const newPools = joinedPools.filter(p => !existingIds.has(p.id));
              myPools = [...myPools, ...newPools];
              myPools.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
           }
        }
        
        setPools(myPools);
      }
    } catch (err) {
      console.error('fetchFullProfileData failed', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async (poolIds: string[]) => {
    if (!poolIds.length) return;
    try {
      const { data } = await supabase
        .from('pool_requests')
        .select('*,user_profiles(*)')
        .in('pool_id', poolIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      const grouped: Record<string, any[]> = {};
      (data || []).forEach((req: any) => {
        grouped[req.pool_id] = grouped[req.pool_id] || [];
        grouped[req.pool_id].push(req);
      });
      setPendingRequestsByPool(grouped);
    } catch (err) {
      console.error('Pending requests load failed:', err);
    }
  };

  const loadRequestsForPool = async (poolId: string) => {
    setReviewingPoolId(poolId);
    setRequestPanel([]);
    try {
      const response = await axios.get(`${API_BASE_URL}/pools/${poolId}/requests`);
      const nextRequests = response.data.requests || [];
      setRequestPanel(nextRequests.length > 0 ? nextRequests : (pendingRequestsByPool[poolId] || []));
    } catch (error) {
      console.error('Unable to load pool requests', error);
      setRequestPanel(pendingRequestsByPool[poolId] || []);
    }
  };

  const respondToRequest = async (requestId: string, accept: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNotification('Session expired. Please log in.');
        return;
      }

      const { data: requestData, error: reqError } = await supabase
        .from('pool_requests')
        .select('pool_id')
        .eq('id', requestId)
        .single();
        
      if (reqError || !requestData) throw new Error('Request not found');
      const poolId = requestData.pool_id;

      if (accept) {
        const { data: poolData, error: poolError } = await supabase
          .from('pools')
          .select('available_seats, status, creator_id')
          .eq('id', poolId)
          .single();
          
        if (poolError || !poolData) throw new Error('Pool not found');
        
        if (poolData.creator_id !== user.id) {
           throw new Error('Not authorized to accept requests for this pool');
        }

        if (poolData.available_seats <= 0 || poolData.status === 'full') {
          setNotification('Cannot accept: Pool is already full.');
          return;
        }

        const newSeats = poolData.available_seats - 1;
        const poolUpdate: any = { available_seats: newSeats };
        if (newSeats <= 0) {
          poolUpdate.status = 'full';
        }

        const { error: updatePoolError } = await supabase
          .from('pools')
          .update(poolUpdate)
          .eq('id', poolId);

        if (updatePoolError) throw updatePoolError;
      }

      const { error: updateReqError } = await supabase
        .from('pool_requests')
        .update({ status: accept ? 'accepted' : 'rejected' })
        .eq('id', requestId);

      if (updateReqError) throw updateReqError;

      setRequestPanel(prev => prev.filter(req => req.id !== requestId));
      if (reviewingPoolId) {
         setPendingRequestsByPool(prev => ({
           ...prev, 
           [reviewingPoolId]: (prev[reviewingPoolId] || []).filter(req => req.id !== requestId)
         }));
      }
      setNotification(accept ? 'Request accepted!' : 'Request rejected.');

    } catch (error: any) {
      console.error('Unable to respond to request', error);
      setNotification(error.message || 'Action failed.');
    }
  };

  useEffect(() => { fetchFullProfileData(); }, []);

  useEffect(() => {
    if (!pools.length) return;
    const poolIds = pools.map(pool => pool.id);
    fetchPendingRequests(poolIds);
  }, [pools]);

  const handleEndPool = (poolId: string) => {
    setRating(0);
    setRatingModal({ open: true, poolId });
  };

  const confirmDissolve = async () => {
    if (!ratingModal.poolId) return;
    const { error } = await supabase
      .from('pools')
      .update({ status: 'completed', rating: rating })
      .eq('id', ratingModal.poolId);

    if (!error) {
      setRatingModal({ open: false, poolId: null });
      fetchFullProfileData();
    }
  };

  const activePools = pools.filter(p => p.status === 'open' || p.status === 'full' || p.status === 'active');
  const historyPools = pools.filter(p => p.status === 'completed');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <span className="text-[#121212] font-black tracking-widest text-[10px] uppercase">Fetching Profile...</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="container mx-auto px-6 py-12"
    >
      {/* ── RATING MODAL ── */}
      <AnimatePresence>
        {ratingModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#121212]/95 z-[100] flex items-center justify-center p-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-[#FFC107]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Star size={40} className="text-[#FFC107] fill-primary" />
              </div>
              <h2 className="text-3xl font-black text-[#121212] tracking-tighter mb-2">Ride Done!</h2>
              <p className="text-gray-400 font-medium mb-8">How was the vibe with your co-riders?</p>

              <div className="flex justify-center gap-2 mb-10">
                {[1, 2, 3, 4, 5].map(s => (
                  <motion.button
                    key={s}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 focus:outline-none"
                  >
                    <Star
                      size={32}
                      fill={(hoverRating || rating) >= s ? '#FFC107' : 'none'}
                      className={(hoverRating || rating) >= s ? 'text-[#FFC107]' : 'text-gray-200'}
                    />
                  </motion.button>
                ))}
              </div>

              <button
                className="btn-primary w-full h-[60px] text-lg disabled:bg-gray-100 disabled:text-gray-400"
                onClick={confirmDissolve}
                disabled={rating === 0}
              >
                Save & Finish
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row gap-12">

        {/* ── LEFT: USER CARD ── */}
        <aside className="lg:w-80 shrink-0">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-lg sticky top-24">
            <div className="text-center mb-10">
              <div className="relative inline-block mb-6">
                <div className="w-24 h-24 bg-[#121212] rounded-3xl flex items-center justify-center overflow-hidden border-4 border-primary shadow-xl">
                  <User size={48} className="text-[#FFC107]" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-black-rich text-[#FFC107] rounded-xl flex items-center justify-center border-2 border-white shadow-lg">
                  <ShieldCheck size={16} />
                </div>
              </div>
              <h2 className="text-2xl font-black text-[#121212] tracking-tighter mb-1">{profile?.name}</h2>
              <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#FFC107] italic">
                Verified Captain
              </div>
            </div>

            <div className="flex flex-col gap-5 pt-8 border-t border-gray-50 mb-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                  <Mail size={16} />
                </div>
                <span className="text-sm font-bold text-[#121212] truncate">{profile?.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                  <Phone size={16} />
                </div>
                <span className="text-sm font-bold text-[#121212]">{profile?.phone_number}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                  <VenusAndMars size={16} />
                </div>
                <span className="text-sm font-bold text-[#121212]">{profile?.gender}</span>
              </div>
            </div>

            {/* Rep Stat */}
            <div className="bg-[#121212] rounded-2xl p-6 text-white text-center relative overflow-hidden group mb-8">
              <TrendingUp className="absolute -bottom-2 -right-2 text-white/5 group-hover:scale-110 transition-transform duration-500" size={100} />
              <p className="text-[10px] font-black uppercase tracking-widest text-[#FFC107] mb-2">Reputation</p>
              <div className="text-4xl font-black italic mb-1">
                {ratingCount === 0 ? '--' : averageRating.toFixed(1)}
              </div>
              <p className="text-[10px] font-bold text-gray-500">{ratingCount} Feedbacks</p>
            </div>

            <button
              onClick={() => supabase.auth.signOut().then(() => navigate('/auth'))}
              className="w-full flex items-center justify-center gap-3 py-4 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </aside>

        {/* ── RIGHT: CONTENT AREA ── */}
        <main className="flex-1">
          {notification && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-[#FFC107]/10 border border-primary/20 p-4 rounded-2xl mb-8 flex items-center gap-3"
            >
              <div className="w-2 h-2 bg-[#FFC107] rounded-full animate-ping" />
              <p className="text-xs font-black text-accent-yellow">{notification}</p>
            </motion.div>
          )}

          {/* TABS */}
          <div className="flex gap-8 mb-12 border-b border-gray-100 overflow-x-auto whitespace-nowrap scrollbar-none pb-1">
            {(['ongoing', 'history', 'reviews'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative pb-4 text-sm font-black uppercase tracking-widest transition-colors ${activeTab === tab ? 'text-[#121212]' : 'text-gray-300'}`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div
                    layoutId="profile-tab-active"
                    className="absolute bottom-0 left-0 w-full h-1 bg-[#FFC107] rounded-full"
                  />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
  {activeTab === 'ongoing' && (
    <motion.div
      key="ongoing"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="flex flex-col gap-8"
    >
      {activePools.length === 0 ? (
        <div className="bg-gray-50 rounded-[2.5rem] py-20 px-6 text-center border-2 border-dashed border-gray-100">
          <p className="text-gray-400 font-bold">No active pools. Ready to host one?</p>
          <button
            onClick={() => navigate('/create-pool')}
            className="btn-outline mt-6"
          >
            Host a Ride
          </button>
        </div>
      ) : (
        activePools.map(pool => {
          const pendingRequests = pendingRequestsByPool[pool.id] || [];
          // Check if the current user is the creator of this specific pool
          const isCreator = profile?.id === pool.creator_id;

          return (
            <div key={pool.id} className="bg-white rounded-3xl border border-gray-100 p-8 shadow-lg group">
              <div className="flex flex-col md:flex-row justify-between md:items-start gap-6 mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${pool.status === 'full' ? 'bg-orange-100 text-orange-600' : 'bg-[#FFC107]/20 text-accent-yellow'}`}>
                      {pool.status}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{pool.mode_of_transport}</span>
                  </div>
                  <h3 className="text-2xl font-black text-[#121212] tracking-tighter mb-2">
                    {pool.source_text} <ChevronRight className="inline mx-1 text-[#FFC107]" /> {pool.dest_text}
                  </h3>
                  <p className="text-sm font-bold text-gray-400 flex items-center gap-2">
                    <Calendar size={14} className="text-[#FFC107]" />
                    {new Date(pool.time_window_start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/chat/${pool.id}`)}
                    className="w-12 h-12 bg-[#121212] text-[#FFC107] rounded-xl flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <MessageSquare size={20} />
                  </button>
                  
                  {/* Only show "End Ride" for the creator */}
                  {isCreator && (
                    <button
                      onClick={() => handleEndPool(pool.id)}
                      className="px-6 h-12 bg-red-50 text-red-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm"
                    >
                      End Ride
                    </button>
                  )}
                </div>
              </div>

              {/* ONLY SHOW PENDING REQUESTS SECTION TO THE CREATOR */}
              {isCreator && (
                <>
                  <div className="flex flex-col md:flex-row gap-4">
                    <button
                      onClick={() => loadRequestsForPool(pool.id)}
                      className="flex-1 px-8 h-16 bg-gray-50 rounded-2xl flex items-center justify-between group-hover:bg-[#FFC107]/5 transition-colors group/btn"
                    >
                      <span className="text-[#121212] font-black tracking-tighter">
                        {pendingRequests.length} Pending Requests
                      </span>
                      <ChevronRight className="text-gray-300 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>

                  {reviewingPoolId === pool.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="mt-8 pt-8 border-t border-gray-50 grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {requestPanel.length === 0 ? (
                        <p className="text-xs font-bold text-gray-400 italic col-span-2">No pending requests found in the records.</p>
                      ) : (
                        requestPanel.map((req: any) => (
                          <div key={req.id} className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-100">
                                <User size={20} className="text-gray-300" />
                              </div>
                              <div>
                                <h4 className="font-black text-[#121212] text-sm">{req.user_profiles?.name || 'Rider'}</h4>
                                <p className="text-[10px] font-bold text-gray-400">Match Accuracy: {Number(req.heuristic_score || 0).toFixed(0)}%</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => respondToRequest(req.id, true)}
                                className="flex-1 py-3 bg-[#121212] text-[#FFC107] rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => respondToRequest(req.id, false)}
                                className="flex-1 py-3 bg-white border border-gray-100 text-gray-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}
                </>
              )}
            </div>
          );
        })
      )}
    </motion.div>
  )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex flex-col gap-4"
              >
                {historyPools.length === 0 ? (
                  <p className="text-gray-400 font-bold p-10 text-center">Empty roads ahead. Your history starts here.</p>
                ) : (
                  historyPools.map(pool => (
                    <div key={pool.id} className="bg-white rounded-3xl border border-gray-50 p-6 flex items-center justify-between group hover:border-primary/20 transition-all opacity-80 hover:opacity-100">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 group-hover:bg-[#FFC107]/10 group-hover:text-[#FFC107] transition-colors">
                          <CheckCircle size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-[#121212] tracking-tighter truncate max-w-[200px] md:max-w-md">{pool.source_text} → {pool.dest_text}</h4>
                          <p className="text-xs font-bold text-gray-400">{new Date(pool.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={12} className={i < (pool.rating || 0) ? 'text-[#FFC107] fill-primary' : 'text-gray-100'} />
                          ))}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 hidden md:block">Completed</span>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'reviews' && (
              <motion.div
                key="reviews"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {receivedRatings.length === 0 ? (
                  <p className="text-gray-400 font-bold p-10 text-center col-span-2">No reviews yet. Be a great buddy to earn stars!</p>
                ) : (
                  receivedRatings.map((ratingItem: any) => (
                    <div key={ratingItem.id} className="bg-white rounded-3xl p-8 border border-gray-100 relative shadow-sm">
                      <div className="absolute top-8 right-8 flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={10} className={i < (ratingItem.score || 0) ? 'text-[#FFC107] fill-primary' : 'text-gray-100'} />
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center font-black text-gray-400 text-xs">
                          {ratingItem.rater_name?.charAt(0) || 'R'}
                        </div>
                        <div>
                          <h4 className="font-black text-[#121212] tracking-tighter text-sm">{ratingItem.rater_name || 'Rider'}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date(ratingItem.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {ratingItem.comments && (
                        <p className="text-sm font-medium text-gray-500 italic leading-relaxed">
                          "{ratingItem.comments}"
                        </p>
                      )}
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </motion.div>
  );
};

export default Profile;