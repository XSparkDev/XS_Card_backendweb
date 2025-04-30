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

// Get all departments for an enterprise
exports.getAllDepartments = async (req, res) => {
    try {
        const { enterpriseId } = req.params;
        
        if (!enterpriseId) {
            return sendError(res, 400, 'Enterprise ID is required');
        }

        const departmentsRef = db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments');
            
        const snapshot = await departmentsRef.get();
        
        if (snapshot.empty) {
            return res.status(200).send({ 
                success: true,
                departments: [],
                message: 'No departments found for this enterprise'
            });
        }

        const departments = [];
        snapshot.forEach(doc => {
            departments.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.status(200).send({
            success: true,
            departments
        });
    } catch (error) {
        sendError(res, 500, 'Error fetching departments', error);
    }
};

// Get a specific department by ID
exports.getDepartmentById = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        
        if (!enterpriseId || !departmentId) {
            return sendError(res, 400, 'Enterprise ID and Department ID are required');
        }

        const departmentRef = db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId);
            
        const doc = await departmentRef.get();
        
        if (!doc.exists) {
            return sendError(res, 404, 'Department not found');
        }

        res.status(200).send({
            success: true,
            department: {
                id: doc.id,
                ...doc.data()
            }
        });
    } catch (error) {
        sendError(res, 500, 'Error fetching department', error);
    }
};

// Create a new department
exports.createDepartment = async (req, res) => {
    try {
        const { enterpriseId } = req.params;
        const { name, description, parentDepartmentId = null, managers = [] } = req.body;
        
        if (!enterpriseId) {
            return sendError(res, 400, 'Enterprise ID is required');
        }
        
        if (!name) {
            return sendError(res, 400, 'Department name is required');
        }

        // Check if enterprise exists
        const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
        const enterpriseDoc = await enterpriseRef.get();
        
        if (!enterpriseDoc.exists) {
            return sendError(res, 404, 'Enterprise not found');
        }

        // Convert department name to a URL-friendly slug
        const slugify = str => str.toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove non-word chars
            .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
            
        const departmentId = slugify(name);
        
        // Check for duplicate department name
        const duplicateCheck = await db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .where('name', '==', name)
            .get();
            
        if (!duplicateCheck.empty) {
            return sendError(res, 409, 'A department with this name already exists');
        }
        
        // Check if a department with this ID already exists (from a similarly named department)
        const existingDocCheck = await db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId)
            .get();
            
        if (existingDocCheck.exists) {
            return sendError(res, 409, 'A department with a similar name already exists');
        }
        
        // Validate managers if provided
        let managersRefs = [];
        let validManagerUsers = [];
        if (managers && Array.isArray(managers) && managers.length > 0) {
            // Verify all manager IDs exist in the users collection
            const managerPromises = managers.map(managerId => db.collection('users').doc(managerId).get());
            const managerResults = await Promise.all(managerPromises);
            
            // Check if any manager doesn't exist
            const missingManagers = managerResults
                .map((doc, index) => ({ exists: doc.exists, id: managers[index], data: doc.data() }))
                .filter(manager => !manager.exists);
                
            if (missingManagers.length > 0) {
                return sendError(
                    res, 
                    404, 
                    `The following managers do not exist: ${missingManagers.map(m => m.id).join(', ')}`
                );
            }
            
            // Store valid manager data for later use
            validManagerUsers = managerResults
                .filter(doc => doc.exists)
                .map(doc => ({
                    id: doc.id,
                    data: doc.data()
                }));
            
            // Convert manager IDs to references
            managersRefs = managers.map(managerId => db.doc(`users/${managerId}`));
        }

        // Create department data object - set initial memberCount to managers.length
        const departmentData = {
            name,
            description: description || '',
            parentDepartmentId,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            memberCount: managers.length, // Start with managers as members
            managers: managersRefs
        };

        // Use the document reference with our custom ID
        const newDepartmentRef = db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId);
            
        await newDepartmentRef.set(departmentData);
        
        console.log(`Created department with ID: ${departmentId}`);
        
        // Initialize the employees subcollection structure path for reference
        const employeesCollectionPath = `enterprise/${enterpriseId}/departments/${departmentId}/employees`;
        console.log(`Employees collection path: ${employeesCollectionPath}`);
        
        // Add managers as employees in the department
        const addedEmployees = [];
        if (validManagerUsers.length > 0) {
            for (const manager of validManagerUsers) {
                // Create employee record for each manager
                const employeeData = {
                    userId: db.doc(`users/${manager.id}`),
                    name: manager.data.name || '',
                    surname: manager.data.surname || '',
                    email: manager.data.email || '',
                    phone: manager.data.phone || '',
                    role: 'manager', // Set role as manager
                    position: manager.data.position || 'Department Manager',
                    profileImage: manager.data.profileImage || '',
                    isActive: true,
                    createdAt: admin.firestore.Timestamp.now(),
                    updatedAt: admin.firestore.Timestamp.now()
                };
                
                // Add to employees subcollection
                const employeesRef = newDepartmentRef.collection('employees');
                const newEmployeeRef = await employeesRef.add(employeeData);
                
                // Update user document with references
                await db.collection('users').doc(manager.id).update({
                    isEmployee: true,
                    employeeRef: db.doc(`${employeesCollectionPath}/${newEmployeeRef.id}`),
                    departmentRef: newDepartmentRef,
                    enterpriseRef: enterpriseRef,
                    updatedAt: admin.firestore.Timestamp.now()
                });
                
                // Add to response data
                addedEmployees.push({
                    id: newEmployeeRef.id,
                    userId: manager.id,
                    role: 'manager',
                    name: manager.data.name || '',
                    surname: manager.data.surname || ''
                });
            }
        }
        
        // Format managers for response
        const formattedManagers = managers.length > 0 ? managers : [];

        res.status(201).send({
            success: true,
            message: 'Department created successfully',
            department: {
                id: departmentId,
                ...departmentData,
                managers: formattedManagers,
                createdAt: departmentData.createdAt.toDate().toISOString(),
                updatedAt: departmentData.updatedAt.toDate().toISOString()
            },
            managersAddedAsEmployees: addedEmployees,
            employeesCollectionPath
        });
    } catch (error) {
        sendError(res, 500, 'Error creating department', error);
    }
};

