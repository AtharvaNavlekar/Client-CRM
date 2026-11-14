import React from 'react';
import { Activity } from 'lucide-react';

export const AuthBrand: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex items-center space-x-2.5 ${className}`}>
      <div className="w-9 h-9 rounded-xl bg-[#075B65] flex items-center justify-center text-white shadow-sm ring-2 ring-[#075B65]/20">
        <Activity className="w-5 h-5 text-white stroke-[2.5]" />
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-tight text-slate-900 leading-none">
          Dial<span className="text-[#075B65]">Pulse</span>
        </span>
        <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5">
          Enterprise CRM
        </span>
      </div>
    </div>
  );
};
