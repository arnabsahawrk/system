/** Hard navigation to the unlock screen. A full page load on purpose, not the
 * client router: it can't be left half-finished by a stalled soft navigation,
 * and nothing from the locked session lingers in memory afterwards. */
export function goToUnlock(): void {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/unlock";
}
