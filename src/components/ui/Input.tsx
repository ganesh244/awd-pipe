import React, { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
            {icon}
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition ${
            error ? 'border-red-500' : 'border-slate-300'
          } ${className}`}
          {...props}
        />
        {error && <p role="alert" className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
