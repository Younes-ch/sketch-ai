const steps = [
  { icon: "🎨", text: "One player draws" },
  { icon: "💬", text: "Others guess the word" },
  { icon: "⚡", text: "Fast guesses = more points" },
  { icon: "🤖", text: "AI joins the fun!" },
];

export default function HowToPlay() {
  return (
    <div className="mt-6 bg-card/80 rounded-2xl p-5 border-2 border-card-border">
      <h3 className="text-white font-bold text-lg mb-3 text-center">
        📖 How to Play
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {steps.map((step, index) => (
          <div key={index} className="bg-background rounded-xl p-3 text-center">
            <div className="text-2xl mb-1">{step.icon}</div>
            <p className="text-white/80 text-sm font-medium">{step.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
