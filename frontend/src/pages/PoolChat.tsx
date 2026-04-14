import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, User, Star, ArrowLeft, MessageCircle, ShieldCheck, ChevronRight, Clock } from 'lucide-react';

const PoolChat = () => {
  const { poolId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pool, setPool] = useState<any>(null);
  const [isMember, setIsMember] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [ratingModal, setRatingModal] = useState<{ open: boolean; target: any | null }>({ open: false, target: null });
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadPoolAndMembership = async () => {
    if (!poolId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUserId(user.id);
    const { data: poolData } = await supabase.from('pools').select('*').eq('id', poolId).single();
    if (!poolData) {
      setLoading(false);
      return;
    }

    setPool(poolData);
    await loadPoolParticipants(user.id, poolData.creator_id);
    const creator = poolData.creator_id === user.id;
    setIsCreator(creator);
    if (creator) {
      setIsMember(true);
    } else {
      const { data: acceptedRequests } = await supabase
        .from('pool_requests')
        .select('*')
        .eq('pool_id', poolId)
        .eq('requester_id', user.id)
        .eq('status', 'accepted');

      const acceptedCount = (acceptedRequests || []).length;
      setIsMember(acceptedCount > 0);
    }
    setLoading(false);
  };

  const loadPoolParticipants = async (currentUserIdValue: string, creatorId: string) => {
    try {
      const { data: acceptedRequests } = await supabase
        .from('pool_requests')
        .select('requester_id, user_profiles(name)')
        .eq('pool_id', poolId)
        .eq('status', 'accepted');

      const creatorProfile = await supabase
        .from('user_profiles')
        .select('id, name')
        .eq('id', creatorId)
        .single();

      const people: any[] = [];
      if (creatorProfile.data && creatorProfile.data.id !== currentUserIdValue) {
        people.push({ id: creatorProfile.data.id, name: creatorProfile.data.name || 'Creator', isCreator: true });
      }

      (acceptedRequests || []).forEach((req: any) => {
        if (req.requester_id !== currentUserIdValue) {
          people.push({ id: req.requester_id, name: req.user_profiles?.name || 'Rider', isCreator: false });
        }
      });

      setParticipants(people);
    } catch (error) {
      console.error('Failed to load pool participants', error);
    }
  };

  const openRatingModal = (participant: any) => {
    setRatingScore(0);
    setRatingComment('');
    setRatingModal({ open: true, target: participant });
  };

  const submitPersonRating = async () => {
    if (!ratingModal.target || !currentUserId) return;
    setRatingSubmitting(true);
    try {
      const { error } = await supabase.from('ratings').insert([{
        rater_id: currentUserId,
        ratee_id: ratingModal.target.id,
        score: ratingScore,
        comments: ratingComment || null
      }]);

      if (!error) {
        setRatingModal({ open: false, target: null });
      } else {
        alert('Could not save rating.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRatingSubmitting(false);
    }
  };

  useEffect(() => { loadPoolAndMembership(); }, [poolId]);

  useEffect(() => {
    if (!poolId) return;
    const fetchMessages = async () => {
      const { data } = await supabase.from('pool_messages').select(`*, user_profiles(name)`).eq('pool_id', poolId).order('created_at', { ascending: true });
      if (data) setMessages(data);
    };
    fetchMessages();

    const chatChannel = supabase.channel(`chat:${poolId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pool_messages', filter: `pool_id=eq.${poolId}` }, async (payload) => {
        const { data: profile } = await supabase.from('user_profiles').select('name').eq('id', payload.new.sender_id).single();
        setMessages((prev) => [...prev, { ...payload.new, user_profiles: profile }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(chatChannel); };
  }, [poolId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId || (!isMember && !isCreator)) return;
    const { error } = await supabase.from('pool_messages').insert({ pool_id: poolId, sender_id: currentUserId, message: newMessage.trim() });
    if (!error) setNewMessage('');
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8 h-[calc(100vh-100px)]"
    >
      {/* RATING MODAL */}
      <AnimatePresence>
        {ratingModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-[#121212]/95 z-[100] flex items-center justify-center p-6 backdrop-blur-sm"
          >
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm text-center shadow-2xl">
              <h3 className="text-2xl font-black text-[#121212] mb-6 tracking-tighter italic">Rate Buddy</h3>
              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s} size={32}
                    fill={ratingScore >= s ? '#FFC107' : 'none'}
                    className={`cursor-pointer ${ratingScore >= s ? 'text-[#FFC107]' : 'text-gray-200'}`}
                    onClick={() => setRatingScore(s)}
                  />
                ))}
              </div>
              <textarea
                className="input-premium mb-6 h-24"
                placeholder="Any feedback for this rider?"
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
              />
              <div className="flex gap-4">
                <button onClick={() => setRatingModal({ open: false, target: null })} className="flex-1 py-4 text-xs font-black uppercase text-gray-400">Cancel</button>
                <button onClick={submitPersonRating} disabled={ratingSubmitting} className="flex-1 btn-primary py-4">Save</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SIDEBAR: POOL INFO & PARTICIPANTS */}
      <aside className="lg:w-80 flex flex-col gap-6 shrink-0">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-lg">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs font-black text-gray-300 uppercase tracking-widest mb-8 hover:text-[#121212] transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
          <h2 className="text-2xl font-black text-[#121212] tracking-tighter mb-2">{pool.source_text?.split(',')[0]} <ChevronRight className="inline text-[#FFC107]" size={20} /></h2>
          <h2 className="text-2xl font-black text-[#121212] tracking-tighter mb-6">{pool.dest_text?.split(',')[0]}</h2>

          <div className="flex items-center gap-3 py-4 border-y border-gray-50 mb-8">
            <div className="w-10 h-10 bg-[#FFC107]/10 rounded-xl flex items-center justify-center text-[#FFC107]">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400">Departure</p>
              <p className="text-sm font-bold text-[#121212]">{new Date(pool.time_window_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Buddies in Car</p>
            {participants.length === 0 ? (
              <p className="text-xs font-bold text-gray-300 italic">No other buddies yet.</p>
            ) : (
              participants.map(p => (
                <div key={p.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-300">
                      <User size={16} />
                    </div>
                    <span className="text-sm font-bold text-[#121212]">{p.name || 'Member'}</span>
                  </div>
                  <button onClick={() => openRatingModal(p)} className="p-2 opacity-0 group-hover:opacity-100 text-[#FFC107] hover:scale-110 transition-all">
                    <Star size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* MAIN: CHAT AREA */}
      {(!isMember && !isCreator) ? (
         <main className="flex-1 bg-white rounded-3xl border border-gray-100 shadow-lg flex flex-col items-center justify-center relative p-8 text-center text-gray-400">
           <ShieldCheck size={64} className="text-gray-200 mb-4" />
           <h3 className="text-2xl font-black text-[#121212] tracking-tighter mb-2">Access Restricted</h3>
           <p className="font-bold text-sm">Join this pool and wait for the captain's approval to enter the chat.</p>
         </main>
      ) : (
      <main className="flex-1 bg-white rounded-3xl border border-gray-100 shadow-lg flex flex-col overflow-hidden relative">
        <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#121212] rounded-xl flex items-center justify-center text-[#FFC107]">
              <MessageCircle size={20} />
            </div>
            <div>
              <h4 className="font-black text-[#121212] tracking-tight">Pool Hangout</h4>
              <p className="text-[10px] font-black uppercase text-[#FFC107] italic">Live Real-time</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-xs font-black text-gray-400">
            <ShieldCheck size={16} className="text-green-500" /> Secure
          </div>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar">
          {messages.map((msg, idx) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <motion.div
                initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={idx}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[80%] px-6 py-4 rounded-3xl font-medium text-sm shadow-sm ${isMe ? 'bg-[#121212] text-white rounded-tr-none' : 'bg-gray-50 text-[#121212] rounded-tl-none border border-gray-100'}`}>
                  {msg.message}
                </div>
                <span className="text-[9px] font-black uppercase text-gray-300 mt-2 px-2">
                  {isMe ? 'You' : msg.user_profiles?.name || 'Buddy'} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <form onSubmit={sendMessage} className="p-6 border-t border-gray-50 bg-white">
          <div className="relative">
            <input
              type="text"
              className="input-premium pr-16 h-16"
              placeholder="Say something to the group..."
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#FFC107] rounded-xl flex items-center justify-center text-[#121212] hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </main>
      )}
    </motion.div>
  );
};

export default PoolChat;