// Update a department
exports.updateDepartment = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        const { 
            name, 
            description, 
            managers, 
            parentDepartmentId,
            removeManagersCompletely = false // Flag to decide whether to remove managers from the department
        } = req.body;
        
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
        
        const departmentData = departmentDoc.data();

        // Prepare update data
        const updateData = {
            updatedAt: admin.firestore.Timestamp.now()
        };

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (parentDepartmentId !== undefined) updateData.parentDepartmentId = parentDepartmentId;
        
        // Track changes for the response
        const response = {
            success: true,
            message: 'Department updated successfully',
            managersAdded: [],
            managersRemoved: [],
            managersRoleChanged: []
        };
        
        // Process managers changes if provided
        if (managers && Array.isArray(managers)) {
            // Get current managers
            const currentManagersRefs = departmentData.managers || [];
            const currentManagerIds = currentManagersRefs.map(ref => ref.id || ref._path.segments[1]);
            
            // Identify changes
            const managersToAdd = managers.filter(id => !currentManagerIds.includes(id));
            const managersToRemove = currentManagerIds.filter(id => !managers.includes(id));
            
            console.log('Current managers:', currentManagerIds);
            console.log('New managers:', managers);
            console.log('To add:', managersToAdd);
            console.log('To remove:', managersToRemove);
            
            // Process new managers - verify they exist
            let validNewManagerUsers = [];
            if (managersToAdd.length > 0) {
                const managerPromises = managersToAdd.map(managerId => 
                    db.collection('users').doc(managerId).get()
                );
                const managerResults = await Promise.all(managerPromises);
                
                // Check if any manager doesn't exist
                const missingManagers = managerResults
                    .map((doc, index) => ({ exists: doc.exists, id: managersToAdd[index] }))
                    .filter(manager => !manager.exists);
                    
                if (missingManagers.length > 0) {
                    return sendError(
                        res, 
                        404, 
                        `The following managers do not exist: ${missingManagers.map(m => m.id).join(', ')}`
                    );
                }
                
                validNewManagerUsers = managerResults
                    .filter(doc => doc.exists)
                    .map(doc => ({
                        id: doc.id,
                        data: doc.data()
                    }));
            }
            
            // Update the managers reference list
            updateData.managers = managers.map(managerId => db.doc(`users/${managerId}`));
            
            // Run in a transaction to ensure data consistency
            await db.runTransaction(async (transaction) => {
                // 1. Process new managers - add them as employees
                for (const manager of validNewManagerUsers) {
                    // Check if user is already an employee in this department
                    const employeesRef = departmentRef.collection('employees');
                    const existingEmployeeQuery = await employeesRef
                        .where('userId', '==', db.doc(`users/${manager.id}`))
                        .get();
                    
                    if (existingEmployeeQuery.empty) {
                        // Create a new employee record
                        const employeeData = {
                            userId: db.doc(`users/${manager.id}`),
                            name: manager.data.name || '',
                            surname: manager.data.surname || '',
                            email: manager.data.email || '',
                            phone: manager.data.phone || '',
                            role: 'manager',
                            position: manager.data.position || 'Department Manager',
                            profileImage: manager.data.profileImage || '',
                            isActive: true,
                            createdAt: admin.firestore.Timestamp.now(),
                            updatedAt: admin.firestore.Timestamp.now()
                        };
                        
                        // Add employee record
                        const newEmployeeRef = employeesRef.doc();
                        transaction.set(newEmployeeRef, employeeData);
                        
                        // Update user record with references
                        const userRef = db.collection('users').doc(manager.id);
                        transaction.update(userRef, {
                            isEmployee: true,
                            employeeRef: db.doc(`enterprise/${enterpriseId}/departments/${departmentId}/employees/${newEmployeeRef.id}`),
                            departmentRef: departmentRef,
                            enterpriseRef: db.doc(`enterprise/${enterpriseId}`),
                            updatedAt: admin.firestore.Timestamp.now()
                        });
                        
                        // Increment member count
                        updateData.memberCount = admin.firestore.FieldValue.increment(1);
                        
                        // Add to response
                        response.managersAdded.push({
                            id: newEmployeeRef.id,
                            userId: manager.id,
                            name: manager.data.name || '',
                            surname: manager.data.surname || '',
                            action: 'added_as_employee'
                        });
                    } else {
                        // Update existing employee to manager role
                        const employeeDoc = existingEmployeeQuery.docs[0];
                        transaction.update(employeeDoc.ref, {
                            role: 'manager',
                            updatedAt: admin.firestore.Timestamp.now()
                        });
                        
                        // Add to response
                        response.managersRoleChanged.push({
                            id: employeeDoc.id,
                            userId: manager.id,
                            name: employeeDoc.data().name || '',
                            surname: employeeDoc.data().surname || '',
                            action: 'promoted_to_manager'
                        });
                    }
                }
                
                // 2. Process managers to remove
                for (const managerId of managersToRemove) {
                    // Find the employee record
                    const employeesRef = departmentRef.collection('employees');
                    const employeeQuery = await employeesRef
                        .where('userId', '==', db.doc(`users/${managerId}`))
                        .get();
                    
                    if (!employeeQuery.empty) {
                        const employeeDoc = employeeQuery.docs[0];
                        const employeeData = employeeDoc.data();
                        
                        if (removeManagersCompletely) {
                            // Remove from department completely
                            transaction.delete(employeeDoc.ref);
                            
                            // Update user record
                            const userRef = db.collection('users').doc(managerId);
                            transaction.update(userRef, {
                                employeeRef: admin.firestore.FieldValue.delete(),
                                departmentRef: admin.firestore.FieldValue.delete(),
                                isEmployee: false,
                                updatedAt: admin.firestore.Timestamp.now()
                            });
                            
                            // Decrement member count
                            updateData.memberCount = admin.firestore.FieldValue.increment(-1);
                            
                            // Add to response
                            response.managersRemoved.push({
                                id: employeeDoc.id,
                                userId: managerId,
                                name: employeeData.name || '',
                                surname: employeeData.surname || '',
                                action: 'removed_completely'
                            });
                        } else {
                            // Just change role to regular employee
                            transaction.update(employeeDoc.ref, {
                                role: 'employee',
                                updatedAt: admin.firestore.Timestamp.now()
                            });
                            
                            // Add to response
                            response.managersRoleChanged.push({
                                id: employeeDoc.id,
                                userId: managerId,
                                name: employeeData.name || '',
                                surname: employeeData.surname || '',
                                action: 'demoted_to_employee'
                            });
                        }
                    }
                }
                
                // Update the department document
                transaction.update(departmentRef, updateData);
            });
        } else {
            // If no managers provided, just update the basic fields
            await departmentRef.update(updateData);
        }

        // Get updated document for response
        const updatedDoc = await departmentRef.get();
        const updatedData = updatedDoc.data();

        res.status(200).send({
            ...response,
            department: {
                id: departmentId,
                ...updatedData,
                createdAt: updatedData.createdAt.toDate().toISOString(),
                updatedAt: updatedData.updatedAt.toDate().toISOString(),
                managers: managers || updatedData.managers.map(ref => ref.id || ref._path.segments[1]) // Return IDs for response
            }
        });
    } catch (error) {
        console.error('Error updating department:', error);
        sendError(res, 500, 'Error updating department', error);
    }
};

