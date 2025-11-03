# Firebase Cloud Functions - Email Service

## Setup Instructions

### 1. Install Dependencies
```bash
cd functions
npm install
```

### 2. Configure Email Credentials

You need to set up email credentials using Firebase Functions config:

```bash
firebase functions:config:set email.user="your-email@gmail.com" email.password="your-app-password"
```

**For Gmail:**
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Generate an App Password for "Mail"
4. Use that App Password in the command above

### 3. Deploy Functions

```bash
firebase deploy --only functions
```

## Available Functions

### `sendInterviewEmail`
**Type:** HTTPS Callable Function
**Purpose:** Sends interview invitation emails to candidates

**Parameters:**
- `to` (string, required): Candidate email address
- `candidateName` (string, required): Candidate's full name
- `jobTitle` (string, required): Job position title
- `interviewDate` (string, required): Formatted interview date
- `interviewTime` (string, required): Formatted interview time
- `interviewLink` (string, required): Unique interview link
- `duration` (string, required): Interview duration in minutes
- `instructions` (string, optional): Additional instructions for candidate

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

### `onInterviewCompleted`
**Type:** Firestore Trigger
**Purpose:** Triggered when an interview status changes to "completed"

This function can be extended to:
- Send follow-up emails
- Generate interview reports
- Update application status
- Notify recruiters

## Email Template

The email includes:
- Professional header with company branding
- Interview details (date, time, duration)
- Special instructions if provided
- AI features information
- Pre-interview checklist
- Direct link to join video interview

## Testing Locally

```bash
cd functions
npm run serve
```

This starts the Firebase emulator for local testing.

## Environment Variables

Set these using Firebase Functions config:
- `email.user`: Email address for sending
- `email.password`: Email password or app-specific password

## Security Notes

- Never commit credentials to version control
- Use app-specific passwords for Gmail
- Validate all input data before processing
- Implement rate limiting for production
- Add authentication checks if needed

## Troubleshooting

**Email not sending:**
1. Verify email credentials are correct
2. Check Gmail security settings
3. Ensure "Less secure app access" is enabled or use App Password
4. Check Firebase Functions logs: `firebase functions:log`

**Function deployment fails:**
1. Ensure Firebase CLI is up to date: `npm install -g firebase-tools`
2. Check you're logged in: `firebase login`
3. Verify project is initialized: `firebase use --add`
