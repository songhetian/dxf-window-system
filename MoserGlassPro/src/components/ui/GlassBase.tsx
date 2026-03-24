import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GlassCard = ({ children, className, interactive = true }: any) => (
  <div className={cn(
    "bg-[#0a0a0a] border border-white/[0.03] rounded-[2rem] shadow-2xl",
    interactive && "hover:border-blue-500/20 transition-all duration-500",
    className
  )}>
    {children}
  </div>
);

export const GlassButton = ({ 
  children, onClick, className, variant = 'primary', size = 'md' 
}: any) => {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.15)]",
    secondary: "bg-white/[0.02] border border-white/[0.05] text-slate-400 hover:text-white hover:bg-white/[0.05]",
    danger: "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20",
    ghost: "bg-transparent text-slate-500 hover:text-white"
  };
  
  const sizes = {
    sm: "px-4 py-2 text-[10px]",
    md: "px-6 py-3 text-xs",
    lg: "px-8 py-4 text-sm"
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2",
        variants[variant as keyof typeof variants],
        sizes[size as keyof typeof sizes],
        className
      )}
    >
      {children}
    </button>
  );
};

export const Input = ({ className, label, ...props }: any) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-4">{label}</label>}
    <input 
      className={cn(
        "bg-black/40 border border-white/[0.05] rounded-2xl px-5 py-3 text-sm font-bold text-white focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.02] transition-all w-full placeholder:text-slate-700",
        className
      )}
      {...props}
    />
  </div>
);