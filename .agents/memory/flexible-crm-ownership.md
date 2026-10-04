---
name: Flexible CRM ownership
description: Product rule for optional office/team relationships and direct team-leader ownership of clients.
---

The CRM hierarchy is deliberately flexible:
- Super Admins can manage agents without an office or team.
- Teams can exist without offices.
- Office Managers can manage clients assigned to the office without a team or agent.
- Team Leaders can own clients directly without a team or agent.
- A Team Leader with a team sees that team's clients plus clients assigned directly to them; a standalone Team Leader sees only clients explicitly assigned to them.

**Why:** The user requested these independent management and ownership paths rather than requiring every record to fit a strict office → team → agent tree.

**How to apply:** Keep office and team relationships optional. Preserve direct Team Leader ownership as a distinct explicit assignment, and do not treat unassigned clients as owned by a standalone leader.