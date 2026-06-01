import { useState, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Listame los logs groups!",
}: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-white/[0.06] bg-[#0f1119]">
      <div className="p-4">
        <div className="max-w-4xl mx-auto flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "flex-1 bg-[#161923] text-[#e2e5f0] border border-white/[0.07] rounded-xl px-4 py-3",
              "placeholder:text-[#3d4560] focus:outline-none focus:ring-1 focus:ring-[#6b7af8]/50 focus:border-[#6b7af8]/40",
              "resize-none max-h-32 overflow-y-auto text-sm leading-relaxed",
              "transition-all duration-200",
              disabled && "opacity-40 cursor-not-allowed"
            )}
          />
          <Button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className={cn(
              "bg-[#6b7af8] hover:bg-[#7d8bfa] text-white px-4 py-3 rounded-xl",
              "transition-all duration-200 shadow-[0_0_12px_rgba(107,122,248,0.25)]",
              "hover:shadow-[0_0_18px_rgba(107,122,248,0.4)]",
              "disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
            )}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
