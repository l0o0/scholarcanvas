import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent,
  type RefObject,
} from "react";
import type { CanvasDocument } from "../model/document";
import {
  quoteAttachmentIdentity,
  quoteSourceIdentity,
} from "../model/academic";
import type {
  AnnotationCandidate,
  AnnotationListFailure,
} from "../model/protocol";

export interface AnnotationBrowserLabels {
  title: string;
  search: string;
  loading: string;
  empty: string;
  unavailable: string;
  partialFailure: string;
  alreadyAdded: string;
  focusExisting: string;
  addSelected: string;
  page: string;
  close: string;
}

export type AnnotationBrowserState =
  | { status: "loading" }
  | {
      status: "ready";
      candidates: AnnotationCandidate[];
      failures: AnnotationListFailure[];
    }
  | { status: "unavailable"; failure: AnnotationListFailure };

export interface AnnotationCandidateGroup {
  attachmentIdentity: string;
  attachmentTitle: string;
  candidates: AnnotationCandidate[];
}

export function filterAnnotationCandidates(
  candidates: AnnotationCandidate[],
  query: string,
): AnnotationCandidate[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return candidates;
  return candidates.filter(({ acquisition }) => {
    const { text, comment, pageLabel } = acquisition.snapshot;
    return [text, comment, pageLabel].some((value) =>
      value?.toLocaleLowerCase().includes(needle),
    );
  });
}

export function groupAnnotationCandidates(
  candidates: AnnotationCandidate[],
): AnnotationCandidateGroup[] {
  const groups: AnnotationCandidateGroup[] = [];
  const byAttachment = new Map<string, AnnotationCandidateGroup>();
  for (const candidate of candidates) {
    const attachmentIdentity = quoteAttachmentIdentity(
      candidate.acquisition.source,
    );
    let group = byAttachment.get(attachmentIdentity);
    if (!group) {
      group = {
        attachmentIdentity,
        attachmentTitle: candidate.attachmentTitle,
        candidates: [],
      };
      byAttachment.set(attachmentIdentity, group);
      groups.push(group);
    }
    group.candidates.push(candidate);
  }
  return groups;
}

export function existingAnnotationKeys(document: CanvasDocument): Set<string> {
  return new Set(
    document.nodes.flatMap((node) =>
      node.kind === "quote" ? [quoteSourceIdentity(node.source)] : [],
    ),
  );
}

export function toggleAnnotationSelection(
  selection: ReadonlySet<string>,
  annotationKey: string,
  checked: boolean,
): Set<string> {
  const next = new Set(selection);
  if (checked) next.add(annotationKey);
  else next.delete(annotationKey);
  return next;
}

