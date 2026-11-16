// Rule-based request quality checks for the application wizard and the assistant.
// These are transparent heuristics, not AI. They work best on English text.
import { detectLanguage } from './lang.js';

const PLACE = /\b(ward|district|block|sector|village|town|city|municipal|office|school|college|hospital|road|street|department|division|zone|tehsil|taluk|panchayat|corporation|board)\b/i;
const TIME = /\b(19|20)\d{2}\b|\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b|\b(last|past|previous|since|between|during|from)\b.{0,20}\b(year|month|week|session|quarter|decade)s?\b|\bfy\b|\bfinancial year\b/i;

export function checkRequest({ subject = '', description = '' }) {
  const text = `${subject}. ${description}`; const items = [];
  const add = (code, severity, message, suggestion) => items.push({ code, severity, message, suggestion });
  const lang = detectLanguage(description).code;
  if (description.trim().length < 60) add('short', 'warn', 'The request is very short.', 'Say exactly which records or figures you want and for which department.');
  if (lang === 'hi' || lang === 'mixed') return { items: [...items, { code: 'language', severity: 'info', message: 'Detailed checks run on English text.', suggestion: 'Use "Translate to English" to see the English version, then review it.' }], language: lang };
  if (!TIME.test(text)) add('time', 'warn', 'No time period is mentioned.', 'Add a year, date range or financial year, for example "between April 2022 and March 2023".');
  if (!PLACE.test(text)) add('place', 'warn', 'No place, office or institution is named.', 'Name the ward, district, office, school or hospital the request is about.');
  if ((description.match(/\?/g) || []).length > 2 && !/(^|\n)\s*(\d+[.)]|[-*])\s/.test(description)) add('numbering', 'info', 'There are several questions in one paragraph.', 'Number each item (1, 2, 3) so each can be answered separately.');
  if (/\b(why|do you think|your opinion|should the|is it right)\b/i.test(description)) add('opinion', 'info', 'The request may ask for reasons or opinions.', 'Ask for documents, orders, figures or file notings that exist, rather than explanations or opinions.');
  if (/\b(everything|all details|all information|any and all)\b/i.test(description)) add('vague', 'warn', 'The wording is very broad ("everything", "all details").', 'List the specific documents or data points you need.');
  if (/\b(bank account|aadhaar|aadhar|pan number|password|medical history|salary of)\b/i.test(description)) add('personal', 'warn', 'The request may involve personal information about a person.', 'Personal details of individuals are often withheld. Consider asking for aggregate or policy-level information.');
  if (/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(description)) add('id_number', 'warn', 'The text contains a 12-digit number that may be an ID number.', 'Remove personal ID numbers from the request text.');
  return { items, language: lang };
}
