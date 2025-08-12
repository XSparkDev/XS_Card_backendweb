const { db, admin } = require('../firebase.js');
const { logActivity, ACTIONS, RESOURCES } = require('../utils/logger');

/**
 * Get email signature templates
 */
exports.getSignatureTemplates = async (req, res) => {
    try {
        const templates = [
            {
                id: 'professional',
                name: 'Professional',
                description: 'Clean and professional signature style',
                preview: {
                    name: 'John Doe',
                    title: 'Senior Developer',
                    company: 'Tech Corp',
                    phone: '+1 (555) 123-4567',
                    email: 'john.doe@techcorp.com'
                }
            },
            {
                id: 'modern',
                name: 'Modern',
                description: 'Contemporary design with bold typography',
                preview: {
                    name: 'Jane Smith',
                    title: 'Marketing Manager',
                    company: 'Digital Solutions',
                    phone: '+1 (555) 987-6543',
                    email: 'jane.smith@digitalsolutions.com'
                }
            },
            {
                id: 'minimal',
                name: 'Minimal',
                description: 'Simple and clean signature',
                preview: {
                    name: 'Mike Johnson',
                    title: 'Designer',
                    company: 'Creative Studio',
                    phone: '+1 (555) 456-7890',
                    email: 'mike.johnson@creativestudio.com'
                }
            }
        ];

        res.status(200).send({
            templates,
            message: 'Signature templates retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting signature templates:', error);
        res.status(500).send({
            message: 'Failed to get signature templates',
            error: error.message
        });
    }
};

/**
 * Preview email signature
 */
exports.previewSignature = async (req, res) => {
    const { id } = req.params;
    const {
        signatureText,
        signatureHtml,
        includeName = true,
        includeTitle = true,
        includeCompany = true,
        includePhone = true,
        includeEmail = true,
        includeWebsite = false,
        includeSocials = false,
        signatureStyle = 'professional'
    } = req.body;

    try {
        // Get user data
        const userRef = db.collection('users').doc(id);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).send({ message: 'User not found' });
        }

        const userData = userDoc.data();
        
        // Get user's card data
        const cardDoc = await db.collection('cards').doc(id).get();
        const cardData = cardDoc.exists ? cardDoc.data() : { cards: [] };
        const userCard = cardData.cards && cardData.cards.length > 0 ? cardData.cards[0] : {};

        // Generate preview signature
        const previewSignature = generateSignatureHtml({
            signatureText,
            userData,
            userCard,
            includeName,
            includeTitle,
            includeCompany,
            includePhone,
            includeEmail,
            includeWebsite,
            includeSocials,
            signatureStyle
        });

        res.status(200).send({
            preview: previewSignature,
            message: 'Signature preview generated successfully'
        });

    } catch (error) {
        console.error('Error generating signature preview:', error);
        res.status(500).send({
            message: 'Failed to generate signature preview',
            error: error.message
        });
    }
};

/**
 * Test email signature by sending a test email
 */
exports.testSignature = async (req, res) => {
    const { id } = req.params;
    const { testEmail } = req.body;

    try {
        // Validate test email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(testEmail)) {
            return res.status(400).send({
                message: 'Invalid test email address'
            });
        }

        // Get user data
        const userRef = db.collection('users').doc(id);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).send({ message: 'User not found' });
        }

        const userData = userDoc.data();
        const signature = userData.emailSignature;

        if (!signature || !signature.isActive) {
            return res.status(400).send({
                message: 'No active email signature found'
            });
        }

        // Send test email with signature
        const { sendMailWithStatus } = require('../public/Utils/emailService');
        
        const mailOptions = {
            to: testEmail,
            subject: 'Test Email Signature - XS Card',
            html: `
                <h2>Test Email Signature</h2>
                <p>This is a test email to preview your email signature.</p>
                <p>Your signature will appear below:</p>
                <hr>
                ${signature.signatureHtml || signature.signatureText}
            `
        };

        const emailResult = await sendMailWithStatus(mailOptions, id);

        if (!emailResult.success) {
            return res.status(500).send({
                message: 'Failed to send test email',
                error: emailResult.error
            });
        }

        // Log test email activity
        await logActivity({
            action: ACTIONS.SEND,
            resource: RESOURCES.USER,
            userId: id,
            resourceId: id,
            details: {
                testEmailSent: true,
                testEmailAddress: testEmail,
                signatureTested: true
            }
        });

        res.status(200).send({
            message: 'Test email sent successfully',
            emailResult
        });

    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).send({
            message: 'Failed to send test email',
            error: error.message
        });
    }
};

/**
 * Bulk update email signatures for enterprise users
 */