// Delete a department
exports.deleteDepartment = async (req, res) => {
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

        // Check if department has members
        const employeesSnapshot = await departmentRef.collection('employees').get();
        if (!employeesSnapshot.empty) {
            return sendError(res, 409, 'Cannot delete a department with employees. Reassign employees first.');
        }

        // Check if department has child departments
        const childDepartmentsSnapshot = await db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .where('parentDepartmentId', '==', departmentId)
            .get();
            
        if (!childDepartmentsSnapshot.empty) {
            return sendError(res, 409, 'Cannot delete a department with child departments. Reassign or delete child departments first.');
        }

        // Delete the department
        await departmentRef.delete();

        res.status(200).send({
            success: true,
            message: 'Department deleted successfully',
            departmentId
        });
    } catch (error) {
        sendError(res, 500, 'Error deleting department', error);
    }
};

// Get department members
exports.getDepartmentMembers = async (req, res) => {
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

        // Get department members
        const membersSnapshot = await db.collection('users')
            .where('departmentId', '==', db.doc(`enterprise/${enterpriseId}/departments/${departmentId}`))
            .get();
            
        const members = [];
        membersSnapshot.forEach(doc => {
            members.push({
                id: doc.id,
                name: doc.data().name,
                surname: doc.data().surname,
                email: doc.data().email,
                title: doc.data().title,
                profileImage: doc.data().profileImage
            });
        });

        res.status(200).send({
            success: true,
            members,
            totalCount: members.length
        });
    } catch (error) {
        sendError(res, 500, 'Error fetching department members', error);
    }
};

