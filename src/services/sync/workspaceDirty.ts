/** Mark workspace-level edits for auto-sync push (Markets / News / YouTube / nav). */

export async function markWorkspaceChangedForSync(): Promise<void> {
  try {
    const { isApplyingRemote, markLocalDataChanged } = await import('./autoSyncService')
    if (isApplyingRemote()) return
    markLocalDataChanged()
  } catch {
    /* sync unavailable in some tests */
  }
}
