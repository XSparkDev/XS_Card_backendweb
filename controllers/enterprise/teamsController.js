const { db, admin } = require('../../firebase.js');

// Helper function for standardized error responses
const sendError = (res, status, message, error = null) => {
    console.error(`${message}:`, error);
    res.status(status).send({ 
        success: false,
        message,
        ...(error && { error: error.message })
    });
};

// Create a new team
exports.createTeam = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        const { name, description, leaderId = null } = req.body;
        
        if (!enterpriseId || !departmentId) {
            return sendError(res, 400, 'Enterprise ID and Department ID are required');
        }
        
        if (!name) {
            return sendError(res, 400, 'Team name is required');
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

        // Convert team name to a URL-friendly slug
        const slugify = str => str.toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove non-word chars
            .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
            
        const teamId = slugify(name);
        
        // Check for duplicate team name in this department
        const duplicateCheck = await departmentRef
            .collection('teams')
            .where('name', '==', name)
            .get();
            
        if (!duplicateCheck.empty) {
            return sendError(res, 409, 'A team with this name already exists in this department');
        }
        
        // Check if a team with this ID already exists (from a similarly named team)
        const existingDocCheck = await departmentRef
            .collection('teams')
            .doc(teamId)
            .get();
            
        if (existingDocCheck.exists) {
            return sendError(res, 409, 'A team with a similar name already exists in this department');
        }

        // Validate team leader if provided
        let leaderRef = null;
        if (leaderId) {
            // Check if leader exists as an employee in this department
            const leaderCheck = await departmentRef
                .collection('employees')
                .doc(leaderId)
                .get();
                
            if (!leaderCheck.exists) {
                return sendError(res, 404, 'Team leader not found in this department');
            }
            
            leaderRef = leaderCheck.ref;
        }

        // Create team data object
        const teamData = {
            name,
            description: description || '',
            departmentId, // Store the department ID as required
            departmentRef: departmentRef, // Store a reference to the parent department
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            leaderId: leaderId,
            leaderRef: leaderRef,
            memberCount: 0
        };

        // Use the document reference with our custom ID
        const teamRef = departmentRef.collection('teams').doc(teamId);
        await teamRef.set(teamData);
        
        console.log(`Created team with ID: ${teamId} in department: ${departmentId}`);

        res.status(201).send({
            success: true,
            message: 'Team created successfully',
            team: {
                id: teamId,
                ...teamData,
                departmentRef: departmentRef.path,
                leaderRef: leaderRef ? leaderRef.path : null,
                createdAt: teamData.createdAt.toDate().toISOString(),
                updatedAt: teamData.updatedAt.toDate().toISOString()
            }
        });
    } catch (error) {
        sendError(res, 500, 'Error creating team', error);
    }
};

// Get all teams in a department
exports.getAllTeams = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        
        if (!enterpriseId || !departmentId) {
            return sendError(res, 400, 'Enterprise ID and Department ID are required');
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

        // Get all teams in this department
        const teamsSnapshot = await departmentRef.collection('teams').get();
        
        if (teamsSnapshot.empty) {
            return res.status(200).send({ 
                success: true,
                teams: [],
                message: 'No teams found in this department'
            });
        }

        // Process teams data
        const teams = [];
        teamsSnapshot.forEach(doc => {
            const team = doc.data();
            
            // Format timestamps and references for the response
            const formattedTeam = {
                id: doc.id,
                name: team.name,
                description: team.description,
                departmentId: team.departmentId,
                departmentRef: team.departmentRef ? team.departmentRef.path : null,
                leaderId: team.leaderId,
                leaderRef: team.leaderRef ? team.leaderRef.path : null,
                memberCount: team.memberCount || 0,
                createdAt: team.createdAt ? team.createdAt.toDate().toISOString() : null,
                updatedAt: team.updatedAt ? team.updatedAt.toDate().toISOString() : null
            };
            
            teams.push(formattedTeam);
        });

        res.status(200).send({
            success: true,
            teams,
            count: teams.length
        });
    } catch (error) {
        sendError(res, 500, 'Error fetching teams', error);
    }
};

