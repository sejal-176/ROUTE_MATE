import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, Phone, Lock, User, ArrowLeft, CheckCircle2, ChevronRight, Car } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');

  const [otpToken, setOtpToken] = useState('');
  const [isTokenSent, setIsTokenSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [isNewUser, setIsNewUser] = useState(false);
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');

  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from?.pathname || "/";

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    if (isNewUser) {
       if (!name.trim() || name.length < 2) {
          setMessage("Please enter a valid full name.");
          return;
       }
       if (!gender) {
          setMessage("Please select your gender.");
          return;
       }
    }

    setLoading(true);
    setMessage('');

    try {
      if (authMethod === 'email') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            data: { name, gender, phone_number: phone },
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        setMessage('An 6-digit OTP has been sent to your email!');
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          phone: phone,
          options: {
            data: { name, gender, email: email },
          }
        });
        if (error) throw error;
        setMessage('An 8-digit SMS code has been sent to your phone!');
      }

      setIsTokenSent(true);
    } catch (err: any) {
      setMessage(err.message);
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const code = otpToken.trim();
      if (!/^\d{6}$/.test(code)) {
        setMessage('Please enter the complete 8-digit code.');
        setLoading(false);
        return;
      }

      let verifyResult;
      if (authMethod === 'email') {
        verifyResult = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: 'email'
        });
      } else {
        verifyResult = await supabase.auth.verifyOtp({
          phone,
          token: code,
          type: 'sms'
        });
      }

      const { error, data } = verifyResult;
      if (error) throw error;

      if (data?.user) {
        await supabase.from('user_profiles').upsert({
          id: data.user.id,
          name: data.user.user_metadata?.name || name || 'User',
          gender: data.user.user_metadata?.gender || gender || 'Other',
          email: data.user.email || email,
          phone_number: data.user.phone || phone || '+910000000000'
        });
      }

      navigate(from, { replace: true });
    } catch (err: any) {
      setMessage(err.message);
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#121212] flex items-center justify-center p-6"
    >
      {/* Background Icon Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5">
        <Car size={300} className="absolute -bottom-20 -left-20 text-white rotate-12" />
        <Car size={200} className="absolute -top-10 -right-10 text-white -rotate-12" />
      </div>

      <motion.div
        initial={{ y: 20, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-[#FFC107] rounded-lg flex items-center justify-center">
              <Lock size={16} className="text-[#121212]" />
            </div>
            <span className="text-white font-black tracking-widest text-[10px] uppercase">Secure Access</span>
          </div>
          <h2 className="text-4xl font-black text-white tracking-tighter">
            {isNewUser ? 'Join the ' : 'Welcome back to '}
            <span className="text-[#FFC107] italic">RouteMate</span>
          </h2>
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
          <AnimatePresence mode="wait">
            {!isTokenSent ? (
              <motion.form
                key="auth-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleAuth}
                className="flex flex-col gap-6"
              >
                {/* Method Toggle */}
                <div className="flex p-1 bg-gray-100 rounded-2xl w-fit mx-auto mb-4">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('email')}
                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${authMethod === 'email' ? 'bg-white text-[#121212] shadow-sm' : 'text-gray-400'}`}
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMethod('phone')}
                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${authMethod === 'phone' ? 'bg-white text-[#121212] shadow-sm' : 'text-gray-400'}`}
                  >
                    Phone
                  </button>
                </div>

                <div className="flex flex-col gap-5">
                  {authMethod === 'email' ? (
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                        <input
                          type="email"
                          className="input-premium pl-12 bg-gray-50/50 border-gray-100"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Mobile Number</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                        <input
                          type="tel"
                          className="input-premium pl-12 bg-gray-50/50 border-gray-100"
                          placeholder="+91 00000 00000"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}

                  {isNewUser && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="flex flex-col gap-5"
                    >
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                          <input
                            type="text"
                            className="input-premium pl-12 bg-gray-50/50 border-gray-100"
                            placeholder="Rohan Sharma"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Gender</label>
                        <select
                          className="input-premium bg-gray-50/50 border-gray-100"
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          required
                        >
                          <option value="">Select...</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="flex flex-col gap-4 mt-4">
                  <button type="submit" disabled={loading} className="btn-primary w-full h-[60px] text-lg group">
                    {loading ? 'Sending...' : isNewUser ? 'Create Account' : 'Sign In'}
                    <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewUser(!isNewUser)}
                    className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-[#121212] transition-colors"
                  >
                    {isNewUser ? 'Already a buddy? Login' : 'New here? Join us'}
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.form
                key="otp-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyOtp}
                className="flex flex-col gap-8 text-center"
              >
                <div>
                  <div className="w-16 h-16 bg-[#FFC107]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-[#FFC107]" />
                  </div>
                  <h3 className="text-xl font-black text-[#121212] tracking-tight">Code Sent!</h3>
                  <p className="text-gray-400 text-sm font-medium">Please enter the 8-digit code we sent you.</p>
                </div>

                <div className="relative">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
                  <input
                    type="text"
                    className="w-full pl-16 pr-8 py-5 bg-gray-50 border border-gray-100 rounded-2xl text-2xl font-black tracking-[0.8em] text-center focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="000000"
                    maxLength={6}
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                  />
                </div>

                <div className="flex flex-col gap-4">
                  <button type="submit" disabled={loading} className="btn-primary w-full h-[60px] text-lg">
                    {loading ? 'Verifying...' : 'Finish & Drive'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTokenSent(false)}
                    className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-[#121212] transition-colors"
                  >
                    <ArrowLeft size={14} /> Change details
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {message && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-6 p-4 bg-[#FFC107]/10 border border-primary/20 rounded-2xl flex gap-3 items-center text-xs font-bold text-accent-yellow"
            >
              <div className="w-2 h-2 rounded-full bg-[#FFC107] animate-pulse" />
              {message}
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Auth;