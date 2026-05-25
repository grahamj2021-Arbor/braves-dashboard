export default function LiveGameCard() {
  return (
    <div className="bg-[#1E3A6E] rounded-3xl p-12 text-center border border-[#CE1141]/30">
      <div className="text-gray-400 text-lg mb-3">TODAY'S GAME</div>
      <div className="text-6xl font-bold mb-4">NO GAME TODAY</div>
      <div className="text-[#EAAA00] text-2xl">Check back tomorrow!</div>
    </div>
  );
}