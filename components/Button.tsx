import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseClasses = "font-bold p-[12px_20px] min-h-[44px] rounded-btn transition-all flex items-center justify-center space-x-2 transform active:scale-[0.97] active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm tracking-[0.5px] border-none";
  
  const variants = {
    primary: "bg-[#FFC300] hover:bg-[#e6b300] text-[#002D62] shadow-sm hover:-translate-y-0.5 hover:shadow-amity",
    secondary: "bg-[#002D62] hover:bg-[#003d85] text-white shadow-sm hover:-translate-y-0.5 hover:shadow-amity",
    outline: "bg-transparent border-2 border-[#FFC300] text-[#FFC300] hover:bg-[#FFC300]/10",
    danger: "bg-[#dc3545] hover:bg-[#c82333] text-white shadow-sm hover:-translate-y-0.5 hover:shadow-amity",
    success: "bg-[#28a745] hover:bg-[#218838] text-white shadow-sm hover:-translate-y-0.5 hover:shadow-amity"
  };


  const widthClass = fullWidth ? "w-full" : "w-full sm:w-auto";

  return (
    <button 
      className={`${baseClasses} ${variants[variant]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
