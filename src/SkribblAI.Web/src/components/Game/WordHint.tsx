interface WordHintProps {
  hint?: string;
}

export default function WordHint({ hint = "_ _ _ _ _" }: WordHintProps) {
  return (
    <div className="bg-[#0D1B2A] rounded-xl p-2 sm:p-3 mb-2 sm:mb-3 text-center border-2 border-[#2A3F54] shrink-0">
      <p className="text-white/60 text-xs sm:text-sm">DRAW THIS:</p>
      <p className="text-[#FFC71E] text-xl sm:text-2xl font-bold tracking-widest">
        {hint}
      </p>
    </div>
  );
}
