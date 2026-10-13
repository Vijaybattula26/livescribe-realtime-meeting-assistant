import React from 'react';
import { Mic } from 'lucide-react';

interface AudioLevelMeterProps {
  level: number; // 0 to 1
  isActive: boolean;
}

export const AudioLevelMeter: React.FC<AudioLevelMeterProps> = ({ level, isActive }) => {
  // 10 segments for the meter
  const segments = 10;
  const activeSegments = isActive ? Math.round(level * segments) : 0;

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs"
      title={isActive ? `Mic Input Level: ${Math.round(level * 100)}%` : 'Mic Inactive'}
    >
      <Mic
        className={`w-3.5 h-3.5 ${
          isActive
            ? level > 0.05
              ? 'text-emerald-500 animate-pulse'
              : 'text-slate-500 dark:text-slate-400'
            : 'text-slate-400 dark:text-slate-600'
        }`}
      />
      <div className="flex items-center gap-0.5 h-3">
        {Array.from({ length: segments }).map((_, i) => {
          const isLit = i < activeSegments;
          let colorClass = 'bg-slate-300 dark:bg-slate-700';

          if (isLit) {
            if (i < 6) {
              colorClass = 'bg-emerald-500';
            } else if (i < 8) {
              colorClass = 'bg-amber-500';
            } else {
              colorClass = 'bg-rose-500';
            }
          }

          return (
            <div
              key={i}
              className={`w-1 rounded-sm transition-all duration-75 ${colorClass}`}
              style={{
                height: `${Math.max(4, (i + 1) * 1.2)}px`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
