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
        const { name, description, managers = [], parentDepartmentId = null } = req.body;
        
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

        // Check for duplicate department name
        const duplicateCheck = await db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .where('name', '==', name)
            .get();
            
        if (!duplicateCheck.empty) {
            return sendError(res, 409, 'A department with this name already exists');
        }

        // Validate parent department if provided
        if (parentDepartmentId) {
            const parentRef = db.collection('enterprise')
                .doc(enterpriseId)
                .collection('departments')
                .doc(parentDepartmentId);
                
            const parentDoc = await parentRef.get();
            
            if (!parentDoc.exists) {
                return sendError(res, 404, 'Parent department not found');
            }
        }

        // Create new department
        const departmentData = {
            name,
            description: description || '',
            managers: managers.map(manager => db.doc(`users/${manager}`)),
            parentDepartmentId,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            memberCount: 0
        };

        const departmentRef = db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments');
            
        const newDepartment = await departmentRef.add(departmentData);

        res.status(201).send({
            success: true,
            message: 'Department created successfully',
            department: {
                id: newDepartment.id,
                ...departmentData,
                createdAt: departmentData.createdAt.toDate().toISOString(),
                updatedAt: departmentData.updatedAt.toDate().toISOString(),
                managers: managers // Return just the IDs for the response
            }
        });
    } catch (error) {
        sendError(res, 500, 'Error creating department', error);
    }
};

