const { db, admin } = require('../../firebase.js');

// In-memory cache with TTL
class ContactCache {    constructor() {
        this.cache = new Map();
        this.warmingFlags = new Map(); // Prevent duplicate calculations
        this.defaultTTL = 60 * 60 * 1000; // 1 hour in milliseconds
        this.maxCacheSize = 1000; // PHASE 4: Maximum cache entries
        this.hitCount = 0; // PHASE 4: Performance metrics
        this.missCount = 0;
        this.lastCleanup = null; // PHASE 6: Track cleanup times
        
        // PHASE 6: Configurable TTL settings
        this.ttlSettings = {
            enterprise: 60 * 60 * 1000,      // 1 hour for enterprise data
            department: 30 * 60 * 1000,      // 30 minutes for department data
            highActivity: 15 * 60 * 1000,    // 15 minutes for high-activity enterprises
            lowActivity: 2 * 60 * 60 * 1000  // 2 hours for low-activity enterprises
        };
        
        // Cleanup expired entries every 10 minutes
        setInterval(() => {
            this.cleanup();
        }, 10 * 60 * 1000);
        
        // PHASE 4: Memory monitoring every 5 minutes
        setInterval(() => {
            this.checkMemoryUsage();
        }, 5 * 60 * 1000);
    }

    generateKey(enterpriseId, departmentId = null) {
        if (departmentId) {
            return `enterprise:${enterpriseId}:department:${departmentId}:contacts`;
        }
        return `enterprise:${enterpriseId}:contacts`;
    }    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.missCount++; // PHASE 4: Track misses
            return null;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.missCount++; // PHASE 4: Track misses
            return null;
        }

        this.hitCount++; // PHASE 4: Track hits
        entry.accessCount++; // PHASE 6: Track access frequency
        entry.lastAccessed = Date.now(); // PHASE 6: Update last access time
        return entry.data;
    }set(key, data, ttl = this.defaultTTL) {
        // PHASE 4: Enforce cache size limits
        if (this.cache.size >= this.maxCacheSize) {
            this.evictOldestEntries(Math.floor(this.maxCacheSize * 0.1)); // Remove 10% of entries
        }
        
        // PHASE 6: Smart TTL selection based on data type
        let smartTTL = ttl;
        if (key.includes('department:')) {
            smartTTL = this.ttlSettings.department;
        } else if (key.includes('enterprise:')) {
            smartTTL = this.ttlSettings.enterprise;
        }
        
        this.cache.set(key, {
            data,
            createdAt: Date.now(),
            expiresAt: Date.now() + smartTTL,
            accessCount: 0, // PHASE 4: Track access frequency
            lastAccessed: Date.now() // PHASE 6: Track last access
        });
    }

    invalidate(key) {
        this.cache.delete(key);
        console.log(`Cache invalidated: ${key}`);
    }

    invalidateByPattern(pattern) {
        const keys = Array.from(this.cache.keys());
        const matchingKeys = keys.filter(key => key.includes(pattern));
        
        matchingKeys.forEach(key => {
            this.cache.delete(key);
        });
        
        console.log(`Cache invalidated by pattern "${pattern}": ${matchingKeys.length} entries`);
        return matchingKeys.length;
    }

    setWarmingFlag(key) {
        this.warmingFlags.set(key, Date.now());
    }

    isWarming(key) {
        const warmingTime = this.warmingFlags.get(key);
        if (!warmingTime) return false;

        // Consider warming expired after 30 seconds (prevent infinite warming)
        if (Date.now() - warmingTime > 30 * 1000) {
            this.warmingFlags.delete(key);
            return false;
        }

        return true;
    }

    clearWarmingFlag(key) {
        this.warmingFlags.delete(key);
    }    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        // Clean expired cache entries
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        // Clean expired warming flags
        for (const [key, warmingTime] of this.warmingFlags.entries()) {
            if (now - warmingTime > 30 * 1000) {
                this.warmingFlags.delete(key);
            }
        }

        this.lastCleanup = new Date().toISOString(); // PHASE 6: Track cleanup time

        if (cleaned > 0) {
            console.log(`Cache cleanup: removed ${cleaned} expired entries at ${this.lastCleanup}`);
        }
    }// PHASE 4: Memory management methods
    evictOldestEntries(count) {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].createdAt - b[1].createdAt); // Sort by creation time
        
        for (let i = 0; i < count && i < entries.length; i++) {
            this.cache.delete(entries[i][0]);
        }
        
        console.log(`Evicted ${count} oldest cache entries to manage memory`);
    }
    
    checkMemoryUsage() {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        
        // If heap usage > 500MB, aggressively clean cache
        if (heapUsedMB > 500) {
            console.log(`High memory usage detected (${heapUsedMB.toFixed(2)}MB), cleaning cache`);
            this.evictOldestEntries(Math.floor(this.cache.size * 0.5)); // Remove 50% of entries
        }
    }    getStats() {
        const memUsage = process.memoryUsage();
        const now = Date.now();
        
        // PHASE 6: Enhanced performance metrics
        const cacheEntries = Array.from(this.cache.entries());
        const avgAge = cacheEntries.length > 0 
            ? cacheEntries.reduce((sum, [, entry]) => sum + (now - entry.createdAt), 0) / cacheEntries.length / 1000
            : 0;
        
        const expiringSoon = cacheEntries.filter(([, entry]) => entry.expiresAt - now < 5 * 60 * 1000).length;
        
        return {
            // Basic stats
            totalEntries: this.cache.size,
            warmingFlags: this.warmingFlags.size,
            maxCacheSize: this.maxCacheSize,
            
            // Performance metrics
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate: this.hitCount + this.missCount > 0 ? (this.hitCount / (this.hitCount + this.missCount) * 100).toFixed(2) + '%' : '0%',
            
            // PHASE 6: Advanced metrics
            avgCacheAge: avgAge.toFixed(2) + 's',
            entriesExpiringSoon: expiringSoon,
            cacheEfficiency: this.hitCount > 0 ? ((this.hitCount / (this.hitCount + this.missCount)) * 100).toFixed(1) + '%' : '0%',
            
            // Memory usage
            memoryUsage: {
                heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
                heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
                external: (memUsage.external / 1024 / 1024).toFixed(2) + 'MB',
                rss: (memUsage.rss / 1024 / 1024).toFixed(2) + 'MB'
            },
            
            // Operational metrics
            lastCleanup: this.lastCleanup || 'Never',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    }
}