// Get a specific employee by ID with associated card data
exports.getEmployeeById = async (req, res) => {
    try {
        const { enterpriseId, departmentId, employeeId } = req.params;
        const { includeCard = 'true' } = req.query; // Default to including card
        
        if (!enterpriseId || !departmentId || !employeeId) {
            return sendError(res, 400, 'Enterprise ID, Department ID, and Employee ID are required');
        }

        // Construct the path to the employee document
        const employeeRef = db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId)
            .collection('employees')
            .doc(employeeId);
            
        const employeeDoc = await employeeRef.get();
        
        if (!employeeDoc.exists) {
            return sendError(res, 404, 'Employee not found');
        }

        // Get the employee data
        const employeeData = employeeDoc.data();

        // Format createdAt timestamp if it exists
        if (employeeData.createdAt) {
            employeeData.createdAt = employeeData.createdAt.toDate().toISOString();
        }

        let cardsData = null;
        // Fetch card data if requested and card reference exists
        if (includeCard === 'true' && employeeData.cardsRef) {
            try {
                // Extract the card reference path and parse it to get user ID
                const cardPath = employeeData.cardsRef.path || '';
                const cardUserId = cardPath.split('/')[1]; // cards/{userId}
                
                if (cardUserId) {
                    // Fetch the card document
                    const cardDoc = await db.collection('cards').doc(cardUserId).get();
                    
                    if (cardDoc.exists && cardDoc.data().cards && Array.isArray(cardDoc.data().cards)) {
                        // Get all cards and format them
                        cardsData = cardDoc.data().cards.map(card => {
                            // Clone the card to avoid mutating the original
                            const formattedCard = {...card};
                            
                            // Format timestamps if any
                            if (formattedCard.createdAt) {
                                if (formattedCard.createdAt.toDate) {
                                    formattedCard.createdAt = formattedCard.createdAt.toDate().toISOString();
                                } else if (formattedCard.createdAt._seconds) {
                                    formattedCard.createdAt = new Date(formattedCard.createdAt._seconds * 1000).toISOString();
                                }
                            }
                            
                            return formattedCard;
                        });
                    }
                }
            } catch (cardError) {
                console.error('Error fetching card data:', cardError);
                // Continue without card data
            }
        }

        // Include the reference path as a string
        if (employeeData.cardsRef && employeeData.cardsRef.path) {
            employeeData.cardsRefPath = employeeData.cardsRef.path;
        }

        // Remove the reference object to avoid circular references
        delete employeeData.cardsRef;

        res.status(200).send({
            success: true,
            employee: {
                id: employeeDoc.id,
                ...employeeData
            },
            cards: cardsData
        });
    } catch (error) {
        sendError(res, 500, 'Error fetching employee', error);
    }
};

// Add a dedicated endpoint to get an employee's card
exports.getEmployeeCard = async (req, res) => {
    try {
        const { enterpriseId, departmentId, employeeId } = req.params;
        
        if (!enterpriseId || !departmentId || !employeeId) {
            return sendError(res, 400, 'Enterprise ID, Department ID, and Employee ID are required');
        }

        // Get the employee first to obtain the card reference
        const employeeRef = db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId)
            .collection('employees')
            .doc(employeeId);
            
        const employeeDoc = await employeeRef.get();
        
        if (!employeeDoc.exists) {
            return sendError(res, 404, 'Employee not found');
        }

        const employeeData = employeeDoc.data();
        
        // Check if employee has a card reference
        if (!employeeData.cardsRef || !employeeData.cardsRef.path) {
            return sendError(res, 404, 'Employee has no associated card');
        }

        // Extract the card reference path and parse it
        const cardPath = employeeData.cardsRef.path;
        const cardUserId = cardPath.split('/')[1]; // cards/{userId}
        
        if (!cardUserId) {
            return sendError(res, 400, 'Invalid card reference format');
        }

        // Fetch the card document
        const cardDoc = await db.collection('cards').doc(cardUserId).get();
        
        if (!cardDoc.exists) {
            return sendError(res, 404, 'Referenced card document not found');
        }

        const cardsData = cardDoc.data();
        
        // Check if cards array exists
        if (!cardsData.cards || !Array.isArray(cardsData.cards) || cardsData.cards.length === 0) {
            return sendError(res, 404, 'No cards found in the referenced document');
        }

        // Format all cards in the array
        const formattedCards = cardsData.cards.map(card => {
            // Clone the card to avoid mutating the original
            const formattedCard = {...card};
            
            // Format timestamp if needed
            if (formattedCard.createdAt) {
                if (formattedCard.createdAt.toDate) {
                    formattedCard.createdAt = formattedCard.createdAt.toDate().toISOString();
                } else if (formattedCard.createdAt._seconds) {
                    formattedCard.createdAt = new Date(formattedCard.createdAt._seconds * 1000).toISOString();
                }
            }
            
            return formattedCard;
        });

        res.status(200).send({
            success: true,
            cards: formattedCards,
            userId: cardUserId,
            employeeId,
            employeeName: `${employeeData.firstName || ''} ${employeeData.lastName || ''}`
        });
    } catch (error) {
        sendError(res, 500, 'Error fetching employee cards', error);
    }
};

// Get all employees in a department
exports.getDepartmentEmployees = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        
        if (!enterpriseId || !departmentId) {
            return sendError(res, 400, 'Enterprise ID and Department ID are required');
        }

        // Query the employees collection
        const employeesSnapshot = await db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId)
            .collection('employees')
            .get();
            
        if (employeesSnapshot.empty) {
            return res.status(200).send({
                success: true,
                employees: [],
                message: 'No employees found in this department'
            });
        }

        // Process the employees data
        const employees = [];
        employeesSnapshot.forEach(doc => {
            const employee = doc.data();
            
            // Format timestamps and references
            if (employee.createdAt) {
                employee.createdAt = employee.createdAt.toDate().toISOString();
            }
            
            if (employee.cardsRef && typeof employee.cardsRef.path === 'string') {
                employee.cardsRef = employee.cardsRef.path;
            }
            
            employees.push({
                id: doc.id,
                ...employee
            });
        });

        res.status(200).send({
            success: true,
            employees,
            count: employees.length
        });
    } catch (error) {
        sendError(res, 500, 'Error fetching department employees', error);
    }
};

