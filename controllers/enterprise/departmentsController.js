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
        const { name, description, parentDepartmentId = null } = req.body;
        
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

        // Create department data object
        const departmentData = {
            name,
            description: description || '',
            parentDepartmentId,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            memberCount: 0
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

        res.status(201).send({
            success: true,
            message: 'Department created successfully',
            department: {
                id: departmentId,
                ...departmentData,
                createdAt: departmentData.createdAt.toDate().toISOString(),
                updatedAt: departmentData.updatedAt.toDate().toISOString()
            },
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
        const { enterpriseId, departmentId } = req.params; // Add this line to extract parameters
        
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
            company, // Allow setting the company name
            teamId, // New: team ID to assign the employee to
            role = 'employee',
            isActive = true
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
        if (!existingUserId && !email) missingFields.push('email');
        
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

        // Check if team exists (if specified)
        let teamRef = null;
        if (teamId) {
            teamRef = departmentRef.collection('teams').doc(teamId);
            const teamDoc = await teamRef.get();
            
            if (!teamDoc.exists) {
                return sendError(res, 404, `Team with ID ${teamId} not found in this department`);
            }
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
        let passwordSetupToken = null;
        
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
                
                // Generate a temporary password if none provided
                const temporaryPassword = password || Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
                
                // Generate password setup token if no password was provided
                if (!password) {
                    passwordSetupToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
                }
                
                userRecord = await admin.auth().createUser({
                    email,
                    password: temporaryPassword,
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
                
                // Add password setup token if needed
                if (passwordSetupToken) {
                    userData.passwordSetupToken = passwordSetupToken;
                    userData.passwordSetupExpires = admin.firestore.Timestamp.fromDate(
                        new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
                    );
                }
                
                // Set the document outside the transaction to ensure it exists
                await db.collection('users').doc(userId).set(userData);
                
                // Send verification email
                try {
                    const { sendMailWithStatus } = require('../../public/Utils/emailService');
                    
                    const verificationLink = `${process.env.APP_URL || 'http://localhost:8383'}/verify-email?token=${verificationToken}&uid=${userId}`;
                    
                    // Prepare email content (with or without password setup info)
                    let emailHtml = `
                        <h1>Welcome to XS Card!</h1>
                        <p>Hello ${firstName},</p>
                        <p>You've been added as an employee by your administrator.</p>
                        <p>Please click the link below to verify your email address:</p>
                        <a href="${verificationLink}">Verify Email</a>
                        <p>This link will expire in 24 hours.</p>`;
                    
                    // Add password setup instructions if applicable
                    if (passwordSetupToken) {
                        const setupLink = `${process.env.APP_URL || 'http://localhost:8383'}/set-password?token=${passwordSetupToken}&uid=${userId}`;
                        emailHtml += `
                            <p><strong>Set Your Password</strong></p>
                            <p>You'll need to set up your password to access your account:</p>
                            <a href="${setupLink}">Set Your Password</a>
                            <p>This link will expire in 24 hours.</p>`;
                    }
                    
                    emailHtml += `<p>If you didn't expect this email, please ignore it.</p>`;
                    
                    await sendMailWithStatus({
                        to: email,
                        subject: 'Welcome to XS Card - Verify your email address',
                        html: emailHtml
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
                updatedAt: admin.firestore.Timestamp.now(),
                role: role,
                isActive: isActive
            };
            
            // Add team reference if provided
            if (teamRef) {
                employeeData.teamRef = teamRef;
                employeeData.teamId = teamId;
            }
            
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
            
            // Create employee document in department
            const employeeRef = departmentRef.collection('employees').doc();
            transaction.set(employeeRef, employeeData);
            
            // Create a copy of the employee in the team's employees subcollection if team is specified
            let teamEmployeeRef = null;
            if (teamRef) {
                // Create the same employee data in the team's employees subcollection
                teamEmployeeRef = teamRef.collection('employees').doc(employeeRef.id); // Use same ID for consistency
                
                // Create a teamEmployee data object that includes department reference
                const teamEmployeeData = {
                    ...employeeData,
                    departmentRef: departmentRef,
                    departmentId: departmentId,
                    mainEmployeeRef: employeeRef // Reference to the main employee document
                };
                
                transaction.set(teamEmployeeRef, teamEmployeeData);
                
                // Also update the main employee record with this reference
                employeeData.teamEmployeeRef = teamEmployeeRef;
                transaction.update(employeeRef, { teamEmployeeRef: teamEmployeeRef });
            }
            
            // Update department member count
            transaction.update(departmentRef, {
                memberCount: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.Timestamp.now()
            });
            
            // Update team member count if applicable
            if (teamRef) {
                transaction.update(teamRef, {
                    memberCount: admin.firestore.FieldValue.increment(1),
                    updatedAt: admin.firestore.Timestamp.now()
                });
            }
            
            // Update user record with ONLY the reference fields and isEmployee flag
            const userUpdateData = {
                employeeRef: employeeRef,
                departmentRef: departmentRef,
                enterpriseRef: db.doc(`enterprise/${enterpriseId}`),
                isEmployee: true,
                lastVerificationEmailSent: verificationToken ? Date.now() : admin.firestore.FieldValue.serverTimestamp()
            };
            
            // Add team references to user document if applicable
            if (teamRef) {
                userUpdateData.teamRef = teamRef;
                userUpdateData.teamEmployeeRef = teamEmployeeRef;
            }
            
            transaction.set(db.collection('users').doc(userId), userUpdateData, { merge: true });
            
            return {
                userId,
                employeeId: employeeRef.id,
                teamId: teamId || null,
                teamEmployeeRefPath: teamEmployeeRef ? teamEmployeeRef.path : null,
                isNewUser,
                employeeData: {
                    ...employeeData,
                    userRef: `users/${userId}`,
                    cardsRef: employeeData.cardsRef ? employeeData.cardsRef.path : null,
                    teamRef: teamRef ? teamRef.path : null,
                    teamEmployeeRef: teamEmployeeRef ? teamEmployeeRef.path : null
                },
                verificationSent: !!verificationToken,
                passwordSetupSent: !!passwordSetupToken
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
            teamId: result.teamId,
            teamEmployeeRefPath: result.teamEmployeeRefPath,
            colorScheme: responseData.colorScheme,
            verificationSent: result.verificationSent,
            passwordSetupSent: result.passwordSetupSent
        });
    } catch (error) {
        console.error('Error adding employee:', error);
        sendError(res, 500, 'Error adding employee', error);
    }
};

// Update an existing employee
exports.updateEmployee = async (req, res) => {
    try {
        const { enterpriseId, departmentId, employeeId } = req.params;
        const { firstName, lastName, email, phone, title, colorScheme, teamId } = req.body;
        
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
        
        // Check if team reference is being changed
        let newTeamRef = null;
        let oldTeamRef = employeeData.teamRef || null;
        let teamChanged = false;
        
        if (teamId !== undefined) {
            if (teamId === null) {
                // Removing from team
                teamChanged = !!oldTeamRef;
                oldTeamRef = employeeData.teamRef;
                newTeamRef = null;
            } else if (!employeeData.teamId || teamId !== employeeData.teamId) {
                // Changing team or adding to team
                teamChanged = true;
                const teamDoc = await departmentRef.collection('teams').doc(teamId).get();
                
                if (!teamDoc.exists) {
                    return sendError(res, 404, `Team with ID ${teamId} not found`);
                }
                
                newTeamRef = teamDoc.ref;
            }
        }
        
        // Prepare update data
        const updateData = {
            updatedAt: admin.firestore.Timestamp.now()
        };
        
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (title !== undefined) updateData.title = title;
        if (colorScheme !== undefined) updateData.colorScheme = colorScheme;
        
        // Run transaction for atomic updates
        await db.runTransaction(async (transaction) => {
            // Update team references if team is changing
            if (teamChanged) {
                // Add to new team if specified
                if (newTeamRef) {
                    updateData.teamRef = newTeamRef;
                    updateData.teamId = teamId;
                    
                    // Create copy in new team's employees subcollection
                    const newTeamEmployeeRef = newTeamRef.collection('employees').doc(employeeId);
                    
                    // Get current employee data to create the team copy
                    const currentData = (await transaction.get(employeeRef)).data();
                    
                    // Create team employee data
                    const teamEmployeeData = {
                        ...currentData,
                        ...updateData,
                        departmentRef: departmentRef,
                        departmentId: departmentId,
                        mainEmployeeRef: employeeRef,
                        updatedAt: admin.firestore.Timestamp.now()
                    };
                    
                    // Set the new team employee document
                    transaction.set(newTeamEmployeeRef, teamEmployeeData);
                    
                    // Update employee with team reference
                    updateData.teamEmployeeRef = newTeamEmployeeRef;
                    
                    // Increment new team member count
                    transaction.update(newTeamRef, {
                        memberCount: admin.firestore.FieldValue.increment(1),
                        updatedAt: admin.firestore.Timestamp.now()
                    });
                    
                    // Update user record with team references
                    transaction.update(db.collection('users').doc(employeeData.userRef.id), {
                        teamRef: newTeamRef,
                        teamEmployeeRef: newTeamEmployeeRef
                    });
                } else {
                    // Remove team references
                    updateData.teamRef = admin.firestore.FieldValue.delete();
                    updateData.teamId = admin.firestore.FieldValue.delete();
                    updateData.teamEmployeeRef = admin.firestore.FieldValue.delete();
                    
                    // Update user record to remove team references
                    transaction.update(db.collection('users').doc(employeeData.userRef.id), {
                        teamRef: admin.firestore.FieldValue.delete(),
                        teamEmployeeRef: admin.firestore.FieldValue.delete()
                    });
                }
                
                // Remove from old team if it exists
                if (oldTeamRef) {
                    // Get old team employee reference
                    const oldTeamEmployeeRef = employeeData.teamEmployeeRef;
                    
                    if (oldTeamEmployeeRef) {
                        // Delete the employee document from old team
                        transaction.delete(oldTeamEmployeeRef);
                    }
                    
                    // Decrement old team member count
                    transaction.update(oldTeamRef, {
                        memberCount: admin.firestore.FieldValue.increment(-1),
                        updatedAt: admin.firestore.Timestamp.now()
                    });
                }
            } else if (employeeData.teamRef) {
                // Update the team copy if it exists but team didn't change
                const teamEmployeeRef = employeeData.teamEmployeeRef;
                if (teamEmployeeRef && Object.keys(updateData).length > 1) { // Check if we have updates beyond timestamp
                    transaction.update(teamEmployeeRef, updateData);
                }
            }
            
            // Update the main employee document
            transaction.update(employeeRef, updateData);
            
            // Update card document if it exists
            if (employeeData.cardsRef && (firstName !== undefined || lastName !== undefined || email !== undefined || phone !== undefined || title !== undefined || colorScheme !== undefined)) {
                const cardsRef = employeeData.cardsRef;
                const cardsDoc = await transaction.get(cardsRef);
                
                if (cardsDoc.exists && cardsDoc.data().cards && Array.isArray(cardsDoc.data().cards)) {
                    const cardData = cardsDoc.data();
                    const updatedCards = cardData.cards.map((card, index) => {
                        if (index === 0) { // Update main card
                            const updatedCard = { ...card };
                            if (firstName !== undefined) updatedCard.name = firstName;
                            if (lastName !== undefined) updatedCard.surname = lastName;
                            if (email !== undefined) updatedCard.email = email;
                            if (phone !== undefined) updatedCard.phone = phone;
                            if (title !== undefined) updatedCard.occupation = title;
                            if (colorScheme !== undefined) updatedCard.colorScheme = colorScheme;
                            return updatedCard;
                        }
                        return card;
                    });
                    
                    transaction.update(cardsRef, { cards: updatedCards });
                }
            }
        });
        
        // Get the updated employee
        const updatedEmployeeDoc = await employeeRef.get();
        const updatedEmployeeData = updatedEmployeeDoc.data();
        
        // Format timestamps and references for response
        const formattedEmployee = {
            id: employeeId,
            ...updatedEmployeeData,
            createdAt: updatedEmployeeData.createdAt.toDate().toISOString(),
            updatedAt: updatedEmployeeData.updatedAt.toDate().toISOString(),
            userRef: updatedEmployeeData.userRef.path,
            cardsRef: updatedEmployeeData.cardsRef ? updatedEmployeeData.cardsRef.path : null,
            teamRef: updatedEmployeeData.teamRef ? updatedEmployeeData.teamRef.path : null,
            teamEmployeeRef: updatedEmployeeData.teamEmployeeRef ? updatedEmployeeData.teamEmployeeRef.path : null
        };
        
        res.status(200).send({
            success: true,
            message: 'Employee updated successfully',
            employee: formattedEmployee,
            teamChanged: teamChanged
        });
    } catch (error) {
        console.error('Error updating employee:', error);
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
