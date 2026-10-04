/** ARD L-11: "active" work that has not been touched for 90 days is shown honestly as dormant. Shared by /lab, /status and the terminal. */
export const DORMANT_AFTER_DAYS = 90;

export function shownStatus(status: string, lastTouched: Date, now = Date.now()): string {
  return status === 'active' && now - lastTouched.getTime() > DORMANT_AFTER_DAYS * 864e5 ? 'dormant' : status;
}
