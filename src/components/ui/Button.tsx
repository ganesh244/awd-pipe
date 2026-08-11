import React, { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  let baseClass = 'inline-flex items-center justify-center gap-2 font-bold transition shadow-sm active:scale-[0.98] outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm px-4 py-2 min-h-[44px] ';
  
  if (fullWidth) {
    baseClass += 'w-full ';
  }

  switch (variant) {
    case 'primary':
      baseClass += 'bg-emerald-700 hover:bg-emerald-800 text-white focus:ring-emerald-500 border border-transparent';
      break;
    case 'secondary':
      baseClass += 'bg-white hover:bg-slate-50 text-slate-700 focus:ring-slate-400 border border-slate-300';
      break;
    case 'danger':
      baseClass += 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 border border-transparent';
      break;
    case 'ghost':
      baseClass += 'bg-transparent hover:bg-slate-100 text-slate-700 shadow-none border border-transparent';
      break;
  }

  return (
    <button className={`${baseClass} ${className}`} {...props}>
      {children}
    </button>
  );
};
