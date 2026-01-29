// Field mapping configuration for job application forms
// Maps common field name variations to standardized field types

/**
 * Field mapping configuration
 * Maps variations of field names to standardized field types
 */
const FIELD_MAPPINGS = {
  // Personal Information (firstName/lastName before fullName so "First name" / "Last name" match correctly)
  firstName: [
    'first name', 'firstname', 'given name', 'fname', 'first_name',
    'first-name', 'forename', 'givenname', 'first', 'name (first)'
  ],
  lastName: [
    'last name', 'lastname', 'surname', 'family name', 'lname',
    'last_name', 'last-name', 'familyname', 'last', 'name (last)'
  ],
  fullName: [
    'full name', 'fullname', 'full_name', 'full-name',
    'your name', 'applicant name', 'candidate name', 'legal name',
    'name (full)', 'complete name', 'name'
  ],
  email: [
    'email', 'email address', 'e-mail', 'email_addr', 'email_address',
    'e-mail address', 'emailaddress', 'email_addr', 'mail', 'email id'
  ],
  phone: [
    'phone', 'phone number', 'phone_number', 'phone-number', 'phonenumber',
    'mobile', 'mobile number', 'mobile_number', 'mobile-number', 'cell',
    'cell phone', 'cellphone', 'telephone', 'tel', 'contact number'
  ],
  address: [
    'address', 'street address', 'street_address', 'street-address',
    'streetaddress', 'address line 1', 'address_line_1', 'address1',
    'street', 'street name', 'streetname'
  ],
  city: [
    'city', 'town', 'locality', 'municipality', 'location city', 'location',
    'city state', 'city, state', 'city state zip'
  ],
  state: [
    'state', 'province', 'region', 'state/province', 'state_province',
    'city state', 'city, state', 'state province'
  ],
  zipCode: [
    'zip', 'zip code', 'zip_code', 'zipcode', 'postal code', 'postal_code',
    'postalcode', 'postcode', 'zip/postal', 'zip_postal'
  ],
  country: [
    'country', 'nation', 'country of residence'
  ],
  
  // Professional Information
  resume: [
    'resume', 'cv', 'curriculum vitae', 'resume/cv', 'resume_cv',
    'upload resume', 'upload cv', 'resume file', 'resume_file',
    'attach resume', 'attach cv', 'resume upload', 'resume_upload'
  ],
  coverLetter: [
    'cover letter', 'coverletter', 'cover_letter', 'cover-letter',
    'cover letter upload', 'upload cover letter', 'cover letter file',
    'attach cover letter', 'coverletter upload'
  ],
  linkedIn: [
    'linkedin', 'linkedin profile', 'linkedin_profile', 'linkedin-profile',
    'linkedin url', 'linkedin_url', 'linkedin-url', 'linkedin link',
    'linkedin profile url', 'linkedin_profile_url'
  ],
  github: [
    'github', 'github profile', 'github_profile', 'github-profile',
    'github url', 'github_url', 'github-url', 'github link', 'github_link',
    'github profile url', 'github_profile_url', 'github username', 'github_username'
  ],
  portfolio: [
    'portfolio', 'portfolio url', 'portfolio_url', 'portfolio-url',
    'portfolio link', 'website', 'personal website', 'personal_website',
    'portfolio website'
  ],
  yearsOfExperience: [
    'years of experience', 'years_of_experience', 'years-of-experience',
    'yearsofexperience', 'experience', 'total experience', 'total_experience',
    'years experience', 'yoe', 'years in field'
  ],
  currentJobTitle: [
    'current job title', 'current_job_title', 'current-job-title',
    'current position', 'current_position', 'present job title',
    'present_job_title', 'job title', 'job_title', 'position', 'title'
  ],
  currentCompany: [
    'current company', 'current_company', 'current-company',
    'current employer', 'current_employer', 'present company',
    'present_company', 'company', 'employer', 'organization'
  ],
  
  // Education
  school: [
    'school', 'university', 'college', 'institution', 'educational institution',
    'school/university', 'school_university', 'university/college',
    'university_college', 'institution name', 'institution_name'
  ],
  degree: [
    'degree', 'qualification', 'education', 'degree/major', 'degree_major',
    'major', 'field of study', 'field_of_study', 'field-of-study',
    'course', 'program', 'degree program', 'degree_program'
  ],
  graduationDate: [
    'graduation date', 'graduation_date', 'graduation-date',
    'date of graduation', 'date_of_graduation', 'graduated',
    'graduation year', 'graduation_year', 'year of graduation',
    'year_of_graduation', 'grad year', 'grad_year'
  ],
  gpa: [
    'gpa', 'grade point average', 'grade_point_average', 'grade-point-average',
    'cgpa', 'cumulative gpa', 'cumulative_gpa', 'overall gpa', 'overall_gpa'
  ],

  // Demographics / EEO (voluntary, stored in extension preferences)
  gender: [
    'gender', 'sex', 'gender identity', 'gender_identity', 'gender-identity'
  ],
  race: [
    'race', 'ethnicity', 'race/ethnicity', 'race_ethnicity', 'race-ethnicity',
    'ethnic background', 'ethnic_background', 'demographic race'
  ],
  veteranStatus: [
    'veteran status', 'veteran_status', 'veteran-status', 'veteranstatus',
    'veteran', 'military status', 'military_status', 'protected veteran',
    'are you a veteran', 'veteran preference'
  ],
  
  // Questions
  whyWorkHere: [
    'why do you want to work here', 'why work here', 'why_work_here',
    'why are you interested', 'why interested', 'why_interested',
    'why this company', 'why_this_company', 'why us', 'why_us',
    'what interests you about this role', 'what interests you',
    'why do you want to join', 'why_join', 'motivation', 'why apply'
  ],
  whyYou: [
    'why are you a good fit', 'why good fit', 'why_good_fit',
    'why should we hire you', 'why_hire_you', 'why you',
    'what makes you qualified', 'what_makes_qualified', 'why qualified',
    'why are you the right candidate', 'why_right_candidate',
    'what sets you apart', 'what_sets_apart', 'unique qualifications'
  ],
  salary: [
    'salary', 'salary expectation', 'salary_expectation', 'salary-expectation',
    'expected salary', 'expected_salary', 'salary range', 'salary_range',
    'compensation', 'compensation expectation', 'compensation_expectation',
    'desired salary', 'desired_salary', 'salary requirements', 'salary_requirements',
    'pay expectation', 'pay_expectation', 'wage expectation', 'wage_expectation'
  ],
  workAuthorization: [
    'are you authorized to work', 'work authorization', 'work_authorization',
    'authorized to work', 'authorized_to_work', 'work permit', 'work_permit',
    'work visa', 'work_visa', 'legal right to work', 'legal_right_to_work',
    'eligible to work', 'eligible_to_work', 'work eligibility', 'work_eligibility',
    'us work authorization', 'us_work_authorization', 'can you work legally',
    'work status', 'work_status', 'are you eligible to work', 'eligible to work in',
    'eligible to work in the us', 'eligible to work in the u.s.', 'eligible to work in usa'
  ],
  // Work Authorization: sponsorship Yes/No only
  requiresSponsorship: [
    'will you require sponsorship', 'require sponsorship', 'requires sponsorship',
    'require sponsorship to work', 'sponsorship to work in the us', 'sponsorship to work in the u.s.',
    'do you require sponsorship', 'do you need sponsorship', 'need sponsorship',
    'will you now or in the future require sponsorship', 'sponsorship required',
    'visa sponsorship', 'require visa sponsorship', 'need visa sponsorship',
    'sponsorship', 'work sponsorship'
  ]
};

