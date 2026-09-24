export const LANGUAGES = [
  { code: "en", label: "English", speech: "en-IN" },
  { code: "kn", label: "ಕನ್ನಡ", speech: "kn-IN" },
  { code: "hi", label: "हिन्दी", speech: "hi-IN" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

export const isLang = (v: unknown): v is Lang => LANGUAGES.some((l) => l.code === v);

type Dict = {
  getToken: string;
  name: string;
  age: string;
  phone: string;
  phoneHint: string;
  service: string;
  priority: string;
  priorityNone: string;
  prioritySenior: string;
  priorityPregnant: string;
  priorityAbled: string;
  bookSlot: string;
  walkIn: string;
  submit: string;
  yourToken: string;
  nowServing: string;
  position: string;
  waitAbout: string;
  goTo: string;
  yourTurn: string;
  counter: string;
  done: string;
  skipped: string;
  cancelled: string;
  cancel: string;
  keep: string;
  arrived: string;
  nextStop: string;
  waiting: string;
  booked: string;
  smsAlmost: string;
  smsNext: string;
  smsCalled: string;
  announce: string;
};

const en: Dict = {
  getToken: "Get your token",
  name: "Full name",
  age: "Age",
  phone: "Mobile number",
  phoneHint: "Optional. We text you when you are a few tokens away.",
  service: "What do you need today?",
  priority: "Do any of these apply?",
  priorityNone: "None of these",
  prioritySenior: "Senior citizen",
  priorityPregnant: "Pregnant",
  priorityAbled: "Differently abled",
  bookSlot: "Choose a time slot",
  walkIn: "I am at the camp now",
  submit: "Get token",
  yourToken: "Your token",
  nowServing: "Now serving",
  position: "Your place in line",
  waitAbout: "About",
  goTo: "Please go to",
  yourTurn: "It is your turn",
  counter: "Counter",
  done: "All done. Thank you for coming.",
  skipped: "Your token was skipped because you did not arrive.",
  cancelled: "This token was cancelled.",
  cancel: "Cancel my token",
  keep: "Keep my token",
  arrived: "I have arrived",
  nextStop: "Next stop",
  waiting: "Waiting",
  booked: "Booked",
  smsAlmost: "{label}: {ahead} people ahead of you at {station}. Please come to the waiting area. Track: {url}",
  smsNext: "{label}: you are next at {station}. Please stay close. Track: {url}",
  smsCalled: "{label}: it is your turn. Please go to {station}, counter {counter}.",
  announce: "Token {label}, please go to {station}, counter {counter}.",
};

const kn: Dict = {
  getToken: "ನಿಮ್ಮ ಟೋಕನ್ ಪಡೆಯಿರಿ",
  name: "ಪೂರ್ಣ ಹೆಸರು",
  age: "ವಯಸ್ಸು",
  phone: "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ",
  phoneHint: "ಐಚ್ಛಿಕ. ನಿಮ್ಮ ಸರದಿ ಹತ್ತಿರವಾದಾಗ SMS ಕಳುಹಿಸುತ್ತೇವೆ.",
  service: "ಇಂದು ನಿಮಗೆ ಏನು ಬೇಕು?",
  priority: "ಇವುಗಳಲ್ಲಿ ಯಾವುದಾದರೂ ಅನ್ವಯಿಸುತ್ತದೆಯೇ?",
  priorityNone: "ಯಾವುದೂ ಇಲ್ಲ",
  prioritySenior: "ಹಿರಿಯ ನಾಗರಿಕರು",
  priorityPregnant: "ಗರ್ಭಿಣಿ",
  priorityAbled: "ವಿಶೇಷ ಚೇತನರು",
  bookSlot: "ಸಮಯ ಆಯ್ಕೆ ಮಾಡಿ",
  walkIn: "ನಾನು ಈಗ ಶಿಬಿರದಲ್ಲಿದ್ದೇನೆ",
  submit: "ಟೋಕನ್ ಪಡೆಯಿರಿ",
  yourToken: "ನಿಮ್ಮ ಟೋಕನ್",
  nowServing: "ಈಗ ಕರೆಯುತ್ತಿರುವ ಟೋಕನ್",
  position: "ಸರದಿಯಲ್ಲಿ ನಿಮ್ಮ ಸ್ಥಾನ",
  waitAbout: "ಸುಮಾರು",
  goTo: "ದಯವಿಟ್ಟು ಇಲ್ಲಿಗೆ ಹೋಗಿ",
  yourTurn: "ಈಗ ನಿಮ್ಮ ಸರದಿ",
  counter: "ಕೌಂಟರ್",
  done: "ಎಲ್ಲಾ ಮುಗಿದಿದೆ. ಬಂದದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು.",
  skipped: "ನೀವು ಬರದ ಕಾರಣ ನಿಮ್ಮ ಟೋಕನ್ ಅನ್ನು ಬಿಟ್ಟುಬಿಡಲಾಗಿದೆ.",
  cancelled: "ಈ ಟೋಕನ್ ರದ್ದಾಗಿದೆ.",
  cancel: "ನನ್ನ ಟೋಕನ್ ರದ್ದುಮಾಡಿ",
  keep: "ಟೋಕನ್ ಉಳಿಸಿಕೊಳ್ಳಿ",
  arrived: "ನಾನು ಬಂದಿದ್ದೇನೆ",
  nextStop: "ಮುಂದಿನ ಹಂತ",
  waiting: "ಕಾಯುತ್ತಿದೆ",
  booked: "ಬುಕ್ ಆಗಿದೆ",
  smsAlmost: "{label}: {station} ನಲ್ಲಿ ನಿಮ್ಮ ಮುಂದೆ {ahead} ಜನರಿದ್ದಾರೆ. ದಯವಿಟ್ಟು ಕಾಯುವ ಸ್ಥಳಕ್ಕೆ ಬನ್ನಿ. {url}",
  smsNext: "{label}: {station} ನಲ್ಲಿ ಮುಂದಿನ ಸರದಿ ನಿಮ್ಮದೇ. ದಯವಿಟ್ಟು ಹತ್ತಿರದಲ್ಲೇ ಇರಿ. {url}",
  smsCalled: "{label}: ಈಗ ನಿಮ್ಮ ಸರದಿ. ದಯವಿಟ್ಟು {station}, ಕೌಂಟರ್ {counter} ಗೆ ಹೋಗಿ.",
  announce: "ಟೋಕನ್ {label}, ದಯವಿಟ್ಟು {station}, ಕೌಂಟರ್ {counter} ಕ್ಕೆ ಬನ್ನಿ.",
};

const hi: Dict = {
  getToken: "अपना टोकन लें",
  name: "पूरा नाम",
  age: "उम्र",
  phone: "मोबाइल नंबर",
  phoneHint: "वैकल्पिक। आपका नंबर पास आने पर हम SMS भेजेंगे।",
  service: "आज आपको क्या चाहिए?",
  priority: "क्या इनमें से कुछ लागू होता है?",
  priorityNone: "इनमें से कुछ नहीं",
  prioritySenior: "वरिष्ठ नागरिक",
  priorityPregnant: "गर्भवती",
  priorityAbled: "दिव्यांग",
  bookSlot: "समय चुनें",
  walkIn: "मैं अभी शिविर में हूँ",
  submit: "टोकन लें",
  yourToken: "आपका टोकन",
  nowServing: "अभी बुलाया जा रहा है",
  position: "कतार में आपकी जगह",
  waitAbout: "लगभग",
  goTo: "कृपया यहाँ जाएँ",
  yourTurn: "अब आपकी बारी है",
  counter: "काउंटर",
  done: "सब पूरा हुआ। आने के लिए धन्यवाद।",
  skipped: "आप नहीं आए, इसलिए आपका टोकन छोड़ दिया गया।",
  cancelled: "यह टोकन रद्द हो गया है।",
  cancel: "मेरा टोकन रद्द करें",
  keep: "टोकन रखें",
  arrived: "मैं पहुँच गया हूँ",
  nextStop: "अगला पड़ाव",
  waiting: "प्रतीक्षा में",
  booked: "बुक किया गया",
  smsAlmost: "{label}: {station} पर आपके आगे {ahead} लोग हैं। कृपया प्रतीक्षा क्षेत्र में आएँ। {url}",
  smsNext: "{label}: {station} पर अगली बारी आपकी है। कृपया पास ही रहें। {url}",
  smsCalled: "{label}: अब आपकी बारी है। कृपया {station}, काउंटर {counter} पर जाएँ।",
  announce: "टोकन {label}, कृपया {station}, काउंटर {counter} पर आइए।",
};

export const dictionaries: Record<Lang, Dict> = { en, kn, hi };
export type DictKey = keyof Dict;

export function t(lang: Lang, key: DictKey): string {
  return dictionaries[lang][key];
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
