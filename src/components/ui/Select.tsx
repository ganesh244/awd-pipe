import React, { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, icon, className = '', children, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
            {icon}
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition ${
            error ? 'border-red-500' : 'border-slate-300'
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && <p role="alert" className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
