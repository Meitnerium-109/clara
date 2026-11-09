/**
 * Locked explanation templates for the 8 most common tests, in 3 languages.
 * Reviewed text that never changes, used instead of AI wherever it applies.
 *
 * Each template is three short sentences: the result against the range (the
 * same wording for every test), what the test measures (written per test),
 * and "your doctor will explain". {test} is filled with the lab's own test
 * name, so every language names the test exactly as the report does.
 *
 * ASSUMPTION: Telugu and Hindi were AI-translated and need a native reviewer.
 */

import type { Lang } from "../i18n/patient";

type Direction = "LOW" | "HIGH";
type Translated = Record<Lang, string>;

const RESULT_SENTENCE: Record<Direction, Translated> = {
  LOW: {
    en: "Your {test} result is {value}. This is lower than the normal range ({range}).",
    te: "మీ {test} ఫలితం {value}. ఇది సాధారణ పరిధి ({range}) కంటే తక్కువగా ఉంది.",
    hi: "आपका {test} नतीजा {value} है। यह सामान्य सीमा ({range}) से कम है।",
  },
  HIGH: {
    en: "Your {test} result is {value}. This is higher than the normal range ({range}).",
    te: "మీ {test} ఫలితం {value}. ఇది సాధారణ పరిధి ({range}) కంటే ఎక్కువగా ఉంది.",
    hi: "आपका {test} नतीजा {value} है। यह सामान्य सीमा ({range}) से ज़्यादा है।",
  },
};

const CLOSING: Translated = {
  en: "Your doctor will explain what this means for you.",
  te: "దీని అర్థం ఏమిటో మీ డాక్టర్ మీకు వివరిస్తారు.",
  hi: "इसका आपके लिए क्या मतलब है, यह आपके डॉक्टर बताएँगे।",
};

type TestTemplate = { key: string; aliases: string[]; measures: Translated };

export const TEMPLATED_TESTS: TestTemplate[] = [
  {
    key: "haemoglobin",
    aliases: ["haemoglobin", "hemoglobin", "hb", "hgb"],
    measures: {
      en: "{test} carries oxygen around your body in the blood.",
      te: "{test} రక్తంలో ఆక్సిజన్‌ను శరీరమంతా తీసుకువెళ్తుంది.",
      hi: "{test} खून में ऑक्सीजन को पूरे शरीर तक पहुँचाता है।",
    },
  },
  {
    key: "ldl",
    aliases: ["ldl cholesterol", "ldl", "ldl-c", "ldl c"],
    measures: {
      en: "{test} is a type of fat in the blood that doctors check for heart health.",
      te: "{test} రక్తంలో ఉండే ఒక రకమైన కొవ్వు. గుండె ఆరోగ్యం కోసం డాక్టర్లు దీన్ని చూస్తారు.",
      hi: "{test} खून में एक तरह की चर्बी है, जिसे डॉक्टर दिल की सेहत के लिए देखते हैं।",
    },
  },
  {
    key: "fasting-glucose",
    aliases: ["fasting glucose", "fasting blood sugar", "fasting blood glucose", "fbs", "glucose fasting"],
    measures: {
      en: "{test} is the amount of sugar in your blood after not eating overnight.",
      te: "{test} అంటే రాత్రంతా ఏమీ తినకుండా ఉన్న తర్వాత రక్తంలో ఉండే చక్కెర పరిమాణం.",
      hi: "{test} रात भर कुछ न खाने के बाद खून में शुगर की मात्रा है।",
    },
  },
  {
    key: "hba1c",
    aliases: ["hba1c", "glycated haemoglobin", "glycated hemoglobin", "a1c"],
    measures: {
      en: "{test} shows your average blood sugar over the last 2 to 3 months.",
      te: "{test} గత 2 నుండి 3 నెలల సగటు రక్తంలో చక్కెరను చూపిస్తుంది.",
      hi: "{test} पिछले 2 से 3 महीनों की औसत ब्लड शुगर दिखाता है।",
    },
  },
  {
    key: "tsh",
    aliases: ["tsh", "thyroid stimulating hormone"],
    measures: {
      en: "{test} is a hormone that tells the thyroid gland in your neck how hard to work.",
      te: "{test} అనేది మెడలోని థైరాయిడ్ గ్రంథి ఎంత పని చేయాలో చెప్పే ఒక హార్మోన్.",
      hi: "{test} एक हार्मोन है जो गले में मौजूद थायरॉइड ग्रंथि को बताता है कि उसे कितना काम करना है।",
    },
  },
  {
    key: "creatinine",
    aliases: ["creatinine", "serum creatinine"],
    measures: {
      en: "{test} is a waste product that your kidneys clean out of the blood.",
      te: "{test} అనేది మూత్రపిండాలు రక్తం నుండి బయటకు పంపే ఒక వ్యర్థ పదార్థం.",
      hi: "{test} एक बेकार पदार्थ है जिसे गुर्दे खून से साफ़ करते हैं।",
    },
  },
  {
    key: "platelets",
    aliases: ["platelets", "platelet count", "plt"],
    measures: {
      en: "{test} are tiny cells in the blood that help stop bleeding.",
      te: "{test} రక్తస్రావం ఆగడానికి సహాయపడే రక్తంలోని చిన్న కణాలు.",
      hi: "{test} खून की छोटी कोशिकाएँ हैं जो खून बहना रोकने में मदद करती हैं।",
    },
  },
  {
    key: "vitamin-d",
    aliases: ["vitamin d", "vitamin d 25-oh", "25-oh vitamin d", "25 oh vitamin d", "vitamin d3"],
    measures: {
      en: "{test} helps keep your bones and muscles strong.",
      te: "{test} మీ ఎముకలు మరియు కండరాలు బలంగా ఉండటానికి సహాయపడుతుంది.",
      hi: "{test} हड्डियों और मांसपेशियों को मज़बूत रखने में मदद करता है।",
    },
  },
];

const simplify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

export function findTemplate(parameter: string): TestTemplate | undefined {
  const name = simplify(parameter);
  return TEMPLATED_TESTS.find((t) => t.aliases.some((alias) => simplify(alias) === name));
}

export type TemplateInput = {
  parameter: string;
  valueText: string;
  unit: string;
  refText: string;
  flag: Direction;
};

/** "10.2 g/dL", and "12.0-15.5 g/dL" for the range. */
export function withUnit(text: string, unit: string): string {
  return unit ? `${text} ${unit}` : text;
}

export function renderTemplate(template: TestTemplate, input: TemplateInput, lang: Lang): string {
  const fill = (s: string) =>
    s
      .replaceAll("{test}", input.parameter)
      .replaceAll("{value}", withUnit(input.valueText, input.unit))
      .replaceAll("{range}", withUnit(input.refText, input.unit));
  return [RESULT_SENTENCE[input.flag][lang], template.measures[lang], CLOSING[lang]].map(fill).join(" ");
}
