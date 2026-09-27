import { motion } from 'framer-motion';

/** Shown for the moment it takes to load saved progress from IndexedDB. */
export function SplashScreen() {
  return (
    <div className="grid min-h-full place-items-center" role="status" aria-label="Loading">
      <div className="text-center">
        <motion.div
          className="mx-auto flex gap-1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block h-14 w-10 rounded-lg border-[3px] border-ink bg-gradient-to-b from-white to-cream shadow-chunky-sm"
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.12 }}
            />
          ))}
        </motion.div>
        <div className="text-outline mt-4 font-display text-3xl text-gold-300">Felt Academy</div>
      </div>
    </div>
  );
}
