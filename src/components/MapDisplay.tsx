import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3-geo';
import { motion, AnimatePresence } from 'motion/react';

interface MapDisplayProps {
  feature: any;
  isLoading?: boolean;
}

export const MapDisplay: React.FC<MapDisplayProps> = ({ feature, isLoading }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pathData = useMemo(() => {
    if (!feature) return null;

    // Use a standard projection but center and scale to the feature
    const projection = d3.geoMercator();
    const pathGenerator = d3.geoPath().projection(projection);

    // Initial pass to get bounds
    projection.fitSize([600, 600], feature);
    
    return pathGenerator(feature);
  }, [feature]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-square max-w-[500px] mx-auto flex items-center justify-center p-4 md:p-8"
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-12 h-12 border-4 border-turquoise/20 border-t-turquoise rounded-full animate-spin" />
            <p className="text-text-dark/50 font-mono text-[10px] uppercase tracking-widest font-bold">Triangulating...</p>
          </motion.div>
        ) : feature && pathData ? (
          <motion.svg
            key="map"
            ref={svgRef}
            viewBox="0 0 600 600"
            className="w-full h-full drop-shadow-xl"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <path
              d={pathData}
              className="fill-yellow/30 stroke-text-dark/80 stroke-[2] drop-shadow-sm"
              style={{
                strokeLinejoin: 'round',
                strokeLinecap: 'round'
              }}
            />
          </motion.svg>
        ) : (
          <div key="empty" className="text-text-dark/30 font-mono text-xs font-bold uppercase">No Map Link</div>
        )}
      </AnimatePresence>
      
      {/* Subtle corner marks as seen in techy designs but adapted to palette */}
      <div className="absolute inset-8 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-text-dark/50" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-text-dark/50" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-text-dark/50" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-text-dark/50" />
      </div>
    </div>
  );
};