// Get a specific team by ID
exports.getTeamById = async (req, res) => {
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

        // Get the team
        const teamRef = departmentRef.collection('teams').doc(teamId);
        const teamDoc = await teamRef.get();
        
        if (!teamDoc.exists) {
            return sendError(res, 404, 'Team not found');
        }

        // Format team data
        const team = teamDoc.data();
        const formattedTeam = {
            id: teamDoc.id,
            name: team.name,
            description: team.description,
            departmentId: team.departmentId,
            departmentRef: team.departmentRef ? team.departmentRef.path : null,
            leaderId: team.leaderId,
            leaderRef: team.leaderRef ? team.leaderRef.path : null,
            memberCount: team.memberCount || 0,
            createdAt: team.createdAt ? team.createdAt.toDate().toISOString() : null,
            updatedAt: team.updatedAt ? team.updatedAt.toDate().toISOString() : null
        };

        res.status(200).send({
            success: true,
            team: formattedTeam
        });
    } catch (error) {
        sendError(res, 500, 'Error fetching team', error);
    }
};

// Update a team
exports.updateTeam = async (req, res) => {
    try {
        const { enterpriseId, departmentId, teamId } = req.params;
        const { name, description, leaderId } = req.body;
        
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

        // Prepare update data
        const updateData = {
            updatedAt: admin.firestore.Timestamp.now()
        };

        if (name !== undefined) {
            // Check if the new name conflicts with existing teams
            if (name !== teamDoc.data().name) {
                const nameCheck = await departmentRef
                    .collection('teams')
                    .where('name', '==', name)
                    .get();
                    
                if (!nameCheck.empty) {
                    return sendError(res, 409, 'A team with this name already exists in this department');
                }
            }
            
            updateData.name = name;
        }
        
        if (description !== undefined) updateData.description = description;
        
        // Validate and update leader if provided
        if (leaderId !== undefined) {
            if (leaderId === null) {
                // Remove leader
                updateData.leaderId = null;
                updateData.leaderRef = null;
            } else {
                // Check if leader exists as an employee in this department
                const leaderCheck = await departmentRef
                    .collection('employees')
                    .doc(leaderId)
                    .get();
                    
                if (!leaderCheck.exists) {
                    return sendError(res, 404, 'Team leader not found in this department');
                }
                
                updateData.leaderId = leaderId;
                updateData.leaderRef = leaderCheck.ref;
            }
        }

        // Update the team
        await teamRef.update(updateData);

        // Get updated document
        const updatedDoc = await teamRef.get();
        const updatedData = updatedDoc.data();

        // Format for response
        const formattedTeam = {
            id: teamId,
            name: updatedData.name,
            description: updatedData.description,
            departmentId: updatedData.departmentId,
            departmentRef: updatedData.departmentRef ? updatedData.departmentRef.path : null,
            leaderId: updatedData.leaderId,
            leaderRef: updatedData.leaderRef ? updatedData.leaderRef.path : null,
            memberCount: updatedData.memberCount || 0,
            createdAt: updatedData.createdAt ? updatedData.createdAt.toDate().toISOString() : null,
            updatedAt: updatedData.updatedAt ? updatedData.updatedAt.toDate().toISOString() : null
        };

        res.status(200).send({
            success: true,
            message: 'Team updated successfully',
            team: formattedTeam
        });
    } catch (error) {
        sendError(res, 500, 'Error updating team', error);
    }
};

