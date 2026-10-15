/**
 * kit/online: hub errors as friendly words (garbage errText).
 * Source: dg-template src/kit/online/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/online.md § "Errors"
 */
import { field, strField } from '../core/json.ts';
import { t } from '../core/strings.ts';

/** A room's `closed` reason → what the player reads. */
export function closedText(reason: string): string {
  switch (reason) {
    case 'empty':
      return t('closedEmpty');
    case 'ended':
      return t('closedEnded');
    case 'other_tab':
      return t('closedOtherTab');
    case 'moved':
      return t('closedMoved');
    case 'gone':
      return t('closedGone');
    default:
      return t('closedRemoved');
  }
}

/** Any hub error → kid words (never the raw message). */
export function errText(e: unknown): string {
  const code = strField(e, 'code');
  if (code === 'offline' || field(e, 'isOffline') === true || strField(e, 'name') === 'OfflineError')
    return t('onlineNeedsConnection');
  switch (code) {
    case 'room_not_found':
    case 'not_found':
      return t('errRoomNotFound');
    case 'room_full':
      return t('errRoomFull');
    case 'in_progress':
      return t('errInProgress');
    case 'banned':
      return t('errBanned');
    case 'suspended':
      return t('errSuspended');
    default:
      return t('errGeneric');
  }
}
