export {
  openWhiteboardTab,
  openWhiteboardWindow,
  closeAllWhiteboards,
  closeWhiteboardsForWindow,
  flushAllWhiteboards,
} from "./tab";
export { registerWhiteboardTabHooks, WHITEBOARD_TAB_TYPE } from "./tabHooks";
export { registerWhiteboardMenus, unregisterWhiteboardMenus } from "./menu";
export { createWhiteboardAttachment } from "./create";
export type { CreateWhiteboardAttachmentOptions } from "./create";
export { isWhiteboardAttachment } from "./detect";
export {
  openWhiteboardAttachment,
  registerWhiteboardFileOpenInterceptor,
  unregisterWhiteboardFileOpenInterceptor,
} from "./open";
export { injectWhiteboardStyles } from "./styles";
export {
  readCanvasFile,
  writeCanvasFile,
  pickCanvasFile,
  ensureCanvasExtension,
  basename,
} from "./file-io";
export { whiteboardRegistry } from "./session-registry";
export {
  parseCanvasDocument,
  demoCanvasDocument,
  emptyCanvasDocument,
  createBasicNode,
  createAcademicNode,
  createAcademicConnection,
} from "./snapshot";
export type {
  CanvasDocument,
  CanvasNode,
  CanvasNodeKind,
  CanvasConnection,
} from "./snapshot";
export { createZoteroSourceGateway, noteHtmlToText } from "./source-gateway";
export type {
  SourceGatewayDependencies,
  ZoteroSourceGateway,
} from "./source-gateway";
export { ensureTutorialWhiteboard } from "./tutorial";
