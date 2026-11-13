import type { AiError, ModelInfo, Price } from '../../src/lib/ai/contract.ts';
import type { TokenUsage } from '../../src/lib/ai/prices.ts';

/** Token usage attributed to the model that produced it. */
export type UsageEntry = TokenUsage & { model: string };

export type AdapterResult =
	| { ok: true; text: string; usage: UsageEntry[] }
	| {
			ok: false;
			status: number;
			error: AiError['error'];
			message: string;
			usage: UsageEntry[];
			/** true when the provider may have billed but we don't know how much */
			billedUnknown?: boolean;
	  };

/** A model as the provider lists it, before price resolution. */
export type ProviderModel = Omit<ModelInfo, 'provider' | 'credentialId' | 'price' | 'priceSource'> & {
	providerPrice: Price | null;
};