// Global cache instance
const contactCache = new ContactCache();

// Helper function for standardized error responses
const sendError = (res, status, message, error = null) => {
    console.error(`${message}:`, error);
    res.status(status).send({ 
        success: false,
        message,
        ...(error && { error: error.message })
    });
};

/**
 * Get enterprise contacts summary with caching
 */
exports.getEnterpriseContactsSummary = async (req, res) => {
    try {
        const { enterpriseId } = req.params;
        
        if (!enterpriseId) {
            return sendError(res, 400, 'Enterprise ID is required');
        }

        const cacheKey = contactCache.generateKey(enterpriseId);
        
        // Check cache first
        const cachedData = contactCache.get(cacheKey);
        if (cachedData) {
            console.log(`Cache HIT for enterprise ${enterpriseId}`);
            return res.status(200).send({
                success: true,
                data: cachedData,
                cached: true,
                timestamp: new Date().toISOString()
            });
        }        // Check if another request is already warming this cache
        if (contactCache.isWarming(cacheKey)) {
            console.log(`Cache WARMING for enterprise ${enterpriseId}, waiting...`);
            
            // PHASE 4: Enhanced concurrent request protection
            let retryCount = 0;
            const maxRetries = 30; // Wait up to 3 seconds (100ms * 30)
            
            while (retryCount < maxRetries && contactCache.isWarming(cacheKey)) {
                await new Promise(resolve => setTimeout(resolve, 100));
                retryCount++;
                
                // Check if cache was populated during wait
                const warmedData = contactCache.get(cacheKey);
                if (warmedData) {
                    console.log(`Cache warmed after ${retryCount * 100}ms wait for enterprise ${enterpriseId}`);
                    return res.status(200).send({
                        success: true,
                        data: warmedData,
                        cached: true,
                        warmed: true,
                        waitTime: retryCount * 100,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // If still warming after max wait, proceed with own calculation
            if (contactCache.isWarming(cacheKey)) {
                console.log(`Cache warming timeout for enterprise ${enterpriseId}, proceeding with own calculation`);
            }
        }

        console.log(`Cache MISS for enterprise ${enterpriseId}, calculating...`);
        
        // Set warming flag
        contactCache.setWarmingFlag(cacheKey);

        try {
            // Perform expensive calculation
            const summary = await calculateEnterpriseContactsSummary(enterpriseId);
            
            // Cache the result
            contactCache.set(cacheKey, summary);
            
            // Clear warming flag
            contactCache.clearWarmingFlag(cacheKey);
            
            res.status(200).send({
                success: true,
                data: summary,
                cached: false,
                timestamp: new Date().toISOString()
            });
              } catch (calculationError) {
            // Clear warming flag on error
            contactCache.clearWarmingFlag(cacheKey);
            
            // PHASE 4: Enhanced error handling with fallback
            console.error(`Calculation error for enterprise ${enterpriseId}:`, calculationError);
            
            // Try to return stale cached data if available
            const staleData = contactCache.cache.get(cacheKey);
            if (staleData && staleData.data) {
                console.log(`Returning stale cached data for enterprise ${enterpriseId} due to calculation error`);
                return res.status(200).send({
                    success: true,
                    data: staleData.data,
                    cached: true,
                    stale: true,
                    error: 'Calculation failed, returned cached data',
                    timestamp: new Date().toISOString(),
                    cacheAge: Date.now() - staleData.createdAt
                });
            }
            
            throw calculationError;
        }

    } catch (error) {
        console.error('Error getting enterprise contacts summary:', error);
        
        // PHASE 4: Final error handling with graceful degradation
        const errorResponse = {
            success: false,
            message: 'Error retrieving enterprise contacts summary',
            error: error.message,
            enterpriseId,
            timestamp: new Date().toISOString(),
            fallback: {
                available: false,
                message: 'No cached data available for fallback'
            }
        };
        
        res.status(500).send(errorResponse);
    }
};

/**
 * Get department contacts summary with caching
 */
exports.getDepartmentContactsSummary = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        
        if (!enterpriseId || !departmentId) {
            return sendError(res, 400, 'Enterprise ID and Department ID are required');
        }

        const cacheKey = contactCache.generateKey(enterpriseId, departmentId);
        
        // Check cache first
        const cachedData = contactCache.get(cacheKey);
        if (cachedData) {
            console.log(`Cache HIT for department ${departmentId} in enterprise ${enterpriseId}`);
            return res.status(200).send({
                success: true,
                data: cachedData,
                cached: true,
                timestamp: new Date().toISOString()
            });
        }

        console.log(`Cache MISS for department ${departmentId} in enterprise ${enterpriseId}, calculating...`);
        
        // Set warming flag
        contactCache.setWarmingFlag(cacheKey);

        try {
            // Perform expensive calculation
            const summary = await calculateDepartmentContactsSummary(enterpriseId, departmentId);
            
            // Cache the result
            contactCache.set(cacheKey, summary);
            
            // Clear warming flag
            contactCache.clearWarmingFlag(cacheKey);
            
            res.status(200).send({
                success: true,
                data: summary,
                cached: false,
                timestamp: new Date().toISOString()
            });
            
        } catch (calculationError) {
            // Clear warming flag on error
            contactCache.clearWarmingFlag(cacheKey);
            throw calculationError;
        }

    } catch (error) {
        console.error('Error getting department contacts summary:', error);
        sendError(res, 500, 'Error retrieving department contacts summary', error);
    }
};

/**
 * Get enterprise contacts with detailed information (not just summaries)
 */
exports.getEnterpriseContactsWithDetails = async (req, res) => {
    try {
        const { enterpriseId } = req.params;
        const { 
            includeMetadata = 'true',
            sortBy = 'employeeName',
            sortOrder = 'asc',
            limit,
            offset = 0 
        } = req.query;

        if (!enterpriseId) {
            return sendError(res, 400, 'Enterprise ID is required');
        }

        // Create cache key for detailed contacts
        const cacheKey = `${contactCache.generateKey(enterpriseId)}:details:${sortBy}:${sortOrder}:${limit || 'all'}:${offset}`;
        
        // Try to get from cache first
        const cachedData = contactCache.get(cacheKey);
        if (cachedData) {
            console.log(`✅ Cache HIT for enterprise ${enterpriseId} contact details`);
            return res.status(200).send({
                success: true,
                ...cachedData,
                cached: true,
                cacheTimestamp: new Date().toISOString()
            });
        }

        console.log(`⏳ Cache MISS - Fetching detailed contacts for enterprise ${enterpriseId}`);
        const startTime = performance.now();

        // Check if enterprise exists
        const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
        const enterpriseDoc = await enterpriseRef.get();
        
        if (!enterpriseDoc.exists) {
            return sendError(res, 404, 'Enterprise not found');
        }

        // Get all departments in the enterprise
        const departmentsSnapshot = await enterpriseRef.collection('departments').get();
        
        if (departmentsSnapshot.empty) {
            const emptyResult = {
                contacts: [],
                totalContacts: 0,
                totalEmployees: 0,
                departments: [],
                metadata: includeMetadata === 'true' ? {
                    calculationTime: '0ms',
                    enterpriseId,
                    timestamp: new Date().toISOString()
                } : undefined
            };
            
            // Cache the empty result
            contactCache.set(cacheKey, emptyResult);
            
            return res.status(200).send({
                success: true,
                ...emptyResult,
                cached: false
            });
        }

        // Collect all contact details across departments
        const allContacts = [];
        const departmentSummaries = [];
        let totalEmployees = 0;

        for (const deptDoc of departmentsSnapshot.docs) {
            const deptData = deptDoc.data();
            const departmentId = deptDoc.id;
            
            // Get all employees in this department
            const employeesSnapshot = await deptDoc.ref.collection('employees').get();
            const departmentEmployees = [];
            const departmentContacts = [];
            
            for (const empDoc of employeesSnapshot.docs) {
                const empData = empDoc.data();
                totalEmployees++;
                
                const employee = {
                    userId: empData.userId?.id || empDoc.id,
                    employeeId: empDoc.id,
                    name: `${empData.firstName || empData.name || ''} ${empData.lastName || empData.surname || ''}`.trim(),
                    firstName: empData.firstName || empData.name || '',
                    lastName: empData.lastName || empData.surname || '',
                    email: empData.email || '',
                    phone: empData.phone || '',
                    position: empData.position || empData.title || '',
                    role: empData.role || 'employee',
                    departmentId,
                    departmentName: deptData.name || '',
                    isActive: empData.isActive !== false,
                    contacts: []
                };

                // Fetch contacts for this employee
                if (empData.userId) {
                    try {
                        const contactsRef = db.collection('contacts').doc(empData.userId.id);
                        const contactsDoc = await contactsRef.get();
                        
                        if (contactsDoc.exists && contactsDoc.data().contactList) {
                            const contactList = contactsDoc.data().contactList || [];
                            
                            // Format each contact with full details
                            const formattedContacts = contactList.map((contact, index) => ({
                                contactId: `${empData.userId.id}_${index}`,
                                name: contact.name || '',
                                surname: contact.surname || '',
                                fullName: `${contact.name || ''} ${contact.surname || ''}`.trim(),
                                email: contact.email || '',
                                phone: contact.phone || '',
                                company: contact.company || '',
                                position: contact.position || contact.title || '',
                                website: contact.website || '',
                                linkedin: contact.linkedin || '',
                                twitter: contact.twitter || '',
                                instagram: contact.instagram || '',
                                address: contact.address || '',
                                notes: contact.notes || '',
                                tags: contact.tags || [],
                                createdAt: contact.createdAt ? 
                                    (contact.createdAt.toDate ? contact.createdAt.toDate().toISOString() : 
                                        contact.createdAt._seconds ? new Date(contact.createdAt._seconds * 1000).toISOString() : 
                                            contact.createdAt) : null,
                                // Employee context
                                addedByEmployee: employee.name,
                                addedByEmployeeId: employee.employeeId,
                                addedByDepartment: employee.departmentName
                            }));
                            
                            employee.contacts = formattedContacts;
                            employee.contactCount = formattedContacts.length;
                            
                            // Add to department and enterprise collections
                            departmentContacts.push(...formattedContacts);
                            allContacts.push(...formattedContacts);
                        } else {
                            employee.contactCount = 0;
                        }
                    } catch (contactError) {
                        console.error(`Error fetching contacts for employee ${empDoc.id}:`, contactError);
                        employee.contactCount = 0;
                    }
                }

                departmentEmployees.push(employee);
            }

            // Add department summary
            departmentSummaries.push({
                departmentId,
                departmentName: deptData.name || '',
                totalContacts: departmentContacts.length,
                totalEmployees: departmentEmployees.length,
                employees: departmentEmployees,
                contacts: departmentContacts
            });
        }

        // Apply sorting to all contacts
        if (sortBy) {
            allContacts.sort((a, b) => {
                let aValue = '';
                let bValue = '';
                
                switch (sortBy) {
                    case 'contactName':
                        aValue = a.fullName.toLowerCase();
                        bValue = b.fullName.toLowerCase();
                        break;
                    case 'employeeName':
                        aValue = a.addedByEmployee.toLowerCase();
                        bValue = b.addedByEmployee.toLowerCase();
                        break;
                    case 'department':
                        aValue = a.addedByDepartment.toLowerCase();
                        bValue = b.addedByDepartment.toLowerCase();
                        break;
                    case 'email':
                        aValue = a.email.toLowerCase();
                        bValue = b.email.toLowerCase();
                        break;
                    case 'company':
                        aValue = a.company.toLowerCase();
                        bValue = b.company.toLowerCase();
                        break;
                    case 'createdAt':
                        aValue = new Date(a.createdAt || 0);
                        bValue = new Date(b.createdAt || 0);
                        break;
                    default:
                        aValue = a.fullName.toLowerCase();
                        bValue = b.fullName.toLowerCase();
                }
                
                if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            });
        }

        // Apply pagination if specified
        let paginatedContacts = allContacts;
        if (limit) {
            const startIndex = parseInt(offset) || 0;
            const endIndex = startIndex + parseInt(limit);
            paginatedContacts = allContacts.slice(startIndex, endIndex);
        }

        const endTime = performance.now();
        const calculationTime = `${(endTime - startTime).toFixed(2)}ms`;

        // Prepare response data
        const responseData = {
            contacts: paginatedContacts,
            totalContacts: allContacts.length,
            totalEmployees,
            departments: departmentSummaries,
            pagination: limit ? {
                total: allContacts.length,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + parseInt(limit)) < allContacts.length
            } : undefined,
            metadata: includeMetadata === 'true' ? {
                calculationTime,
                enterpriseId,
                timestamp: new Date().toISOString(),
                sortBy,
                sortOrder
            } : undefined
        };

        // Cache the result
        contactCache.set(cacheKey, responseData);
        
        console.log(`✅ Enterprise ${enterpriseId} contact details calculated and cached in ${calculationTime}`);

        res.status(200).send({
            success: true,
            ...responseData,
            cached: false
        });

    } catch (error) {
        console.error('Error fetching enterprise contacts with details:', error);
        sendError(res, 500, 'Error fetching enterprise contact details', error);
    }
};

/**
 * Get department contacts with full details (cached)
 * Returns complete contact information for a specific department
 */
exports.getDepartmentContactsWithDetails = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        const { 
            includeMetadata = 'true',
            sortBy = 'employeeName',
            sortOrder = 'asc',
            limit,
            offset = 0 
        } = req.query;

        if (!enterpriseId || !departmentId) {
            return sendError(res, 400, 'Enterprise ID and Department ID are required');
        }

        // Create cache key for detailed department contacts
        const cacheKey = `${contactCache.generateKey(enterpriseId, departmentId)}:details:${sortBy}:${sortOrder}:${limit || 'all'}:${offset}`;
        
        // Try to get from cache first
        const cachedData = contactCache.get(cacheKey);
        if (cachedData) {
            console.log(`✅ Cache HIT for department ${departmentId} contact details`);
            return res.status(200).send({
                success: true,
                ...cachedData,
                cached: true,
                cacheTimestamp: new Date().toISOString()
            });
        }

        console.log(`⏳ Cache MISS - Fetching detailed contacts for department ${departmentId}`);
        const startTime = performance.now();

        // Check if department exists
        const departmentRef = db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId);
        
        const departmentDoc = await departmentRef.get();
        if (!departmentDoc.exists) {
            return sendError(res, 404, 'Department not found');
        }

        const deptData = departmentDoc.data();
        
        // Get all employees in this department
        const employeesSnapshot = await departmentRef.collection('employees').get();
        
        if (employeesSnapshot.empty) {
            const emptyResult = {
                contacts: [],
                totalContacts: 0,
                totalEmployees: 0,
                departmentId,
                departmentName: deptData.name || '',
                employees: [],
                metadata: includeMetadata === 'true' ? {
                    calculationTime: '0ms',
                    enterpriseId,
                    departmentId,
                    timestamp: new Date().toISOString()
                } : undefined
            };
            
            // Cache the empty result
            contactCache.set(cacheKey, emptyResult);
            
            return res.status(200).send({
                success: true,
                ...emptyResult,
                cached: false
            });
        }

        const allContacts = [];
        const employees = [];
        let totalEmployees = 0;

        for (const empDoc of employeesSnapshot.docs) {
            const empData = empDoc.data();
            totalEmployees++;
            
            const employee = {
                userId: empData.userId?.id || empDoc.id,
                employeeId: empDoc.id,
                name: `${empData.firstName || empData.name || ''} ${empData.lastName || empData.surname || ''}`.trim(),
                firstName: empData.firstName || empData.name || '',
                lastName: empData.lastName || empData.surname || '',
                email: empData.email || '',
                phone: empData.phone || '',
                position: empData.position || empData.title || '',
                role: empData.role || 'employee',
                departmentId,
                departmentName: deptData.name || '',
                isActive: empData.isActive !== false,
                contacts: []
            };

            // Fetch contacts for this employee
            if (empData.userId) {
                try {
                    const contactsRef = db.collection('contacts').doc(empData.userId.id);
                    const contactsDoc = await contactsRef.get();
                    
                    if (contactsDoc.exists && contactsDoc.data().contactList) {
                        const contactList = contactsDoc.data().contactList || [];
                        
                        // Format each contact with full details
                        const formattedContacts = contactList.map((contact, index) => ({
                            contactId: `${empData.userId.id}_${index}`,
                            name: contact.name || '',
                            surname: contact.surname || '',
                            fullName: `${contact.name || ''} ${contact.surname || ''}`.trim(),
                            email: contact.email || '',
                            phone: contact.phone || '',
                            company: contact.company || '',
                            position: contact.position || contact.title || '',
                            website: contact.website || '',
                            linkedin: contact.linkedin || '',
                            twitter: contact.twitter || '',
                            instagram: contact.instagram || '',
                            address: contact.address || '',
                            notes: contact.notes || '',
                            tags: contact.tags || [],
                            createdAt: contact.createdAt ? 
                                (contact.createdAt.toDate ? contact.createdAt.toDate().toISOString() : 
                                    contact.createdAt._seconds ? new Date(contact.createdAt._seconds * 1000).toISOString() : 
                                        contact.createdAt) : null,
                            // Employee context
                            addedByEmployee: employee.name,
                            addedByEmployeeId: employee.employeeId,
                            addedByDepartment: employee.departmentName
                        }));
                        
                        employee.contacts = formattedContacts;
                        employee.contactCount = formattedContacts.length;
                        allContacts.push(...formattedContacts);
                    } else {
                        employee.contactCount = 0;
                    }
                } catch (contactError) {
                    console.error(`Error fetching contacts for employee ${empDoc.id}:`, contactError);
                    employee.contactCount = 0;
                }
            }

            employees.push(employee);
        }

        // Apply sorting to all contacts
        if (sortBy) {
            allContacts.sort((a, b) => {
                let aValue = '';
                let bValue = '';
                
                switch (sortBy) {
                    case 'contactName':
                        aValue = a.fullName.toLowerCase();
                        bValue = b.fullName.toLowerCase();
                        break;
                    case 'employeeName':
                        aValue = a.addedByEmployee.toLowerCase();
                        bValue = b.addedByEmployee.toLowerCase();
                        break;
                    case 'email':
                        aValue = a.email.toLowerCase();
                        bValue = b.email.toLowerCase();
                        break;
                    case 'company':
                        aValue = a.company.toLowerCase();
                        bValue = b.company.toLowerCase();
                        break;
                    case 'createdAt':
                        aValue = new Date(a.createdAt || 0);
                        bValue = new Date(b.createdAt || 0);
                        break;
                    default:
                        aValue = a.fullName.toLowerCase();
                        bValue = b.fullName.toLowerCase();
                }
                
                if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            });
        }

        // Apply pagination if specified
        let paginatedContacts = allContacts;
        if (limit) {
            const startIndex = parseInt(offset) || 0;
            const endIndex = startIndex + parseInt(limit);
            paginatedContacts = allContacts.slice(startIndex, endIndex);
        }

        const endTime = performance.now();
        const calculationTime = `${(endTime - startTime).toFixed(2)}ms`;

        // Prepare response data
        const responseData = {
            contacts: paginatedContacts,
            totalContacts: allContacts.length,
            totalEmployees,
            departmentId,
            departmentName: deptData.name || '',
            employees,
            pagination: limit ? {
                total: allContacts.length,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + parseInt(limit)) < allContacts.length
            } : undefined,
            metadata: includeMetadata === 'true' ? {
                calculationTime,
                enterpriseId,
                departmentId,
                timestamp: new Date().toISOString(),
                sortBy,
                sortOrder
            } : undefined
        };

        // Cache the result
        contactCache.set(cacheKey, responseData);
        
        console.log(`✅ Department ${departmentId} contact details calculated and cached in ${calculationTime}`);

        res.status(200).send({
            success: true,
            ...responseData,
            cached: false
        });

    } catch (error) {
        console.error('Error fetching department contacts with details:', error);
        sendError(res, 500, 'Error fetching department contact details', error);
    }
};

