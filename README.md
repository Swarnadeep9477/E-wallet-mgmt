# Software Requirements Specification (SRS)

## Project Title

SwiftPay E-wallet Management System

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification defines the functional and non-functional requirements for the SwiftPay E-wallet Management System. The system is a full-stack web application that simulates an e-wallet platform with user registration, wallet creation, OTP verification, wallet transactions, money requests, QR-based payment, admin management, notifications, and support complaint handling.

This document is intended for developers, testers, reviewers, academic evaluators, and maintainers who need to understand the expected behavior and structure of the application.

### 1.2 Scope

SwiftPay provides a demo e-wallet environment where users can create accounts, verify email and phone details, manage wallet balance, send money, pay bills, recharge services, scan or use QR payment data, raise support complaints, and request money from other wallet users. Admin users can manage platform records, monitor system overview data, update user and wallet states, and handle support complaints.

The project is designed as a database-backed demo/academic e-wallet management system. It does not process real financial transactions or integrate with live banking/payment gateway infrastructure.

### 1.3 Intended Audience

- Project developers
- GitHub visitors and reviewers
- Academic project evaluators
- Testers
- Future maintainers
- Students learning full-stack development

### 1.4 Definitions and Abbreviations

| Term | Meaning |
| --- | --- |
| SRS | Software Requirements Specification |
| OTP | One-Time Password |
| JWT | JSON Web Token |
| KYC | Know Your Customer |
| UPI | Unified Payments Interface |
| QR | Quick Response code |
| Wallet | Digital account used to hold dummy balance |
| Admin | System administrator with management privileges |
| User | Registered customer account |

## 2. Overall Description

### 2.1 Product Perspective

SwiftPay is a standalone full-stack web application. It uses a Node.js and Express backend, SQLite database storage, and a vanilla HTML/CSS/JavaScript frontend. The backend exposes REST-style API endpoints, and the frontend consumes those endpoints using browser `fetch()` calls.

### 2.2 Product Functions

The major functions of the system are:

- User signup with email and phone OTP verification
- User and admin login
- JWT cookie-based session handling
- Wallet creation during signup
- Unique wallet ID and UPI ID generation
- QR code generation for wallet payments
- Add money to wallet
- Send money by wallet ID, UPI ID, or phone number
- Pay bills
- Recharge services
- View transaction history
- Create, accept, reject, cancel, and pay money requests
- View and mark notifications as read
- Update profile details
- Change password and transaction PIN
- Request forgotten PIN reset through support workflow
- Raise support complaints with optional attachments
- User/admin complaint messaging
- Admin complaint status and priority management
- Admin overview and table management for core records

### 2.3 User Classes

#### Guest User

A guest user can access the login and signup interface. They can register by verifying email and phone OTPs.

#### Registered User

A registered user can access wallet features, transactions, money requests, profile management, notifications, and support functions after login.

#### Admin User

An admin user can access platform management features, including dashboard overview, admin tables, KYC/account status control, wallet management, transactions, notifications, and support complaint handling.

### 2.4 Operating Environment

| Layer | Technology |
| --- | --- |
| Runtime | Node.js |
| Backend Framework | Express.js |
| Database | SQLite using `better-sqlite3` |
| Frontend | HTML, CSS, Vanilla JavaScript |
| Authentication | JWT stored in HTTP-only cookies |
| Password/PIN Hashing | bcryptjs |
| Email/OTP | nodemailer |
| File Uploads | multer |
| QR Generation | qrcode |

### 2.5 Design and Implementation Constraints

- The application uses SQLite as a local database.
- The system is designed for demo and academic use, not real payment processing.
- The frontend does not use a frontend framework such as React, Angular, or Vue.
- OTP verification is database-backed.
- Real email OTP delivery is supported through configured email transport.
- Phone OTP remains simulated/demo-oriented.
- Wallet balance is stored as integer paise to avoid floating point money errors.
- Users must complete OTP verification before account creation.
- KYC status affects transaction availability.

### 2.6 Assumptions and Dependencies

- Node.js and npm are installed on the host machine.
- Dependencies are installed using `npm install`.
- The backend server is started with `npm start` or `node src/server.js`.
- SQLite database file `wallet.db` is available or can be created by the application.
- Email OTP sending depends on valid nodemailer/Gmail credentials.
- Uploaded files are stored in the local `uploads` folder.

