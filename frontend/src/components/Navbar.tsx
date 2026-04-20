import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogOut, User } from 'lucide-react';

/** Simple solid car profile icon */
function TaxiLogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="#FFC107"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M19.44 10.12L16.29 5.4A2.99 2.99 0 0 0 13.8 4H8.54C7.27 4 6.16 4.79 5.68 5.96L3.34 11.66A2 2 0 0 0 3 12v3a2 2 0 0 0 2 2h1.22a3 3 0 0 0 5.56 0h4.44a3 3 0 0 0 5.56 0H20a2 2 0 0 0 2-2v-2a2 2 0 0 0-.66-1.5L19.44 10.12zM7.5 17a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM6 10L7.5 6.4C7.66 6.01 8.03 5.75 8.45 5.75H13l2.84 4.25H6z" />
      <path d="M10 2h3v2h-3z" />
    </svg>
  );
}
const Navbar = ({ session, compact = false }: { session: any; compact?: boolean }) => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`sticky top-0 z-50 w-full bg-white/80 backdrop-blur-lg border-b border-gray-100 px-6 ${compact ? 'py-2.5' : 'py-4'}`}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-[#121212] flex items-center justify-center rounded-xl transform group-hover:rotate-12 transition-transform duration-300">
            <TaxiLogoMark className="w-[30px] h-[30px] shrink-0" />
          </div>
          <span className="text-2xl font-black tracking-tighter text-[#121212]">
            Route<span className="text-[#FFC107]">Mate</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-sm font-bold text-gray-500 hover:text-[#121212] transition-colors">Dashboard</Link>
          <Link to="/security" className="text-sm font-bold text-gray-500 hover:text-[#121212] transition-colors">Safety Center</Link>
          <Link to="/how-it-works" className="text-sm font-bold text-gray-500 hover:text-[#121212] transition-colors">How it works</Link>
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-4">
          {session ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl font-bold text-sm hover:bg-white hover:shadow-lg transition-all"
              >
                <User size={18} />
                <span>Profile</span>
              </button>
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="btn-primary"
            >
              Get Started
            </button>
          )}
        </div>

        {/* Mobile Actions */}
        <div className="flex md:hidden items-center gap-4">
          {!session && (
            <button
              onClick={() => navigate('/auth')}
              className="px-4 py-2 bg-[#FFC107] text-[#121212] rounded-xl font-bold text-sm hover:shadow-lg transition-all"
            >
              Get Started
            </button>
          )}
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
