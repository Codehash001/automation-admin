export default function VendorsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
      <div className="text-center space-y-4 p-8 bg-white rounded-lg shadow-sm border border-gray-100 max-w-md w-full">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          <svg 
            className="h-8 w-8 text-blue-600" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" 
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Vendors Management</h2>
        <p className="text-gray-600">This page is currently under development.</p>
        <p className="text-sm text-gray-500">We're working hard to bring you this feature soon!</p>
      </div>
    </div>
  );
}