## 3. System Features and Functional Requirements

### 3.1 Authentication and Session Management

#### Description

The system shall allow users and admins to authenticate and maintain sessions through JWT tokens stored in cookies.

#### Functional Requirements

- FR-AUTH-01: The system shall allow a user to sign up with name, email, phone, password, bank details, date of birth, UPI handle, transaction PIN, and optional address.
- FR-AUTH-02: The system shall require email OTP verification before user account creation.
- FR-AUTH-03: The system shall require phone OTP verification before user account creation.
- FR-AUTH-04: The system shall allow registered users to log in using email and password.
- FR-AUTH-05: The system shall allow admins to log in using admin email and password.
- FR-AUTH-06: The system shall issue a signed JWT token after successful login.
- FR-AUTH-07: The system shall store the JWT token in an HTTP-only cookie.
- FR-AUTH-08: The system shall allow users and admins to log out by clearing the authentication cookie.
- FR-AUTH-09: The system shall expose a session endpoint to identify the currently logged-in role.
- FR-AUTH-10: The system shall reject protected API requests when the JWT is missing, invalid, or expired.
- FR-AUTH-11: The system shall allow users to reset forgotten passwords through email OTP verification.

### 3.2 OTP Verification

#### Description

The system shall support OTP challenges for signup and password reset workflows.

#### Functional Requirements

- FR-OTP-01: The system shall generate a 6-digit OTP code.
- FR-OTP-02: The system shall hash OTP codes before storing them.
- FR-OTP-03: The system shall expire OTPs after a configured time period.
- FR-OTP-04: The system shall prevent repeated OTP requests within the cooldown period.
- FR-OTP-05: The system shall verify OTP codes against the latest stored challenge.
- FR-OTP-06: The system shall store OTP verification status.
- FR-OTP-07: The system shall clear signup OTP records after successful account creation.
- FR-OTP-08: The frontend shall not display the email demo OTP during signup.
- FR-OTP-09: The phone OTP demo flow may remain visible for development/demo testing.

### 3.3 User Registration and Wallet Creation

#### Description

After OTP verification, the system shall create a user account, wallet, UPI ID, and wallet QR record.

#### Functional Requirements

- FR-REG-01: The system shall validate required signup fields.
- FR-REG-02: The system shall reject duplicate email addresses.
- FR-REG-03: The system shall reject duplicate phone numbers.
- FR-REG-04: The system shall reject duplicate bank account numbers.
- FR-REG-05: The system shall generate a unique user ID.
- FR-REG-06: The system shall generate a unique wallet ID.
- FR-REG-07: The system shall generate a UPI ID using the phone number and selected UPI handle.
- FR-REG-08: The system shall hash the user password.
- FR-REG-09: The system shall hash the transaction PIN.
- FR-REG-10: The system shall create a wallet linked to the user.
- FR-REG-11: The system shall create a QR code payload and QR image for the wallet.
- FR-REG-12: The system shall set new user KYC status to pending by default.

### 3.4 User Dashboard

#### Description

The system shall provide a dashboard showing wallet and user summary information.

#### Functional Requirements

- FR-DASH-01: The system shall display wallet balance.
- FR-DASH-02: The system shall display wallet ID and UPI ID.
- FR-DASH-03: The system shall display transaction summary values.
- FR-DASH-04: The system shall display KYC or wallet status warnings when applicable.
- FR-DASH-05: The system shall provide quick actions for common wallet operations.

### 3.5 Wallet Operations

#### Description

The system shall support dummy wallet operations such as top-up, transfer, bill payment, recharge, and QR payment.

#### Functional Requirements

