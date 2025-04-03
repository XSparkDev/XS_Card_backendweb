const { db, admin } = require('../../firebase.js');
const csv = require('csv-stringify');

// Helper function for standardized error responses
const sendError = (res, status, message, error = null) => {
    console.error(`${message}:`, error);
    res.status(status).send({ 
        success: false,
        message,
        ...(error && { error: error.message })
    });
};

// Export teams as CSV
exports.exportTeams = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;

        if (!enterpriseId) {
            return sendError(res, 400, 'Enterprise ID is required');
        }

        // Check if enterprise exists
        const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
        const enterpriseDoc = await enterpriseRef.get();

        if (!enterpriseDoc.exists) {
            return sendError(res, 404, 'Enterprise not found');
        }

        let teamsSnapshot;

        if (departmentId) {
            // Fetch teams for a specific department
            const departmentRef = enterpriseRef.collection('departments').doc(departmentId);
            const departmentDoc = await departmentRef.get();

            if (!departmentDoc.exists) {
                return sendError(res, 404, 'Department not found');
            }

            teamsSnapshot = await departmentRef.collection('teams').get();
        } else {
            // Fetch teams across all departments
            teamsSnapshot = await db.collectionGroup('teams').get();
        }

        if (teamsSnapshot.empty) {
            return res.status(200).send({
                success: true,
                message: 'No teams found',
                teams: []
            });
        }

        // Prepare CSV headers and data
        const headers = [
            'ID',
            'Name',
            'Description',
            'Department',
            'Member Count',
            'Has Leader',
            'Leader Name',
            'Created Date',
            'Last Updated'
        ];

        const rows = [headers];

        // Process each team
        for (const doc of teamsSnapshot.docs) {
            const team = doc.data();

            // Get department name if available
            let departmentName = 'Unknown';
            if (team.departmentRef) {
                try {
                    const deptDoc = await team.departmentRef.get();
                    departmentName = deptDoc.exists ? deptDoc.data().name : 'Unknown';
                } catch (err) {
                    console.error('Error fetching department name:', err);
                }
            }

            // Get leader name if exists
            let leaderName = 'None';
            if (team.leaderRef) {
                try {
                    const leaderDoc = await team.leaderRef.get();
                    if (leaderDoc.exists) {
                        const leader = leaderDoc.data();
                        leaderName = `${leader.firstName || ''} ${leader.lastName || ''}`.trim();
                    }
                } catch (err) {
                    console.error('Error fetching leader info:', err);
                }
            }

            // Format dates
            const createdAt = team.createdAt ? team.createdAt.toDate().toISOString().split('T')[0] : 'N/A';
            const updatedAt = team.updatedAt ? team.updatedAt.toDate().toISOString().split('T')[0] : 'N/A';

            rows.push([
                doc.id,
                team.name || '',
                team.description || '',
                departmentName,
                team.memberCount || 0,
                team.leaderId ? 'Yes' : 'No',
                leaderName,
                createdAt,
                updatedAt
            ]);
        }

        // Generate CSV
        csv.stringify(rows, (err, output) => {
            if (err) {
                return sendError(res, 500, 'Error generating CSV', err);
            }

            // Set headers for file download
            const filename = departmentId
                ? `teams_${enterpriseId}_${departmentId}_${Date.now()}.csv`
                : `all_teams_${enterpriseId}_${Date.now()}.csv`;

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            // Send the CSV
            res.status(200).send(output);
        });
    } catch (error) {
        sendError(res, 500, 'Error exporting teams', error);
    }
};

// Export an individual team as CSV
exports.exportIndividualTeam = async (req, res) => {
    try {
        const { enterpriseId, departmentId, teamId } = req.params;

        if (!enterpriseId || !departmentId || !teamId) {
            return sendError(res, 400, 'Enterprise ID, Department ID, and Team ID are required');
        }

        // Check if department exists
        const departmentRef = db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId);
        const departmentDoc = await departmentRef.get();

        if (!departmentDoc.exists) {
            return sendError(res, 404, 'Department not found');
        }

        // Check if team exists
        const teamRef = departmentRef.collection('teams').doc(teamId);
        const teamDoc = await teamRef.get();

        if (!teamDoc.exists) {
            return sendError(res, 404, 'Team not found');
        }

        // Get team data
        const team = teamDoc.data();

        // Get leader name if exists
        let leaderName = 'None';
        if (team.leaderRef) {
            try {
                const leaderDoc = await team.leaderRef.get();
                if (leaderDoc.exists) {
                    const leader = leaderDoc.data();
                    leaderName = `${leader.firstName || ''} ${leader.lastName || ''}`.trim();
                }
            } catch (err) {
                console.error('Error fetching leader info:', err);
            }
        }

        // Format dates
        const createdAt = team.createdAt ? team.createdAt.toDate().toISOString().split('T')[0] : 'N/A';
        const updatedAt = team.updatedAt ? team.updatedAt.toDate().toISOString().split('T')[0] : 'N/A';

        // Prepare CSV headers and data
        const headers = [
            'ID',
            'Name',
            'Description',
            'Department',
            'Member Count',
            'Has Leader',
            'Leader Name',
            'Created Date',
            'Last Updated'
        ];

        const rows = [
            headers,
            [
                teamId,
                team.name || '',
                team.description || '',
                departmentDoc.data().name || 'Unknown',
                team.memberCount || 0,
                team.leaderId ? 'Yes' : 'No',
                leaderName,
                createdAt,
                updatedAt
            ]
        ];

        // Generate CSV
        csv.stringify(rows, (err, output) => {
            if (err) {
                return sendError(res, 500, 'Error generating CSV', err);
            }

            // Set headers for file download
            const filename = `team_${teamId}_${Date.now()}.csv`;

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            // Send the CSV
            res.status(200).send(output);
        });
    } catch (error) {
        sendError(res, 500, 'Error exporting team', error);
    }
};

module.exports = exports;
