// The phone agent's TTS/translation table (app/services/call_phrases.py) only covers
// these eleven codes — notably no Bengali, unlike the web assistant's language list
// above. Offering a code the backend can't speak would either silently fall back to
// English or, for the keypad menu, get filtered out server-side with no explanation
// in the UI, so the two pickers intentionally use separate lists.
export const PHONE_LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिंदी' },
  { code: 'ar', name: 'العربية' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ur', name: 'اردو' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
];
export const MAX_MENU_OPTIONS = 4;
export const DIGIT_CHOICES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// The kind's built-in text, shown as the field's placeholder so leaving it blank is a
// clearly reversible choice, not a mystery.
export const SMS_WORDING_KINDS = [
  { key: 'booked', label: 'When an appointment is booked', builtIn: '{business}: your appointment is confirmed for {when}.' },
  { key: 'rescheduled', label: 'When an appointment is moved', builtIn: '{business}: your appointment has been moved to {when}.' },
  { key: 'cancelled', label: 'When an appointment is cancelled', builtIn: '{business}: your appointment on {when} has been cancelled. Call us any time to book a new one.' },
  { key: 'reminder', label: 'Reminder before the appointment', builtIn: '{business}: reminder - your appointment is {when}. Call us if you need to change it.' },
  { key: 'pending', label: 'When a request needs approval', builtIn: "{business}: we received your request for {when}. We'll confirm by text shortly." },
  { key: 'declined', label: "When a time can't be confirmed", builtIn: "{business}: sorry, we can't confirm {when}. Please call us to find another time." },
  { key: 'cancellation_declined', label: 'When a cancellation request is turned down', builtIn: '{business}: we were not able to cancel your appointment on {when}. It is still on the books - call us with any questions.' },
];

// A curated starting list, not an enum enforced server-side — the field stays a
// free string so a business whose type isn't listed can still type it via "Other".
export const BUSINESS_TYPE_OPTIONS = [
  'Dental Clinic', 'Medical Clinic', 'Chiropractor', 'Law Firm', 'Real Estate Agency', 'Restaurant',
  'Salon / Spa', 'Home Services (Plumbing, Electrical, HVAC)', 'Auto Repair Shop',
  'Fitness Studio / Gym', 'Retail Store', 'Accounting / Bookkeeping Firm',
  'Insurance Agency', 'Veterinary Clinic', 'Photography Studio', 'Consulting Firm',
];

// Capability choices are enforced by the server on every action.
export const AI_CAPABILITIES = [
  ...['schedule', 'reschedule', 'cancel', 'take_message', 'transfer_to_human', 'capture_lead', 'send_payment_link'].map((key) => ({ key, labelKey: `aiprof_cap_${key}`, supportsApproval: true })),
  ...[
    ['answer_calls', 'Answer calls'], ['outbound_calls', 'Make outbound calls'],
    ['send_sms', 'Send SMS'], ['send_email', 'Send email'], ['update_crm', 'Update CRM'],
    ['create_callback', 'Create callback requests'], ['create_task', 'Create tasks'],
    ['create_service_ticket', 'Create service tickets'], ['provide_pricing', 'Share approved pricing'],
    ['provide_quote', 'Provide quotes'], ['access_account_information', 'Access account information'],
    ['trigger_workflow', 'Trigger workflows'], ['notify_team', 'Notify team'],
  ].map(([key, label]) => ({ key, label, supportsApproval: true })),
];

// Mirrors INSURANCE_ELIGIBLE_BUSINESS_TYPES in industry_templates.py - where "do you
// take my insurance" actually comes up.
export const INSURANCE_ELIGIBLE_BUSINESS_TYPES = ['Dental Clinic', 'Medical Clinic', 'Chiropractor'];
export const NETWORK_STATUS_OPTIONS = ['in_network', 'out_of_network', 'plan_dependent', 'unknown'];

// Mirrors NotifyRole in app/schemas/smartflow.py.
export const NOTIFY_ROLE_OPTIONS = [
  'owner', 'front_desk', 'scheduling', 'sales', 'billing', 'insurance', 'customer_service',
  'clinical_staff', 'attorney_intake', 'agent', 'dispatch', 'manager', 'custom_team',
];

// Python's date.weekday(): 0=Monday ... 6=Sunday - matches business_hours.days already.
export const WEEKDAYS = [
  { value: 0, labelKey: 'aiprof_day_mon' },
  { value: 1, labelKey: 'aiprof_day_tue' },
  { value: 2, labelKey: 'aiprof_day_wed' },
  { value: 3, labelKey: 'aiprof_day_thu' },
  { value: 4, labelKey: 'aiprof_day_fri' },
  { value: 5, labelKey: 'aiprof_day_sat' },
  { value: 6, labelKey: 'aiprof_day_sun' },
];

// Every AI-writable field, in the same order they appear on the page - used to
// generate everything at once when Business Type changes. sms_* keys map onto
// callSettings.sms_wording[<key without the sms_ prefix>] rather than a top-level field.
export const RECEPTIONIST_FIELD_KEYS = [
  'greeting_inbound', 'greeting_outbound', 'closing_message', 'custom_instructions', 'knowledge_base', 'cancellation_policy',
  ...SMS_WORDING_KINDS.map((kind) => `sms_${kind.key}`),
];

export function getReceptionistFieldValue(callSettings, fieldKey) {
  if (fieldKey.startsWith('sms_')) {
    return callSettings?.sms_wording?.[fieldKey.slice(4)] || '';
  }
  return callSettings?.[fieldKey] || '';
}