/**
 * Expensive calculation: Get all contacts with details for an enterprise
 */
async function calculateEnterpriseContactsWithDetails(enterpriseId) {
    console.log(`Starting detailed contact calculation for enterprise ${enterpriseId}`);
    const startTime = Date.now();
    
    // Step 1: Verify enterprise exists
    const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
    const enterpriseDoc = await enterpriseRef.get();
    
    if (!enterpriseDoc.exists) {
        throw new Error('Enterprise not found');
    }

    // Step 2: Get all departments
    const departmentsSnapshot = await enterpriseRef.collection('departments').get();
    
    if (departmentsSnapshot.empty) {
        return {
            enterpriseId,
            enterpriseName: enterpriseDoc.data().name,
            totalContacts: 0,
            totalEmployees: 0,
            departments: [],
            calculationTime: Date.now() - startTime
        };
    }

    // Step 3: Get all employees and their detailed contacts
    const departmentDetails = [];
    let totalContacts = 0;
    let totalEmployees = 0;

    for (const deptDoc of departmentsSnapshot.docs) {
        const departmentId = deptDoc.id;
        
        const deptDetails = await calculateDepartmentContactsWithDetails(enterpriseId, departmentId);
        
        departmentDetails.push(deptDetails);
        totalContacts += deptDetails.totalContacts;
        totalEmployees += deptDetails.totalEmployees;
    }

    const result = {
        enterpriseId,
        enterpriseName: enterpriseDoc.data().name,
        totalContacts,
        totalEmployees,
        departments: departmentDetails,
        calculationTime: Date.now() - startTime
    };

    console.log(`Enterprise ${enterpriseId} detailed calculation completed in ${result.calculationTime}ms`);
    return result;
}

