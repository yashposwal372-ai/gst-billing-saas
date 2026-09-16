import { Module } from '@nestjs/common';
import { HttpPartyServiceClient } from './infrastructure/http-party-service.client.js';
import { PARTY_CLIENT } from './application/party-client.port.js';

@Module({
  providers: [HttpPartyServiceClient, { provide: PARTY_CLIENT, useExisting: HttpPartyServiceClient }],
  exports: [PARTY_CLIENT],
})
export class PartyModule {}