- FR-WALLET-01: The system shall allow verified users/admins to add dummy money to a wallet.
- FR-WALLET-02: The system shall allow money transfer by wallet ID.
- FR-WALLET-03: The system shall allow money transfer by UPI ID.
- FR-WALLET-04: The system shall allow money transfer by phone number.
- FR-WALLET-05: The system shall require transaction PIN verification before wallet debit operations.
- FR-WALLET-06: The system shall reject transfers when the sender wallet has insufficient balance.
- FR-WALLET-07: The system shall prevent inactive wallet transactions.
- FR-WALLET-08: The system shall enforce KYC verification before transaction operations.
- FR-WALLET-09: The system shall record each wallet operation in the transactions table.
- FR-WALLET-10: The system shall create notifications for relevant wallet events.
- FR-WALLET-11: The system shall support bill payment simulation.
- FR-WALLET-12: The system shall support recharge payment simulation.
- FR-WALLET-13: The system shall support QR payload based payment simulation.

### 3.6 Transaction History

#### Description

The system shall maintain transaction records for wallet operations.

#### Functional Requirements

- FR-TXN-01: The system shall store transaction ID, wallet ID, sender wallet, receiver wallet, type, amount, status, payment method, reference number, and timestamp.
- FR-TXN-02: The system shall allow users/admins to view relevant transaction history.
- FR-TXN-03: The system shall sort transactions by transaction time.
- FR-TXN-04: The frontend shall display transaction amounts and metadata in a readable format.

### 3.7 Money Requests

#### Description

The system shall allow a user or admin wallet holder to request money from another wallet holder.

#### Functional Requirements

- FR-MR-01: The system shall allow a requester to create a money request.
- FR-MR-02: The system shall allow the requester to identify the payer by wallet ID, UPI ID, or phone number.
- FR-MR-03: The system shall prevent self money requests.
- FR-MR-04: The system shall store request amount, note, requester, payer, wallet IDs, status, and timestamps.
- FR-MR-05: The system shall allow the payer to accept a pending money request.
- FR-MR-06: The system shall allow the payer to reject a pending money request.
- FR-MR-07: The system shall allow the requester to cancel a pending money request.
- FR-MR-08: The system shall allow accepted or pending requests to be paid.
- FR-MR-09: The system shall transfer amount from payer wallet to requester wallet during payment.
- FR-MR-10: The system shall update the money request status to PAID after payment.
- FR-MR-11: The system shall create transaction records and notifications for money request events.

### 3.8 Notifications

#### Description

The system shall notify users/admins about important wallet, support, and money request events.

#### Functional Requirements

- FR-NOTIF-01: The system shall create notifications for wallet and support events.
- FR-NOTIF-02: The system shall allow authenticated actors to list notifications.
- FR-NOTIF-03: The system shall provide unread notification counts.
- FR-NOTIF-04: The system shall allow marking a single notification as read.
- FR-NOTIF-05: The system shall allow marking all notifications as read.
- FR-NOTIF-06: The frontend shall display notification badges for unread items.

### 3.9 Profile Management

#### Description

The system shall allow users/admins to view and update profile-related data.

#### Functional Requirements

- FR-PROFILE-01: The system shall allow authenticated actors to view profile and wallet data.
- FR-PROFILE-02: The system shall allow profile updates where supported.
- FR-PROFILE-03: The system shall allow password changes.
- FR-PROFILE-04: The system shall allow transaction PIN changes.
- FR-PROFILE-05: The system shall allow a PIN reset after admin-approved forgot-PIN workflow.

### 3.10 Support and Complaint Management

#### Description

The system shall allow users to raise complaints and admins to manage them.

#### Functional Requirements

- FR-SUPPORT-01: The system shall provide support complaint categories.
- FR-SUPPORT-02: The system shall allow users to create support complaints.
- FR-SUPPORT-03: The system shall allow users to attach supported files to complaints.
- FR-SUPPORT-04: The system shall store complaint subject, category, description, status, priority, wallet ID, transaction ID, and timestamps.
- FR-SUPPORT-05: The system shall allow users to view their own complaints.
- FR-SUPPORT-06: The system shall allow users to view complaint details.
- FR-SUPPORT-07: The system shall allow users to add messages to complaints.
- FR-SUPPORT-08: The system shall allow users to create a forgot-PIN complaint.
- FR-SUPPORT-09: The system shall allow admins to view complaint overview statistics.
- FR-SUPPORT-10: The system shall allow admins to list and filter complaints.
- FR-SUPPORT-11: The system shall allow admins to view any complaint details.
- FR-SUPPORT-12: The system shall allow admins to update complaint status.
- FR-SUPPORT-13: The system shall allow admins to update complaint priority.
- FR-SUPPORT-14: The system shall allow admins to reply to complaints with optional attachment.
- FR-SUPPORT-15: The system shall store complaint status history.

