<?php
declare(strict_types=1);

/**
 * Build the lead visibility predicate for an authenticated staff role.
 * Returns null for roles that are not allowed to access CRM leads.
 *
 * @return array{0:string,1:array<int,string>}|null
 */
function buildAdminLeadScope(string $role, ?string $officeId, ?string $teamId, string $userId): ?array {
    if ($role === 'Office Manager') {
        return ['l.assigned_office_id = ?', [$officeId ?: '__no_office__']];
    }

    if ($role === 'Team Leader') {
        if ($teamId) {
            return ['(l.assigned_team_id = ? OR l.assigned_team_leader_id = ?)', [$teamId, $userId]];
        }
        return ['l.assigned_team_leader_id = ?', [$userId]];
    }

    if ($role === 'Agent') {
        return ['l.assigned_agent_id = ?', [$userId]];
    }

    if ($role === 'Super Admin') {
        return ['', []];
    }

    return null;
}