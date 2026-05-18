import { ISMSProvider } from "./sms-provider-interface";

export class MockSMSProvider implements ISMSProvider {
  async sendVerificationCode(phone: string, code: string): Promise<boolean> {
    console.log(`\n=======================================\n[MOCK SMS] Отправка SMS на номер ${phone}\nКод верификации: ${code}\n=======================================\n`);
    return true;
  }
}