### 3.11 Admin Management

#### Description

The system shall provide admin tools for managing application data.

#### Functional Requirements

- FR-ADMIN-01: The system shall provide an admin dashboard overview.
- FR-ADMIN-02: The system shall allow admins to list users, admins, wallets, transactions, wallet QR records, and notifications.
- FR-ADMIN-03: The system shall allow admins to search and filter supported tables.
- FR-ADMIN-04: The system shall allow admins to create supported records.
- FR-ADMIN-05: The system shall allow admins to update supported records.
- FR-ADMIN-06: The system shall allow admins to delete supported records where allowed.
- FR-ADMIN-07: The system shall allow admins to update user KYC status.
- FR-ADMIN-08: The system shall allow admins to update user account status.
- FR-ADMIN-09: The system shall allow admins to update wallet status.
- FR-ADMIN-10: The system shall protect admin-only routes from normal users.

### 3.12 Frontend Interface

#### Description

The frontend shall provide an interactive single-page style interface using vanilla JavaScript.

#### Functional Requirements

- FR-UI-01: The system shall render login and signup screens.
- FR-UI-02: The system shall render dashboard, wallet, transfer, bill, recharge, QR pay, history, notifications, support, profile, and admin screens.
- FR-UI-03: The system shall use `fetch()` to call backend APIs.
- FR-UI-04: The system shall show toast messages for success and error feedback.
- FR-UI-05: The system shall support theme selection.
- FR-UI-06: The signup bank selector shall display bank logo-style options.
- FR-UI-07: The application tab shall display the SwiftPay icon.
- FR-UI-08: The frontend shall preserve signup form data when OTP sections re-render.

## 4. External Interface Requirements

### 4.1 User Interface

The application shall provide a browser-based interface with:

- Authentication screen
- Signup form with OTP verification
- Sidebar navigation for authenticated actors
- Dashboard cards and summary sections
- Wallet action forms
- Admin data tables
- Support complaint modals and detail views
- Notification badges
- Toast alerts
- Responsive layout for different screen sizes

### 4.2 Hardware Interfaces

No special hardware interface is required. The system runs on a standard computer capable of running Node.js and a modern browser.

### 4.3 Software Interfaces

- Node.js runtime
- npm package manager
- SQLite database file
- Browser with JavaScript enabled
- Gmail/nodemailer email transport for email OTP

### 4.4 Communication Interfaces

The frontend communicates with the backend through HTTP requests to REST-style API endpoints. Authentication is handled through cookies and JSON Web Tokens.

## 5. API Requirements Summary

### 5.1 Authentication APIs

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/otp/send` | Send signup OTP |
| POST | `/api/auth/otp/verify` | Verify signup OTP |
| POST | `/api/auth/forgot-password/send` | Send password reset OTP |
| POST | `/api/auth/forgot-password/reset` | Reset user password |
| POST | `/api/auth/signup` | Create user account and wallet |
| POST | `/api/auth/admin/login` | Admin login |
| POST | `/api/auth/user/login` | User login |
| POST | `/api/auth/login` | Generic login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/session` | Get current session |

### 5.2 Profile APIs

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/me` | Get current actor profile |
| PATCH | `/api/me` | Update profile |
| PATCH | `/api/me/password` | Change password |
| PATCH | `/api/me/pin` | Change transaction PIN |
| PATCH | `/api/me/pin/reset-after-forgot` | Reset PIN after approval |
| GET | `/api/meta/upi-handles` | List supported UPI handles |

### 5.3 Wallet and Transaction APIs

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/wallet/topup` | Add dummy money |
| POST | `/api/wallet/send` | Send money |
| POST | `/api/wallet/pay-bill` | Pay bill/recharge |
| GET | `/api/transactions` | List transactions |

