const { db, admin } = require('../firebase.js');
const { transporter, sendMailWithStatus } = require('../public/Utils/emailService');
const { formatDate } = require('../utils/dateFormatter');
const { logActivity, ACTIONS, RESOURCES } = require('../utils/logger');

// Add constant for free plan limit
const FREE_PLAN_CONTACT_LIMIT = 3;

exports.getAllContacts = async (req, res) => {
    try {
        console.log('Fetching all contacts...');
        const contactsRef = db.collection('contacts');
        const snapshot = await contactsRef.get();
        
        if (snapshot.empty) {
            console.log('No contacts found in collection');
            return res.status(404).send({ message: 'No contacts found' });
        }

        const contacts = [];
        snapshot.forEach(doc => {
            contacts.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`Found ${contacts.length} contacts`);
        res.status(200).send(contacts);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).send({ 
            message: 'Internal Server Error', 
            error: error.message 
        });
    }
};

exports.getContactById = async (req, res) => {
    const { id } = req.params;
    try {
        const contactRef = db.collection('contacts').doc(id);
        const doc = await contactRef.get();
        
        if (!doc.exists) {
            return res.status(404).send({ message: 'Contact list not found' });
        }

        // Send raw data for debugging
        const data = doc.data();
        console.log('Raw contact data:', data); // Debug log

        if (data.contactList) {
            data.contactList = data.contactList.map(contact => ({
                ...contact,
                createdAt: formatDate(contact.createdAt) // Format for display
            }));
        }

        // Send the data without modification
        res.status(200).send({
            id: doc.id,
            ...data
        });
    } catch (error) {
        console.error('Error fetching contact:', error);
        res.status(500).send({ message: 'Error fetching contact', error: error.message });
    }
};

// Make this function more permissive for public use
exports.addContact = async (req, res) => {
    const { userId, contactInfo } = req.body;
    
    // Detailed logging
    console.log('Add Contact called - Public endpoint');
    console.log('Raw request body:', JSON.stringify(req.body, null, 2));
    
    if (!userId || !contactInfo) {
        return res.status(400).send({ 
            success: false,
            message: 'User ID and contact info are required'
        });
    }

    try {
        // Get user's plan information
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        if (!userData) {
            return res.status(404).send({ message: 'User not found' });
        }

        const contactRef = db.collection('contacts').doc(userId);
        const doc = await contactRef.get();

        let currentContacts = [];
        if (doc.exists) {
            currentContacts = doc.data().contactList || [];
        }

        // Check if free user has reached contact limit - Add strict validation
        if (userData.plan === 'free' && currentContacts.length >= FREE_PLAN_CONTACT_LIMIT) {
            console.log(`Contact limit reached for free user ${userId}. Current contacts: ${currentContacts.length}`);
            return res.status(403).send({
                message: 'Contact limit reached',
                error: 'FREE_PLAN_LIMIT_REACHED',
                currentContacts: currentContacts.length,
                limit: FREE_PLAN_CONTACT_LIMIT
            });
        }

        const newContact = {
            ...contactInfo,
            email: contactInfo.email || '', // Add email field with fallback
            createdAt: admin.firestore.Timestamp.now()
        };

        currentContacts.push(newContact);

        await contactRef.set({
            userId: db.doc(`users/${userId}`),
            contactList: currentContacts
        }, { merge: true });
        
        res.status(201).send({ 
            message: 'Contact added successfully',
            contactList: currentContacts.map(contact => ({
                ...contact,
                createdAt: formatDate(contact.createdAt)
            })),
            remainingContacts: userData.plan === 'free' ? 
                FREE_PLAN_CONTACT_LIMIT - currentContacts.length : 
                'unlimited'
        });
    } catch (error) {
        console.error('Error adding contact:', error);
        res.status(500).send({ 
            message: 'Internal Server Error', 
            error: error.message 
        });
    }
};