// Query employee by email or employee ID
exports.queryEmployee = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        const { email, employeeId } = req.query;
        
        if (!enterpriseId || !departmentId) {
            return sendError(res, 400, 'Enterprise ID and Department ID are required');
        }
        
        if (!email && !employeeId) {
            return sendError(res, 400, 'Either email or employeeId query parameter is required');
        }

        // Reference to the employees collection
        const employeesRef = db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId)
            .collection('employees');
            
        // Perform the query based on the provided parameter
        let query;
        if (email) {
            query = employeesRef.where('email', '==', email);
        } else {
            query = employeesRef.where('employeeId', '==', employeeId);
        }
        
        const employeesSnapshot = await query.get();
        
        if (employeesSnapshot.empty) {
            return res.status(404).send({
                success: false,
                message: 'No employee found with the provided criteria'
            });
        }

        // Process the employee data (should be only one)
        const employeeDoc = employeesSnapshot.docs[0];
        const employeeData = employeeDoc.data();
        
        // Format timestamp and reference
        if (employeeData.createdAt) {
            employeeData.createdAt = employeeData.createdAt.toDate().toISOString();
        }
        
        if (employeeData.cardsRef && typeof employeeData.cardsRef.path === 'string') {
            employeeData.cardsRef = employeeData.cardsRef.path;
        }

        res.status(200).send({
            success: true,
            employee: {
                id: employeeDoc.id,
                ...employeeData
            }
        });
    } catch (error) {
        sendError(res, 500, 'Error querying employee', error);
    }
};

// Add an employee to a department
exports.addEmployee = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        const { userId, role = 'employee', position, teamId = null, isActive = true } = req.body;
        
        if (!enterpriseId || !departmentId || !userId) {
            return sendError(res, 400, 'Enterprise ID, Department ID and User ID are required');
        }
        
        // Validate role is one of the allowed values
        const allowedRoles = ['employee', 'manager', 'director', 'admin'];
        if (!allowedRoles.includes(role)) {
            return sendError(res, 400, `Role must be one of: ${allowedRoles.join(', ')}`);
        }

        // Check if the user exists
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            return sendError(res, 404, 'User not found');
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
        
        // Check if enterprise exists
        const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
        const enterpriseDoc = await enterpriseRef.get();
        
        if (!enterpriseDoc.exists) {
            return sendError(res, 404, 'Enterprise not found');
        }
        
        // Check if user is already an employee in this department
        const employeesRef = departmentRef.collection('employees');
        const existingEmployeeQuery = await employeesRef
            .where('userId', '==', db.doc(`users/${userId}`))
            .get();
            
        if (!existingEmployeeQuery.empty) {
            return sendError(res, 409, 'User is already an employee in this department');
        }
        
        // Get user data for employee record
        const userData = userDoc.data();
        
        // Create employee record with role information
        const employeeData = {
            userId: db.doc(`users/${userId}`),
            name: userData.name || '',
            surname: userData.surname || '',
            email: userData.email || '',
            phone: userData.phone || '',
            role: role, // Set the role from the request
            position: position || '',
            profileImage: userData.profileImage || '',
            teamId: teamId, // Optional team reference
            isActive: isActive,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        };
        
        // Add employee record
        const newEmployeeRef = await employeesRef.add(employeeData);
        const newEmployeeId = newEmployeeRef.id;
        
        // Update user record with employee reference and other metadata
        const userUpdates = {
            isEmployee: true,
            employeeRef: db.doc(`enterprise/${enterpriseId}/departments/${departmentId}/employees/${newEmployeeId}`),
            departmentRef: db.doc(`enterprise/${enterpriseId}/departments/${departmentId}`),
            enterpriseRef: db.doc(`enterprise/${enterpriseId}`),
            updatedAt: admin.firestore.Timestamp.now()
        };
        
        await userRef.update(userUpdates);
        
        // Update department member count
        await departmentRef.update({
            memberCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.Timestamp.now()
        });
        
        // Return the new employee data
        const responseData = {
            id: newEmployeeId,
            ...employeeData,
            userId: userId,
            createdAt: employeeData.createdAt.toDate().toISOString(),
            updatedAt: employeeData.updatedAt.toDate().toISOString()
        };
        
        console.log(`Added employee ${newEmployeeId} to department ${departmentId}`);
        
        res.status(201).send({
            success: true,
            message: 'Employee added successfully',
            employee: responseData
        });
    } catch (error) {
        sendError(res, 500, 'Error adding employee', error);
    }
};

