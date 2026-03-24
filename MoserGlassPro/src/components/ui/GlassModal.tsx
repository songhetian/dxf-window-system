import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { GlassCard, GlassButton } from './GlassBase';

interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const GlassModal = ({ isOpen, onClose, title, children, footer }: GlassModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 背景遮罩 - 使用 GPU 加速的 blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          
          {/* 模态框主体 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg z-10"
          >
            <GlassCard className="bg-[#1a1c24] border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] p-0 overflow-hidden">
              {/* 头部 */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <button 
                  onClick={onClose}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white/40" />
                </button>
              </div>

              {/* 内容区 */}
              <div className="p-6">
                {children}
              </div>

              {/* 底部按钮区 */}
              {footer && (
                <div className="px-6 py-4 bg-black/20 flex justify-end gap-3">
                  {footer}
                </div>
              )}
            </GlassCard>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
