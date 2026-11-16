// Synthetic DEMO DATA. Every name, department, record and figure below is fictional and must never be presented as genuine government information.
import { performAction, submitApplication } from '../services/applications.js';
import { CHECKLIST } from './checklist.js';

const DEPARTMENTS = [
  ['Demo State School Education Department', 'Schools, scholarships, teachers and examinations', ['Education']],
  ['Demo State Health & Family Welfare Department', 'Hospitals, medicines, ambulances and public health programmes', ['Healthcare']],
  ['Demo State Transport Authority', 'Public buses, driving licences, vehicle registration and fares', ['Transportation']],
  ['Demo State Public Works Department', 'Roads, bridges, buildings and construction tenders', ['Infrastructure']],
  ['Demo State Personnel & Administration Department', 'Recruitment, transfers, service rules and certificates', ['Public administration']],
  ['Demo State Power Distribution Company', 'Electricity supply, connections, meters and outages', ['Electricity']],
  ['Demo State Water Supply & Sanitation Board', 'Drinking water supply, pipelines, water quality and sewage', ['Water supply']],
  ['Demo State Agriculture Department', 'Farmers, crop insurance, irrigation and subsidies', ['Agriculture']],
  ['Demo City Municipal Corporation', 'Garbage collection, street lights, sanitation, property tax and parks', ['Municipal services']],
];

const RECORDS = [
  ['Scholarship disbursement to government school students', 'Education', 0, 'Asked how many students received the merit scholarship in the 2022-23 session and the total amount paid.', 'The department reported that 1,240 students were sanctioned the merit scholarship. Funds were released in two instalments through direct bank transfer.'],
  ['Teacher vacancies in government colleges', 'Education', 0, 'Requested the number of vacant teaching posts in government colleges of the district and the recruitment status.', 'The department stated that recruitment for teaching posts had been advertised and the selection process was in progress. Vacancy position is updated every quarter.'],
  ['Availability of essential medicines at the district hospital', 'Healthcare', 1, 'Asked for the list of essential medicines available at the district hospital pharmacy during 2023.', 'The hospital supplied the essential medicines list for the year. Stock registers are maintained by the hospital pharmacy and audited every quarter.'],
  ['Ambulance response times in rural blocks', 'Healthcare', 1, 'Requested the average response time of emergency ambulances in rural blocks and the number of vehicles deployed.', 'The department reported 18 ambulances deployed across rural blocks. Average response time is recorded in the control room log and varies by block.'],
  ['City bus route changes and fare revision', 'Transportation', 2, 'Asked for details of bus route changes and the latest fare revision in the city.', 'The transport authority informed that fares were revised by a notified order. Route changes are published on the authority notice board before they take effect.'],
  ['Pending driving licence applications', 'Transportation', 2, 'Requested the number of driving licence applications pending beyond 30 days and the reasons for delay.', 'The licensing office reported pending applications mainly due to incomplete documents. Applicants are informed by message to submit missing documents.'],
  ['Bridge construction tender and contractor details', 'Infrastructure', 3, 'Asked for tender notice, contractor name and sanctioned cost of the river bridge construction project.', 'The department provided the tender notice number and sanctioned cost. The contract was awarded to the lowest eligible bidder after technical evaluation.'],
  ['Expenditure on state highway repair', 'Infrastructure', 3, 'Requested the amount spent on repair of the state highway section between two towns in 2022-23.', 'The division reported expenditure sanctioned under the annual maintenance plan. Bills are available for inspection at the divisional office.'],
  ['Grievance status at a government office', 'Public administration', 4, 'Asked for the current status and action taken on a grievance filed with the district office.', 'The office confirmed the grievance was registered and forwarded to the concerned section. The action taken report was sent to the applicant.'],
  ['Power outage hours in a rural feeder', 'Electricity', 5, 'Requested the total power outage hours recorded for a rural feeder during the last year.', 'The distribution company reported planned and unplanned outage hours from the feeder log. Maintenance shutdowns are notified in advance.'],
  ['New electricity connection delay', 'Electricity', 5, 'Asked for the time taken to sanction a new household electricity connection and the reasons for delay.', 'The company stated that connections are sanctioned after inspection and payment of the estimate. Delays arise when documents or site clearance are pending.'],
  ['Drinking water quality test reports', 'Water supply', 6, 'Requested the water quality test reports for drinking water in Sector 12 for 2023.', 'The board laboratory tested samples from borewells and pipelines every quarter. Reports are filed with the sector sub-division office.'],
  ['Pipeline repair work and tanker supply', 'Water supply', 6, 'Asked for pipeline repair work done and the tanker supply schedule for ward 9 during summer.', 'The board reported pipeline repairs completed in two phases. Tanker supply followed a daily schedule displayed at the ward office.'],
  ['Crop insurance claims settled', 'Agriculture', 7, 'Requested the number of crop insurance claims settled for farmers in the district for the 2022 season.', 'The agriculture department reported that 3,150 claims were settled for the season. Claim amounts were paid by the insurance company to farmers bank accounts.'],
  ['Fertiliser subsidy distribution', 'Agriculture', 7, 'Asked for details of fertiliser subsidy distribution among small farmers in the block.', 'The department stated that subsidy was provided through registered retailers. Beneficiary lists are maintained at the block agriculture office.'],
  ['Street light maintenance in ward 7', 'Municipal services', 8, 'Asked for the number of street lights repaired in ward 7 during 2023 and the maintenance expenditure.', 'The ward office reported 112 street lights repaired in 2023. Maintenance expenditure was recorded in the ward register.'],
  ['Garbage collection schedule and complaints', 'Municipal services', 8, 'Requested the garbage collection schedule for ward 4 and the number of complaints received.', 'The corporation published the collection schedule for the ward. Complaints are logged on the sanitation helpline register.'],
  ['Property tax assessment procedure', 'Municipal services', 8, 'Asked for the procedure and rates used for property tax assessment of residential buildings.', 'The corporation explained that assessment follows the approved rate schedule. Residents may file an objection within the notified period.'],
];

