// Utility function to convert minutes to a human-readable format
export const formatMinutes = (totalMinutes) => {
  if (totalMinutes <= 0) return 'On Time';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let result = [];
  if (hours > 0) result.push(`${hours}h`);
  if (minutes > 0) result.push(`${minutes}m`);
  return result.join(' ');
};

// --- New Helper function to get today's date string reliably ---
export const getTodayString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


// --- Helper function to get the active section based on current time ---
export const getActiveSectionId = (sections, dailyOverrides, selectedDate) => {
  const now = new Date();
  const todayString = getTodayString();
  if (selectedDate !== todayString) return null; // Only auto-select for today

  const currentTime = now.getHours() * 60 + now.getMinutes();

  const sectionsWithOverrides = sections.map(sec => {
    const override = dailyOverrides.find(o => o.sectionId === sec.id && o.date === selectedDate);
    return {
      ...sec,
      startTime: override ? override.newTime : sec.startTime,
    };
  });

  // Find the latest section that has already started
  let activeSectionId = null;
  // Use sectionsWithOverrides for the calculation
  for (let i = 0; i < sectionsWithOverrides.length; i++) {
    const [startHour, startMinute] = sectionsWithOverrides[i].startTime.split(':').map(Number);
    const sectionTime = startHour * 60 + startMinute;
    if (currentTime >= sectionTime) {
      activeSectionId = sectionsWithOverrides[i].id;
    }
  }

  return activeSectionId;
};

// --- Helper function to generate a UUID-like string ---
export const generateId = () => {
    return Math.random().toString(36).substring(2, 9);
};

// Check if a person is marked out for a given date and section
export const isPersonMarkedOut = (personId, date, sectionId, sections, outRecords) => {
    const checkDate = new Date(date);
    checkDate.setUTCHours(0,0,0,0); // Normalize to start of day UTC
    const sectionIndex = sections.findIndex(s => s.id === sectionId);

    return outRecords.some(record => {
      if (record.personId !== personId) return false;

      const recordStartDate = new Date(record.startDate);
      recordStartDate.setUTCHours(0,0,0,0);
      const recordEndDate = new Date(record.endDate);
      recordEndDate.setUTCHours(0,0,0,0);

      const startSectionIndex = sections.findIndex(s => s.id === record.startSectionId);
      const endSectionIndex = sections.findIndex(s => s.id === record.endSectionId);

      // Check if the date is within the range (inclusive)
      if (checkDate < recordStartDate || checkDate > recordEndDate) {
        return false;
      }
      
      // Check if the section is within the range
      if (recordStartDate.getTime() === recordEndDate.getTime()) { // Single day
        return sectionIndex >= startSectionIndex && sectionIndex <= endSectionIndex;
      } else if (checkDate.getTime() === recordStartDate.getTime()) { // First day of multi-day
        return sectionIndex >= startSectionIndex;
      } else if (checkDate.getTime() === recordEndDate.getTime()) { // Last day of multi-day
        return sectionIndex <= endSectionIndex;
      } else { // A full day in between
        return true;
      }
    });
};

// A simple utility to get the Hebrew date string
export const getHebrewDate = (gregorianDate) => {
  try {
    const date = new Date(gregorianDate);
    // Adjust for timezone to prevent off-by-one day errors
    const adjustedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
    const hDate = new Intl.DateTimeFormat('en-u-ca-hebrew', {
      dateStyle: 'full'
    }).format(adjustedDate);

    // Format to be more readable
    const parts = hDate.split(', ');
    return parts.slice(1).join(', ');
  } catch (e) {
    console.error("Error formatting Hebrew date:", e);
    return "Invalid Date";
  }
};

// --- Reusable Calculation Logic ---
export const calculateSummaryStats = (personId, allAttendanceData, sections, dailyScheduleOverrides, startDate, endDate, outRecords) => {
    const todayString = getTodayString();
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    let totalMinutesPossible = 0;
    let totalMinutesAttended = 0;
    const perClassStats = {};

    sections.forEach(s => {
        perClassStats[s.id] = { totalMinutesPossible: 0, totalMinutesAttended: 0, percentage: "N/A" };
    });

    const datesToProcess = Object.keys(allAttendanceData).filter(date => {
        const currentDateObj = new Date(date);
        const currentDate = new Date(currentDateObj.valueOf() + currentDateObj.getTimezoneOffset() * 60 * 1000);
        if (startDate && currentDate < startDate) return false;
        if (endDate && currentDate > endDate) return false;
        return true;
    });

    datesToProcess.forEach(date => {
        const dayRecords = allAttendanceData[date] || {};
        const sectionsForThisDay = sections.map(sec => {
            const override = dailyScheduleOverrides.find(o => o.sectionId === sec.id && o.date === date);
            return { ...sec, startTime: override ? override.newTime : sec.startTime };
        });

        sectionsForThisDay.forEach(section => {
            const [startHour, startMinute] = section.startTime.split(':').map(Number);
            const sectionTime = startHour * 60 + startMinute;
            const isPast = new Date(date) < new Date(todayString) || (date === todayString && currentTime >= sectionTime + section.duration);
            const isActive = date === todayString && currentTime >= sectionTime && currentTime < sectionTime + section.duration;

            if (isPast || isActive) {
                const wasClassHeldForAnyStudent = Object.values(dayRecords).some(personRecords => personRecords[section.id]);
                
                if (wasClassHeldForAnyStudent) {
                    const record = dayRecords[personId]?.[section.id];
                    const isOut = isPersonMarkedOut(personId, date, section.id, sections, outRecords);

                    if (isOut || record?.status === 'Excused') {
                        // Excused, do nothing.
                    } else if (record && (record.status === 'On Time' || record.status === 'Late')) {
                        totalMinutesPossible += section.duration;
                        perClassStats[section.id].totalMinutesPossible += section.duration;
                        const attended = record.status === 'On Time' 
                            ? section.duration 
                            : Math.max(0, section.duration - (record.minutesLate || 0));
                        totalMinutesAttended += attended;
                        perClassStats[section.id].totalMinutesAttended += attended;
                    } else if (record && record.status === 'Absent') {
                        totalMinutesPossible += section.duration;
                        perClassStats[section.id].totalMinutesPossible += section.duration;
                    } else if (!record) { // Not marked
                        if (isActive) {
                            // Implicitly absent for active classes
                            totalMinutesPossible += section.duration;
                            perClassStats[section.id].totalMinutesPossible += section.duration;
                        }
                        // For past classes, implicitly excused, so do nothing.
                    }
                }
            }
        });
    });
    
    for(const sectionId in perClassStats) {
        const classData = perClassStats[sectionId];
        if (classData.totalMinutesPossible > 0) {
            classData.percentage = ((classData.totalMinutesAttended / classData.totalMinutesPossible) * 100).toFixed(1);
        }
    }
    
    const presentPercentage = totalMinutesPossible > 0 ? ((totalMinutesAttended / totalMinutesPossible) * 100).toFixed(1) : "N/A";
    
    const totalMinutesLate = datesToProcess.flatMap(date => Object.values(allAttendanceData[date]?.[personId] || {}))
                                .filter(rec => rec.status === 'Late')
                                .reduce((sum, rec) => sum + (rec.minutesLate || 0), 0);
    
    return { presentPercentage, totalMinutesLate, perClassStats };
};

export const getPercentageColor = (percentage) => {
    const p = parseFloat(percentage);
    if (isNaN(p)) return 'text-gray-400';
    if (p < 60) return 'text-red-400';
    if (p < 80) return 'text-yellow-400';
    return 'text-green-400';
};