// Patch a team (for specific field updates)
exports.patchTeam = async (req, res) => {
    try {
        const { enterpriseId, departmentId, teamId } = req.params;
        const { name, description, leaderId } = req.body;
        
        // Check if at least one allowed field is provided
        if (name === undefined && description === undefined && leaderId === undefined) {
            return sendError(res, 400, 'At least one of name, description, or leaderId must be provided');
        }
        
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
        
        const teamData = teamDoc.data();

        // Prepare update data - only include specified fields
        const updateData = {
            updatedAt: admin.firestore.Timestamp.now()
        };

        // Handle name change with validation
        if (name !== undefined) {
            if (name !== teamData.name) {
                // Check for name conflicts only if name is changing
                const nameCheck = await departmentRef
                    .collection('teams')
                    .where('name', '==', name)
                    .get();
                    
                if (!nameCheck.empty) {
                    return sendError(res, 409, 'A team with this name already exists in this department');
                }
            }
            updateData.name = name;
        }
        
        // Handle description update
        if (description !== undefined) {
            updateData.description = description;
        }
        
        // Handle leader change with validation
        if (leaderId !== undefined) {
            if (leaderId === null) {
                // Remove leader
                updateData.leaderId = null;
                updateData.leaderRef = null;
            } else {
                // Check if leader exists as an employee
                const leaderCheck = await departmentRef
                    .collection('employees')
                    .doc(leaderId)
                    .get();
                    
                if (!leaderCheck.exists) {
                    return sendError(res, 404, 'Team leader not found in this department');
                }
                
                updateData.leaderId = leaderId;
                updateData.leaderRef = leaderCheck.ref;
            }
        }

        // Update the team with only the specified fields
        await teamRef.update(updateData);

        // Get updated document
        const updatedDoc = await teamRef.get();
        const updatedData = updatedDoc.data();

        // Format for response
        const formattedTeam = {
            id: teamId,
            name: updatedData.name,
            description: updatedData.description,
            departmentId: updatedData.departmentId,
            departmentRef: updatedData.departmentRef ? updatedData.departmentRef.path : null,
            leaderId: updatedData.leaderId,
            leaderRef: updatedData.leaderRef ? updatedData.leaderRef.path : null,
            memberCount: updatedData.memberCount || 0,
            createdAt: updatedData.createdAt ? updatedData.createdAt.toDate().toISOString() : null,
            updatedAt: updatedData.updatedAt ? updatedData.updatedAt.toDate().toISOString() : null
        };

        res.status(200).send({
            success: true,
            message: 'Team updated successfully',
            team: formattedTeam,
            patchedFields: Object.keys(updateData).filter(key => key !== 'updatedAt')
        });
    } catch (error) {
        sendError(res, 500, 'Error updating team', error);
    }
};

// Delete a team
exports.deleteTeam = async (req, res) => {
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

        // Check if team has members
        const teamData = teamDoc.data();
        if (teamData.memberCount && teamData.memberCount > 0) {
            return sendError(res, 409, 'Cannot delete a team with members. Remove or reassign team members first.');
        }

        // Delete the team
        await teamRef.delete();

        res.status(200).send({
            success: true,
            message: 'Team deleted successfully',
            teamId
        });
    } catch (error) {
        sendError(res, 500, 'Error deleting team', error);
    }
};

// Get all members of a team
exports.getTeamMembers = async (req, res) => {
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

        // Get team members directly from the team's employees subcollection
        const membersSnapshot = await teamRef.collection('employees').get();
            
        if (membersSnapshot.empty) {
            return res.status(200).send({
                success: true,
                members: [],
                message: 'No members found in this team'
            });
        }

        // Process members data
        const members = [];
        membersSnapshot.forEach(doc => {
            const member = doc.data();
            
            // Format timestamps and references
            const formattedMember = {
                id: doc.id,
                firstName: member.firstName,
                lastName: member.lastName,
                email: member.email,
                phone: member.phone,
                title: member.title,
                employeeId: member.employeeId,
                departmentId: member.departmentId,
                mainEmployeeRef: member.mainEmployeeRef ? member.mainEmployeeRef.path : null,
                createdAt: member.createdAt ? member.createdAt.toDate().toISOString() : null
            };
            
            members.push(formattedMember);
        });

        res.status(200).send({
            success: true,
            members,
            count: members.length
        });
    } catch (error) {
        sendError(res, 500, 'Error fetching team members', error);
    }
};

/**
 * Add an existing department employee to a team
 */
