/**
 * Shared API types aligned with PromptsDiseñoApp/8.APIs_y_contratos_gestion_ubicaciones_eventos.md.
 * These types are opt-in: existing pages continue to use `any` until they are migrated.
 *
 * Naming follows the JSON contract (camelCase) regardless of backend snake_case columns.
 */

/* =========================================================================
 * Generic envelope
 * ========================================================================= */

export type ErrorCode =
  | 'INVALID_PAYLOAD'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'TABLE_CAPACITY_CONFLICT'
  | 'PAYMENT_ALREADY_REVIEWED'
  | 'STUDENT_CODE_ALREADY_USED'
  | 'STAGE_LIMIT_EXCEEDED'
  | 'PAYMENT_NOT_APPROVED'
  | 'MISSING_PAYMENT_EVIDENCE'
  | 'LEGAL_ACCEPTANCE_REQUIRED'
  | 'LEGAL_DOCUMENTS_NOT_PUBLISHED'
  | 'PARTICIPANT_EDIT_WINDOW_CLOSED'
  | 'PARTICIPANTS_INCOMPLETE'
  | 'RESERVATION_EXCEEDS_APPROVED_TICKETS'
  | 'RESERVATION_OR_REFUND_NOT_SUPPORTED'
  | 'GROUP_ALREADY_RESERVED'
  | 'PAYMENT_INVALID_STATE'
  | 'INVALID_DOCUMENT_TYPE'
  | 'LAYOUT_VERSION_MISMATCH'
  | 'EVENT_NO_LAYOUT_BINDING'
  | 'INVALID_ALLOCATION';

export interface ErrorEnvelope {
  error?: {
    code?: ErrorCode | string;
    message?: string;
    correlationId?: string;
  };
  code?: ErrorCode | string;
  title?: string;
  detail?: string | { msg?: string }[];
  status?: number;
  correlationId?: string;
}

/* =========================================================================
 * Auth
 * ========================================================================= */

export interface CodeLoginRequest {
  eventId: string;
  studentCode: string;
}

export interface CodeLoginResponse {
  sessionToken: string;
  eventId: string;
  groupId: string;
  studentCode: string;
  isFirstUse: boolean;
  reusedExistingGroup: boolean;
}

export interface StaffLoginRequest {
  email: string;
  password: string;
}

export interface StaffLoginResponse {
  accessToken: string;
  tokenType: string;
  userId: string;
  email: string;
}

export interface StaffMeResponse {
  userId: string;
  email: string;
  displayName: string;
  status: string;
  memberships: Array<{ tenantId: string; tenantName: string; role: string }>;
}

/* =========================================================================
 * Buyer portal
 * ========================================================================= */

export type ReservationStatus = 'NONE' | 'CONFIRMED' | 'RELEASED';

export interface MyGroup {
  groupId: string;
  eventId: string;
  studentCodeSnapshot: string;
  displayName: string | null;
  reservationStatus: ReservationStatus;
  approvedTicketCount: number;
}

/* =========================================================================
 * Attendees / participants
 * ========================================================================= */

export type DocumentType = 'CC' | 'TI' | 'CE' | string;

export interface ParticipantCreate {
  firstName: string;
  lastName: string;
  documentType: DocumentType;
  documentId: string;
  isVegetarian: boolean;
  allergies: string;
  mobilePhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  hasReducedMobility: boolean;
}

export interface Participant extends ParticipantCreate {
  id: string;
  attendeeGroupId: string;
}

export type ParticipantUpdate = Partial<ParticipantCreate>;

/* =========================================================================
 * Payments
 * ========================================================================= */

export type PaymentType = 'DIGITAL' | 'CASH';
export type PaymentStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export interface PaymentCreate {
  paymentType: PaymentType;
  ticketQuantity: number;
  amountCents?: number | null;
  currency?: string;
}

export interface Payment {
  id: string;
  eventId: string;
  attendeeGroupId: string;
  status: PaymentStatus;
  ticketQuantity: number;
  paymentType: PaymentType;
  /** Spec field (§4.9). Alias of rejectionReason when serialized by the backend. */
  reason?: string | null;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  amountCents?: number | null;
  currency?: string;
}

export interface ApprovePaymentBody {
  approvedTicketCount?: number;
}

export interface RejectPaymentBody {
  reason: string;
}

export interface EvidenceUrlResponse {
  uploadUrl: string;
  bucket?: string;
  objectKey?: string;
  storagePath?: string;
  expiresIn?: number;
}

export interface EvidenceRegister {
  fileUrl?: string;
  bucket?: string;
  objectKey?: string;
  mimeType?: string;
  evidenceType?: string;
  storagePath?: string;
  fileName?: string;
  sizeBytes?: number;
}

