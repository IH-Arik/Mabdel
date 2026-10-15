"""Per-industry vocabulary/safety data for the AI receptionist, seeded directly from
the client's "GoCustify AI Receptionist" spec (Dentist/Medical/Chiropractor/... each
have their own "Supported Intents" list and restrictions in that document).

This is deliberately NOT a separate engine per industry (the spec itself says "do not
build separate AI systems for every industry; use one engine + templates"). It is just
extra context rendered into the same prompt every business type already gets, keyed by
the business's own `business_type` string (see ``BUSINESS_TYPE_OPTIONS`` in
``Mabdel Website/src/pages/Profile/tabs/AIConfigTab.jsx`` - the two must stay in sync).

``supported_intents`` is vocabulary/context for the model, never a hard classifier -
the spec is explicit that keyword/intent matching must stay natural-language, not
keyword-to-fixed-action. ``emergency_keywords`` are ADDED to the built-in universal
list and the owner's own custom ones, never replacing them. ``safety_restrictions``
are additional "must not" lines specific to that industry (e.g. a dental/medical
business's AI must never diagnose) - these are universal good practice, not merely
US-specific, so they are not geofenced.
"""

from __future__ import annotations

UNRECOGNIZED_BUSINESS_TYPE_FALLBACK = "Other"

INDUSTRY_TEMPLATES: dict[str, dict] = {
    "Dental Clinic": {
        "supported_intents": [
            "NEW_PATIENT", "EXISTING_PATIENT", "APPOINTMENT_SCHEDULE", "APPOINTMENT_RESCHEDULE",
            "APPOINTMENT_CANCEL", "APPOINTMENT_CONFIRM", "CLEANING", "DENTAL_EXAM", "TOOTH_PAIN",
            "DENTAL_EMERGENCY", "COSMETIC_DENTISTRY", "IMPLANT_CONSULTATION", "ORTHODONTICS",
            "INSURANCE_QUESTION", "INSURANCE_ACCEPTED", "INSURANCE_IN_NETWORK", "INSURANCE_BENEFITS",
            "INSURANCE_VERIFICATION", "BILLING", "PRICING", "PRESCRIPTION_REQUEST", "RECORDS_REQUEST",
            "REFERRAL_REQUEST",
        ],
        "emergency_keywords": ["trouble breathing", "severe bleeding", "serious swelling", "serious trauma"],
        "safety_restrictions": [
            "diagnose a dental or medical condition", "prescribe or change medication",
            "guarantee insurance coverage", "interpret clinical or imaging results independently",
            "promise a specific treatment outcome",
        ],
    },
    "Medical Clinic": {
        "supported_intents": [
            "NEW_PATIENT", "EXISTING_PATIENT", "APPOINTMENT_SCHEDULE", "APPOINTMENT_RESCHEDULE",
            "APPOINTMENT_CANCEL", "APPOINTMENT_CONFIRM", "FOLLOW_UP_VISIT", "ANNUAL_EXAM",
            "REFERRAL_REQUEST", "PRESCRIPTION_REQUEST", "MEDICAL_RECORDS", "LAB_QUESTION",
            "INSURANCE_QUESTION", "INSURANCE_ACCEPTED", "INSURANCE_IN_NETWORK", "INSURANCE_BENEFITS",
            "INSURANCE_VERIFICATION", "MEDICARE_QUESTION", "MEDICAID_QUESTION", "BILLING",
            "MEDICAL_CONCERN", "MEDICAL_EMERGENCY",
        ],
        "emergency_keywords": ["trouble breathing", "severe bleeding", "serious swelling", "serious trauma"],
        "safety_restrictions": [
            "diagnose a medical condition", "prescribe or change medication", "guarantee insurance coverage",
            "interpret clinical or lab results independently", "promise a specific treatment outcome",
        ],
    },
    "Chiropractor": {
        "supported_intents": [
            "NEW_PATIENT", "EXISTING_PATIENT", "CONSULTATION_REQUEST", "APPOINTMENT_SCHEDULE",
            "APPOINTMENT_RESCHEDULE", "APPOINTMENT_CANCEL", "APPOINTMENT_CONFIRM", "ADJUSTMENT_APPOINTMENT",
            "FOLLOW_UP_VISIT", "NEW_PATIENT_EXAM", "PAIN_OR_SYMPTOM_CONCERN", "INSURANCE_QUESTION",
            "INSURANCE_ACCEPTED", "INSURANCE_IN_NETWORK", "INSURANCE_BENEFITS", "INSURANCE_VERIFICATION",
            "PRICING", "BILLING", "RECORDS_REQUEST",
        ],
        "emergency_keywords": ["trouble breathing", "severe bleeding", "serious swelling", "serious trauma"],
        "safety_restrictions": [
            "diagnose a condition or tell a caller what condition they have",
            "promise that chiropractic treatment will cure or resolve a condition",
            "recommend unsafe self-treatment", "guarantee that insurance covers treatment",
            "interpret imaging or clinical results independently",
        ],
    },
    "Salon / Spa": {
        "supported_intents": [
            "APPOINTMENT_SCHEDULE", "APPOINTMENT_RESCHEDULE", "APPOINTMENT_CANCEL", "SERVICE_INQUIRY",
            "HAIRCUT", "HAIR_COLOR", "NAILS", "FACIAL", "MASSAGE", "WAXING", "LASHES", "BROWS",
            "STYLIST_REQUEST", "PRICING",
        ],
        "emergency_keywords": [],
        "safety_restrictions": [],
    },
    "Law Firm": {
        "supported_intents": [
            "NEW_POTENTIAL_CLIENT", "EXISTING_CLIENT", "CONSULTATION_REQUEST", "CONSULTATION_RESCHEDULE",
            "CONSULTATION_CANCEL", "CASE_STATUS_REQUEST", "ATTORNEY_CALLBACK", "DOCUMENT_REQUEST",
            "BILLING", "PERSONAL_INJURY", "FAMILY_LAW", "CRIMINAL_DEFENSE", "IMMIGRATION", "BUSINESS_LAW",
            "ESTATE_PLANNING", "REAL_ESTATE_LAW", "EMPLOYMENT_LAW", "BANKRUPTCY",
        ],
        "emergency_keywords": [],
        "safety_restrictions": ["give legal advice", "predict a case outcome", "claim an attorney-client relationship exists"],
    },
    "Real Estate Agency": {
        "supported_intents": [
            "BUYER_LEAD", "SELLER_LEAD", "RENTER_LEAD", "PROPERTY_INQUIRY", "SHOWING_REQUEST",
            "SHOWING_RESCHEDULE", "SHOWING_CANCEL", "LISTING_CONSULTATION", "PROPERTY_VALUE_REQUEST",
            "OPEN_HOUSE", "AGENT_CALLBACK",
        ],
        "emergency_keywords": [],
        "safety_restrictions": [],
    },
    "Home Services (Plumbing, Electrical, HVAC)": {
        "supported_intents": [
            "NEW_SERVICE_REQUEST", "SERVICE_APPOINTMENT", "RESCHEDULE_SERVICE", "CANCEL_SERVICE",
            "ESTIMATE_REQUEST", "ESTIMATE_FOLLOW_UP", "TECHNICIAN_STATUS", "EXISTING_JOB", "WARRANTY",
            "MAINTENANCE", "EMERGENCY_SERVICE", "BILLING", "SERVICE_AREA", "PRICING",
            "AC_NOT_COOLING", "HEATING_NOT_WORKING", "LEAK", "CLOGGED_DRAIN", "WATER_HEATER",
            "POWER_ISSUE", "OUTLET_ISSUE", "PANEL_UPGRADE",
        ],
        "emergency_keywords": ["fire", "smoke", "gas smell", "carbon monoxide", "electrical hazard", "flooding"],
        "safety_restrictions": ["give dangerous electrical, gas, fire, or other hazardous repair instructions"],
    },
    "Restaurant": {
        "supported_intents": [
            "NEW_RESERVATION", "RESERVATION_CHANGE", "RESERVATION_CANCEL", "RESERVATION_CONFIRM",
            "WAITLIST", "MENU_QUESTION", "HOURS", "LOCATION", "PRIVATE_EVENT", "CATERING",
            "LARGE_PARTY", "TAKEOUT_STATUS", "COMPLAINT", "MANAGER_REQUEST",
        ],
        "emergency_keywords": [],
        "safety_restrictions": [],
    },
    "Auto Repair Shop": {
        "supported_intents": [
            "SERVICE_APPOINTMENT", "RESCHEDULE_SERVICE", "CANCEL_SERVICE", "DIAGNOSTIC_REQUEST",
            "OIL_CHANGE", "BRAKES", "TIRES", "ENGINE", "TRANSMISSION", "BATTERY", "AC_REPAIR",
            "INSPECTION", "ESTIMATE_REQUEST", "REPAIR_STATUS", "VEHICLE_READY", "TOWING", "BILLING",
        ],
        "emergency_keywords": [],
        "safety_restrictions": [],
    },
    "Fitness Studio / Gym": {
        "supported_intents": [
            "MEMBERSHIP_INQUIRY", "NEW_MEMBERSHIP", "MEMBERSHIP_CANCEL", "MEMBERSHIP_FREEZE",
            "CLASS_BOOKING", "CLASS_RESCHEDULE", "CLASS_CANCEL", "PERSONAL_TRAINING", "TRIAL_CLASS",
            "TOUR_REQUEST", "CLASS_SCHEDULE", "PRICING", "BILLING",
        ],
        "emergency_keywords": [],
        "safety_restrictions": [],
    },
    "Retail Store": {
        "supported_intents": [
            "PRODUCT_AVAILABILITY", "PRODUCT_INFORMATION", "ORDER_STATUS", "ORDER_PICKUP", "ORDER_CANCEL",
            "RETURN_REQUEST", "EXCHANGE_REQUEST", "REFUND_STATUS", "STORE_HOURS", "STORE_LOCATION",
            "PROMOTION", "MANAGER_REQUEST", "COMPLAINT",
        ],
        "emergency_keywords": [],
        "safety_restrictions": [],
    },
    "Accounting / Bookkeeping Firm": {
        "supported_intents": [
            "NEW_CLIENT", "EXISTING_CLIENT", "CONSULTATION_REQUEST", "CONSULTATION_RESCHEDULE",
            "CONSULTATION_CANCEL", "TAX_PREPARATION", "BOOKKEEPING", "PAYROLL", "BUSINESS_TAX",
            "PERSONAL_TAX", "IRS_NOTICE", "DOCUMENT_REQUEST", "INVOICE_QUESTION", "PAYMENT_QUESTION",
            "ACCOUNTANT_CALLBACK",
        ],
        "emergency_keywords": [],
        "safety_restrictions": ["provide unsupported tax or legal conclusions"],
    },
    "Insurance Agency": {
        "supported_intents": [
            "NEW_QUOTE", "EXISTING_POLICY", "AUTO_INSURANCE", "HOME_INSURANCE", "RENTERS_INSURANCE",
            "COMMERCIAL_INSURANCE", "LIFE_INSURANCE", "POLICY_CHANGE_REQUEST", "POLICY_RENEWAL",
            "PAYMENT_QUESTION", "CLAIM_QUESTION", "CLAIM_STATUS", "DOCUMENT_REQUEST", "AGENT_CALLBACK",
            "APPOINTMENT",
        ],
        "emergency_keywords": [],
        "safety_restrictions": [
            "falsely claim to be a licensed insurance professional", "guarantee coverage",
            "make an unauthorized policy determination",
        ],
    },
    "Veterinary Clinic": {
        "supported_intents": [
            "NEW_CLIENT", "APPOINTMENT_SCHEDULE", "APPOINTMENT_RESCHEDULE", "APPOINTMENT_CANCEL",
            "WELLNESS_EXAM", "VACCINATION", "SICK_PET", "URGENT_PET_CONCERN", "EMERGENCY",
            "PRESCRIPTION_REQUEST", "RECORDS_REQUEST", "BOARDING", "GROOMING", "BILLING",
        ],
        "emergency_keywords": ["trouble breathing", "severe bleeding", "seizure", "serious trauma", "poisoning"],
        "safety_restrictions": ["diagnose a veterinary condition", "prescribe or change medication"],
    },
    "Photography Studio": {
        "supported_intents": [
            "NEW_INQUIRY", "SESSION_BOOKING", "RESCHEDULE_SESSION", "CANCEL_SESSION", "WEDDING_PHOTOGRAPHY",
            "PORTRAIT_SESSION", "FAMILY_SESSION", "EVENT_PHOTOGRAPHY", "COMMERCIAL_PHOTOGRAPHY",
            "REAL_ESTATE_PHOTOGRAPHY", "PRICING", "PACKAGE_QUESTION", "AVAILABILITY", "PHOTO_DELIVERY",
        ],
        "emergency_keywords": [],
        "safety_restrictions": [],
    },
    "Consulting Firm": {
        "supported_intents": [
            "NEW_LEAD", "EXISTING_CLIENT", "CONSULTATION_REQUEST", "CONSULTATION_RESCHEDULE",
            "CONSULTATION_CANCEL", "SERVICE_INQUIRY", "PROJECT_STATUS", "PROPOSAL_QUESTION", "PRICING",
            "CONTRACT", "DOCUMENT_REQUEST", "CONSULTANT_CALLBACK", "BILLING",
        ],
        "emergency_keywords": [],
        "safety_restrictions": [],
    },
    UNRECOGNIZED_BUSINESS_TYPE_FALLBACK: {
        "supported_intents": [
            "GENERAL_INQUIRY", "NEW_CUSTOMER", "EXISTING_CUSTOMER", "APPOINTMENT_SCHEDULE",
            "APPOINTMENT_RESCHEDULE", "APPOINTMENT_CANCEL", "SERVICE_REQUEST", "QUOTE_REQUEST",
            "ORDER_STATUS", "BILLING", "PRICING", "PRODUCT_INFORMATION", "SERVICE_INFORMATION",
            "BUSINESS_HOURS", "LOCATION",
        ],
        "emergency_keywords": [],
        "safety_restrictions": [],
    },
}


def get_industry_template(business_type: str | None) -> dict:
    """Named types match exactly (same list the owner picks from in Settings); anything
    else - blank, a custom/"Other" business type, or free text the owner typed - safely
    falls back to the generic template rather than ever failing to build a prompt."""
    return INDUSTRY_TEMPLATES.get((business_type or "").strip()) or INDUSTRY_TEMPLATES[UNRECOGNIZED_BUSINESS_TYPE_FALLBACK]
