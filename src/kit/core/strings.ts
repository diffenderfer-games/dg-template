/**
 * kit/core: every word the kit shows players, in one table.
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md § "Strings"
 *
 * Rules (hub wording, saved-games.md §11 and multiplayer.md): never "run",
 * "turn game", "instance", "over days" or a kind name; no violent words. A game changes any
 * entry with `defineGame({ strings })` (and could localize the table later).
 * `{name}` placeholders are filled by `t()`.
 */

export const KIT_STRINGS = {
  play: 'Play',
  continue: 'Continue',
  continueLabel: 'Continue: {label}',
  yourSavedGame: 'Your saved game',
  daily: 'Daily challenge',
  dailyOn: 'Daily challenge · {date}',
  dailyDone: 'Done today',
  race: 'Race',
  raceBrowse: 'Open races',
  raceHistory: 'Your races',
  online: 'Play online',
  onlineWith: 'Online with {name}',
  onlineWithTurn: 'Online with {name} · your turn',
  quickMatch: 'Quick match',
  settings: 'Settings',
  howTo: 'How to play',
  paused: 'Paused',
  resume: 'Resume',
  restart: 'Start over',
  quit: 'Back to the title',
  leaveRace: 'Leave race?',
  leaveRaceBody: 'The race goes on without you.',
  leaveMatch: 'Leave the game?',
  leaveMatchBody: 'The others play on without you.',
  leaveGame: 'Leave this game?',
  leave: 'Leave',
  stay: 'Stay',
  yes: 'Yes',
  no: 'No',
  ok: 'OK',
  close: 'Close',
  edit: 'Edit',
  editAvatar: 'Edit avatar',
  yourAvatar: 'Your avatar',
  won: 'You won!',
  lost: 'Nice try!',
  playAgain: 'Play again',
  lateSaveTitle: 'Found your saved game',
  lateSaveBody: 'Keep this new game, or go back to your saved one?',
  keepThisGame: 'Keep this game',
  continueSaved: 'Continue the saved one',
  dailySavedOffline: 'Saved. It will count when you are back online.',
  dailyOffline: "Today's challenge needs a connection. You can still play it for fun.",
  offline: 'You are offline. Your progress is saved on this device.',
  onlineNeedsConnection: 'Online play needs a connection.',
  syncFailed: 'Some progress could not be saved.',
  invite: 'Invite',
  bell: 'Alerts',
  waitingFor: 'Waiting for {name}…',
  isPlaying: '{name} is playing',
  computerPlaying: 'The computer is playing for {name}.',
  letComputerPlay: 'Let the computer play for {name}',
  remindThem: 'Remind them',
  // Online games the hub runs (kit/turns): "an online game", never "turn game" or "over days"
  // (it may take minutes or days, which isn't known in advance). With game.turns it is the
  // default way to play online, so its title button is "Play online"; a live room beside it is "Play now".
  turnsNew: 'Play online',
  turnsNewSub: 'With friends, a link or anyone',
  playNow: 'Play now',
  turnsTitle: 'Online game',
  turnsWho: 'Who do you want to play with?',
  turnsWithComputer: 'The computer',
  turnsWithLink: 'A friend, with a link',
  turnsWithAnyone: 'Anyone',
  turnsOpenTitle: 'Waiting for a player',
  turnsOpenWaiting: '{name} is waiting',
  turnsOpenSeats: '{taken} of {seats} players',
  turnsOpenNone: 'Nobody is waiting right now.',
  turnsMore: 'More games online',
  lookingForGame: 'Looking for a game…',
  join: 'Join',
  // Live rooms: the online button's chooser (Play now finds a room anyone can join, or opens one).
  onlineWho: 'Who do you want to play with?',
  onlinePlayNowSub: "Join anyone who's waiting",
  onlineFriends: 'With friends',
  onlineFriendsSub: 'Your own room. Invite friends in',
  // A live game's match: built on each page, then joined (kit/live).
  liveGettingReady: 'Getting ready…',
  liveJoining: 'Joining the others…',
  // Join with a code: a room's 5-letter code, or an online game's invite link.
  joinCodeLabel: 'Have a code?',
  joinCodeRoom: 'Room code',
  joinCodeLink: 'Invite link',
  joinCodeAny: 'Room code or invite link',
  joinCodeBad: "That code doesn't look right.",
  turnsLobbyMine: "Waiting for players. Start when you're ready.",
  turnsLobbyGuest: 'Waiting for the game to start.',
  turnsStart: 'Start',
  turnsCopyLink: 'Share the invite link',
  turnsShareText: 'Come play with me!',
  shareCopy: 'Copy',
  shareSelect: 'Select the link and copy it',
  turnsReminded: 'We sent them a reminder.',
  turnsLinkCopied: 'Link copied',
  turnsInvite: 'Invite friends',
  turnsInviteTitle: 'Invite friends',
  turnsInviteOne: 'Invite',
  turnsInvited: 'Invited',
  turnsNoFriends: 'No friends to invite yet. Share the link instead.',
  turnsNoSeats: 'Every seat is taken.',
  turnsRemove: 'Remove',
  turnsRemoveTitle: 'Take {name} out of the game?',
  turnsRemoveLobby: 'Their seat opens up again.',
  turnsRemovePlaying: 'The computer plays their seat from now on.',
  turnsRemoveYes: 'Take them out',
  yourTurn: 'Your turn',
  youMayMove: 'you may move now',
  turnsDraw: "It's a draw.",
  turnsRematch: 'Rematch',
  turnsLeave: 'Leave this game',
  turnsLeaveBody: 'The computer plays for you from now on.',
  back: 'Back',
  chatPlaceholder: 'Say something nice',
  chatSend: 'Send',
  chatSoftened: 'Some words were changed.',
  chatRejected: "That message can't be sent.",
  chatRetry: 'Try again in {seconds} s.',
  // Room and launch problems (garbage errText), in kid words.
  errRoomNotFound: "That game isn't there any more.",
  errRoomFull: 'That game is full.',
  errInProgress: 'That game already started.',
  errBanned: "You can't join that game.",
  errSuspended: 'Online play is switched off for your account for now.',
  errTableNotStarted: "That table didn't start.",
  errGeneric: 'Something went wrong. Try again.',
  closedEmpty: 'Everyone left the game.',
  closedEnded: 'The game is over.',
  closedOtherTab: 'This game is open in another tab.',
  closedMoved: 'The game moved somewhere else.',
  closedRemoved: 'The game was closed.',
  closedGone: 'You were away too long, so your seat went to the computer.',
  kicked: 'The host removed you from the game.',
  soundOn: 'Sound',
  music: 'Music',
  haptics: 'Vibration',
  reducedMotion: 'Less motion',
  musicVolume: 'Music volume',
  sfxVolume: 'Sound volume',
  loading: 'Loading…',
} as const;

/** A kit string key. */
export type KitStringKey = keyof typeof KIT_STRINGS;

/** The kit's strings, with a game's overrides. */
export type KitStrings = Record<KitStringKey, string>;

let current: KitStrings = { ...KIT_STRINGS };

/** Replace some kit strings (a game's own copy). */
export function setKitStrings(overrides: Partial<KitStrings>): void {
  current = { ...KIT_STRINGS, ...overrides };
}

/** A kit string with `{name}` placeholders filled. */
export function t(key: KitStringKey, vars: Record<string, string | number> = {}): string {
  return current[key].replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = vars[name];
    return v === undefined ? whole : String(v);
  });
}

/** "Oct 14" for a `YYYY-MM-DD` day (UTC, no locale, so every device shows the same). */
export function shortDay(day: string): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`;
}