### 5.4 Money Request APIs

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/wallet/money-requests` | List money requests |
| POST | `/api/wallet/money-requests` | Create money request |
| PATCH | `/api/wallet/money-requests/:id/respond` | Accept/reject request |
| PATCH | `/api/wallet/money-requests/:id/cancel` | Cancel request |
| POST | `/api/wallet/money-requests/:id/pay` | Pay request |

### 5.5 Notification APIs

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/notifications` | List notifications |
| GET | `/api/notifications/unread-count` | Get unread count |
| PATCH | `/api/notifications/read` | Mark all as read |
| PATCH | `/api/notifications/read/:id` | Mark one as read |

### 5.6 Support APIs

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/support/meta/categories` | Get complaint categories |
| GET | `/api/support/complaints` | List user complaints |
| POST | `/api/support/forgot-pin` | Create forgot-PIN complaint |
| POST | `/api/support/complaints` | Create complaint |
| GET | `/api/support/complaints/:complaintId` | View complaint |
| POST | `/api/support/complaints/:complaintId/messages` | Add user message |

### 5.7 Admin APIs

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/admin/overview` | Admin dashboard overview |
| GET | `/api/admin/:table` | List admin table records |
| POST | `/api/admin/:table` | Create admin table record |
| PATCH | `/api/admin/:table/:id` | Update admin table record |
| DELETE | `/api/admin/:table/:id` | Delete admin table record |
| GET | `/api/admin/support/overview` | Support admin overview |
| GET | `/api/admin/support/complaints` | List all complaints |
| GET | `/api/admin/support/complaints/:complaintId` | View complaint |
| PATCH | `/api/admin/support/complaints/:complaintId/status` | Update complaint status |
| PATCH | `/api/admin/support/complaints/:complaintId/priority` | Update complaint priority |
| POST | `/api/admin/support/complaints/:complaintId/messages` | Add admin message |

## 6. Data Requirements

### 6.1 Main Data Entities

#### Users

Stores customer identity, login, contact, bank, UPI, KYC, account status, and profile information.

Important fields:

- `user_id`
- `full_name`
- `email`
- `phone_number`
- `password_hash`
- `bank_account_no`
- `bank_name`
- `upi_id`
- `upi_handle`
- `date_of_birth`
- `kyc_status`
- `account_status`

#### Admins

Stores administrator identity and login data.

Important fields:

- `admin_id`
- `name`
- `email`
- `password_hash`

#### Wallets

Stores wallet identity, owner relation, balance, currency, wallet status, limits, and transaction PIN hash.

Important fields:

- `wallet_id`
- `user_id`
- `admin_id`
- `balance`
- `currency`
- `wallet_status`
- `daily_limit`
- `monthly_limit`
- `transaction_pin_hash`

#### Transactions

Stores wallet transaction records.

Important fields:

- `transaction_id`
- `wallet_id`
- `sender_wallet_id`
- `receiver_wallet_id`
- `transaction_type`
- `amount`
- `payment_method`
- `reference_number`
- `remarks`
- `transaction_status`
- `transaction_time`

#### Wallet QR

Stores QR code payloads and generated QR image URLs.

Important fields:

- `qr_id`
- `wallet_id`
- `qr_code_value`
- `qr_image_url`
- `qr_type`
- `is_active`

#### Notifications

Stores user/admin notifications.

Important fields:

- `notification_id`
- `user_id`
- `admin_id`
- `title`
- `message`
- `notification_type`
- `is_read`
- `sent_at`
- `read_at`

#### OTP Challenges

Stores OTP challenges for verification flows.

Important fields:

- `challenge_id`
- `channel`
- `target`
- `purpose`
- `code_hash`
- `expires_at`
- `verified_at`

#### Complaints

Stores support complaints.

Important fields:

- `complaint_id`
- `user_id`
- `wallet_id`
- `transaction_id`
- `subject`
- `category`
- `description`
- `status`
- `priority`

#### Complaint Attachments

Stores uploaded complaint files.

Important fields:

- `attachment_id`
- `complaint_id`
- `file_url`
- `file_name`
- `mime_type`
- `file_size`

#### Complaint Messages

Stores messages exchanged between user and admin for a complaint.

Important fields:

- `message_id`
- `complaint_id`
- `sender_type`
- `sender_id`
- `message`
- `attachment_url`

#### Complaint Status History

Stores complaint status transition records.

Important fields:

- `history_id`
- `complaint_id`
- `old_status`
- `new_status`
- `changed_by_type`
- `changed_by_id`

#### Money Requests

