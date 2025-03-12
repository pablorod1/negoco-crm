"use client";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface FeatureItemProps {
  icon: LucideIcon;
  text: string;
  delay: number;
}

export default function FeatureItem({
  icon: Icon,
  text,
  delay,
}: FeatureItemProps) {
  return (
    <motion.div
      className="flex items-center space-x-4 mb-4"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.6,
        delay: delay,
        ease: "easeOut",
      }}
    >
      <motion.div
        className="bg-white/20 p-2 rounded-full"
        whileHover={{
          scale: 1.1,
          backgroundColor: "rgba(255, 255, 255, 0.3)",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
      >
        <Icon className="text-white" size={24} />
      </motion.div>
      <motion.span
        className="text-lg"
        whileHover={{ x: 5 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        {text}
      </motion.span>
    </motion.div>
  );
}
