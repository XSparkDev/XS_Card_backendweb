const { db } = require('../../firebase.js');
const { formatDate } = require('../../utils/dateFormatter');

/**
 * Get all contacts for an enterprise (admin/manager access)
 */
const getAllEnterpriseContacts = async (enterpriseId) => {
    try {
        console.log(`🏢 [EnterpriseContacts] Fetching all contacts for enterprise: ${enterpriseId}`);

        const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
        const enterpriseDoc = await enterpriseRef.get();
        
        if (!enterpriseDoc.exists) {
            throw new Error('Enterprise not found');
        }

        // Get all users in the enterprise
        const enterpriseUsers = [];
        const departmentsSnapshot = await enterpriseRef.collection('departments').get();
        
        for (const deptDoc of departmentsSnapshot.docs) {
            const employeesSnapshot = await deptDoc.ref.collection('employees').get();
            
            employeesSnapshot.forEach(empDoc => {
                const empData = empDoc.data();
                if (empData.userId && empData.userId.id) {
                    enterpriseUsers.push({
                        userId: empData.userId.id,
                        name: empData.name || 'Unknown',
                        role: empData.role || 'employee',
                        department: deptDoc.id,
                        departmentName: deptDoc.data().name || deptDoc.id
                    });
                }
            });
        }

        console.log(`📊 [EnterpriseContacts] Found ${enterpriseUsers.length} users in enterprise`);

        // Fetch contacts for all enterprise users
        const allContacts = [];
        let totalContactCount = 0;

        for (const user of enterpriseUsers) {
            try {
                const contactRef = db.collection('contacts').doc(user.userId);
                const contactDoc = await contactRef.get();
                
                if (contactDoc.exists) {
                    const contactData = contactDoc.data();
                    const contactList = contactData.contactList || [];
                    
                    if (contactList.length > 0) {
                        // Format contacts with owner information
                        const formattedContacts = contactList.map(contact => ({
                            ...contact,
                            createdAt: formatDate(contact.createdAt),
                            // Add owner information for enterprise view
                            owner: {
                                userId: user.userId,
                                name: user.name,
                                role: user.role,
                                department: user.department,
                                departmentName: user.departmentName
                            }
                        }));

                        allContacts.push({
                            id: user.userId,
                            owner: {
                                userId: user.userId,
                                name: user.name,
                                role: user.role,
                                department: user.department,
                                departmentName: user.departmentName
                            },
                            contactList: formattedContacts
                        });

                        totalContactCount += contactList.length;
                    }
                }
            } catch (contactError) {
                console.warn(`⚠️ [EnterpriseContacts] Failed to fetch contacts for user ${user.userId}:`, contactError.message);
            }
        }

        console.log(`✅ [EnterpriseContacts] Retrieved ${totalContactCount} total contacts from ${allContacts.length} users`);

        return {
            contacts: allContacts,
            totalCount: totalContactCount,
            userCount: allContacts.length,
            enterpriseId: enterpriseId
        };

    } catch (error) {
        console.error('Error fetching enterprise contacts:', error);
        throw error;
    }
};

module.exports = {
    getAllEnterpriseContacts
};
