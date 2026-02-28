import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const pageVariants = {
  initial: { opacity: 0, y: 18, scale: 0.995, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, scale: 0.995, filter: 'blur(3px)' },
};

const pageTransition = {
  duration: 0.35,
  ease: [0.22, 1, 0.36, 1] as const,
};

export function AnimatedPage({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      style={{ willChange: 'opacity, transform, filter' }}
    >
      {children}
    </motion.div>
  );
}
