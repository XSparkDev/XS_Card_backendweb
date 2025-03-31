const ics = require('ics');

/**
 * Creates an ICS calendar event with proper timezone support
 * 
 * @param {Object} event - The event details
 * @param {string} event.title - Event title/summary
 * @param {string} event.description - Event description
 * @param {Date|string} event.start - Start date and time
 * @param {Date|string} event.end - End date and time
 * @param {string} event.location - Event location
 * @param {Array} event.attendees - Array of attendee objects with email and name
 * @param {Object} event.organizer - Organizer with email and name
 * @param {string} event.timezone - IANA timezone string (e.g. 'Africa/Johannesburg')
 * @returns {Promise<string>} - Promise resolving to ICS content string
 */
function createCalendarEvent(event) {
  return new Promise((resolve, reject) => {
    // Parse dates to ensure proper format for ICS
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    
    // Convert to array format required by ics: [year, month, day, hour, minute]
    const startArray = [
      startDate.getFullYear(),
      startDate.getMonth() + 1, // ics uses 1-indexed months
      startDate.getDate(),
      startDate.getHours(),
      startDate.getMinutes()
    ];
    
    const endArray = [
      endDate.getFullYear(),
      endDate.getMonth() + 1,
      endDate.getDate(),
      endDate.getHours(),
      endDate.getMinutes()
    ];

    // Format attendees for ics
    const icsAttendees = (event.attendees || []).map(attendee => ({
      name: attendee.name,
      email: attendee.email,
      rsvp: true,
      partstat: 'NEEDS-ACTION',
      role: 'REQ-PARTICIPANT'
    }));

    // Create event object for ics
    const icsEvent = {
      start: startArray,
      end: endArray,
      title: event.title,
      description: event.description,
      location: event.location,
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      organizer: event.organizer ? {
        name: event.organizer.name,
        email: event.organizer.email
      } : undefined,
      attendees: icsAttendees,
      productId: 'XSCard/Meeting'
    };

    // Generate ICS content
    ics.createEvent(icsEvent, (error, value) => {
      if (error) {
        console.error('Error creating ICS event:', error);
        reject(error);
      } else {
        resolve(value);
      }
    });
  });
}

module.exports = {
  createCalendarEvent
};