// Update an employee
exports.updateEmployee = async (req, res) => {
    try {
        const { enterpriseId, departmentId, employeeId } = req.params;
        const { 
            name, surname, email, phone, position, 
            profileImage, isActive, teamId, role
        } = req.body;
        
        if (!enterpriseId || !departmentId || !employeeId) {
            return sendError(res, 400, 'Enterprise ID, Department ID and Employee ID are required');
        }
        
        // Validate role if provided
        if (role) {
            const allowedRoles = ['employee', 'manager', 'director', 'admin'];
            if (!allowedRoles.includes(role)) {
                return sendError(res, 400, `Role must be one of: ${allowedRoles.join(', ')}`);
            }
        }
        
        // Check if employee exists
        const employeeRef = db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId)
            .collection('employees')
            .doc(employeeId);
            
        const employeeDoc = await employeeRef.get();
        
        if (!employeeDoc.exists) {
            return sendError(res, 404, 'Employee not found');
        }
        
        // Prepare update data
        const updates = {
            updatedAt: admin.firestore.Timestamp.now()
        };
        
        if (name !== undefined) updates.name = name;
        if (surname !== undefined) updates.surname = surname;
        if (email !== undefined) updates.email = email;
        if (phone !== undefined) updates.phone = phone;
        if (position !== undefined) updates.position = position;
        if (profileImage !== undefined) updates.profileImage = profileImage;
        if (isActive !== undefined) updates.isActive = isActive;
        if (teamId !== undefined) updates.teamId = teamId;
        if (role !== undefined) updates.role = role;
        
        // Update the employee
        await employeeRef.update(updates);
        
        // Get updated document
        const updatedDoc = await employeeRef.get();
        const updatedData = updatedDoc.data();
        
        // Format the response
        const responseData = {
            id: employeeId,
            ...updatedData,
            userId: updatedData.userId.id, // Convert reference to ID
            createdAt: updatedData.createdAt.toDate().toISOString(),
            updatedAt: updatedData.updatedAt.toDate().toISOString()
        };
        
        res.status(200).send({
            success: true,
            message: 'Employee updated successfully',
            employee: responseData
        });
    } catch (error) {
        sendError(res, 500, 'Error updating employee', error);
    }
};

