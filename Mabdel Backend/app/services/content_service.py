from __future__ import annotations

from datetime import datetime
import re

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.schemas.content import ContentBlock, ContentPageResponse
from app.utils.helpers import utc_now


DEFAULT_CONTENT_PAGES: list[dict] = [
    {
        "slug": "about-us",
        "title": "About Us",
        "display_style": "numbered_list",
        "version": "1.0",
        "blocks": [
            {
                "order": 1,
                "body": "GoCustify AI brings customer messages, voice requests, documents, invoices, meetings, and business workflows into one assistant-led workspace.",
            },
            {
                "order": 2,
                "body": "The app is built for small teams and business owners who need faster follow-up, clearer records, and fewer repeated manual tasks.",
            },
            {
                "order": 3,
                "body": "SmartFlow keeps conversations, AI command history, call logs, calendar events, and notifications organized around the signed-in account.",
            },
            {
                "order": 4,
                "body": "Business profiles help teams present consistent company details across invoices, shared documents, outreach, and assistant-generated work.",
            },
            {
                "order": 5,
                "body": "GoCustify is designed with secure authentication, token-based sessions, and production APIs that mobile clients can use directly.",
            },
        ],
    },
    {
        "slug": "terms-and-conditions",
        "title": "Terms & Conditions",
        "display_style": "sections",
        "version": "2026.07.15",
        "blocks": [
            {"order": 1, "heading": "Last Updated", "body": "July 15, 2026"},
            {"order": 2, "body": "Welcome to GoCustify. These Terms and Conditions (\"Terms\") govern your access to and use of the website, software platform, applications, products, and services provided by GoCustify LLC (\"GoCustify,\" \"we,\" \"us,\" or \"our\") (collectively, the \"Services\"). By accessing or using the Services, you agree to be bound by these Terms. If you do not agree with these Terms, you may not access or use the Services."},
            {"order": 3, "heading": "1. About GoCustify", "body": "GoCustify is an AI-powered customer relationship management (CRM) platform designed to help businesses manage customer communications, appointments, workflows, documents, invoices, automation, and business operations. The Services may include features such as: AI-powered communication assistants; Voice and messaging automation; Customer relationship management tools; Appointment scheduling; Email and SMS automation; AI-generated content and responses; Document creation and management; Third-party integrations; Business analytics and reporting tools."},
            {"order": 4, "heading": "2. Eligibility", "body": "You must be at least 18 years old and have the legal authority to enter into these Terms on behalf of yourself or your business. If you use GoCustify on behalf of a company or organization, you represent that you have authority to bind that organization to these Terms."},
            {"order": 5, "heading": "3. Account Registration", "body": "To use certain features of GoCustify, you must create an account and provide accurate and complete information. You are responsible for: Maintaining the confidentiality of your login credentials; Keeping your account information accurate; All activities performed through your account; Managing user access and permissions within your organization.\n\nYou must notify GoCustify immediately if you suspect unauthorized access to your account."},
            {"order": 6, "heading": "4. Subscription and Payments", "body": "Some GoCustify features require a paid subscription. By subscribing, you agree to: Pay all applicable subscription fees; Provide accurate billing information; Authorize recurring charges according to your selected plan.\n\nSubscription fees are billed according to the plan selected at signup. GoCustify reserves the right to change pricing, plans, or available features with reasonable notice."},
            {"order": 7, "heading": "5. Communication Services", "body": "GoCustify may provide communication features including SMS, voice calls, email, and messaging integrations. You acknowledge that: Communication services may rely on third-party providers and networks. Delivery of messages and calls is not guaranteed due to carrier restrictions, network failures, regulations, or recipient settings. You are responsible for complying with all applicable communication laws and regulations. You agree not to use GoCustify to send: Spam messages; Unsolicited marketing communications; Illegal content; Misleading or deceptive communications.\n\nYou are responsible for obtaining proper customer consent before sending marketing communications."},
            {"order": 8, "heading": "6. AI Features and Generated Content", "body": "GoCustify uses artificial intelligence technologies to provide automated assistance and generate content. You acknowledge that: AI-generated content may contain errors or inaccuracies. You are responsible for reviewing and approving AI-generated responses, documents, messages, contracts, invoices, and other materials before use. GoCustify does not guarantee that AI-generated content will be suitable for every business purpose. You remain responsible for decisions made using information generated by AI features."},
            {"order": 9, "heading": "7. User Responsibilities", "body": "You agree to use GoCustify only for lawful purposes. You may not: Reverse engineer, copy, or modify the platform; Attempt to gain unauthorized access; Interfere with platform security or performance; Upload harmful software or malicious content; Use the Services in violation of applicable laws."},
            {"order": 10, "heading": "8. Data Ownership and Privacy", "body": "You retain ownership of the business information, customer data, documents, and content you upload or create using GoCustify. By using the Services, you grant GoCustify permission to process your data only as necessary to provide, maintain, secure, and improve the Services. GoCustify's collection and use of personal information is governed by our Privacy Policy."},
            {"order": 11, "heading": "9. Third-Party Services", "body": "GoCustify may integrate with third-party services, including communication providers, payment processors, calendars, social media platforms, and other software providers. GoCustify is not responsible for: Availability of third-party services; Changes made by third-party providers; Third-party terms, policies, or practices. Your use of third-party services may be subject to separate agreements."},
            {"order": 12, "heading": "10. Intellectual Property", "body": "All GoCustify software, trademarks, branding, designs, technology, and content are owned by or licensed to GoCustify. You may not use GoCustify intellectual property without prior written permission."},
            {"order": 13, "heading": "11. Service Availability", "body": "GoCustify works to maintain reliable service but does not guarantee uninterrupted availability. The Services may occasionally be unavailable due to: Maintenance; Updates; Technical issues; Third-party service interruptions."},
            {"order": 14, "heading": "12. Suspension and Termination", "body": "GoCustify may suspend or terminate accounts that: Violate these Terms; Abuse the Services; Create security risks; Engage in illegal activities. You may cancel your account according to your subscription terms. Upon termination, your access to certain Services may end."},
            {"order": 15, "heading": "13. Limitation of Liability", "body": "To the maximum extent permitted by law, GoCustify shall not be liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the Services. GoCustify's total liability shall not exceed the amount paid by you to GoCustify during the twelve (12) months preceding the event giving rise to the claim."},
            {"order": 16, "heading": "14. Disclaimer", "body": "GoCustify provides the Services on an \"as available\" basis. We do not guarantee: Specific business results; Increased revenue; Customer acquisition; Accuracy of AI-generated outputs; Availability of third-party integrations."},
            {"order": 17, "heading": "15. Changes to These Terms", "body": "GoCustify may update these Terms from time to time. Updated Terms will be posted on this page with a revised \"Last Updated\" date. Continued use of the Services after changes means you accept the updated Terms."},
            {"order": 18, "heading": "16. Governing Law", "body": "These Terms shall be governed by the laws of the jurisdiction where GoCustify operates, without regard to conflict of law principles."},
            {"order": 19, "heading": "17. Contact Information", "body": "For questions regarding these Terms, please contact:\nGoCustify. Email: support@gocustify.com. Website: https://www.gocustify.com/"},
        ],
    },
    {
        "slug": "privacy-policy",
        "title": "Privacy Policy",
        "display_style": "sections",
        "version": "2026.07.15",
        "blocks": [
            {"order": 1, "heading": "Last Updated", "body": "July 15, 2026"},
            {"order": 2, "body": "GoCustify LLC (\"GoCustify,\" \"we,\" \"us,\" or \"our\") respects your privacy and is committed to protecting the information you provide when using our website, software platform, applications, products, and services (collectively, the \"Services\"). This Privacy Policy explains how we collect, use, disclose, retain, and protect your information when you access or use the Services."},
            {"order": 3, "heading": "1. Information We Collect", "body": "We may collect account information such as name, business name, email address, phone number, billing information, and login credentials. We may also collect business data such as customer records, contacts, appointments, messages, documents, invoices, contracts, notes, and workflow information. Communication data may include phone numbers, SMS messages, call recordings if enabled, call transcripts, email communications, and communication history. Technical information may include IP address, browser type, device information, usage activity, and system logs."},
            {"order": 4, "heading": "2. How We Use Information", "body": "We use collected information to provide and operate GoCustify services, manage customer accounts, process subscriptions and payments, provide AI-powered assistance, enable communication features, improve platform performance, provide customer support, maintain security and prevent fraud, and comply with legal obligations."},
            {"order": 5, "heading": "3. AI Processing", "body": "GoCustify uses artificial intelligence technologies to provide features such as automated responses, content creation, workflow assistance, and communication automation. AI systems may process information provided by users in order to generate responses or perform requested actions. Users are responsible for reviewing AI-generated content before relying on it for business decisions."},
            {"order": 6, "heading": "4. Communication Data", "body": "If you use GoCustify communication features, information may be processed through third-party communication providers, including voice, SMS, email, and messaging service providers. We use such providers only as necessary to deliver requested services."},
            {"order": 7, "heading": "5. Sharing of Information", "body": "We do not sell your personal information. We may share information with service providers that help operate GoCustify, payment processors, cloud hosting providers, communication providers, integration partners requested by you, and legal authorities when required by law."},
            {"order": 8, "heading": "6. Data Security", "body": "We use reasonable administrative, technical, and organizational measures designed to protect your information. However, no internet-based service can guarantee complete security."},
            {"order": 9, "heading": "7. Data Retention", "body": "We retain information only as long as necessary to provide services, comply with legal requirements, resolve disputes, and enforce agreements."},
            {"order": 10, "heading": "8. Your Rights", "body": "Depending on applicable laws, you may request access to your information, correction of inaccurate information, deletion of information, export of your data, or restriction of certain processing."},
            {"order": 11, "heading": "9. Cookies", "body": "Our website may use cookies and similar technologies to improve user experience, analyze usage, and maintain website functionality."},
            {"order": 12, "heading": "10. Third-Party Links", "body": "GoCustify may contain links to third-party services. We are not responsible for their privacy practices."},
            {"order": 13, "heading": "11. Changes to This Policy", "body": "We may update this Privacy Policy periodically. Changes will be posted with an updated date."},
            {"order": 14, "heading": "12. Contact Us", "body": "GoCustify. Email: support@gocustify.com. Website: https://www.gocustify.com/"},
        ],
    },
    {
        "slug": "sms-messaging-policy",
        "title": "SMS Messaging Policy",
        "display_style": "sections",
        "version": "2026.07.15",
        "blocks": [
            {"order": 1, "heading": "Last Updated", "body": "July 15, 2026"},
            {"order": 2, "body": "This SMS Messaging Policy governs the use of SMS and text messaging services provided through GoCustify LLC (\"GoCustify,\" \"we,\" \"us,\" or \"our\"). GoCustify provides communication tools that allow businesses to communicate with their customers. Businesses using GoCustify are responsible for ensuring that their messaging activities comply with applicable laws, regulations, carrier requirements, and industry standards."},
            {"order": 3, "heading": "1. SMS Consent", "body": "Businesses using GoCustify must obtain appropriate consent from recipients before sending SMS or text messages where consent is required by applicable law. Consent may be collected through compliant methods such as: Website forms; Appointment or booking forms; Customer agreements; SMS opt-in forms; Keyword-based text opt-ins; or Other lawful and properly documented methods.\n\nBusinesses must clearly disclose what recipients are agreeing to receive. Users must not send unsolicited, unauthorized, or deceptive text messages. Where required, consent for marketing or promotional text messages must be obtained before those messages are sent. Consent records should be maintained by the business and made available when reasonably required for compliance purposes."},
            {"order": 4, "heading": "2. Types of Messages", "body": "Messages sent through GoCustify may include: Appointment reminders; Customer support communications; Service notifications; Transactional messages; Account notifications; Follow-up communications; Customer-requested information; and Marketing or promotional messages where appropriate consent has been obtained.\n\nBusinesses are responsible for ensuring that their actual messaging use is consistent with the consent provided by each recipient."},
            {"order": 5, "heading": "3. Message Frequency", "body": "Message frequency may vary depending on the communication preferences of the recipient, the services provided by the business, and the recipient's interactions with the business. Businesses should clearly communicate expected message frequency during the opt-in process where appropriate."},
            {"order": 6, "heading": "4. Opt-Out Instructions", "body": "Recipients may withdraw consent and stop receiving SMS messages at any time. Recipients may reply STOP to opt out of future messages. Businesses must promptly honor valid opt-out requests and must not continue sending messages requiring consent after that consent has been withdrawn, except for a permissible confirmation of the opt-out or messages otherwise permitted by applicable law. Businesses should also recognize and appropriately process other reasonable requests indicating that a recipient no longer wishes to receive messages. Recipients who later wish to receive messages again must provide new consent where required."},
            {"order": 7, "heading": "5. Help Instructions", "body": "Recipients may request assistance by replying HELP or by contacting the business that sent the message. Questions concerning the GoCustify platform may also be directed to:\nEmail: support@gocustify.com"},
            {"order": 8, "heading": "6. Message and Data Rates", "body": "Message and data rates may apply depending on the recipient's wireless carrier and mobile service plan. GoCustify is not responsible for charges imposed by a recipient's wireless carrier."},
            {"order": 9, "heading": "7. Compliance Requirements", "body": "Businesses using GoCustify messaging services are responsible for complying with all applicable requirements, including, where applicable: The Telephone Consumer Protection Act (\"TCPA\"); Federal Communications Commission (\"FCC\") rules and regulations; Applicable federal and state consumer-protection and privacy laws; CTIA Messaging Principles and Best Practices; Mobile carrier requirements; Messaging provider requirements; and Applicable A2P messaging and campaign-registration requirements.\n\nBusinesses are responsible for determining which legal and regulatory requirements apply to their particular communications and use cases."},
            {"order": 10, "heading": "8. Sender Identification", "body": "Businesses should clearly and accurately identify themselves in their messaging communications where required or appropriate. Users may not: Impersonate another individual or organization; Falsify sender information; Misrepresent the source of a message; or Use misleading sender identities."},
            {"order": 11, "heading": "9. Prohibited SMS Activities", "body": "Users may not use GoCustify messaging services to: Send spam or unsolicited messages; Send messages without required consent; Send fraudulent, deceptive, or misleading communications; Engage in phishing or scams; Distribute illegal or prohibited content; Harass, threaten, or abuse recipients; Circumvent opt-out requests; Use purchased, rented, or improperly obtained contact lists in violation of applicable requirements; Misrepresent the sender of a communication; or Use SMS services in violation of applicable law, carrier requirements, or GoCustify policies."},
            {"order": 12, "heading": "10. Opt-In and Opt-Out Records", "body": "Businesses should maintain appropriate records demonstrating recipient consent and opt-out activity. Such records may include: Date and time of consent; Method of consent; Telephone number; Consent language presented; Source of the opt-in; Campaign or messaging purpose; Opt-out requests; and Date and method of opt-out. GoCustify may request relevant compliance information when investigating suspected messaging abuse or responding to carrier, provider, regulatory, or legal requirements."},
            {"order": 13, "heading": "11. Enforcement", "body": "GoCustify may investigate suspected violations of this SMS Messaging Policy. GoCustify may, where appropriate: Warn the user; Restrict messaging functionality; Suspend SMS capabilities; Suspend or terminate campaigns; Suspend or terminate accounts; or Take other reasonable measures necessary to protect recipients, GoCustify, messaging providers, carriers, or the integrity of messaging networks. GoCustify may also cooperate with telecommunications providers, carriers, regulators, or law-enforcement authorities when required or permitted by applicable law."},
            {"order": 14, "heading": "12. Third-Party Messaging Providers and Carriers", "body": "SMS communications may rely on third-party telecommunications providers, mobile carriers, and messaging networks. Message delivery is therefore not guaranteed and may be affected by: Carrier filtering; Recipient device availability; Network availability; Messaging registration requirements; Spam-detection systems; Carrier policies; or Other circumstances outside GoCustify's control. Businesses must also comply with applicable requirements imposed by the telecommunications and messaging providers used in connection with their GoCustify account."},
            {"order": 15, "heading": "13. Privacy", "body": "Personal information collected or processed in connection with GoCustify messaging services is subject to the GoCustify Privacy Policy and applicable privacy requirements. Businesses using GoCustify remain responsible for providing appropriate privacy notices and handling recipient information in accordance with applicable law."},
            {"order": 16, "heading": "14. Reporting SMS Abuse", "body": "Suspected spam, unauthorized messaging, or other misuse of GoCustify SMS services may be reported to:\nEmail: support@gocustify.com"},
            {"order": 17, "heading": "15. Updates", "body": "GoCustify may update this SMS Messaging Policy periodically to reflect changes in: Messaging services; Telecommunications requirements; Carrier policies; Industry standards; Applicable laws and regulations; or Business practices. The updated policy will become effective when posted unless otherwise stated."},
        ],
    },
    {
        "slug": "acceptable-use-policy",
        "title": "Acceptable Use Policy",
        "display_style": "sections",
        "version": "2026.07.15",
        "blocks": [
            {"order": 1, "heading": "Last Updated", "body": "July 15, 2026"},
            {"order": 2, "body": "This Acceptable Use Policy describes prohibited activities when using the services provided by GoCustify LLC (\"GoCustify,\" \"we,\" \"us,\" or \"our\"). By accessing or using GoCustify, you agree to use the platform responsibly, lawfully, and in accordance with this Acceptable Use Policy."},
            {"order": 3, "heading": "1. Prohibited Activities", "body": "Users may not use GoCustify to: Send spam or unlawful unsolicited communications; Conduct fraud, scams, phishing, or other deceptive activities; Impersonate another person, business, or organization; Store, transmit, or distribute illegal or prohibited content; Violate the privacy, intellectual property, or other legal rights of others; Harass, threaten, abuse, or harm individuals; Attempt unauthorized access to accounts, systems, networks, or data; Circumvent security measures or access restrictions; Introduce malware, viruses, malicious code, or other harmful technology; or Use GoCustify in any manner that violates applicable law or regulations."},
            {"order": 4, "heading": "2. Communication Rules", "body": "Users are responsible for ensuring that all calls, text messages, emails, automated communications, and other communications sent through or in connection with GoCustify comply with applicable laws and regulations.\n\nUsers must, where required: Obtain appropriate consent before communicating; Provide accurate sender identification; Honor unsubscribe, opt-out, and do-not-contact requests; Maintain appropriate records of consent; Avoid deceptive or misleading communications; and Comply with applicable calling, messaging, email, privacy, and marketing requirements."},
            {"order": 5, "heading": "3. AI Usage Rules", "body": "Users must not use GoCustify AI features to: Generate, facilitate, or distribute illegal content; Create fraudulent, deceptive, or intentionally misleading communications; Impersonate individuals without authorization; Use AI-generated information as a substitute for required professional judgment or review; Represent AI-generated predictions, recommendations, or outputs as guaranteed facts; or Use AI functionality in a manner that violates applicable law, privacy rights, or this Acceptable Use Policy.\n\nUsers remain responsible for reviewing and appropriately using AI-generated outputs."},
            {"order": 6, "heading": "4. Account Security", "body": "Users are responsible for: Protecting account credentials; Maintaining appropriate employee and team-member permissions; Restricting account access to authorized individuals; Maintaining the confidentiality of passwords and authentication credentials; and Promptly notifying GoCustify of suspected unauthorized access, compromise, or misuse."},
            {"order": 7, "heading": "5. Enforcement", "body": "GoCustify may investigate suspected violations of this Acceptable Use Policy. Where appropriate, GoCustify may: Warn the user; Restrict specific functionality; Remove or disable prohibited content; Temporarily suspend access; Permanently terminate an account; or Take other reasonable action necessary to protect GoCustify, its users, third parties, or the integrity of its services. GoCustify may also cooperate with law-enforcement or regulatory authorities where required or permitted by applicable law."},
            {"order": 8, "heading": "6. Reporting Violations", "body": "To report suspected misuse or violations of this Acceptable Use Policy, contact:\nEmail: support@gocustify.com"},
            {"order": 9, "heading": "7. Updates", "body": "GoCustify may update this Acceptable Use Policy periodically to reflect changes in its services, applicable laws, regulations, security requirements, or business practices. The updated policy will become effective when posted unless otherwise stated."},
        ],
    },
    {
        "slug": "refund-policy",
        "title": "Refund Policy",
        "display_style": "sections",
        "version": "2026.07.15",
        "blocks": [
            {"order": 1, "heading": "Last Updated", "body": "July 15, 2026"},
            {"order": 2, "body": "This Refund Policy explains the circumstances under which GoCustify LLC (\"GoCustify,\" \"we,\" \"us,\" or \"our\") may provide refunds, credits, or other billing adjustments for subscriptions, products, and services purchased through the GoCustify platform. By purchasing or subscribing to any GoCustify product or service, you agree to this Refund Policy."},
            {"order": 3, "heading": "1. Subscription Fees", "body": "GoCustify provides subscription-based software and related services. Unless otherwise stated at the time of purchase, subscription fees are charged in advance for the applicable billing period. Subscription fees are generally non-refundable once a billing period has started, except where: A refund is required by applicable law; A duplicate or erroneous charge occurred; GoCustify determines that a billing error occurred; A service was materially unavailable due to a verified GoCustify system issue; or GoCustify approves a refund at its discretion."},
            {"order": 4, "heading": "2. Cancellation", "body": "You may cancel your GoCustify subscription at any time through your account settings or by contacting GoCustify support. Unless otherwise required by law: Cancellation stops future renewal charges; Your subscription remains active until the end of the current paid billing period; and Cancellation does not automatically result in a refund for the current billing period."},
            {"order": 5, "heading": "3. Monthly Subscriptions", "body": "For monthly subscriptions, charges are generally non-refundable after the subscription period begins. If you cancel, your access will normally continue until the end of the current monthly billing period."},
            {"order": 6, "heading": "4. Annual Subscriptions", "body": "Annual subscription fees are generally non-refundable after the annual subscription period begins. GoCustify may, at its discretion or where required by law, provide a partial or full refund in exceptional circumstances. Any approved refund may take into account: Time already used; Services already provided; Discounts applied; Promotional pricing; and Other applicable charges."},
            {"order": 7, "heading": "5. Free Trials", "body": "If GoCustify offers a free trial, you must cancel before the trial ends to avoid being charged for the applicable paid subscription. Once a paid subscription charge has been processed after the end of a free trial, the charge is subject to this Refund Policy."},
            {"order": 8, "heading": "6. Promotional Offers", "body": "Payments made under special promotions, discounted plans, coupons, credits, or limited-time offers are generally non-refundable unless otherwise stated in the applicable promotion or required by law. Promotional credits have no cash value and cannot normally be exchanged for cash."},
            {"order": 9, "heading": "7. Add-Ons and Usage-Based Charges", "body": "Charges for add-ons, usage-based services, communications, third-party integrations, credits, or other separately billed services are generally non-refundable once used or incurred. This may include, where applicable: SMS or messaging usage; Calling or communication services; Email usage; Third-party service fees; API usage; Purchased credits; Additional storage; Premium integrations; or Other metered services. If a charge resulted from a confirmed technical or billing error, GoCustify may provide an appropriate refund or account credit."},
            {"order": 10, "heading": "8. Duplicate or Incorrect Charges", "body": "If you believe you were charged more than once for the same transaction or believe a charge was incorrect, contact GoCustify as soon as possible. GoCustify will investigate confirmed billing errors and may issue: A refund; An account credit; or Another appropriate billing adjustment."},
            {"order": 11, "heading": "9. Service Interruptions", "body": "Temporary interruptions, maintenance, outages, or reduced availability do not automatically qualify for a refund. Where a significant service interruption is caused by GoCustify and materially affects the customer's ability to use the paid service, GoCustify may provide a refund, service credit, or other adjustment at its discretion or as required by an applicable service agreement."},
            {"order": 12, "heading": "10. Third-Party Services", "body": "GoCustify may integrate with or provide access to third-party services. Fees charged directly by third parties are governed by the refund and billing policies of those third parties. GoCustify is not responsible for refunding charges collected directly by a third-party provider unless GoCustify is legally responsible for those charges."},
            {"order": 13, "heading": "11. Account Suspension or Termination", "body": "Refunds are generally not provided where an account is suspended or terminated due to: Violation of GoCustify's Terms and Conditions; Fraud; Abuse; Unauthorized activity; Misuse of the platform; Non-payment; Security risks; or Other prohibited conduct. GoCustify reserves all rights available under its Terms and applicable law."},
            {"order": 14, "heading": "12. Chargebacks", "body": "Customers should contact GoCustify before initiating a chargeback so that we have an opportunity to investigate and resolve the issue. Submitting a fraudulent or abusive chargeback may result in account restriction or termination. Nothing in this section limits any rights a customer may have under applicable law or through their payment provider."},
            {"order": 15, "heading": "13. How to Request a Refund", "body": "To request a refund or billing review, contact:\nGoCustify LLC. Email: support@gocustify.com.\n\nYour request should include: Your name; Company or account name; Account email address; Transaction or invoice information; Date of charge; Amount charged; and Reason for the refund request. GoCustify may request additional information necessary to verify the transaction and evaluate the request."},
            {"order": 16, "heading": "14. Refund Processing", "body": "If a refund is approved, it will generally be returned to the original payment method. Processing times may vary depending on: Payment provider; Bank; Card issuer; Payment method; and Applicable financial network. GoCustify does not control processing delays caused by banks, card networks, or payment processors."},
            {"order": 17, "heading": "15. Legal Rights", "body": "Nothing in this Refund Policy limits any non-waivable consumer rights that may apply under applicable law. Where applicable law requires a refund, cancellation right, cooling-off period, or other consumer protection that conflicts with this policy, applicable law will control."},
            {"order": 18, "heading": "16. Changes to This Refund Policy", "body": "GoCustify may update this Refund Policy from time to time to reflect changes in: Services; Billing practices; Applicable law; Payment processing requirements; or Business operations. The updated Refund Policy will become effective when posted unless otherwise stated."},
            {"order": 19, "heading": "17. Contact Us", "body": "For questions about billing, refunds, or subscription cancellations, contact:\nGoCustify LLC. Email: support@gocustify.com"},
        ],
    },
    {
        "slug": "protocols-for-law-enforcement",
        "title": "Protocols for Law Enforcement",
        "display_style": "sections",
        "version": "2026.07.15",
        "blocks": [
            {"order": 1, "heading": "Last Updated", "body": "July 15, 2026"},
            {"order": 2, "body": "GoCustify LLC (\"GoCustify,\" \"we,\" \"us,\" or \"our\") is committed to complying with applicable laws while protecting the privacy and security of our customers and users."},
            {"order": 3, "heading": "Law Enforcement Requests", "body": "GoCustify responds to valid requests from law-enforcement agencies, courts, regulatory authorities, and other authorized governmental entities in accordance with applicable law. Government and law-enforcement authorities requesting customer or user information should provide valid legal process, which may include a subpoena, court order, search warrant, or other legally authorized request, depending on the type of information requested. Requests should include: Name of the requesting agency; Name and contact information of the requesting officer, agent, prosecutor, or official; Official government email address; Case or investigation number; Copy of the applicable legal process; Information sufficient to identify the relevant GoCustify account or customer; Specific information requested; Relevant date range; and Requested response deadline."},
            {"order": 4, "heading": "Verification", "body": "GoCustify may independently verify the identity and authority of the requesting agency or official before providing information. GoCustify reserves the right to reject, challenge, seek clarification regarding, or request modification of legal demands that are invalid, overly broad, vague, or otherwise legally insufficient."},
            {"order": 5, "heading": "Data Disclosure", "body": "GoCustify will disclose only information that: Is legally required or otherwise lawfully permitted to be disclosed; Is within GoCustify's possession, custody, or control; Is responsive to the valid legal request; and Falls within the scope and applicable time period of the request. GoCustify seeks to minimize disclosure and will not voluntarily provide unrelated customer information."},
            {"order": 6, "heading": "Customer Content", "body": "Requests involving customer communications, stored content, documents, messages, or other sensitive customer information must be supported by appropriate legal authority as required by applicable law."},
            {"order": 7, "heading": "Preservation Requests", "body": "GoCustify will evaluate properly submitted law-enforcement preservation requests in accordance with applicable law. A preservation request does not itself authorize disclosure of the preserved information. Appropriate legal process may still be required before information is produced."},
            {"order": 8, "heading": "Emergency Requests", "body": "GoCustify may evaluate emergency requests where law enforcement reasonably believes there is an imminent danger of death or serious physical injury. Emergency requests should clearly identify: The nature of the emergency; The person or persons believed to be at risk; The specific GoCustify account involved; The information requested; Why the information is necessary to address the emergency; and Why ordinary legal process cannot reasonably be obtained in time. GoCustify reserves the right to verify emergency requests directly with the requesting agency."},
            {"order": 9, "heading": "Customer Notification", "body": "Where legally permitted, GoCustify may notify affected customers or users regarding governmental requests for their information. GoCustify will comply with valid court orders or other legal requirements prohibiting or delaying such notification."},
            {"order": 10, "heading": "Security", "body": "GoCustify does not provide law enforcement with unrestricted access to: Customer accounts; GoCustify databases; Administrative systems; Customer passwords; Employee credentials; API credentials; or Internal systems. When disclosure is legally required, responsive information is retrieved and provided by authorized GoCustify personnel using appropriate security controls."},
            {"order": 11, "heading": "Confidentiality and Data Protection", "body": "Information disclosed in response to a valid government request will be limited to the information reasonably required by the applicable legal process. GoCustify maintains administrative, technical, and organizational safeguards designed to protect customer information against unauthorized access or disclosure."},
            {"order": 12, "heading": "Contact for Law Enforcement", "body": "Law-enforcement and governmental requests should be directed to:\nGoCustify LLC, Law Enforcement / Legal Requests. Email: support@gocustify.com.\n\nRequests should preferably be submitted from an official government email address. Emergency requests should clearly state: EMERGENCY LAW ENFORCEMENT REQUEST in the subject line."},
            {"order": 13, "heading": "Reservation of Rights", "body": "Nothing in these Protocols for Law Enforcement: Waives any rights or legal objections available to GoCustify; Constitutes consent to jurisdiction; Waives applicable service-of-process requirements; Expands GoCustify's legal obligations; or Creates rights enforceable by third parties. GoCustify reserves the right to update these Protocols for Law Enforcement as necessary to reflect changes in applicable law, regulatory requirements, or its services."},
        ],
    },
    {
        "slug": "help-support",
        "title": "Help & Support",
        "display_style": "sections",
        "version": "1.0",
        "blocks": [
            {
                "order": 1,
                "heading": "Getting Help",
                "body": "Use the support ticket endpoint to send product questions, technical issues, billing questions, or account requests to the support team.",
            },
            {
                "order": 2,
                "heading": "Before You Report",
                "body": "Include the screen, action, expected result, actual result, and any safe-to-share context that helps reproduce the issue.",
            },
        ],
    },
]


