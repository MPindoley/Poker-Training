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
import { DebugEquityScreen } from './screens/DebugEquityScreen';
import { MathTrainerScreen } from './screens/train/MathTrainerScreen';
import { MathDrillScreen } from './screens/train/MathDrillScreen';
import { CheatSheetScreen } from './screens/train/CheatSheetScreen';
import { PreflopTrainerScreen } from './screens/train/PreflopTrainerScreen';
import { PreflopDrillScreen } from './screens/train/PreflopDrillScreen';
import { PaintRangeScreen } from './screens/train/PaintRangeScreen';
import { RangeEditorScreen } from './screens/train/RangeEditorScreen';
import { PostflopTrainerScreen } from './screens/train/PostflopTrainerScreen';
import { PostflopDrillScreen } from './screens/train/PostflopDrillScreen';
import { ReplaySpotScreen } from './screens/train/ReplaySpotScreen';
import { ExploitLabScreen } from './screens/exploit/ExploitLabScreen';
import { ProfileEditorScreen } from './screens/exploit/ProfileEditorScreen';
import { ExploitDrillScreen } from './screens/exploit/ExploitDrillScreen';
import { TableScreen } from './screens/play/TableScreen';
import { SessionSummaryScreen } from './screens/play/SessionSummaryScreen';

/** Full-screen routes (drills, the table) hide the tab bar so nothing covers the controls. */
const IMMERSIVE = [/^\/train\/[^/]+\/play/, /^\/play\/table/];

export default function App() {
  const location = useLocation();
  const immersive = IMMERSIVE.some((re) => re.test(location.pathname));
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
            className={`pt-safe px-4 ${immersive ? 'pb-safe' : 'pb-32'}`}
          >
            <div className="pt-4">
              <Routes location={location}>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/train" element={<TrainScreen />} />
                <Route path="/train/math" element={<MathTrainerScreen />} />
                <Route path="/train/math/play" element={<MathDrillScreen />} />
                <Route path="/train/math/cheatsheet" element={<CheatSheetScreen />} />
                <Route path="/train/preflop" element={<PreflopTrainerScreen />} />
                <Route path="/train/preflop/play" element={<PreflopDrillScreen />} />
                <Route path="/train/preflop/paint" element={<PaintRangeScreen />} />
                <Route path="/train/preflop/editor" element={<RangeEditorScreen />} />
                <Route path="/train/postflop" element={<PostflopTrainerScreen />} />
                <Route path="/train/postflop/play" element={<PostflopDrillScreen />} />
                <Route path="/train/postflop/replay" element={<ReplaySpotScreen />} />
                <Route path="/train/exploit" element={<ExploitLabScreen />} />
                <Route path="/train/exploit/profile/:id" element={<ProfileEditorScreen />} />
                <Route path="/train/exploit/play" element={<ExploitDrillScreen />} />
                <Route path="/play" element={<PlayScreen />} />
                <Route path="/play/table" element={<TableScreen />} />
                <Route path="/play/summary" element={<SessionSummaryScreen />} />
                <Route path="/review" element={<ReviewScreen />} />
                <Route path="/learn" element={<LearnScreen />} />
                <Route path="/styleguide" element={<StyleguideScreen />} />
                <Route path="/debug/equity" element={<DebugEquityScreen />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </motion.main>
        </AnimatePresence>
        {!immersive && <TabBar />}
      </div>
    </MotionConfig>
  );
}