// Delete an employee
exports.deleteEmployee = async (req, res) => {
    try {
        const { enterpriseId, departmentId, employeeId } = req.params;
        
        if (!enterpriseId || !departmentId || !employeeId) {
            return sendError(res, 400, 'Enterprise ID, Department ID, and Employee ID are required');
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
        
        // Check if employee exists
        const employeeRef = departmentRef.collection('employees').doc(employeeId);
        const employeeDoc = await employeeRef.get();
        
        if (!employeeDoc.exists) {
            return sendError(res, 404, 'Employee not found');
        }
        
        const employeeData = employeeDoc.data();
        
        // Run transaction to maintain data integrity
        await db.runTransaction(async (transaction) => {
            // Delete employee from department
            transaction.delete(employeeRef);
            
            // Decrement department member count
            transaction.update(departmentRef, {
                memberCount: admin.firestore.FieldValue.increment(-1),
                updatedAt: admin.firestore.Timestamp.now()
            });
            
            // Remove from team if assigned
            if (employeeData.teamRef && employeeData.teamEmployeeRef) {
                // Delete from team's employees collection
                transaction.delete(employeeData.teamEmployeeRef);
                
                // Decrement team member count
                transaction.update(employeeData.teamRef, {
                    memberCount: admin.firestore.FieldValue.increment(-1),
                    updatedAt: admin.firestore.Timestamp.now()
                });
            }
            
            // Update user document to remove employee references
            const userRef = employeeData.userRef;
            if (userRef) {
                transaction.update(userRef, {
                    employeeRef: admin.firestore.FieldValue.delete(),
                    departmentRef: admin.firestore.FieldValue.delete(),
                    teamRef: admin.firestore.FieldValue.delete(),
                    teamEmployeeRef: admin.firestore.FieldValue.delete(),
                    isEmployee: false
                });
            }
            
            // Note: We're not deleting the card or user account
            // This allows the user to remain in the system even if no longer an employee
        });
        
        res.status(200).send({
            success: true,
            message: 'Employee deleted successfully',
            employeeId,
            departmentId
        });
    } catch (error) {
        console.error('Error deleting employee:', error);
        sendError(res, 500, 'Error deleting employee', error);
    }
};

// Get all cards for an enterprise
exports.getAllEnterpriseCards = async (req, res) => {
    try {
        const { enterpriseId } = req.params;
        
        if (!enterpriseId) {
            return sendError(res, 400, 'Enterprise ID is required');
        }

        // First get all departments in the enterprise
        const departmentsSnapshot = await db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .get();

        if (departmentsSnapshot.empty) {
            return res.status(200).send({
                success: true,
                cards: [],
                message: 'No departments found in this enterprise'
            });
        }

        // Get all employees across all departments and collect their card references
        const cardPromises = [];
        const employeeInfo = [];
        
        for (const deptDoc of departmentsSnapshot.docs) {
            const employeesSnapshot = await deptDoc.ref.collection('employees').get();
            
            for (const employeeDoc of employeesSnapshot.docs) {
                const employeeData = employeeDoc.data();
                
                if (employeeData.cardsRef) {
                    // Store employee info for later association with cards
                    employeeInfo.push({
                        employeeId: employeeDoc.id,
                        departmentId: deptDoc.id,
                        departmentName: deptDoc.data().name,
                        firstName: employeeData.firstName,
                        lastName: employeeData.lastName,
                        title: employeeData.title,
                        email: employeeData.email,
                        cardsRefPath: employeeData.cardsRef.path
                    });
                    
                    // Add promise to fetch the card document
                    cardPromises.push(employeeData.cardsRef.get());
                }
            }
        }
        
        // Execute all card fetch promises in parallel
        const cardResults = await Promise.all(cardPromises);
        
        // Process and organize the cards
        const allCards = [];
        
        cardResults.forEach((cardDoc, index) => {
            if (cardDoc.exists && cardDoc.data().cards) {
                const employee = employeeInfo[index];
                const cardUserId = cardDoc.id;
                
                // Format and add each card with employee context
                cardDoc.data().cards.forEach((card, cardIndex) => {
                    allCards.push({
                        ...card,
                        userId: cardUserId,
                        cardIndex: cardIndex,
                        employeeId: employee.employeeId,
                        employeeName: `${employee.firstName} ${employee.lastName}`,
                        employeeTitle: employee.title,
                        departmentId: employee.departmentId,
                        departmentName: employee.departmentName,
                        createdAt: card.createdAt ? 
                            (card.createdAt.toDate ? card.createdAt.toDate().toISOString() : 
                                card.createdAt._seconds ? new Date(card.createdAt._seconds * 1000).toISOString() : null) 
                            : null
                    });
                });
            }
        });
        
        res.status(200).send({
            success: true,
            cards: allCards,
            count: allCards.length
        });
        
    } catch (error) {
        sendError(res, 500, 'Error fetching enterprise cards', error);
    }
};

// Get all cards in a specific department
exports.getDepartmentCards = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        
        if (!enterpriseId || !departmentId) {
            return sendError(res, 400, 'Enterprise ID and Department ID are required');
        }

        // Get all employees in the department
        const employeesSnapshot = await db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId)
            .collection('employees')
            .get();
            
        if (employeesSnapshot.empty) {
            return res.status(200).send({
                success: true,
                cards: [],
                message: 'No employees found in this department'
            });
        }

        // Collect card references and employee info
        const cardPromises = [];
        const employeeInfo = [];
        
        employeesSnapshot.forEach(employeeDoc => {
            const employeeData = employeeDoc.data();
            
            if (employeeData.cardsRef) {
                employeeInfo.push({
                    employeeId: employeeDoc.id,
                    firstName: employeeData.firstName,
                    lastName: employeeData.lastName,
                    title: employeeData.title,
                    email: employeeData.email,
                    cardsRefPath: employeeData.cardsRef.path
                });
                
                cardPromises.push(employeeData.cardsRef.get());
            }
        });
        
        // Execute all card fetch promises in parallel
        const cardResults = await Promise.all(cardPromises);
        
        // Process and organize the cards
        const departmentCards = [];
        
        cardResults.forEach((cardDoc, index) => {
            if (cardDoc.exists && cardDoc.data().cards) {
                const employee = employeeInfo[index];
                const cardUserId = cardDoc.id;
                
                cardDoc.data().cards.forEach((card, cardIndex) => {
                    departmentCards.push({
                        ...card,
                        userId: cardUserId,
                        cardIndex: cardIndex,
                        employeeId: employee.employeeId,
                        employeeName: `${employee.firstName} ${employee.lastName}`,
                        employeeTitle: employee.title,
                        email: employee.email,
                        createdAt: card.createdAt ? 
                            (card.createdAt.toDate ? card.createdAt.toDate().toISOString() : 
                                card.createdAt._seconds ? new Date(card.createdAt._seconds * 1000).toISOString() : null) 
                            : null
                    });
                });
            }
        });
        
        res.status(200).send({
            success: true,
            departmentId,
            cards: departmentCards,
            count: departmentCards.length
        });
        
    } catch (error) {
        sendError(res, 500, 'Error fetching department cards', error);
    }
};

