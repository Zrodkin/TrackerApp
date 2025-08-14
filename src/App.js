import React, { useState, useEffect, useMemo } from 'react';
import { MinusCircle, CheckCircle, Clock, XCircle, Pencil, Trash2, Plus, FileText, Settings2, ChevronDown, Check, CalendarDays, PlusCircle, CalendarX, Edit, Search, ChevronLeft, ChevronRight, BrainCircuit, MessageSquarePlus, AreaChart, CircleSlash, Undo, LayoutGrid, Users, Printer, RotateCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, query, where, getDocs, updateDoc, deleteField, writeBatch } from 'firebase/firestore';

import { formatMinutes, getTodayString, getActiveSectionId, generateId, isPersonMarkedOut, getHebrewDate, calculateSummaryStats, getPercentageColor } from './utils';
import GroupAbsenceModal from './components/GroupAbsenceModal';
import AbsenceManagementModal from './components/AbsenceManagementModal';
import ReportsDashboard from './components/ReportsDashboard';
import ComprehensiveStudentReport from './components/ComprehensiveStudentReport';
import AttendanceStatusSelector from './components/AttendanceStatusSelector';

const App = () => {
  // --- Firebase State ---
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);

  // Use a unique ID for the app, or a default
  const appId = process.env.REACT_APP_APP_ID || 'default-app-id';

  // --- App State ---
  const [people, setPeople] = useState([]);
  const [sections, setSections] = useState([]);
  
  // State for the currently selected day's attendance records.
  const [dailyAttendance, setDailyAttendance] = useState({});
  // State for ALL attendance data, used for reports.
  const [allAttendanceData, setAllAttendanceData] = useState({});

  // NEW: State for Undo/Redo
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [redoHistory, setRedoHistory] = useState([]);

  const students = useMemo(() => people.filter(p => p.type === 'student'), [people]);
  const shluchim = useMemo(() => people.filter(p => p.type === 'shliach'), [people]);
  
  const [dailyScheduleOverrides, setDailyScheduleOverrides] = useState([]);
  
  // NEW: State for persistent, per-class notes
  const [persistentNotes, setPersistentNotes] = useState({});
  const [editingPersistentNote, setEditingPersistentNote] = useState(null); // { personId, sectionId }

  // NEW: State for multi-day/multi-section absences
  const [outRecords, setOutRecords] = useState([]);

  const [showSettings, setShowSettings] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [currentDate, setCurrentDate] = useState('');
  const [hebrewDate, setHebrewDate] = useState(''); // State for Hebrew date

  // State for the current view, selected person, and selected date
  const [view, setView] = useState('main'); // 'main', 'summary', 'reportsDashboard'
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [currentSectionId, setCurrentSectionId] = useState(null);
  // New state for the date, initialized to today
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  
  // State for the search query
  const [searchQuery, setSearchQuery] = useState('');

  // NEW: State for the absence management modal
  const [managingAbsences, setManagingAbsences] = useState({ isOpen: false, personId: null });
  const [isGroupAbsenceModalOpen, setIsGroupAbsenceModalOpen] = useState(false);

  // NEW: State for the daily schedule override modal
  const [scheduleOverrideModal, setScheduleOverrideModal] = useState({
      isOpen: false,
      sectionId: null,
      newTime: '',
      date: selectedDate, // Add a date to the override modal state
  });
  
  // NEW: State for sorting
  const [sortField, setSortField] = useState('lastName'); // 'firstName', 'lastName', 'note'

  // NEW: State for period filter
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState('all');
  const [emailFrequency, setEmailFrequency] = useState('weekly');

  const todayString = getTodayString();

  // Filtered people list based on search query
  const filteredPeople = useMemo(() => {
    if (!searchQuery) {
        return people;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return people.filter(p => 
        p.firstName.toLowerCase().includes(lowerCaseQuery) || 
        p.lastName.toLowerCase().includes(lowerCaseQuery)
    );
  }, [searchQuery, people]);
  
  // Separate filtered lists for students and shluchim
  const filteredStudents = useMemo(() => filteredPeople.filter(p => p.type === 'student'), [filteredPeople]);
  const filteredShluchim = useMemo(() => filteredPeople.filter(p => p.type === 'shliach'), [filteredPeople]);
  
  // Sorted students list based on sort field
  const sortedStudents = useMemo(() => {
      const sorted = [...filteredStudents];
      sorted.sort((a, b) => {
          if (sortField === 'note' && selectedPeriodFilter !== 'all') {
              const noteA = persistentNotes[a.id]?.[selectedPeriodFilter] || '';
              const noteB = persistentNotes[b.id]?.[selectedPeriodFilter] || '';
              if (noteA && !noteB) return -1;
              if (!noteA && noteB) return 1;
              return noteA.localeCompare(noteB);
          }
          const aName = a[sortField]?.toLowerCase() || a.lastName.toLowerCase();
          const bName = b[sortField]?.toLowerCase() || b.lastName.toLowerCase();
          if (aName < bName) return -1;
          if (aName > bName) return 1;
          return 0;
      });
      return sorted;
  }, [filteredStudents, sortField, persistentNotes, selectedPeriodFilter]);
  
  // Sorted shluchim list
  const sortedShluchim = useMemo(() => {
      const sorted = [...filteredShluchim];
       sorted.sort((a, b) => {
          if (sortField === 'note' && selectedPeriodFilter !== 'all') {
              const noteA = persistentNotes[a.id]?.[selectedPeriodFilter] || '';
              const noteB = persistentNotes[b.id]?.[selectedPeriodFilter] || '';
              if (noteA && !noteB) return -1;
              if (!noteA && noteB) return 1;
              return noteA.localeCompare(noteB);
          }
          const aName = a[sortField]?.toLowerCase() || a.lastName.toLowerCase();
          const bName = b[sortField]?.toLowerCase() || b.lastName.toLowerCase();
          if (aName < bName) return -1;
          if (aName > bName) return 1;
          return 0;
      });
      return sorted;
  }, [filteredShluchim, sortField, persistentNotes, selectedPeriodFilter]);


  const activeSection = sections.find(s => s.id === currentSectionId);
  const sectionsWithOverrides = useMemo(() => {
    return sections.map(sec => {
        const override = dailyScheduleOverrides.find(o => o.sectionId === sec.id && o.date === selectedDate);
        return {
            ...sec,
            startTime: override ? override.newTime : sec.startTime
        };
    });
  }, [sections, dailyScheduleOverrides, selectedDate]);
  
  const activeSectionWithOverride = sectionsWithOverrides.find(s => s.id === currentSectionId);
  const overrideForActiveSection = dailyScheduleOverrides.find(o => o.sectionId === activeSection?.id && o.date === selectedDate);

  // NEW: Memo for filtered sections for the grid view
  const filteredSectionsForView = useMemo(() => {
    if (selectedPeriodFilter === 'all') {
      return sectionsWithOverrides;
    }
    return sectionsWithOverrides.filter(s => s.id === selectedPeriodFilter);
  }, [selectedPeriodFilter, sectionsWithOverrides]);


  // --- Effects ---

  // Effect to initialize Firebase connection
  useEffect(() => {
    try {
      const firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);
      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);
      
      setAuth(authInstance);
      setDb(dbInstance);

      onAuthStateChanged(authInstance, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          try {
            if (process.env.REACT_APP_INITIAL_AUTH_TOKEN) {
              await signInWithCustomToken(authInstance, __initial_auth_token);
            } else {
              await signInAnonymously(authInstance);
            }
          } catch (error) {
            console.error("Error signing in:", error);
          }
        }
      });
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      if (!process.env.REACT_APP_FIREBASE_CONFIG) {
          console.error("__firebase_config is not defined. Please set it up in your environment.");
      }
    }
  }, []);

  // Effect to fetch people from Firestore
  useEffect(() => {
    if (!db || !userId) return;
    const peopleCollectionPath = `/artifacts/${appId}/users/${userId}/people`;
    const peopleQuery = query(collection(db, peopleCollectionPath));
    const unsubscribe = onSnapshot(peopleQuery, (querySnapshot) => {
      const peopleData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPeople(peopleData);
    }, (error) => console.error("Error fetching people:", error));
    return () => unsubscribe();
  }, [db, userId, appId]);

  // Effect to fetch sections from Firestore
  useEffect(() => {
    if (!db || !userId) return;
    const sectionsCollectionPath = `/artifacts/${appId}/users/${userId}/sections`;
    const sectionsQuery = query(collection(db, sectionsCollectionPath));
    const unsubscribe = onSnapshot(sectionsQuery, (querySnapshot) => {
      const sectionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      sectionsData.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setSections(sectionsData);
    }, (error) => console.error("Error fetching sections:", error));
    return () => unsubscribe();
  }, [db, userId, appId]);

  // Effect to fetch attendance for the selected date
  useEffect(() => {
    if (!db || !userId || !selectedDate) return;
    const attendanceDocPath = `/artifacts/${appId}/users/${userId}/attendance/${selectedDate}`;
    const docRef = doc(db, attendanceDocPath);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        setDailyAttendance(docSnap.exists() ? docSnap.data() : {});
    }, (error) => console.error("Error fetching daily attendance:", error));
    return () => unsubscribe();
  }, [db, userId, selectedDate, appId]);

  // Effect to fetch ALL attendance data for reports
  useEffect(() => {
    if (!db || !userId) return;
    const attendanceCollectionPath = `/artifacts/${appId}/users/${userId}/attendance`;
    const attendanceQuery = query(collection(db, attendanceCollectionPath));
    const unsubscribe = onSnapshot(attendanceQuery, (querySnapshot) => {
        const allData = {};
        querySnapshot.forEach(doc => {
            allData[doc.id] = doc.data();
        });
        setAllAttendanceData(allData);
    }, (error) => console.error("Error fetching all attendance data:", error));
    return () => unsubscribe();
  }, [db, userId, appId]);

  // Effect to fetch out records (absences)
  useEffect(() => {
    if (!db || !userId) return;
    const outRecordsCollectionPath = `/artifacts/${appId}/users/${userId}/outRecords`;
    const outRecordsQuery = query(collection(db, outRecordsCollectionPath));
    const unsubscribe = onSnapshot(outRecordsQuery, (querySnapshot) => {
        const recordsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOutRecords(recordsData);
    }, (error) => console.error("Error fetching out records:", error));
    return () => unsubscribe();
  }, [db, userId, appId]);

  // Effect to fetch persistent notes
  useEffect(() => {
    if (!db || !userId) return;
    const notesCollectionPath = `/artifacts/${appId}/users/${userId}/persistentNotes`;
    const notesQuery = query(collection(db, notesCollectionPath));
    const unsubscribe = onSnapshot(notesQuery, (querySnapshot) => {
        const notesData = {};
        querySnapshot.forEach(doc => {
            notesData[doc.id] = doc.data();
        });
        setPersistentNotes(notesData);
    }, (error) => console.error("Error fetching persistent notes:", error));
    return () => unsubscribe();
  }, [db, userId, appId]);

  // Effect to fetch user settings (like sort preference)
  useEffect(() => {
    if (!db || !userId) return;
    const settingsDocPath = `/artifacts/${appId}/users/${userId}/settings/userPreferences`;
    const unsubscribe = onSnapshot(doc(db, settingsDocPath), (docSnap) => {
        if (docSnap.exists() && docSnap.data().sortField) {
            setSortField(docSnap.data().sortField);
        }
    }, (error) => console.error("Error fetching settings:", error));
    return () => unsubscribe();
  }, [db, userId, appId]);


  useEffect(() => {
    // Set today's date string for display
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateObj = new Date(selectedDate);
    const timezoneOffset = dateObj.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(dateObj.getTime() + timezoneOffset);

    setCurrentDate(adjustedDate.toLocaleDateString('en-US', options));
    setHebrewDate(getHebrewDate(selectedDate)); // Set the Hebrew date

    // Set initial active section and update every minute
    const updateActiveSectionId = () => {
      // Only auto-select the section if we are on the current day
      setCurrentSectionId(getActiveSectionId(sections, dailyScheduleOverrides, selectedDate));
    };
    updateActiveSectionId();
    const intervalId = setInterval(updateActiveSectionId, 60000); // Check every minute
    return () => clearInterval(intervalId);
  }, [sections, selectedDate, dailyScheduleOverrides]); // Rerun effect if sections, selectedDate, or overrides change

  // Effect to set the initial period filter to the current class on today's date
  useEffect(() => {
    // Only run this when sections are loaded and we are on the current day
    if (sections.length > 0 && selectedDate === todayString) {
      const activeId = getActiveSectionId(sections, dailyScheduleOverrides, todayString);
      if (activeId) {
        setSelectedPeriodFilter(activeId);
        handleSortChange('note');
      }
    }
  }, [sections, dailyScheduleOverrides, selectedDate, todayString]);

  // NEW: Effect to reset sort field if period filter changes to "all"
  useEffect(() => {
    if (selectedPeriodFilter === 'all' && sortField === 'note') {
        setSortField('lastName');
    }
  }, [selectedPeriodFilter, sortField]);

  // NEW: Reset history when date changes
  useEffect(() => {
    setAttendanceHistory([]);
    setRedoHistory([]);
  }, [selectedDate]);


  // --- Attendance Logic ---
  const handleAttendanceChange = async (personId, sectionId, status, note = null, minutesLate = 0) => {
    if (!db || !userId) return;
    if (isPersonMarkedOut(personId, selectedDate, sectionId, sections, outRecords)) return;
    
    // Save current state for undo
    setAttendanceHistory(prev => [...prev, dailyAttendance]);
    setRedoHistory([]); // Clear redo history on new action

    const attendanceDocPath = `/artifacts/${appId}/users/${userId}/attendance/${selectedDate}`;
    const docRef = doc(db, attendanceDocPath);

    const fieldPath = `${personId}.${sectionId}`;

    if (status === 'Not Marked') {
        await updateDoc(docRef, { [fieldPath]: deleteField() }).catch(e => console.error("Error removing attendance field:", e));
    } else {
        const section = sectionsWithOverrides.find(s => s.id === sectionId);
        const sectionStartTime = section ? section.startTime : '00:00';
        const now = new Date();

        if (status === 'Late' && minutesLate === 0) {
            if (selectedDate === todayString) {
                const [startHour, startMinute] = sectionStartTime.split(':').map(Number);
                const sectionStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute, 0);
                const diffInMs = now.getTime() - sectionStart.getTime();
                minutesLate = Math.max(0, Math.floor(diffInMs / (1000 * 60)));
            } else {
                minutesLate = Math.floor(section.duration / 4);
            }
        }

        if (status === 'Late') {
            minutesLate = Math.min(minutesLate, 50);
        }

        const newRecord = {
            status,
            timestamp: now.toISOString(),
            note: status === 'Excused' ? note : null,
            minutesLate: minutesLate > 0 ? minutesLate : 0,
        };

        await setDoc(docRef, { [personId]: { [sectionId]: newRecord } }, { merge: true }).catch(e => console.error("Error saving attendance:", e));
    }
  };

    const getAttendanceStatus = (personId, section, date, dailyAttendanceForDate) => {
        const isOut = isPersonMarkedOut(personId, date, section.id, sections, outRecords);
        if (isOut) {
            const outRecord = outRecords.find(record => record.personId === personId && isPersonMarkedOut(personId, date, section.id, sections, outRecords));
            return { status: 'Excused', minutesLate: 0, note: outRecord?.note, isDailyNote: true };
        }

        const singleClassRecord = dailyAttendanceForDate[personId]?.[section.id];
        if (singleClassRecord) {
            return singleClassRecord;
        }

        // Logic for past classes
        const now = new Date();
        const todayString = getTodayString();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [startHour, startMinute] = section.startTime.split(':').map(Number);
        const sectionTime = startHour * 60 + startMinute;
        const isPast = new Date(date) < new Date(todayString) || (date === todayString && currentTime >= sectionTime + section.duration);

        if (isPast) {
            const isAnyStudentMarked = Object.values(dailyAttendanceForDate).some(personRecords => personRecords[section.id]);
            if (!isAnyStudentMarked) {
                return { status: 'Unmarked', minutesLate: 0, note: null };
            } else {
                // If some are marked, default to Excused, but show as Unmarked
                return { status: 'Unmarked', minutesLate: 0, note: 'Excused by default' };
            }
        }

        return { status: 'Not Marked', minutesLate: 0, note: null };
    };

    const handleUnmarkAll = async (sectionId) => {
        if (!db || !userId || !dailyAttendance) return;
        
        setAttendanceHistory(prev => [...prev, dailyAttendance]);
        setRedoHistory([]);

        const docRef = doc(db, `/artifacts/${appId}/users/${userId}/attendance/${selectedDate}`);
        const updates = {};
        Object.keys(dailyAttendance).forEach(personId => {
            if (dailyAttendance[personId][sectionId]) {
                updates[`${personId}.${sectionId}`] = deleteField();
            }
        });
        if (Object.keys(updates).length > 0) {
            await updateDoc(docRef, updates);
        }
    };

    const handleUndo = async () => {
        if (attendanceHistory.length === 0 || !db || !userId) return;
        const lastState = attendanceHistory[attendanceHistory.length - 1];
        setRedoHistory(prev => [...prev, dailyAttendance]);
        const docRef = doc(db, `/artifacts/${appId}/users/${userId}/attendance/${selectedDate}`);
        await setDoc(docRef, lastState); // Overwrite with the previous state
        setAttendanceHistory(prev => prev.slice(0, -1));
    };

    const handleRedo = async () => {
        if (redoHistory.length === 0 || !db || !userId) return;
        const nextState = redoHistory[redoHistory.length - 1];
        setAttendanceHistory(prev => [...prev, dailyAttendance]);
        const docRef = doc(db, `/artifacts/${appId}/users/${userId}/attendance/${selectedDate}`);
        await setDoc(docRef, nextState); // Overwrite with the redone state
        setRedoHistory(prev => prev.slice(0, -1));
    };

  // --- Persistent Note Logic ---
  const handlePersistentNoteSave = async (personId, sectionId, note) => {
    if (!db || !userId) return;
    const noteDocRef = doc(db, `/artifacts/${appId}/users/${userId}/persistentNotes`, personId);
    try {
        await setDoc(noteDocRef, { [sectionId]: note }, { merge: true });
    } catch (e) {
        console.error("Error saving persistent note:", e);
    }
    setEditingPersistentNote(null);
  };
  
  // --- Absence Management Logic ---
  const handleAbsenceSave = async (record) => {
    if (!db || !userId) return;
    const outRecordsCollectionPath = `/artifacts/${appId}/users/${userId}/outRecords`;
    if (record.id) {
        const docRef = doc(db, outRecordsCollectionPath, record.id);
        await updateDoc(docRef, record);
    } else {
        await addDoc(collection(db, outRecordsCollectionPath), record);
    }
  };

  const handleGroupAbsenceSave = async ({ records, groupIdToEdit }) => {
    if (!db || !userId) return;
    const outRecordsCollectionPath = `/artifacts/${appId}/users/${userId}/outRecords`;
    const batch = writeBatch(db);

    if (groupIdToEdit) {
        const q = query(collection(db, outRecordsCollectionPath), where("groupId", "==", groupIdToEdit));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
    }

    records.forEach(record => {
        const newDocRef = doc(collection(db, outRecordsCollectionPath));
        batch.set(newDocRef, record);
    });

    await batch.commit();
  };
  
  const handleAbsenceRemove = async (recordId) => {
    if (!db || !userId) return;
    const docRef = doc(db, `/artifacts/${appId}/users/${userId}/outRecords`, recordId);
    await deleteDoc(docRef);
  };
  
  const handleGroupAbsenceDelete = async (groupId) => {
    if (!db || !userId) return;
    const outRecordsCollectionPath = `/artifacts/${appId}/users/${userId}/outRecords`;
    const q = query(collection(db, outRecordsCollectionPath), where("groupId", "==", groupId));
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();
  };


  // --- Settings Logic (People) ---
  const handleAddPerson = async (e) => {
    e.preventDefault();
    if (!db || !userId) return;

    const nameInput = e.target.name.value.trim().split(' ');
    const firstName = nameInput.shift() || '';
    const lastName = nameInput.join(' ');

    const newPerson = {
      firstName: firstName,
      lastName: lastName,
      type: e.target.type.value,
      email: e.target.email.value,
    };

    try {
        const peopleCollectionPath = `/artifacts/${appId}/users/${userId}/people`;
        await addDoc(collection(db, peopleCollectionPath), newPerson);
        e.target.reset();
    } catch (error) {
        console.error("Error adding person to Firestore:", error);
    }
  };

  const handleEditPerson = async (e, id) => {
    e.preventDefault();
    if (!db || !userId) return;

    const nameInput = e.target.name.value.trim().split(' ');
    const firstName = nameInput.shift() || '';
    const lastName = nameInput.join(' ');

    const updatedPersonData = {
        firstName: firstName,
        lastName: lastName,
        type: e.target.type.value,
        email: e.target.email.value,
    };
    
    try {
        const personDocRef = doc(db, `/artifacts/${appId}/users/${userId}/people`, id);
        await updateDoc(personDocRef, updatedPersonData);
        setEditingPerson(null);
    } catch (error) {
        console.error("Error updating person:", error);
    }
  };

  const handleRemovePerson = async (id) => {
    if (!db || !userId) return;
    try {
        const personDocRef = doc(db, `/artifacts/${appId}/users/${userId}/people`, id);
        await deleteDoc(personDocRef);
    } catch (error) {
        console.error("Error removing person:", error);
    }
  };

  // --- Settings Logic (Sections) ---
  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!db || !userId) return;

    const newSection = {
      name: e.target.name.value,
      startTime: e.target.startTime.value,
      duration: parseInt(e.target.duration.value, 10) || 60,
    };

    try {
        const sectionsCollectionPath = `/artifacts/${appId}/users/${userId}/sections`;
        await addDoc(collection(db, sectionsCollectionPath), newSection);
        e.target.reset();
    } catch (error) {
        console.error("Error adding section:", error);
    }
  };

  const handleEditSection = async (e, id) => {
    e.preventDefault();
    if (!db || !userId) return;

    const updatedSectionData = {
        name: e.target.name.value,
        startTime: e.target.startTime.value,
        duration: parseInt(e.target.duration.value, 10) || 60,
    };

    try {
        const sectionDocRef = doc(db, `/artifacts/${appId}/users/${userId}/sections`, id);
        await updateDoc(sectionDocRef, updatedSectionData);
        setEditingSection(null);
    } catch (error) {
        console.error("Error updating section:", error);
    }
  };

  const handleRemoveSection = async (id) => {
    if (!db || !userId) return;
    try {
        const sectionDocRef = doc(db, `/artifacts/${appId}/users/${userId}/sections`, id);
        await deleteDoc(sectionDocRef);
    } catch (error) {
        console.error("Error removing section:", error);
    }
  };
  
  // --- Daily Schedule Overrides Logic ---
  const openOverrideModal = (sectionId, currentTime) => {
    setScheduleOverrideModal({
      isOpen: true,
      sectionId: sectionId,
      newTime: currentTime || '',
      date: selectedDate, // Initialize with the currently selected date
    });
  };

  const handleSaveOverride = () => {
    const { sectionId, newTime, date } = scheduleOverrideModal;
    if (!sectionId || !newTime || !date) return;

    setDailyScheduleOverrides(prev => {
        const filteredOverrides = prev.filter(o => !(o.date === date && o.sectionId === sectionId));
        return [...filteredOverrides, { date, sectionId, newTime }];
    });
    setScheduleOverrideModal({ isOpen: false, sectionId: null, newTime: '', date: '' });
  };
  
  const handleRemoveOverride = (sectionId, date) => {
    setDailyScheduleOverrides(prev => prev.filter(o => !(o.date === date && o.sectionId === sectionId)));
    setScheduleOverrideModal({ isOpen: false, sectionId: null, newTime: '', date: '' });
  };

  const handleDateChange = (days) => {
    const currentDateObj = new Date(selectedDate);
    currentDateObj.setUTCDate(currentDateObj.getUTCDate() + days);
    setSelectedDate(currentDateObj.toISOString().split('T')[0]);
  };
  
  const handlePrint = (elementId) => {
    const printElement = document.getElementById(elementId);
    if (!printElement) {
        console.error("Element to print not found:", elementId);
        return;
    }
    
    const printContents = printElement.innerHTML;
    const printWindow = window.open('', '', 'height=800,width=1000');
    
    printWindow.document.write('<html><head><title>Print Report</title>');
    
    printWindow.document.write(`
      <style>
        body { font-family: sans-serif; background-color: #ffffff !important; color: #111827 !important; }
        .no-print { display: none !important; }
        .printable-container { background-color: #ffffff !important; border: 1px solid #e5e7eb; border-radius: 0.5rem !important; padding: 1.5rem !important; }
        h2 { font-size: 1.75rem; font-weight: bold; margin-bottom: 1.5rem; }
        h3 { font-size: 1.25rem; font-weight: bold; margin-bottom: 1rem; color: #111827 !important;}
        .font-bold { font-weight: 700 !important; }
        #dashboard-report-printable ul { list-style: none; padding: 0; }
        #dashboard-report-printable li { background-color: #f9fafb !important; border: 1px solid #e5e7eb !important; border-radius: 0.375rem !important; padding: 1rem !important; margin-bottom: 0.75rem !important; }
        #dashboard-report-printable li button { display: flex !important; justify-content: space-between !important; align-items: center; width: 100% !important; background-color: transparent !important; border: none !important; padding: 0 !important; font-size: 1rem; }
        #comprehensive-report-printable .summary-grid { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 1rem !important; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1.5rem; }
        #comprehensive-report-printable .summary-grid > div { text-align: center; }
        #comprehensive-report-printable .summary-grid .stat-label { font-size: 0.875rem; color: #6b7280; }
        #comprehensive-report-printable .summary-grid .stat-value { font-size: 1.875rem; font-weight: bold; }
        #comprehensive-report-printable .per-class-list { list-style: none; padding: 0; }
        #comprehensive-report-printable .per-class-list li { background-color: #f9fafb !important; border: 1px solid #e5e7eb !important; border-radius: 0.375rem !important; padding: 0.75rem !important; margin-bottom: 0.5rem !important; display: grid !important; grid-template-columns: 1fr 1fr 1fr !important; align-items: center; }
        .recharts-wrapper { }
        .recharts-cartesian-axis-tick-value, .recharts-legend-item-text, .recharts-tooltip-label, .recharts-tooltip-item { fill: #374151 !important; }
        .recharts-cartesian-grid-line, .recharts-line-line { stroke: #d1d5db !important; }
      </style>
    `);
    
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContents);
    printWindow.document.write('</body></html>');
    printWindow.document.close();

    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }, 500);
  };

  const handleSortChange = async (newSortField) => {
    setSortField(newSortField);
    if (!db || !userId) return;
    const settingsDocRef = doc(db, `/artifacts/${appId}/users/${userId}/settings/userPreferences`);
    try {
        await setDoc(settingsDocRef, { sortField: newSortField }, { merge: true });
    } catch (e) {
        console.error("Error saving sort preference:", e);
    }
  };

  // --- Main App Render ---
  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">

        {/* --- Header --- */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 no-print">
          <div>
            <h1 className="text-3xl font-bold text-white">{currentDate}</h1>
            <p className="text-lg text-gray-400">{hebrewDate}</p>
          </div>
          <div className="flex items-center gap-2 mt-4 sm:mt-0">
            {view === 'main' ? (
                <button onClick={() => setView('reportsDashboard')} className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                    <AreaChart size={20} />
                    <span>Reports</span>
                </button>
            ) : (
                 <button onClick={() => setView('main')} className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                    <LayoutGrid size={20} />
                    <span>Back to Main</span>
                </button>
            )}
            <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                <Settings2 size={20} />
                <span>Settings</span>
            </button>
          </div>
        </header>

        {/* --- Controls --- */}
        {view === 'main' && (
            <div className="bg-gray-800 p-4 rounded-lg mb-6 flex flex-col md:flex-row items-center justify-between gap-4 flex-wrap no-print">
                <div className="flex items-center gap-2">
                    <button onClick={() => handleDateChange(-1)} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600"><ChevronLeft size={20}/></button>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-gray-700 border-gray-600 rounded-lg px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500" />
                    <button onClick={() => handleDateChange(1)} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600"><ChevronRight size={20}/></button>
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="period-filter" className="text-gray-400 text-sm">Period:</label>
                    <select id="period-filter" value={selectedPeriodFilter} onChange={(e) => setSelectedPeriodFilter(e.target.value)} className="bg-gray-700 border-gray-600 rounded-lg px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500">
                        <option value="all">All Periods</option>
                        {sections.map(s => (<option key={s.id} value={s.id}>{`${s.name} (${s.startTime})`}</option>))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="sort-filter" className="text-gray-400 text-sm">Sort By:</label>
                    <select id="sort-filter" value={sortField} onChange={(e) => handleSortChange(e.target.value)} className="bg-gray-700 border-gray-600 rounded-lg px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500">
                        <option value="lastName">Last Name</option>
                        <option value="firstName">First Name</option>
                        <option value="note" disabled={selectedPeriodFilter === 'all'}>Note</option>
                    </select>
                </div>
                <div className="relative w-full md:w-auto">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Search names..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-gray-700 border-gray-600 rounded-lg pl-10 pr-4 py-2 w-full md:w-64 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <button onClick={() => setIsGroupAbsenceModalOpen(true)} className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full hover:bg-gray-600"><Users size={16} /> Group Absence</button>
                    <button onClick={handleUndo} disabled={attendanceHistory.length === 0} className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"><Undo size={16} /> Undo</button>
                    <button onClick={handleRedo} disabled={redoHistory.length === 0} className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"><RotateCw size={16} /> Redo</button>
                </div>
            </div>
        )}

        {/* --- Main Content: Grid or Summary --- */}
        {view === 'main' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                <tr>
                  <th className="sticky left-0 bg-gray-800 py-3.5 px-4 text-left text-sm font-semibold text-white z-10">Name</th>
                  {filteredSectionsForView.map(section => {
                     const now = new Date();
                     const todayString = getTodayString();
                     const currentTime = now.getHours() * 60 + now.getMinutes();
                     const [startHour, startMinute] = section.startTime.split(':').map(Number);
                     const sectionTime = startHour * 60 + startMinute;
                     const isPast = new Date(selectedDate) < new Date(todayString) || (selectedDate === todayString && currentTime >= sectionTime + section.duration);
                    return (
                        <th key={section.id} className={`py-3.5 px-4 text-center text-sm font-semibold text-white ${section.id === currentSectionId ? 'bg-blue-900' : ''}`}>
                          <div className="flex flex-col items-center">
                            <span>{section.name}</span>
                            <span className={`text-xs ${overrideForActiveSection && overrideForActiveSection.sectionId === section.id ? 'text-yellow-400' : 'text-gray-400'}`}>{section.startTime}</span>
                            <button onClick={() => openOverrideModal(section.id, section.startTime)} className="text-gray-500 hover:text-yellow-400"><Pencil size={12}/></button>
                             {isPast && (
                                <button onClick={() => handleUnmarkAll(section.id)} className="mt-1 text-xs bg-gray-600 hover:bg-gray-500 px-2 py-0.5 rounded-md">
                                    Unmark All
                                </button>
                            )}
                          </div>
                        </th>
                    )
                  })}
                  <th className="py-3.5 px-4 text-left text-sm font-semibold text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-800/50">
                {sortedStudents.map(person => (
                  <tr key={person.id} className="hover:bg-gray-700/50">
                    <td className="sticky left-0 bg-gray-800/50 py-4 px-4 text-sm font-medium text-white whitespace-nowrap z-10">{`${person.firstName} ${person.lastName}`}</td>
                    {filteredSectionsForView.map(section => {
                        const now = new Date();
                        const todayString = getTodayString();
                        const currentTime = now.getHours() * 60 + now.getMinutes();
                        const [startHour, startMinute] = section.startTime.split(':').map(Number);
                        const sectionTime = startHour * 60 + startMinute;
                        const isPast = new Date(selectedDate) < new Date(todayString) || (selectedDate === todayString && currentTime >= sectionTime + section.duration);
                      return (
                      <td key={section.id} className="py-2 px-2 text-sm text-gray-300 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <AttendanceStatusSelector personId={person.id} sectionId={section.id} date={selectedDate} onAttendanceChange={handleAttendanceChange} initialStatus={getAttendanceStatus(person.id, section, selectedDate, dailyAttendance)} isPast={isPast} />
                            <button onClick={() => setEditingPersistentNote({personId: person.id, sectionId: section.id})} className="text-gray-500 hover:text-blue-400" title="Add/Edit Persistent Note"><MessageSquarePlus size={16} /></button>
                        </div>
                        {persistentNotes[person.id]?.[section.id] && <p className="mt-1 text-xs text-cyan-400 bg-gray-900/50 rounded-md px-2 py-0.5 max-w-xs mx-auto truncate" title={persistentNotes[person.id][section.id]}>{persistentNotes[person.id][section.id]}</p>}
                      </td>
                    )})}
                    <td className="py-4 px-4 text-sm font-medium whitespace-nowrap">
                      <div className="flex items-center gap-2">
                         <button onClick={() => setManagingAbsences({ isOpen: true, personId: person.id })} className="p-2 text-gray-400 hover:text-blue-400" title="Manage Absences"><CalendarX size={18} /></button>
                         <button onClick={() => { setView('summary'); setSelectedPersonId(person.id); }} className="p-2 text-gray-400 hover:text-green-400" title="View Summary"><FileText size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                 <tr><td colSpan={filteredSectionsForView.length + 2} className="py-2 bg-gray-800 text-center font-bold text-gray-400">Shluchim</td></tr>
                 {sortedShluchim.map(person => (
                  <tr key={person.id} className="hover:bg-gray-700/50">
                    <td className="sticky left-0 bg-gray-800/50 py-4 px-4 text-sm font-medium text-white whitespace-nowrap z-10">{`${person.firstName} ${person.lastName}`}</td>
                    {filteredSectionsForView.map(section => {
                        const now = new Date();
                        const todayString = getTodayString();
                        const currentTime = now.getHours() * 60 + now.getMinutes();
                        const [startHour, startMinute] = section.startTime.split(':').map(Number);
                        const sectionTime = startHour * 60 + startMinute;
                        const isPast = new Date(selectedDate) < new Date(todayString) || (selectedDate === todayString && currentTime >= sectionTime + section.duration);
                      return (
                      <td key={section.id} className="py-2 px-2 text-sm text-gray-300 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <AttendanceStatusSelector personId={person.id} sectionId={section.id} date={selectedDate} onAttendanceChange={handleAttendanceChange} initialStatus={getAttendanceStatus(person.id, section, selectedDate, dailyAttendance)} isPast={isPast} />
                           <button onClick={() => setEditingPersistentNote({personId: person.id, sectionId: section.id})} className="text-gray-500 hover:text-blue-400" title="Add/Edit Persistent Note"><MessageSquarePlus size={16} /></button>
                        </div>
                         {persistentNotes[person.id]?.[section.id] && <p className="mt-1 text-xs text-cyan-400 bg-gray-900/50 rounded-md px-2 py-0.5 max-w-xs mx-auto truncate" title={persistentNotes[person.id][section.id]}>{persistentNotes[person.id][section.id]}</p>}
                      </td>
                    )})}
                    <td className="py-4 px-4 text-sm font-medium whitespace-nowrap">
                      <div className="flex items-center gap-2">
                         <button onClick={() => setManagingAbsences({ isOpen: true, personId: person.id })} className="p-2 text-gray-400 hover:text-blue-400" title="Manage Absences"><CalendarX size={18} /></button>
                         <button onClick={() => { setView('summary'); setSelectedPersonId(person.id); }} className="p-2 text-gray-400 hover:text-green-400" title="View Summary"><FileText size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'reportsDashboard' && (
            <ReportsDashboard
                people={people}
                sections={sections}
                attendanceData={allAttendanceData}
                outRecords={outRecords}
                dailyScheduleOverrides={dailyScheduleOverrides}
                onSelectPerson={(personId) => {
                    setSelectedPersonId(personId);
                    setView('summary');
                }}
                onBack={() => setView('main')}
                onPrint={handlePrint}
            />
        )}

        {view === 'summary' && selectedPersonId && (
            <ComprehensiveStudentReport 
                personId={selectedPersonId}
                people={people}
                sections={sections}
                persistentNotes={persistentNotes}
                attendanceData={allAttendanceData}
                outRecords={outRecords}
                dailyScheduleOverrides={dailyScheduleOverrides}
                onBack={() => setView('reportsDashboard')}
                onPrint={handlePrint}
            />
        )}

        {isGroupAbsenceModalOpen && (
            <GroupAbsenceModal
                people={people}
                sections={sections}
                outRecords={outRecords}
                onClose={() => setIsGroupAbsenceModalOpen(false)}
                onSave={handleGroupAbsenceSave}
                onDelete={handleGroupAbsenceDelete}
            />
        )}

        {managingAbsences.isOpen && (
            <AbsenceManagementModal
                person={people.find(p => p.id === managingAbsences.personId)}
                sections={sections}
                personRecords={outRecords.filter(r => r.personId === managingAbsences.personId)}
                onClose={() => setManagingAbsences({ isOpen: false, personId: null })}
                onSave={handleAbsenceSave}
                onDelete={handleAbsenceRemove}
            />
        )}

        {editingPersistentNote && (
            <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
                <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
                    <h3 className="text-xl font-bold mb-4">
                        Persistent Note for {people.find(p => p.id === editingPersistentNote.personId)?.firstName}
                        <br/>
                        in {sections.find(s => s.id === editingPersistentNote.sectionId)?.name}
                    </h3>
                    <textarea
                        defaultValue={persistentNotes[editingPersistentNote.personId]?.[editingPersistentNote.sectionId] || ''}
                        onBlur={(e) => handlePersistentNoteSave(editingPersistentNote.personId, editingPersistentNote.sectionId, e.target.value)}
                        placeholder="e.g., Goes to Rabbi Goodman"
                        className="w-full bg-gray-700 rounded-md p-2 h-24 text-white"
                    />
                    <div className="mt-4 flex justify-end">
                        <button onClick={() => setEditingPersistentNote(null)} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">Done</button>
                    </div>
                </div>
            </div>
        )}

        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex justify-center items-center p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 rounded-full hover:bg-gray-700"><XCircle size={24}/></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Manage People */}
                <div>
                  <h3 className="text-xl font-semibold mb-3">Manage People</h3>
                  <form onSubmit={handleAddPerson} className="space-y-4 bg-gray-700/50 p-4 rounded-lg">
                      <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                          <input name="name" type="text" placeholder="e.g., Rivka Cohen" required className="w-full bg-gray-700 rounded-md p-2"/>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                          <textarea name="email" placeholder="e.g., student@example.com, parent@example.com" required className="w-full bg-gray-700 rounded-md p-2 h-20"/>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                          <select name="type" className="w-full bg-gray-700 rounded-md p-2">
                              <option value="student">Student</option>
                              <option value="shliach">Shliach</option>
                          </select>
                      </div>
                      <button type="submit" className="w-full flex justify-center items-center gap-2 bg-blue-600 p-2 rounded-md hover:bg-blue-700">
                          <Plus size={20}/> Add Person
                      </button>
                  </form>
                  <div className="mt-4 space-y-2">
                      {people.map(p => (
                          <div key={p.id} className="bg-gray-700 p-3 rounded-md">
                              {editingPerson === p.id ? (
                                  <form onSubmit={(e) => handleEditPerson(e, p.id)} className="w-full space-y-3">
                                      <div>
                                          <label className="text-xs text-gray-400">Full Name</label>
                                          <input name="name" defaultValue={`${p.firstName} ${p.lastName}`} className="w-full bg-gray-900 rounded-md p-2 text-sm"/>
                                      </div>
                                       <div>
                                          <label className="text-xs text-gray-400">Email</label>
                                          <textarea name="email" defaultValue={p.email} className="w-full bg-gray-900 rounded-md p-2 text-sm h-20"/>
                                      </div>
                                      <div>
                                          <label className="text-xs text-gray-400">Type</label>
                                          <select name="type" defaultValue={p.type} className="w-full bg-gray-900 rounded-md p-2 text-sm">
                                              <option value="student">Student</option>
                                              <option value="shliach">Shliach</option>
                                          </select>
                                      </div>
                                      <div className="flex justify-end gap-2 mt-2">
                                          <button type="button" onClick={() => setEditingPerson(null)} className="px-3 py-1 bg-gray-600 rounded-md text-sm">Cancel</button>
                                          <button type="submit" className="px-3 py-1 bg-green-600 rounded-md text-sm">Save</button>
                                      </div>
                                  </form>
                              ) : (
                                  <div className="flex justify-between items-center">
                                      <span>{`${p.firstName} ${p.lastName}`} <span className="text-xs text-gray-400">({p.type})</span></span>
                                      <div className="flex gap-2">
                                          <button onClick={() => setEditingPerson(p.id)} className="text-gray-400 hover:text-yellow-400"><Pencil size={18}/></button>
                                          <button onClick={() => handleRemovePerson(p.id)} className="text-gray-400 hover:text-red-400"><Trash2 size={18}/></button>
                                      </div>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
                </div>
                {/* Manage Sections */}
                <div>
                  <h3 className="text-xl font-semibold mb-3">Manage Schedule Sections</h3>
                  <form onSubmit={handleAddSection} className="space-y-4 bg-gray-700/50 p-4 rounded-lg">
                      <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Section Name</label>
                          <input name="name" type="text" placeholder="e.g., Class 1" required className="w-full bg-gray-700 rounded-md p-2"/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
                              <input name="startTime" type="time" required className="w-full bg-gray-700 rounded-md p-2"/>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-300 mb-1">Duration (min)</label>
                              <input name="duration" type="number" placeholder="e.g., 50" required className="w-full bg-gray-700 rounded-md p-2"/>
                          </div>
                      </div>
                      <button type="submit" className="w-full flex justify-center items-center gap-2 bg-blue-600 p-2 rounded-md hover:bg-blue-700">
                          <Plus size={20}/> Add Section
                      </button>
                  </form>
                   <div className="mt-4 space-y-2">
                      {sections.map(s => (
                          <div key={s.id} className="bg-gray-700 p-3 rounded-md">
                               {editingSection === s.id ? (
                                  <form onSubmit={(e) => handleEditSection(e, s.id)} className="w-full space-y-3">
                                      <div>
                                          <label className="text-xs text-gray-400">Section Name</label>
                                          <input name="name" defaultValue={s.name} className="w-full bg-gray-900 rounded-md p-2 text-sm"/>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                          <div>
                                              <label className="text-xs text-gray-400">Start Time</label>
                                              <input name="startTime" type="time" defaultValue={s.startTime} className="w-full bg-gray-900 rounded-md p-2 text-sm"/>
                                          </div>
                                          <div>
                                              <label className="text-xs text-gray-400">Duration</label>
                                              <input name="duration" type="number" defaultValue={s.duration} className="w-full bg-gray-900 rounded-md p-2 text-sm"/>
                                          </div>
                                      </div>
                                      <div className="flex justify-end gap-2 mt-2">
                                          <button type="button" onClick={() => setEditingSection(null)} className="px-3 py-1 bg-gray-600 rounded-md text-sm">Cancel</button>
                                          <button type="submit" className="px-3 py-1 bg-green-600 rounded-md text-sm">Save</button>
                                      </div>
                                  </form>
                              ) : (
                                <div className="flex justify-between items-center">
                                  <span>{s.name} ({s.startTime}) - {s.duration} min</span>
                                  <div className="flex gap-2">
                                      <button onClick={() => setEditingSection(s.id)} className="text-gray-400 hover:text-yellow-400"><Pencil size={18}/></button>
                                      <button onClick={() => handleRemoveSection(s.id)} className="text-gray-400 hover:text-red-400"><Trash2 size={18}/></button>
                                  </div>
                                </div>
                              )}
                          </div>
                      ))}
                  </div>
                   <h3 className="text-xl font-semibold mt-8 mb-3">Email Settings</h3>
                   <div className="space-y-4 bg-gray-700/50 p-4 rounded-lg">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Report Frequency</label>
                             <select value={emailFrequency} onChange={(e) => setEmailFrequency(e.target.value)} className="w-full bg-gray-700 rounded-md p-2">
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="never">Never</option>
                            </select>
                        </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {scheduleOverrideModal.isOpen && (
             <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
                <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6">
                    <h3 className="text-xl font-bold mb-4">Change Time for {sections.find(s => s.id === scheduleOverrideModal.sectionId)?.name}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                            <input 
                                type="date" 
                                value={scheduleOverrideModal.date} 
                                onChange={(e) => setScheduleOverrideModal(prev => ({...prev, date: e.target.value}))} 
                                className="w-full bg-gray-700 rounded-md p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">New Start Time</label>
                            <input 
                              type="time" 
                              value={scheduleOverrideModal.newTime} 
                              onChange={(e) => setScheduleOverrideModal(prev => ({...prev, newTime: e.target.value}))} 
                              className="w-full bg-gray-700 rounded-md p-2"
                            />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-between items-center">
                        <button onClick={() => handleRemoveOverride(scheduleOverrideModal.sectionId, scheduleOverrideModal.date)} className="text-red-400 hover:text-red-500 text-sm">Remove Override</button>
                        <div className="flex gap-3">
                            <button onClick={() => setScheduleOverrideModal({isOpen: false, sectionId: null, newTime: '', date: ''})} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-700">Cancel</button>
                            <button onClick={handleSaveOverride} className="px-4 py-2 bg-yellow-600 rounded-lg hover:bg-yellow-700">Save Time</button>
                        </div>
                    </div>
                </div>
             </div>
        )}

      </div>
    </div>
  );
};

export default App;