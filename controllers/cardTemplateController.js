const { admin, db } = require('../firebase');

/**
 * Helper function to send error responses
 */
const sendError = (res, statusCode, message, error = null) => {
    console.error(`Error ${statusCode}: ${message}`, error);
    return res.status(statusCode).json({
        success: false,
        message,
        error: error?.message || null
    });
};

/**
 * Helper function to check user permissions for template operations
 */
const checkTemplatePermissions = async (userId, enterpriseId, departmentId = null, operation = 'create') => {
    try {
        // Get user's enterprise data to check their role
        const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
        const enterpriseDoc = await enterpriseRef.get();
        
        if (!enterpriseDoc.exists) {
            return { allowed: false, reason: 'Enterprise not found' };
        }

        // Find user's role in the enterprise
        let userRole = null;
        let userDepartmentId = null;

        // Check all departments for this user
        const departmentsSnapshot = await enterpriseRef.collection('departments').get();
        
        for (const deptDoc of departmentsSnapshot.docs) {
            const employeesSnapshot = await deptDoc.ref.collection('employees')
                .where('userId', '==', db.doc(`users/${userId}`))
                .get();
            
            if (!employeesSnapshot.empty) {
                const employeeData = employeesSnapshot.docs[0].data();
                userRole = employeeData.role;
                userDepartmentId = deptDoc.id;
                break;
            }
        }

        if (!userRole) {
            return { allowed: false, reason: 'User not found in enterprise' };
        }

        // Permission rules
        if (userRole === 'admin') {
            // Admin can create/modify any template in their enterprise
            return { allowed: true, userRole, userDepartmentId };
        } else if (userRole === 'manager') {
            // Manager can only create/modify templates for their department
            if (departmentId && departmentId !== userDepartmentId) {
                return { allowed: false, reason: 'Managers can only create templates for their own department' };
            }
            if (!departmentId) {
                return { allowed: false, reason: 'Managers cannot create enterprise-level templates' };
            }
            return { allowed: true, userRole, userDepartmentId };
        } else {
            // Employees cannot create templates
            return { allowed: false, reason: 'Employees cannot create or modify templates' };
        }

    } catch (error) {
        console.error('Error checking template permissions:', error);
        return { allowed: false, reason: 'Error checking permissions' };
    }
};

/**
 * Create a new card template
 * POST /api/templates
 */
exports.createTemplate = async (req, res) => {
    try {
        const userId = req.user.uid;
        const {
            enterpriseId,
            departmentId = null,
            name,
            description = '',
            colorScheme,
            companyLogo = null
        } = req.body;

        // Validate required fields
        if (!enterpriseId || !name || !colorScheme) {
            return sendError(res, 400, 'Enterprise ID, template name, and color scheme are required');
        }

        // Validate color scheme format (hex color)
        const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (!hexColorRegex.test(colorScheme)) {
            return sendError(res, 400, 'Color scheme must be a valid hex color (e.g., #FF5733)');
        }

        // Check permissions
        const permissionCheck = await checkTemplatePermissions(userId, enterpriseId, departmentId);
        if (!permissionCheck.allowed) {
            return sendError(res, 403, permissionCheck.reason);
        }

        // Check if template with same name already exists for this scope
        let existingTemplateQuery = db.collection('cardTemplates')
            .where('enterpriseId', '==', enterpriseId)
            .where('name', '==', name)
            .where('isActive', '==', true);

        if (departmentId) {
            existingTemplateQuery = existingTemplateQuery.where('departmentId', '==', departmentId);
        } else {
            existingTemplateQuery = existingTemplateQuery.where('departmentId', '==', null);
        }

        const existingTemplates = await existingTemplateQuery.get();
        if (!existingTemplates.empty) {
            const scope = departmentId ? 'department' : 'enterprise';
            return sendError(res, 409, `A template with name "${name}" already exists for this ${scope}`);
        }

        // Create template data
        const templateData = {
            enterpriseId,
            departmentId: departmentId || null,
            name: name.trim(),
            description: description.trim(),
            colorScheme,
            companyLogo,
            createdBy: userId,
            createdByRole: permissionCheck.userRole,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            isActive: true
        };

        // Save template
        const templateRef = await db.collection('cardTemplates').add(templateData);
        
        // Get the created template
        const createdTemplate = await templateRef.get();
        const responseData = {
            id: templateRef.id,
            ...createdTemplate.data(),
            createdAt: createdTemplate.data().createdAt.toDate().toISOString(),
            updatedAt: createdTemplate.data().updatedAt.toDate().toISOString()
        };

        console.log(`Template created: ${name} (${templateRef.id}) by ${permissionCheck.userRole} ${userId}`);

        res.status(201).json({
            success: true,
            message: 'Template created successfully',
            data: responseData
        });

    } catch (error) {
        sendError(res, 500, 'Error creating template', error);
    }
};

