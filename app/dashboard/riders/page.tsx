export default function RidersPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
      <div className="text-center space-y-4 p-8 bg-white rounded-lg shadow-sm border border-gray-100 max-w-md w-full">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <svg 
            className="h-8 w-8 text-green-600" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" 
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Riders Management</h2>
        <p className="text-gray-600">This page is currently under development.</p>
        <p className="text-sm text-gray-500">We're working hard to bring you this feature soon!</p>
      </div>
    </div>
  );
}