exports.bulkUpdateSignatures = async (req, res) => {
    const { enterpriseId } = req.params;
    const {
        signatureTemplate,
        includeName = true,
        includeTitle = true,
        includeCompany = true,
        includePhone = true,
        includeEmail = true,
        includeWebsite = false,
        includeSocials = false,
        signatureStyle = 'professional',
        isActive = true
    } = req.body;

    try {
        // Verify enterprise exists
        const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
        const enterpriseDoc = await enterpriseRef.get();

        if (!enterpriseDoc.exists) {
            return res.status(404).send({
                message: 'Enterprise not found'
            });
        }

        // Get all enterprise users
        const usersSnapshot = await db.collection('users')
            .where('enterpriseRef', '==', enterpriseRef)
            .get();

        if (usersSnapshot.empty) {
            return res.status(404).send({
                message: 'No users found for this enterprise'
            });
        }

        const updatePromises = [];
        const updatedUsers = [];

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            
            // Get user's card data
            const cardDoc = await db.collection('cards').doc(userData.uid).get();
            const cardData = cardDoc.exists ? cardDoc.data() : { cards: [] };
            const userCard = cardData.cards && cardData.cards.length > 0 ? cardData.cards[0] : {};

            // Generate signature HTML
            const signatureHtml = generateSignatureHtml({
                signatureText: signatureTemplate,
                userData,
                userCard,
                includeName,
                includeTitle,
                includeCompany,
                includePhone,
                includeEmail,
                includeWebsite,
                includeSocials,
                signatureStyle
            });

            // Prepare signature data
            const signatureData = {
                signatureText: signatureTemplate || '',
                signatureHtml,
                includeName,
                includeTitle,
                includeCompany,
                includePhone,
                includeEmail,
                includeWebsite,
                includeSocials,
                signatureStyle,
                isActive,
                updatedAt: admin.firestore.Timestamp.now()
            };

            // Update user signature
            const updatePromise = userDoc.ref.update({
                emailSignature: signatureData
            });

            updatePromises.push(updatePromise);
            updatedUsers.push(userData.uid);
        }

        // Execute all updates
        await Promise.all(updatePromises);

        // Log bulk update activity
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.USER,
            userId: req.user.uid,
            resourceId: enterpriseId,
            details: {
                bulkSignatureUpdate: true,
                enterpriseId,
                usersUpdated: updatedUsers.length,
                signatureStyle,
                isActive
            }
        });

        res.status(200).send({
            message: 'Bulk signature update completed successfully',
            usersUpdated: updatedUsers.length,
            updatedUsers
        });

    } catch (error) {
        console.error('Error in bulk signature update:', error);
        res.status(500).send({
            message: 'Failed to update signatures in bulk',
            error: error.message
        });
    }
};

/**
 * Generate signature HTML based on user data and preferences
 */
const generateSignatureHtml = ({ 
    signatureText, 
    userData, 
    userCard, 
    includeName, 
    includeTitle, 
    includeCompany, 
    includePhone, 
    includeEmail, 
    includeWebsite, 
    includeSocials, 
    signatureStyle 
}) => {
    const styles = {
        professional: {
            container: 'font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.4;',
            name: 'font-weight: bold; color: #2c3e50; font-size: 16px;',
            title: 'color: #7f8c8d; font-style: italic;',
            contact: 'color: #34495e;',
            separator: 'color: #bdc3c7;'
        },
        modern: {
            container: 'font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #2c3e50; line-height: 1.6;',
            name: 'font-weight: 600; color: #1a252f; font-size: 16px;',
            title: 'color: #5d6d7e; font-weight: 500;',
            contact: 'color: #34495e;',
            separator: 'color: #85929e;'
        },
        minimal: {
            container: 'font-family: "Helvetica Neue", Arial, sans-serif; font-size: 13px; color: #555; line-height: 1.5;',
            name: 'font-weight: 600; color: #333; font-size: 15px;',
            title: 'color: #666;',
            contact: 'color: #555;',
            separator: 'color: #ddd;'
        }
    };

    const style = styles[signatureStyle] || styles.professional;
    
    let signatureParts = [];
    
    // Add custom signature text if provided
    if (signatureText) {
        signatureParts.push(`<div style="${style.container}">${signatureText}</div>`);
    }
    
    // Add name
    if (includeName && (userData.name || userCard.name)) {
        const fullName = `${userData.name || userCard.name || ''} ${userData.surname || userCard.surname || ''}`.trim();
        if (fullName) {
            signatureParts.push(`<div style="${style.name}">${fullName}</div>`);
        }
    }
    
    // Add title
    if (includeTitle && (userData.occupation || userCard.occupation)) {
        signatureParts.push(`<div style="${style.title}">${userData.occupation || userCard.occupation}</div>`);
    }
    
    // Add company
    if (includeCompany && (userData.company || userCard.company)) {
        signatureParts.push(`<div style="${style.contact}">${userData.company || userCard.company}</div>`);
    }
    
    // Add contact information
    const contactInfo = [];
    
    if (includePhone && (userData.phone || userCard.phone)) {
        contactInfo.push(`📞 ${userData.phone || userCard.phone}`);
    }
    
    if (includeEmail && (userData.email || userCard.email)) {
        contactInfo.push(`✉️ ${userData.email || userCard.email}`);
    }
    
    if (includeWebsite && userCard.website) {
        contactInfo.push(`🌐 ${userCard.website}`);
    }
    
    if (contactInfo.length > 0) {
        signatureParts.push(`<div style="${style.contact}">${contactInfo.join(' | ')}</div>`);
    }
    
    // Add social media links
    if (includeSocials && userCard.socials) {
        const socialLinks = [];
        const socials = userCard.socials;
        
        if (socials.linkedin) socialLinks.push(`<a href="${socials.linkedin}" style="color: #0077b5; text-decoration: none;">LinkedIn</a>`);
        if (socials.twitter) socialLinks.push(`<a href="${socials.twitter}" style="color: #1da1f2; text-decoration: none;">Twitter</a>`);
        if (socials.facebook) socialLinks.push(`<a href="${socials.facebook}" style="color: #1877f2; text-decoration: none;">Facebook</a>`);
        if (socials.instagram) socialLinks.push(`<a href="${socials.instagram}" style="color: #e4405f; text-decoration: none;">Instagram</a>`);
        
        if (socialLinks.length > 0) {
            signatureParts.push(`<div style="${style.contact}">${socialLinks.join(' | ')}</div>`);
        }
    }
    
    // Add XS Card branding
    signatureParts.push(`<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid ${style.separator}; font-size: 12px; color: #95a5a6;">
        Sent via <a href="https://xscard.com" style="color: #3498db; text-decoration: none;">XS Card</a>
    </div>`);
    
    return signatureParts.join('<br>');
};