const OFFICERS = [['Officer Kavya Sample', 'officer.education', 0], ['Officer Imran Example', 'officer.health', 1], ['Officer Neha Placeholder', 'officer.municipal', 8], ['Officer Sanjay Demo', 'officer.water', 6], ['Officer Tara Sample', 'officer.pwd', 3], ['Officer Vikram Example', 'officer.power', 5]];
const CITIZENS = [['Aarav Demo', 'citizen1'], ['Priya Sample', 'citizen2'], ['Rohan Example', 'citizen3']];

const SAMPLE_APPS = [
  [0, 'Street light repairs in Ward 7', 'Please provide the number of street lights repaired in Ward 7 during 2023. Also provide the total amount spent on their maintenance and the name of the agency that carried out the work.', 'issue'],
  [0, 'Scholarship disbursement for Government Higher Secondary School', 'I request details of the scholarship amount disbursed to students of Government Higher Secondary School in the last academic year. Please provide the number of students who received it and the date of payment.', null],
  [1, 'Water quality reports for borewells in Sector 12', 'Please provide the drinking water quality test reports for the borewells in Sector 12 for 2023. Also provide the dates when samples were collected and the laboratory that tested them.', 'review'],
  [1, 'Ambulance response time at the district hospital', 'Please provide the average ambulance response time and the number of ambulances available at the district hospital. How many emergency calls were received last year?', 'approval'],
  [2, 'Crop insurance claim of my neighbour', 'Please provide the personal bank details and insurance claim amount received by a named farmer in my village.', 'reject'],
  [2, 'Bus route fare revision', 'Please provide details of the recent bus fare revision and the notified order. When did the new fares take effect and which routes were changed?', null],
];

const ISSUED_TEXT = `[DEMO DATA - officer-written sample response]

Subject: Response to RTI application - Street light repairs in Ward 7

Sir/Madam,

With reference to your application, the ward office has informed that 112 street lights were repaired in Ward 7 during 2023.
The maintenance expenditure is recorded in the ward register, which may be inspected at the ward office during working hours.
The name of the agency and the total amount are being furnished separately after verification of the payment vouchers.

Yours faithfully,
Public Information Officer, Demo City Municipal Corporation`;

export async function seedDemo(store, { hash, log = () => {}, opts = { timeoutMs: 4000 } } = {}) {
  const password = process.env.DEMO_PASSWORD || 'Demo@12345';
  const passwordHash = await hash(password);
  const deptIds = [];
  for (const [name, description, categories] of DEPARTMENTS) {
    const d = await store.insert('departments', { name: `${name} (DEMO)`, description, categories, contact: { email: 'info@demo.invalid', phone: '000-000-0000', address: 'Demo address (fictional)' }, active: true, isDemo: true });
    deptIds.push(d.id);
  }
  log(`departments: ${deptIds.length}`);
  const base = { passwordHash, active: true, isDemo: true, phone: '' };
  const admin = await store.insert('users', { ...base, name: 'Admin Demo', email: 'admin@rti-demo.test', role: 'admin', department: null });
  const officers = [];
  for (const [name, local, d] of OFFICERS) officers.push(await store.insert('users', { ...base, name, email: `${local}@rti-demo.test`, role: 'officer', department: deptIds[d] }));
  const citizens = [];
  for (const [name, local] of CITIZENS) citizens.push(await store.insert('users', { ...base, name, email: `${local}@rti-demo.test`, role: 'citizen', department: null }));
  log(`users: 1 admin, ${officers.length} officers, ${citizens.length} citizens`);

  for (const [i, [title, category, d, appSummary, respSummary]] of RECORDS.entries()) {
    await store.insert('historical_records', { recordId: `DEMO-HIST-${String(i + 1).padStart(3, '0')}`, title, department: deptIds[d], category, applicationSummary: appSummary, responseSummary: respSummary, embedding: [], embeddingModel: '', metadata: { synthetic: true, label: 'DEMO DATA' }, isDemo: true });
  }
  log(`historical records: ${RECORDS.length}`);

  for (const [c, subject, description, stage] of SAMPLE_APPS) {
    const app = await submitApplication(store, citizens[c], { subject, description, referenceInfo: 'Demo reference', department: null }, [], opts);
    const officer = officers.find((o) => o.id === app.assignedOfficer);
    if (!stage || !officer) continue;
    const act = (action, payload) => performAction(store, officer, app.applicationId, action, payload, opts);
    if (stage === 'reject') { await act('reject_application', { reason: 'DEMO: the request seeks personal information of a third party that is not related to any public activity.' }); continue; }
    await act('start_review');
    if (stage === 'review') continue;
    if (stage === 'approval') { await act('mark_ready'); continue; }
    await act('save_draft', { text: ISSUED_TEXT, note: 'DEMO: officer rewrote the AI draft' });
    await act('mark_ready'); await act('save_checklist', { checklist: Object.fromEntries(CHECKLIST.map((i) => [i.key, true])) }); await act('approve'); await act('issue');
  }
  log(`sample applications: ${SAMPLE_APPS.length} (run through the real workflow)`);
  return { password, admin };
}
