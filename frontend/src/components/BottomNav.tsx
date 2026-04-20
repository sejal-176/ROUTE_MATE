import { motion } from 'framer-motion';
import { Home, Search, Calendar, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const BottomNav = ({ session }: { session: any }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/' },
    { id: 'search', icon: Search, label: 'Search', path: '/#search' },
    { id: 'rides', icon: Calendar, label: 'Rides', path: '/profile?view=rides' }, 
    { id: 'profile', icon: User, label: 'Profile', path: '/profile?view=profile' },
  ];

  const handleNav = (path: string) => {
    if (path.startsWith('/#')) {
      const element = document.getElementById(path.split('#')[1]);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate('/');
        // Wait for page load if needed
        setTimeout(() => {
          document.getElementById(path.split('#')[1])?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      if ((path.includes('/profile')) && !session) {
        navigate('/auth');
      } else {
        navigate(path);
      }
    }
  };

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="md:hidden fixed bottom-0 left-0 w-full bg-white border-top border-gray-100 px-6 py-3 flex justify-between items-center z-50 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]"
    >
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.id}
            onClick={() => handleNav(item.path)}
            className="flex flex-col items-center gap-1 relative"
          >
            <item.icon
              size={24}
              className={`transition-colors duration-300 ${isActive ? 'text-[#FFC107]' : 'text-gray-400'}`}
            />
            <span className={`text-[10px] font-bold ${isActive ? 'text-[#121212]' : 'text-gray-400'}`}>
              {item.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="active-tab"
                className="absolute -top-1 w-1 h-1 bg-[#FFC107] rounded-full"
              />
            )}
          </button>
        );
      })}
    </motion.div>
  );
};

export default BottomNav;
