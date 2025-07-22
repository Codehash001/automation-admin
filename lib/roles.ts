export const ROLE_COLORS = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  ADMIN: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  MANAGER: 'bg-green-100 text-green-800 hover:bg-green-200',
  VIEWER: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
  USER: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
} as const;

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  VIEWER: 'Viewer',
  USER: 'User',
} as const;

export type UserRole = keyof typeof ROLE_LABELS;
