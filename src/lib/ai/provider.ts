export interface AIProvider {
  name: string;

  generateFAQAnswer(input: {
    businessName: string;
    businessType: string;
    knowledgeBase: string;
    customerQuestion: string;
  }): Promise<string>;

  generateContent(input: {
    businessName: string;
    businessType: string;
    contentType: "telegram_post" | "promo" | "review_reply" | "story" | "ad" | string;
    productOrService?: string;
    tone?: string;
    goal?: string;
  }): Promise<string>;

  generateProductDescription(input: {
    businessName: string;
    productName: string;
    productCategory?: string;
    productFeatures?: string;
    tone?: string;
  }): Promise<string>;

  generateStrictJson?(input: {
    system: string;
    user: string;
    model?: string;
  }): Promise<string>;
}
