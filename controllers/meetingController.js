const { db, admin } = require('../firebase.js');
const { formatDate } = require('../utils/dateFormatter');
const { sendMailWithStatus } = require('../public/Utils/emailService');
const { createCalendarEvent } = require('../public/Utils/calendarService');
const { logActivity, ACTIONS, RESOURCES } = require('../utils/logger');

// Helper function for error responses
const sendError = (res, status, message, error = null) => {
    console.error(`${message}:`, error);
    res.status(status).send({ 
        message,
        ...(error && { error: error.message })
    });
};

exports.getAllMeetings = async (req, res) => {
    const { userId } = req.params;
    
    try {
        // Verify if the requesting user has access to this userId's meetings
        if (userId !== req.user.uid) {
            return res.status(403).json({ 
                success: false,
                message: 'Unauthorized access to this user\'s meetings',
                error: 'Authentication failed: You can only access your own meetings'
            });
        }

        const meetingRef = db.collection('meetings').doc(userId);
        const doc = await meetingRef.get();

        if (!doc.exists || !doc.data().bookings) {
            return res.status(404).json({ 
                success: false,
                message: 'No meetings found',
                details: {
                    userId: userId,
                    reason: !doc.exists ? 'User has no meetings document' : 'Bookings array is empty'
                }
            });
        }

        // Format dates in the response
        const meetings = doc.data().bookings.map(meeting => ({
            ...meeting,
            meetingWhen: formatDate(meeting.meetingWhen)
        }));

        res.status(200).json({
            success: true,
            message: 'Meetings retrieved successfully',
            data: {
                userId: userId,
                totalMeetings: meetings.length,
                meetings: meetings
            }
        });
    } catch (error) {
        sendError(res, 500, {
            success: false,
            message: 'Failed to fetch meetings',
            error: {
                type: error.name,
                description: error.message
            }
        });
    }
};

exports.createMeeting = async (req, res) => {
    console.log('🔍 CREATE MEETING CALLED', {
        body: req.body,
        params: req.params,
        user: req.user,
        path: req.path
    });

    try {
        const userId = req.params.userId || req.user?.uid;
        console.log('🔑 Using userId:', userId);
        
        const meetingData = req.body;
        console.log('📅 Meeting data:', meetingData);
        
        // Create a new document reference
        const meetingRef = db.collection('meetings').doc();
        console.log('📝 Created doc reference:', meetingRef.id);
        
        // Add timestamp fields
        const timestamp = admin.firestore.Timestamp.now();
        const meeting = {
            ...meetingData,
            userId: db.doc(`users/${userId}`),
            createdAt: timestamp,
            updatedAt: timestamp
        };
        
        // Save to Firestore
        await meetingRef.set(meeting);
        console.log('💾 Saved meeting to Firestore');
        
        // Log meeting creation
        console.log('📊 About to log meeting creation activity');
        try {
            await logActivity({
                action: ACTIONS.CREATE,
                resource: RESOURCES.MEETING,
                userId: userId,
                resourceId: meetingRef.id,
                details: {
                    title: meetingData.title || 'Untitled Meeting',
                    date: meetingData.date || meetingData.startDateTime || new Date().toISOString(),
                    participantCount: meetingData.participants?.length || meetingData.attendees?.length || 0
                }
            });
            console.log('✅ Successfully logged meeting creation');
        } catch (logError) {
            console.error('❌ Failed to log meeting creation:', logError);
        }
        
        // Return success response
        res.status(201).send({
            id: meetingRef.id,
            ...meeting
        });
    } catch (error) {
        console.error('❌ Main error in createMeeting:', error);
        // Log error - with try/catch to avoid double errors
        try {
            await logActivity({
                action: ACTIONS.ERROR,
                resource: RESOURCES.MEETING,
                userId: req.params.userId || req.user?.uid || 'unknown',
                status: 'error',
                details: {
                    error: error.message,
                    operation: 'create_meeting'
                }
            });
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
        
        console.error('Error creating meeting:', error);
        res.status(500).send({ 
            message: 'Error creating meeting',
            error: error.message 
        });
    }
};

exports.updateMeeting = async (req, res) => {
    try {
        const { userId, meetingId } = req.params;
        const updatedData = req.body;
        
        // Add updated timestamp
        updatedData.updatedAt = admin.firestore.Timestamp.now();
        
        // Update the meeting
        const meetingRef = db.collection('meetings').doc(meetingId);
        await meetingRef.update(updatedData);
        
        // Log meeting update
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.MEETING,
            userId: userId,
            resourceId: meetingId,
            details: {
                title: updatedData.title,
                fieldsUpdated: Object.keys(updatedData).filter(k => k !== 'updatedAt')
            }
        });
        
        // Return success
        res.status(200).send({
            id: meetingId,
            ...updatedData
        });
    } catch (error) {
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.MEETING,
            userId: req.params.userId,
            resourceId: req.params.meetingId,
            status: 'error',
            details: {
                error: error.message,
                operation: 'update_meeting'
            }
        });
        
        console.error('Error updating meeting:', error);
        res.status(500).send({ 
            message: 'Error updating meeting',
            error: error.message 
        });
    }
};

