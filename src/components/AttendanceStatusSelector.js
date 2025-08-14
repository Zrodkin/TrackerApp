import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, MinusCircle, XCircle, Pencil } from 'lucide-react';
import { formatMinutes } from '../utils'; // Assuming formatMinutes is in utils

const AttendanceStatusSelector = ({ personId, sectionId, date, onAttendanceChange, initialStatus, isPast }) => {
  const { status, minutesLate: initialMinutesLate, note: initialNote, isDailyNote } = initialStatus;

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [tempNoteText, setTempNoteText] = useState(initialNote || '');

  useEffect(() => { setTempNoteText(initialNote || ''); }, [initialNote]);

  const [isEditingLateness, setIsEditingLateness] = useState(false);
  const [manualMinutesLate, setManualMinutesLate] = useState(initialMinutesLate);

  useEffect(() => { setManualMinutesLate(initialMinutesLate); }, [initialMinutesLate]);

  // Optional: Expand if marked or past
  const [isExpanded, setIsExpanded] = useState(initialStatus.status !== 'Unmarked' && (initialStatus.status !== 'Not Marked' || !isPast));

  if (isDailyNote) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-600 bg-opacity-100 text-white flex items-center gap-1" title={initialNote || 'Excused'}>
          <MinusCircle size={16} /> <span className="hidden sm:inline">Excused</span>
        </span>
      </div>
    );
  }

  const handleStatusClick = (s) => {
    const note = s === 'Excused' ? tempNoteText : null;
    const minutes = s === 'Late' ? manualMinutesLate : 0;
    onAttendanceChange(personId, sectionId, s, note, minutes);
  };

  const handleExcusedNoteSave = () => {
    onAttendanceChange(personId, sectionId, 'Excused', tempNoteText, 0);
    setIsEditingNote(false);
  };

  const handleLatenessSave = () => {
    onAttendanceChange(personId, sectionId, 'Late', null, manualMinutesLate);
    setIsEditingLateness(false);
  };

  const StatusButton = ({ s, label, icon, className }) => (
    <button
      onClick={() => handleStatusClick(s)}
      className={`p-2 rounded-full transition-colors ${status === s ? className + ' text-white' : 'bg-gray-700 text-gray-400 hover:' + className}`}
      title={label}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex items-center gap-1">
      <StatusButton s="On Time" label="On Time" icon={<CheckCircle size={16} />} className="bg-green-600" />
      <StatusButton s="Late" label="Late" icon={<Clock size={16} />} className="bg-yellow-500" />
      <StatusButton s="Excused" label="Excused" icon={<MinusCircle size={16} />} className="bg-blue-600" />
      {isPast && <StatusButton s="Absent" label="Absent" icon={<XCircle size={16} />} className="bg-red-600" />}
      {status === 'Excused' && (
        <div className="relative">
          <button onClick={() => setIsEditingNote(!isEditingNote)} className={`p-2 rounded-full transition-colors ${isEditingNote ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`} title="Edit Excused Note">
            <Pencil size={16} />
          </button>
          {isEditingNote && (
            <div className="absolute z-20 right-0 top-full mt-2 p-3 bg-gray-800 rounded-lg shadow-lg w-64 border border-gray-700">
              <textarea
                className="w-full h-16 p-2 text-sm bg-gray-900 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add excused note..."
                value={tempNoteText}
                onChange={(e) => setTempNoteText(e.target.value)}
              ></textarea>
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
              <input
                type="number"
                className="w-full p-2 text-sm bg-gray-900 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                value={manualMinutesLate}
                onChange={(e) => setManualMinutesLate(parseInt(e.target.value) || 0)}
              />
              <button onClick={handleLatenessSave} className="mt-2 w-full bg-yellow-600 text-white py-1 rounded-md text-sm hover:bg-yellow-700 transition-colors">Save</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceStatusSelector;