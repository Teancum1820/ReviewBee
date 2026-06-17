export const NOTIFICATION_COUNTER_UPDATED = "reviewbee:notification-counter-updated";

export function notifyNotificationCounterUpdated() {
  window.dispatchEvent(new Event(NOTIFICATION_COUNTER_UPDATED));
}