/**
 * Get all templates for an enterprise
 * GET /api/templates/:enterpriseId
 */
exports.getEnterpriseTemplates = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { enterpriseId } = req.params;
        const { includeInactive = false } = req.query;

        if (!enterpriseId) {
            return sendError(res, 400, 'Enterprise ID is required');
        }

        // Check if user has access to this enterprise
        const permissionCheck = await checkTemplatePermissions(userId, enterpriseId, null, 'read');
        if (!permissionCheck.allowed && !permissionCheck.reason.includes('enterprise-level')) {
            // Allow read access if user is in the enterprise (even if they can't create enterprise templates)
            const basicCheck = await checkTemplatePermissions(userId, enterpriseId, 'any', 'read');
            if (!basicCheck.allowed) {
                return sendError(res, 403, 'Access denied to enterprise templates');
            }
        }

        // Build query
        let templatesQuery = db.collection('cardTemplates')
            .where('enterpriseId', '==', enterpriseId);

        if (!includeInactive) {
            templatesQuery = templatesQuery.where('isActive', '==', true);
        }

        const templatesSnapshot = await templatesQuery
            .orderBy('createdAt', 'desc')
            .get();

        const templates = templatesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate().toISOString(),
            updatedAt: doc.data().updatedAt?.toDate().toISOString()
        }));

        // Separate enterprise and department templates
        const enterpriseTemplates = templates.filter(t => !t.departmentId);
        const departmentTemplates = templates.filter(t => t.departmentId);

        res.status(200).json({
            success: true,
            data: {
                enterpriseTemplates,
                departmentTemplates,
                total: templates.length
            }
        });

    } catch (error) {
        sendError(res, 500, 'Error fetching enterprise templates', error);
    }
};

/**
 * Get templates for a specific department
 * GET /api/templates/:enterpriseId/departments/:departmentId
 */
exports.getDepartmentTemplates = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { enterpriseId, departmentId } = req.params;
        const { includeInactive = false } = req.query;

        if (!enterpriseId || !departmentId) {
            return sendError(res, 400, 'Enterprise ID and Department ID are required');
        }

        // Check permissions
        const permissionCheck = await checkTemplatePermissions(userId, enterpriseId, departmentId, 'read');
        if (!permissionCheck.allowed && !permissionCheck.reason.includes('own department')) {
            return sendError(res, 403, 'Access denied to department templates');
        }

        // Build query for department-specific templates
        let templatesQuery = db.collection('cardTemplates')
            .where('enterpriseId', '==', enterpriseId)
            .where('departmentId', '==', departmentId);

        if (!includeInactive) {
            templatesQuery = templatesQuery.where('isActive', '==', true);
        }

        const templatesSnapshot = await templatesQuery
            .orderBy('createdAt', 'desc')
            .get();

        const templates = templatesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate().toISOString(),
            updatedAt: doc.data().updatedAt?.toDate().toISOString()
        }));

        res.status(200).json({
            success: true,
            data: {
                departmentId,
                templates,
                total: templates.length
            }
        });

    } catch (error) {
        sendError(res, 500, 'Error fetching department templates', error);
    }
};

/**
 * Update a template
 * PUT /api/templates/:templateId
 */
