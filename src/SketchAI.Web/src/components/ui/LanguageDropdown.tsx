import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DropdownArrowIcon } from "./Icons";

// Available languages for translation
const LANGUAGES = [
  "English",
  "French",
  "Spanish",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Polish",
  "Russian",
  "Japanese",
  "Korean",
  "Chinese",
  "Arabic",
] as const;

interface LanguageDropdownProps {
  value: string;
  onChange: (language: string) => void;
  className?: string;
}

export function LanguageDropdown({ value, onChange, className }: LanguageDropdownProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (languageName: string) => {
    onChange(languageName);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            "bg-card-border/60 border-2 border-primary/40 hover:border-primary/60",
            "focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none",
            "text-white cursor-pointer",
            className
          )}
        >
          <span>{value}</span>
          <DropdownArrowIcon
            size={16}
            className={cn(
              "text-primary transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className={cn(
            "z-300 w-40 max-h-64 overflow-y-auto rounded-lg",
            "bg-card border-2 border-card-border shadow-xl",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          )}
        >
          <div className="py-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => handleSelect(lang)}
                className={cn(
                  "w-full flex items-center px-3 py-2 text-sm transition-colors duration-150",
                  value === lang
                    ? "bg-primary/20 text-white"
                    : "text-white/80 hover:bg-card-border/60 hover:text-white"
                )}
              >
                <span>{lang}</span>
                {value === lang && (
                  <span className="ml-auto text-primary">✓</span>
                )}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
