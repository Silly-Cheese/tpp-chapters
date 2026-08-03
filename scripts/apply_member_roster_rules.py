from pathlib import Path

rules_path = Path("firestore.rules")
text = rules_path.read_text(encoding="utf-8")

function_anchor = """    function submissionTypeAllowed(chapterId, type) {
"""
member_functions = """    function validChapterRosterMemberData(chapterId, data) {
      return data.chapterId == chapterId
        && validChapterId(data.chapterId)
        && data.fullName is string
        && data.fullName.size() >= 2
        && data.fullName.size() <= 100
        && data.preferredName is string
        && data.preferredName.size() <= 60
        && data.email is string
        && data.email.size() <= 160
        && data.memberRole in [
          'member', 'volunteer', 'prayer_leader', 'secretary',
          'treasurer', 'outreach_coordinator'
        ]
        && data.status in ['active', 'inactive', 'removed']
        && data.joinedDate is string
        && data.joinedDate.size() <= 20
        && data.notes is string
        && data.notes.size() <= 1000
        && data.createdByUid is string
        && data.createdByUid.size() > 0
        && data.lastModifiedByUid is string
        && data.lastModifiedByUid.size() > 0
        && data.createdAt is timestamp
        && data.updatedAt is timestamp
        && (data.removedAt == null || data.removedAt is timestamp);
    }

    function validNewChapterRosterMember(chapterId) {
      return (canManageChapterWorkspaces()
          || hasChapterMembershipRole(chapterId, ['director', 'adviser']))
        && request.resource.data.keys().hasAll([
          'chapterId', 'fullName', 'preferredName', 'email', 'memberRole',
          'status', 'joinedDate', 'notes', 'createdByUid',
          'lastModifiedByUid', 'createdAt', 'updatedAt', 'removedAt'
        ])
        && request.resource.data.keys().hasOnly([
          'chapterId', 'fullName', 'preferredName', 'email', 'memberRole',
          'status', 'joinedDate', 'notes', 'createdByUid',
          'lastModifiedByUid', 'createdAt', 'updatedAt', 'removedAt'
        ])
        && validChapterRosterMemberData(chapterId, request.resource.data)
        && request.resource.data.status in ['active', 'inactive']
        && request.resource.data.createdByUid == request.auth.uid
        && request.resource.data.lastModifiedByUid == request.auth.uid
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time
        && request.resource.data.removedAt == null;
    }

    function validChapterRosterMemberUpdate(chapterId) {
      return (canManageChapterWorkspaces()
          || hasChapterMembershipRole(chapterId, ['director', 'adviser']))
        && request.resource.data.keys().hasAll([
          'chapterId', 'fullName', 'preferredName', 'email', 'memberRole',
          'status', 'joinedDate', 'notes', 'createdByUid',
          'lastModifiedByUid', 'createdAt', 'updatedAt', 'removedAt'
        ])
        && request.resource.data.keys().hasOnly([
          'chapterId', 'fullName', 'preferredName', 'email', 'memberRole',
          'status', 'joinedDate', 'notes', 'createdByUid',
          'lastModifiedByUid', 'createdAt', 'updatedAt', 'removedAt'
        ])
        && validChapterRosterMemberData(chapterId, request.resource.data)
        && request.resource.data.chapterId == resource.data.chapterId
        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.lastModifiedByUid == request.auth.uid
        && request.resource.data.updatedAt == request.time
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'fullName', 'preferredName', 'email', 'memberRole', 'status',
          'joinedDate', 'notes', 'lastModifiedByUid', 'updatedAt', 'removedAt'
        ])
        && ((request.resource.data.status == 'removed'
              && request.resource.data.removedAt == request.time)
            || (request.resource.data.status in ['active', 'inactive']
              && request.resource.data.removedAt == null));
    }

"""

if "function validNewChapterRosterMember" not in text:
    if function_anchor not in text:
        raise SystemExit("Could not find rules function insertion point")
    text = text.replace(function_anchor, member_functions + function_anchor, 1)

match_anchor = """      match /documents/{documentId} {
"""
member_match = """      match /members/{memberId} {
        allow read: if canReadChapterOperations() || hasChapterMembership(chapterId);
        allow create: if validNewChapterRosterMember(chapterId);
        allow update: if validChapterRosterMemberUpdate(chapterId);
        allow delete: if isOwner();
      }

"""

if "match /members/{memberId}" not in text:
    if match_anchor not in text:
        raise SystemExit("Could not find chapter member match insertion point")
    text = text.replace(match_anchor, member_match + match_anchor, 1)

rules_path.write_text(text, encoding="utf-8")

script_path = Path("assets/js/chapter-portal-mobile-members.js")
script = script_path.read_text(encoding="utf-8")
script = script.replace("  memberState.ready = Boolean(user);", "  memberState.ready = true;", 1)
script_path.write_text(script, encoding="utf-8")

print("Chapter member roster rules and portal fixes applied.")
