import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INTERNAL_CONTEXT_HEADER, INTERNAL_SIGNATURE_HEADER, PARTY_SERVICE_CONTEXT_AUDIENCE, PARTY_SERVICE_CONTEXT_SOURCE, signSecurityContext } from '@gst/security-context';
import type { CustomerCommand, CustomerCreateResponse, CustomerDetail, CustomerListItem, CustomerProfile, CustomerUpdateResponse, PartyErrorResponse, PartyListQuery, PartyListResult, SupplierCommand, SupplierCreateResponse, SupplierDetail, SupplierListItem, SupplierProfile, SupplierUpdateResponse } from '@gst/party-contracts';
import type { Environment } from '../../config/environment.js';
import type { AuthContext } from '../../users/user.select.js';
import type { PartyClientPort } from '../application/party-client.port.js';

function safeId(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }
function cleanBase(raw: string): string { const url = new URL(raw); url.username = ''; url.password = ''; url.hash = ''; return url.toString().replace(/\/$/, ''); }
function queryString(query: PartyListQuery): string { return new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)])).toString(); }

@Injectable()
export class HttpPartyServiceClient implements PartyClientPort {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  private headers(auth: AuthContext) {
    if (!auth.user.currentBusinessId) throw new BadRequestException('Business owner access required');
    const requestId = safeId('api');
    const correlationId = requestId;
    const signed = signSecurityContext({
      secret: this.config.get('PARTY_SERVICE_HMAC_SECRET', { infer: true }) ?? 'local-party-service-secret-change-me-32-bytes',
      source: PARTY_SERVICE_CONTEXT_SOURCE,
      audience: PARTY_SERVICE_CONTEXT_AUDIENCE,
      requestId,
      correlationId,
      userId: auth.user.id,
      sessionId: auth.sessionId,
      businessId: auth.user.currentBusinessId,
    });
    return { 'content-type': 'application/json', 'x-request-id': requestId, 'x-correlation-id': correlationId, [INTERNAL_CONTEXT_HEADER]: signed.encodedContext, [INTERNAL_SIGNATURE_HEADER]: signed.signature };
  }

  private async request<T>(auth: AuthContext, method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.get('PARTY_SERVICE_TIMEOUT_MS', { infer: true }));
    try {
      const response = await fetch(`${cleanBase(this.config.get('PARTY_SERVICE_BASE_URL', { infer: true }))}${path}`, { method, headers: this.headers(auth), body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      const text = await response.text();
      const payload = text ? JSON.parse(text) as unknown : undefined;
      if (response.ok) return payload as T;
      this.mapError(response.status, payload);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException('Party service is unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapError(status: number, payload: unknown): never {
    const error = payload as Partial<PartyErrorResponse> & { message?: unknown };
    const message = typeof error.message === 'string' ? error.message : 'Party request failed';
    if (status === 400) throw new BadRequestException(message);
    if (status === 404) throw new NotFoundException(message);
    if (status === 409) throw new ConflictException(message);
    throw new ServiceUnavailableException('Party service is unavailable');
  }

  async createCustomer(auth: AuthContext, dto: CustomerCommand): Promise<CustomerProfile> { return (await this.request<CustomerCreateResponse>(auth, 'POST', '/internal/v1/party/customers', dto)).profile; }
  listCustomers(auth: AuthContext, query: PartyListQuery): Promise<PartyListResult<CustomerListItem>> { return this.request(auth, 'GET', `/internal/v1/party/customers?${queryString(query)}`); }
  getCustomer(auth: AuthContext, id: string): Promise<CustomerDetail> { return this.request(auth, 'GET', `/internal/v1/party/customers/${id}`); }
  async updateCustomer(auth: AuthContext, id: string, dto: CustomerCommand): Promise<CustomerProfile> { return (await this.request<CustomerUpdateResponse>(auth, 'PATCH', `/internal/v1/party/customers/${id}`, dto)).profile; }
  async deactivateCustomer(auth: AuthContext, id: string): Promise<CustomerProfile> { return (await this.request<CustomerUpdateResponse>(auth, 'DELETE', `/internal/v1/party/customers/${id}`)).profile; }
  async createSupplier(auth: AuthContext, dto: SupplierCommand): Promise<SupplierProfile> { return (await this.request<SupplierCreateResponse>(auth, 'POST', '/internal/v1/party/suppliers', dto)).profile; }
  listSuppliers(auth: AuthContext, query: PartyListQuery): Promise<PartyListResult<SupplierListItem>> { return this.request(auth, 'GET', `/internal/v1/party/suppliers?${queryString(query)}`); }
  getSupplier(auth: AuthContext, id: string): Promise<SupplierDetail> { return this.request(auth, 'GET', `/internal/v1/party/suppliers/${id}`); }
  async updateSupplier(auth: AuthContext, id: string, dto: SupplierCommand): Promise<SupplierProfile> { return (await this.request<SupplierUpdateResponse>(auth, 'PATCH', `/internal/v1/party/suppliers/${id}`, dto)).profile; }
  async deactivateSupplier(auth: AuthContext, id: string): Promise<SupplierProfile> { return (await this.request<SupplierUpdateResponse>(auth, 'DELETE', `/internal/v1/party/suppliers/${id}`)).profile; }
}