exports.saveContactInfo = async (req, res) => {
    const { userId, contactInfo } = req.body;
    
    // Additional logging at the start
    console.log('Save contact info request received:', { userId, contactInfo });
    
    if (!userId || !contactInfo) {
        return res.status(400).send({ 
            success: false,
            message: 'User ID and contact info are required'
        });
    }

    try {
        // Get user's plan information
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        if (!userData) {
            return res.status(404).send({ message: 'User not found' });
        }

        // Get current contacts count
        const contactsRef = db.collection('contacts').doc(userId);
        const contactsDoc = await contactsRef.get();
        
        // Fix contactList vs contactsList inconsistency
        let existingContacts = [];
        if (contactsDoc.exists) {
            // Try to get contactList first, then fall back to contactsList for backward compatibility
            existingContacts = contactsDoc.data().contactList || contactsDoc.data().contactsList || [];
        }
        
        if (!Array.isArray(existingContacts)) existingContacts = [];

        // Check if free user has reached contact limit - Improve validation
        if (userData.plan === 'free' && existingContacts.length >= FREE_PLAN_CONTACT_LIMIT) {
            console.log(`Contact limit reached for free user ${userId}. Current contacts: ${existingContacts.length}`);
            return res.status(403).send({
                message: 'Contact limit reached',
                error: 'FREE_PLAN_LIMIT_REACHED',
                currentContacts: existingContacts.length,
                limit: FREE_PLAN_CONTACT_LIMIT
            });
        }

        // Force-type the email field as string to avoid any type conversions
        const contactEmail = String(contactInfo.email || '');
        console.log('Processed email value:', contactEmail);
        
        // Create contact with explicit field assignment - no object spread which could lose properties
        const newContact = {
            name: String(contactInfo.name || ''),
            surname: String(contactInfo.surname || ''),
            phone: String(contactInfo.phone || ''),
            email: contactEmail, // Explicitly assign email
            howWeMet: String(contactInfo.howWeMet || ''),
            createdAt: admin.firestore.Timestamp.now()
        };
        
        console.log('Final contact object to save:', newContact);
        
        // Add to existing contacts
        existingContacts.push(newContact);

        // Log the final array before saving
        console.log('Contact list to save (first few):', 
            existingContacts.slice(-3).map(c => ({ ...c, createdAt: 'timestamp' }))
        );

        // Use contactList consistently
        await contactsRef.set({
            userId: db.doc(`users/${userId}`),
            contactList: existingContacts
        }, { merge: true });

        // Send email notification if user has email
        if (userData.email) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: userData.email,
                subject: 'Someone Saved Your Contact Information',
                html: `
                    <h2>New Contact Added</h2>
                    <p><strong>${contactInfo.name} ${contactInfo.surname}</strong> recently received your XS Card and has sent you their details:</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <p><strong>Contact Details:</strong></p>
                        <ul style="list-style: none; padding-left: 0;">
                            <li><strong>Name:</strong> ${contactInfo.name}</li>
                            <li><strong>Surname:</strong> ${contactInfo.surname}</li>
                            <li><strong>Phone Number:</strong> ${contactInfo.phone}</li>
                            <li><strong>Email:</strong> ${contactInfo.email || 'Not provided'}</li>
                            <li><strong>How You Met:</strong> ${contactInfo.howWeMet}</li>
                        </ul>
                    </div>
                    <p style="color: #666; font-size: 12px;">This is an automated notification from your XS Card application.</p>
                    ${userData.plan === 'free' ? 
                        `<p style="color: #ff4b6e;">You have ${FREE_PLAN_CONTACT_LIMIT - existingContacts.length} contacts remaining in your free plan.</p>` 
                        : ''}
                `
            };

            const mailResult = await sendMailWithStatus(mailOptions);
            if (!mailResult.success) {
                console.error('Failed to send email notification:', mailResult.error);
            }
        }

        // Log successful contact save - use await directly
        console.log('About to log contact creation activity');
        await logActivity({
            action: ACTIONS.CREATE,
            resource: RESOURCES.CONTACT,
            userId: userId,
            resourceId: contactsRef.id,
            details: {
                contactName: `${contactInfo.name} ${contactInfo.surname}`,
                contactCount: existingContacts.length,
                plan: userData.plan
            }
        });

        // Make sure we're sending a success flag in the response for the frontend
        res.status(200).send({ 
            success: true,
            message: 'Contact saved successfully',
            // Return the saved contact for verification
            savedContact: {
                ...newContact,
                createdAt: 'timestamp'
            },
            contactsCount: existingContacts.length,
            remainingContacts: userData.plan === 'free' ? 
                FREE_PLAN_CONTACT_LIMIT - existingContacts.length : 
                'unlimited'
        });
    } catch (error) {
        // Log error with await
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.CONTACT,
            userId: userId,
            status: 'error',
            details: {
                error: error.message,
                operation: 'save_contact'
            }
        });
        
        console.error('Error saving contact info:', error);
        res.status(500).send({ 
            success: false,
            message: 'Failed to save contact information',
            error: error.message 
        });
    }
};