/**
 * Normalize a field name for matching
 * @param {string} fieldName - The field name to normalize
 * @returns {string} - Normalized field name
 */
function normalizeFieldName(fieldName) {
  if (!fieldName) return '';
  return fieldName.toLowerCase()
    .trim()
    .replace(/[_\-\s]+/g, ' ') // Replace underscores, hyphens, multiple spaces with single space
    .replace(/[^\w\s]/g, '') // Remove special characters
    .trim();
}

/**
 * Find the standardized field type for a given field name
 * @param {string} fieldName - The field name to match
 * @returns {string|null} - The standardized field type or null if no match
 */
function findFieldType(fieldName) {
  const normalized = normalizeFieldName(fieldName);
  
  // Check each field type and its variations
  for (const [fieldType, variations] of Object.entries(FIELD_MAPPINGS)) {
    for (const variation of variations) {
      const normalizedVariation = normalizeFieldName(variation);
      
      // Exact match
      if (normalized === normalizedVariation) {
        return fieldType;
      }
      
      // Contains match (for cases like "First Name" matching "name (first)")
      if (normalized.includes(normalizedVariation) || normalizedVariation.includes(normalized)) {
        return fieldType;
      }
    }
  }
  
  return null;
}

/**
 * Get all variations for a field type
 * @param {string} fieldType - The standardized field type
 * @returns {string[]} - Array of variations
 */
function getFieldVariations(fieldType) {
  return FIELD_MAPPINGS[fieldType] || [];
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.fieldMapping = {
    FIELD_MAPPINGS,
    normalizeFieldName,
    findFieldType,
    getFieldVariations
  };
}