exports.updateTemplate = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { templateId } = req.params;
        const {
            name,
            description,
            colorScheme,
            companyLogo,
            isActive
        } = req.body;

        if (!templateId) {
            return sendError(res, 400, 'Template ID is required');
        }

        // Get existing template
        const templateRef = db.collection('cardTemplates').doc(templateId);
        const templateDoc = await templateRef.get();

        if (!templateDoc.exists) {
            return sendError(res, 404, 'Template not found');
        }

        const templateData = templateDoc.data();

        // Check permissions
        const permissionCheck = await checkTemplatePermissions(
            userId, 
            templateData.enterpriseId, 
            templateData.departmentId, 
            'update'
        );
        if (!permissionCheck.allowed) {
            return sendError(res, 403, permissionCheck.reason);
        }

        // Prepare updates
        const updates = {
            updatedAt: admin.firestore.Timestamp.now()
        };

        if (name !== undefined) {
            if (!name.trim()) {
                return sendError(res, 400, 'Template name cannot be empty');
            }
            updates.name = name.trim();
        }

        if (description !== undefined) {
            updates.description = description.trim();
        }

        if (colorScheme !== undefined) {
            const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            if (!hexColorRegex.test(colorScheme)) {
                return sendError(res, 400, 'Color scheme must be a valid hex color (e.g., #FF5733)');
            }
            updates.colorScheme = colorScheme;
        }

        if (companyLogo !== undefined) {
            updates.companyLogo = companyLogo;
        }

        if (isActive !== undefined) {
            updates.isActive = Boolean(isActive);
        }

        // Check for name conflicts if name is being updated
        if (updates.name && updates.name !== templateData.name) {
            let conflictQuery = db.collection('cardTemplates')
                .where('enterpriseId', '==', templateData.enterpriseId)
                .where('name', '==', updates.name)
                .where('isActive', '==', true);

            if (templateData.departmentId) {
                conflictQuery = conflictQuery.where('departmentId', '==', templateData.departmentId);
            } else {
                conflictQuery = conflictQuery.where('departmentId', '==', null);
            }

            const conflictingTemplates = await conflictQuery.get();
            const hasConflict = conflictingTemplates.docs.some(doc => doc.id !== templateId);
            
            if (hasConflict) {
                const scope = templateData.departmentId ? 'department' : 'enterprise';
                return sendError(res, 409, `A template with name "${updates.name}" already exists for this ${scope}`);
            }
        }

        // Update template
        await templateRef.update(updates);

        // Get updated template
        const updatedTemplate = await templateRef.get();
        const responseData = {
            id: templateId,
            ...updatedTemplate.data(),
            createdAt: updatedTemplate.data().createdAt?.toDate().toISOString(),
            updatedAt: updatedTemplate.data().updatedAt?.toDate().toISOString()
        };

        console.log(`Template updated: ${templateId} by ${permissionCheck.userRole} ${userId}`);

        res.status(200).json({
            success: true,
            message: 'Template updated successfully',
            data: responseData
        });

    } catch (error) {
        sendError(res, 500, 'Error updating template', error);
    }
};

/**
 * Delete a template (soft delete by setting isActive to false)
 * DELETE /api/templates/:templateId
 */
exports.deleteTemplate = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { templateId } = req.params;

        if (!templateId) {
            return sendError(res, 400, 'Template ID is required');
        }

        // Get existing template
        const templateRef = db.collection('cardTemplates').doc(templateId);
        const templateDoc = await templateRef.get();

        if (!templateDoc.exists) {
            return sendError(res, 404, 'Template not found');
        }

        const templateData = templateDoc.data();

        // Check permissions
        const permissionCheck = await checkTemplatePermissions(
            userId, 
            templateData.enterpriseId, 
            templateData.departmentId, 
            'delete'
        );
        if (!permissionCheck.allowed) {
            return sendError(res, 403, permissionCheck.reason);
        }

        // Soft delete by setting isActive to false
        await templateRef.update({
            isActive: false,
            deletedAt: admin.firestore.Timestamp.now(),
            deletedBy: userId,
            updatedAt: admin.firestore.Timestamp.now()
        });

        console.log(`Template deleted: ${templateId} by ${permissionCheck.userRole} ${userId}`);

        res.status(200).json({
            success: true,
            message: 'Template deleted successfully'
        });

    } catch (error) {
        sendError(res, 500, 'Error deleting template', error);
    }
};

/**
 * Get a specific template by ID
 * GET /api/templates/template/:templateId
 */
