import type { KeyboardEvent, MouseEvent, RefObject } from "react";
import type { CanvasDocument } from "../model/document";
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
  const byTitle = new Map<string, AnnotationCandidateGroup>();
  for (const candidate of candidates) {
    let group = byTitle.get(candidate.attachmentTitle);
    if (!group) {
      group = { attachmentTitle: candidate.attachmentTitle, candidates: [] };
      byTitle.set(candidate.attachmentTitle, group);
      groups.push(group);
    }
    group.candidates.push(candidate);
  }
  return groups;
}

export function existingAnnotationKeys(document: CanvasDocument): Set<string> {
  return new Set(
    document.nodes.flatMap((node) =>
      node.kind === "quote" ? [node.source.annotationKey] : [],
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
  const close = () => {
    props.onClose();
    props.returnFocusRef.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };
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
      className="zmd-board-annotation-backdrop"
      onKeyDown={onKeyDown}
      onMouseDown={onBackdrop}
    >
      <section
        className="zmd-board-annotation-browser"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zmd-board-annotation-title"
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
          className="zmd-board-annotation-search"
          type="search"
          aria-label={props.labels.search}
          placeholder={props.labels.search}
          value={props.query}
          onChange={(event) => props.onQueryChange(event.currentTarget.value)}
          autoFocus
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
                    key={group.attachmentTitle}
                    aria-label={group.attachmentTitle}
                  >
                    <h3>{group.attachmentTitle}</h3>
                    <ul>
                      {group.candidates.map((candidate) => {
                        const { source, snapshot } = candidate.acquisition;
                        const existing = props.existingKeys.has(
                          source.annotationKey,
                        );
                        return (
                          <li key={source.annotationKey}>
                            <label>
                              <input
                                type="checkbox"
                                checked={props.selectedKeys.has(
                                  source.annotationKey,
                                )}
                                disabled={existing}
                                onChange={(event) =>
                                  props.onToggle(
                                    source.annotationKey,
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
                                onClick={() =>
                                  props.onFocusExisting(source.annotationKey)
                                }
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
