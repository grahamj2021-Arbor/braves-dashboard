export default function Last10() {
  return (
    <div className="bg-[#1E3A6E] rounded-3xl p-8">
      <h3 className="text-[#EAAA00] text-xl font-semibold mb-6">LAST 10 GAMES</h3>
      <div className="space-y-3">
        {[
          { opp: "vs PHI", result: "W", score: "7-3" },
          { opp: "@ NYM", result: "L", score: "4-5" },
          { opp: "vs WSH", result: "W", score: "8-2" },
          { opp: "@ MIA", result: "W", score: "6-1" },
        ].map((game, i) => (
          <div key={i} className="flex justify-between bg-[#13274F] rounded-2xl px-6 py-4">
            <span>{game.opp}</span>
            <span className={`font-bold ${game.result === 'W' ? 'text-[#EAAA00]' : 'text-red-400'}`}>
              {game.result} {game.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}