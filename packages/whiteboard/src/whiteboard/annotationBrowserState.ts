import type { AnnotationBrowserState } from "../chrome/AnnotationBrowser";
import {
  literatureSourceIdentity,
  type LiteratureSource,
} from "../model/academic";
import type {
  AnnotationListFailure,
  AnnotationListResult,
} from "../model/protocol";

export interface AnnotationBrowserSession {
  requestId: string;
  source: LiteratureSource;
  state: AnnotationBrowserState;
  query: string;
  selectedKeys: Set<string>;
}

export function openAnnotationBrowserSession(
  requestId: string,
  source: LiteratureSource,
): AnnotationBrowserSession {
  return {
    requestId,
    source,
    state: { status: "loading" },
    query: "",
    selectedKeys: new Set(),
  };
}

export function closeAnnotationBrowserSession(
  _session: AnnotationBrowserSession | null,
): null {
  return null;
}

export function replaceDocumentAnnotationBrowserSession(
  _session: AnnotationBrowserSession | null,
): null {
  return null;
}

function matchesReply(
  session: AnnotationBrowserSession | null,
  requestId: string,
  source: LiteratureSource,
): session is AnnotationBrowserSession {
  return (
    session !== null &&
    session.requestId === requestId &&
    literatureSourceIdentity(session.source) ===
      literatureSourceIdentity(source)
  );
}

export function acceptAnnotationListResult(
  session: AnnotationBrowserSession | null,
  requestId: string,
  source: LiteratureSource,
  result: AnnotationListResult,
): AnnotationBrowserSession | null {
  if (!matchesReply(session, requestId, source)) return session;
  return {
    ...session,
    state: { status: "ready", ...result },
  };
}

export function acceptAnnotationListFailure(
  session: AnnotationBrowserSession | null,
  requestId: string,
  source: LiteratureSource,
  failure: AnnotationListFailure,
): AnnotationBrowserSession | null {
  if (!matchesReply(session, requestId, source)) return session;
  return {
    ...session,
    state: { status: "unavailable", failure },
  };
}
