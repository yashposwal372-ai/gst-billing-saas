import { Inject, Injectable } from '@nestjs/common';
import type { AuthContext, SafeUser } from '../users/user.select.js';
import { CustomerDto } from './dto/customer.dto.js';
import type { PartyQuery } from '../parties/party.dto.js';
import type { PartyListQuery } from '../party/domain/party-types.js';
import { PARTY_CLIENT, type PartyClientPort } from '../party/application/party-client.port.js';

function auth(input: AuthContext | SafeUser): AuthContext {
  return 'user' in input ? input : { user: input, sessionId: 'direct-test-session' };
}

@Injectable()
export class CustomersService {
  constructor(@Inject(PARTY_CLIENT) private readonly partyClient: PartyClientPort | unknown) {}
  create(current: AuthContext | SafeUser, dto: CustomerDto) { return (this.partyClient as PartyClientPort).createCustomer(auth(current), dto); }
  list(current: AuthContext | SafeUser, query: PartyQuery) { return (this.partyClient as PartyClientPort).listCustomers(auth(current), query as PartyListQuery); }
  detail(current: AuthContext | SafeUser, id: string) { return (this.partyClient as PartyClientPort).getCustomer(auth(current), id); }
  update(current: AuthContext | SafeUser, id: string, dto: CustomerDto) { return (this.partyClient as PartyClientPort).updateCustomer(auth(current), id, dto); }
  deactivate(current: AuthContext | SafeUser, id: string) { return (this.partyClient as PartyClientPort).deactivateCustomer(auth(current), id); }
}
