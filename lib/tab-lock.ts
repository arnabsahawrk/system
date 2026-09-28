/** Marks this browser tab as unlocked. sessionStorage is scoped to one tab
 * and clears the moment that tab closes — unlike the server cookie, which
 * lives for the whole browser session and would otherwise leave a reopened
 * tab still "unlocked" without asking again. */
const KEY = "sys_tab_unlocked";

export function markTabUnlocked() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

export function isTabUnlocked(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function clearTabUnlocked() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
