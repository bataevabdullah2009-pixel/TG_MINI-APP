export interface ISMSProvider {
  sendVerificationCode(phone: string, code: string): Promise<boolean>;
}
