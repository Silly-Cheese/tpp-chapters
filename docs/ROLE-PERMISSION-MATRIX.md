# Final Role and Permission Matrix

This matrix describes intended production behavior. Firestore and Cloud Storage Rules remain the final authorization authority.

## Public visitor

Can:

- Search and verify published chapters when the registry is enabled
- View public-safe chapter records
- Submit an unauthorized-chapter concern
- Open login, password-reset, and activation pages when enabled

Cannot:

- Read private chapter records
- Read leadership email addresses
- Read submissions, support tickets, documents, or audit records
- Assign roles or chapter access

## Chapter Director

Can, for assigned active chapters:

- View chapter standing, compliance, leadership, documents, and notices
- Submit reports, event proposals, renewals, change requests, and documents
- Open shared chapter support tickets
- Read shared chapter support tickets
- Acknowledge required notices

Cannot:

- Change official authorization status or standing
- Approve their own submissions or renewal
- Read confidential Adviser-only conversations
- Assign portal roles or membership
- Access another chapter by changing a URL

## Chapter Adviser

Can, for assigned active chapters:

- Use the chapter workspace and operational submission system
- Complete Adviser confirmations
- Open shared chapter support tickets
- Open confidential Adviser-only support tickets
- Submit confidential Adviser check-ins
- Review institutional and oversight requirements

Cannot:

- Change official standing or authorization
- Approve their own confirmation
- Read another Adviser's confidential conversation unless explicitly authorized through a different administrative role
- Manage portal users or memberships

## Chapter User

Can, when active and verified:

- Access only the chapter areas explicitly allowed by the current portal implementation and Security Rules

Cannot:

- Perform Director-only renewals
- Perform Adviser-only confirmations or confidential Adviser actions
- Manage official chapter records

## Support Agent

Can:

- Read operational chapter context required for support
- Manage shared and Adviser-private support tickets
- Assign, escalate, resolve, and close support tickets
- Add staff-only internal notes
- Review unauthorized-chapter concerns under the current rules
- View the Phase 8 system-health console

Cannot:

- Publish or unpublish chapter registry records
- Change official chapter status or standing
- Approve operational submissions
- Assign chapter memberships
- Change portal roles or system settings

## Compliance Administrator

Can:

- Read administrative directories
- Manage private chapter operational records
- Manage requirements and compliance status
- Review submissions and renewals
- Manage support tickets
- Publish chapter notices
- View the system-health console

Cannot under the current rules:

- Publish or unpublish the public registry
- Assign chapter memberships
- Change staff roles or portal account status
- Change system settings

## Chapter Administrator

Can:

- Manage private chapter records
- Publish and unpublish public registry records
- Issue Director and Adviser invitations
- Assign and update chapter memberships
- Manage chapter workspaces and notices
- Review operational submissions
- Manage support tickets and concern reports
- View the system-health console

Cannot:

- Change Owner or staff roles
- Change system settings reserved for the Owner
- Remove the Owner's protection

## Owner

Can:

- Use every administrative portal area
- Manage staff and chapter-account roles
- Change portal account status
- Manage chapters, registry records, memberships, submissions, support, concerns, and notices
- Change system settings and maintenance mode
- View system health and audit history
- Delete records only where the Security Rules explicitly permit Owner deletion

Owner protection:

- The signed-in Owner cannot remove their own Owner role through the Phase 7 console.
- A second carefully controlled Owner account is recommended only when organizational governance requires it.

## Required denial-path tests

Before production launch, verify all of the following with separate accounts:

1. A Director cannot read another chapter's private record.
2. A Director cannot read an Adviser-private ticket.
3. An Adviser cannot read another Adviser's private ticket.
4. A chapter user cannot update official standing or authorization.
5. A Support Agent cannot publish a registry record.
6. A Compliance Administrator cannot assign membership or publish the registry.
7. A Chapter Administrator cannot change Owner settings or staff roles.
8. A disabled portal profile cannot read protected Firestore documents.
9. An unverified chapter account cannot access private chapter data.
10. Unsupported or oversized attachments are rejected by Storage Rules.
11. Direct document URLs remain protected after sign-out.
12. Maintenance and feature gates do not block active administrators from reaching recovery controls.
