/**
 * kit/online: tell the hub who is in an own-server match (hub.mp.setRoster, world W3).
 * Source: dg-template src/kit/online/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/world.md § "People panel"
 *
 * Planned hub API (world.md §6.2). Own-server games call the returned
 * function with the user ids of each roster message from their server; the
 * hub is told only when the roster changed. A no-op until the hub ships it.
 */
import type { HubLike } from '../core/hub-like.ts';

/** A roster reporter (call it with every roster your server sends). */
export function rosterSync(hub: Pick<HubLike, 'mp'>): (userIds: readonly number[]) => void {
  let last = '';
  return (userIds) => {
    const key = [...userIds].sort((a, b) => a - b).join(',');
    if (key === last) return;
    last = key;
    hub.mp.setRoster?.(userIds);
  };
}
