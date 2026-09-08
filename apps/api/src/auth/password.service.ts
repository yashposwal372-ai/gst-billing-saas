import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

@Injectable()
export class PasswordService {
  private dummyHash?: Promise<string>;
  hash(password: string) {
    // 2 = Argon2id; the package's ambient const enum cannot be imported with isolatedModules.
    return hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  }
  async verify(passwordHash: string, password: string) {
    try { return await verify(passwordHash, password); } catch { return false; }
  }
  async verifyMissingUser(password: string) {
    this.dummyHash ??= this.hash('non-user-dummy-password-for-timing');
    await this.verify(await this.dummyHash, password);
  }
}
