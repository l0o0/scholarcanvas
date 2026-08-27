import { KEYBOARD_SHORTCUTS } from "./shortcuts";

export function ShortcutsOverlay(props: { onClose: () => void }) {
  return (
    <div className="zmd-board-help-backdrop" onClick={props.onClose}>
      <div
        className="zmd-board-help"
        role="dialog"
        aria-labelledby="zmd-board-help-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="zmd-board-help-title">快捷键导航</h2>
          <button type="button" onClick={props.onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <ul>
          {KEYBOARD_SHORTCUTS.map((item) => (
            <li key={item.keys}>
              <kbd>{item.keys}</kbd>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
