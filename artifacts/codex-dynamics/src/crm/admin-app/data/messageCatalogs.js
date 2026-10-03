/** Shared rejection message templates for client registration flows. */

export const SIGNUP_REJECTION_REASONS = {
  Account: [
    { code: 'EMAIL_TAKEN', label: 'Email already registered',
      message: 'An account with this email address is already registered on our platform. Please sign in or use a different email.' },
    { code: 'DUPLICATE_REQUEST', label: 'Duplicate registration',
      message: 'A registration request for this email is already on file. Please wait for our team to complete the review.' },
    { code: 'INCOMPLETE_INFO', label: 'Incomplete information',
      message: 'Your registration could not be processed because required information was missing. Please contact support to complete your application.' },
  ],
  Verification: [
    { code: 'VERIFICATION_REQUIRED', label: 'Business verification required',
      message: 'We need additional project or company details before your client portal account can be opened. Our team will contact you with next steps.' },
    { code: 'RESTRICTED_REGION', label: 'Service not available in your region',
      message: 'Client portal onboarding is not currently available in your region. Please contact support if you believe this is an error.' },
    { code: 'SCOPE_REVIEW', label: 'Engagement scope review',
      message: 'Your application requires additional project scope review and cannot be approved at this time.' },
  ],
  Technical: [
    { code: 'NETWORK_ERROR', label: 'Temporary system issue',
      message: 'We experienced a temporary issue processing your request. Please try registering again in a few minutes.' },
    { code: 'MAINTENANCE', label: 'Registration paused',
      message: 'New account registration is temporarily paused for maintenance. Please try again later.' },
  ],
  Other: [
    { code: 'NOT_ELIGIBLE', label: 'Not eligible at this time',
      message: 'We are unable to open a client portal account for you at this time. Please contact our support team for more information.' },
    { code: 'CUSTOM', label: 'Custom message (edit below)',
      message: 'Your registration request could not be approved. Please contact support for assistance.' },
  ],
};