// Get all cards in a specific team
exports.getTeamCards = async (req, res) => {
    try {
        const { enterpriseId, departmentId, teamId } = req.params;
        
        if (!enterpriseId || !departmentId || !teamId) {
            return sendError(res, 400, 'Enterprise ID, Department ID, and Team ID are required');
        }

        // Get the team first to verify it exists
        const teamRef = db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId)
            .collection('teams')
            .doc(teamId);
            
        const teamDoc = await teamRef.get();
        
        if (!teamDoc.exists) {
            return sendError(res, 404, 'Team not found');
        }

        // Get all employees in the team
        const teamEmployeesSnapshot = await teamRef.collection('employees').get();
        
        if (teamEmployeesSnapshot.empty) {
            return res.status(200).send({
                success: true,
                cards: [],
                message: 'No employees found in this team'
            });
        }

        // Collect card references and employee info
        const cardPromises = [];
        const employeeInfo = [];
        
        for (const employeeDoc of teamEmployeesSnapshot.docs) {
            const employeeData = employeeDoc.data();
            
            if (employeeData.cardsRef) {
                employeeInfo.push({
                    employeeId: employeeDoc.id,
                    firstName: employeeData.firstName,
                    lastName: employeeData.lastName,
                    title: employeeData.title,
                    email: employeeData.email,
                    cardsRefPath: employeeData.cardsRef.path
                });
                
                // If cardsRef is a reference, get it, otherwise parse the path
                if (typeof employeeData.cardsRef.get === 'function') {
                    cardPromises.push(employeeData.cardsRef.get());
                } else if (employeeData.cardsRefPath) {
                    const cardId = employeeData.cardsRefPath.split('/')[1];
                    cardPromises.push(db.collection('cards').doc(cardId).get());
                }
            }
        }
        
        // Execute all card fetch promises in parallel
        const cardResults = await Promise.all(cardPromises);
        
        // Process and organize the cards
        const teamCards = [];
        
        cardResults.forEach((cardDoc, index) => {
            if (cardDoc.exists && cardDoc.data().cards) {
                const employee = employeeInfo[index];
                const cardUserId = cardDoc.id;
                
                cardDoc.data().cards.forEach((card, cardIndex) => {
                    teamCards.push({
                        ...card,
                        userId: cardUserId,
                        cardIndex: cardIndex,
                        employeeId: employee.employeeId,
                        employeeName: `${employee.firstName} ${employee.lastName}`,
                        employeeTitle: employee.title,
                        teamId,
                        teamName: teamDoc.data().name,
                        createdAt: card.createdAt ? 
                            (card.createdAt.toDate ? card.createdAt.toDate().toISOString() : 
                                card.createdAt._seconds ? new Date(card.createdAt._seconds * 1000).toISOString() : null) 
                            : null
                    });
                });
            }
        });
        
        res.status(200).send({
            success: true,
            teamId,
            teamName: teamDoc.data().name,
            cards: teamCards,
            count: teamCards.length
        });
        
    } catch (error) {
        sendError(res, 500, 'Error fetching team cards', error);
    }
};

// Get all employees across the entire enterprise
exports.getAllEnterpriseEmployees = async (req, res) => {
    try {
        const { enterpriseId } = req.params;
        const { page = 1, limit = 50, search } = req.query;
        
        if (!enterpriseId) {
            return res.status(400).send({ 
                success: false, 
                message: 'Enterprise ID is required' 
            });
        }

        // Check if enterprise exists
        const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
        const enterpriseDoc = await enterpriseRef.get();
        
        if (!enterpriseDoc.exists) {
            return res.status(404).send({ 
                success: false, 
                message: 'Enterprise not found' 
            });
        }

        // Get all departments first
        const departmentsRef = enterpriseRef.collection('departments');
        const departmentsSnapshot = await departmentsRef.get();
        
        if (departmentsSnapshot.empty) {
            return res.status(200).send({
                success: true,
                employees: [],
                totalCount: 0,
                currentPage: parseInt(page),
                totalPages: 0
            });
        }

        // Collect all employees across departments
        const allEmployees = [];
        const fetchPromises = [];

        departmentsSnapshot.forEach(departmentDoc => {
            const departmentId = departmentDoc.id;
            const departmentName = departmentDoc.data().name;
            
            const employeesQuery = departmentsRef
                .doc(departmentId)
                .collection('employees');
                
            fetchPromises.push(
                employeesQuery.get().then(employeesSnapshot => {
                    employeesSnapshot.forEach(employeeDoc => {
                        const employeeData = employeeDoc.data();
                        allEmployees.push({
                            id: employeeDoc.id,
                            departmentId,
                            departmentName,
                            ...employeeData
                        });
                    });
                })
            );
        });

        // Wait for all employee fetches to complete
        await Promise.all(fetchPromises);
        
        // Handle search if provided
        let filteredEmployees = allEmployees;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredEmployees = allEmployees.filter(employee => 
                (employee.firstName && employee.firstName.toLowerCase().includes(searchLower)) ||
                (employee.lastName && employee.lastName.toLowerCase().includes(searchLower)) ||
                (employee.email && employee.email.toLowerCase().includes(searchLower)) ||
                (employee.employeeId && employee.employeeId.toLowerCase().includes(searchLower))
            );
        }
        
        // Handle pagination
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = startIndex + parseInt(limit);
        const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);
        
        res.status(200).send({
            success: true,
            employees: paginatedEmployees,
            totalCount: filteredEmployees.length,
            currentPage: parseInt(page),
            totalPages: Math.ceil(filteredEmployees.length / parseInt(limit))
        });
    } catch (error) {
        sendError(res, 500, 'Error fetching enterprise employees', error);
    }
};

// Get managers for a department
exports.getDepartmentManagers = async (req, res) => {
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
        
        // Query employees with manager role
        const employeesRef = departmentRef.collection('employees');
        const managersQuery = await employeesRef
            .where('role', 'in', ['manager', 'director', 'admin'])
            .get();
        
        if (managersQuery.empty) {
            return res.status(200).send({
                success: true,
                managers: [],
                message: 'No managers found for this department'
            });
        }
        
        // Format manager data
        const managers = [];
        managersQuery.forEach(doc => {
            const data = doc.data();
            managers.push({
                id: doc.id,
                ...data,
                userId: data.userId.id, // Convert reference to ID
                createdAt: data.createdAt.toDate().toISOString(),
                updatedAt: data.updatedAt.toDate().toISOString()
            });
        });
        
        res.status(200).send({
            success: true,
            managers
        });
    } catch (error) {
        sendError(res, 500, 'Error fetching department managers', error);
    }
};
