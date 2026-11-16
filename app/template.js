"use client";
import { motion } from "framer-motion";

// Subtle page transition on every navigation (respects reduced-motion through MotionConfig).
export default function Template({ children }) {
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>{children}</motion.div>;
}
