export interface Holiday {
  title: string;
  date: string; // YYYY-MM-DD
  description: string;
  type: 'holiday' | 'international-day' | 'festival';
}

export const GLOBAL_HOLIDAYS: Holiday[] = [
  // --- National Holidays (India) ---
  { title: "Republic Day", date: "2026-01-26", description: "Honors the date on which the Constitution of India came into effect.", type: 'holiday' },
  { title: "Independence Day", date: "2026-08-15", description: "Commemorating the nation's independence from the United Kingdom.", type: 'holiday' },
  { title: "Gandhi Jayanti", date: "2026-10-02", description: "Honoring the birthday of Mahatma Gandhi.", type: 'holiday' },

  // --- Major Indian Festivals 2026 ---
  { title: "Makar Sankranti / Pongal", date: "2026-01-14", description: "Harvest festival celebrated in various parts of India.", type: 'festival' },
  { title: "Maha Shivaratri", date: "2026-02-15", description: "A major Hindu festival celebrated annually in honor of Lord Shiva.", type: 'festival' },
  { title: "Holi", date: "2026-03-03", description: "The festival of colors, celebrating the arrival of spring.", type: 'festival' },
  { title: "Eid-ul-Fitr", date: "2026-03-20", description: "The festival of breaking the fast, marking the end of Ramadan.", type: 'festival' },
  { title: "Ram Navami", date: "2026-03-28", description: "Celebrating the birth of Lord Rama.", type: 'festival' },
  { title: "Mahavir Jayanti", date: "2026-04-02", description: "The most important religious holiday in Jainism.", type: 'festival' },
  { title: "Good Friday", date: "2026-04-03", description: "Commemorating the crucifixion of Jesus Christ.", type: 'festival' },
  { title: "Ambedkar Jayanti", date: "2026-04-14", description: "Honoring the memory of B. R. Ambedkar.", type: 'holiday' },
  { title: "Vaisakhi", date: "2026-04-14", description: "The Sikh New Year and harvest festival.", type: 'festival' },
  { title: "Buddha Purnima", date: "2026-05-22", description: "Celebrating the birth, enlightenment, and death of Gautama Buddha.", type: 'festival' },
  { title: "Eid-ul-Adha", date: "2026-05-27", description: "The Festival of Sacrifice.", type: 'festival' },
  { title: "Muharram", date: "2026-07-17", description: "The first month of the Islamic calendar.", type: 'festival' },
  { title: "Raksha Bandhan", date: "2026-08-28", description: "Celebrating the bond between brothers and sisters.", type: 'festival' },
  { title: "Janmashtami", date: "2026-09-04", description: "Celebrating the birth of Lord Krishna.", type: 'festival' },
  { title: "Ganesh Chaturthi", date: "2026-09-14", description: "Celebrating the birth of Lord Ganesha.", type: 'festival' },
  { title: "Dussehra", date: "2026-10-21", description: "Celebrating the victory of good over evil.", type: 'festival' },
  { title: "Maharishi Valmiki Jayanti", date: "2026-10-26", description: "Celebrating the birth of the poet Valmiki.", type: 'festival' },
  { title: "Diwali / Deepavali", date: "2026-11-08", description: "The festival of lights.", type: 'festival' },
  { title: "Bhai Dooj", date: "2026-11-10", description: "Celebrating the love between siblings.", type: 'festival' },
  { title: "Guru Nanak Jayanti", date: "2026-11-24", description: "Celebrating the birth of Guru Nanak.", type: 'festival' },
  { title: "Christmas Day", date: "2026-12-25", description: "Commemorating the birth of Jesus Christ.", type: 'holiday' },

  // --- International Days ---
  { title: "New Year's Day", date: "2026-01-01", description: "The first day of the year.", type: 'holiday' },
  { title: "International Women's Day", date: "2026-03-08", description: "Celebrating the achievements of women.", type: 'international-day' },
  { title: "Earth Day", date: "2026-04-22", description: "Support for environmental protection.", type: 'international-day' },
  { title: "International Yoga Day", date: "2026-06-21", description: "Recognizing the universal appeal of yoga.", type: 'international-day' },
  { title: "World Mental Health Day", date: "2026-10-10", description: "Raising awareness of mental health issues.", type: 'international-day' },
  { title: "Human Rights Day", date: "2026-12-10", description: "Honoring the Universal Declaration of Human Rights.", type: 'international-day' },
];
