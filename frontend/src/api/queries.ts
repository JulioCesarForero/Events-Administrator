/**
 * Opt-in TanStack Query hooks. Pages may import these to get cache, dedup
 * and retries without changing the rest of the codebase.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type {
  MapEnvelope,
  MyGroup,
  Payment,
  ReservationCreateRequest,
  Reservation,
} from './types';

interface AuthArg {
  token: string;
  eventId: string;
}

export const queryKeys = {
  myGroup: (eventId: string) => ['my-group', eventId] as const,
  eventMap: (eventId: string) => ['event-map', eventId] as const,
  paymentInbox: (eventId: string) => ['payment-inbox', eventId] as const,
} as const;

export function useMyGroup({ token, eventId }: AuthArg) {
  return useQuery<MyGroup>({
    queryKey: queryKeys.myGroup(eventId),
    queryFn: () =>
      apiClient.get<MyGroup>(`/portal/events/${eventId}/my-group`, {
        token,
        isBearer: true,
      }),
    enabled: Boolean(token && eventId),
  });
}

export function useEventMap({ token, eventId }: AuthArg) {
  return useQuery<MapEnvelope>({
    queryKey: queryKeys.eventMap(eventId),
    queryFn: () =>
      apiClient.get<MapEnvelope>(`/events/${eventId}/map`, {
        token,
        isBearer: true,
      }),
    enabled: Boolean(token && eventId),
  });
}

export function usePaymentInbox({ token, eventId }: AuthArg) {
  return useQuery<Payment[]>({
    queryKey: queryKeys.paymentInbox(eventId),
    queryFn: () =>
      apiClient.get<Payment[]>(`/events/${eventId}/payment-inbox`, {
        token,
        isBearer: true,
      }),
    enabled: Boolean(token && eventId),
  });
}

interface CreateReservationArgs {
  token: string;
  eventId: string;
  body: ReservationCreateRequest;
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation<Reservation, Error, CreateReservationArgs>({
    mutationFn: ({ token, eventId, body }) =>
      apiClient.post<Reservation>(
        `/events/${eventId}/reservations`,
        body,
        { token, isBearer: true },
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eventMap(vars.eventId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroup(vars.eventId) });
    },
  });
}

interface ApprovePaymentArgs {
  token: string;
  eventId: string;
  paymentId: string;
  approvedTicketCount?: number;
}

export function useApprovePayment() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, ApprovePaymentArgs>({
    mutationFn: ({ token, paymentId, approvedTicketCount }) =>
      apiClient.post(
        `/payments/${paymentId}/approve`,
        { approvedTicketCount },
        { token, isBearer: true },
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentInbox(vars.eventId) });
    },
  });
}

interface RejectPaymentArgs {
  token: string;
  eventId: string;
  paymentId: string;
  reason: string;
}

export function useRejectPayment() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, RejectPaymentArgs>({
    mutationFn: ({ token, paymentId, reason }) =>
      apiClient.post(
        `/payments/${paymentId}/reject`,
        { reason },
        { token, isBearer: true },
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentInbox(vars.eventId) });
    },
  });
}
