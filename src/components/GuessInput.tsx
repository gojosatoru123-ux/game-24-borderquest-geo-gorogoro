import React, { useState, useMemo } from 'react';
import { Search, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface GuessInputProps {
  options: string[];
  onGuess: (guess: string) => void;
  disabled?: boolean;
}

export const GuessInput: React.FC<GuessInputProps> = ({ options, onGuess, disabled }) => {
  const [value, setValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    if (!value.trim()) return [];
    return options
      .filter(opt => opt.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 5);
  }, [value, options]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim() && !disabled) {
      onGuess(value.trim());
      setValue('');
      setShowSuggestions(false);
    }
  };

  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="w-full max-w-md mx-auto relative px-4">
      <form onSubmit={handleSubmit} className="relative group flex gap-3">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              setShowSuggestions(true);
              // Slight delay handles iOS/Android keyboard animation timings
              setTimeout(() => {
                inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 300);
            }}
            disabled={disabled}
            placeholder="Type your guess..."
            className={cn(
              "w-full h-14 bg-white/70 backdrop-blur-xl border border-white/80 rounded-2xl px-12",
              "text-text-dark placeholder:text-text-dark/40 font-medium outline-none shadow-sm",
              "focus:ring-2 focus:ring-turquoise/40 focus:border-turquoise transition-all duration-300",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dark/40 group-focus-within:text-turquoise transition-colors" size={20} />
        </div>
        
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="h-14 px-8 rounded-2xl bg-coral hover:bg-coral/90 shadow-md hover:shadow-lg text-white font-semibold text-sm tracking-wide transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit
        </button>
      </form>

      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="absolute z-50 w-full bottom-[calc(100%+0.75rem)] left-0 bg-white/90 backdrop-blur-3xl border border-white rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.06)] overflow-hidden"
          >
            <div className="max-h-60 overflow-y-auto customize-scrollbar p-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setValue(suggestion);
                    setShowSuggestions(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl hover:bg-black/5 text-text-dark font-medium tracking-wide text-sm transition-colors",
                    index !== suggestions.length - 1 && "mb-1"
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