exports.getTemplate = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { templateId } = req.params;

        if (!templateId) {
            return sendError(res, 400, 'Template ID is required');
        }

        // Get template
        const templateRef = db.collection('cardTemplates').doc(templateId);
        const templateDoc = await templateRef.get();

        if (!templateDoc.exists) {
            return sendError(res, 404, 'Template not found');
        }

        const templateData = templateDoc.data();

        // Check permissions
        const permissionCheck = await checkTemplatePermissions(
            userId, 
            templateData.enterpriseId, 
            templateData.departmentId, 
            'read'
        );
        if (!permissionCheck.allowed) {
            return sendError(res, 403, 'Access denied to this template');
        }

        const responseData = {
            id: templateId,
            ...templateData,
            createdAt: templateData.createdAt?.toDate().toISOString(),
            updatedAt: templateData.updatedAt?.toDate().toISOString(),
            deletedAt: templateData.deletedAt?.toDate().toISOString()
        };

        res.status(200).json({
            success: true,
            data: responseData
        });

    } catch (error) {
        sendError(res, 500, 'Error fetching template', error);
    }
};

/**
 * Get effective template for a department (with inheritance)
 * Department template overrides enterprise template
 * GET /api/templates/:enterpriseId/:departmentId/effective
 */
exports.getEffectiveTemplate = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { enterpriseId, departmentId } = req.params;

        if (!enterpriseId || !departmentId) {
            return sendError(res, 400, 'Enterprise ID and Department ID are required');
        }

        // Check permissions - user must have access to this department
        const permissionCheck = await checkTemplatePermissions(userId, enterpriseId, departmentId, 'read');
        if (!permissionCheck.allowed) {
            return sendError(res, 403, 'Access denied to department templates');
        }

        // Get department-specific template first (highest priority)
        const departmentTemplatesQuery = await db.collection('cardTemplates')
            .where('enterpriseId', '==', enterpriseId)
            .where('departmentId', '==', departmentId)
            .where('isActive', '==', true)
            // .orderBy('updatedAt', 'desc')  // Temporarily disabled for index
            .limit(1)
            .get();

        let effectiveTemplate = null;
        let templateSource = null;

        if (!departmentTemplatesQuery.empty) {
            // Use department template
            const departmentTemplate = departmentTemplatesQuery.docs[0];
            effectiveTemplate = {
                id: departmentTemplate.id,
                ...departmentTemplate.data(),
                createdAt: departmentTemplate.data().createdAt?.toDate().toISOString(),
                updatedAt: departmentTemplate.data().updatedAt?.toDate().toISOString()
            };
            templateSource = 'department';
        } else {
            // Fall back to enterprise template
            const enterpriseTemplatesQuery = await db.collection('cardTemplates')
                .where('enterpriseId', '==', enterpriseId)
                .where('departmentId', '==', null)
                .where('isActive', '==', true)
                // .orderBy('updatedAt', 'desc')  // Temporarily disabled for index
                .limit(1)
                .get();

            if (!enterpriseTemplatesQuery.empty) {
                const enterpriseTemplate = enterpriseTemplatesQuery.docs[0];
                effectiveTemplate = {
                    id: enterpriseTemplate.id,
                    ...enterpriseTemplate.data(),
                    createdAt: enterpriseTemplate.data().createdAt?.toDate().toISOString(),
                    updatedAt: enterpriseTemplate.data().updatedAt?.toDate().toISOString()
                };
                templateSource = 'enterprise';
            }
        }

        if (!effectiveTemplate) {
            return res.status(200).json({
                success: true,
                data: null,
                message: 'No templates found for this department or enterprise',
                fallback: {
                    colorScheme: '#1B2B5B',
                    companyLogo: null
                }
            });
        }

        res.status(200).json({
            success: true,
            data: {
                template: effectiveTemplate,
                source: templateSource,
                inheritance: templateSource === 'department' 
                    ? 'Department template overrides enterprise template'
                    : 'Using enterprise template (no department template found)'
            }
        });

    } catch (error) {
        sendError(res, 500, 'Error fetching effective template', error);
    }
};

/**
 * Preview template - returns what a card would look like with this template
 * GET /api/templates/template/:templateId/preview
 */