exports.deleteMeeting = async (req, res) => {
    try {
        const { userId, meetingIndex } = req.params;
        const index = parseInt(meetingIndex, 10);
        
        if (isNaN(index)) {
            return res.status(400).send({ 
                message: 'Invalid meeting index',
                error: 'Meeting index must be a number' 
            });
        }
        
        // Get the user's meetings document
        const meetingRef = db.collection('meetings').doc(userId);
        const meetingDoc = await meetingRef.get();
        
        if (!meetingDoc.exists) {
            return res.status(404).send({ message: 'No meetings found for this user' });
        }
        
        const meetingsData = meetingDoc.data();
        
        if (!meetingsData.bookings || !Array.isArray(meetingsData.bookings)) {
            return res.status(404).send({ message: 'No meetings found for this user' });
        }
        
        if (index < 0 || index >= meetingsData.bookings.length) {
            return res.status(404).send({ message: 'Meeting index out of bounds' });
        }
        
        // Get the meeting to delete for logging purposes
        const deletedMeeting = meetingsData.bookings[index];
        
        // Remove the meeting from the array
        meetingsData.bookings.splice(index, 1);
        
        // Update the document with the modified array
        await meetingRef.update({
            bookings: meetingsData.bookings
        });
        
        // Log meeting deletion
        await logActivity({
            action: ACTIONS.DELETE,
            resource: RESOURCES.MEETING,
            userId: userId,
            resourceId: `${userId}-meeting-${index}`,
            details: {
                title: deletedMeeting.title || 'Untitled Meeting',
                date: deletedMeeting.meetingWhen || 'Unknown date',
                method: 'array_splice'
            }
        });
        
        // Return success
        res.status(200).send({ 
            message: 'Meeting deleted successfully',
            deletedMeetingIndex: index,
            remainingMeetings: meetingsData.bookings.length
        });
    } catch (error) {
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.MEETING,
            userId: req.params.userId,
            status: 'error',
            details: {
                error: error.message,
                operation: 'delete_meeting'
            }
        });
        
        console.error('Error deleting meeting:', error);
        res.status(500).send({ 
            message: 'Error deleting meeting',
            error: error.message 
        });
    }
};

