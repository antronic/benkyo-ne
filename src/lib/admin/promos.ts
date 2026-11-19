/** Fleet console client for promo codes (worker/admin/promos.ts). Changes ask for a passkey tap. */
import type { AdminPromoDetail, AdminPromoInput, AdminPromoList } from '../promo/contract.ts';
import { call, withStepUp } from './client.ts';

export const listPromos = () => call<AdminPromoList>('/api/admin/promos');
export const getPromo = (code: string) => call<AdminPromoDetail>(`/api/admin/promos/${encodeURIComponent(code)}`);
export const createPromo = (input: AdminPromoInput) =>
	withStepUp(() => call<AdminPromoDetail>('/api/admin/promos', { method: 'POST', json: input }));
export const setPromoDisabled = (code: string, disabled: boolean) =>
	withStepUp(() => call<AdminPromoDetail>(`/api/admin/promos/${encodeURIComponent(code)}`, { method: 'PATCH', json: { disabled } }));