Stores request-money workflow records.

Important fields:

- `request_id`
- `requester_user_id`
- `requester_admin_id`
- `requester_wallet_id`
- `payer_user_id`
- `payer_admin_id`
- `payer_wallet_id`
- `amount`
- `note`
- `status`
- `payment_method`
- `responded_at`
- `paid_at`

## 7. Non-Functional Requirements

### 7.1 Usability

- NFR-USE-01: The interface shall be understandable for first-time demo users.
- NFR-USE-02: The system shall provide clear error messages for failed operations.
- NFR-USE-03: The system shall use readable labels for forms and actions.
- NFR-USE-04: The system shall provide visual feedback through toast messages and badges.

### 7.2 Performance

- NFR-PERF-01: Common user actions should complete within a few seconds on a local development machine.
- NFR-PERF-02: Admin table queries should support limiting/pagination behavior where practical.
- NFR-PERF-03: The frontend should avoid full page reloads for normal navigation.

### 7.3 Reliability

- NFR-REL-01: Database foreign keys shall be enabled.
- NFR-REL-02: SQLite WAL mode shall be used for improved local database behavior.
- NFR-REL-03: Wallet transfer operations shall update balances and transaction records consistently.
- NFR-REL-04: Invalid or incomplete requests shall return error responses.

### 7.4 Security

- NFR-SEC-01: Passwords shall be hashed before storage.
- NFR-SEC-02: Transaction PINs shall be hashed before storage.
- NFR-SEC-03: OTP codes shall be hashed before storage.
- NFR-SEC-04: Protected APIs shall require a valid JWT.
- NFR-SEC-05: Admin APIs shall require admin role authorization.
- NFR-SEC-06: Transaction operations shall require transaction PIN verification.
- NFR-SEC-07: User transactions shall require verified KYC status.
- NFR-SEC-08: Uploaded support files shall be filtered and size-limited.

### 7.5 Maintainability

- NFR-MAINT-01: Backend code shall be organized into route, service, and database modules.
- NFR-MAINT-02: Frontend support-specific logic shall be separated from the main application script where practical.
- NFR-MAINT-03: Dependencies shall be declared in `package.json`.
- NFR-MAINT-04: GitHub documentation shall clearly explain setup and run instructions.

### 7.6 Portability

- NFR-PORT-01: The application shall run on systems that support Node.js and SQLite.
- NFR-PORT-02: The frontend shall run in modern browsers.
- NFR-PORT-03: The app shall not require a separate database server for demo use.

## 8. Business Rules

- BR-01: A user must verify both email and phone OTP before account creation.
- BR-02: A user email must be unique.
- BR-03: A user phone number must be unique.
- BR-04: A bank account number must be unique.
- BR-05: A UPI ID must be unique.
- BR-06: Each user must have exactly one wallet.
- BR-07: Each admin can have a wallet where applicable.
- BR-08: A wallet must belong to either a user or an admin, not both.
- BR-09: A transaction PIN must be exactly 4 digits.
- BR-10: Users with non-verified KYC status cannot perform transaction operations.
- BR-11: Inactive wallets cannot perform transactions.
- BR-12: A wallet cannot send more money than its available balance.
- BR-13: A money request cannot be created against the requester's own wallet.
- BR-14: Only the payer can accept, reject, or pay a money request.
- BR-15: Only the requester can cancel a pending money request.
- BR-16: Only admins can update complaint status and priority.

## 9. Use Case Summary

### UC-01: User Signup

1. Guest opens signup page.
2. Guest enters email and requests email OTP.
3. System sends email OTP.
4. Guest verifies email OTP.
5. Guest enters phone and requests phone OTP.
6. System creates phone OTP challenge.
7. Guest verifies phone OTP.
8. Guest completes profile, bank, password, and PIN fields.
9. System creates user, wallet, UPI ID, and QR code.
10. System logs the user in or allows login.

### UC-02: User Login

1. User enters email and password.
2. System validates credentials.
3. System issues JWT cookie.
4. User is redirected to dashboard.

### UC-03: Send Money

1. User opens transfer screen.
2. User selects receiver identifier type.
3. User enters receiver details, amount, payment source, and transaction PIN.
4. System validates KYC, wallet status, PIN, receiver, and balance.
5. System debits sender wallet.
6. System credits receiver wallet.
7. System creates transaction and notification records.

