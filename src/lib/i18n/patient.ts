/**
 * Words on patient screens, in English, Telugu and Hindi.
 *
 * ASSUMPTION: the Telugu and Hindi text was AI-translated and must be checked
 * by native speakers before real use (see docs/ASSUMPTIONS.md).
 *
 * Plain TypeScript with no server imports, so client components can use it.
 */

import type { ResultFlag } from "../flags";

export const LANGUAGES = ["en", "te", "hi"] as const;
export type Lang = (typeof LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Lang, string> = { en: "English", te: "తెలుగు", hi: "हिंदी" };

/** Locale for dates, e.g. "9 Nov 2026" / "9 నవం, 2026". */
export const LOCALES: Record<Lang, string> = { en: "en-IN", te: "te-IN", hi: "hi-IN" };

export function parseLang(value: unknown): Lang {
  return LANGUAGES.includes(value as Lang) ? (value as Lang) : "en";
}

type FlagWord = Exclude<ResultFlag, "CRITICAL_LOW" | "CRITICAL_HIGH"> | "CRITICAL";

export type PatientStrings = {
  signOut: string;
  loading: string;
  errorTitle: string;
  errorBody: string;
  tryAgain: string;
  languageLabel: string;

  linkReadyTitle: string;
  linkSendCodeTo: (masked: string) => string;
  sendCode: string;
  codeSentTo: (masked: string) => string;
  codeLabel: string;
  openReport: string;
  continueButton: string;
  resendCode: string;
  otpWrong: (left: number) => string;
  otpLocked: string;
  otpExpired: string;
  otpNoCode: string;
  otpFormat: string;
  otpRateLimited: (minutes: number) => string;
  linkInvalidTitle: string;
  linkInvalidBody: string;
  linkExpiredTitle: string;
  linkExpiredBody: string;
  linkRevokedTitle: string;
  linkRevokedBody: string;
  signInWithMobile: string;

  loginTitle: string;
  loginIntro: string;
  mobileLabel: string;
  invalidMobile: string;
  codeSentGeneric: (masked: string) => string;
  changeNumber: string;

  consentTitle: string;
  consentPoints: string[];
  consentAgree: string;
  consentContinue: string;
  consentRequired: string;

  pickerTitle: string;
  pickerIntro: string;
  noPatientsTitle: string;
  noPatientsBody: string;

  ordersTitle: (name: string) => string;
  statusReady: string;
  statusProcessing: string;
  processingHint: string;
  viewReport: string;
  orderLabel: (id: string) => string;
  ordersEmpty: string;
  choosePerson: string;

  signedOn: (date: string) => string;
  doctor: (name: string) => string;
  criticalTitle: string;
  criticalBody: string;
  resultsHeading: string;
  normalRange: (range: string) => string;
  noRange: string;
  downloadPdf: string;
  summaryTitle: string;
  summaryPending: string;
  disclaimer: string;
  notReadyTitle: string;
  notReadyBody: string;
  allReports: string;
  notFoundTitle: string;
  notFoundBody: string;

  flags: Record<FlagWord, string>;
};

const en: PatientStrings = {
  signOut: "Sign out",
  loading: "Loading…",
  errorTitle: "Something went wrong",
  errorBody: "Please try again in a moment.",
  tryAgain: "Try again",
  languageLabel: "Language",

  linkReadyTitle: "Your test report is ready",
  linkSendCodeTo: (m) => `To keep your report private, we'll send a 6-digit code to ${m}.`,
  sendCode: "Send code",
  codeSentTo: (m) => `We sent a 6-digit code to ${m}.`,
  codeLabel: "6-digit code",
  openReport: "Open my report",
  continueButton: "Continue",
  resendCode: "Send a new code",
  otpWrong: (left) => `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`,
  otpLocked: "Too many wrong codes. Please send a new code.",
  otpExpired: "This code has expired. Please send a new code.",
  otpNoCode: "That code didn't work. Please send a new code.",
  otpFormat: "Enter the 6 digits from the message.",
  otpRateLimited: (min) => `Too many codes sent. Please try again in ${min} ${min === 1 ? "minute" : "minutes"}.`,
  linkInvalidTitle: "This link doesn't work",
  linkInvalidBody: "It may have been copied incorrectly. You can still see your reports by signing in with your mobile number.",
  linkExpiredTitle: "This link has expired",
  linkExpiredBody: "For your privacy, report links work for 3 days. Sign in with your mobile number to see your reports.",
  linkRevokedTitle: "This link has been replaced",
  linkRevokedBody: "The lab sent you a newer link. Use the newest message, or sign in with your mobile number.",
  signInWithMobile: "Sign in with your mobile number",

  loginTitle: "See your reports",
  loginIntro: "Enter the mobile number you gave the lab. We'll send you a code.",
  mobileLabel: "Mobile number",
  invalidMobile: "Please enter a 10-digit mobile number.",
  codeSentGeneric: (m) => `If this number has reports with us, we've sent a code to ${m}.`,
  changeNumber: "Use a different number",

  consentTitle: "Before you continue",
  consentPoints: [
    "Clara shows the test reports that Company A Labs made for this mobile number.",
    "We keep your name, mobile number and test results, stored in India, only to show and explain your reports.",
    "Lab staff can see when reports are opened. Every view is recorded.",
    "You can ask the lab to stop at any time.",
  ],
  consentAgree: "I agree to Clara using my health information as described above.",
  consentContinue: "Agree and continue",
  consentRequired: "Please tick the box to continue.",

  pickerTitle: "Whose reports?",
  pickerIntro: "This number is used by more than one person. Choose a name.",
  noPatientsTitle: "No reports for this number yet",
  noPatientsBody: "When the lab has a report for you, we'll send you a message.",

  ordersTitle: (name) => `Reports for ${name}`,
  statusReady: "Ready",
  statusProcessing: "Being tested",
  processingHint: "We'll send you a message when it's ready.",
  viewReport: "View report",
  orderLabel: (id) => `Order ${id}`,
  ordersEmpty: "No reports yet for this person.",
  choosePerson: "Choose another person",

  signedOn: (d) => `Signed on ${d}`,
  doctor: (name) => `Doctor: ${name}`,
  criticalTitle: "Please expect a call from the lab",
  criticalBody: "We are contacting you about this report. Please keep your phone with you.",
  resultsHeading: "Your results",
  normalRange: (r) => `Normal range: ${r}`,
  noRange: "No normal range given",
  downloadPdf: "Download full report (PDF)",
  summaryTitle: "Simple explanation",
  summaryPending: "A simple explanation of your results will appear here soon.",
  disclaimer: "Explanation, not a diagnosis. Your doctor will advise you.",
  notReadyTitle: "Your report is not ready yet",
  notReadyBody: "The lab is still testing your sample. We'll send you a message when it's ready.",
  allReports: "All reports",
  notFoundTitle: "We couldn't find this report",
  notFoundBody: "It may belong to a different mobile number.",

  flags: { NORMAL: "Normal", LOW: "Low", HIGH: "High", CRITICAL: "Critical", UNKNOWN: "Ask doctor" },
};

const te: PatientStrings = {
  signOut: "సైన్ అవుట్",
  loading: "లోడ్ అవుతోంది…",
  errorTitle: "ఏదో పొరపాటు జరిగింది",
  errorBody: "దయచేసి కొద్దిసేపటి తర్వాత మళ్ళీ ప్రయత్నించండి.",
  tryAgain: "మళ్ళీ ప్రయత్నించండి",
  languageLabel: "భాష",

  linkReadyTitle: "మీ పరీక్ష రిపోర్ట్ సిద్ధంగా ఉంది",
  linkSendCodeTo: (m) => `మీ రిపోర్ట్ గోప్యంగా ఉండటానికి, ${m} కు 6 అంకెల కోడ్ పంపుతాము.`,
  sendCode: "కోడ్ పంపండి",
  codeSentTo: (m) => `${m} కు 6 అంకెల కోడ్ పంపాము.`,
  codeLabel: "6 అంకెల కోడ్",
  openReport: "నా రిపోర్ట్ తెరవండి",
  continueButton: "కొనసాగించండి",
  resendCode: "కొత్త కోడ్ పంపండి",
  otpWrong: (left) => `ఈ కోడ్ సరైనది కాదు. ఇంకా ${left} సార్లు ప్రయత్నించవచ్చు.`,
  otpLocked: "చాలాసార్లు తప్పు కోడ్ ఇచ్చారు. దయచేసి కొత్త కోడ్ పంపండి.",
  otpExpired: "ఈ కోడ్ గడువు ముగిసింది. దయచేసి కొత్త కోడ్ పంపండి.",
  otpNoCode: "ఈ కోడ్ పని చేయలేదు. దయచేసి కొత్త కోడ్ పంపండి.",
  otpFormat: "మెసేజ్‌లోని 6 అంకెలు నమోదు చేయండి.",
  otpRateLimited: (min) => `చాలా కోడ్‌లు పంపబడ్డాయి. దయచేసి ${min} నిమిషాల తర్వాత ప్రయత్నించండి.`,
  linkInvalidTitle: "ఈ లింక్ పని చేయడం లేదు",
  linkInvalidBody: "లింక్ సరిగ్గా కాపీ కాకపోయి ఉండవచ్చు. మీ మొబైల్ నంబర్‌తో సైన్ ఇన్ చేసి మీ రిపోర్ట్‌లు చూడవచ్చు.",
  linkExpiredTitle: "ఈ లింక్ గడువు ముగిసింది",
  linkExpiredBody: "మీ గోప్యత కోసం, రిపోర్ట్ లింక్‌లు 3 రోజులు మాత్రమే పని చేస్తాయి. మీ రిపోర్ట్‌లు చూడటానికి మీ మొబైల్ నంబర్‌తో సైన్ ఇన్ చేయండి.",
  linkRevokedTitle: "ఈ లింక్ స్థానంలో కొత్తది పంపబడింది",
  linkRevokedBody: "ల్యాబ్ మీకు కొత్త లింక్ పంపింది. తాజా మెసేజ్‌ను ఉపయోగించండి, లేదా మీ మొబైల్ నంబర్‌తో సైన్ ఇన్ చేయండి.",
  signInWithMobile: "మొబైల్ నంబర్‌తో సైన్ ఇన్ చేయండి",

  loginTitle: "మీ రిపోర్ట్‌లు చూడండి",
  loginIntro: "ల్యాబ్‌కు ఇచ్చిన మొబైల్ నంబర్ నమోదు చేయండి. మేము మీకు కోడ్ పంపుతాము.",
  mobileLabel: "మొబైల్ నంబర్",
  invalidMobile: "దయచేసి 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి.",
  codeSentGeneric: (m) => `ఈ నంబర్‌కు మా దగ్గర రిపోర్ట్‌లు ఉంటే, ${m} కు కోడ్ పంపాము.`,
  changeNumber: "వేరే నంబర్ ఉపయోగించండి",

  consentTitle: "కొనసాగించే ముందు",
  consentPoints: [
    "ఈ మొబైల్ నంబర్ కోసం Company A ల్యాబ్స్ తయారు చేసిన పరీక్ష రిపోర్ట్‌లను Clara చూపిస్తుంది.",
    "మీ రిపోర్ట్‌లు చూపించడానికి మరియు వివరించడానికి మాత్రమే మీ పేరు, మొబైల్ నంబర్ మరియు పరీక్ష ఫలితాలను భారతదేశంలో భద్రపరుస్తాము.",
    "రిపోర్ట్‌లు ఎప్పుడు తెరిచారో ల్యాబ్ సిబ్బంది చూడగలరు. ప్రతి వీక్షణ నమోదు చేయబడుతుంది.",
    "మీరు ఎప్పుడైనా ఆపమని ల్యాబ్‌ను అడగవచ్చు.",
  ],
  consentAgree: "పైన వివరించిన విధంగా Clara నా ఆరోగ్య సమాచారాన్ని ఉపయోగించడానికి నేను అంగీకరిస్తున్నాను.",
  consentContinue: "అంగీకరించి కొనసాగించండి",
  consentRequired: "కొనసాగించడానికి దయచేసి బాక్స్‌ను టిక్ చేయండి.",

  pickerTitle: "ఎవరి రిపోర్ట్‌లు?",
  pickerIntro: "ఈ నంబర్‌ను ఒకరి కంటే ఎక్కువ మంది ఉపయోగిస్తున్నారు. ఒక పేరు ఎంచుకోండి.",
  noPatientsTitle: "ఈ నంబర్‌కు ఇంకా రిపోర్ట్‌లు లేవు",
  noPatientsBody: "ల్యాబ్ వద్ద మీ రిపోర్ట్ సిద్ధమైనప్పుడు మీకు మెసేజ్ పంపుతాము.",

  ordersTitle: (name) => `${name} రిపోర్ట్‌లు`,
  statusReady: "సిద్ధంగా ఉంది",
  statusProcessing: "పరీక్ష జరుగుతోంది",
  processingHint: "సిద్ధమైనప్పుడు మీకు మెసేజ్ పంపుతాము.",
  viewReport: "రిపోర్ట్ చూడండి",
  orderLabel: (id) => `ఆర్డర్ ${id}`,
  ordersEmpty: "ఈ వ్యక్తికి ఇంకా రిపోర్ట్‌లు లేవు.",
  choosePerson: "వేరే వ్యక్తిని ఎంచుకోండి",

  signedOn: (d) => `సంతకం చేసిన తేదీ: ${d}`,
  doctor: (name) => `డాక్టర్: ${name}`,
  criticalTitle: "దయచేసి ల్యాబ్ నుండి కాల్ కోసం వేచి ఉండండి",
  criticalBody: "ఈ రిపోర్ట్ గురించి మేము మిమ్మల్ని సంప్రదిస్తున్నాము. దయచేసి మీ ఫోన్‌ను దగ్గర ఉంచుకోండి.",
  resultsHeading: "మీ ఫలితాలు",
  normalRange: (r) => `సాధారణ పరిధి: ${r}`,
  noRange: "సాధారణ పరిధి ఇవ్వలేదు",
  downloadPdf: "పూర్తి రిపోర్ట్ డౌన్‌లోడ్ చేయండి (PDF)",
  summaryTitle: "సులభమైన వివరణ",
  summaryPending: "మీ ఫలితాల సులభమైన వివరణ త్వరలో ఇక్కడ కనిపిస్తుంది.",
  disclaimer: "ఇది వివరణ మాత్రమే, రోగ నిర్ధారణ కాదు. మీ డాక్టర్ మీకు సలహా ఇస్తారు.",
  notReadyTitle: "మీ రిపోర్ట్ ఇంకా సిద్ధం కాలేదు",
  notReadyBody: "ల్యాబ్ ఇంకా మీ నమూనాను పరీక్షిస్తోంది. సిద్ధమైనప్పుడు మీకు మెసేజ్ పంపుతాము.",
  allReports: "అన్ని రిపోర్ట్‌లు",
  notFoundTitle: "ఈ రిపోర్ట్ కనుగొనలేకపోయాము",
  notFoundBody: "ఇది వేరే మొబైల్ నంబర్‌కు చెందినది కావచ్చు.",

  flags: { NORMAL: "సాధారణం", LOW: "తక్కువ", HIGH: "ఎక్కువ", CRITICAL: "అత్యవసరం", UNKNOWN: "డాక్టర్‌ను అడగండి" },
};

const hi: PatientStrings = {
  signOut: "साइन आउट",
  loading: "लोड हो रहा है…",
  errorTitle: "कुछ गड़बड़ हो गई",
  errorBody: "कृपया थोड़ी देर बाद फिर से कोशिश करें।",
  tryAgain: "फिर से कोशिश करें",
  languageLabel: "भाषा",

  linkReadyTitle: "आपकी जाँच रिपोर्ट तैयार है",
  linkSendCodeTo: (m) => `आपकी रिपोर्ट निजी रखने के लिए, हम ${m} पर 6 अंकों का कोड भेजेंगे।`,
  sendCode: "कोड भेजें",
  codeSentTo: (m) => `हमने ${m} पर 6 अंकों का कोड भेजा है।`,
  codeLabel: "6 अंकों का कोड",
  openReport: "मेरी रिपोर्ट खोलें",
  continueButton: "आगे बढ़ें",
  resendCode: "नया कोड भेजें",
  otpWrong: (left) => `यह कोड सही नहीं है। ${left} बार और कोशिश कर सकते हैं।`,
  otpLocked: "बहुत बार गलत कोड डाला गया। कृपया नया कोड भेजें।",
  otpExpired: "इस कोड की समय-सीमा खत्म हो गई है। कृपया नया कोड भेजें।",
  otpNoCode: "यह कोड काम नहीं किया। कृपया नया कोड भेजें।",
  otpFormat: "संदेश में आए 6 अंक डालें।",
  otpRateLimited: (min) => `बहुत सारे कोड भेजे जा चुके हैं। कृपया ${min} मिनट बाद कोशिश करें।`,
  linkInvalidTitle: "यह लिंक काम नहीं कर रहा",
  linkInvalidBody: "हो सकता है लिंक सही से कॉपी न हुआ हो। आप अपने मोबाइल नंबर से साइन इन करके अपनी रिपोर्ट देख सकते हैं।",
  linkExpiredTitle: "इस लिंक की समय-सीमा खत्म हो गई है",
  linkExpiredBody: "आपकी निजता के लिए, रिपोर्ट लिंक 3 दिन तक ही काम करते हैं। अपनी रिपोर्ट देखने के लिए अपने मोबाइल नंबर से साइन इन करें।",
  linkRevokedTitle: "इस लिंक की जगह नया लिंक भेजा गया है",
  linkRevokedBody: "लैब ने आपको नया लिंक भेजा है। सबसे नया संदेश इस्तेमाल करें, या अपने मोबाइल नंबर से साइन इन करें।",
  signInWithMobile: "मोबाइल नंबर से साइन इन करें",

  loginTitle: "अपनी रिपोर्ट देखें",
  loginIntro: "लैब को दिया गया मोबाइल नंबर डालें। हम आपको एक कोड भेजेंगे।",
  mobileLabel: "मोबाइल नंबर",
  invalidMobile: "कृपया 10 अंकों का मोबाइल नंबर डालें।",
  codeSentGeneric: (m) => `अगर इस नंबर पर हमारे पास रिपोर्ट हैं, तो हमने ${m} पर कोड भेजा है।`,
  changeNumber: "दूसरा नंबर इस्तेमाल करें",

  consentTitle: "आगे बढ़ने से पहले",
  consentPoints: [
    "Clara इस मोबाइल नंबर के लिए Company A लैब्स की बनाई जाँच रिपोर्ट दिखाता है।",
    "आपकी रिपोर्ट दिखाने और समझाने के लिए ही हम आपका नाम, मोबाइल नंबर और जाँच के नतीजे भारत में सुरक्षित रखते हैं।",
    "लैब के कर्मचारी देख सकते हैं कि रिपोर्ट कब खोली गई। हर बार देखने का रिकॉर्ड रखा जाता है।",
    "आप कभी भी लैब से इसे बंद करने के लिए कह सकते हैं।",
  ],
  consentAgree: "मैं ऊपर बताए अनुसार Clara को अपनी स्वास्थ्य जानकारी इस्तेमाल करने की सहमति देता/देती हूँ।",
  consentContinue: "सहमत हूँ, आगे बढ़ें",
  consentRequired: "आगे बढ़ने के लिए कृपया बॉक्स पर टिक करें।",

  pickerTitle: "किसकी रिपोर्ट?",
  pickerIntro: "यह नंबर एक से ज़्यादा लोग इस्तेमाल करते हैं। एक नाम चुनें।",
  noPatientsTitle: "इस नंबर पर अभी कोई रिपोर्ट नहीं है",
  noPatientsBody: "जब लैब के पास आपकी रिपोर्ट होगी, हम आपको संदेश भेजेंगे।",

  ordersTitle: (name) => `${name} की रिपोर्ट`,
  statusReady: "तैयार",
  statusProcessing: "जाँच चल रही है",
  processingHint: "तैयार होने पर हम आपको संदेश भेजेंगे।",
  viewReport: "रिपोर्ट देखें",
  orderLabel: (id) => `ऑर्डर ${id}`,
  ordersEmpty: "इस व्यक्ति की अभी कोई रिपोर्ट नहीं है।",
  choosePerson: "दूसरा व्यक्ति चुनें",

  signedOn: (d) => `हस्ताक्षर की तारीख: ${d}`,
  doctor: (name) => `डॉक्टर: ${name}`,
  criticalTitle: "कृपया लैब के फ़ोन का इंतज़ार करें",
  criticalBody: "इस रिपोर्ट के बारे में हम आपसे संपर्क कर रहे हैं। कृपया अपना फ़ोन पास रखें।",
  resultsHeading: "आपके नतीजे",
  normalRange: (r) => `सामान्य सीमा: ${r}`,
  noRange: "सामान्य सीमा नहीं दी गई",
  downloadPdf: "पूरी रिपोर्ट डाउनलोड करें (PDF)",
  summaryTitle: "आसान भाषा में",
  summaryPending: "आपके नतीजों की आसान व्याख्या जल्द ही यहाँ दिखेगी।",
  disclaimer: "यह व्याख्या है, निदान नहीं। आपके डॉक्टर आपको सलाह देंगे।",
  notReadyTitle: "आपकी रिपोर्ट अभी तैयार नहीं है",
  notReadyBody: "लैब अभी आपके सैंपल की जाँच कर रही है। तैयार होने पर हम आपको संदेश भेजेंगे।",
  allReports: "सभी रिपोर्ट",
  notFoundTitle: "यह रिपोर्ट नहीं मिली",
  notFoundBody: "हो सकता है यह किसी दूसरे मोबाइल नंबर की हो।",

  flags: { NORMAL: "सामान्य", LOW: "कम", HIGH: "ज़्यादा", CRITICAL: "गंभीर", UNKNOWN: "डॉक्टर से पूछें" },
};

const STRINGS: Record<Lang, PatientStrings> = { en, te, hi };

export function patientStrings(lang: Lang): PatientStrings {
  return STRINGS[lang];
}

export function flagLabel(strings: PatientStrings, flag: ResultFlag): string {
  return flag === "CRITICAL_LOW" || flag === "CRITICAL_HIGH" ? strings.flags.CRITICAL : strings.flags[flag];
}

export function formatDate(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(date);
}
