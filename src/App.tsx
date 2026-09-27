import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { ToastHost } from './components/ui';
import { HomeScreen } from './screens/HomeScreen';
import { TrainScreen } from './screens/TrainScreen';
import { PlayScreen } from './screens/PlayScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { LearnScreen } from './screens/LearnScreen';
import { StyleguideScreen } from './screens/StyleguideScreen';

export default function App() {
  const location = useLocation();
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative mx-auto min-h-full max-w-[430px]">
        <ToastHost />
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="pt-safe px-4 pb-32"
          >
            <div className="pt-4">
              <Routes location={location}>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/train" element={<TrainScreen />} />
                <Route path="/play" element={<PlayScreen />} />
                <Route path="/review" element={<ReviewScreen />} />
                <Route path="/learn" element={<LearnScreen />} />
                <Route path="/styleguide" element={<StyleguideScreen />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </motion.main>
        </AnimatePresence>
        <TabBar />
      </div>
    </MotionConfig>
  );
}