### UC-04: Create Money Request

1. User opens transfer/request screen.
2. User enters payer details, amount, and note.
3. System validates counterparty and prevents self-request.
4. System creates money request.
5. System notifies the payer.

### UC-05: Pay Money Request

1. Payer opens money requests.
2. Payer chooses to pay a pending or accepted request.
3. System validates wallet, balance, and status.
4. System transfers money to requester.
5. System marks request as paid.
6. System records transaction and notifications.

### UC-06: Raise Complaint

1. User opens support screen.
2. User enters complaint subject, category, description, and optional attachment.
3. System stores complaint and attachment.
4. System notifies relevant actor(s).
5. User can track complaint status and messages.

### UC-07: Admin Handles Complaint

1. Admin opens support admin panel.
2. Admin views complaint list and details.
3. Admin updates status or priority.
4. Admin replies with message or attachment.
5. System updates status history and notifies the user.

### UC-08: Admin Manages Records

1. Admin logs in.
2. Admin opens admin panel.
3. Admin selects a table.
4. Admin searches, filters, creates, edits, or deletes supported records.
5. System validates role and applies the operation.

## 10. Validation and Error Handling Requirements

- VAL-01: The system shall validate email format on applicable forms.
- VAL-02: The system shall validate phone numbers as 10 digits.
- VAL-03: The system shall validate OTP as 6 digits.
- VAL-04: The system shall validate transaction PIN as 4 digits.
- VAL-05: The system shall validate positive transaction amounts.
- VAL-06: The system shall reject missing required fields.
- VAL-07: The system shall return clear JSON error messages from API failures.
- VAL-08: The frontend shall display API errors in toast messages.
- VAL-09: The system shall reject unsupported complaint file uploads.

## 11. Acceptance Criteria

The project shall be considered functionally complete for demo submission when:

- AC-01: A guest can register after email and phone OTP verification.
- AC-02: A user can log in and view the dashboard.
- AC-03: A user wallet is created with unique wallet ID, UPI ID, and QR code.
- AC-04: A verified user can add money.
- AC-05: A verified user can send money to another wallet.
- AC-06: A verified user can pay bills and recharge.
- AC-07: Transactions are recorded and visible in history.
- AC-08: Money request create/respond/pay/cancel flows work correctly.
- AC-09: Notifications are created and unread counts are displayed.
- AC-10: Users can create and track support complaints.
- AC-11: Admins can log in and access admin-only features.
- AC-12: Admins can manage users, wallets, transactions, notifications, and support complaints.
- AC-13: KYC restrictions prevent unverified users from transacting.
- AC-14: Invalid credentials, OTPs, PINs, and transaction inputs are rejected.
- AC-15: The app can be installed with `npm install` and run with `npm start`.

## 12. Out of Scope

The following are outside the current project scope:

- Real banking integration
- Real payment gateway processing
- Real SMS provider integration
- Production-grade fraud detection
- Production-grade audit logging
- Multi-server deployment
- Cloud object storage for uploads
- Native mobile applications
- Advanced financial compliance workflows

## 13. Future Enhancements

- Add dashboard charts and analytics.
- Add transaction export as CSV or PDF.
- Add more advanced admin reporting.
- Add pagination for all large tables.
- Add stronger automated test coverage.
- Add role-based admin permissions.
- Add real SMS gateway integration.
- Move email credentials to environment variables.
- Add deployment documentation.
- Add Docker support.
- Add API documentation using OpenAPI/Swagger.

## 14. Appendix: Project Structure

```text
.
├── public/
│   ├── index.html
│   ├── app.js
│   ├── support.js
│   ├── styles.css
│   └── swiftpay-icon.png
├── src/
│   ├── server.js
│   ├── db.js
│   ├── otpService.js
│   ├── moneyRequestsService.js
│   ├── complaintsRoutes.js
│   └── complaintsService.js
├── uploads/
├── package.json
├── package-lock.json
├── requirements.txt
└── wallet.db
```

## 15. Appendix: Installation and Execution

```bash
npm install
npm start
```

Default local URL:

```text
http://localhost:3000
```
