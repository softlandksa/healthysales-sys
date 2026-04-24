import type { Variants } from "framer-motion";

// Guard for prefers-reduced-motion — use in components:
// const shouldReduceMotion = useReducedMotion();
// Then pass `shouldReduceMotion ? {} : variants` to motion components.

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
  exit:   { opacity: 0, transition: { duration: 0.15 } },
};

export const slideInRtl: Variants = {
  hidden:  { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, x: -16, transition: { duration: 0.15 } },
};

export const slideUp: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

// Page-level transition: use with AnimatePresence mode="wait"
export const pageTransition: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.15 } },
};

// Stagger container — wrap a list; children get staggered entrance
export const staggerContainer: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

// Stagger item — use on each child inside staggerContainer
export const staggerItem: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

// Card hover lift — use with whileHover
export const cardHoverLift = {
  y: -2,
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  transition: { duration: 0.18, ease: "easeOut" },
};

// Button press — use with whileTap
export const buttonPress = { scale: 0.98 };

// Drawer/modal entrance from bottom (mobile)
export const drawerUp: Variants = {
  hidden:  { y: "100%", opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 30, stiffness: 350 } },
  exit:    { y: "100%", opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
};