exports.updateContact = async (req, res) => {
    const { id } = req.params;
    const { contactInfo } = req.body;
    
    if (!contactInfo) {
        return res.status(400).send({ message: 'Contact info is required' });
    }

    try {
        const contactRef = db.collection('contacts').doc(id);
        const doc = await contactRef.get();

        if (!doc.exists) {
            return res.status(404).send({ message: 'Contact list not found' });
        }

        const currentContacts = doc.data().contactsList || [];
        currentContacts.push({
            ...contactInfo,
            createdAt: new Date().toISOString()
        });

        await contactRef.update({
            contactsList: currentContacts
        });

        res.status(200).send({ 
            message: 'Contact list updated successfully',
            updatedContacts: currentContacts
        });
    } catch (error) {
        console.error('Error updating contacts:', error);
        res.status(500).send({ 
            message: 'Internal Server Error', 
            error: error.message 
        });
    }
};

exports.deleteContact = async (req, res) => {
    const { id } = req.params;
    
    try {
        const contactRef = db.collection('contacts').doc(id);
        const doc = await contactRef.get();
        
        if (!doc.exists) {
            return res.status(404).send({ message: 'Contact list not found' });
        }

        await contactRef.delete();
        
        // Log successful contact list deletion with await
        await logActivity({
            action: ACTIONS.DELETE,
            resource: RESOURCES.CONTACT,
            userId: req.user?.uid,
            resourceId: id,
            details: {
                operation: 'delete_contact_list',
                contactCount: doc.data().contactList.length
            }
        });
        
        res.status(200).send({ 
            message: 'Contact list deleted successfully',
            deletedContactId: id
        });
    } catch (error) {
        // Log error with await
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.CONTACT,
            userId: req.user?.uid,
            resourceId: id,
            status: 'error',
            details: {
                error: error.message,
                operation: 'delete_contact_list'
            }
        });
        
        console.error('Delete contact error:', error);
        res.status(500).send({ 
            message: 'Failed to delete contact list',
            error: error.message 
        });
    }
};

exports.deleteContactFromList = async (req, res) => {
    const { id, index } = req.params;
    const contactIndex = parseInt(index);
    
    console.log('Delete request received:', { id, index, contactIndex }); // Debug log

    try {
        const contactRef = db.collection('contacts').doc(id);
        const doc = await contactRef.get();
        
        if (!doc.exists) {
            console.log('Document not found:', id);
            return res.status(404).send({ message: 'Contact list not found' });
        }

        const data = doc.data();
        // Check if contactList exists (not contactsList)
        const currentContacts = data.contactList || [];
        
        console.log('Current contacts:', { 
            total: currentContacts.length, 
            requestedIndex: contactIndex,
            contacts: currentContacts
        });

        if (contactIndex < 0 || contactIndex >= currentContacts.length) {
            console.log('Index out of range:', { contactIndex, length: currentContacts.length });
            return res.status(400).send({ message: 'Contact index out of range' });
        }

        const deletedContact = currentContacts[contactIndex];
        currentContacts.splice(contactIndex, 1);

        await contactRef.update({
            contactList: currentContacts // Note: using contactList, not contactsList
        });

        // Log successful individual contact deletion with await
        await logActivity({
            action: ACTIONS.DELETE,
            resource: RESOURCES.CONTACT,
            userId: req.user?.uid,
            resourceId: id,
            details: {
                operation: 'delete_contact_from_list',
                contactIndex: contactIndex,
                contactName: deletedContact.name ? `${deletedContact.name} ${deletedContact.surname || ''}` : 'unnamed',
                remainingContacts: currentContacts.length
            }
        });

        console.log('Contact deleted successfully');
        res.status(200).send({ 
            message: 'Contact deleted successfully',
            remainingContacts: currentContacts.length
        });
    } catch (error) {
        // Log error with await
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.CONTACT,
            userId: req.user?.uid,
            resourceId: id,
            status: 'error',
            details: {
                error: error.message,
                operation: 'delete_contact_from_list',
                contactIndex: contactIndex
            }
        });
        
        console.error('Delete contact error:', error);
        res.status(500).send({ 
            message: 'Failed to delete contact',
            error: error.message 
        });
    }
};
