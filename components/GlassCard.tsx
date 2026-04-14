import React from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  headerType?: 'primary' | 'accent';
  headerText?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = "", 
  headerType, 
  headerText, 
  ...props 
}) => {
  return (
    <div
      className={`bg-white rounded-none shadow-amity border border-[#e9ecef] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_25px_rgba(0,0,0,0.2)] flex flex-col w-full overflow-hidden ${className}`}
      {...props}
    >
      {headerText && (
        <div className={`p-4 font-bold uppercase tracking-wider text-sm ${
          headerType === 'accent' ? 'bg-[#FFC300] text-[#002D62]' : 'bg-[#002D62] text-white'
        }`}>
          {headerText}
        </div>
      )}
      <div className="p-4 sm:p-6 flex-grow">
        {children}
      </div>
    </div>
  );
};
