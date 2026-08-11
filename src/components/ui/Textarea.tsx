import React, { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
            {icon}
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition min-h-[80px] ${
            error ? 'border-red-500' : 'border-slate-300'
          } ${className}`}
          {...props}
        />
        {error && <p role="alert" className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
