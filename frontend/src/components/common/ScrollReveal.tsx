import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
}

export default function ScrollReveal({
  children,
  delay = 0,
  direction = 'up',
  className = '',
}: ScrollRevealProps) {
  const getVariants = () => {
    switch (direction) {
      case 'up':
        return { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
      case 'down':
        return { hidden: { opacity: 0, y: -16 }, visible: { opacity: 1, y: 0 } };
      case 'left':
        return { hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0 } };
      case 'right':
        return { hidden: { opacity: 0, x: 16 }, visible: { opacity: 1, x: 0 } };
      case 'none':
        return { hidden: { opacity: 0 }, visible: { opacity: 1 } };
      default:
        return { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
    }
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      transition={{
        duration: 0.55,
        delay: delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      variants={getVariants()}
      className={className}
    >
      {children}
    </motion.div>
  );
}