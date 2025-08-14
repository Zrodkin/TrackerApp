import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, MinusCircle, XCircle, Pencil, CircleSlash } from 'lucide-react';
import { formatMinutes } from '../utils';

const AttendanceStatusSelector = ({ personId, sectionId, date, onAttendanceChange, initialStatus, isPast }) => {
  const { status, minutesLate: initialMinutesLate, note: initialNote, isDailyNote } = initialStatus;

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [tempNoteText, setTempNoteText] = useState(initialNote || '');

  useEffect(() => { setTempNoteText(initialNote || ''); }, [initialNote]);

  const [isEditingLateness, setIsEditingLateness] = useState(false);
  const [manualMinutesLate, setManualMinutesLate] = useState(initialMinutesLate);

  useEffect(() => { setManualMinutesLate(initialMinutesLate); }, [initialMinutesLate]);

  const [isExpanded, setIsExpanded] = useState(initialStatus.status !== 'Unmarked' && (initialStatus.status !== 'Not Marked' || !isPast));

  if (isDailyNote) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-600 bg-opacity-100 text-white flex items-center gap-1" title={initialNote || 'Excused'}>
          <MinusCircle size={16} /> <span className="hidden sm:inline">Excused</span>
        </span>
        {initialNote && <p className="mt-1 text-xs text-blue-300 max-w-[100px] truncate" title={initialNote}>{initialNote}</p>}
      </div>
    );
  }

  if (!isExpanded) {
    return (
        <button onClick={() => setIsExpanded(true)} className="px-3 py-1 rounded-full text-sm font-medium bg-gray-600 text-gray-300 hover:bg-gray-500 flex items-center gap-1">
            <CircleSlash size={16} /> <span className="hidden sm:inline">{status === 'Unmarked' ? 'Unmarked' : 'Mark'}</span>
        </button>
    )
  }

  const handleExcusedNoteSave = () => {
    onAttendanceChange(personId, sectionId, 'Excused', tempNoteText);
    setIsEditingNote(false);
    setIsExpanded(false);
  };

  const handleEditNoteOpen = () => {
      setTempNoteText(initialNote || '');
      setIsEditingNote(true);
  };

  const handleLatenessSave = () => {
    let newMinutes = parseInt(manualMinutesLate, 10) || 0;
    newMinutes = Math.min(newMinutes, 50);
    onAttendanceChange(personId, sectionId, 'Late', null, newMinutes);
    setIsEditingLateness(false);
    setIsExpanded(false);
  };

  const handleStatusClick = (newStatus) => {
      const finalStatus = status === newStatus ? 'Not Marked' : newStatus;
      onAttendanceChange(personId, sectionId, finalStatus, finalStatus === 'Excused' ? initialNote : null);
      setIsEditingNote(false);
      if (initialStatus.status === 'Unmarked' || initialStatus.status === 'Not Marked') setIsExpanded(false);
  };

  const StatusButton = ({ s, label, icon, className }) => (
    <button onClick={() => handleStatusClick(s)} className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${status === s ? `bg-opacity-100 text-white ${className}` : `bg-gray-700 bg-opacity-50 text-gray-400 hover:bg-opacity-70`} flex items-center gap-1`}>
      {icon} <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative flex items-center space-x-1">
          <StatusButton s="On Time" label="On Time" icon={<CheckCircle size={16} />} className="bg-green-600" />
          <StatusButton s="Late" label="Late" icon={<Clock size={16} />} className="bg-yellow-500" />
          <StatusButton s="Excused" label="Excused" icon={<MinusCircle size={16} />} className="bg-blue-600" />
          {isPast && <StatusButton s="Absent" label="Absent" icon={<XCircle size={16} />} className="bg-red-600" />}
          {status === 'Excused' && (
            <div className="relative">
              <button onClick={handleEditNoteOpen} className={`p-2 rounded-full transition-colors ${isEditingNote ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`} title="Edit Excused Note"><Pencil size={16} /></button>
              {isEditingNote && (
                <div className="absolute z-20 right-0 top-full mt-2 p-3 bg-gray-800 rounded-lg shadow-lg w-64 border border-gray-700">
                  <textarea className="w-full h-16 p-2 text-sm bg-gray-900 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Add excused note..." value={tempNoteText} onChange={(e) => setTempNoteText(e.target.value)}></textarea>
                  <button onClick={handleExcusedNoteSave} className="mt-2 w-full bg-blue-600 text-white py-1 rounded-md text-sm hover:bg-blue-700 transition-colors">Save Note</button>
                </div>
              )}
            </div>
          )}
          {status === 'Late' && (
            <div className="relative">
              <button onClick={() => setIsEditingLateness(!isEditingLateness)} className={`p-2 rounded-full transition-colors ${isEditingLateness ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`} title="Edit Lateness">
                <span className="text-xs font-bold">{initialMinutesLate > 0 ? formatMinutes(initialMinutesLate) : <Clock size={16} />}</span>
              </button>
              {isEditingLateness && (
                <div className="absolute z-20 right-0 top-full mt-2 p-3 bg-gray-800 rounded-lg shadow-lg w-48 border border-gray-700">
                  <label className="block text-xs text-gray-400 mb-1">Minutes Late</label>
                  <input type="number" className="w-full p-2 text-sm bg-gray-900 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500" value={manualMinutesLate} onChange={(e) => setManualMinutesLate(e.target.value)} />
                  <button onClick={handleLatenessSave} className="mt-2 w-full bg-yellow-600 text-white py-1 rounded-md text-sm hover:bg-yellow-700 transition-colors">Save</button>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
};

export default AttendanceStatusSelector;