exports.sendMeetingInvite = async (req, res) => {
    console.log('🗓️ SEND MEETING INVITE CALLED', {
        body: req.body,
        params: req.params,
        user: req.user
    });
    
    try {
        const userId = req.user.uid;
        const {
            title,
            description,
            startDateTime,
            endDateTime,
            location,
            attendees,
            organizer,
            timezone = 'UTC',
            duration = 30 // Default to 30 minutes if not provided
        } = req.body;
        
        // Validate required fields
        if (!title || !startDateTime || !endDateTime || !attendees || !Array.isArray(attendees)) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                required: ['title', 'startDateTime', 'endDateTime', 'attendees']
            });
        }
        
        // Get user info to use as organizer if not provided
        let organizerInfo = organizer;
        if (!organizerInfo || !organizerInfo.name || !organizerInfo.email) {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            const userData = userDoc.data();
            organizerInfo = {
                name: `${userData.name} ${userData.surname || ''}`.trim(),
                email: userData.email
            };
        }
        
        console.log('Using organizer info:', organizerInfo);
        
        // Generate the calendar event
        const calendarEvent = await createCalendarEvent({
            title,
            description: description || '',
            start: startDateTime,
            end: endDateTime,
            location: location || 'Online meeting',
            attendees,
            organizer: organizerInfo,
            timezone
        });
        
        // Send emails to all attendees
        const emailPromises = attendees.map(async (attendee) => {
            const mailOptions = {
                to: attendee.email,
                // Override default sender to appear as coming from the user
                from: {
                    name: organizerInfo.name,
                    address: process.env.EMAIL_FROM_ADDRESS // We still use system email address for deliverability
                },
                replyTo: organizerInfo.email, // Replies will go to the actual user
                subject: `Meeting Invitation: ${title}`,
                html: `
                    <h2>Meeting Invitation from ${organizerInfo.name}</h2>
                    <p><strong>Subject:</strong> ${title}</p>
                    <p><strong>When:</strong> ${new Date(startDateTime).toLocaleString(undefined, { 
                        dateStyle: 'full', 
                        timeStyle: 'short' 
                    })}</p>
                    <p><strong>Duration:</strong> ${duration} minutes</p>
                    <p><strong>Where:</strong> ${location || 'Online meeting'}</p>
                    <p><strong>Organizer:</strong> ${organizerInfo.name} (${organizerInfo.email})</p>
                    ${description ? `<p><strong>Description:</strong><br>${description.replace(/\n/g, '<br>')}</p>` : ''}
                    <p>This invitation contains a calendar attachment that you can add to your calendar application.</p>
                `,
                attachments: [{
                    filename: 'meeting.ics',
                    content: calendarEvent,
                    contentType: 'text/calendar'
                }]
            };
            
            return sendMailWithStatus(mailOptions);
        });
        
        const emailResults = await Promise.all(emailPromises);
        
        // Save meeting to database with duration in minutes
        const meetingRef = db.collection('meetings').doc(userId);
        const meetingDoc = await meetingRef.get();
        
        const newMeeting = {
            title,
            meetingWith: title,
            meetingWhen: new Date(startDateTime),
            endTime: new Date(endDateTime),
            description: description || '',
            location: location || 'Online meeting',
            attendees: attendees,
            duration: duration // Store duration in minutes
        };
        
        if (meetingDoc.exists) {
            await meetingRef.update({
                bookings: [...(meetingDoc.data().bookings || []), newMeeting]
            });
        } else {
            await meetingRef.set({
                bookings: [newMeeting]
            });
        }
        
        // Log meeting creation/invitation
        console.log('📊 About to log meeting invitation');
        try {
            await logActivity({
                action: ACTIONS.CREATE,
                resource: RESOURCES.MEETING,
                userId: userId,
                details: {
                    title,
                    date: startDateTime,
                    attendeeCount: attendees.length,
                    type: 'invitation'
                }
            });
            console.log('✅ Successfully logged meeting invitation');
        } catch (logError) {
            console.error('❌ Failed to log meeting invitation:', logError);
        }
        
        res.status(200).json({
            success: true,
            message: 'Meeting invitations sent successfully',
            data: {
                emailResults: emailResults.map(r => ({
                    success: r.success,
                    recipients: r.accepted
                })),
                meeting: {
                    ...newMeeting,
                    meetingWhen: formatDate(newMeeting.meetingWhen)
                }
            }
        });
    } catch (error) {
        console.error('Error sending meeting invites:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send meeting invitations',
            error: error.message
        });
    }
};