/**
 * Expensive calculation: Get all contacts with details for a department
 */
async function calculateDepartmentContactsWithDetails(enterpriseId, departmentId) {
    // Step 1: Get all employees in the department
    const employeesSnapshot = await db.collection('enterprise')
        .doc(enterpriseId)
        .collection('departments')
        .doc(departmentId)
        .collection('employees')
        .get();

    if (employeesSnapshot.empty) {
        return {
            departmentId,
            departmentName: 'Unknown',
            totalContacts: 0,
            totalEmployees: 0,
            employees: []
        };
    }

    // Step 2: Get department info
    const deptDoc = await db.collection('enterprise')
        .doc(enterpriseId)
        .collection('departments')
        .doc(departmentId)
        .get();

    const departmentName = deptDoc.exists ? deptDoc.data().name : 'Unknown';

    // Step 3: For each employee, get their detailed contacts
    const employeeDetails = [];
    let totalContacts = 0;

    for (const empDoc of employeesSnapshot.docs) {
        const employeeData = empDoc.data();
        
        // Get user ID from employee reference
        const userId = employeeData.userId ? employeeData.userId.id : null;
        
        let contacts = [];
        if (userId) {
            // Query contacts collection for this user
            const contactDoc = await db.collection('contacts').doc(userId).get();
            
            if (contactDoc.exists) {
                const contactList = contactDoc.data().contactList || [];
                
                // Format contact details (remove sensitive info if needed)
                contacts = contactList.map(contact => ({
                    name: contact.name || '',
                    surname: contact.surname || '',
                    email: contact.email || '',
                    phone: contact.phone || '',
                    howWeMet: contact.howWeMet || '',
                    createdAt: contact.createdAt ? 
                        (contact.createdAt.toDate ? contact.createdAt.toDate().toISOString() : 
                         contact.createdAt._seconds ? new Date(contact.createdAt._seconds * 1000).toISOString() : 
                         contact.createdAt) : null,
                    // Include location data if available
                    location: contact.location || null
                }));
            }
        }

        employeeDetails.push({
            employeeId: empDoc.id,
            userId,
            employeeName: `${employeeData.firstName || ''} ${employeeData.lastName || ''}`.trim(),
            employeeEmail: employeeData.email,
            employeeRole: employeeData.role,
            contactCount: contacts.length,
            contacts: contacts
        });

        totalContacts += contacts.length;
    }

    return {
        departmentId,
        departmentName,
        totalContacts,
        totalEmployees: employeesSnapshot.size,
        employees: employeeDetails
    };
}

