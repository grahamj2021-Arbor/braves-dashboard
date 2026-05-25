export default function StandingsTable() {
  return (
    <div className="bg-[#1E3A6E] rounded-3xl p-8">
      <h3 className="text-[#EAAA00] text-xl font-semibold mb-6">NL EAST STANDINGS</h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400 text-sm">
            <th className="pb-4 text-left">TEAM</th>
            <th className="pb-4 text-right">W</th>
            <th className="pb-4 text-right">L</th>
            <th className="pb-4 text-right">PCT</th>
          </tr>
        </thead>
        <tbody className="text-lg divide-y divide-gray-700">
          <tr className="font-bold">
            <td className="py-4 text-white">Atlanta Braves</td>
            <td className="py-4 text-right text-[#EAAA00]">36</td>
            <td className="py-4 text-right">18</td>
            <td className="py-4 text-right text-[#EAAA00]">.667</td>
          </tr>
          <tr>
            <td className="py-4 text-gray-300">Philadelphia Phillies</td>
            <td className="py-4 text-right">28</td>
            <td className="py-4 text-right">26</td>
            <td className="py-4 text-right">.519</td>
          </tr>
          <tr>
            <td className="py-4 text-gray-300">Washington Nationals</td>
            <td className="py-4 text-right">25</td>
            <td className="py-4 text-right">29</td>
            <td className="py-4 text-right">.463</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}