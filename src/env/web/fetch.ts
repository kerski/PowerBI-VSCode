const fetch = globalThis.fetch;
export { fetch, fetch as insecureFetch };
import type { HttpsProxyAgent } from 'https-proxy-agent';

declare global {
	interface RequestInit {
		method?: string;
		agent?: HttpsProxyAgent | undefined;
		body?: BodyInit;
		headers?: HeadersInit;
	}
} 

declare type _BodyInit = BodyInit;
declare type _RequestInit = RequestInit;
declare type _Response = Response;
declare type _FormData = FormData;
export type { _BodyInit as BodyInit, _RequestInit as RequestInit, _Response as Response, _FormData as FormData };

export function getProxyAgent(_strictSSL?: boolean): HttpsProxyAgent | undefined {
	return undefined;
}

export async function wrapForForcedInsecureSSL<T>(
	_ignoreSSLErrors: boolean | 'force',
	fetchFn: () => Promise<T> | Thenable<T>,
): Promise<T> {
	return fetchFn();
}