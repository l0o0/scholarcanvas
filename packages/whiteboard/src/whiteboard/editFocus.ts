export interface EditFocusHold {
  current: boolean;
  token?: symbol;
}

type ScheduleRelease = (callback: () => void) => void;

export function armEditFocusHold(
  hold: EditFocusHold,
  scheduleRelease: ScheduleRelease = (callback) => {
    setTimeout(callback, 0);
  },
) {
  const token = Symbol("edit-focus-hold");
  hold.current = true;
  hold.token = token;
  scheduleRelease(() => {
    if (hold.token !== token) return;
    hold.current = false;
    hold.token = undefined;
  });
}

export function consumeEditFocusHold(hold: EditFocusHold): boolean {
  const held = hold.current;
  hold.current = false;
  hold.token = undefined;
  return held;
}

export function handleEditBlur(hold: EditFocusHold, commit: () => void) {
  if (!consumeEditFocusHold(hold)) commit();
}
