export interface ShortcutHelp {
  keys: string;
  label: string;
}

export const KEYBOARD_SHORTCUTS: ShortcutHelp[] = [
  { keys: "V", label: "选择" },
  { keys: "H", label: "抓手" },
  { keys: "R", label: "矩形" },
  { keys: "O", label: "椭圆" },
  { keys: "A", label: "箭头" },
  { keys: "L", label: "直线" },
  { keys: "T", label: "文字" },
  { keys: "E", label: "橡皮" },
  { keys: "Shift", label: "绘制时锁定比例 / 45°" },
  { keys: "Esc", label: "取消绘制或关闭菜单" },
  { keys: "Delete", label: "删除选中" },
  { keys: "Ctrl/⌘ + Z", label: "撤销" },
  { keys: "Ctrl/⌘ + Shift + Z", label: "重做" },
];
