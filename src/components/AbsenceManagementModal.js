import React, { useState } from 'react';
import { Pencil, Trash2, XCircle } from 'lucide-react';

import { generateId } from '../utils';

const AbsenceManagementModal = ({ person, sections, personRecords, onClose, onSave, onDelete }) => {
    const [mode, setMode] = useState('list'); // 'list' or 'form'
    const [currentRecord, setCurrentRecord] = useState(null);
    const [formState, setFormState] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        startSectionId: sections.length > 0 ? sections[0].id : '',
        endSectionId: sections.length > 0 ? sections[sections.length - 1].id : '',
        note: '',
    });
    const [validationError, setValidationError] = useState('');

    const handleEdit = (record) => {
        setCurrentRecord(record);
        setFormState(record);
        setMode('form');
    };

    const handleAddNew = () => {
        setCurrentRecord(null);
        setFormState({
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            startSectionId: sections.length > 0 ? sections[0].id : '',
            endSectionId: sections.length > 0 ? sections[sections.length - 1].id : '',
            note: '',
        });
        setMode('form');
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveClick = () => {
        if (new Date(formState.startDate) > new Date(formState.endDate)) {
            setValidationError("End date cannot be before start date.");
            return;
        }
        const recordToSave = currentRecord ? { ...formState, id: currentRecord.id } : { ...formState, personId: person.id };
        onSave(recordToSave);
        setMode('list');
        setValidationError('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Manage Absences for {person.firstName}</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700"><XCircle size={24}/></button>
                </div>

                {mode === 'list' && (
                    <div className="flex-grow overflow-y-auto">
                        <ul className="space-y-2">
                            {personRecords.sort((a,b) => new Date(b.startDate) - new Date(a.startDate)).map(record => (
                                <li key={record.id} className="bg-gray-700 p-3 rounded-md flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">
                                            {new Date(record.startDate).toLocaleDateString()} to {new Date(record.endDate).toLocaleDateString()}
                                        </p>
                                        <p className="text-sm text-gray-300">{record.note}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(record)} className="text-yellow-400 hover:text-yellow-300"><Pencil size={18}/></button>
                                        <button onClick={() => onDelete(record.id)} className="text-red-400 hover:text-red-300"><Trash2 size={18}/></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {personRecords.length === 0 && <p className="text-center text-gray-400 py-8">No absences recorded.</p>}
                        <button onClick={handleAddNew} className="mt-4 w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">Add New Absence</button>
                    </div>
                )}

                {mode === 'form' && (
                    <div>
                        <div className="space-y-4">
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
                                <textarea name="note" value={formState.note} onChange={handleFormChange} placeholder="e.g., Doctor's appointment" className="w-full bg-gray-700 rounded-md p-2 h-20"></textarea>
                            </div>
                            {validationError && <p className="text-red-400 text-sm">{validationError}</p>}
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setMode('list')} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-700">Cancel</button>
                            <button onClick={handleSaveClick} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">Save Absence</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AbsenceManagementModal;