// Update a department
exports.updateDepartment = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        const { name, description, managers, parentDepartmentId } = req.body;
        
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

        // Prepare update data
        const updateData = {
            updatedAt: admin.firestore.Timestamp.now()
        };

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (parentDepartmentId !== undefined) updateData.parentDepartmentId = parentDepartmentId;
        
        // Handle managers separately if provided
        if (managers && Array.isArray(managers)) {
            updateData.managers = managers.map(manager => db.doc(`users/${manager}`));
        }

        // Update the department
        await departmentRef.update(updateData);

        // Get updated document
        const updatedDoc = await departmentRef.get();
        const updatedData = updatedDoc.data();

        res.status(200).send({
            success: true,
            message: 'Department updated successfully',
            department: {
                id: departmentId,
                ...updatedData,
                createdAt: updatedData.createdAt.toDate().toISOString(),
                updatedAt: updatedData.updatedAt.toDate().toISOString(),
                managers: managers || updatedData.managers.map(ref => ref.id) // Return IDs for response
            }
        });
    } catch (error) {
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

// Add or link an employee to a department
exports.addEmployee = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        
        // Debug the incoming request body
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const { 
            email, 
            password,
            firstName, 
            lastName, 
            phone, 
            employeeId, 
            title,
            existingUserId, // If linking an existing user
            colorScheme, // Allow setting a custom color scheme
            company // Allow setting the company name
        } = req.body;
        
        // Validate required parameters
        if (!enterpriseId || !departmentId) {
            return sendError(res, 400, 'Enterprise ID and Department ID are required');
        }
        
        // Check each required field individually and provide specific error messages
        const missingFields = [];
        if (!email) missingFields.push('email');
        if (!firstName) missingFields.push('firstName');
        if (!lastName) missingFields.push('lastName');
        if (!existingUserId && !password) missingFields.push('password or existingUserId');
        
        if (missingFields.length > 0) {
            return sendError(res, 400, `Missing required fields: ${missingFields.join(', ')}`, {
                message: 'Validation failed',
                receivedData: {
                    email: email || null,
                    firstName: firstName || null,
                    lastName: lastName || null,
                    hasPassword: !!password,
                    hasExistingUserId: !!existingUserId
                }
            });
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

        // Get enterprise data to check for default color scheme
        const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
        const enterpriseDoc = await enterpriseRef.get();
        const enterpriseData = enterpriseDoc.exists ? enterpriseDoc.data() : {};
        
        // Determine which color scheme to use (priority: request > enterprise default > system default)
        const defaultColorScheme = '#1B2B5B'; // System default as fallback
        const enterpriseColorScheme = enterpriseData.colorScheme || defaultColorScheme;
        const finalColorScheme = colorScheme || enterpriseColorScheme;
        
        // Get company name - from request, enterprise, or default
        const enterpriseCompanyName = enterpriseData.name || 'XS Card Enterprise';
        const finalCompanyName = company || enterpriseCompanyName;

        // Step 1: First handle user creation outside of the transaction if needed
        let userId;
        let userRecord;
        let isNewUser = false;
        let verificationToken = null;
        
        if (existingUserId) {
            // Verify existing user
            try {
                userRecord = await admin.auth().getUser(existingUserId);
                userId = existingUserId;
                
                // Check if email matches
                if (userRecord.email !== email) {
                    throw new Error('Email mismatch between provided email and existing user');
                }
            } catch (error) {
                throw new Error(`Invalid existing user: ${error.message}`);
            }
        } else {
            // Check if user already exists with this email
            try {
                const existingUser = await admin.auth().getUserByEmail(email);
                userId = existingUser.uid;
                userRecord = existingUser;
            } catch (error) {
                // User doesn't exist, create new one
                isNewUser = true;
                userRecord = await admin.auth().createUser({
                    email,
                    password,
                    displayName: `${firstName} ${lastName}`,
                    emailVerified: false
                });
                userId = userRecord.uid;
                
                // Generate verification token
                verificationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
                
                // Create the user document in Firestore with ONLY the essential authentication fields
                const userData = {
                    uid: userId,
                    email,
                    status: 'active',
                    plan: 'premium', // Use premium plan as requested
                    isEmailVerified: false,
                    verificationToken,
                    createdAt: admin.firestore.Timestamp.now()
                };
                
                // Set the document outside the transaction to ensure it exists
                await db.collection('users').doc(userId).set(userData);
                
                // Send verification email
                try {
                    const { sendMailWithStatus } = require('../../public/Utils/emailService');
                    
                    const verificationLink = `${process.env.APP_URL || 'http://localhost:8383'}/verify-email?token=${verificationToken}&uid=${userId}`;
                    
                    await sendMailWithStatus({
                        to: email,
                        subject: 'Verify your XS Card email address',
                        html: `
                            <h1>Welcome to XS Card!</h1>
                            <p>Hello ${firstName},</p>
                            <p>Please click the link below to verify your email address:</p>
                            <a href="${verificationLink}">Verify Email</a>
                            <p>This link will expire in 24 hours.</p>
                            <p>If you didn't create this account, please ignore this email.</p>
                        `
                    });
                    
                    console.log('Verification email sent to:', email);
                } catch (emailError) {
                    console.error('Failed to send verification email:', emailError);
                    // Continue with user creation even if email fails
                }
            }
        }

        // Step 2: Check if employee already exists in department
        const existingEmployeeQuery = await departmentRef
            .collection('employees')
            .where('email', '==', email)
            .get();
            
        if (!existingEmployeeQuery.empty) {
            return sendError(res, 409, 'An employee with this email already exists in this department');
        }

        // Step 3: Now run the transaction for remaining operations
        const result = await db.runTransaction(async (transaction) => {
            // Create employee record with reference to user and profile data
            const employeeData = {
                firstName,
                lastName,
                email,
                phone: phone || '',
                employeeId: employeeId || `EMP-${Date.now()}`,
                title: title || '',
                company: finalCompanyName,
                colorScheme: finalColorScheme,
                userRef: db.doc(`users/${userId}`),
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now()
            };
            
            // Create or update card document with ALL profile information
            const cardsRef = db.collection('cards').doc(userId);
            const cardsDoc = await transaction.get(cardsRef);
            
            if (cardsDoc.exists) {
                // Add employee reference to existing card document
                employeeData.cardsRef = cardsRef;
            } else {
                // Create a new card document with a default card
                const cardData = {
                    cards: [{
                        name: firstName,
                        surname: lastName,
                        email: email,
                        phone: phone || '',
                        occupation: title || '',
                        company: finalCompanyName,
                        profileImage: null,
                        companyLogo: null,
                        socials: {},
                        colorScheme: finalColorScheme,
                        createdAt: admin.firestore.Timestamp.now()
                    }]
                };
                
                transaction.set(cardsRef, cardData);
                employeeData.cardsRef = cardsRef;
            }
            
            // Create employee document
            const employeeRef = departmentRef.collection('employees').doc();
            transaction.set(employeeRef, employeeData);
            
            // Update department member count
            transaction.update(departmentRef, {
                memberCount: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.Timestamp.now()
            });
            
            // Update user record with ONLY the reference fields and isEmployee flag
            transaction.set(db.collection('users').doc(userId), {
                employeeRef: employeeRef,
                departmentRef: departmentRef,
                enterpriseRef: db.doc(`enterprise/${enterpriseId}`),
                isEmployee: true,
                lastVerificationEmailSent: verificationToken ? Date.now() : admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            return {
                userId,
                employeeId: employeeRef.id,
                isNewUser,
                employeeData: {
                    ...employeeData,
                    userRef: `users/${userId}`,
                    cardsRef: employeeData.cardsRef ? employeeData.cardsRef.path : null
                },
                verificationSent: !!verificationToken
            };
        });
        
        // Format timestamps for response
        const responseData = {
            ...result.employeeData,
            createdAt: admin.firestore.Timestamp.now().toDate().toISOString(),
            updatedAt: admin.firestore.Timestamp.now().toDate().toISOString()
        };
        
        res.status(201).send({
            success: true,
            message: `Employee ${result.isNewUser ? 'and user ' : ''}created successfully`,
            employee: {
                id: result.employeeId,
                ...responseData
            },
            userId: result.userId,
            colorScheme: responseData.colorScheme,
            verificationSent: result.verificationSent
        });
    } catch (error) {
        console.error('Error adding employee:', error);
        sendError(res, 500, 'Error adding employee', error);
    }
};
