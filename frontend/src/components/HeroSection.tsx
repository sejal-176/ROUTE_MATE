import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HeroSection = ({ onExploreClick }: { onExploreClick: () => void }) => {
  const navigate = useNavigate();

  return (
    <section className="relative w-full overflow-hidden bg-white pt-10 pb-0 md:pt-16 md:pb-1">
      {/* Background Taxi Animation */}
      <div className="absolute top-1/2 left-0 w-full h-32 -translate-y-1/2 pointer-events-none opacity-10 hidden md:block">
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="flex items-center gap-2 text-[#121212]"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 shrink-0" aria-hidden="true">
            <path d="M19.44 10.12L16.29 5.4A2.99 2.99 0 0 0 13.8 4H8.54C7.27 4 6.16 4.79 5.68 5.96L3.34 11.66A2 2 0 0 0 3 12v3a2 2 0 0 0 2 2h1.22a3 3 0 0 0 5.56 0h4.44a3 3 0 0 0 5.56 0H20a2 2 0 0 0 2-2v-2a2 2 0 0 0-.66-1.5L19.44 10.12zM7.5 17a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM6 10L7.5 6.4C7.66 6.01 8.03 5.75 8.45 5.75H13l2.84 4.25H6z" />
            <path d="M10 2h3v2h-3z" />
          </svg>
          <div className="h-1 w-64 bg-current rounded-full opacity-20" />
        </motion.div>
      </div>

      <div className="container mx-auto px-6 relative z-10 text-center flex flex-col items-center">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.05 }}
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-[#121212] tracking-tighter leading-[0.95] mb-3"
        >
          Strangers today, <br />
          <span className="text-[#FFC107] italic">ride buddies</span> <br />
          tomorrow.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-gray-500 font-medium text-sm md:text-base max-w-2xl mb-3"
        >
          Join a smart, affordable, and social community of commuters.
          Find verified ride pools heading your way in seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto justify-center"
        >
          <button
            onClick={onExploreClick}
            className="btn-primary text-base px-8 py-3 group"
          >
            Find a Ride
            <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => navigate('/learn-more')}
            className="btn-outline text-base px-8 py-3"
          >
            Learn More
          </button>
        </motion.div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#FFC107]/5 rounded-full blur-3xl" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#FFC107]/5 rounded-full blur-3xl" />
    </section>
  );
};

export default HeroSection;
