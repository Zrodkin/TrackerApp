import React, { useState, useMemo } from 'react';
import { Pencil, Trash2, XCircle, Search, Check } from 'lucide-react';

import { getTodayString, generateId } from '../utils';

const GroupAbsenceModal = ({ people, sections, outRecords, onClose, onSave, onDelete }) => {
    const [mode, setMode] = useState('list');
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [selectedPeopleIds, setSelectedPeopleIds] = useState([]);
    const [groupSearchQuery, setGroupSearchQuery] = useState('');
    const [formState, setFormState] = useState({
        startDate: getTodayString(),
        endDate: getTodayString(),
        startSectionId: sections.length > 0 ? sections[0].id : '',
        endSectionId: sections.length > 0 ? sections[sections.length - 1].id : '',
        note: '',
    });
    const [validationError, setValidationError] = useState('');
    const [activeTab, setActiveTab] = useState('upcoming');

    const groupAbsences = useMemo(() => {
        const groups = {};
        if (outRecords) {
            outRecords.forEach(record => {
                if (record.groupId) {
                    if (!groups[record.groupId]) {
                        groups[record.groupId] = { ...record, people: [] };
                    }
                    groups[record.groupId].people.push(record.personId);
                }
            });
        }
        return Object.values(groups);
    }, [outRecords]);

    const { upcomingAbsences, pastAbsences } = useMemo(() => {
        const today = getTodayString();
        const upcoming = groupAbsences.filter(g => g.endDate >= today);
        const past = groupAbsences.filter(g => g.endDate < today);
        return { upcomingAbsences: upcoming, pastAbsences: past };
    }, [groupAbsences]);

    const filteredPeopleForGroupModal = useMemo(() => {
        if (!groupSearchQuery) return people;
        const lowerCaseQuery = groupSearchQuery.toLowerCase();
        return people.filter(p => p.firstName.toLowerCase().includes(lowerCaseQuery) || p.lastName.toLowerCase().includes(lowerCaseQuery));
    }, [groupSearchQuery, people]);

    const handlePersonSelection = (personId) => {
        setSelectedPeopleIds(prev => prev.includes(personId) ? prev.filter(id => id !== personId) : [...prev, personId]);
    };

    const handleSelectAll = () => {
        const filteredIds = filteredPeopleForGroupModal.map(p => p.id);
        const allFilteredSelected = filteredIds.every(id => selectedPeopleIds.includes(id));
        if (allFilteredSelected) {
            setSelectedPeopleIds(prev => prev.filter(id => !filteredIds.includes(id)));
        } else {
            setSelectedPeopleIds(prev => [...new Set([...prev, ...filteredIds])]);
        }
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveClick = () => {
        if (selectedPeopleIds.length === 0) {
            setValidationError("Please select at least one person.");
            return;
        }
        if (new Date(formState.startDate) > new Date(formState.endDate)) {
            setValidationError("End date cannot be before start date.");
            return;
        }
        const groupId = editingGroupId || generateId();
        const newRecords = selectedPeopleIds.map(personId => ({ ...formState, personId, id: generateId(), groupId }));
        onSave({ records: newRecords, groupIdToEdit: editingGroupId });
        onClose();
    };

    const handleAddNew = () => {
        setEditingGroupId(null);
        setSelectedPeopleIds([]);
        setFormState({
            startDate: getTodayString(),
            endDate: getTodayString(),
            startSectionId: sections.length > 0 ? sections[0].id : '',
            endSectionId: sections.length > 0 ? sections[sections.length - 1].id : '',
            note: '',
        });
        setMode('form');
    };

    const handleEdit = (group) => {
        setEditingGroupId(group.groupId);
        setSelectedPeopleIds(group.people);
        setFormState({
            startDate: group.startDate,
            endDate: group.endDate,
            startSectionId: group.startSectionId,
            endSectionId: group.endSectionId,
            note: group.note,
        });
        setMode('form');
    };
    
    const renderAbsenceList = (absences) => (
        <ul className="space-y-2">
            {absences.map(group => (
                <li key={group.groupId} className="bg-gray-700 p-3 rounded-md">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-semibold">{group.note || "Group Absence"}</p>
                            <p className="text-sm text-gray-300">{new Date(group.startDate).toLocaleDateString()} to {new Date(group.endDate).toLocaleDateString()}</p>
                            <p className="text-xs text-gray-400">{group.people.length} people</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEdit(group)} className="text-yellow-400 hover:text-yellow-300"><Pencil size={18}/></button>
                            <button onClick={() => onDelete(group.groupId)} className="text-red-400 hover:text-red-300"><Trash2 size={18}/></button>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Manage Group Absences</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700"><XCircle size={24}/></button>
                </div>
                {mode === 'list' ? (
                    <>
                        <div className="flex border-b border-gray-700 mb-4">
                            <button onClick={() => setActiveTab('upcoming')} className={`px-4 py-2 ${activeTab === 'upcoming' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400'}`}>Active & Upcoming</button>
                            <button onClick={() => setActiveTab('past')} className={`px-4 py-2 ${activeTab === 'past' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400'}`}>Past History</button>
                        </div>
                        <div className="flex-grow overflow-y-auto">
                            {activeTab === 'upcoming' && (
                                <>
                                    {renderAbsenceList(upcomingAbsences)}
                                    {upcomingAbsences.length === 0 && <p className="text-center text-gray-400 py-8">No active or upcoming group absences.</p>}
                                </>
                            )}
                            {activeTab === 'past' && (
                                <>
                                    {renderAbsenceList(pastAbsences)}
                                    {pastAbsences.length === 0 && <p className="text-center text-gray-400 py-8">No past group absences.</p>}
                                </>
                            )}
                        </div>
                        <button onClick={handleAddNew} className="mt-4 w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">Add New Group Absence</button>
                    </>
                ) : (
                    <>
                        <div className="flex-grow overflow-y-auto space-y-4">
                            <div>
                                <h4 className="font-semibold mb-2">Select People</h4>
                                <div className="relative mb-2">
                                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search people..."
                                        value={groupSearchQuery}
                                        onChange={(e) => setGroupSearchQuery(e.target.value)}
                                        className="w-full bg-gray-700 border-gray-600 rounded-lg pl-10 pr-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <button onClick={handleSelectAll} className="mb-2 px-3 py-1 text-sm bg-blue-600 rounded-md hover:bg-blue-700">
                                    {selectedPeopleIds.length === filteredPeopleForGroupModal.length ? 'Deselect All' : 'Select All'} ({selectedPeopleIds.length}/{people.length})
                                </button>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-900/50 rounded-md">
                                    {filteredPeopleForGroupModal.map(person => (
                                        <label key={person.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-700 cursor-pointer">
                                            <input 
                                                type="checkbox"
                                                checked={selectedPeopleIds.includes(person.id)}
                                                onChange={() => handlePersonSelection(person.id)}
                                                className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span>{`${person.firstName} ${person.lastName}`}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
                                    <input type="date" name="startDate" value={formState.startDate} onChange={handleFormChange} className="w-full bg-gray-700 rounded-md p-2"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">End Date</label>
                                    <input type="date" name="endDate" value={formState.endDate} onChange={handleFormChange} className="w-full bg-gray-700 rounded-md p-2"/>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Start Class</label>
                                    <select name="startSectionId" value={formState.startSectionId} onChange={handleFormChange} className="w-full bg-gray-700 rounded-md p-2">
                                        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">End Class</label>
                                    <select name="endSectionId" value={formState.endSectionId} onChange={handleFormChange} className="w-full bg-gray-700 rounded-md p-2">
                                        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Note (Reason)</label>
                                <textarea name="note" value={formState.note} onChange={handleFormChange} placeholder="e.g., Wedding, Shabbaton" className="w-full bg-gray-700 rounded-md p-2 h-20"></textarea>
                            </div>
                            {validationError && <p className="text-red-400 text-sm">{validationError}</p>}
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setMode('list')} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-700">Cancel</button>
                            <button onClick={handleSaveClick} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">Save Group Absence</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GroupAbsenceModal;