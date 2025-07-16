// Shared state for delivery notifications
export const activeNotifications = new Map<number, {
  timeoutId: NodeJS.Timeout,
  currentIndex: number,
  drivers: Array<{ id: number; phone: string; name: string }>
}>();

// Note: Phone-to-delivery mapping is now handled by database (RiderDeliveryMapping model)
// instead of in-memory storage to persist across serverless function invocations
