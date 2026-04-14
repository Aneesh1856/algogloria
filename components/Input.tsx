import React, { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col space-y-2 w-full">
        {label && (
          <label className="text-[#002D62] text-[12px] font-bold uppercase tracking-[0.1em] mb-0.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#002D62]/40">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
            bg-white border-2 border-[#e9ecef] rounded-none px-4 py-3 min-h-[44px]
            text-[#333333] font-medium placeholder-gray-400 focus:outline-none 
            focus:border-[#FFC300] focus:ring-0
            transition-all w-full text-base md:text-sm
              ${icon ? 'pl-11' : ''}
              ${error ? 'border-[#dc3545]' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && <span className="text-[#dc3545] text-[10px] mt-1 font-bold uppercase tracking-wider">{error}</span>}
      </div>
    );
  }
);


Input.displayName = 'Input';