export interface CashPaymentCreate {
  attendeeGroupId: string;
  ticketQuantity: number;
  amountCents?: number;
  currency?: string;
  receiptFileUrl: string;
}

/* =========================================================================
 * Legal documents
 * ========================================================================= */

export type LegalDocumentType = 'DATA_POLICY' | 'EVENT_TERMS';
export type LegalDocumentStatus = 'DRAFT' | 'PUBLISHED';

export interface LegalDocument {
  id: string;
  eventId: string;
  documentType: LegalDocumentType;
  versionLabel: string;
  title: string;
  contentMarkdown?: string;
  status: LegalDocumentStatus;
  publishedAt?: string | null;
}

export interface LegalDocumentCreate {
  documentType: LegalDocumentType;
  versionLabel: string;
  title: string;
  contentMarkdown: string;
}

export interface AcceptedLegalDocuments {
  policyVersionLabel: string;
  termsVersionLabel: string;
  acceptedAt: string;
}

/* =========================================================================
 * Map & reservations
 * ========================================================================= */

export type TableStatus = 'AVAILABLE' | 'LIMITED' | 'FULL';

export interface MapTable {
  /** Canonical per contract §4.7. Backend serializes both `id` and `layoutTableId`. */
  id: string;
  layoutTableId?: string;
  code: string;
  capacity: number;
  occupiedSpots: number;
  availableSpots: number;
  /** Legacy names kept for transition. */
  occupied?: number;
  available?: number;
  status: TableStatus;
  position?: { x: number; y: number; rotationDeg: number };
  positionJson?: Record<string, unknown> | null;
}

export interface MapEnvelope {
  eventId: string;
  layoutId: string;
  tables: MapTable[];
}

export interface ReservationAllocationIn {
  layoutTableId: string;
  /** Canonical per §4.8. Backend also accepts `spots` for back-compat. */
  spotsReserved: number;
}

export interface ReservationLegalAcceptanceIn {
  accepted: boolean;
  policyDocumentId: string;
  termsDocumentId: string;
}

export interface ReservationCreateRequest {
  groupId?: string;
  paymentId: string;
  legalAcceptance: ReservationLegalAcceptanceIn;
  allocations: ReservationAllocationIn[];
}

export interface ReservationCode {
  participantId: string;
  /** Canonical per §4.8. Backend also emits `reservationCode`. */
  code: string;
  codeSequenceNumber?: number;
  reservationCode?: string;
}

export interface ReservationAllocationOut {
  layoutTableId: string;
  spotsReserved: number;
}

export interface ReservationLegalAcceptanceOut {
  policyVersionLabel: string;
  termsVersionLabel: string;
  acceptedAt: string;
}

export interface Reservation {
  /** Canonical per §4.8. Backend also emits `id`. */
  reservationId: string;
  id?: string;
  eventId: string;
  attendeeGroupId: string;
  paymentId: string;
  status: 'CONFIRMED' | 'RELEASED' | 'MOVED';
  totalSpotsReserved: number;
  allocations: ReservationAllocationOut[];
  reservationCodes: ReservationCode[];
  legalAcceptance: ReservationLegalAcceptanceOut | null;
}

/* =========================================================================
 * Events & configuration
 * ========================================================================= */

export interface Event {
  id: string;
  tenantId: string;
  venueId: string;
  name: string;
  eventDate: string;
  status: string;
}

export interface EventConfigurationUpdate {
  timezone?: string;
  presaleStartDate: string;
  presaleEndDate: string;
  saleStartDate: string;
  saleEndDate: string;
  maxPresaleTickets: number;
  maxSaleTickets: number;
  mapVisibilityPolicy?: string;
  /** Extended by contract §4.2.1 to piggy-back event/venue fields. */
  eventDate?: string;
  venueName?: string;
  venueAddress?: string;
  venueLat?: number;
  venueLon?: number;
}

/* =========================================================================
 * Audit
 * ========================================================================= */

export interface AuditLogEntry {
  id: string;
  occurredAt: string;
  actorType: 'BUYER' | 'STAFF' | 'SYSTEM' | string;
  entityType: string;
  entityId: string | null;
  action: string;
  payloadJson: Record<string, unknown> | null;
}

/* =========================================================================
 * Student import
 * ========================================================================= */

export interface StudentImportCreate {
  fileName: string;
  fileUrl?: string;
  objectKey?: string;
  bucket?: string;
  storagePath?: string;
  expectedColumns?: string[];
  rows?: Array<{ studentCode: string; firstName: string; lastName: string }>;
}

export interface StudentImportStatus {
  batchId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalRows: number;
  importedRows: number;
  failedRows: number;
}
