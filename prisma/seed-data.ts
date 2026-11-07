/**
 * Demo data. Every person here is fictional. Mobiles use the 90000 0000xx
 * placeholder range and no message is ever really sent (the outbox is mocked).
 *
 * Values are written the way the LIS would export them (text, LIS status
 * words, mixed mobile formats) so the seed goes through the same parsing as
 * a real import.
 */

export type SeedResult = {
  parameter: string;
  unit: string;
  value: string;
  range: string;
};

export type SeedOrder = {
  orderId: string;
  patient: string;
  mobile: string;
  status: "Processing" | "Ready" | "Ready (critical)";
  doctor: string;
  results: SeedResult[];
};

const FAMILY_MOBILE = "90000 00010"; // one phone shared by a family of three

export const SEED_ORDERS: SeedOrder[] = [
  // ---- The three sample rows from the brief, exactly as given ----
  {
    orderId: "ORD-71204",
    patient: "Lakshmi Prasanna K",
    mobile: "9000000001",
    status: "Ready",
    doctor: "Dr. S. Ramanaiah",
    results: [{ parameter: "Haemoglobin", unit: "g/dL", value: "10.2", range: "12.0-15.5" }],
  },
  {
    orderId: "ORD-71219",
    patient: "Venkata Rao M",
    mobile: "9000000002",
    status: "Processing",
    doctor: "Dr. P. Anitha",
    results: [{ parameter: "LDL cholesterol", unit: "mg/dL", value: "142", range: "0-100" }],
  },
  {
    orderId: "ORD-71233",
    patient: "Farzana Begum",
    mobile: "9000000003",
    status: "Ready (critical)",
    doctor: "Dr. K. Suresh",
    results: [{ parameter: "Potassium", unit: "mmol/L", value: "6.8", range: "3.5-5.1" }],
  },

  // ---- A family on one mobile ----
  {
    orderId: "ORD-71240",
    patient: "Suryanarayana Rao P",
    mobile: FAMILY_MOBILE,
    status: "Ready",
    doctor: "Dr. S. Ramanaiah",
    results: [
      { parameter: "Fasting glucose", unit: "mg/dL", value: "168", range: "70-100" },
      { parameter: "HbA1c", unit: "%", value: "7.8", range: "4.0-5.6" },
      { parameter: "Creatinine", unit: "mg/dL", value: "1.1", range: "0.7-1.3" },
    ],
  },
  {
    orderId: "ORD-71241",
    patient: "Padmavathi P",
    mobile: FAMILY_MOBILE,
    status: "Ready",
    doctor: "Dr. S. Ramanaiah",
    results: [
      { parameter: "TSH", unit: "µIU/mL", value: "3.1", range: "0.4-4.0" },
      { parameter: "Vitamin D", unit: "ng/mL", value: "14", range: "30-100" },
    ],
  },
  {
    orderId: "ORD-71242",
    patient: "Sai Kiran P",
    mobile: FAMILY_MOBILE,
    status: "Processing",
    doctor: "Dr. M. Swarupa Rani",
    results: [
      { parameter: "Platelets", unit: "/cumm", value: "2,10,000", range: "1,50,000-4,10,000" },
      { parameter: "Dengue NS1 antigen", unit: "", value: "Negative", range: "Negative" },
    ],
  },

  // ---- Other patients ----
  {
    orderId: "ORD-71250",
    patient: "Ramana Murthy G",
    mobile: "+91 90000 00004",
    status: "Ready (critical)",
    doctor: "Dr. K. Suresh",
    results: [{ parameter: "Random glucose", unit: "mg/dL", value: "452", range: "70-140" }],
  },
  {
    // The LIS says plain "Ready", but our rules find a critical value.
    orderId: "ORD-71255",
    patient: "Anjali Devi T",
    mobile: "09000000005",
    status: "Ready",
    doctor: "Dr. P. Anitha",
    results: [
      { parameter: "Haemoglobin", unit: "g/dL", value: "6.4", range: "12.0-15.5" },
      { parameter: "Platelets", unit: "/cumm", value: "1,80,000", range: "1,50,000-4,10,000" },
    ],
  },
  {
    orderId: "ORD-71260",
    patient: "Srinivas Reddy B",
    mobile: "9000000006",
    status: "Ready",
    doctor: "Dr. B. Nageswara Rao",
    results: [
      { parameter: "Total cholesterol", unit: "mg/dL", value: "212", range: "<200" },
      { parameter: "HDL cholesterol", unit: "mg/dL", value: "38", range: ">40" },
      { parameter: "LDL cholesterol", unit: "mg/dL", value: "128", range: "0-100" },
    ],
  },
  {
    // Everything normal: the "good news" screen.
    orderId: "ORD-71262",
    patient: "Mahalakshmi V",
    mobile: "9000000007",
    status: "Ready",
    doctor: "Dr. M. Swarupa Rani",
    results: [
      { parameter: "Creatinine", unit: "mg/dL", value: "0.9", range: "0.6-1.1" },
      { parameter: "TSH", unit: "µIU/mL", value: "2.2", range: "0.4-4.0" },
    ],
  },
  {
    orderId: "ORD-71265",
    patient: "Abdul Rahim S",
    mobile: "9000000008",
    status: "Processing",
    doctor: "Dr. B. Nageswara Rao",
    results: [{ parameter: "HbA1c", unit: "%", value: "6.1", range: "4.0-5.6" }],
  },
  {
    orderId: "ORD-71270",
    patient: "Kavya Sri N",
    mobile: "9000000009",
    status: "Ready",
    doctor: "Dr. P. Anitha",
    results: [
      { parameter: "Haemoglobin", unit: "g/dL", value: "12.8", range: "12.0-15.5" },
      { parameter: "Platelets", unit: "/cumm", value: "98,000", range: "1,50,000-4,10,000" },
    ],
  },
  {
    orderId: "ORD-71272",
    patient: "Prasad Babu Ch",
    mobile: "9000000011",
    status: "Ready (critical)",
    doctor: "Dr. K. Suresh",
    results: [
      { parameter: "Potassium", unit: "mmol/L", value: "2.5", range: "3.5-5.1" },
      { parameter: "Sodium", unit: "mmol/L", value: "132", range: "135-145" },
    ],
  },
  {
    orderId: "ORD-71275",
    patient: "Bhavani Shankar K",
    mobile: "9000000012",
    status: "Ready",
    doctor: "Dr. S. Ramanaiah",
    results: [
      { parameter: "Vitamin D", unit: "ng/mL", value: "32", range: "30-100" },
      { parameter: "Urine sugar", unit: "", value: "Nil", range: "Nil" },
    ],
  },
];