class ContentService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def ensure_defaults(self) -> None:
        now = utc_now()
        for page in DEFAULT_CONTENT_PAGES:
            await self.db.content_pages.update_one(
                {"slug": page["slug"]},
                {
                    "$setOnInsert": {
                        **page,
                        "created_at": now,
                        "updated_at": now,
                        "is_active": True,
                    }
                },
                upsert=True,
            )

    async def get_page(self, slug: str) -> ContentPageResponse:
        await self.ensure_defaults()
        normalized_slug = slug.lower().strip()
        page = await self.db.content_pages.find_one({"slug": normalized_slug, "is_active": True})
        if not page:
            raise AppException(status_code=404, code="CONTENT_PAGE_NOT_FOUND", message="Requested content page was not found.")
        return self._to_response(page)

    async def upsert_page(self, page: dict) -> ContentPageResponse:
        now = utc_now()
        updated = await self.db.content_pages.find_one_and_update(
            {"slug": page["slug"]},
            {
                "$set": {
                    **page,
                    "is_active": page.get("is_active", True),
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return self._to_response(updated)

    async def get_page_text(self, slug: str) -> str:
        page = await self.get_page(slug)
        lines = [page.title]
        for block in page.blocks:
            if block.heading:
                lines.extend(["", block.heading])
            if block.body:
                lines.append(block.body)
        return "\n".join(lines).strip()

    async def upsert_page_text(self, slug: str, content: str, title: str | None = None) -> ContentPageResponse:
        normalized_slug = slug.lower().strip()
        try:
            existing = await self.get_page(normalized_slug)
        except AppException:
            existing = None

        page = {
            "slug": normalized_slug,
            "title": title or (existing.title if existing else self._default_title_for_slug(normalized_slug)),
            "display_style": "sections",
            "version": utc_now().strftime("%Y.%m.%d"),
            "blocks": [block.model_dump() for block in self._text_to_blocks(content)],
            "is_active": True,
        }
        return await self.upsert_page(page)

    @staticmethod
    def _default_title_for_slug(slug: str) -> str:
        return {
            "about-us": "About Us",
            "terms-and-conditions": "Terms & Conditions",
            "privacy-policy": "Privacy Policy",
            "sms-messaging-policy": "SMS Messaging Policy",
            "acceptable-use-policy": "Acceptable Use Policy",
            "refund-policy": "Refund Policy",
            "protocols-for-law-enforcement": "Protocols for Law Enforcement",
            "help-support": "Help & Support",
        }.get(slug, slug.replace("-", " ").title())

    @staticmethod
    def _text_to_blocks(content: str) -> list[ContentBlock]:
        cleaned = ContentService._normalize_editor_content(content)
        paragraphs = [part.strip() for part in re.split(r"\n{2,}", cleaned) if part.strip()]
        blocks: list[ContentBlock] = []
        order = 1
        skipped_title = False

        for paragraph in paragraphs:
            if not skipped_title and len(paragraph) <= 160 and "\n" not in paragraph:
                skipped_title = True
                continue

            lines = [line.strip() for line in paragraph.splitlines() if line.strip()]
            if not lines:
                continue

            heading = None
            body_lines = lines
            if len(lines) > 1 and len(lines[0]) <= 160:
                heading = lines[0]
                body_lines = lines[1:]

            body = "\n".join(body_lines).strip() if body_lines else ""
            if not body:
                body = heading or paragraph
                heading = None

            blocks.append(ContentBlock(order=order, heading=heading, body=body))
            order += 1

        if not blocks:
            blocks.append(ContentBlock(order=1, body=cleaned or "Content unavailable."))

        return blocks

    @staticmethod
    def _normalize_editor_content(content: str) -> str:
        normalized = (content or "").replace("\r\n", "\n").replace("\r", "\n")
        normalized = re.sub(r"<br\s*/?>", "\n", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"</(p|div|h1|h2|h3|h4|h5|h6|li)>", "\n\n", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"<li[^>]*>", "- ", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"<[^>]+>", "", normalized)
        normalized = normalized.replace("&nbsp;", " ").replace("&amp;", "&")
        normalized = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1: \2", normalized)
        normalized = re.sub(r"\n{3,}", "\n\n", normalized)
        return normalized.strip()

    @staticmethod
    def _to_response(page: dict) -> ContentPageResponse:
        updated_at = page.get("updated_at")
        if not isinstance(updated_at, datetime):
            updated_at = utc_now()
        return ContentPageResponse(
            slug=page["slug"],
            title=page["title"],
            display_style=page.get("display_style", "sections"),
            version=page.get("version", "1.0"),
            blocks=sorted(page.get("blocks", []), key=lambda item: item.get("order", 0)),
            updated_at=updated_at,
        )
