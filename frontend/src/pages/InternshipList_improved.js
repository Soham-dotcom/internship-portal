// This is a reference file for UI improvements - contains header and filter components
// You can copy elements from here to update the main InternshipList.js

/* 
MODERN HEADER SECTION:
*/
const ModernHeader = () => (
  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-8 text-white mb-6">
    <h1 className="text-4xl font-bold">📝 Internship Management</h1>
    <p className="mt-2 text-indigo-100 text-lg">
      Manage and track all student internships
    </p>
  </div>
);

/* 
MODERN FILTER SECTION:
*/
const ModernFilters = ({ filters, handleFilterChange, resetFilters, filteredCount, totalCount }) => (
  <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center">
        <span className="mr-2">🔍</span> Filter Internships
      </h2>
      <div className="text-sm text-gray-600">
        Showing <span className="font-bold text-indigo-600">{filteredCount}</span> of {totalCount}
      </div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
        <select
          name="branch"
          value={filters.branch}
          onChange={handleFilterChange}
          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        >
          <option value="">All Branches</option>
          {/* branch options */}
        </select>
      </div>
      
      {/* Add more filter inputs with similar styling */}
      
      <div className="flex items-end">
        <button
          onClick={resetFilters}
          className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-all transform hover:scale-105"
        >
          🔄 Reset
        </button>
      </div>
    </div>
  </div>
);

/* 
MODERN STATS CARDS:
*/
const StatsCards = ({ totalStudents, totalCompanies, avgDuration }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-blue-100 text-sm font-medium uppercase">Total Students</p>
          <p className="text-4xl font-bold mt-2">{totalStudents}</p>
        </div>
        <div className="text-5xl opacity-80">👨‍🎓</div>
      </div>
    </div>
    
    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-green-100 text-sm font-medium uppercase">Companies</p>
          <p className="text-4xl font-bold mt-2">{totalCompanies}</p>
        </div>
        <div className="text-5xl opacity-80">🏢</div>
      </div>
    </div>
    
    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-purple-100 text-sm font-medium uppercase">Avg Duration</p>
          <p className="text-4xl font-bold mt-2">{avgDuration}</p>
        </div>
        <div className="text-5xl opacity-80">⏱️</div>
      </div>
    </div>
  </div>
);

/* 
MODERN TABLE:
*/
const ModernTable = ({ data }) => (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
              Student
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
              Company
            </th>
            {/* Add more headers */}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item, idx) => (
            <tr key={idx} className="hover:bg-indigo-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {item.name.charAt(0)}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.uid}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900 font-medium">{item.companyName}</div>
              </td>
              {/* Add more cells */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/* 
MODERN BUTTON STYLES:
*/
const PrimaryButton = ({ children, onClick }) => (
  <button
    onClick={onClick}
    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
  >
    {children}
  </button>
);

const SecondaryButton = ({ children, onClick }) => (
  <button
    onClick={onClick}
    className="px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg border-2 border-indigo-600 hover:bg-indigo-50 transform hover:scale-105 transition-all duration-200"
  >
    {children}
  </button>
);

/* 
MODERN LOADING STATE:
*/
const ModernLoading = () => (
  <div className="flex items-center justify-center h-96">
    <div className="text-center">
      <div className="relative">
        <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-indigo-600 mx-auto"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-2xl">📊</div>
        </div>
      </div>
      <p className="mt-6 text-gray-600 font-medium text-lg">Loading internships...</p>
      <p className="mt-2 text-gray-500 text-sm">Please wait while we fetch the data</p>
    </div>
  </div>
);

export { ModernHeader, ModernFilters, StatsCards, ModernTable, PrimaryButton, SecondaryButton, ModernLoading };
