'use client';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0A1428] text-white">
      {/* Professional Braves Navbar */}
      <nav className="bg-[#13274F] border-b-2 border-[#CE1141] px-8 py-5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="https://www.mlbstatic.com/team-logos/144.svg" 
              alt="Braves Logo" 
              className="h-12" 
            />
            <div>
              <div className="text-4xl font-black tracking-tighter">ATLANTA BRAVES</div>
              <div className="text-[#EAAA00] text-xs tracking-[3px] -mt-1">2026 LIVE DASHBOARD</div>
            </div>
          </div>

          <div className="flex items-center gap-10 text-sm font-medium">
            <a href="#" className="hover:text-[#EAAA00]">DASHBOARD</a>
            <a href="#" className="hover:text-[#EAAA00]">SCHEDULE</a>
            <a href="#" className="hover:text-[#EAAA00]">ROSTER</a>
            <a href="#" className="hover:text-[#EAAA00]">STATS</a>
            <a href="#" className="hover:text-[#EAAA00]">NEWS</a>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-3xl font-bold text-[#EAAA00]">36-18</div>
              <div className="text-xs text-gray-400">1ST • NL EAST</div>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="bg-[#CE1141] hover:bg-[#EAAA00] hover:text-[#13274F] px-6 py-3 rounded-2xl font-bold transition-all"
            >
              REFRESH DATA
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-12">
        <h1 className="text-5xl font-black text-center mb-12 text-[#EAAA00]">BRAVES DASHBOARD</h1>

        <div className="grid grid-cols-12 gap-8">
          {/* Main Area */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="bg-[#1E3A6E] rounded-3xl p-16 text-center">
              <div className="text-6xl mb-6">⚾</div>
              <div className="text-5xl font-bold mb-4">NO GAME TODAY</div>
              <div className="text-[#EAAA00] text-2xl">Check back tomorrow for live updates!</div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="bg-[#1E3A6E] rounded-3xl p-8 text-center">
              <h3 className="text-[#EAAA00] text-xl mb-6">NEXT GAME</h3>
              <div className="text-3xl font-bold">vs New York Mets</div>
              <div className="text-7xl font-black text-[#EAAA00] my-8">76%</div>
              <div className="text-gray-400">Tomorrow • 7:20 PM • Truist Park</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}