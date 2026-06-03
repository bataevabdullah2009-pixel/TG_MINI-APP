export class PolzaMediaProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = process.env.POLZA_IMAGE_MODEL || "google/gemini-3.1-flash-image-preview") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generatePromoImage(input: {
    prompt: string;
    aspectRatio?: "1:1" | "9:16" | "16:9";
    resolution?: "1K" | "2K" | "4K";
    businessId: string;
  }): Promise<{ status: string; id?: string; url?: string; error?: string }> {
    if (!this.apiKey) {
      return { status: "error", error: "Missing Polza AI API Key" };
    }

    // Default to 1K resolution to save costs unless specified (and maybe verified by plan in the service layer)
    const resolution = input.resolution || "1K";
    const aspectRatio = input.aspectRatio || "1:1";

    const baseUrl = process.env.POLZA_MEDIA_BASE_URL || process.env.POLZA_BASE_URL || "https://polza.ai/api/v1";
    const endpoint = baseUrl.includes("/media") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/media`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: {
            prompt: input.prompt,
            aspect_ratio: aspectRatio,
            image_resolution: resolution,
            output_format: "png"
          }
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Polza Media API Error: ${errorText}`);
        return { status: "error", error: "Ошибка при обращении к Polza Media API" };
      }

      const data = await res.json();
      // Adjust according to Polza Media API actual response format
      return {
        status: "success",
        id: data.id,
        url: data.data?.[0]?.url || data.url
      };
    } catch (error: any) {
      console.error("Polza Media Generation Error:", error);
      return { status: "error", error: error.message };
    }
  }
}