exports.addEmployeeToTeam = async (req, res) => {
    try {
        const { enterpriseId, departmentId, teamId } = req.params;
        const { employeeId } = req.body;
        
        if (!enterpriseId || !departmentId || !teamId || !employeeId) {
            return sendError(res, 400, 'Enterprise ID, Department ID, Team ID, and Employee ID are required');
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

        // Check if employee exists in the department
        const employeeRef = departmentRef.collection('employees').doc(employeeId);
        const employeeDoc = await employeeRef.get();
        
        if (!employeeDoc.exists) {
            return sendError(res, 404, 'Employee not found in this department');
        }

        const employeeData = employeeDoc.data();

        // Check if employee is already in this team
        const existingTeamEmployee = await teamRef.collection('employees')
            .where('employeeRef', '==', employeeRef)
            .get();
            
        if (!existingTeamEmployee.empty) {
            return sendError(res, 409, 'Employee is already a member of this team');
        }

        // Check if employee is already in another team
        if (employeeData.teamRef && employeeData.teamEmployeeRef) {
            const currentTeamDoc = await employeeData.teamRef.get();
            const currentTeamName = currentTeamDoc.exists ? currentTeamDoc.data().name : 'Unknown Team';
            return sendError(res, 409, `Employee is already a member of team "${currentTeamName}". Remove them from that team first.`);
        }

        // Add employee to team
        const teamEmployeeData = {
            employeeRef: employeeRef,
            userId: employeeData.userId,
            name: employeeData.name || '',
            surname: employeeData.surname || '',
            role: employeeData.role,
            position: employeeData.position || '',
            addedAt: admin.firestore.Timestamp.now()
        };
        
        const teamEmployeeRef = await teamRef.collection('employees').add(teamEmployeeData);
        
        // Update employee record with team references
        await employeeRef.update({
            teamRef: teamRef,
            teamEmployeeRef: teamEmployeeRef,
            updatedAt: admin.firestore.Timestamp.now()
        });
        
        // Update team member count
        await teamRef.update({
            memberCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.Timestamp.now()
        });

        res.status(200).send({
            success: true,
            message: 'Employee added to team successfully',
            data: {
                teamId: teamId,
                employeeId: employeeId,
                teamEmployeeId: teamEmployeeRef.id,
                employeeName: `${employeeData.name} ${employeeData.surname}`,
                teamName: teamDoc.data().name
            }
        });

    } catch (error) {
        console.error('Error adding employee to team:', error);
        sendError(res, 500, 'Error adding employee to team', error);
    }
};

/**
 * Remove an employee from a team (but keep them in the department)
 */
exports.removeEmployeeFromTeam = async (req, res) => {
    try {
        const { enterpriseId, departmentId, teamId, employeeId } = req.params;
        
        if (!enterpriseId || !departmentId || !teamId || !employeeId) {
            return sendError(res, 400, 'Enterprise ID, Department ID, Team ID, and Employee ID are required');
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

        // Check if employee exists in the department
        const employeeRef = departmentRef.collection('employees').doc(employeeId);
        const employeeDoc = await employeeRef.get();
        
        if (!employeeDoc.exists) {
            return sendError(res, 404, 'Employee not found in this department');
        }

        const employeeData = employeeDoc.data();

        // Check if employee is in this team
        if (!employeeData.teamRef || !employeeData.teamEmployeeRef || employeeData.teamRef.id !== teamId) {
            return sendError(res, 404, 'Employee is not a member of this team');
        }

        // Remove employee from team
        await db.runTransaction(async (transaction) => {
            // Delete from team's employees collection
            transaction.delete(employeeData.teamEmployeeRef);
            
            // Update employee record to remove team references
            transaction.update(employeeRef, {
                teamRef: admin.firestore.FieldValue.delete(),
                teamEmployeeRef: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.Timestamp.now()
            });
            
            // Decrement team member count
            transaction.update(teamRef, {
                memberCount: admin.firestore.FieldValue.increment(-1),
                updatedAt: admin.firestore.Timestamp.now()
            });
        });

        res.status(200).send({
            success: true,
            message: 'Employee removed from team successfully',
            data: {
                teamId: teamId,
                employeeId: employeeId,
                employeeName: `${employeeData.name} ${employeeData.surname}`,
                teamName: teamDoc.data().name,
                stillInDepartment: true
            }
        });

    } catch (error) {
        console.error('Error removing employee from team:', error);
        sendError(res, 500, 'Error removing employee from team', error);
    }
};

/**
 * Bulk add multiple employees to a team
 */
exports.bulkAddEmployeesToTeam = async (req, res) => {
    try {
        const { enterpriseId, departmentId, teamId } = req.params;
        const { employeeIds } = req.body;
        
        if (!enterpriseId || !departmentId || !teamId) {
            return sendError(res, 400, 'Enterprise ID, Department ID, and Team ID are required');
        }
        
        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return sendError(res, 400, 'employeeIds array is required and must not be empty');
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

        const results = {
            successful: [],
            failed: [],
            alreadyInTeam: [],
            notFound: []
        };

        // Process each employee
        for (const employeeId of employeeIds) {
            try {
                // Check if employee exists in the department
                const employeeRef = departmentRef.collection('employees').doc(employeeId);
                const employeeDoc = await employeeRef.get();
                
                if (!employeeDoc.exists) {
                    results.notFound.push({ employeeId, reason: 'Employee not found in department' });
                    continue;
                }

                const employeeData = employeeDoc.data();

                // Check if employee is already in this team
                const existingTeamEmployee = await teamRef.collection('employees')
                    .where('employeeRef', '==', employeeRef)
                    .get();
                    
                if (!existingTeamEmployee.empty) {
                    results.alreadyInTeam.push({ 
                        employeeId, 
                        name: `${employeeData.name} ${employeeData.surname}`,
                        reason: 'Already a member of this team' 
                    });
                    continue;
                }

                // Check if employee is already in another team
                if (employeeData.teamRef && employeeData.teamEmployeeRef) {
                    const currentTeamDoc = await employeeData.teamRef.get();
                    const currentTeamName = currentTeamDoc.exists ? currentTeamDoc.data().name : 'Unknown Team';
                    results.failed.push({ 
                        employeeId, 
                        name: `${employeeData.name} ${employeeData.surname}`,
                        reason: `Already in team "${currentTeamName}"` 
                    });
                    continue;
                }

                // Add employee to team
                const teamEmployeeData = {
                    employeeRef: employeeRef,
                    userId: employeeData.userId,
                    name: employeeData.name || '',
                    surname: employeeData.surname || '',
                    role: employeeData.role,
                    position: employeeData.position || '',
                    addedAt: admin.firestore.Timestamp.now()
                };
                
                const teamEmployeeRef = await teamRef.collection('employees').add(teamEmployeeData);
                
                // Update employee record with team references
                await employeeRef.update({
                    teamRef: teamRef,
                    teamEmployeeRef: teamEmployeeRef,
                    updatedAt: admin.firestore.Timestamp.now()
                });

                results.successful.push({
                    employeeId,
                    name: `${employeeData.name} ${employeeData.surname}`,
                    teamEmployeeId: teamEmployeeRef.id
                });

            } catch (error) {
                results.failed.push({ 
                    employeeId, 
                    reason: error.message 
                });
            }
        }

        // Update team member count
        if (results.successful.length > 0) {
            await teamRef.update({
                memberCount: admin.firestore.FieldValue.increment(results.successful.length),
                updatedAt: admin.firestore.Timestamp.now()
            });
        }

        res.status(200).send({
            success: true,
            message: `Bulk add completed. ${results.successful.length} employees added successfully.`,
            data: {
                teamId,
                teamName: teamDoc.data().name,
                summary: {
                    total: employeeIds.length,
                    successful: results.successful.length,
                    failed: results.failed.length,
                    alreadyInTeam: results.alreadyInTeam.length,
                    notFound: results.notFound.length
                },
                results
            }
        });

    } catch (error) {
        console.error('Error bulk adding employees to team:', error);
        sendError(res, 500, 'Error bulk adding employees to team', error);
    }
};

/**
 * Bulk remove multiple employees from a team
 */
exports.bulkRemoveEmployeesFromTeam = async (req, res) => {
    try {
        const { enterpriseId, departmentId, teamId } = req.params;
        const { employeeIds } = req.body;
        
        if (!enterpriseId || !departmentId || !teamId) {
            return sendError(res, 400, 'Enterprise ID, Department ID, and Team ID are required');
        }
        
        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return sendError(res, 400, 'employeeIds array is required and must not be empty');
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

        const results = {
            successful: [],
            failed: [],
            notInTeam: [],
            notFound: []
        };

        // Process each employee
        for (const employeeId of employeeIds) {
            try {
                // Check if employee exists in the department
                const employeeRef = departmentRef.collection('employees').doc(employeeId);
                const employeeDoc = await employeeRef.get();
                
                if (!employeeDoc.exists) {
                    results.notFound.push({ employeeId, reason: 'Employee not found in department' });
                    continue;
                }

                const employeeData = employeeDoc.data();

                // Check if employee is in this team
                if (!employeeData.teamRef || !employeeData.teamEmployeeRef || employeeData.teamRef.id !== teamId) {
                    results.notInTeam.push({ 
                        employeeId, 
                        name: `${employeeData.name} ${employeeData.surname}`,
                        reason: 'Not a member of this team' 
                    });
                    continue;
                }

                // Remove employee from team using transaction
                await db.runTransaction(async (transaction) => {
                    // Delete from team's employees collection
                    transaction.delete(employeeData.teamEmployeeRef);
                    
                    // Update employee record to remove team references
                    transaction.update(employeeRef, {
                        teamRef: admin.firestore.FieldValue.delete(),
                        teamEmployeeRef: admin.firestore.FieldValue.delete(),
                        updatedAt: admin.firestore.Timestamp.now()
                    });
                });

                results.successful.push({
                    employeeId,
                    name: `${employeeData.name} ${employeeData.surname}`
                });

            } catch (error) {
                results.failed.push({ 
                    employeeId, 
                    reason: error.message 
                });
            }
        }

        // Update team member count
        if (results.successful.length > 0) {
            await teamRef.update({
                memberCount: admin.firestore.FieldValue.increment(-results.successful.length),
                updatedAt: admin.firestore.Timestamp.now()
            });
        }

        res.status(200).send({
            success: true,
            message: `Bulk remove completed. ${results.successful.length} employees removed successfully.`,
            data: {
                teamId,
                teamName: teamDoc.data().name,
                summary: {
                    total: employeeIds.length,
                    successful: results.successful.length,
                    failed: results.failed.length,
                    notInTeam: results.notInTeam.length,
                    notFound: results.notFound.length
                },
                results
            }
        });

    } catch (error) {
        console.error('Error bulk removing employees from team:', error);
        sendError(res, 500, 'Error bulk removing employees from team', error);
    }
};

/**
 * Get employees in department who are not assigned to any team
 */
exports.getEmployeesNotInTeam = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        
        if (!enterpriseId || !departmentId) {
            return sendError(res, 400, 'Enterprise ID and Department ID are required');
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

        // Get all employees in department who don't have a team reference
        const employeesSnapshot = await departmentRef
            .collection('employees')
            .where('teamRef', '==', null)
            .get();

        // Also get employees where teamRef field doesn't exist
        const employeesWithoutTeamFieldSnapshot = await departmentRef
            .collection('employees')
            .get();

        const unassignedEmployees = [];
        
        // Process employees without teamRef field
        employeesWithoutTeamFieldSnapshot.forEach(doc => {
            const employee = doc.data();
            if (!employee.teamRef) {
                const formattedEmployee = {
                    id: doc.id,
                    userId: employee.userId,
                    name: employee.name || '',
                    surname: employee.surname || '',
                    email: employee.email || '',
                    phone: employee.phone || '',
                    role: employee.role || '',
                    position: employee.position || '',
                    profileImage: employee.profileImage || '',
                    employeeId: employee.employeeId || '',
                    isActive: employee.isActive !== false,
                    createdAt: employee.createdAt ? employee.createdAt.toDate().toISOString() : null,
                    updatedAt: employee.updatedAt ? employee.updatedAt.toDate().toISOString() : null
                };
                
                // Avoid duplicates
                if (!unassignedEmployees.find(emp => emp.id === doc.id)) {
                    unassignedEmployees.push(formattedEmployee);
                }
            }
        });

        res.status(200).send({
            success: true,
            employees: unassignedEmployees,
            count: unassignedEmployees.length,
            message: unassignedEmployees.length === 0 ? 'All employees are assigned to teams' : `Found ${unassignedEmployees.length} unassigned employees`
        });

    } catch (error) {
        console.error('Error getting unassigned employees:', error);
        sendError(res, 500, 'Error getting employees not in team', error);
    }
};

module.exports = exports;
