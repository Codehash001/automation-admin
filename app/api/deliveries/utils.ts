// Shared utilities for delivery notification system

// Store active notification loops for tracking
export const activeNotifications = new Map<number, {
  timeoutId: NodeJS.Timeout,
  currentIndex: number,
  drivers: Array<{ id: number; phone: string; name: string }>
}>();

// Store temporary mapping of rider phone to delivery ID (expires after 5 minutes)
export const riderDeliveryMapping = new Map<string, {
  deliveryId: number,
  expiresAt: Date
}>();

// Clean up expired mappings every minute
setInterval(() => {
  const now = new Date();
  Array.from(riderDeliveryMapping.entries()).forEach(([phone, data]) => {
    if (data.expiresAt < now) {
      riderDeliveryMapping.delete(phone);
    }
  });
}, 60000);
