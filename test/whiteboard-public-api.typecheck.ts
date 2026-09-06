import type {
  CanvasConnection as PackageCanvasConnection,
  CanvasDocument as PackageCanvasDocument,
  CanvasNode as PackageCanvasNode,
} from "../packages/whiteboard/src/index";
import type { WhiteboardToParentBody } from "../packages/whiteboard/src/model/protocol";
import {
  createAcademicConnection as createPackageAcademicConnection,
  createAcademicNode as createPackageAcademicNode,
  createBasicNode as createPackageBasicNode,
} from "../packages/whiteboard/src/index";
import type {
  CanvasConnection as HostCanvasConnection,
  CanvasDocument as HostCanvasDocument,
  CanvasNode as HostCanvasNode,
} from "../src/modules/whiteboard/index";
import {
  createAcademicConnection as createHostAcademicConnection,
  createAcademicNode as createHostAcademicNode,
  createBasicNode as createHostBasicNode,
} from "../src/modules/whiteboard/index";

type Assert<T extends true> = T;
export type SenderRejectsMissingPayload = Assert<
  { type: "change" } extends WhiteboardToParentBody ? false : true
>;
export type SenderRejectsMismatchedPayload = Assert<
  {
    type: "change";
    payload: { message: string };
  } extends WhiteboardToParentBody
    ? false
    : true
>;
type SameType<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <
        Value,
      >() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;

export type PackageAndHostDocumentTypesMatch = Assert<
  SameType<PackageCanvasDocument, HostCanvasDocument>
>;
export type PackageAndHostNodeTypesMatch = Assert<
  SameType<PackageCanvasNode, HostCanvasNode>
>;
export type PackageAndHostConnectionTypesMatch = Assert<
  SameType<PackageCanvasConnection, HostCanvasConnection>
>;
export type PackageAndHostBasicFactoriesMatch = Assert<
  SameType<typeof createPackageBasicNode, typeof createHostBasicNode>
>;
export type PackageAndHostAcademicFactoriesMatch = Assert<
  SameType<typeof createPackageAcademicNode, typeof createHostAcademicNode>
>;
export type PackageAndHostConnectionFactoriesMatch = Assert<
  SameType<
    typeof createPackageAcademicConnection,
    typeof createHostAcademicConnection
  >
>;
