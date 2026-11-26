'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { INTRO_DONE_EVENT, INTRO_STORAGE_KEY } from './PrivacyShield';

const editorialItem = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.34,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

/**
 * Synchronized Staggered Reveal container:
 * - On first session load (while <ShieldPreloader /> is parting), triggers right at 0.85s
 *   (or immediately if the user clicks "Passer").
 * - On subsequent renders / reloads in the same session, triggers immediately (0.02s).
 */
export function EditorialStagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alreadySeen = false;
    try {
      alreadySeen = Boolean(
        window.sessionStorage.getItem(INTRO_STORAGE_KEY) ||
          document.documentElement.dataset.introSeen === '1'
      );
    } catch {
      alreadySeen = false;
    }

    if (alreadySeen) {
      setReady(true);
      return;
    }

    // Trigger cascade at 0.85s right as the shield doors slide open
    const timer = window.setTimeout(() => setReady(true), 850);
    const onSkipOrDone = () => {
      window.clearTimeout(timer);
      setReady(true);
    };

    window.addEventListener(INTRO_DONE_EVENT, onSkipOrDone);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(INTRO_DONE_EVENT, onSkipOrDone);
    };
  }, []);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.04,
            delayChildren: 0.02,
          },
        },
      }}
      initial="hidden"
      animate={ready ? 'visible' : 'hidden'}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function EditorialBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={editorialItem} className={cn(className)}>
      {children}
    </motion.div>
  );
}