exports.previewTemplate = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { templateId } = req.params;
        const { 
            employeeName = 'John Doe',
            employeeEmail = 'john.doe@company.com',
            employeeTitle = 'Employee',
            employeePhone = '+1234567890'
        } = req.query;

        if (!templateId) {
            return sendError(res, 400, 'Template ID is required');
        }

        // Get template
        const templateRef = db.collection('cardTemplates').doc(templateId);
        const templateDoc = await templateRef.get();

        if (!templateDoc.exists) {
            return sendError(res, 404, 'Template not found');
        }

        const templateData = templateDoc.data();

        // Check permissions
        const permissionCheck = await checkTemplatePermissions(
            userId, 
            templateData.enterpriseId, 
            templateData.departmentId, 
            'read'
        );
        if (!permissionCheck.allowed) {
            return sendError(res, 403, 'Access denied to this template');
        }

        // Get enterprise data for company name
        const enterpriseRef = db.collection('enterprise').doc(templateData.enterpriseId);
        const enterpriseDoc = await enterpriseRef.get();
        const enterpriseData = enterpriseDoc.exists ? enterpriseDoc.data() : {};

        // Create preview card data
        const previewCard = {
            name: employeeName.split(' ')[0] || 'John',
            surname: employeeName.split(' ').slice(1).join(' ') || 'Doe',
            email: employeeEmail,
            phone: employeePhone,
            occupation: employeeTitle,
            company: enterpriseData.name || 'Company Name',
            profileImage: null, // Preview doesn't include actual profile images
            companyLogo: templateData.companyLogo || enterpriseData.logoUrl || null,
            socials: {},
            colorScheme: templateData.colorScheme,
            // Template metadata for preview
            templateId: templateId,
            templateName: templateData.name,
            templateSource: templateData.departmentId ? 'department' : 'enterprise',
            createdAt: new Date().toISOString()
        };

        res.status(200).json({
            success: true,
            data: {
                template: {
                    id: templateId,
                    name: templateData.name,
                    description: templateData.description,
                    colorScheme: templateData.colorScheme,
                    companyLogo: templateData.companyLogo,
                    source: templateData.departmentId ? 'department' : 'enterprise'
                },
                previewCard,
                enterprise: {
                    id: templateData.enterpriseId,
                    name: enterpriseData.name || 'Company Name',
                    logoUrl: enterpriseData.logoUrl
                }
            }
        });

    } catch (error) {
        sendError(res, 500, 'Error generating template preview', error);
    }
};

/**
 * Helper function to get effective template for employee card creation
 * This is used internally by the employee creation process
 */
exports.getEffectiveTemplateForCardCreation = async (enterpriseId, departmentId) => {
    try {
        // Get department-specific template first (highest priority)
        const departmentTemplatesQuery = await db.collection('cardTemplates')
            .where('enterpriseId', '==', enterpriseId)
            .where('departmentId', '==', departmentId)
            .where('isActive', '==', true)
            // .orderBy('updatedAt', 'desc')  // Temporarily disabled for index
            .limit(1)
            .get();

        if (!departmentTemplatesQuery.empty) {
            // Use department template
            const departmentTemplate = departmentTemplatesQuery.docs[0].data();
            return {
                colorScheme: departmentTemplate.colorScheme,
                companyLogo: departmentTemplate.companyLogo,
                templateId: departmentTemplatesQuery.docs[0].id,
                templateName: departmentTemplate.name,
                source: 'department'
            };
        }

        // Fall back to enterprise template
        const enterpriseTemplatesQuery = await db.collection('cardTemplates')
            .where('enterpriseId', '==', enterpriseId)
            .where('departmentId', '==', null)
            .where('isActive', '==', true)
            // .orderBy('updatedAt', 'desc')  // Temporarily disabled for index
            .limit(1)
            .get();

        if (!enterpriseTemplatesQuery.empty) {
            const enterpriseTemplate = enterpriseTemplatesQuery.docs[0].data();
            return {
                colorScheme: enterpriseTemplate.colorScheme,
                companyLogo: enterpriseTemplate.companyLogo,
                templateId: enterpriseTemplatesQuery.docs[0].id,
                templateName: enterpriseTemplate.name,
                source: 'enterprise'
            };
        }

        // No templates found, return defaults
        return {
            colorScheme: '#1B2B5B',
            companyLogo: null,
            templateId: null,
            templateName: null,
            source: 'default'
        };

    } catch (error) {
        console.error('Error getting effective template for card creation:', error);
        // Return defaults on error
        return {
            colorScheme: '#1B2B5B',
            companyLogo: null,
            templateId: null,
            templateName: null,
            source: 'default'
        };
    }
};

module.exports = exports;