/**
 * Invalidate cache for an enterprise (used when contacts are added/removed)
 */
exports.invalidateEnterpriseCache = (enterpriseId) => {
    if (!enterpriseId) return;
    
    // Invalidate enterprise-wide cache
    const enterpriseKey = contactCache.generateKey(enterpriseId);
    contactCache.invalidate(enterpriseKey);
    
    // Invalidate all department caches for this enterprise
    contactCache.invalidateByPattern(`enterprise:${enterpriseId}:department:`);
};

/**
 * Invalidate cache for a specific department
 */
exports.invalidateDepartmentCache = (enterpriseId, departmentId) => {
    if (!enterpriseId || !departmentId) return;
    
    // Invalidate department cache
    const deptKey = contactCache.generateKey(enterpriseId, departmentId);
    contactCache.invalidate(deptKey);
    
    // Also invalidate enterprise cache since department data changed
    const enterpriseKey = contactCache.generateKey(enterpriseId);
    contactCache.invalidate(enterpriseKey);
};

/**
 * Get cache statistics (for monitoring)
 */
exports.getCacheStats = (req, res) => {
    try {
        const stats = contactCache.getStats();
        res.status(200).send({
            success: true,
            cache: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        sendError(res, 500, 'Error retrieving cache statistics', error);
    }
};

/**
 * Clear all cache (for admin/debugging)
 */
exports.clearAllCache = (req, res) => {
    try {
        const beforeSize = contactCache.cache.size;
        contactCache.cache.clear();
        contactCache.warmingFlags.clear();
        
        res.status(200).send({
            success: true,
            message: `Cleared ${beforeSize} cache entries`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        sendError(res, 500, 'Error clearing cache', error);
    }
};

/**
 * PHASE 5.2: Batch Invalidation Functions
 */

/**
 * Invalidate all caches for multiple enterprises
 */
exports.invalidateMultipleEnterprises = (enterpriseIds) => {
    if (!Array.isArray(enterpriseIds)) return 0;
    
    let invalidatedCount = 0;
    enterpriseIds.forEach(enterpriseId => {
        if (enterpriseId) {
            invalidateEnterpriseCache(enterpriseId);
            invalidatedCount++;
        }
    });
    
    console.log(`Batch invalidated caches for ${invalidatedCount} enterprises`);
    return invalidatedCount;
};

/**
 * Invalidate all department caches across all enterprises
 */
exports.invalidateAllDepartmentCaches = (req, res) => {
    try {
        const invalidatedCount = contactCache.invalidateByPattern('department:');
        
        res.status(200).send({
            success: true,
            message: `Invalidated ${invalidatedCount} department cache entries`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        sendError(res, 500, 'Error invalidating department caches', error);
    }
};

/**
 * Smart cache warming - preload cache for active enterprises
 */
exports.warmCacheForEnterprises = async (req, res) => {
    try {
        const { enterpriseIds } = req.body;
        
        if (!Array.isArray(enterpriseIds)) {
            return sendError(res, 400, 'enterpriseIds must be an array');
        }
        
        const warmingResults = [];
        
        for (const enterpriseId of enterpriseIds) {
            try {
                const cacheKey = contactCache.generateKey(enterpriseId);
                
                // Only warm if not already cached
                if (!contactCache.get(cacheKey)) {
                    console.log(`Warming cache for enterprise ${enterpriseId}...`);
                    const startTime = Date.now();
                    
                    const summary = await calculateEnterpriseContactsSummary(enterpriseId);
                    contactCache.set(cacheKey, summary);
                    
                    warmingResults.push({
                        enterpriseId,
                        status: 'warmed',
                        duration: Date.now() - startTime
                    });
                } else {
                    warmingResults.push({
                        enterpriseId,
                        status: 'already_cached',
                        duration: 0
                    });
                }
            } catch (error) {
                warmingResults.push({
                    enterpriseId,
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        res.status(200).send({
            success: true,
            message: `Cache warming completed for ${enterpriseIds.length} enterprises`,
            results: warmingResults,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        sendError(res, 500, 'Error warming caches', error);
    }
};

/**
 * PHASE 6.2: TTL Configuration & Optimization
 */

/**
 * Update cache TTL settings
 */
exports.updateCacheConfig = (req, res) => {
    try {
        const { ttlSettings } = req.body;
        
        if (ttlSettings) {
            // Validate TTL values (must be positive numbers)
            for (const [key, value] of Object.entries(ttlSettings)) {
                if (typeof value !== 'number' || value <= 0) {
                    return sendError(res, 400, `Invalid TTL value for ${key}: must be a positive number`);
                }
            }
            
            // Update TTL settings
            contactCache.ttlSettings = { ...contactCache.ttlSettings, ...ttlSettings };
            
            console.log('Cache TTL settings updated:', contactCache.ttlSettings);
        }
        
        res.status(200).send({
            success: true,
            message: 'Cache configuration updated successfully',
            currentSettings: contactCache.ttlSettings,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        sendError(res, 500, 'Error updating cache configuration', error);
    }
};

/**
 * Get current cache configuration
 */
exports.getCacheConfig = (req, res) => {
    try {
        res.status(200).send({
            success: true,
            configuration: {
                ttlSettings: contactCache.ttlSettings,
                maxCacheSize: contactCache.maxCacheSize,
                defaultTTL: contactCache.defaultTTL
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        sendError(res, 500, 'Error retrieving cache configuration', error);
    }
};

/**
 * Advanced cache analytics
 */
exports.getCacheAnalytics = (req, res) => {
    try {
        const entries = Array.from(contactCache.cache.entries());
        const now = Date.now();
        
        // Analyze cache patterns
        const analytics = {
            // Basic metrics
            totalEntries: entries.length,
            hitRate: contactCache.hitCount + contactCache.missCount > 0 
                ? ((contactCache.hitCount / (contactCache.hitCount + contactCache.missCount)) * 100).toFixed(2) + '%' 
                : '0%',
            
            // Access patterns
            mostAccessedEntries: entries
                .sort((a, b) => (b[1].accessCount || 0) - (a[1].accessCount || 0))
                .slice(0, 5)
                .map(([key, entry]) => ({
                    key,
                    accessCount: entry.accessCount || 0,
                    age: ((now - entry.createdAt) / 1000 / 60).toFixed(1) + ' minutes'
                })),
            
            // TTL distribution
            ttlDistribution: {
                expiringSoon: entries.filter(([, entry]) => entry.expiresAt - now < 5 * 60 * 1000).length,
                expiring1Hour: entries.filter(([, entry]) => {
                    const timeLeft = entry.expiresAt - now;
                    return timeLeft >= 5 * 60 * 1000 && timeLeft < 60 * 60 * 1000;
                }).length,
                expiringLater: entries.filter(([, entry]) => entry.expiresAt - now >= 60 * 60 * 1000).length
            },
            
            // Performance metrics
            avgAccessCount: entries.length > 0 
                ? (entries.reduce((sum, [, entry]) => sum + (entry.accessCount || 0), 0) / entries.length).toFixed(2)
                : 0,
            
            timestamp: new Date().toISOString()
        };
        
        res.status(200).send({
            success: true,
            analytics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        sendError(res, 500, 'Error retrieving cache analytics', error);
    }
};

// Export cache instance for use in other modules
module.exports.contactCache = contactCache;

// ================================
// DETAILED CONTACT ENDPOINTS
// ================================

/**
 * Get all contacts for an enterprise with full contact details
 * This endpoint returns the actual contact information, not just summaries
 */
const getEnterpriseContactsWithDetails = async (req, res) => {
    try {
        const { enterpriseId } = req.params;
        
        // Validate enterprise ID
        if (!enterpriseId || enterpriseId.trim() === '') {
            return sendError(res, 400, 'Enterprise ID is required');
        }

        console.log(`🔍 Getting detailed contacts for enterprise: ${enterpriseId}`);
        
        // Check cache first (with details suffix to separate from summary cache)
        const cacheKey = `enterprise_${enterpriseId}_contacts_details`;
        const cachedData = contactCache.get(cacheKey);
          if (cachedData) {
            console.log(`✅ Cache hit for enterprise ${enterpriseId} detailed contacts`);
            contactCache.hitCount++;
            return res.status(200).send({
                success: true,
                cached: true,
                data: cachedData,
                timestamp: new Date().toISOString()
            });
        }

        console.log(`❌ Cache miss for enterprise ${enterpriseId} detailed contacts - calculating...`);
        contactCache.missCount++;        // Get enterprise document to find departments
        const enterpriseDoc = await admin.firestore()
            .collection('enterprise')
            .doc(enterpriseId)
            .get();

        if (!enterpriseDoc.exists) {
            return sendError(res, 404, 'Enterprise not found');
        }

        const enterpriseData = enterpriseDoc.data();
        console.log(`📊 Enterprise found: ${enterpriseData.name}`);

        // Get all departments in the enterprise
        const departmentsSnapshot = await admin.firestore()
            .collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .get();

        // Collect all contacts with full details
        const contactsWithDetails = {};
        let totalContacts = 0;
        const departmentStats = {};

        // Process each department
        for (const departmentDoc of departmentsSnapshot.docs) {
            const departmentId = departmentDoc.id;
            const departmentData = departmentDoc.data();
            console.log(`🏢 Processing department: ${departmentId} (${departmentData.name})`);
            
            // Get employees for this department
            const employeesSnapshot = await admin.firestore()
                .collection('enterprise')
                .doc(enterpriseId)
                .collection('departments')
                .doc(departmentId)
                .collection('employees')
                .get();                const departmentContacts = [];
                let departmentContactCount = 0;

                for (const employeeDoc of employeesSnapshot.docs) {
                    const employeeData = employeeDoc.data();
                    const userId = employeeData.userId ? employeeData.userId.id : null;
                    
                    if (userId) {
                        console.log(`👤 Processing employee: ${employeeData.firstName} ${employeeData.lastName} (${userId})`);
                        
                        // Get contacts for this user
                        const contactsDoc = await admin.firestore()
                            .collection('contacts')
                            .doc(userId)
                            .get();

                        if (contactsDoc.exists) {
                            const contactsData = contactsDoc.data();
                            if (contactsData.contactList && Array.isArray(contactsData.contactList)) {
                                // Add full contact details with employee context
                                for (const contact of contactsData.contactList) {
                                    const contactWithContext = {
                                        ...contact,
                                        ownerInfo: {
                                            userId: userId,
                                            firstName: employeeData.firstName,
                                            lastName: employeeData.lastName,
                                            email: employeeData.email,
                                            department: departmentId,
                                            jobTitle: employeeData.jobTitle
                                        },
                                        enterpriseId: enterpriseId
                                    };
                                    
                                    departmentContacts.push(contactWithContext);
                                    departmentContactCount++;
                                    totalContacts++;
                                }
                                  console.log(`📞 Found ${contactsData.contactList.length} contacts for ${employeeData.firstName} ${employeeData.lastName}`);
                            }
                        }
                    }
                }

                // Store department data
                contactsWithDetails[departmentId] = {
                    departmentName: departmentData.name,
                    departmentId: departmentId,
                    contacts: departmentContacts,
                    contactCount: departmentContactCount
                };

                departmentStats[departmentId] = {
                    name: departmentData.name,
                    contactCount: departmentContactCount,
                    employeeCount: employeesSnapshot.size
                };                console.log(`📊 Department ${departmentId} complete: ${departmentContactCount} contacts`);
        }

        // Create comprehensive response with detailed contacts
        const detailedContactData = {
            enterpriseId: enterpriseId,
            enterpriseName: enterpriseData.name,
            totalContacts: totalContacts,
            totalDepartments: Object.keys(contactsWithDetails).length,
            departmentStats: departmentStats,            contactsByDepartment: contactsWithDetails,
            generatedAt: new Date().toISOString(),
            cacheExpiry: new Date(Date.now() + contactCache.defaultTTL).toISOString()
        };

        // Cache the detailed results
        contactCache.set(cacheKey, detailedContactData);
        console.log(`💾 Cached detailed contacts for enterprise ${enterpriseId}`);

        res.status(200).send({
            success: true,
            cached: false,
            data: detailedContactData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting enterprise contacts with details:', error);
        sendError(res, 500, 'Error retrieving enterprise contacts with details', error);
    }
};

/**
 * Get contacts for a specific department with full contact details
 */
const getDepartmentContactsWithDetails = async (req, res) => {
    try {
        const { enterpriseId, departmentId } = req.params;
        
        // Validate parameters
        if (!enterpriseId || enterpriseId.trim() === '') {
            return sendError(res, 400, 'Enterprise ID is required');
        }
        if (!departmentId || departmentId.trim() === '') {
            return sendError(res, 400, 'Department ID is required');
        }

        console.log(`🔍 Getting detailed contacts for department: ${departmentId} in enterprise: ${enterpriseId}`);
        
        // Check cache first
        const cacheKey = `enterprise_${enterpriseId}_department_${departmentId}_contacts_details`;
        const cachedData = contactCache.get(cacheKey);
          if (cachedData) {
            console.log(`✅ Cache hit for department ${departmentId} detailed contacts`);
            contactCache.hitCount++;
            return res.status(200).send({
                success: true,
                cached: true,
                data: cachedData,
                timestamp: new Date().toISOString()
            });
        }

        console.log(`❌ Cache miss for department ${departmentId} detailed contacts - calculating...`);
        contactCache.missCount++;        // Get enterprise document to validate and get department info
        const enterpriseDoc = await admin.firestore()
            .collection('enterprise')
            .doc(enterpriseId)
            .get();

        if (!enterpriseDoc.exists) {
            return sendError(res, 404, 'Enterprise not found');
        }        const enterpriseData = enterpriseDoc.data();
        
        // Get the specific department document
        const departmentDoc = await admin.firestore()
            .collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId)
            .get();
            
        if (!departmentDoc.exists) {
            return sendError(res, 404, 'Department not found in enterprise');
        }

        const department = departmentDoc.data();
        console.log(`🏢 Processing department: ${department.name} (${departmentId})`);// Get employees for this department
        const employeesSnapshot = await admin.firestore()
            .collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc(departmentId)
            .collection('employees')
            .get();        const departmentContacts = [];
        let contactCount = 0;
        const employeeContactCounts = {};

        for (const employeeDoc of employeesSnapshot.docs) {
            const employeeData = employeeDoc.data();
            const userId = employeeData.userId ? employeeData.userId.id : null;
            
            if (userId) {
                console.log(`👤 Processing employee: ${employeeData.firstName} ${employeeData.lastName} (${userId})`);
                
                // Get contacts for this user
                const contactsDoc = await admin.firestore()
                    .collection('contacts')
                    .doc(userId)
                    .get();

                let employeeContactCount = 0;
                
                if (contactsDoc.exists) {
                    const contactsData = contactsDoc.data();
                    if (contactsData.contactList && Array.isArray(contactsData.contactList)) {
                        // Add full contact details with employee context
                        for (const contact of contactsData.contactList) {
                            const contactWithContext = {
                                ...contact,
                                ownerInfo: {
                                    userId: userId,
                                    firstName: employeeData.firstName,
                                    lastName: employeeData.lastName,
                                    email: employeeData.email,
                                    department: departmentId,
                                    departmentName: department.name,
                                    jobTitle: employeeData.jobTitle
                                },
                                enterpriseId: enterpriseId,
                                enterpriseName: enterpriseData.name
                            };
                            
                            departmentContacts.push(contactWithContext);
                            employeeContactCount++;
                            contactCount++;
                        }
                        
                        console.log(`📞 Found ${contactsData.contactList.length} contacts for ${employeeData.firstName} ${employeeData.lastName}`);
                    }
                }

                employeeContactCounts[userId] = {
                    firstName: employeeData.firstName,
                    lastName: employeeData.lastName,
                    email: employeeData.email,
                    jobTitle: employeeData.jobTitle,
                    contactCount: employeeContactCount
                };
            }
        }

        // Create comprehensive department contact response
        const departmentContactData = {
            enterpriseId: enterpriseId,
            enterpriseName: enterpriseData.name,
            departmentId: departmentId,
            departmentName: department.name,
            totalContacts: contactCount,
            totalEmployees: employeesSnapshot.size,
            employeeContactBreakdown: employeeContactCounts,            contacts: departmentContacts,
            generatedAt: new Date().toISOString(),
            cacheExpiry: new Date(Date.now() + contactCache.defaultTTL).toISOString()
        };

        // Cache the detailed results
        contactCache.set(cacheKey, departmentContactData);
        console.log(`💾 Cached detailed contacts for department ${departmentId}`);

        res.status(200).send({
            success: true,
            cached: false,
            data: departmentContactData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting department contacts with details:', error);
        sendError(res, 500, 'Error retrieving department contacts with details', error);
    }
};

// Export the existing functions that were declared with exports.functionName
module.exports.getEnterpriseContactsWithDetails = getEnterpriseContactsWithDetails;
module.exports.getDepartmentContactsWithDetails = getDepartmentContactsWithDetails;

// The original functions were already exported via exports.functionName syntax:
// - exports.getEnterpriseContactsSummary
// - exports.getDepartmentContactsSummary
// - exports.getCacheStats
// - exports.clearAllCache
// - exports.invalidateAllDepartmentCaches
// - exports.warmCacheForEnterprises
// - exports.updateCacheConfig
// - exports.getCacheConfig
// - exports.getCacheAnalytics

// Export cache instance for use in other modules
module.exports.contactCache = contactCache;