export function AnnotationBrowser(props: {
  labels: AnnotationBrowserLabels;
  state: AnnotationBrowserState;
  query: string;
  selectedKeys: ReadonlySet<string>;
  existingKeys: ReadonlySet<string>;
  returnFocusRef: RefObject<{ focus(): void } | null>;
  onQueryChange: (query: string) => void;
  onToggle: (annotationKey: string, checked: boolean) => void;
  onClose: () => void;
  onFocusExisting: (annotationKey: string) => void;
  onAddSelected: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const restoreTriggerOnUnmountRef = useRef(true);
  const propsRef = useRef(props);
  propsRef.current = props;
  const close = useCallback(() => propsRef.current.onClose(), []);

  useEffect(() => {
    const backdrop = backdropRef.current;
    const dialog = dialogRef.current;
    const view = backdrop?.ownerDocument.defaultView;
    if (!backdrop || !dialog || !view) return;

    const background = Array.from(backdrop.parentElement?.children ?? [])
      .filter((element) => element !== backdrop)
      .map((element) => {
        const htmlElement = element as HTMLElement;
        const previous = {
          element: htmlElement,
          inert: htmlElement.inert,
          ariaHidden: htmlElement.getAttribute("aria-hidden"),
        };
        htmlElement.inert = true;
        htmlElement.setAttribute("aria-hidden", "true");
        return previous;
      });

    searchRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const active = dialog.ownerDocument.activeElement;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !dialog.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    view.addEventListener("keydown", onKeyDown, true);
    return () => {
      view.removeEventListener("keydown", onKeyDown, true);
      for (const previous of background) {
        previous.element.inert = previous.inert;
        if (previous.ariaHidden === null) {
          previous.element.removeAttribute("aria-hidden");
        } else {
          previous.element.setAttribute("aria-hidden", previous.ariaHidden);
        }
      }
      if (restoreTriggerOnUnmountRef.current) {
        propsRef.current.returnFocusRef.current?.focus();
      }
    };
  }, [close]);

  const onBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };
  const candidates =
    props.state.status === "ready"
      ? filterAnnotationCandidates(props.state.candidates, props.query)
      : [];
  const groups = groupAnnotationCandidates(candidates);

  return (
    <div
      ref={backdropRef}
      className="zmd-board-annotation-backdrop"
      onMouseDown={onBackdrop}
    >
      <section
        ref={dialogRef}
        className="zmd-board-annotation-browser"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zmd-board-annotation-title"
        tabIndex={-1}
      >
        <header>
          <h2 id="zmd-board-annotation-title">{props.labels.title}</h2>
          <button
            type="button"
            className="zmd-board-annotation-close"
            aria-label={props.labels.close}
            onClick={close}
          >
            ×
          </button>
        </header>

        <input
          ref={searchRef}
          className="zmd-board-annotation-search"
          type="search"
          aria-label={props.labels.search}
          placeholder={props.labels.search}
          value={props.query}
          onChange={(event) => props.onQueryChange(event.currentTarget.value)}
        />

        <div className="zmd-board-annotation-results" aria-live="polite">
          {props.state.status === "loading" ? (
            <p className="zmd-board-annotation-state">{props.labels.loading}</p>
          ) : props.state.status === "unavailable" ? (
            <p
              className="zmd-board-annotation-state is-error"
              title={props.state.failure.message}
            >
              {props.labels.unavailable}
            </p>
          ) : (
            <>
              {props.state.failures.length ? (
                <p
                  className="zmd-board-annotation-state is-warning"
                  title={props.state.failures
                    .map((failure) => failure.message)
                    .join("\n")}
                >
                  {props.labels.partialFailure}
                </p>
              ) : null}
              {!groups.length ? (
                <p className="zmd-board-annotation-state">
                  {props.labels.empty}
                </p>
              ) : (
                groups.map((group) => (
                  <section
                    className="zmd-board-annotation-group"
                    key={group.attachmentIdentity}
                    aria-label={group.attachmentTitle}
                  >
                    <h3>{group.attachmentTitle}</h3>
                    <ul>
                      {group.candidates.map((candidate) => {
                        const { source, snapshot } = candidate.acquisition;
                        const identity = quoteSourceIdentity(source);
                        const existing = props.existingKeys.has(identity);
                        return (
                          <li key={identity}>
                            <label>
                              <input
                                type="checkbox"
                                checked={props.selectedKeys.has(identity)}
                                disabled={existing}
                                onChange={(event) =>
                                  props.onToggle(
                                    identity,
                                    event.currentTarget.checked,
                                  )
                                }
                              />
                              <span
                                className="zmd-board-annotation-color"
                                style={{ backgroundColor: snapshot.color }}
                                aria-hidden="true"
                              />
                              <span className="zmd-board-annotation-content">
                                <span className="zmd-board-annotation-text">
                                  {snapshot.text}
                                </span>
                                {snapshot.comment ? (
                                  <span className="zmd-board-annotation-comment">
                                    {snapshot.comment}
                                  </span>
                                ) : null}
                                {snapshot.pageLabel ? (
                                  <span className="zmd-board-annotation-page">
                                    {props.labels.page} {snapshot.pageLabel}
                                  </span>
                                ) : null}
                                {existing ? (
                                  <span className="zmd-board-annotation-existing">
                                    {props.labels.alreadyAdded}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                            {existing ? (
                              <button
                                type="button"
                                className="zmd-board-annotation-focus"
                                onClick={() => {
                                  restoreTriggerOnUnmountRef.current = false;
                                  props.onFocusExisting(identity);
                                }}
                              >
                                {props.labels.focusExisting}
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </>
          )}
        </div>

        <footer>
          <button
            type="button"
            onClick={props.onAddSelected}
            disabled={!props.selectedKeys.size}
          >
            {props.labels.addSelected}
          </button>
        </footer>
      </section>
    </div>
  );
}
