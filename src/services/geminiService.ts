import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ExtractedEvent {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  location?: string;
  description?: string;
  reminderMinutes?: number;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
}

export const extractScheduleFromImage = async (base64Image: string, mimeType: string): Promise<ExtractedEvent[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: "Extract all events, schedules, or appointments from this image. Return them as a JSON array of objects with fields: title, date (YYYY-MM-DD), startTime (HH:mm), endTime (HH:mm), location, and description. Ensure date is strictly YYYY-MM-DD and times are 24-hour HH:mm. If a field is missing, omit it." },
          { inlineData: { data: base64Image, mimeType } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            startTime: { type: Type.STRING },
            endTime: { type: Type.STRING },
            location: { type: Type.STRING },
            description: { type: Type.STRING },
          },
          required: ["title", "date", "startTime"]
        }
      }
    }
  });

  try {
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Gemini response:", response.text);
    return [];
  }
};
